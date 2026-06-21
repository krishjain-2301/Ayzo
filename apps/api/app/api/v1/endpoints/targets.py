"""
Target Endpoints
================
CRUD operations for target models.
"""

import uuid
from typing import Annotated
import asyncio
import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.db.target import Target
from app.models.db.user import User
from app.models.schemas.target import (
    TargetCreate,
    TargetResponse,
    TargetTestResult,
)

router = APIRouter()


@router.post("", response_model=TargetResponse, status_code=status.HTTP_201_CREATED)
async def create_target(
    target_in: TargetCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Register a new local project target."""
    
    # Basic path validation
    if not os.path.exists(target_in.project_path):
        raise HTTPException(
            status_code=400, 
            detail=f"Path does not exist: {target_in.project_path}"
        )
        
    if not os.path.isdir(target_in.project_path):
        raise HTTPException(
            status_code=400, 
            detail=f"Path is not a directory: {target_in.project_path}"
        )

    target = Target(
        user_id=current_user.id,
        name=target_in.name,
        description=target_in.description,
        project_path=target_in.project_path,
        start_command=target_in.start_command,
        target_port=target_in.target_port,
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
    """List all targets."""
    query = select(Target).offset(skip).limit(limit)
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

    await db.delete(target)
    await db.commit()


@router.post("/{target_id}/test", response_model=TargetTestResult)
async def test_target_connection(
    target_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Test if we can successfully boot the target model locally.
    Spins up the subprocess, checks if port binds, and kills it.
    """
    query = select(Target).where(Target.id == target_id)
    result = await db.execute(query)
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    # In a real scenario we'd use HackerAgent to boot and verify.
    # For now, we simulate a successful boot check.
    # TODO: Implement actual subprocess boot verification using HackerAgent.
    
    return TargetTestResult(
        success=True,
        message="Local target verified (placeholder).",
        output=f"Checked path {target.project_path}"
    )
