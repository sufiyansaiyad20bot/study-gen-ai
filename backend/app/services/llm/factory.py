"""
Study Gen AI — Provider Factory

Selects and returns the appropriate LLM provider based on configuration.
"""

from __future__ import annotations

from backend.app.core.config import settings
from backend.app.services.llm.base import LLMProvider
from backend.app.services.llm.gemini import GeminiProvider
from backend.app.services.llm.openrouter import OpenRouterProvider


_PROVIDER_MAP = {
    "gemini": GeminiProvider,
    "openrouter": OpenRouterProvider,
}


def get_provider(provider_name: Optional[str] = None) -> LLMProvider:
    """Get the LLM provider instance based on configuration.

    Args:
        provider_name: Optional override. If None, uses settings.LLM_PROVIDER.

    Returns:
        LLMProvider instance.

    Raises:
        ValueError: If provider name is invalid.
    """
    name = (provider_name or settings.LLM_PROVIDER or "gemini").lower().strip()

    if name not in _PROVIDER_MAP:
        available = ", ".join(sorted(_PROVIDER_MAP.keys()))
        raise ValueError(
            f"Invalid LLM_PROVIDER '{name}'. Available providers: {available}"
        )

    return _PROVIDER_MAP[name]()


def get_configured_provider() -> LLMProvider:
    """Get the provider and verify it's configured.

    Returns:
        Configured LLMProvider instance.

    Raises:
        AIError: If the selected provider is not configured (missing API key).
    """
    from backend.app.services.llm.base import AIError, MSG_NOT_CONFIGURED

    provider = get_provider()
    if not provider.is_configured():
        raise AIError(
            "AI_NOT_CONFIGURED",
            f"The '{provider.name}' provider is not configured. "
            f"Set the required API key in .env and restart.",
        )
    return provider