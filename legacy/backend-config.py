from fastapi import FastAPI


app = FastAPI(
    title="Study Gen AI",
    description="AI Based Student Learning Assistant",
    version="1.0.0"
)


@app.get("/")
def home():
    return {
        "project": "Study Gen AI",
        "status": "Backend Running Successfully",
        "version": "1.0.0"
    }


@app.get("/about")
def about():
    return {
        "project": "Study Gen AI",
        "description": "AI Based Student Learning Assistant",
        "technology": [
            "Python",
            "FastAPI",
            "SQLite",
            "FAISS",
            "Gemini AI"
        ]
    }


@app.get("/health")
def health():
    return {
        "server": "Online",
        "database": "Not Connected Yet",
        "ai_model": "Not Connected Yet"
    }