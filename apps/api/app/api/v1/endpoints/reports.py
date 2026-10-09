"""
Report Endpoints
================
Endpoints to fetch generated vulnerability reports.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.db.campaign import Campaign
from app.models.db.test_result import TestResult
from app.models.db.finding import Finding
from app.models.db.user import User
from app.models.schemas.report import ReportResponse
from app.attack_library.taxonomy import taxonomy_for
from app.services.report_generator import report_generator

router = APIRouter()


@router.get("/campaign/{campaign_id}", response_model=ReportResponse)
async def get_campaign_report(
    campaign_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Generate and fetch the full vulnerability report for a campaign.
    """
    # 1. Fetch the campaign and target (scoped to current user)
    query = select(Campaign).options(selectinload(Campaign.target)).where(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id,
    )
    result = await db.execute(query)
    campaign = result.scalar_one_or_none()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    if campaign.status not in ("completed", "failed", "cancelled"):
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot generate report. Campaign is currently '{campaign.status}'"
        )

    # 2. Fetch all test results for this campaign
    results_query = select(TestResult).where(TestResult.campaign_id == campaign_id)
    results_result = await db.execute(results_query)
    test_results = results_result.scalars().all()
    
    # 3. Fetch all findings for this campaign
    findings_query = select(Finding).where(Finding.campaign_id == campaign_id)
    findings_result = await db.execute(findings_query)
    findings = findings_result.scalars().all()

    # 4. Format data for the generator
    campaign_data = {
        "id": campaign.id,
        "name": campaign.name,
        "risk_score": campaign.risk_score,
        "status": campaign.status,
        "trials": campaign.trials,
        "run_config": campaign.run_config,
        "status_detail": campaign.description if campaign.status in ("failed", "cancelled") else None,
        "started_at": campaign.started_at,
        "completed_at": campaign.completed_at,
    }
    
    target_data = {
        "name": campaign.target.name if campaign.target else "Unknown",
        "project_path": campaign.target.project_path if campaign.target else "",
        "target_port": campaign.target.target_port if campaign.target else None,
        "start_command": campaign.target.start_command if campaign.target else "",
    }
    
    # Convert ORM models to dicts
    results_dicts = [
        {
            "result": r.result,
            "attack_name": r.attack_name,
            "attack_category": r.attack_category,
            "severity": r.severity,
            "confidence": r.confidence,
            "prompt_sent": r.prompt_sent,
            "model_response": r.model_response,
            "eval_reasoning": r.eval_reasoning,
            "mutation_generation": r.mutation_generation,
            "executed_at": r.executed_at,
        } for r in test_results
    ]
    
    findings_dicts = [
        {
            "id": str(f.id),
            "category": f.category,
            "title": f.title,
            "description": f.description,
            "severity": f.severity,
            "confidence": f.confidence,
            "occurrence_count": f.occurrence_count,
            "total_tests_in_category": f.total_tests_in_category,
            "remediation": f.remediation,
            "evidence": f.evidence,
        } for f in findings
    ]

    # 5. Generate and return the report
    return report_generator.generate_report(
        campaign_data=campaign_data,
        target_data=target_data,
        results=results_dicts,
        findings=findings_dicts,
    )


@router.get("/campaign/{campaign_id}/results")
async def get_campaign_results(
    campaign_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    result: str | None = None,
):
    """Every test of a campaign, optionally only those with one result (fail, pass, error, inconclusive)."""
    owned = await db.execute(
        select(Campaign.id).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    if owned.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Campaign not found")

    query = select(TestResult).where(TestResult.campaign_id == campaign_id)
    if result:
        query = query.where(TestResult.result == result)
    rows = (await db.execute(query.order_by(TestResult.executed_at))).scalars().all()
    return [
        {
            "attack_name": r.attack_name,
            "attack_category": r.attack_category,
            "result": r.result,
            "severity": r.severity,
            "confidence": r.confidence,
            "method": (r.meta_data or {}).get("method"),
            "trials": (r.meta_data or {}).get("trials", 1),
            "worked_trials": (r.meta_data or {}).get("worked_trials"),
            "tool_calls": (r.meta_data or {}).get("tool_calls") or [],
            "taxonomy": taxonomy_for(r.attack_category or ""),
            "prompt_sent": r.prompt_sent,
            "model_response": r.model_response,
            "eval_reasoning": r.eval_reasoning,
            "mutation_generation": r.mutation_generation,
        }
        for r in rows
    ]
