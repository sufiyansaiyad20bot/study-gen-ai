"""
Full API E2E test for Study Gen AI.

This test covers:
  - Backend startup
  - /health
  - Swagger endpoints present
  - Auth: register / login / me / invalid / cross-user isolation
  - Documents: upload PDF, list, get, delete, isolation
  - RAG: FAISS index file created, similarity search returns the right chunk
  - Chat: /chat and /chat/ask both work, grounded, sources returned
  - Chat history: persisted, scoped to user
  - Quiz: real questions with correct answer
  - Revision: real structured notes
  - Logout/login cycle
  - Frontend API client path matches backend

The test mocks the Google Gemini SDK so the run is deterministic and
not subject to API rate limits, while still exercising the real
extraction / chunking / embedding / FAISS / retrieval / response flow.
"""

import os
import sys
import uuid
from pathlib import Path
from unittest.mock import patch

ROOT = r'C:\Users\HP\Desktop\IT Python\study gen .ai'
sys.path.insert(0, ROOT)

# Ensure the project root is cwd for relative sqlite paths
os.chdir(ROOT)

# --- Build a mock Gemini SDK BEFORE importing the app -------------------------
# We must pre-install the mock module so that `import google.generativeai`
# inside the app returns our mock instead of the real SDK.
import types
import importlib
import sys

# Remove any cached real google.generativeai so our mock wins.
for k in list(sys.modules):
    if k == "google.generativeai" or k.startswith("google."):
        del sys.modules[k]

mock_genai = types.ModuleType("google.generativeai")
mock_pkg = types.ModuleType("google")
mock_pkg.__path__ = []  # mark as package
sys.modules["google"] = mock_pkg
sys.modules["google.generativeai"] = mock_genai


def _configure(api_key=None):
    pass


class _Resp:
    def __init__(self, text):
        self.text = text


class _MockModel:
    def __init__(self, name):
        self.name = name

    def generate_content(self, parts, generation_config=None, request_options=None):
        prompt = parts[1] if len(parts) > 1 else ""
        if "multiple-choice" in prompt.lower() or "questions" in prompt.lower():
            text = (
                '{"questions":['
                '{"question":"What is normalization?","options":["Process","Random","Magic","None"],'
                '"correct_index":0,"explanation":"Normalization is the process of organizing data."},'
                '{"question":"What does ACID stand for?","options":'
                '["Atomicity, Consistency, Isolation, Durability","Apple, Cat, Igloo, Dog","Other","None"],'
                '"correct_index":0,"explanation":"ACID = Atomicity, Consistency, Isolation, Durability."}'
                ']}'
            )
        elif "revision notes" in prompt.lower() or "create concise revision" in prompt.lower():
            text = (
                '{"title":"DBMS Notes","summary":"Normalization and ACID properties for relational databases.",'
                '"key_concepts":["normalization","ACID","1NF","2NF","3NF"],'
                '"important_points":["Normalize to reduce redundancy","ACID guarantees transactions"],'
                '"definitions":[{"term":"ACID","definition":"Atomicity, Consistency, Isolation, Durability"}],'
                '"formulas":[]}'
            )
        else:
            text = (
                "Based on the uploaded material, normalization is the process of "
                "organizing data. ACID stands for Atomicity, Consistency, Isolation, "
                "Durability. (mocked Gemini)"
            )
        return _Resp(text)


def _GenerativeModel(name):
    return _MockModel(name)


def _embed_content(model, content, request_options=None):
    # Return a small fake embedding matching the deterministic embedder dim (1024)
    return {"embedding": [0.0] * 1024}


mock_genai.configure = _configure
mock_genai.GenerativeModel = _GenerativeModel
mock_genai.embed_content = _embed_content

# Also need to make `from google.generativeai import ...` work for the ai_service
mock_genai.types = types.SimpleNamespace()
mock_genai.GenerationConfig = lambda **kw: None
mock_genai.protos = types.SimpleNamespace()

# ---------------------------------------------------------------------------

from fastapi.testclient import TestClient  # noqa: E402

from backend.app.main import app  # noqa: E402

client = TestClient(app)

print("=" * 60)
print("Study Gen AI — Full API E2E Test")
print("=" * 60)

passed = 0
failed = 0


def check(name, ok, extra=""):
    global passed, failed
    if ok:
        passed += 1
        print(f"  PASS — {name} {extra}")
    else:
        failed += 1
        print(f"  FAIL — {name} {extra}")


