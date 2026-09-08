"""
Revision notes generation endpoint.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.api.errors import raise_ai_error
from backend.app.database import get_db
from backend.app.models.document import Document
from backend.app.models.user import User
from backend.app.rag.vector_store import vector_store
from backend.app.schemas import ChatSource, RevisionRequest, RevisionResponse
from backend.app.services import generate_revision
from backend.app.services.ai_service import AIError


router = APIRouter(prefix="/revision", tags=["Revision"])


@router.post("/generate", response_model=RevisionResponse)
def generate_revision_endpoint(
    payload: RevisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate structured revision notes from the user's documents."""
    if payload.document_id is not None:
        doc = (
            db.query(Document)
            .filter(
                Document.id == payload.document_id,
                Document.user_id == current_user.id,
                Document.status == "ready",
            )
            .first()
        )
        if not doc:
            raise HTTPException(
                status_code=404, detail="Document not found or not ready"
            )

    contexts = vector_store.list_chunks(
        current_user.id,
        doc_id=payload.document_id,
        limit=15,
    )

    if not contexts:
        raise HTTPException(
            status_code=400,
            detail="No content available in your documents to generate notes.",
        )

    try:
        result = generate_revision(contexts, topic=payload.topic)
    except AIError as exc:
        raise_ai_error(exc)
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

    return RevisionResponse(
        title=result.get("title") or "Revision Notes",
        summary=result.get("summary") or "",
        key_concepts=result.get("key_concepts") or [],
        important_points=result.get("important_points") or [],
        definitions=result.get("definitions") or [],
        formulas=result.get("formulas") or [],
        sources=sources,
    )