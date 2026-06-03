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
    # 1. Fetch the campaign and target
    query = select(Campaign).options(selectinload(Campaign.target)).where(Campaign.id == campaign_id)
    result = await db.execute(query)
    campaign = result.scalar_one_or_none()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    if campaign.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view this report")
        
    if campaign.status != "completed" and campaign.status != "failed":
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
        "started_at": campaign.started_at,
        "completed_at": campaign.completed_at,
    }
    
    target_data = {
        "name": campaign.target.name if campaign.target else "Unknown",
        "provider": campaign.target.provider if campaign.target else "",
        "model_name": campaign.target.model_name if campaign.target else "",
    }
    
    # Convert ORM models to dicts
    results_dicts = [
        {
            "result": r.result,
            "attack_category": r.attack_category,
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
