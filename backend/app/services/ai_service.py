"""
Study Gen AI — Gemini-powered generation: chat, quiz, revision.

All generation calls go through `_call_gemini`, which:

  * returns the generated text on success
  * raises `AIError` with a `code` field that the API layer maps to an
    HTTP response. The possible codes are:

        - "AI_NOT_CONFIGURED"  : GEMINI_API_KEY missing or empty
        - "AI_QUOTA_EXCEEDED"  : Gemini returned 429 / quota
        - "AI_UNAVAILABLE"     : Gemini is reachable but the call failed
                                 (5xx, bad response, model not found, etc.)
        - "AI_NETWORK_ERROR"   : connection / DNS / timeout error
"""

from __future__ import annotations

import json
import re
import socket
import time
from typing import Optional

from backend.app.core.config import settings


# ----- public error type ----------------------------------------------------

class AIError(Exception):
    """Raised by the AI service when a generation request cannot be served.

    The HTTP layer turns this into a 503 with a structured body so the
    frontend can render a precise user-facing message.
    """

    def __init__(self, code: str, message: str, retry_after: Optional[int] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retry_after = retry_after


# ----- user-facing messages (no API key, no key wording) --------------------

MSG_NOT_CONFIGURED = (
    "The Gemini API key is not configured on the server. "
    "Add GEMINI_API_KEY to the backend .env file and restart the backend."
)
MSG_QUOTA = (
    "Gemini API quota has been reached. Your document and RAG retrieval are "
    "working correctly, but Gemini is temporarily unavailable because the API "
    "quota was exceeded. Please try again later, or use a Gemini API key / "
    "model that still has available quota."
)
MSG_UNAVAILABLE = (
    "The AI service is temporarily unavailable. Your uploaded study material "
    "and RAG retrieval are still working — please try again in a moment."
)
MSG_NETWORK = (
    "Could not reach the AI service. Check your network connection and try "
    "again. Your uploaded study material and RAG retrieval are still working."
)


# ----- prompts --------------------------------------------------------------

# NOTE: keep prompts short and give a concrete example rather than an
# escaped JSON schema. Long escaped schemas make the model hallucinate
# a "checklist" of the requirements instead of emitting the JSON itself.

_CHAT_SYSTEM = (
    "You are Study Gen AI, an AI study assistant for students. "
    "You will be given the student's question and CONTEXT extracted from "
    "their own uploaded study material. Answer the question using the CONTEXT. "
    "If the CONTEXT does not contain enough information to answer, say so clearly "
    "and suggest what the student could upload or ask instead. "
    "Cite the source filename(s) when you use the CONTEXT."
)

_QUIZ_SYSTEM = (
    "You are Study Gen AI. Generate a multiple-choice quiz from the CONTEXT below. "
    "Return ONLY a JSON object. No prose, no markdown fences, no extra text. "
    "The JSON must look exactly like this example (replace the values):\n\n"
    '{"questions": [\n'
    '  {"question": "What is ...?", "options": ["A", "B", "C", "D"], '
    '"correct_index": 0, "explanation": "Because ..."},\n'
    '  {"question": "...", "options": ["...", "...", "...", "..."], '
    '"correct_index": 2, "explanation": "..."}\n'
    "]}\n\n"
    "Rules: every question has exactly 4 options; correct_index is 0-3; "
    "the correct answer must match one of the options; the explanation must "
    "be grounded in the CONTEXT."
)

_REVISION_SYSTEM = (
    "You are Study Gen AI. Create concise revision notes from the CONTEXT below. "
    "Return ONLY a JSON object. No prose, no markdown fences, no extra text. "
    "The JSON must look exactly like this example (replace the values):\n\n"
    '{"title": "Revision Notes", "summary": "One paragraph summary.", '
    '"key_concepts": ["concept A", "concept B"], '
    '"important_points": ["point 1", "point 2"], '
    '"definitions": [{"term": "term", "definition": "definition"}], '
    '"formulas": ["formula 1"]}\n\n'
    "Rules: every field must be present; use empty lists when nothing applies; "
    "all content must be grounded in the CONTEXT."
)


# ----- helpers --------------------------------------------------------------

def _is_configured() -> bool:
    return bool(settings.GEMINI_API_KEY)


def _classify_exception(exc: Exception) -> AIError:
    """Map a low-level Gemini exception to a user-friendly AIError."""
    msg = str(exc) or ""
    low = msg.lower()

    # Network / DNS / timeout
    if isinstance(exc, (socket.gaierror, socket.timeout, TimeoutError, ConnectionError)):
        return AIError("AI_NETWORK_ERROR", MSG_NETWORK)
    if "timed out" in low or "deadline" in low or "timeout" in low:
        return AIError("AI_NETWORK_ERROR", MSG_NETWORK)

    # Quota
    if "429" in msg or "quota" in low or "resource_exhausted" in low or "rate" in low:
        retry = None
        # Try to extract Retry-After-style hints; the SDK doesn't expose
        # headers directly, so this is best-effort.
        m = re.search(r"retry.*?(\d+)\s*s", low)
        if m:
            try:
                retry = int(m.group(1))
            except ValueError:
                retry = None
        return AIError("AI_QUOTA_EXCEEDED", MSG_QUOTA, retry_after=retry)

    # Model not found / 404
    if "404" in msg and "model" in low:
        return AIError(
            "AI_UNAVAILABLE",
            MSG_UNAVAILABLE + f" (model not available: {settings.GEMINI_MODEL})",
        )

    # Generic 5xx
    if any(code in msg for code in ("500", "502", "503", "504")):
        return AIError("AI_UNAVAILABLE", MSG_UNAVAILABLE)

    return AIError("AI_UNAVAILABLE", MSG_UNAVAILABLE + f" (detail: {msg[:160]})")


def _call_gemini(prompt: str, system: str) -> str:
    """Call Gemini with retry on transient errors. Raise AIError on failure."""
    if not _is_configured():
        raise AIError("AI_NOT_CONFIGURED", MSG_NOT_CONFIGURED)

    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)

    last_exc: Optional[Exception] = None
    for attempt in range(3):
        try:
            resp = model.generate_content(
                [system, prompt],
                generation_config={"temperature": 0.3, "max_output_tokens": 2048},
                request_options={"timeout": 25},
            )
            text = (resp.text or "").strip()
            if not text:
                # Empty response from Gemini is not a quota issue, but
                # treat as AI_UNAVAILABLE rather than pretending success.
                raise AIError("AI_UNAVAILABLE", MSG_UNAVAILABLE)
            return text
        except AIError:
            raise
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            low = str(exc).lower()
            transient = (
                "429" in str(exc)
                or "500" in str(exc)
                or "502" in str(exc)
                or "503" in str(exc)
                or "504" in str(exc)
                or "deadline" in low
                or "timed out" in low
                or "resource_exhausted" in low
                or "quota" in low
                or "rate" in low
            )
            # For transient errors, retry up to 3 times with backoff
            if transient and attempt < 2:
                time.sleep(1.5 * (attempt + 1))
                continue
            # Otherwise, classify and raise
            raise _classify_exception(exc) from exc

    # Should not be reached, but guard anyway
    if last_exc:
        raise _classify_exception(last_exc) from last_exc
    raise AIError("AI_UNAVAILABLE", MSG_UNAVAILABLE)


