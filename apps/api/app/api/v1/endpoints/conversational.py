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
from app.services.process_target import boot_target, kill_process, should_skip_boot, wait_for_port
from pydantic import BaseModel

router = APIRouter()


class ConversationalAttackRequest(BaseModel):
    target_id: uuid.UUID
    goal: str
    max_turns: int = 5


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
        discovered = await discover_chat_endpoint(f"http://127.0.0.1:{target.target_port}")
        if not discovered:
            raise HTTPException(status_code=400, detail="No chat endpoint discovered on the target")

        return await conversational_runner.run_crescendo_attack(
            target_model="http-target",
            goal=request.goal,
            max_turns=request.max_turns,
            target_config={
                "http_endpoint": discovered.url,
                "http_body_style": discovered.body_style,
            },
        )
    finally:
        if process:
            kill_process(process.pid)
