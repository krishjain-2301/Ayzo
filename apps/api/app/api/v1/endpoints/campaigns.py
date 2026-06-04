"""
Campaign Endpoints
==================
CRUD operations and execution for security testing campaigns.

When a campaign is created, we use FastAPI's `BackgroundTasks` to
run the Attack Engine asynchronously. This means the API returns
immediately (so the frontend doesn't hang), while the heavy testing
runs in the background.
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
from app.models.db.campaign import Campaign
from app.models.db.target import Target
from app.models.db.user import User
from app.models.db.test_result import TestResult
from app.models.db.finding import Finding
from app.models.schemas.campaign import CampaignCreate, CampaignResponse, CampaignSummary
from app.services.attack_engine import attack_engine

router = APIRouter()


async def run_campaign_background(campaign_id: uuid.UUID):
    """
    Background task that actually runs the campaign.
    We create a fresh database session here because this runs
    outside the normal request/response cycle.
    """
    async with async_session_maker() as db:
        # Load the campaign and its target
        query = select(Campaign).options(selectinload(Campaign.target)).where(Campaign.id == campaign_id)
        result = await db.execute(query)
        campaign = result.scalar_one_or_none()
        
        if not campaign or not campaign.target:
            return
            
        # Update status to running
        campaign.status = "running"
        campaign.started_at = datetime.now(timezone.utc)
        await db.commit()
        
        target = campaign.target
        model_identifier = target.model_name
        if target.provider == "dummy":
            model_identifier = "dummy"
        elif target.provider == "ollama" and not model_identifier.startswith("ollama/"):
            model_identifier = f"ollama/{target.model_name}"
            
        try:
            import asyncio
            db_lock = asyncio.Lock()
            async def progress_cb(completed: int, total: int, result: dict | None):
                # Update progress in DB with a lock to prevent concurrent transaction errors
                async with db_lock:
                    campaign.completed_tests = completed
                    campaign.total_tests = total
                    await db.commit()

            # RUN THE ATTACK ENGINE!
            results = await attack_engine.run_campaign(
                target_model=model_identifier,
                categories=campaign.attack_categories,
                mutation_depth=campaign.mutation_depth,
                mutations_per_prompt=campaign.mutations_per_prompt,
                api_key=target.api_key,
                api_base=target.endpoint_url,
                config=target.config,
                progress_callback=progress_cb,
            )
            
            # Save all the test results
            for res_data in results.get("results", []):
                tr = TestResult(
                    campaign_id=campaign.id,
                    prompt_sent=res_data["prompt_sent"],
                    model_response=res_data.get("model_response"),
                    result=res_data["result"],
                    severity=res_data.get("severity"),
                    confidence=res_data.get("confidence"),
                    eval_reasoning=res_data.get("eval_reasoning"),
                    attack_category=res_data.get("attack_category"),
                    mutation_generation=res_data.get("mutation_generation", 0),
                    meta_data=res_data.get("metadata", {}),
                )
                db.add(tr)
                
            # Save the findings
            for find_data in results.get("findings", []):
                f = Finding(
                    campaign_id=campaign.id,
                    category=find_data["category"],
                    title=find_data["title"],
                    description=find_data["description"],
                    severity=find_data["severity"],
                    confidence=find_data["confidence"],
                    occurrence_count=find_data["occurrence_count"],
                    total_tests_in_category=find_data["total_tests_in_category"],
                    evidence=find_data.get("evidence", []),
                    remediation=find_data.get("remediation"),
                )
                db.add(f)
                
            # Update campaign final stats
            campaign.status = "completed"
            campaign.completed_at = datetime.now(timezone.utc)
            campaign.total_tests = results.get("total_tests", 0)
            campaign.completed_tests = results.get("completed_tests", 0)
            campaign.passed_tests = results.get("passed_tests", 0)
            campaign.failed_tests = results.get("failed_tests", 0)
            campaign.risk_score = results.get("risk_score", 0.0)
            
        except Exception as e:
            print(f"❌ Campaign failed: {e}")
            campaign.status = "failed"
            
        finally:
            await db.commit()


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    campaign_in: CampaignCreate,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new campaign and start it in the background.
    """
    # Verify the target exists and belongs to the user
    target_id = campaign_in.target_id
    query = select(Target).where(Target.id == target_id)
    result = await db.execute(query)
    target = result.scalar_one_or_none()
    
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
        
    if target.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to test this target")
        
    # Create the campaign
    campaign = Campaign(
        user_id=current_user.id,
        target_id=target_id,
        name=campaign_in.name,
        description=campaign_in.description,
        attack_categories=campaign_in.attack_categories,
        mutation_depth=campaign_in.mutation_depth,
        mutations_per_prompt=campaign_in.mutations_per_prompt,
        status="pending"
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    
    # Start the testing process in the background!
    background_tasks.add_task(run_campaign_background, campaign.id)
    
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
        query = select(Campaign).options(selectinload(Campaign.target)).where(
            Campaign.user_id == current_user.id
        ).offset(skip).limit(limit)
        
    result = await db.execute(query)
    campaigns = result.scalars().all()
    
    # Map to summary schema
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
