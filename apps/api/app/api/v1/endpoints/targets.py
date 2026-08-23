"""
Target Endpoints
================
CRUD operations for local project targets.
"""

import uuid
from pathlib import Path
from typing import Annotated

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
from app.services.http_target import discover_chat_endpoint
from app.services.process_target import (
    boot_target,
    kill_process,
    should_skip_boot,
    wait_for_port,
)

router = APIRouter()
BUILTIN_DUMMY_NAME = "Vulnerable Support Bot"


def _find_dummy_dir() -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "dummy_target"
        if candidate.is_dir():
            return candidate
    return Path.cwd()


def _resolve_project_path(target_in: TargetCreate) -> str:
    skip = should_skip_boot(target_in.start_command)
    path = (target_in.project_path or "").strip() or "."
    resolved = Path(path).expanduser()
    if resolved.exists() and resolved.is_dir():
        return str(resolved)
    if skip:
        dummy = _find_dummy_dir()
        return str(dummy if dummy.exists() else Path.cwd())
    if not resolved.exists():
        raise HTTPException(status_code=400, detail=f"Path does not exist: {path}")
    if not resolved.is_dir():
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {path}")
    return str(resolved)


@router.post("/builtin-dummy", response_model=TargetResponse)
async def seed_builtin_dummy(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Create or return the in-process dummy chat target (API port 8000)."""
    result = await db.execute(select(Target).where(Target.name == BUILTIN_DUMMY_NAME))
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    dummy_dir = _find_dummy_dir()
    target = Target(
        user_id=current_user.id,
        name=BUILTIN_DUMMY_NAME,
        description="Built-in vulnerable chat endpoint at /api/v1/dummy/chat (already running with the API).",
        project_path=str(dummy_dir),
        start_command="already running",
        target_port=8000,
    )
    db.add(target)
    await db.commit()
    await db.refresh(target)
    return target


@router.post("", response_model=TargetResponse, status_code=status.HTTP_201_CREATED)
async def create_target(
    target_in: TargetCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Register a new local project target."""
    target = Target(
        user_id=current_user.id,
        name=target_in.name,
        description=target_in.description,
        project_path=_resolve_project_path(target_in),
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
    """Boot (unless skipped) and probe for a chat endpoint on the target port."""
    query = select(Target).where(Target.id == target_id)
    result = await db.execute(query)
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    process = None
    skip = should_skip_boot(target.start_command)
    try:
        if not skip:
            process = await boot_target(target.start_command, target.project_path)
        opened = await wait_for_port(target.target_port, timeout=20 if not skip else 3)
        if not opened:
            return TargetTestResult(
                success=False,
                message=f"Port {target.target_port} did not open.",
                output=None,
            )
        discovered = await discover_chat_endpoint(f"http://127.0.0.1:{target.target_port}")
        if not discovered:
            return TargetTestResult(
                success=False,
                message="Port is open but no chat endpoint was discovered.",
                output=None,
            )
        return TargetTestResult(
            success=True,
            message=f"Reached {discovered.path} ({discovered.body_style} body).",
            output=discovered.url,
        )
    except Exception as exc:
        return TargetTestResult(success=False, message=str(exc), output=None)
    finally:
        if process:
            kill_process(process.pid)
