"""
CI/CD Integration Endpoints
============================
POST /cicd/run          → starts the same campaign runner the dashboard uses
GET  /cicd/poll/{id}    → status + risk_score + should_fail_build
"""

from typing import Annotated
import uuid
import asyncio

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db, async_session_maker
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
    Fail the build when should_fail_build is true
    (risk_score > CICD_FAIL_RISK_THRESHOLD, default 40).
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

    completed = campaign.status == "completed"
    score = campaign.risk_score or 0
    threshold = settings.CICD_FAIL_RISK_THRESHOLD

    return {
        "campaign_id": str(campaign.id),
        "status": campaign.status,
        "risk_score": campaign.risk_score,
        "fail_threshold": threshold,
        "total_tests": campaign.total_tests,
        "completed_tests": campaign.completed_tests,
        "failed_tests": campaign.failed_tests,
        "progress_percent": campaign.progress_percent,
        "started_at": campaign.started_at,
        "completed_at": campaign.completed_at,
        "should_fail_build": (score > threshold) if completed else None,
    }


@router.post("/run-sync")
async def run_cicd_assessment_sync(
    campaign_in: CampaignCreate,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Deprecated: use POST /cicd/run + GET /cicd/poll."""
    start_resp = await start_cicd_assessment(campaign_in, background_tasks, current_user, db)
    campaign_id = uuid.UUID(start_resp["campaign_id"])

    campaign = None
    max_checks = 180
    for _ in range(max_checks):
        await asyncio.sleep(10)
        async with async_session_maker() as poll_db:
            q = select(Campaign).where(
                Campaign.id == campaign_id,
                Campaign.user_id == current_user.id,
            )
            r = await poll_db.execute(q)
            campaign = r.scalar_one_or_none()
        if campaign and campaign.status in ("completed", "failed"):
            break

    if not campaign:
        raise HTTPException(status_code=500, detail="Campaign not found after start")

    score = campaign.risk_score or 0
    threshold = settings.CICD_FAIL_RISK_THRESHOLD
    return {
        "status": campaign.status,
        "risk_score": campaign.risk_score,
        "fail_threshold": threshold,
        "total_tests": campaign.total_tests,
        "failed_tests": campaign.failed_tests,
        "campaign_id": str(campaign.id),
        "should_fail_build": (
            score > threshold if campaign.status == "completed" else None
        ),
        "message": (
            "CI/CD Assessment complete. Fail the build when should_fail_build is true."
        ),
    }
