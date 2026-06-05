"""
Authentication Endpoints
========================
Supabase handles user login/registration. This router now only
handles generating static API keys for CI/CD integrations.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.db.user import User
from app.api.deps import get_current_user

router = APIRouter()

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
    # Returns the key or None.
    return {"api_key": current_user.api_key}
