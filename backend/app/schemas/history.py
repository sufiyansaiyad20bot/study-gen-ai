"""
Pydantic schemas for chat history.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ChatHistoryOut(BaseModel):
    id: int
    document_id: Optional[int]
    question: str
    answer: str
    grounded: bool
    created_at: datetime

    class Config:
        from_attributes = True