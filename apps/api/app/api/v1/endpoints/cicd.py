"""
CI/CD Integration Endpoints
============================
POST /cicd/run          → starts the same campaign runner the dashboard uses
GET  /cicd/poll/{id}    → status + risk_score + should_fail_build
"""

from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.db.user import User
from app.models.db.target import Target
from app.models.schemas.campaign import CampaignCreate
from app.models.db.campaign import Campaign
from app.services.campaign_runner import run_campaign_async

router = APIRouter()


@router.post("/run", status_code=status.HTTP_202_ACCEPTED)
async def start_cicd_assessment(
    campaign_in: CampaignCreate,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Start a CI/CD security assessment asynchronously.

    Poll GET /cicd/poll/{campaign_id} until status is completed or failed.
    Fail the build when should_fail_build is true: the risk score is above
    CICD_FAIL_RISK_THRESHOLD (default 40), or the scan could not complete.
    """
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
        description="CI/CD Automated Run",
        attack_categories=campaign_in.attack_categories,
        mutation_depth=campaign_in.mutation_depth,
        mutations_per_prompt=campaign_in.mutations_per_prompt,
        status="pending",
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    background_tasks.add_task(run_campaign_async, str(campaign.id))

    return {
        "campaign_id": str(campaign.id),
        "status": "pending",
        "fail_threshold": settings.CICD_FAIL_RISK_THRESHOLD,
        "message": "Assessment started. Poll GET /cicd/poll/{campaign_id} for status.",
    }


@router.get("/poll/{campaign_id}")
async def poll_cicd_assessment(
    campaign_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    query = select(Campaign).where(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id,
    )
    result = await db.execute(query)
    campaign = result.scalar_one_or_none()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    threshold = settings.CICD_FAIL_RISK_THRESHOLD
    # A scan that did not complete fails the build too: no verdict is not a pass.
    if campaign.status == "completed":
        should_fail = (campaign.risk_score or 0) > threshold
    elif campaign.status in ("failed", "cancelled"):
        should_fail = True
    else:
        should_fail = None

    return {
        "campaign_id": str(campaign.id),
        "status": campaign.status,
        "detail": campaign.description if campaign.status in ("failed", "cancelled") else None,
        "risk_score": campaign.risk_score,
        "fail_threshold": threshold,
        "total_tests": campaign.total_tests,
        "completed_tests": campaign.completed_tests,
        "failed_tests": campaign.failed_tests,
        "error_tests": campaign.error_tests or 0,
        "inconclusive_tests": campaign.inconclusive_tests or 0,
        "progress_percent": campaign.progress_percent,
        "started_at": campaign.started_at,
        "completed_at": campaign.completed_at,
        "should_fail_build": should_fail,
    }
