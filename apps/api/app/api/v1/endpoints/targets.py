"""
Target Endpoints
================
CRUD operations for target models.

Every endpoint here is protected by Depends(get_current_user),
meaning you must be logged in to access them. Additionally, users
can only see targets they created (unless they are an admin).

FIX: Target API keys are now encrypted at rest using Fernet symmetric
encryption. The key is derived from settings.SECRET_KEY so no extra
configuration is required. Keys are decrypted only inside llm_client
calls, just before the HTTP request leaves the server. If the database
is leaked, raw API keys are not exposed.

The encryption helpers live in app.core.crypto and can be imported
anywhere that needs to decrypt a key for use (e.g. test_connection).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.crypto import encrypt_api_key, decrypt_api_key
from app.models.db.target import Target
from app.models.db.user import User
from app.models.schemas.target import (
    TargetCreate,
    TargetResponse,
    TargetTestResult,
    TargetUpdate,
)
from app.services.llm_client import llm_client

router = APIRouter()


@router.post("", response_model=TargetResponse, status_code=status.HTTP_201_CREATED)
async def create_target(
    target_in: TargetCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Register a new target AI model."""
    target = Target(
        user_id=current_user.id,
        name=target_in.name,
        description=target_in.description,
        provider=target_in.provider,
        model_name=target_in.model_name,
        endpoint_url=target_in.endpoint_url,
        # Encrypt the API key before storing — never store plaintext credentials
        api_key=encrypt_api_key(target_in.api_key) if target_in.api_key else None,
        config=target_in.config,
    )
    db.add(target)
    await db.commit()
    await db.refresh(target)
    return target


@router.get("", response_model=list[TargetResponse])
async def list_targets(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """List all targets owned by the current user."""
    if current_user.role == "admin":
        query = select(Target).offset(skip).limit(limit)
    else:
        query = select(Target).where(Target.user_id == current_user.id).offset(skip).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{target_id}", response_model=TargetResponse)
async def get_target(
    target_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get details for a specific target."""
    query = select(Target).where(Target.id == target_id)
    result = await db.execute(query)
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    if target.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view this target")

    return target


@router.delete("/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_target(
    target_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Delete a target."""
    query = select(Target).where(Target.id == target_id)
    result = await db.execute(query)
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    if target.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this target")

    await db.delete(target)
    await db.commit()


@router.post("/{target_id}/test", response_model=TargetTestResult)
async def test_target_connection(
    target_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Test if we can successfully communicate with the target model.
    Sends a simple "hello" message and waits for a response.
    """
    query = select(Target).where(Target.id == target_id)
    result = await db.execute(query)
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    if target.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to test this target")

    model_identifier = target.model_name
    if target.provider == "dummy":
        model_identifier = "dummy"
    elif target.provider == "custom":
        model_identifier = "custom_webhook"
    elif target.provider == "ollama" and not model_identifier.startswith("ollama/"):
        model_identifier = f"ollama/{target.model_name}"
    elif target.provider == "anthropic" and not model_identifier.startswith("anthropic/"):
        model_identifier = f"anthropic/{target.model_name}"
    elif target.provider == "google" and not model_identifier.startswith("gemini/"):
        model_identifier = f"gemini/{target.model_name}"

    # Decrypt the API key only for the outgoing network call
    raw_api_key = decrypt_api_key(target.api_key) if target.api_key else None

    test_result = await llm_client.test_connection(
        model=model_identifier,
        api_key=raw_api_key,
        api_base=target.endpoint_url,
    )

    if test_result["success"] and target.status != "active":
        target.status = "active"
        await db.commit()
    elif not test_result["success"] and target.status != "error":
        target.status = "error"
        await db.commit()

    return test_result
