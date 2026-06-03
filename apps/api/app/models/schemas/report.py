"""
Report Schemas
==============
API contracts for vulnerability reports.

Reports aggregate all campaign findings into a professional
security assessment document.
"""

from datetime import datetime
from typing import Optional

from uuid import UUID
from pydantic import BaseModel, Field


class FindingResponse(BaseModel):
    """A single vulnerability finding in a report."""
    id: UUID
    category: str
    title: str
    description: str
    severity: str  # critical | high | medium | low | info
    confidence: float  # 0.0 - 1.0
    occurrence_count: int
    total_tests_in_category: int
    failure_rate: float  # Computed: occurrence_count / total_tests * 100
    remediation: Optional[str] = None
    evidence: Optional[list] = None  # References to test result IDs

    class Config:
        from_attributes = True


class CategoryScore(BaseModel):
    """Risk score breakdown for a single attack category."""
    category: str
    display_name: str
    total_tests: int
    failures: int
    failure_rate: float
    severity: str  # Highest severity finding in this category
    score: float  # 0-100 risk score for this category


class ReportResponse(BaseModel):
    """
    The full vulnerability report for a campaign.
    
    This is what gets exported as PDF/HTML.
    """
    id: UUID
    campaign_id: UUID
    campaign_name: str
    target_name: str
    target_model: str

    # Overall risk assessment
    overall_risk_score: float = Field(..., description="0-100 risk score")
    risk_level: str = Field(..., description="Critical/High/Medium/Low based on score")

    # Summary stats
    total_tests: int
    total_failures: int
    total_passes: int
    overall_failure_rate: float

    # Per-category breakdown
    category_scores: list[CategoryScore]

    # Detailed findings
    findings: list[FindingResponse]

    # Timestamps
    generated_at: datetime
    campaign_started_at: Optional[datetime] = None
    campaign_completed_at: Optional[datetime] = None


class TestResultResponse(BaseModel):
    """Individual test result (the raw attack/response pair)."""
    id: UUID
    prompt_sent: str
    model_response: Optional[str] = None
    result: str  # pass | fail | error | inconclusive
    severity: Optional[str] = None
    confidence: Optional[float] = None
    eval_reasoning: Optional[str] = None
    attack_category: Optional[str] = None
    mutation_generation: int
    executed_at: datetime

    class Config:
        from_attributes = True
