"""
Campaign Schemas
================
API contracts for security testing campaigns.

A campaign = "test this model with these attack categories"
"""

from datetime import datetime
from typing import Optional

from uuid import UUID
from pydantic import BaseModel, Field


class CampaignCreate(BaseModel):
    """
    Request to start a new security testing campaign.
    
    Example:
    {
        "name": "June 2026 Assessment",
        "target_id": "uuid-of-target",
        "attack_categories": ["prompt_injection", "role_override", "system_prompt_leak"],
        "mutation_depth": 1,
        "mutations_per_prompt": 5
    }
    """
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    target_id: UUID = Field(..., description="UUID of the target model to test")
    attack_categories: list[str] = Field(
        ...,
        min_length=1,
        description="Which vulnerability categories to test",
    )
    mutation_depth: int = Field(
        default=1,
        ge=0,  # ge = greater than or equal to
        le=3,  # le = less than or equal to (max 3 generations)
        description="How many rounds of mutation (0=originals only, 3=max)",
    )
    mutations_per_prompt: int = Field(
        default=5,
        ge=1,
        le=20,
        description="How many variants per prompt per generation",
    )


class CampaignResponse(BaseModel):
    """Campaign data returned by the API."""
    id: UUID
    name: str
    description: Optional[str] = None
    target_id: UUID
    status: str
    attack_categories: list[str]
    mutation_depth: int
    mutations_per_prompt: int

    # Progress
    total_tests: int
    completed_tests: int
    passed_tests: int
    failed_tests: int
    progress_percent: float

    # Results
    risk_score: Optional[float] = None

    # Timestamps
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CampaignSummary(BaseModel):
    """Lightweight campaign data for list views."""
    id: UUID
    name: str
    target_name: str  # Denormalized for convenience
    status: str
    total_tests: int
    failed_tests: int
    risk_score: Optional[float] = None
    progress_percent: float
    created_at: datetime
