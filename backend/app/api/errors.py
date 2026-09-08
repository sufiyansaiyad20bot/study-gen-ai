"""
Shared exception helpers for the API layer.

`AIError` is raised by the AI service layer when Gemini cannot serve a
request. This module translates it into a structured 503 HTTP response
so the frontend can render a precise user-facing message based on
`detail.code`.
"""

from fastapi import HTTPException

from backend.app.services.ai_service import AIError


def raise_ai_error(exc: AIError) -> None:
    """Re-raise an AIError as a structured 503 HTTPException."""
    headers = {}
    if exc.retry_after is not None:
        headers["Retry-After"] = str(exc.retry_after)
    raise HTTPException(
        status_code=503,
        detail={
            "code": exc.code,
            "message": exc.message,
        },
        headers=headers or None,
    )
