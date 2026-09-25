"""
====================================================
Study Gen AI â€” Configuration Settings
====================================================

This module loads environment variables from the .env
file and provides typed settings for the application.

Never hardcode secrets here - use environment variables.
====================================================
"""

import os
from pathlib import Path

# Load .env file if python-dotenv is installed
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Project root: backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Project root (one level above backend/): the repo root
PROJECT_ROOT = BASE_DIR.parent


class Settings:
    """Application settings loaded from environment variables."""

    # --- Application ---
    APP_NAME: str = os.getenv("APP_NAME", "Study Gen AI")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    APP_DEBUG: bool = os.getenv("APP_DEBUG", "true").lower() == "true"

    # --- Security ---
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY",
        "dev-secret-change-me-in-production",
    )
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")
    )

    # --- Database ---
    # Use an absolute path so the DB always lands in <repo>/database/
    DATABASE_DIR: Path = PROJECT_ROOT / "database"

    # Resolve a relative SQLite path to an absolute one
    _raw_db_url = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{PROJECT_ROOT / 'database' / 'Study Gen AI.db'}",
    )
    if _raw_db_url.startswith("sqlite:///./"):
        _rel = _raw_db_url.replace("sqlite:///./", "", 1)
        DATABASE_URL: str = f"sqlite:///{PROJECT_ROOT / _rel}"
        del _rel
    else:
        DATABASE_URL: str = _raw_db_url
    del _raw_db_url

    # --- Uploads ---
    UPLOAD_DIR: Path = PROJECT_ROOT / Path(os.getenv("UPLOAD_DIR", "backend/uploads"))
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "20"))
    MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

    # Allowed file types
    ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}

    # --- Vector Store ---
    VECTOR_DB_PATH: Path = PROJECT_ROOT / Path(os.getenv("VECTOR_DB_PATH", "vector_store"))

    # --- AI / LLM Provider ---
    # Select provider: "gemini" or "openrouter"
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "gemini")

    # --- Google Gemini ---
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    # --- OpenRouter ---
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3-ultra-550b-a55b:free")
    OPENROUTER_BASE_URL: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    # --- Embeddings ---
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")
    # "gemini" (default) or "deterministic" (offline, rate-limit-free)
    EMBEDDING_BACKEND: str = os.getenv("EMBEDDING_BACKEND", "deterministic")

    # --- RAG ---
    RAG_TOP_K: int = int(os.getenv("RAG_TOP_K", "5"))
    RAG_SIMILARITY_THRESHOLD: float = float(
        os.getenv("RAG_SIMILARITY_THRESHOLD", "0.1")
    )

    # --- CORS ---
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    def ensure_directories(self) -> None:
        """Create directories that need to exist at startup."""
        self.DATABASE_DIR.mkdir(parents=True, exist_ok=True)
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        self.VECTOR_DB_PATH.mkdir(parents=True, exist_ok=True)


# Single settings instance used across the app
settings = Settings()

# Ensure required directories exist as soon as the app is imported
settings.ensure_directories()