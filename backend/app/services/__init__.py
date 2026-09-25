"""
Study Gen AI — Service layer

Business logic lives here (RAG service, AI service, etc.).
"""

from backend.app.services.ai_service import (
    AIError,
    chat_answer,
    generate_quiz,
    generate_revision,
)

__all__ = ["AIError", "chat_answer", "generate_quiz", "generate_revision"]