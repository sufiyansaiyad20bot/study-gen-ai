"""
====================================================
Study Gen AI â€” Authentication Routes
====================================================

Endpoints:
- POST /auth/register  â†’ Create a student account
- POST /auth/login     â†’ Login and get a JWT token
- GET  /auth/me        â†’ Get the currently logged-in user
====================================================
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.schemas.auth import Token, UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new student account.

    - Checks for duplicate email
    - Hashes the password (never stored in plain text)
    - Returns a JWT token so the student is logged in immediately
    """
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    # Create the user with a hashed password
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        branch=payload.branch,
        semester=payload.semester,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # Issue a JWT token
    token = create_access_token(data={"sub": str(user.id)})

    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """
    Login with email and password.

    - Verifies the password against the stored hash
    - Returns a JWT token
    """
    # Find the user by email
    user = db.query(User).filter(User.email == payload.email).first()

    # Use a generic message so attackers can't tell which field was wrong
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not user:
        raise invalid_credentials

    if not verify_password(payload.password, user.password_hash):
        raise invalid_credentials

    # Issue a JWT token
    token = create_access_token(data={"sub": str(user.id)})

    return Token(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Get the current logged-in user's profile.
    Protected â€” requires a valid JWT token.
    """
    return current_user