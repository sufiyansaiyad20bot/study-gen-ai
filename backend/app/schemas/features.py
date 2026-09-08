"""
Pydantic schemas for documents, chat, quiz, revision.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DocumentOut(BaseModel):
    id: int
    filename: str
    file_type: str
    file_size: int
    text_chars: int
    chunk_count: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=2000)
    document_id: Optional[int] = None


class ChatSource(BaseModel):
    doc_id: int
    doc_filename: str
    chunk_index: int
    score: float
    snippet: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[ChatSource]
    grounded: bool


class QuizRequest(BaseModel):
    document_id: Optional[int] = None
    num_questions: int = Field(5, ge=1, le=20)


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct_index: int
    explanation: Optional[str] = None


class QuizResponse(BaseModel):
    questions: list[QuizQuestion]


class RevisionRequest(BaseModel):
    document_id: Optional[int] = None
    topic: Optional[str] = Field(None, max_length=200)


class RevisionResponse(BaseModel):
    title: str
    summary: str
    key_concepts: list[str]
    important_points: list[str]
    definitions: list[dict] = []
    formulas: list[str] = []
    sources: list[ChatSource] = []