# ----- JSON parsing ---------------------------------------------------------

def _extract_json(text: str) -> Optional[dict]:
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            return None
    return None


# ----- public generation entry points ---------------------------------------

def chat_answer(question: str, contexts: list[dict]) -> str:
    """Answer a question using retrieved context chunks.

    Raises AIError if Gemini is unavailable. Returns a string only on success.
    """
    if not contexts:
        return (
            "I couldn't find anything relevant in your uploaded study material to "
            "answer this question. Please upload notes on this topic and try again."
        )

    ctx_lines = []
    for c in contexts:
        ctx_lines.append(
            f"[Source: {c['doc_filename']} | chunk {c['chunk_index']} | relevance {c['score']}]\n{c['text']}"
        )
    context_block = "\n\n---\n\n".join(ctx_lines)

    prompt = (
        f"CONTEXT FROM THE STUDENT'S UPLOADED MATERIAL:\n\n{context_block}\n\n"
        f"QUESTION:\n{question}\n\n"
        "Answer using the CONTEXT above. Be clear and accurate."
    )
    return _call_gemini(prompt, _CHAT_SYSTEM)


def generate_quiz(contexts: list[dict], num_questions: int = 5) -> dict:
    """Generate a multiple-choice quiz from retrieved context.

    Raises AIError if Gemini cannot serve the request. We do NOT silently
    fall back to a deterministic fake quiz — the user must know that AI
    generation is unavailable.
    """
    if not _is_configured():
        raise AIError("AI_NOT_CONFIGURED", MSG_NOT_CONFIGURED)

    if not contexts:
        raise ValueError("No contexts available to generate a quiz from")

    ctx_lines = [c["text"] for c in contexts]
    context_block = "\n\n---\n\n".join(ctx_lines)

    prompt = (
        f"Generate exactly {num_questions} multiple-choice questions "
        f"from this study material. Each question must have 4 options and one "
        f"correct answer.\n\nCONTEXT:\n{context_block}"
    )

    raw = _call_gemini(prompt, _QUIZ_SYSTEM)
    parsed = _extract_json(raw)
    if parsed and isinstance(parsed.get("questions"), list) and parsed["questions"]:
        return parsed

    # The model produced text but it wasn't valid JSON — surface as unavailable
    raise AIError(
        "AI_UNAVAILABLE",
        "Gemini returned a response that could not be parsed as a quiz. "
        "Please try again.",
    )


def generate_revision(contexts: list[dict], topic: Optional[str] = None) -> dict:
    """Generate revision notes from retrieved context.

    Raises AIError if Gemini cannot serve the request. We do NOT silently
    fall back to a deterministic fake revision — the user must know that
    AI generation is unavailable.
    """
    if not _is_configured():
        raise AIError("AI_NOT_CONFIGURED", MSG_NOT_CONFIGURED)

    if not contexts:
        raise ValueError("No contexts available to generate revision notes from")

    ctx_lines = [c["text"] for c in contexts]
    context_block = "\n\n---\n\n".join(ctx_lines)

    topic_hint = f" Focus on: {topic}." if topic else ""
    prompt = (
        f"Create revision notes from this study material.{topic_hint}\n\n"
        f"CONTEXT:\n{context_block}"
    )

    raw = _call_gemini(prompt, _REVISION_SYSTEM)
    parsed = _extract_json(raw)
    if parsed and (parsed.get("title") or parsed.get("summary")):
        return parsed

    raise AIError(
        "AI_UNAVAILABLE",
        "Gemini returned a response that could not be parsed as revision notes. "
        "Please try again.",
    )
