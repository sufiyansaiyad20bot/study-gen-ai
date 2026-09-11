"""
RAG-powered chat endpoint.

POST /chat         — primary chat endpoint
POST /chat/ask     — alias requested by the spec
GET  /chat/history — basic per-user interaction history
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.api.errors import raise_ai_error
from backend.app.database import get_db
from backend.app.models.chat_history import ChatHistory
from backend.app.models.document import Document
from backend.app.models.user import User
from backend.app.rag import is_relevant, retrieve
from backend.app.schemas import (
    ChatHistoryOut,
    ChatRequest,
    ChatResponse,
    ChatSource,
)
from backend.app.services import chat_answer
from backend.app.services.ai_service import AIError


router = APIRouter(prefix="/chat", tags=["Chat"])


def _available_doc_ids(db: Session, user: User) -> set[int]:
    rows = (
        db.query(Document.id)
        .filter(Document.user_id == user.id, Document.status == "ready")
        .all()
    )
    return {r[0] for r in rows}


def _ask(payload: ChatRequest, db: Session, current_user: User) -> ChatResponse:
    available = _available_doc_ids(db, current_user)
    if not available:
        raise HTTPException(
            status_code=400,
            detail="You have no processed documents yet. Upload a study material first.",
        )

    if payload.document_id is not None and payload.document_id not in available:
        raise HTTPException(
            status_code=404, detail="Document not found or not ready"
        )

    contexts = retrieve(
        current_user.id,
        payload.question,
        doc_id=payload.document_id,
    )

    # Determine whether retrieved context is actually relevant enough
    # to treat the answer as document-grounded. A non-empty result from
    # FAISS does NOT guarantee relevance — the deterministic embedder can
    # produce non-zero similarity for unrelated chunks.
    relevant = is_relevant(payload.question, contexts)

    sources = [
        ChatSource(
            doc_id=c["doc_id"],
            doc_filename=c["doc_filename"],
            chunk_index=c["chunk_index"],
            score=c["score"],
            snippet=c["text"][:280],
        )
        for c in contexts
    ]

    try:
        result = chat_answer(payload.question, contexts if relevant else [])
    except AIError as exc:
        raise_ai_error(exc)

    answer_text = result["answer"]
    answer_source = result.get(
        "answer_source",
        "uploaded_documents" if relevant else "general_knowledge",
    )
    general_message = result.get("message", "")

    # Persist the interaction for this user only.
    history = ChatHistory(
        user_id=current_user.id,
        document_id=payload.document_id,
        question=payload.question,
        answer=answer_text,
        grounded=1 if relevant else 0,
    )
    db.add(history)
    db.commit()

    return ChatResponse(
        answer=answer_text,
        sources=sources if relevant else [],
        grounded=relevant,
        answer_source=answer_source,
        general_message=general_message,
    )


@router.post("", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ask a question grounded in the user's uploaded documents."""
    return _ask(payload, db, current_user)


@router.post("/ask", response_model=ChatResponse)
def chat_ask(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Alias for the spec-mandated `/chat/ask` endpoint."""
    return _ask(payload, db, current_user)


@router.get("/history", response_model=list[ChatHistoryOut])
def chat_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the latest chat interactions for the current user."""
    limit = max(1, min(200, limit))
    rows = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == current_user.id)
        .order_by(ChatHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    # Serialise `grounded` (0/1) to bool for the schema
    out: list[ChatHistoryOut] = []
    for r in rows:
        out.append(
            ChatHistoryOut(
                id=r.id,
                document_id=r.document_id,
                question=r.question,
                answer=r.answer,
                grounded=bool(r.grounded),
                created_at=r.created_at,
            )
        )
    return out