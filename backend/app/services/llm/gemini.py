"""
Study Gen AI — Gemini Provider

Wraps the Google Generative AI SDK with the provider interface.
"""

from __future__ import annotations

import time
from typing import Optional

from backend.app.core.config import settings
from backend.app.services.llm.base import (
    AIError,
    LLMProvider,
    LLMResult,
    MSG_NOT_CONFIGURED,
    _is_quota_error,
    _is_network_error,
    _is_auth_error,
    _is_provider_error,
)


class GeminiProvider(LLMProvider):
    """Google Gemini provider implementation."""

    name = "gemini"

    def is_configured(self) -> bool:
        return bool(settings.GEMINI_API_KEY)

    def generate(
        self,
        prompt: str,
        system: str,
        *,
        temperature: float = 0.3,
        max_output_tokens: int = 2048,
    ) -> LLMResult:
        if not self.is_configured():
            raise AIError("AI_NOT_CONFIGURED", MSG_NOT_CONFIGURED)

        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(settings.GEMINI_MODEL)

        last_exc: Optional[Exception] = None
        for attempt in range(3):
            try:
                resp = model.generate_content(
                    [system, prompt],
                    generation_config={
                        "temperature": temperature,
                        "max_output_tokens": max_output_tokens,
                    },
                    request_options={"timeout": 20},
                )
                text = (resp.text or "").strip()
                if not text:
                    raise AIError("AI_UNAVAILABLE", "Empty response from Gemini")
                return LLMResult(text=text)
            except AIError:
                raise
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                low = str(exc).lower()

                # Quota: do NOT retry — surface immediately
                if _is_quota_error(exc):
                    raise self._classify_exception(exc) from exc

                # Auth failure: do NOT retry
                if _is_auth_error(exc):
                    raise self._classify_exception(exc) from exc

                # Transient errors: retry with backoff
                transient = _is_provider_error(exc) or _is_network_error(exc)
                if transient and attempt < 2:
                    time.sleep(1.0 * (attempt + 1))
                    continue

                raise self._classify_exception(exc) from exc

        if last_exc:
            raise self._classify_exception(last_exc) from last_exc
        raise AIError("AI_UNAVAILABLE", "Max retries exceeded")