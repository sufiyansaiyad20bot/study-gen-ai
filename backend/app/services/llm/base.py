"""
Study Gen AI — LLM Provider Base

Abstract base class for LLM providers and shared exceptions.
"""

from __future__ import annotations

import socket
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


# ----- Exceptions -------------------------------------------------------------


class AIError(Exception):
    """Raised by the AI service when a generation request cannot be served.

    The HTTP layer turns this into a 503 with a structured body so the
    frontend can render a precise user-facing message.
    """

    def __init__(
        self,
        code: str,
        message: str,
        retry_after: Optional[int] = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retry_after = retry_after


# ----- User-facing messages (no API keys, no internal details) ---------------

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
MSG_AUTH_FAILED = (
    "Authentication failed with the AI provider. Verify the API key is valid."
)
MSG_PROVIDER_UNAVAILABLE = (
    "The AI provider returned an error. Please try again later."
)


# ----- Helpers ----------------------------------------------------------------


def _is_network_error(exc: Exception) -> bool:
    """Check if exception is a network/timeout error."""
    if isinstance(exc, (socket.gaierror, socket.timeout, TimeoutError, ConnectionError)):
        return True
    msg = str(exc).lower()
    return any(
        kw in msg
        for kw in (
            "timed out",
            "deadline",
            "timeout",
            "connection",
            "dns",
            "network",
        )
    )


def _is_quota_error(exc: Exception) -> bool:
    """Check if exception is a quota/rate limit error."""
    msg = str(exc).lower()
    return any(
        kw in msg
        for kw in (
            "429",
            "quota",
            "resource_exhausted",
            "rate limit",
            "rate_limit",
        )
    )


def _is_auth_error(exc: Exception) -> bool:
    """Check if exception is an authentication error."""
    msg = str(exc).lower()
    return any(
        kw in msg
        for kw in (
            "401",
            "unauthorized",
            "invalid api key",
            "invalid_api_key",
            "authentication",
            "permission denied",
            "forbidden",
        )
    )


def _is_provider_error(exc: Exception) -> bool:
    """Check if exception is a provider-side error (5xx)."""
    msg = str(exc)
    return any(code in msg for code in ("500", "502", "503", "504"))


# ----- Provider interface -----------------------------------------------------


@dataclass(frozen=True)
class LLMResult:
    """Result from an LLM provider call."""
    text: str


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    name: str

    @abstractmethod
    def is_configured(self) -> bool:
        """Check if the provider has valid configuration."""
        ...

    @abstractmethod
    def generate(
        self,
        prompt: str,
        system: str,
        *,
        temperature: float = 0.3,
        max_output_tokens: int = 2048,
    ) -> LLMResult:
        """Generate text from the LLM.

        Args:
            prompt: The user prompt / question.
            system: The system prompt / instructions.
            temperature: Sampling temperature.
            max_output_tokens: Maximum tokens in response.

        Returns:
            LLMResult with the generated text.

        Raises:
            AIError: On configuration error, quota, auth failure, etc.
        """
        ...

    def _classify_exception(self, exc: Exception) -> AIError:
        """Map a low-level exception to a user-friendly AIError."""
        msg = str(exc) or ""

        if _is_network_error(exc):
            return AIError("AI_NETWORK_ERROR", MSG_NETWORK)

        if _is_quota_error(exc):
            return AIError("AI_QUOTA_EXCEEDED", MSG_QUOTA)

        if _is_auth_error(exc):
            return AIError("AI_AUTH_FAILED", MSG_AUTH_FAILED)

        if _is_provider_error(exc):
            return AIError("AI_UNAVAILABLE", MSG_PROVIDER_UNAVAILABLE)

        return AIError("AI_UNAVAILABLE", MSG_UNAVAILABLE + f" (detail: {msg[:160]})")