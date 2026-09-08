"""
Chat / interaction history model.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from backend.app.database import Base


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)

    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    grounded = Column(Integer, default=0, nullable=False)  # 0/1 for SQLite friendliness

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="chat_history")

    def __repr__(self) -> str:
        return f"<ChatHistory id={self.id} user_id={self.user_id}>"