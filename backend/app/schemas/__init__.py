"""
Study Gen AI — Pydantic Schemas

Request and response validation models.
"""

from backend.app.schemas.auth import (
    Token,
    TokenData,
    UserCreate,
    UserLogin,
    UserOut,
)
from backend.app.schemas.features import (
    ChatRequest,
    ChatResponse,
    ChatSource,
    DocumentOut,
    QuizQuestion,
    QuizRequest,
    QuizResponse,
    RevisionRequest,
    RevisionResponse,
)
from backend.app.schemas.history import ChatHistoryOut

__all__ = [
    "UserCreate",
    "UserLogin",
    "UserOut",
    "Token",
    "TokenData",
    "DocumentOut",
    "ChatRequest",
    "ChatResponse",
    "ChatSource",
    "QuizRequest",
    "QuizResponse",
    "QuizQuestion",
    "RevisionRequest",
    "RevisionResponse",
    "ChatHistoryOut",
]