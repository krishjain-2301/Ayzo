"""
Campaign Endpoints
==================
CRUD operations and execution for security testing campaigns.

When a campaign is created, we use FastAPI's BackgroundTasks to
run the Attack Engine asynchronously. This means the API returns
immediately (so the frontend doesn't hang), while the heavy testing
runs in the background.

FIX: target.api_key is now decrypted before being passed to the attack
engine so the LLM client receives the raw plaintext key, not the
"fernet:<token>" string.
"""

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db, async_session_maker
from app.core.crypto import decrypt_api_key
from app.models.db.campaign import Campaign
from app.models.db.target import Target
from app.models.db.user import User
from app.models.db.test_result import TestResult
from app.models.db.finding import Finding
from app.models.schemas.campaign import CampaignCreate, CampaignResponse, CampaignSummary
from app.services.attack_engine import attack_engine

router = APIRouter()


# The background execution logic has been moved to app.workers.tasks.


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    campaign_in: CampaignCreate,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Create a new campaign and start it in the background."""
    query = select(Target).where(Target.id == campaign_in.target_id)
    result = await db.execute(query)
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    if target.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to test this target")

    campaign = Campaign(
        user_id=current_user.id,
        target_id=campaign_in.target_id,
        name=campaign_in.name,
        description=campaign_in.description,
        attack_categories=campaign_in.attack_categories,
        mutation_depth=campaign_in.mutation_depth,
        mutations_per_prompt=campaign_in.mutations_per_prompt,
        status="pending",
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    from app.workers.tasks import run_campaign_task
    run_campaign_task.delay(str(campaign.id))

    return campaign


@router.get("", response_model=list[CampaignSummary])
async def list_campaigns(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """List all campaigns with summary info."""
    if current_user.role == "admin":
        query = select(Campaign).options(selectinload(Campaign.target)).offset(skip).limit(limit)
    else:
        query = (
            select(Campaign)
            .options(selectinload(Campaign.target))
            .where(Campaign.user_id == current_user.id)
            .offset(skip)
            .limit(limit)
        )

    result = await db.execute(query)
    campaigns = result.scalars().all()

    summaries = []
    for c in campaigns:
        target_name = c.target.name if c.target else "Unknown"
        summaries.append({
            "id": str(c.id),
            "name": c.name,
            "target_name": target_name,
            "status": c.status,
            "total_tests": c.total_tests,
            "failed_tests": c.failed_tests,
            "risk_score": c.risk_score,
            "progress_percent": c.progress_percent,
            "created_at": c.created_at,
        })

    return summaries


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get detailed campaign status."""
    query = select(Campaign).where(Campaign.id == campaign_id)
    result = await db.execute(query)
    campaign = result.scalar_one_or_none()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view this campaign")

    return campaign


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Delete a campaign and all its associated results."""
    query = select(Campaign).where(Campaign.id == campaign_id)
    result = await db.execute(query)
    campaign = result.scalar_one_or_none()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this campaign")

    await db.delete(campaign)
    await db.commit()
    return None
