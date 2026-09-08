"""
====================================================
Study Gen AI â€” FastAPI Application Entry Point
====================================================

Run with:
    python -m uvicorn backend.app.main:app --reload
====================================================
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.routes import auth, chat, documents, quiz, revision
from backend.app.core.config import settings
from backend.app.database import create_tables

# Ensure directories and tables exist as soon as the app is imported.
# This is more reliable than the startup event (which doesn't always
# fire when using a TestClient).
settings.ensure_directories()
create_tables()

# Create the FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="Your personal AI study companion. "
    "Upload study material, ask questions, generate quizzes and revision notes.",
    version="1.0.0",
)

# CORS - allow the frontend to call the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """Create database tables when the app starts."""
    settings.ensure_directories()
    create_tables()


# ====================================================
# Routes
# ====================================================

# Health check
@app.get("/", tags=["System"])
def root():
    return {
        "project": "Study Gen AI",
        "tagline": "Your personal AI study companion.",
        "status": "Backend running",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["System"])
def health():
    gemini_status = "Connected" if settings.GEMINI_API_KEY else "Not Configured"
    return {
        "server": "Online",
        "database": "Connected",
        "ai_model": gemini_status,
    }


# Include API routers
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(quiz.router)
app.include_router(revision.router)