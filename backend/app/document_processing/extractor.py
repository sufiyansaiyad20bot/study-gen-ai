"""
Document text extraction + cleaning + chunking.
"""

from __future__ import annotations

import io
import re
from pathlib import Path

from docx import Document as DocxDocument
import fitz  # PyMuPDF


def extract_text(filename: str, data: bytes) -> str:
    """Extract text from a PDF/DOCX/TXT file. Returns cleaned text."""
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        return _extract_pdf(data)
    if ext == ".docx":
        return _extract_docx(data)
    if ext == ".txt":
        return _extract_txt(data)

    raise ValueError(f"Unsupported file type: {ext}")


def _extract_pdf(data: bytes) -> str:
    text_parts: list[str] = []
    with fitz.open(stream=data, filetype="pdf") as doc:
        for page in doc:
            text_parts.append(page.get_text("text"))
    return "\n".join(text_parts)


def _extract_docx(data: bytes) -> str:
    doc = DocxDocument(io.BytesIO(data))
    parts: list[str] = []
    for para in doc.paragraphs:
        if para.text:
            parts.append(para.text)
    # Also pull table cell text (simple support)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                if cell.text:
                    parts.append(cell.text)
    return "\n".join(parts)


def _extract_txt(data: bytes) -> str:
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="ignore")


def clean_text(text: str) -> str:
    """Normalize whitespace and strip control characters."""
    if not text:
        return ""
    # Remove nulls / control chars except newlines and tabs
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Collapse 3+ blank lines into 1
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Collapse multiple spaces/tabs on the same line
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def chunk_text(
    text: str,
    chunk_size: int = 700,
    overlap: int = 80,
) -> list[str]:
    """
    Split text into chunks of roughly `chunk_size` characters.

    The chunker:
      1. Splits on blank lines (paragraphs).
      2. Never mixes the *tail* of one paragraph into the *start* of the
         next chunk — that would bleed one section's end into the next
         section's beginning. Overlap is only used inside a single
         oversized paragraph that has to be split by sentence.
      3. Breaks long paragraphs on sentence boundaries, preserving
         `overlap` characters of sentence-level overlap for context.
    """
    text = clean_text(text)
    if not text:
        return []

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []

    def flush(buf: str) -> None:
        if buf.strip():
            chunks.append(buf.strip())

    current = ""
    for para in paragraphs:
        # Oversized paragraph: split by sentences with small overlap.
        if len(para) > chunk_size:
            flush(current)
            current = ""
            sentences = re.split(r"(?<=[.!?])\s+", para)
            for s in sentences:
                if len(current) + len(s) + 1 > chunk_size and current:
                    # emit and keep a small sentence overlap
                    tail = _tail(current, overlap)
                    chunks.append(current.strip())
                    current = (tail + " " + s).strip() if tail else s
                else:
                    current = (current + " " + s).strip()
            continue

        if len(current) + len(para) + 2 > chunk_size and current:
            chunks.append(current.strip())
            current = para
        else:
            current = (current + "\n\n" + para).strip()

    flush(current)
    return chunks


def _tail(text: str, n: int) -> str:
    if len(text) <= n:
        return text
    return text[-n:]