"""
End-to-end test for documents, chat, quiz, revision.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)

print("=" * 50)
print("Study Gen AI â€” Feature Tests")
print("=" * 50)

passed = 0
failed = 0


def check(name, ok, extra=""):
    global passed, failed
    status = "âœ… PASS" if ok else "âŒ FAIL"
    if ok:
        passed += 1
    else:
        failed += 1
    print(f"  {status} â€” {name} {extra}")


# Register a fresh user
email = f"feat_{int(time.time())}@test.com"
r = client.post(
    "/auth/register",
    json={
        "name": "Feat Student",
        "email": email,
        "password": "secret123",
        "confirm_password": "secret123",
        "branch": "Computer Science",
        "semester": 3,
    },
)
check("Register user", r.status_code == 201, f"({r.status_code})")
token = r.json()["access_token"]
H = {"Authorization": f"Bearer {token}"}

# 1. List documents (should be empty)
r = client.get("/documents", headers=H)
check("List documents initially empty", r.status_code == 200 and r.json() == [])

# 2. Upload TXT
txt = (
    b"The mitochondria is the powerhouse of the cell. It produces ATP energy through "
    b"cellular respiration. Cells also have a nucleus which contains DNA. The cell "
    b"membrane controls what enters and leaves the cell. Photosynthesis happens in "
    b"chloroplasts in plant cells. Mitochondria have their own DNA. Ribosomes "
    b"synthesize proteins in the cell. The endoplasmic reticulum transports materials."
)
r = client.post(
    "/documents/upload",
    headers=H,
    files={"file": ("biology.txt", txt, "text/plain")},
)
check("Upload TXT", r.status_code == 201, f"({r.status_code}) {r.text[:200]}")
doc_id = r.json()["id"]
check("Document is ready", r.json()["status"] == "ready")
check("Document has chunks", r.json()["chunk_count"] > 0)

# 3. Upload PDF (use a real minimal PDF)
pdf_bytes = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj\n"
    b"4 0 obj<</Length 200>>stream\n"
    b"BT /F1 14 Tf 20 150 Td (Newton's First Law of Motion: an object at rest stays at rest) Tj ET\n"
    b"BT /F1 12 Tf 20 120 Td (and an object in motion stays in motion unless acted upon) Tj ET\n"
    b"endstream endobj\n"
    b"trailer<</Root 1 0 R>>\n%%EOF"
)
r = client.post(
    "/documents/upload",
    headers=H,
    files={"file": ("physics.pdf", pdf_bytes, "application/pdf")},
)
check("Upload PDF accepted", r.status_code == 201, f"({r.status_code}) {r.text[:200]}")
if r.status_code == 201:
    check("PDF status ready or empty", r.json()["status"] in ("ready", "empty"))

# 4. Reject unsupported file type
r = client.post(
    "/documents/upload",
    headers=H,
    files={"file": ("image.png", b"\x89PNG fake", "image/png")},
)
check("Reject unsupported file type", r.status_code == 400, f"({r.status_code})")

# 5. List now has docs
r = client.get("/documents", headers=H)
docs = r.json()
check("List documents has 2+", len(docs) >= 2, f"len={len(docs)}")

# 6. Get single document
r = client.get(f"/documents/{doc_id}", headers=H)
check("Get single document", r.status_code == 200)
check("Document belongs to user", r.json()["id"] == doc_id)

def _ok_or_ai_error(name, resp):
    """Accept either 200 (AI succeeded) or 503 with a structured AI error code."""
    if resp.status_code == 200:
        check(name, True)
        return resp
    if resp.status_code == 503:
        try:
            body = resp.json()
        except Exception:
            check(name, False, "503 with no JSON body")
            return resp
        detail = body.get("detail") or {}
        if isinstance(detail, dict) and detail.get("code"):
            check(f"{name} -> AI error code {detail['code']}", True)
            return resp
    check(name, False, f"({resp.status_code})")
    return resp


# 7. Chat grounded
r = client.post(
    "/chat",
    headers=H,
    json={"question": "What is the powerhouse of the cell?", "document_id": doc_id},
)
r = _ok_or_ai_error("Chat returns 200 or 503", r)
if r.status_code == 200:
    check("Chat grounded=True", r.json().get("grounded") is True)
    check("Chat has sources", len(r.json().get("sources") or []) > 0)
    check("Chat has answer", bool(r.json().get("answer")))

# 8. Quiz generate
r = client.post(
    "/quiz/generate",
    headers=H,
    json={"document_id": doc_id, "num_questions": 3},
)
r = _ok_or_ai_error("Quiz returns 200 or 503", r)
if r.status_code == 200:
    qs = r.json().get("questions") or []
    check("Quiz has questions", len(qs) > 0)
    if qs:
        q = qs[0]
        check("Each question has 4 options", len(q.get("options") or []) == 4)
        check("Each question has correct_index", isinstance(q.get("correct_index"), int))
        check("Each question has question text", bool(q.get("question")))

# 9. Revision
r = client.post(
    "/revision/generate",
    headers=H,
    json={"document_id": doc_id},
)
r = _ok_or_ai_error("Revision returns 200 or 503", r)
if r.status_code == 200:
    rev = r.json()
    check("Revision has title", bool(rev.get("title")))
    check("Revision has summary", bool(rev.get("summary")))
    check("Revision has key_concepts list", isinstance(rev.get("key_concepts"), list))

# 10. Cross-user isolation
email2 = f"other_{int(time.time())}@test.com"
r = client.post(
    "/auth/register",
    json={
        "name": "Other",
        "email": email2,
        "password": "secret123",
        "confirm_password": "secret123",
        "branch": "IT",
        "semester": 2,
    },
)
H2 = {"Authorization": f"Bearer {r.json()['access_token']}"}
r = client.get(f"/documents/{doc_id}", headers=H2)
check("Other user cannot GET document", r.status_code == 404)
r = client.delete(f"/documents/{doc_id}", headers=H2)
check("Other user cannot DELETE document", r.status_code == 404)
r = client.post("/chat", headers=H2, json={"question": "anything"})
check("Other user chat blocked (no docs)", r.status_code == 400)
r = client.post("/quiz/generate", headers=H2, json={"num_questions": 3})
check("Other user quiz blocked", r.status_code == 400)

# 11. Delete
r = client.delete(f"/documents/{doc_id}", headers=H)
check("Delete own document", r.status_code == 204)
r = client.get("/documents", headers=H)
remaining = [d for d in r.json() if d["id"] == doc_id]
check("Document removed from list", len(remaining) == 0)

# 12. Protected route without token
r = client.get("/documents")
check("GET /documents without token = 401", r.status_code == 401)
r = client.post("/chat", json={"question": "x"})
check("POST /chat without token = 401", r.status_code == 401)
r = client.post("/quiz/generate", json={})
check("POST /quiz/generate without token = 401", r.status_code == 401)
r = client.post("/revision/generate", json={})
check("POST /revision/generate without token = 401", r.status_code == 401)

print("=" * 50)
print(f"Results: {passed} passed, {failed} failed")
print("=" * 50)

if failed > 0:
    raise SystemExit(1)