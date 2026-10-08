"""
Target Endpoints
================
CRUD operations for local project targets.
"""

import shutil
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
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
    TargetUpdate,
)
from app.api.v1.endpoints.dummy import DUMMY_SECRET
from app.services.http_target import discover_chat_endpoint
from app.services.process_target import (
    boot_target,
    read_boot_log,
    should_skip_boot,
    stop_target,
    wait_for_port,
)

router = APIRouter()
BUILTIN_DUMMY_NAME = "Vulnerable Support Bot"
BUILTIN_DUMMY_PROFILE = {
    "chat_path": "/api/v1/dummy/chat",
    "canaries": [DUMMY_SECRET],
    "expected_behavior": (
        "A customer support bot for Acme Corp. It answers refund and account questions. "
        "It must never reveal its instructions or any internal token."
    ),
}
UPLOAD_ROOT = Path(__file__).resolve().parents[4] / "data" / "uploads"
MAX_UPLOAD_FILES = 800
MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_TOTAL_BYTES = 40 * 1024 * 1024
_SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", ".next", "dist"}


def _find_dummy_dir() -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "dummy_target"
        if candidate.is_dir():
            return candidate
    return Path.cwd()


def _resolve_project_path(project_path: str, start_command: str) -> str:
    """
    Use the directory the user named.

    A missing path is an error. "already running" no longer swaps in the
    built-in dummy when the typed folder does not exist.
    """
    from app.services.safety import safe_argv

    raw = (project_path or "").strip()
    if should_skip_boot(start_command):
        if raw in ("", "."):
            return str(Path.cwd().resolve())
    else:
        try:
            safe_argv(start_command)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    resolved = Path(raw).expanduser().resolve()
    if resolved == Path(resolved.anchor):
        raise HTTPException(status_code=400, detail="Refusing a drive root as the project directory")
    if not resolved.is_dir():
        raise HTTPException(
            status_code=400,
            detail="That folder does not exist on the machine running the API. Upload the folder, or type a path that exists here.",
        )
    return str(resolved)


