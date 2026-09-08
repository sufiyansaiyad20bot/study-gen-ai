"""
====================================================
Study Gen AI â€” Authentication Test
====================================================

Run with:
    py -3.13 tests/test_auth.py

Tests:
1. Root endpoint
2. Register a student
3. Duplicate email rejection
4. Login with correct password
5. Login with wrong password
6. Protected /auth/me with token
7. Protected /auth/me without token
8. Password mismatch on register
====================================================
"""

import sys
import time
from pathlib import Path

# Ensure the project root is on the path so `backend` is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)

print("=" * 50)
print("Study Gen AI â€” Authentication Tests")
print("=" * 50)

passed = 0
failed = 0


def check(name, condition, extra=""):
    global passed, failed
    status = "âœ… PASS" if condition else "âŒ FAIL"
    if condition:
        passed += 1
    else:
        failed += 1
    print(f"  {status} â€” {name} {extra}")


# 1. Root endpoint
r = client.get("/")
check("Root endpoint returns 200", r.status_code == 200, f"({r.status_code})")
check("Root project name", r.json().get("project") == "Study Gen AI")

# 2. Register a student
unique_email = f"student{int(time.time())}@test.com"
r = client.post(
    "/auth/register",
    json={
        "name": "Test Student",
        "email": unique_email,
        "password": "secret123",
        "confirm_password": "secret123",
        "branch": "Computer Science",
        "semester": 3,
    },
)
check("Register returns 201", r.status_code == 201, f"({r.status_code})")

if r.status_code == 201:
    data = r.json()
    token = data.get("access_token")
    user = data.get("user", {})

    check("Register returns JWT token", bool(token))
    check("Register returns user name", user.get("name") == "Test Student")
    check("User has no password field", "password" not in user)
else:
    print(r.text)
    token = None

# 3. Duplicate email rejection
r = client.post(
    "/auth/register",
    json={
        "name": "Duplicate",
        "email": unique_email,
        "password": "secret123",
        "confirm_password": "secret123",
        "branch": "IT",
        "semester": 2,
    },
)
check("Duplicate email rejected (400)", r.status_code == 400, f"({r.status_code})")

# 4. Login with correct password
r = client.post(
    "/auth/login",
    json={"email": unique_email, "password": "secret123"},
)
check("Login returns 200", r.status_code == 200, f"({r.status_code})")
if r.status_code == 200:
    login_token = r.json().get("access_token")
    check("Login returns JWT token", bool(login_token))

# 5. Login with wrong password
r = client.post(
    "/auth/login",
    json={"email": unique_email, "password": "wrongpass"},
)
check("Wrong password returns 401", r.status_code == 401, f"({r.status_code})")

# 6. Protected /auth/me with token
r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
check("GET /auth/me with token", r.status_code == 200, f"({r.status_code})")
if r.status_code == 200:
    check("Me returns student email", r.json().get("email") == unique_email)

# 7. Protected /auth/me without token
r = client.get("/auth/me")
check("GET /auth/me without token returns 401", r.status_code == 401, f"({r.status_code})")

# 8. Password mismatch on register
r = client.post(
    "/auth/register",
    json={
        "name": "Mismatch",
        "email": f"mismatch{int(time.time())}@test.com",
        "password": "secret123",
        "confirm_password": "different123",
        "branch": "IT",
        "semester": 2,
    },
)
check("Password mismatch rejected (422)", r.status_code == 422, f"({r.status_code})")

print("=" * 50)
print(f"Results: {passed} passed, {failed} failed")
print("=" * 50)

if failed > 0:
    raise SystemExit(1)