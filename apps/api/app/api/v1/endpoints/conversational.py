from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.db.user import User
from app.models.db.target import Target
from app.services.conversational_runner import conversational_runner
from app.services.http_target import discover_chat_endpoint
from app.core.config import settings
from app.services.campaign_runner import target_http_options, target_profile
from app.services.process_target import boot_target, should_skip_boot, stop_target, wait_for_port
from pydantic import BaseModel, Field

router = APIRouter()


class ConversationalAttackRequest(BaseModel):
    target_id: uuid.UUID
    goal: str = Field(..., min_length=1, max_length=2000)
    max_turns: int = Field(default=5, ge=1, le=8)


@router.post("/run", status_code=status.HTTP_200_OK)
async def run_conversational_attack(
    request: ConversationalAttackRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Run a multi-turn Crescendo attack against a local HTTP target."""
    query = select(Target).where(
        Target.id == request.target_id,
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
        opened = await wait_for_port(target.target_port, timeout=30 if not skip else 5)
        if not opened:
            raise HTTPException(
                status_code=400,
                detail=f"Port {target.target_port} did not open",
            )
        http_options = target_http_options(target)
        discovered = await discover_chat_endpoint(
            f"http://127.0.0.1:{target.target_port}",
            extra_paths=[target.chat_path] if target.chat_path else None,
            options=http_options,
        )
        if not discovered:
            raise HTTPException(status_code=400, detail="No chat endpoint discovered on the target")

        return await conversational_runner.run_crescendo_attack(
            endpoint=discovered.url,
            body_style=discovered.body_style,
            goal=request.goal,
            max_turns=request.max_turns,
            profile=target_profile(target),
            http_options=http_options,
            timeout=settings.TARGET_TIMEOUT_SECONDS,
        )
    finally:
        stop_target(process)
