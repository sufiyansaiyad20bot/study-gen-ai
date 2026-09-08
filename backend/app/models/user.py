"""
====================================================
Study Gen AI â€” Student / User Model
====================================================

Every student has their own account.
All other data (documents, chats, quizzes) will
be linked to this model via user_id.
====================================================
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import relationship

from backend.app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    branch = Column(String(100), nullable=False)
    semester = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    documents = relationship(
        "Document",
        back_populates="owner",
        cascade="all, delete-orphan",
    )

    chat_history = relationship(
        "ChatHistory",
        back_populates="owner",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} name={self.name} email={self.email}>"