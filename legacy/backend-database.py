"""
====================================================
Database Connection
====================================================

This file connects Study Gen AI
with the SQLite database.

====================================================
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base


# -------------------------------------------------
# Database URL
# -------------------------------------------------

DATABASE_URL = "sqlite:///database/study_gen_ai.db"


# -------------------------------------------------
# Create Database Engine
# -------------------------------------------------

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)


# -------------------------------------------------
# Create Database Session
# -------------------------------------------------

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


# -------------------------------------------------
# Base Class
# -------------------------------------------------

Base = declarative_base()


# -------------------------------------------------
# Database Dependency
# -------------------------------------------------

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()