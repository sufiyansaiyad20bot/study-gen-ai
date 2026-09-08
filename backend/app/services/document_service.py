"""
Document service: orchestrates upload -> save -> extract -> chunk -> embed -> index.
"""

from __future__ import annotations

import re
import secrets
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.document_processing import chunk_text, clean_text, extract_text
from backend.app.models.document import Document
from backend.app.models.user import User
from backend.app.rag import embed_texts, vector_store


_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_filename(name: str) -> str:
    """Sanitize an uploaded filename to prevent path traversal."""
    name = name.replace("\\", "/").split("/")[-1]
    name = _SAFE_NAME.sub("_", name).strip("._-")
    if not name:
        name = "document"
    return name[:200]


def _unique_stored_filename(safe_name: str) -> str:
    return f"{secrets.token_hex(8)}_{safe_name}"


def save_and_process(
    db: Session,
    user: User,
    original_filename: str,
    file_bytes: bytes,
) -> Document:
    """Save an uploaded file, extract text, chunk, embed, and index."""
    safe_name = _safe_filename(original_filename)
    ext = Path(safe_name).suffix.lower()

    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {ext}. Allowed: PDF, DOCX, TXT.",
        )

    if len(file_bytes) > settings.MAX_UPLOAD_SIZE_BYTES:
        mb = settings.MAX_UPLOAD_SIZE_MB
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {mb} MB.",
        )

    # Build a per-user folder under UPLOAD_DIR
    user_dir = settings.UPLOAD_DIR / f"user_{user.id}"
    user_dir.mkdir(parents=True, exist_ok=True)

    stored_filename = _unique_stored_filename(safe_name)
    stored_path = user_dir / stored_filename
    stored_path.write_bytes(file_bytes)

    document = Document(
        user_id=user.id,
        filename=safe_name,
        stored_filename=stored_filename,
        file_type=ext.lstrip("."),
        file_size=len(file_bytes),
        status="processing",
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    try:
        raw = extract_text(safe_name, file_bytes)
        cleaned = clean_text(raw)
        chunks = chunk_text(cleaned)

        if not chunks:
            document.status = "empty"
            document.text_chars = 0
            document.chunk_count = 0
            document.error_message = "No text could be extracted from this file."
            db.commit()
            db.refresh(document)
            return document

        vectors = embed_texts(chunks)
        vector_store.add_document(user, document, chunks, vectors)

        document.text_chars = len(cleaned)
        document.chunk_count = len(chunks)
        document.status = "ready"
        document.error_message = None
        db.commit()
        db.refresh(document)
    except Exception as exc:  # noqa: BLE001
        document.status = "failed"
        document.error_message = f"{type(exc).__name__}: {exc}"
        db.commit()
        db.refresh(document)

    return document


def delete_document(db: Session, user: User, document_id: int) -> None:
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == user.id)
        .first()
    )
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )

    # Remove from vector index
    vector_store.clear_document(user.id, document_id)

    # Remove the file from disk (best effort)
    try:
        path = settings.UPLOAD_DIR / f"user_{user.id}" / document.stored_filename
        if path.exists():
            path.unlink()
    except OSError:
        pass

    db.delete(document)
    db.commit()


def get_document_for_user(
    db: Session, user: User, document_id: int
) -> Document:
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == user.id)
        .first()
    )
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )
    return document


def list_documents_for_user(db: Session, user: User) -> list[Document]:
    return (
        db.query(Document)
        .filter(Document.user_id == user.id)
        .order_by(Document.created_at.desc())
        .all()
    )