"""
Study Gen AI â€” Service layer

Business logic lives here (RAG service, AI service, etc.).
"""

from backend.app.services.ai_service import (
    chat_answer,
    generate_quiz,
    generate_revision,
)

__all__ = ["chat_answer", "generate_quiz", "generate_revision"]