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
    """
    Run a multi-turn Crescendo attack against a specific target.
    This runs synchronously for now so the UI can stream/wait for it.
    """
    # 1. Verify target
    query = select(Target).where(Target.id == request.target_id)
    result = await db.execute(query)
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
        
    if target.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to test this target")

    # 2. Determine target model identifier
    model_identifier = target.model_name
    if target.provider == "dummy":
        model_identifier = "dummy"
    elif target.provider == "custom":
        model_identifier = "custom_webhook"
    elif target.provider == "ollama" and not model_identifier.startswith("ollama/"):
        model_identifier = f"ollama/{target.model_name}"

    # 3. Run the attack
    try:
        result = await conversational_runner.run_crescendo_attack(
            target_model=model_identifier,
            goal=request.goal,
            max_turns=request.max_turns,
            target_api_key=target.api_key,
            target_api_base=target.endpoint_url,
            target_config=target.config,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
