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
    # "failed" means the scan could not produce a trustworthy score.
    status: str = "completed"
    status_detail: Optional[str] = None
    overall_risk_score: Optional[float] = Field(None, description="0-100, or null when the scan failed")
    risk_level: str = Field(..., description="Critical/High/Medium/Low/Info, or Unknown")

    # Summary stats
    total_tests: int
    total_failures: int
    total_passes: int
    total_errors: int = 0
    total_inconclusive: int = 0
    coverage: float = Field(0.0, description="Percent of tests that ended in pass or fail")
    overall_failure_rate: float

    # Per-category breakdown
    category_scores: list[CategoryScore]

    # Detailed findings
    findings: list[FindingResponse]

    # Timestamps
    generated_at: datetime
    campaign_started_at: Optional[datetime] = None
    campaign_completed_at: Optional[datetime] = None
