# Study Gen AI

Your personal AI study companion. Upload study material, ask questions, generate quizzes, and create revision notes — all grounded in your own documents.

## Features

- **Auth** — Register, login with JWT, bcrypt password hashing, protected routes
- **Documents** — Upload PDF, DOCX, and TXT files (up to 20 MB)
- **RAG** — Text extraction → chunking → embeddings → FAISS index → retrieval with source citations
- **Chat** — Ask questions about your notes; answers are grounded in your uploaded material
- **Quiz** — Generate multiple-choice quizzes from your documents
- **Revision Notes** — Generate structured revision notes (title, summary, key concepts, important points, definitions, formulas)
- **Per-user isolation** — Each user's documents, vector store, and chat history are private

## Tech Stack

- **Backend** — FastAPI, SQLAlchemy (SQLite), Pydantic, JWT, bcrypt
- **AI** — Google Gemini (`google-generativeai`)
- **RAG** — FAISS, numpy, deterministic embeddings (offline, rate-limit-free)
- **Document processing** — PyMuPDF (PDF), python-docx (DOCX)
- **Frontend** — React 18, Vite, Tailwind CSS, Lucide React

## Getting Started

### Backend

```bash
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env   # then edit .env and add your GEMINI_API_KEY
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
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

## License

MIT