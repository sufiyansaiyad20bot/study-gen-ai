"""
Study Gen AI â€” Document processing package
"""

from backend.app.document_processing.extractor import chunk_text, clean_text, extract_text

__all__ = ["extract_text", "clean_text", "chunk_text"]