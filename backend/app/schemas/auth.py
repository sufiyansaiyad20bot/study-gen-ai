"""
====================================================
Study Gen AI â€” Authentication Schemas
====================================================

Pydantic models for request validation and responses.
Uses Pydantic v2 style.
====================================================
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    """Registration request payload."""

    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    confirm_password: str = Field(..., min_length=6, max_length=128)
    branch: str = Field(..., min_length=2, max_length=100)
    semester: int = Field(..., ge=1, le=8)

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, confirm_password, info):
        if "password" in info.data and confirm_password != info.data["password"]:
            raise ValueError("Passwords do not match")
        return confirm_password


class UserLogin(BaseModel):
    """Login request payload."""

    email: EmailStr
    password: str


class UserOut(BaseModel):
    """User data returned to the client (never includes password)."""

    id: int
    name: str
    email: EmailStr
    branch: str
    semester: int
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TokenData(BaseModel):
    """Data stored inside the JWT token."""

    user_id: int | None = None