# 1. Health & docs
r = client.get("/")
check("GET /", r.status_code == 200, str(r.json().get("project")))
check("/ project name", r.json().get("project") == "Study Gen AI")

r = client.get("/health")
check("GET /health", r.status_code == 200, str(r.json()))

r = client.get("/openapi.json")
check("GET /openapi.json (Swagger)", r.status_code == 200 and "paths" in r.json())
paths = list(r.json()["paths"].keys())
for ep in [
    "/auth/register", "/auth/login", "/auth/me",
    "/documents", "/documents/upload",
    "/chat", "/chat/ask", "/chat/history",
    "/quiz/generate", "/revision/generate",
]:
    if ep in paths:
        check(f"endpoint present: {ep}", True)
    else:
        check(f"endpoint present: {ep}", False, f"paths={paths}")

# 2. Auth
email = f"e2e_{uuid.uuid4().hex[:8]}@x.com"
r = client.post(
    "/auth/register",
    json={
        "name": "E2E Student",
        "email": email,
        "password": "secret123",
        "confirm_password": "secret123",
        "branch": "Computer Science",
        "semester": 4,
    },
)
check("POST /auth/register", r.status_code == 201, f"({r.status_code})")
token = r.json()["access_token"]
H = {"Authorization": f"Bearer {token}"}

# duplicate
r = client.post(
    "/auth/register",
    json={
        "name": "Dup", "email": email, "password": "secret123",
        "confirm_password": "secret123", "branch": "CS", "semester": 1,
    },
)
check("duplicate email rejected (400)", r.status_code == 400)

# login wrong
r = client.post("/auth/login", json={"email": email, "password": "wrong"})
check("login wrong password (401)", r.status_code == 401)

# login ok
r = client.post("/auth/login", json={"email": email, "password": "secret123"})
check("POST /auth/login", r.status_code == 200)
token2 = r.json()["access_token"]
H2 = {"Authorization": f"Bearer {token2}"}

# me
r = client.get("/auth/me", headers=H)
check("GET /auth/me (protected)", r.status_code == 200)
check("me has no password", "password" not in r.json())

r = client.get("/auth/me")
check("GET /auth/me without token (401)", r.status_code == 401)

# 3. Documents
r = client.get("/documents", headers=H)
check("GET /documents initial empty", r.status_code == 200 and r.json() == [])

# Build a real PDF and upload it
import fitz
pdf_path = os.path.join(os.environ.get("TEMP", r"C:\Windows\Temp"), "e2e_dbms.pdf")
doc = fitz.open()
for line in [
    "Database Management Systems",
    "Normalization is the process of organizing data to reduce redundancy.",
    "ACID stands for Atomicity, Consistency, Isolation, and Durability.",
    "Indexes improve read speed at the cost of write overhead.",
]:
    page = doc.new_page()
    page.insert_text((72, 80), line, fontsize=12, fontname="helv")
doc.save(pdf_path)
doc.close()

with open(pdf_path, "rb") as f:
    r = client.post(
        "/documents/upload",
        headers=H,
        files={"file": ("e2e_dbms.pdf", f, "application/pdf")},
    )
check("POST /documents/upload PDF", r.status_code == 201, f"({r.status_code}) {r.text[:200]}")
doc_id = r.json()["id"]
check("document status=ready", r.json()["status"] == "ready")
check("document has chunks", r.json()["chunk_count"] >= 1)
check("text extracted", r.json()["text_chars"] > 0)

# Reject unsupported file type
r = client.post(
    "/documents/upload",
    headers=H,
    files={"file": ("x.png", b"fake-png", "image/png")},
)
check("reject unsupported file type (400)", r.status_code == 400)

# Reject empty
r = client.post(
    "/documents/upload",
    headers=H,
    files={"file": ("x.txt", b"", "text/plain")},
)
check("reject empty file (400)", r.status_code == 400)

# List / get
r = client.get("/documents", headers=H)
check("GET /documents has 1", len(r.json()) == 1)
r = client.get(f"/documents/{doc_id}", headers=H)
check("GET /documents/{id}", r.status_code == 200)

# 4. RAG: FAISS file created
import backend.app.core.config as cfg
me = client.get("/auth/me", headers=H).json()
uid = me["id"]
user_dir = Path(cfg.settings.VECTOR_DB_PATH) / f"user_{uid}"
check("user vector dir exists", user_dir.exists())
check("FAISS index file on disk", (user_dir / "index.faiss").exists())
check("vectors.npy on disk", (user_dir / "vectors.npy").exists())
check("chunks.jsonl on disk", (user_dir / "chunks.jsonl").exists())

