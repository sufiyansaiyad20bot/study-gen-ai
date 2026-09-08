"""
Per-user, persistent vector store for RAG.

Primary path: FAISS IndexFlatIP (cosine similarity on L2-normalised vectors).
On-disk artifacts per user (in `<VECTOR_DB_PATH>/user_<id>/`):

- chunks.jsonl : [{doc_id, doc_filename, chunk_index, text}, ...]
- vectors.npy  : float32 matrix of embeddings (kept for portability)
- index.faiss  : faiss index file rebuilt from vectors.npy on first load

If FAISS is unavailable for any reason, the store transparently falls
back to a numpy cosine search — same per-user isolation, same persistence.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Optional

import numpy as np

from backend.app.core.config import settings
from backend.app.models.document import Document
from backend.app.models.user import User

try:
    import faiss  # type: ignore

    _HAS_FAISS = True
except Exception:  # pragma: no cover
    _HAS_FAISS = False


class _UserIndex:
    """Per-user index of chunks + their embedding vectors."""

    def __init__(self, user_id: int, user_dir: Path):
        self.user_id = user_id
        self.user_dir = user_dir
        self.user_dir.mkdir(parents=True, exist_ok=True)
        self.chunks_path = user_dir / "chunks.jsonl"
        self.vectors_path = user_dir / "vectors.npy"
        self.index_path = user_dir / "index.faiss"
        self.meta_path = user_dir / "meta.json"

        self.lock = threading.RLock()
        self.chunks: list[dict] = []   # [{doc_id, doc_filename, chunk_index, text}]
        self.vectors: Optional[np.ndarray] = None
        self.index = None              # faiss.IndexFlatIP
        self._loaded = False

    def _load(self) -> None:
        if self._loaded:
            return
        if self.chunks_path.exists():
            with self.chunks_path.open("r", encoding="utf-8") as f:
                self.chunks = [json.loads(line) for line in f if line.strip()]
        if self.vectors_path.exists() and self.chunks:
            try:
                arr = np.load(self.vectors_path)
                if arr.shape[0] == len(self.chunks):
                    self.vectors = arr.astype(np.float32, copy=False)
                else:
                    self.vectors = None
            except Exception:
                self.vectors = None
        if (
            _HAS_FAISS
            and self.vectors is not None
            and self.vectors.shape[0] == len(self.chunks)
            and self.index_path.exists()
        ):
            try:
                idx = faiss.read_index(str(self.index_path))
                if idx.ntotal == self.vectors.shape[0]:
                    self.index = idx
            except Exception:
                self.index = None
        self._loaded = True

    def _persist(self) -> None:
        with self.chunks_path.open("w", encoding="utf-8") as f:
            for c in self.chunks:
                f.write(json.dumps(c, ensure_ascii=False) + "\n")
        if self.vectors is not None and len(self.chunks):
            np.save(self.vectors_path, self.vectors.astype(np.float32, copy=False))
            if _HAS_FAISS and self.index is not None:
                try:
                    faiss.write_index(self.index, str(self.index_path))
                except Exception:
                    pass
        self.meta_path.write_text(json.dumps({"count": len(self.chunks)}, indent=2))

    def _rebuild_faiss(self) -> None:
        if not _HAS_FAISS or self.vectors is None or len(self.chunks) == 0:
            self.index = None
            return
        dim = int(self.vectors.shape[1])
        index = faiss.IndexFlatIP(dim)
        # vectors are already L2-normalised; IP == cosine similarity
        index.add(np.ascontiguousarray(self.vectors, dtype=np.float32))
        self.index = index

    def clear_document(self, doc_id: int) -> None:
        with self.lock:
            self._load()
            keep_idx = [i for i, c in enumerate(self.chunks) if c["doc_id"] != doc_id]
            if len(keep_idx) == len(self.chunks):
                return
            self.chunks = [self.chunks[i] for i in keep_idx]
            if self.vectors is not None and len(self.chunks):
                self.vectors = self.vectors[keep_idx]
            elif len(self.chunks) == 0:
                self.vectors = None
            if self.vectors is None or len(self.chunks) == 0:
                self.index = None
            else:
                self._rebuild_faiss()
            self._persist()

    def clear_all(self) -> None:
        with self.lock:
            self.chunks = []
            self.vectors = None
            self.index = None
            self._loaded = True
            self._persist()

    def add_document(
        self,
        doc_id: int,
        doc_filename: str,
        chunks: list[str],
        vectors: np.ndarray,
    ) -> None:
        if not chunks:
            return
        if vectors.shape[0] != len(chunks):
            raise ValueError("chunks and vectors length mismatch")
        with self.lock:
            self._load()
            base_index = len(self.chunks)
            for i, text in enumerate(chunks):
                self.chunks.append(
                    {
                        "doc_id": doc_id,
                        "doc_filename": doc_filename,
                        "chunk_index": base_index + i,
                        "text": text,
                    }
                )
            new_vecs = vectors.astype(np.float32, copy=False)
            if self.vectors is None:
                self.vectors = new_vecs
            else:
                self.vectors = np.vstack([self.vectors, new_vecs])
            if _HAS_FAISS:
                self._rebuild_faiss()
            self._persist()

    def search(
        self,
        query_vec: np.ndarray,
        top_k: int = 5,
        threshold: float = 0.1,
        doc_id: Optional[int] = None,
    ) -> list[dict]:
        with self.lock:
            self._load()
            if self.vectors is None or len(self.chunks) == 0:
                return []

            q = query_vec.astype(np.float32)
            qn = float(np.linalg.norm(q))
            if qn > 0:
                q = q / qn

            use_faiss = self.index is not None and _HAS_FAISS
            if use_faiss:
                scores, indices = self.index.search(
                    np.ascontiguousarray(q.reshape(1, -1), dtype=np.float32),
                    min(top_k * 3, len(self.chunks)),
                )
                pairs = [(int(i), float(s)) for i, s in zip(indices[0], scores[0]) if i != -1]
            else:
                norms = np.linalg.norm(self.vectors, axis=1, keepdims=True)
                norms[norms == 0] = 1.0
                mat = self.vectors / norms
                sims = (mat @ q).astype(float)
                order = np.argsort(-sims)[: max(top_k * 3, top_k)]
                pairs = [(int(i), float(sims[i])) for i in order]

            results: list[dict] = []
            for idx, sim in pairs:
                if sim < threshold:
                    continue
                chunk = self.chunks[idx]
                if doc_id is not None and chunk["doc_id"] != doc_id:
                    continue
                results.append(
                    {
                        "doc_id": chunk["doc_id"],
                        "doc_filename": chunk["doc_filename"],
                        "chunk_index": chunk["chunk_index"],
                        "text": chunk["text"],
                        "score": round(sim, 4),
                    }
                )
                if len(results) >= top_k:
                    break
            return results


class VectorStore:
    """Manages per-user _UserIndex instances."""

    def __init__(self) -> None:
        self.base_dir = settings.VECTOR_DB_PATH
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self._indexes: dict[int, _UserIndex] = {}
        self._lock = threading.Lock()

    @property
    def backend(self) -> str:
        return "faiss" if _HAS_FAISS else "numpy"

    def _index_for(self, user_id: int) -> _UserIndex:
        with self._lock:
            idx = self._indexes.get(user_id)
            if idx is None:
                user_dir = self.base_dir / f"user_{user_id}"
                idx = _UserIndex(user_id, user_dir)
                self._indexes[user_id] = idx
            return idx

    def add_document(
        self,
        user: User,
        document: Document,
        chunks: list[str],
        vectors: np.ndarray,
    ) -> None:
        idx = self._index_for(user.id)
        idx.add_document(document.id, document.filename, chunks, vectors)

    def clear_document(self, user_id: int, doc_id: int) -> None:
        idx = self._index_for(user_id)
        idx.clear_document(doc_id)

    def search(
        self,
        user_id: int,
        query_vec: np.ndarray,
        top_k: int = 5,
        doc_id: Optional[int] = None,
    ) -> list[dict]:
        idx = self._index_for(user_id)
        return idx.search(
            query_vec,
            top_k=top_k,
            threshold=settings.RAG_SIMILARITY_THRESHOLD,
            doc_id=doc_id,
        )

    def count_chunks(self, user_id: int) -> int:
        idx = self._index_for(user_id)
        idx._load()
        return len(idx.chunks)

    def list_chunks(
        self,
        user_id: int,
        doc_id: Optional[int] = None,
        limit: int = 50,
    ) -> list[dict]:
        """Return raw chunks (no vector search) for a user, optionally filtered by doc."""
        idx = self._index_for(user_id)
        idx._load()
        out: list[dict] = []
        for c in idx.chunks:
            if doc_id is not None and c["doc_id"] != doc_id:
                continue
            out.append(
                {
                    "doc_id": c["doc_id"],
                    "doc_filename": c["doc_filename"],
                    "chunk_index": c["chunk_index"],
                    "text": c["text"],
                    "score": 1.0,
                }
            )
            if len(out) >= limit:
                break
        return out


vector_store = VectorStore()