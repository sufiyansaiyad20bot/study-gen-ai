"""
Study Gen AI — LLM-powered generation: chat, quiz, revision.

All generation calls go through the configured LLM provider (Gemini or OpenRouter),
which returns the generated text on success or raises `AIError` with a `code` field
that the API layer maps to an HTTP response. The possible codes are:

    - "AI_NOT_CONFIGURED"  : required API key missing or empty
    - "AI_QUOTA_EXCEEDED"  : provider returned 429 / quota exceeded
    - "AI_AUTH_FAILED"     : authentication failed (invalid API key)
    - "AI_UNAVAILABLE"     : provider is reachable but the call failed
                              (5xx, bad response, model not found, etc.)
    - "AI_NETWORK_ERROR"   : connection / DNS / timeout error
"""

from __future__ import annotations

import json
import re
from typing import Optional

from backend.app.core.config import settings
from backend.app.services.llm import (
    AIError,
    get_configured_provider,
)

# Re-export for backwards compatibility
from backend.app.services.llm.base import AIError as _AIError


# ----- user-facing messages (no API key, no internal details) -----------------

MSG_NOT_CONFIGURED = (
    "The AI API key is not configured on the server. "
    "Add the required API key to the backend .env file and restart the backend."
)
MSG_QUOTA = (
    "The AI provider quota has been reached. Your document and RAG retrieval are "
    "working correctly, but the AI service is temporarily unavailable. "
    "Please try again later, or use a different provider / key with available quota."
)
MSG_UNAVAILABLE = (
    "The AI service is temporarily unavailable. Your uploaded study material "
    "and RAG retrieval are still working — please try again in a moment."
)
MSG_NETWORK = (
    "Could not reach the AI service. Check your network connection and try "
    "again. Your uploaded study material and RAG retrieval are still working."
)


# ----- prompts ----------------------------------------------------------------

# NOTE: keep prompts short and give a concrete example rather than an
# escaped JSON schema. Long escaped schemas make the model hallucinate
# a "checklist" of the requirements instead of emitting the JSON itself.

_CHAT_SYSTEM = (
    "You are Study Gen AI, an AI study assistant for students. "
    "You will be given the student's question and CONTEXT extracted from "
    "their own uploaded study material. "
    "Answer the question using the CONTEXT when it contains enough relevant "
    "information. If the CONTEXT does not contain enough information to answer, "
    "clearly state that the information was not found in the uploaded material "
    "and then provide a general explanation. "
    "Never claim that information came from the uploaded document unless the "
    "CONTEXT actually supports it. Never invent document citations. "
    "Cite the source filename(s) only when you actually used the CONTEXT."
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


# ----- helpers ----------------------------------------------------------------

def _call_provider(prompt: str, system: str) -> str:
    """Call the configured LLM provider with retry on transient errors.

    Raises AIError on failure.
    """
    provider = get_configured_provider()
    result = provider.generate(prompt, system)
    return result.text


# ----- JSON parsing -----------------------------------------------------------

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


# ----- public generation entry points ----------------------------------------

def chat_answer(question: str, contexts: list[dict]) -> dict:
    """Answer a question using retrieved context chunks.

    Returns a dict with:
      - answer: str
      - answer_source: "uploaded_documents" or "general_knowledge"
      - message: optional human-friendly note for general-knowledge answers

    Raises AIError if the AI service is unavailable.
    """
    if not contexts:
        # No relevant document context — fall back to general knowledge
        prompt = (
            f"QUESTION:\n{question}\n\n"
            "The student's uploaded study material does not contain enough "
            "relevant information to answer this question. "
            "Provide a clear, accurate general explanation. "
            "Begin your response by stating that this information was not found "
            "in the uploaded study material, then give the explanation."
        )
        answer = _call_provider(prompt, _CHAT_SYSTEM)
        return {
            "answer": answer,
            "answer_source": "general_knowledge",
            "message": "This information was not found in your uploaded study material.",
        }

    ctx_lines = []
    for c in contexts:
        ctx_lines.append(
            f"[Source: {c['doc_filename']} | chunk {c['chunk_index']} | relevance {c['score']}]\n{c['text']}"
        )
    context_block = "\n\n---\n\n".join(ctx_lines)

    prompt = (
        f"CONTEXT FROM THE STUDENT'S UPLOADED MATERIAL:\n\n{context_block}\n\n"
        f"QUESTION:\n{question}\n\n"
        "Answer using the CONTEXT above. Be clear and accurate. "
        "If the CONTEXT does not contain enough information to answer, "
        "clearly state that the information was not found in the uploaded material "
        "and then provide a general explanation."
    )
    answer = _call_provider(prompt, _CHAT_SYSTEM)
    return {
        "answer": answer,
        "answer_source": "uploaded_documents",
    }


def generate_quiz(contexts: list[dict], num_questions: int = 5) -> dict:
    """Generate a multiple-choice quiz from retrieved context.

    Raises AIError if the AI service cannot serve the request. We do NOT silently
    fall back to a deterministic fake quiz — the user must know that AI
    generation is unavailable.
    """
    if not contexts:
        raise ValueError("No contexts available to generate a quiz from")

    ctx_lines = [c["text"] for c in contexts]
    context_block = "\n\n---\n\n".join(ctx_lines)

    prompt = (
        f"Generate exactly {num_questions} multiple-choice questions "
        f"from this study material. Each question must have 4 options and one "
        f"correct answer.\n\nCONTEXT:\n{context_block}"
    )

    raw = _call_provider(prompt, _QUIZ_SYSTEM)
    parsed = _extract_json(raw)
    if parsed and isinstance(parsed.get("questions"), list) and parsed["questions"]:
        return parsed

    # The model produced text but it wasn't valid JSON — surface as unavailable
    raise AIError(
        "AI_UNAVAILABLE",
        "The AI service returned a response that could not be parsed as a quiz. "
        "Please try again.",
    )


def generate_revision(contexts: list[dict], topic: Optional[str] = None) -> dict:
    """Generate revision notes from retrieved context.

    Raises AIError if the AI service cannot serve the request. We do NOT silently
    fall back to a deterministic fake revision — the user must know that
    AI generation is unavailable.
    """
    if not contexts:
        raise ValueError("No contexts available to generate revision notes from")

    ctx_lines = [c["text"] for c in contexts]
    context_block = "\n\n---\n\n".join(ctx_lines)

    topic_hint = f" Focus on: {topic}." if topic else ""
    prompt = (
        f"Create revision notes from this study material.{topic_hint}\n\n"
        f"CONTEXT:\n{context_block}"
    )

    raw = _call_provider(prompt, _REVISION_SYSTEM)
    parsed = _extract_json(raw)
    if parsed and (parsed.get("title") or parsed.get("summary")):
        return parsed

    raise AIError(
        "AI_UNAVAILABLE",
        "The AI service returned a response that could not be parsed as revision notes. "
        "Please try again.",
    )