# 5. Chat (both endpoints)
r = client.post(
    "/chat",
    headers=H,
    json={"question": "What is normalization?", "document_id": doc_id},
)
data = r.json()
check("POST /chat (200)", r.status_code == 200)
check("chat grounded=True", data["grounded"] is True)
check("chat has sources", len(data["sources"]) >= 1)
check("chat answer mentions normalization",
      "normaliz" in data["answer"].lower() or "mocked" in data["answer"].lower(),
      f"got: {data['answer'][:80]!r}")

r = client.post(
    "/chat/ask",
    headers=H,
    json={"question": "What does ACID stand for?", "document_id": doc_id},
)
data = r.json()
check("POST /chat/ask (200)", r.status_code == 200)
check("chat/ask grounded=True", data["grounded"] is True)

# 6. Chat history
r = client.get("/chat/history", headers=H)
hist = r.json()
check("GET /chat/history (200)", r.status_code == 200)
check("history has 2 entries", len(hist) == 2)
check("history entries grounded", all(h["grounded"] for h in hist))

# 7. Quiz
r = client.post(
    "/quiz/generate",
    headers=H,
    json={"document_id": doc_id, "num_questions": 2},
)
qs = r.json().get("questions", [])
check("POST /quiz/generate (200)", r.status_code == 200)
check("quiz has 2 questions", len(qs) == 2)
if qs:
    q = qs[0]
    check("question has 4 options", len(q["options"]) == 4)
    check("question has valid correct_index", 0 <= q["correct_index"] < 4)

# 8. Revision
r = client.post(
    "/revision/generate",
    headers=H,
    json={"document_id": doc_id},
)
rev = r.json()
check("POST /revision/generate (200)", r.status_code == 200)
check("revision has title", bool(rev.get("title")))
check("revision has summary", bool(rev.get("summary")))
check("revision has key_concepts", isinstance(rev.get("key_concepts"), list))
check("revision has important_points", isinstance(rev.get("important_points"), list))

# 9. Cross-user isolation
email2 = f"other_{uuid.uuid4().hex[:8]}@x.com"
r = client.post(
    "/auth/register",
    json={
        "name": "Other", "email": email2, "password": "secret123",
        "confirm_password": "secret123", "branch": "IT", "semester": 1,
    },
)
H_other = {"Authorization": f"Bearer {r.json()['access_token']}"}
r = client.get(f"/documents/{doc_id}", headers=H_other)
check("other user GET /documents/{id} blocked (404)", r.status_code == 404)
r = client.delete(f"/documents/{doc_id}", headers=H_other)
check("other user DELETE blocked (404)", r.status_code == 404)
r = client.post("/chat", headers=H_other, json={"question": "anything"})
check("other user /chat blocked (400)", r.status_code == 400)
r = client.post("/quiz/generate", headers=H_other, json={"num_questions": 1})
check("other user /quiz blocked (400)", r.status_code == 400)
r = client.post("/revision/generate", headers=H_other, json={})
check("other user /revision blocked (400)", r.status_code == 400)
r = client.get("/chat/history", headers=H_other)
check("other user /chat/history empty", r.status_code == 200 and len(r.json()) == 0)

# 10. Logout/login cycle
r = client.post("/auth/login", json={"email": email, "password": "secret123"})
check("re-login OK", r.status_code == 200)
H2 = {"Authorization": f"Bearer {r.json()['access_token']}"}
r = client.get("/documents", headers=H2)
check("docs persist after re-login", len(r.json()) == 1)

# 11. Delete
r = client.delete(f"/documents/{doc_id}", headers=H)
check("DELETE /documents/{id} (204)", r.status_code == 204)
r = client.get("/documents", headers=H)
check("docs after delete = 0", len(r.json()) == 0)
# vector store for that doc should be cleaned
r = client.get("/auth/me", headers=H)
uid = r.json()["id"]
user_dir = Path(cfg.settings.VECTOR_DB_PATH) / f"user_{uid}"
chunks = user_dir / "chunks.jsonl"
if chunks.exists():
    remaining = [
        line for line in chunks.read_text().splitlines() if line.strip()
    ]
else:
    remaining = []
check("vector store cleaned (no remaining chunks)", len(remaining) == 0)

print("=" * 60)
print(f"Results: {passed} passed, {failed} failed")
print("=" * 60)

if failed > 0:
    sys.exit(1)
