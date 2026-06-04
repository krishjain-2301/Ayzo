"""
Authentication Endpoints
========================
Handles logging in and issuing JWT tokens.

We expect the Next.js frontend to handle the actual Google OAuth
flow. Once Next.js gets the user's ID token from Google, it sends
it here. We verify the token using Google's official library to ensure
it wasn't tampered with. Then we create/find the user in PostgreSQL
and issue our own API JWT token.
"""

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from google.oauth2 import id_token
from google.auth.transport import requests

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.db.user import User
from app.api.deps import get_current_user
from app.models.schemas.user import TokenResponse, GoogleTokenRequest

router = APIRouter()


@router.post("/google", response_model=TokenResponse)
async def google_login(
    req: GoogleTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Login or register a user via their Google ID Token.
    
    The frontend calls this after successful Google OAuth.
    We securely verify the token with Google's servers.
    If the user doesn't exist, we create them automatically.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google Authentication is not configured on the server."
        )

    try:
        # Verify the token with Google
        # This checks the signature, expiration, and ensures it was issued for OUR client ID
        idinfo = id_token.verify_oauth2_token(
            req.credential, 
            requests.Request(), 
            settings.GOOGLE_CLIENT_ID
        )

        email = idinfo.get("email")
        google_id = idinfo.get("sub")
        name = idinfo.get("name", "Unknown User")
        avatar_url = idinfo.get("picture")

        if not email or not google_id:
            raise ValueError("Token missing required email or subject (sub).")

    except ValueError as e:
        # Invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}"
        )

    # 1. Check if user already exists by Google ID or Email
    query = select(User).where(
        (User.google_id == google_id) | (User.email == email)
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    # 2. If they don't exist, create a new account
    if not user:
        user = User(
            email=email,
            name=name,
            google_id=google_id,
            avatar_url=avatar_url,
            role="analyst",  # Default role for new users
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    
    # 3. Update their profile picture if it changed
    elif user.avatar_url != avatar_url or not user.google_id:
        user.avatar_url = avatar_url
        user.google_id = google_id
        await db.commit()
        await db.refresh(user)

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


@router.post("/api-key/generate")
async def generate_api_key(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    import secrets
    # Generate a secure random string and prefix it with 'ayzo_'
    new_key = f"ayzo_{secrets.token_urlsafe(32)}"
    
    current_user.api_key = new_key
    await db.commit()
    await db.refresh(current_user)
    
    return {"api_key": new_key}

@router.get("/api-key")
async def get_api_key(
    current_user: Annotated[User, Depends(get_current_user)],
):
    # Returns the key or None. In a real app we might only return the last 4 chars, 
    # but since this is an internal tool we'll return it for convenience.
    return {"api_key": current_user.api_key}
