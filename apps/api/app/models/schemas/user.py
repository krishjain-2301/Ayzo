"""
User Schemas
============
These define the shape of user data in API requests/responses.

Why separate from database models?
- DB models define what's stored in PostgreSQL
- Schemas define what the API sends/receives
- You don't want to expose password hashes or internal IDs in API responses!

Pydantic validates EVERYTHING automatically:
- Wrong email format? → 422 error with clear message
- Missing required field? → 422 error
- Wrong data type? → 422 error
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field
from uuid import UUID

class UserBase(BaseModel):
    """Fields shared between create and response."""
    email: str = Field(..., description="User's email address")
    name: str = Field(..., description="Display name")


class UserCreate(UserBase):
    """
    Used when creating a user from Google OAuth.
    The frontend sends Google profile data, we create the user.
    """
    google_id: str = Field(..., description="Google's unique user ID")
    avatar_url: Optional[str] = Field(None, description="Google profile picture URL")


class GoogleTokenRequest(BaseModel):
    """
    Used when logging in with Google.
    The frontend sends the Google JWT (ID token), which the backend securely verifies.
    """
    credential: str = Field(..., description="Google ID Token JWT")



class UserResponse(UserBase):
    """
    What the API returns when you request user info.
    Notice: NO password hash, NO google_id (those are private).
    """
    id: UUID = Field(..., description="User UUID")
    role: str = Field(..., description="User role: admin, analyst, or viewer")
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True  # Allows converting from SQLAlchemy model


class TokenResponse(BaseModel):
    """
    Returned after successful login.
    The frontend stores this token and sends it with every request.
    """
    access_token: str = Field(..., description="JWT token")
    token_type: str = Field(default="bearer", description="Always 'bearer'")
    user: UserResponse = Field(..., description="The authenticated user's info")
