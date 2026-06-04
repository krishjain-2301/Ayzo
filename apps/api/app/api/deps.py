"""
API Dependencies
================
Reusable components injected into API endpoints.

The most important one here is `get_current_user`.
If an endpoint needs to be secure (e.g., creating a campaign),
we simply add this dependency. It handles reading the JWT token,
verifying the signature, and returning the User object from the DB.

If the token is invalid or missing, it automatically returns a 401 error.
"""

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import verify_token
from app.models.db.user import User

# Tells FastAPI where to look for the token (the Authorization header)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"/api/v1/auth/login")


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Verifies the JWT token and returns the current user.
    Use this to protect endpoints.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Check if this is a static API key (CI/CD) instead of a JWT
    if token.startswith("ayzo_"):
        query = select(User).where(User.api_key == token)
        result = await db.execute(query)
        user = result.scalar_one_or_none()
        if user is None:
            raise credentials_exception
        return user

    # Otherwise, verify the JWT token signature and expiration
    payload = verify_token(token)
    if payload is None:
        raise credentials_exception
        
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
        
    # Look up the user in the database
    try:
        parsed_user_id = uuid.UUID(user_id)
    except ValueError:
        raise credentials_exception
        
    query = select(User).where(User.id == parsed_user_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
        
    return user


async def get_current_admin(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """
    Ensures the current user has the 'admin' role.
    Use this for sensitive operations (e.g., managing other users).
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges",
        )
    return current_user
