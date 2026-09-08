"""
Quiz generation endpoint.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.api.errors import raise_ai_error
from backend.app.database import get_db
from backend.app.models.document import Document
from backend.app.models.user import User
from backend.app.rag.vector_store import vector_store
from backend.app.schemas import QuizRequest, QuizResponse
from backend.app.services import generate_quiz
from backend.app.services.ai_service import AIError


router = APIRouter(prefix="/quiz", tags=["Quiz"])


@router.post("/generate", response_model=QuizResponse)
def generate_quiz_endpoint(
    payload: QuizRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a multiple-choice quiz from the user's documents."""
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

    # Use the raw chunk list for the user. This is more reliable than
    # similarity search for quiz generation since we want broad coverage
    # of the source material, not just chunks similar to a query.
    contexts = vector_store.list_chunks(
        current_user.id,
        doc_id=payload.document_id,
        limit=max(payload.num_questions * 4, 12),
    )

    if not contexts:
        raise HTTPException(
            status_code=400,
            detail="No content available in your documents to generate a quiz.",
        )

    try:
        result = generate_quiz(contexts, num_questions=payload.num_questions)
    except AIError as exc:
        raise_ai_error(exc)
    return QuizResponse(questions=result["questions"])