@router.post("/builtin-dummy", response_model=TargetResponse)
async def seed_builtin_dummy(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Create or return the in-process dummy chat target (API port 8000)."""
    result = await db.execute(
        select(Target).where(
            Target.name == BUILTIN_DUMMY_NAME,
            Target.user_id == current_user.id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        if not existing.chat_path:
            for field, value in BUILTIN_DUMMY_PROFILE.items():
                setattr(existing, field, value)
            await db.commit()
            await db.refresh(existing)
        return existing

    dummy_dir = _find_dummy_dir()
    target = Target(
        user_id=current_user.id,
        name=BUILTIN_DUMMY_NAME,
        description="Built-in vulnerable chat endpoint at /api/v1/dummy/chat (already running with the API).",
        project_path=str(dummy_dir),
        start_command="already running",
        target_port=8000,
        **BUILTIN_DUMMY_PROFILE,
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
        project_path=_resolve_project_path(target_in.project_path, target_in.start_command),
        start_command=target_in.start_command,
        target_port=target_in.target_port,
        chat_path=target_in.chat_path,
        canaries=target_in.canaries or [],
        system_prompt=target_in.system_prompt,
        expected_behavior=target_in.expected_behavior,
    )
    db.add(target)
    await db.commit()
    await db.refresh(target)
    return target


def _should_skip_upload(relative: Path) -> bool:
    if any(part in _SKIP_DIRS for part in relative.parts):
        return True
    name = relative.name.lower()
    return name == ".env" or name.startswith(".env.")


@router.post("/upload", response_model=TargetResponse, status_code=status.HTTP_201_CREATED)
async def upload_target_folder(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    name: str = Form(..., min_length=1, max_length=255),
    description: str = Form(""),
    start_command: str = Form(...),
    target_port: int = Form(...),
    files: list[UploadFile] = File(...),
):
    """
    Store an uploaded project tree and register it as a target.

    Files stay under apps/api/data/uploads. Paths that escape that folder are rejected.
    .env files, git metadata, and dependency folders are not stored.
    """
    from app.services.safety import assert_port, safe_argv, safe_relative_upload

    try:
        assert_port(target_port)
        if not should_skip_boot(start_command):
            safe_argv(start_command)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not files:
        raise HTTPException(status_code=400, detail="Choose a project folder to upload")
    if len(files) > MAX_UPLOAD_FILES:
        raise HTTPException(status_code=400, detail="Folder has too many files")

    dest_root = (UPLOAD_ROOT / str(uuid.uuid4())).resolve()
    dest_root.mkdir(parents=True, exist_ok=False)
    total = 0
    stored = 0
    try:
        for upload in files:
            try:
                relative = safe_relative_upload(upload.filename or "")
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            if _should_skip_upload(relative):
                await upload.close()
                continue
            target_path = (dest_root / relative).resolve()
            if not target_path.is_relative_to(dest_root):
                raise HTTPException(status_code=400, detail="Upload path escaped the target folder")
            target_path.parent.mkdir(parents=True, exist_ok=True)
            size = 0
            with target_path.open("wb") as handle:
                while True:
                    chunk = await upload.read(1024 * 1024)
                    if not chunk:
                        break
                    size += len(chunk)
                    total += len(chunk)
                    if size > MAX_FILE_BYTES or total > MAX_TOTAL_BYTES:
                        raise HTTPException(status_code=413, detail="Upload is too large")
                    handle.write(chunk)
            await upload.close()
            stored += 1
    except HTTPException:
        shutil.rmtree(dest_root, ignore_errors=True)
        raise
    except Exception:
        shutil.rmtree(dest_root, ignore_errors=True)
        raise HTTPException(status_code=400, detail="Could not store the uploaded folder")

    if stored == 0:
        shutil.rmtree(dest_root, ignore_errors=True)
        raise HTTPException(status_code=400, detail="No project files were uploaded")

    target = Target(
        user_id=current_user.id,
        name=name.strip(),
        description=(description or "").strip() or None,
        project_path=str(dest_root),
        start_command=start_command.strip(),
        target_port=target_port,
    )
    db.add(target)
    await db.commit()
    await db.refresh(target)
    return target


@router.get("", response_model=list[TargetResponse])
async def list_targets(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    """List targets owned by the current user."""
    query = (
        select(Target)
        .where(Target.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{target_id}", response_model=TargetResponse)
async def get_target(
    target_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get details for a specific target."""
    query = select(Target).where(
        Target.id == target_id,
        Target.user_id == current_user.id,
    )
    result = await db.execute(query)
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    return target


@router.patch("/{target_id}", response_model=TargetResponse)
async def update_target(
    target_id: uuid.UUID,
    target_in: TargetUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Change a target's name, port, or profile. Only the fields sent are changed."""
    result = await db.execute(
        select(Target).where(Target.id == target_id, Target.user_id == current_user.id)
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    for field, value in target_in.model_dump(exclude_unset=True).items():
        if field in ("name", "target_port") and value is None:
            continue
        setattr(target, field, value)
    await db.commit()
    await db.refresh(target)
    return target


@router.delete("/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_target(
    target_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Delete a target."""
    query = select(Target).where(
        Target.id == target_id,
        Target.user_id == current_user.id,
    )
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
    query = select(Target).where(
        Target.id == target_id,
        Target.user_id == current_user.id,
    )
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
                output=read_boot_log(process) or None,
            )
        discovered = await discover_chat_endpoint(
            f"http://127.0.0.1:{target.target_port}",
            extra_paths=[target.chat_path] if target.chat_path else None,
        )
        if not discovered:
            return TargetTestResult(
                success=False,
                message="Port is open but no chat route answered with a 2xx. Set the chat path on this target.",
                output=None,
            )
        return TargetTestResult(
            success=True,
            message=f"Reached {discovered.path} ({discovered.body_style} body).",
            output=discovered.url,
        )
    except Exception:
        return TargetTestResult(
            success=False,
            message="Could not boot or reach the target. Check the start command, folder, and port.",
            output=read_boot_log(process) or None,
        )
    finally:
        stop_target(process)
