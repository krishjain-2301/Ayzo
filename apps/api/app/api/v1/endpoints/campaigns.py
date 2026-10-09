"""
Campaign Endpoints
==================
CRUD operations and execution for security testing campaigns.

Scans wait in a queue and run one at a time (see services/job_queue.py). When
the API restarts, unfinished scans are put back in the queue and continue.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.db.campaign import Campaign
from app.models.db.target import Target
from app.models.db.user import User
from app.models.schemas.campaign import CampaignCreate, CampaignResponse, CampaignSummary
from app.models.db.test_result import TestResult
from app.services import job_queue
from app.services.campaign_runner import build_run_config, request_cancel
from app.services.regression import compare_results

router = APIRouter()


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    campaign_in: CampaignCreate,
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
        trials=campaign_in.trials,
        run_config=build_run_config(campaign_in.seed, campaign_in.trials, campaign_in.adaptive_rounds, campaign_in.max_payloads_per_category),
        status="pending",
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    job_queue.enqueue(str(campaign.id))
    return campaign


@router.get("", response_model=list[CampaignSummary])
async def list_campaigns(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    """List campaigns for the current user."""
    query = (
        select(Campaign)
        .where(Campaign.user_id == current_user.id)
        .options(selectinload(Campaign.target))
        .order_by(Campaign.created_at.desc())
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
            "error_tests": c.error_tests or 0,
            "inconclusive_tests": c.inconclusive_tests or 0,
            "status_detail": c.description if c.status in ("failed", "cancelled") else None,
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


def _rows(results) -> list[dict]:
    return [
        {
            "attack_category": r.attack_category,
            "attack_name": r.attack_name,
            "prompt_sent": r.prompt_sent,
            "result": r.result,
            "severity": r.severity,
            "mutation_generation": r.mutation_generation,
            "meta_data": r.meta_data,
        }
        for r in results
    ]


@router.get("/{campaign_id}/manifest")
async def campaign_manifest(
    campaign_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Everything needed to repeat or audit a scan: the settings it ran with
    (seed, models, limits) and every message that was sent, in order.
    """
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    rows = (
        await db.execute(select(TestResult).where(TestResult.campaign_id == campaign_id).order_by(TestResult.executed_at))
    ).scalars().all()
    return {
        "campaign_id": str(campaign.id),
        "name": campaign.name,
        "status": campaign.status,
        "categories": campaign.attack_categories,
        "mutation_depth": campaign.mutation_depth,
        "run_config": campaign.run_config or {},
        "started_at": campaign.started_at,
        "completed_at": campaign.completed_at,
        "attacks": [
            {
                "name": r.attack_name,
                "category": r.attack_category,
                "generation": r.mutation_generation,
                "prompt": r.prompt_sent,
                "result": r.result,
                "trials": (r.meta_data or {}).get("trials", 1),
                "worked_trials": (r.meta_data or {}).get("worked_trials"),
            }
            for r in rows
        ],
    }


@router.post("/{campaign_id}/cancel")
async def cancel_campaign(
    campaign_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Stop a running scan. Attacks already in flight finish; the rest are not sent."""
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status not in ("pending", "running"):
        raise HTTPException(status_code=409, detail=f"This campaign is already {campaign.status}.")
    request_cancel(str(campaign.id))
    return {"campaign_id": str(campaign.id), "message": "Cancel requested."}


@router.get("/{campaign_id}/compare")
async def compare_campaign(
    campaign_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    baseline_id: uuid.UUID | None = Query(None, description="Scan to compare with. Default: the previous completed scan of the same target"),
):
    """What changed since an earlier scan of the same target: new failures, fixed, still failing."""
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    query = select(Campaign).where(Campaign.user_id == current_user.id, Campaign.target_id == campaign.target_id)
    if baseline_id:
        query = query.where(Campaign.id == baseline_id)
    else:
        query = query.where(
            Campaign.status == "completed",
            Campaign.id != campaign.id,
            Campaign.created_at < campaign.created_at,
        ).order_by(Campaign.created_at.desc())
    baseline = (await db.execute(query.limit(1))).scalar_one_or_none()
    if not baseline:
        return {"campaign_id": str(campaign.id), "baseline_id": None, "message": "No earlier completed scan of this target to compare with."}

    async def results_of(cid):
        return _rows((await db.execute(select(TestResult).where(TestResult.campaign_id == cid))).scalars().all())

    comparison = compare_results(await results_of(campaign.id), await results_of(baseline.id))
    return {
        "campaign_id": str(campaign.id),
        "baseline_id": str(baseline.id),
        "baseline_name": baseline.name,
        "risk_score": campaign.risk_score,
        "baseline_risk_score": baseline.risk_score,
        **comparison,
    }


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
    if campaign.status in ("pending", "running"):
        raise HTTPException(status_code=409, detail="This campaign is still running. Wait for it to finish.")

    await db.delete(campaign)
    await db.commit()
    return None
