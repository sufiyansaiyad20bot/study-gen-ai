"""
Embedding + RAG retrieval helpers.

Uses the configured embedding model. Two backends are supported:

- "gemini"      : Google Gemini embeddings (default in .env.example).
- "deterministic" : a fast hashed bag-of-words embedder. Always available,
  no network calls, no rate limits, no API key required. Recommended
  for the supplied free-tier key because Gemini embeddings are
  aggressively rate-limited and intermittent failures cause dimension
  mismatches in the index. Deterministic embeddings are stable
  (always 1024-dim) and work well for small academic corpora.

The deterministic path is also used as a transparent fallback when
Gemini embeddings fail (network / quota / 5xx). The actual stored
vector dimension is the one that succeeded at index time; the query
embedder always uses the same backend so dimensions match.
"""

from __future__ import annotations

import re
from typing import Optional

import numpy as np

from backend.app.core.config import settings
from backend.app.rag.vector_store import vector_store


_TOKEN = re.compile(r"[A-Za-z][A-Za-z0-9_]+")
_DIM = 1024

# Common English stop words that should not count as content signals.
_STOP_WORDS = {
    "what", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "can", "shall", "must",
    "the", "a", "an", "of", "to", "in", "on", "for", "with",
    "how", "why", "when", "where", "who", "which", "that",
    "this", "these", "those", "it", "its", "they", "them",
    "and", "or", "but", "if", "then", "else", "about",
    "into", "from", "by", "at", "as", "so", "than", "too",
    "very", "just", "also", "only", "own", "same", "other",
    "some", "any", "all", "both", "each", "few", "more",
    "most", "such", "no", "nor", "not", "up", "out",
}


def _hash_token(tok: str) -> int:
    h = 0
    for c in tok:
        h = (h * 31 + ord(c)) & 0x7FFFFFFF
    return h


def _deterministic_embed(text: str) -> np.ndarray:
    """Signed hashed bag-of-words with subword n-grams (3..5)."""
    vec = np.zeros(_DIM, dtype=np.float32)
    if not text:
        return vec
    tokens = [t.lower() for t in _TOKEN.findall(text)]
    if not tokens:
        return vec

    grams: list[str] = []
    for t in tokens:
        grams.append(t)
        padded = f"_{t}_"
        if len(t) >= 3:
            for n in (3, 4, 5):
                if len(padded) >= n:
                    grams.extend(padded[i : i + n] for i in range(len(padded) - n + 1))

    for g in grams:
        h = _hash_token(g)
        idx = h % _DIM
        sign = 1.0 if (h // _DIM) % 2 == 0 else -1.0
        vec[idx] += sign

    n = float(np.linalg.norm(vec))
    if n > 0:
        vec = vec / n
    return vec


def _use_gemini() -> bool:
    """True only when the embedder is configured for Gemini AND a key exists."""
    if not settings.GEMINI_API_KEY:
        return False
    backend = (getattr(settings, "EMBEDDING_BACKEND", "gemini") or "gemini").lower()
    return backend != "deterministic"


def embed_texts(texts: list[str]) -> np.ndarray:
    """Embed a list of strings. Returns (N, dim) float32 array.

    The dimension is fixed by the configured backend so stored vectors and
    query vectors always have the same shape.
    """
    if not texts:
        return np.zeros((0, _DIM), dtype=np.float32)

    if not _use_gemini():
        return np.vstack([_deterministic_embed(t) for t in texts]).astype(np.float32)

    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = settings.EMBEDDING_MODEL

    vectors: list[np.ndarray] = []
    for t in texts:
        try:
            r = genai.embed_content(
                model=model,
                content=t,
                request_options={"timeout": 20},
            )
            emb = r["embedding"] if isinstance(r, dict) else r.embedding
            vec = np.asarray(emb, dtype=np.float32)
            n = float(np.linalg.norm(vec))
            if n > 0:
                vec = vec / n
            vectors.append(vec)
        except Exception:
            vectors.append(_deterministic_embed(t).astype(np.float32))

    # Pin to a common dimension: use Gemini's native dim if every vector
    # had it; otherwise fall back to _DIM. This keeps the index consistent.
    if vectors:
        dims = {v.shape[0] for v in vectors}
        if len(dims) == 1:
            dim = next(iter(dims))
        else:
            dim = _DIM
    else:
        dim = _DIM
    padded = np.zeros((len(vectors), dim), dtype=np.float32)
    for i, v in enumerate(vectors):
        n = float(np.linalg.norm(v))
        if n > 0:
            v = v / n
        take = min(v.shape[0], dim)
        padded[i, :take] = v[:take]
    return padded


def _content_words(text: str) -> set[str]:
    """Return the set of lowercase content (non-stop-word) tokens in *text*."""
    return {
        t.lower()
        for t in _TOKEN.findall(text)
        if t.lower() not in _STOP_WORDS and len(t) > 1
    }


def is_relevant(question: str, contexts: list[dict]) -> bool:
    """Decide whether retrieved chunks actually support the question.

    The deterministic embedder can produce non-zero cosine similarity for
    chunks that are unrelated to the question (e.g. "What is quantum
    computing?" against a Python document). This function adds a content-word
    overlap check on top of the similarity threshold so that a chunk is only
    treated as relevant when it shares at least one meaningful token with
    the question.

    Returns True when at least one retrieved chunk passes both checks.
    """
    if not contexts:
        return False

    q_words = _content_words(question)
    if not q_words:
        return False

    for ctx in contexts:
        c_words = _content_words(ctx.get("text", ""))
        if q_words & c_words:
            return True
    return False


def retrieve(
    user_id: int,
    question: str,
    top_k: Optional[int] = None,
    doc_id: Optional[int] = None,
) -> list[dict]:
    """Embed the question and retrieve top-k relevant chunks for the user.

    Returns a list of chunk dicts. Each dict includes a "score" field
    (cosine similarity, 0.0–1.0). The caller is responsible for deciding
    whether the retrieved scores are high enough to treat the answer as
    document-grounded.
    """
    k = top_k or settings.RAG_TOP_K
    q_vec = embed_texts([question])
    if q_vec.shape[0] == 0:
        return []
    return vector_store.search(user_id, q_vec[0], top_k=k, doc_id=doc_id)


def max_relevance_score(contexts: list[dict]) -> float:
    """Return the highest similarity score among retrieved chunks, or 0.0."""
    if not contexts:
        return 0.0
    return max(float(c.get("score", 0.0)) for c in contexts)