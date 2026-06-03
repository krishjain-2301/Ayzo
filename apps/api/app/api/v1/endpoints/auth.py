"""
Authentication Endpoints
========================
Handles logging in and issuing JWT tokens.

We expect the Next.js frontend to handle the actual Google OAuth
flow. Once Next.js gets the user's profile from Google, it sends
it here. We then create/find the user in PostgreSQL and issue
our own API JWT token.
"""

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.db.user import User
from app.models.schemas.user import TokenResponse, UserCreate, UserResponse

router = APIRouter()


@router.post("/google", response_model=TokenResponse)
async def google_login(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Login or register a user via their Google profile.
    
    The frontend calls this after successful Google OAuth.
    If the user doesn't exist, we create them automatically.
    """
    # 1. Check if user already exists by Google ID or Email
    query = select(User).where(
        (User.google_id == user_in.google_id) | (User.email == user_in.email)
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    # 2. If they don't exist, create a new account
    if not user:
        user = User(
            email=user_in.email,
            name=user_in.name,
            google_id=user_in.google_id,
            avatar_url=user_in.avatar_url,
            role="analyst",  # Default role for new users
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    
    # 3. Update their profile picture if it changed
    elif user.avatar_url != user_in.avatar_url or not user.google_id:
        user.avatar_url = user_in.avatar_url
        user.google_id = user_in.google_id
        await db.commit()

    # 4. Generate the JWT access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    token_payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
    }
    
    access_token = create_access_token(
        data=token_payload,
        expires_delta=access_token_expires,
    )

    # 5. Return the token and user profile
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }
