"""
Campaign Endpoints
==================
CRUD operations and execution for security testing campaigns.

Campaigns run in-process via FastAPI BackgroundTasks (see README). On API
restart, orphaned pending/running rows are marked failed at startup.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.db.campaign import Campaign
from app.models.db.target import Target
from app.models.db.user import User
from app.models.schemas.campaign import CampaignCreate, CampaignResponse, CampaignSummary

router = APIRouter()


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    campaign_in: CampaignCreate,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Create a new campaign and start it in the background."""
    query = select(Target).where(
        Target.id == campaign_in.target_id,
        Target.user_id == current_user.id,
    )
    result = await db.execute(query)
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

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

    from app.services.hacker_agent import hacker_agent
    background_tasks.add_task(hacker_agent.run_campaign_async, str(campaign.id))
    return campaign


@router.get("", response_model=list[CampaignSummary])
async def list_campaigns(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """List campaigns for the current user."""
    query = (
        select(Campaign)
        .where(Campaign.user_id == current_user.id)
        .options(selectinload(Campaign.target))
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
    query = select(Campaign).where(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id,
    )
    result = await db.execute(query)
    campaign = result.scalar_one_or_none()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    return campaign


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Delete a campaign and all its associated results."""
    query = select(Campaign).where(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id,
    )
    result = await db.execute(query)
    campaign = result.scalar_one_or_none()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    await db.delete(campaign)
    await db.commit()
    return None
