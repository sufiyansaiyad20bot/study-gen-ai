"""
====================================================
Study Gen AI â€” Database Setup
====================================================

SQLite is used for development.
The same ORM code works with PostgreSQL later â€”
just change the DATABASE_URL in your .env file.
====================================================
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from backend.app.core.config import settings


def _get_connect_args(database_url: str) -> dict:
    """
    SQLite needs special arguments for FastAPI's async/multithreaded use.
    PostgreSQL doesn't need them.
    """
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


# Create the engine
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=_get_connect_args(settings.DATABASE_URL),
    pool_pre_ping=True,
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Base class for all ORM models
Base = declarative_base()


def get_db():
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all database tables."""
    import backend.app.models  # noqa: F401 â€” ensures models are registered
    Base.metadata.create_all(bind=engine)