"""
Study Gen AI — OpenRouter Provider

Uses OpenRouter's OpenAI-compatible chat completion API.
"""

from __future__ import annotations

import json
import time
from typing import Optional

import httpx

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


class OpenRouterProvider(LLMProvider):
    """OpenRouter provider implementation using OpenAI-compatible API."""

    name = "openrouter"

    def is_configured(self) -> bool:
        return bool(settings.OPENROUTER_API_KEY)

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

        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://study-gen-ai.local",
            "X-Title": "Study Gen AI",
        }

        payload = {
            "model": settings.OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_output_tokens,
        }

        last_exc: Optional[Exception] = None
        timeout = httpx.Timeout(20.0, connect=10.0)

        for attempt in range(3):
            try:
                with httpx.Client(timeout=timeout) as client:
                    resp = client.post(
                        f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                        headers=headers,
                        json=payload,
                    )

                if resp.status_code == 401:
                    raise AIError("AI_AUTH_FAILED", "Invalid OpenRouter API key")
                if resp.status_code == 429:
                    raise AIError("AI_QUOTA_EXCEEDED", "OpenRouter quota exceeded")
                if resp.status_code >= 500:
                    raise AIError(
                        "AI_UNAVAILABLE",
                        f"OpenRouter server error: {resp.status_code}",
                    )
                if not resp.is_success:
                    raise AIError(
                        "AI_UNAVAILABLE",
                        f"OpenRouter error {resp.status_code}: {resp.text[:200]}",
                    )

                data = resp.json()
                choices = data.get("choices", [])
                if not choices:
                    raise AIError("AI_UNAVAILABLE", "No choices in OpenRouter response")

                text = choices[0].get("message", {}).get("content", "").strip()
                if not text:
                    raise AIError("AI_UNAVAILABLE", "Empty response from OpenRouter")

                return LLMResult(text=text)

            except AIError:
                raise
            except httpx.TimeoutException as exc:
                last_exc = exc
                raise AIError("AI_NETWORK_ERROR", "OpenRouter request timed out") from exc
            except httpx.NetworkError as exc:
                last_exc = exc
                raise AIError("AI_NETWORK_ERROR", "Network error connecting to OpenRouter") from exc
            except json.JSONDecodeError as exc:
                last_exc = exc
                raise AIError("AI_UNAVAILABLE", "Invalid JSON from OpenRouter") from exc
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                low = str(exc).lower()

                if _is_quota_error(exc):
                    raise self._classify_exception(exc) from exc
                if _is_auth_error(exc):
                    raise self._classify_exception(exc) from exc

                transient = _is_provider_error(exc) or _is_network_error(exc)
                if transient and attempt < 2:
                    time.sleep(1.0 * (attempt + 1))
                    continue

                raise self._classify_exception(exc) from exc

        if last_exc:
            raise self._classify_exception(last_exc) from last_exc
        raise AIError("AI_UNAVAILABLE", "Max retries exceeded")