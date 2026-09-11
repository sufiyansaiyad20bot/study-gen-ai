# Study Gen AI

Your personal AI study companion. Upload study material, ask questions, generate quizzes, and create revision notes — all grounded in your own documents.

## Features

- **Auth** — Register, login with JWT, bcrypt password hashing, protected routes
- **Documents** — Upload PDF, DOCX, and TXT files (up to 20 MB)
- **RAG** — Text extraction → chunking → embeddings → FAISS index → retrieval with source citations
- **Chat** — Ask questions about your notes; answers are grounded in your uploaded material
- **Document-Grounded Answers** — When relevant material is found, answers cite the source document and show a "From your study material" indicator
- **General-Knowledge Answers** — When a question is outside uploaded material, the system clearly labels it "Outside your uploaded study material" and provides a general explanation without fake citations
- **Quiz** — Generate multiple-choice quizzes from your documents
- **Revision Notes** — Generate structured revision notes (title, summary, key concepts, important points, definitions, formulas)
- **Chat History** — Persistent per-user conversation history that survives navigation and refresh
- **Quick Prompts** — Suggested study questions that use the existing Chat/RAG flow
- **Per-user isolation** — Each user's documents, vector store, and chat history are private

## Document vs General Knowledge

Study Gen AI distinguishes between two answer sources:

### Document-Grounded Answers

When the retrieved uploaded study material contains enough relevant information:

- The answer is based on the retrieved document context
- A **"From your study material"** indicator is shown
- Document sources/citations are displayed with chunk index and relevance score

### General-Knowledge Answers

When the uploaded study material does NOT contain enough relevant information:

- A **"Outside your uploaded study material"** indicator is shown
- The message states: "This information was not found in your uploaded study material."
- A general explanation is provided
- **No document citations are shown** — the system never falsely attributes general knowledge to an uploaded document

Relevance is determined by a content-word overlap check on top of the similarity threshold, ensuring that a non-empty FAISS result does not automatically count as relevant.

## RAG Workflow

```
User Question
    → Embed question (deterministic 1024-dim)
    → FAISS cosine similarity search
    → Retrieve top-K chunks
    → Content-word relevance check
    → If relevant: pass chunks to Gemini with context
    → If not relevant: pass question to Gemini without document context
    → Gemini generates answer
    → Return answer + sources + answer_source metadata
```

The RAG pipeline is preserved for Quiz and Revision — they remain strictly document-grounded.

## Tech Stack

- **Backend** — FastAPI, SQLAlchemy (SQLite), Pydantic, JWT, bcrypt
- **AI** — Google Gemini (`google-generativeai`)
- **RAG** — FAISS, numpy, deterministic embeddings (offline, rate-limit-free)
- **Document processing** — PyMuPDF (PDF), python-docx (DOCX)
- **Frontend** — React 18, Vite, Tailwind CSS, Lucide React

## Getting Started

### Backend

```bash
pip install -r backend/requirements.txt
cp .env.example .env   # then edit .env and add your GEMINI_API_KEY
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Open http://127.0.0.1:8000/docs for the interactive API documentation.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Environment Variables

See `.env.example` for the full list. The critical ones:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Your Google Gemini API key (get one at https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | Gemini model to use (default: `gemini-3.6-flash`) |
| `EMBEDDING_BACKEND` | `deterministic` (recommended for free-tier keys) or `gemini` |
| `RAG_TOP_K` | Number of chunks to retrieve per query |
| `RAG_SIMILARITY_THRESHOLD` | Minimum cosine similarity for a chunk to be included |

## Project Structure

```
Study Gen AI/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI route handlers
│   │   ├── core/         # Config, security, database
│   │   ├── models/       # SQLAlchemy models
│   │   ├── rag/          # Vector store + retrieval
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # Business logic (AI, documents)
│   │   ├── document_processing/  # PDF/DOCX/TXT extraction
│   │   └── main.py       # App entry point
│   ├── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/        # Dashboard, Chat, Documents, Quiz, Revision, Login, Register
│   │   ├── components/   # AppShell, ProtectedRoute, AuthContext
│   │   └── services/     # API client
│   ├── package.json
│   └── vite.config.js
├── tests/               # Auth, features, and full E2E tests
├── docs/
├── .env.example         # Safe template — copy to .env and fill in
├── .gitignore           # Ignores .env, databases, uploads, node_modules, etc.
└── README.md
```

## Testing

```bash
python tests/test_auth.py
python tests/test_features.py
python tests/test_api_e2e.py
cd frontend && npm run build
```

## QA Status

**Backend tests: 101/101 passed** in the latest QA run:
- `test_auth.py`: 14/14
- `test_features.py`: 24/24
- `test_api_e2e.py`: 63/63

**Frontend build: PASS** — 0 errors, 1835 modules transformed.

**Manual QA: 27/27 checks passed** covering authentication, document upload, document listing, cross-user isolation, chat history, quiz/revision document-grounded behavior, and all 8 frontend routes.

**Relevance classification tested independently and passed.** The content-word overlap check correctly distinguishes document-grounded questions from unrelated questions using real uploaded study material.

## Known Limitation

**Gemini free-tier quota:** The Google Gemini free tier may temporarily return HTTP 429 (quota exceeded) errors. When this happens, the application correctly returns a structured `AI_QUOTA_EXCEEDED` error with a friendly message. Document upload, RAG retrieval, document management, and all non-AI functionality continue to work normally. To restore full AI functionality, obtain a fresh Gemini API key at [Google AI Studio](https://aistudio.google.com/apikey) and update `GEMINI_API_KEY` in `.env`.

## Future Scope

- Answer Mode selector ("My Documents" vs "Documents + General Knowledge")
- Multi-document chat scope
- Chat export / sharing
- Enhanced document analytics
- Voice input for chat questions
- Mobile application wrapper

## Academic Disclaimer

This project was developed as an academic study project. It is provided as-is for educational purposes. The RAG pipeline, document processing, and application logic are functional and tested. AI generation depends on the Google Gemini API, which requires a valid API key and is subject to quota limits.

## License

MIT