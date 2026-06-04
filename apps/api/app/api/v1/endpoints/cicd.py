from typing import Annotated
import uuid
from datetime import datetime, timezone
import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.db.user import User
from app.models.db.target import Target
from app.models.schemas.campaign import CampaignCreate
from app.services.attack_engine import attack_engine
from app.models.db.campaign import Campaign
from app.models.db.test_result import TestResult
from app.models.db.finding import Finding

router = APIRouter()

@router.post("/run-sync")
async def run_cicd_assessment(
    campaign_in: CampaignCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Run a security assessment synchronously for CI/CD pipelines.
    This blocks until the campaign is complete and returns the full result.
    If the risk score is above 40, CI/CD scripts can read this and fail the build.
    """
    target_id = campaign_in.target_id
    query = select(Target).where(Target.id == target_id)
    result = await db.execute(query)
    target = result.scalar_one_or_none()
    
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
        
    if target.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to test this target")
        
    # Create the campaign record
    campaign = Campaign(
        user_id=current_user.id,
        target_id=target_id,
        name=campaign_in.name,
        description="CI/CD Automated Run",
        attack_categories=campaign_in.attack_categories,
        mutation_depth=campaign_in.mutation_depth,
        mutations_per_prompt=campaign_in.mutations_per_prompt,
        status="running",
        started_at=datetime.now(timezone.utc)
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    model_identifier = target.model_name
    if target.provider == "dummy":
        model_identifier = "dummy"
    elif target.provider == "custom":
        model_identifier = "custom_webhook"
    elif target.provider == "ollama" and not model_identifier.startswith("ollama/"):
        model_identifier = f"ollama/{target.model_name}"
        
    try:
        db_lock = asyncio.Lock()
        async def progress_cb(completed: int, total: int, result: dict | None):
            async with db_lock:
                campaign.completed_tests = completed
                campaign.total_tests = total
                await db.commit()

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
        
        # Save results
        for res_data in results.get("results", []):
            db.add(TestResult(
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
            ))
            
        for find_data in results.get("findings", []):
            db.add(Finding(
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
            ))
            
        campaign.status = "completed"
        campaign.completed_at = datetime.now(timezone.utc)
        campaign.total_tests = results.get("total_tests", 0)
        campaign.completed_tests = results.get("completed_tests", 0)
        campaign.passed_tests = results.get("passed_tests", 0)
        campaign.failed_tests = results.get("failed_tests", 0)
        campaign.risk_score = results.get("risk_score", 0.0)
        
    except Exception as e:
        campaign.status = "failed"
        
    finally:
        await db.commit()
        await db.refresh(campaign)

    return {
        "status": campaign.status,
        "risk_score": campaign.risk_score,
        "total_tests": campaign.total_tests,
        "failed_tests": campaign.failed_tests,
        "campaign_id": campaign.id,
        "message": "CI/CD Assessment complete. Check risk_score to determine if build should fail."
    }
