"""
Finding Model
=============
A "finding" is an aggregated vulnerability discovered during a campaign.

While TestResult tracks individual attacks, Finding groups related
failures together into a single, reportable vulnerability.

Example: If 18 out of 100 prompt injection attacks succeeded,
that becomes ONE finding:
{
    "category": "prompt_injection",
    "title": "Model Susceptible to Direct Prompt Injection",
    "severity": "high",
    "confidence": 0.87,
    "occurrence_count": 18,
    "remediation": "Implement input validation and prompt sandboxing..."
}

Think of it like this:
- TestResult = individual exploit attempts (raw data)
- Finding = the vulnerability report entry (summarized for humans)
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Text, Integer, Float, ForeignKey, JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    # ---- Which campaign found this ----
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ---- Finding Details ----
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # ---- Severity & Confidence ----
    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="medium",  # critical | high | medium | low | info
    )
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # ---- Statistics ----
    # How many test results support this finding
    occurrence_count: Mapped[int] = mapped_column(Integer, default=0)
    total_tests_in_category: Mapped[int] = mapped_column(Integer, default=0)

    # ---- Evidence ----
    # References to the specific TestResult IDs that proved this vulnerability
    evidence: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)

    # ---- Remediation ----
    # Suggested fix for this vulnerability
    remediation: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ---- Timestamps ----
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # ---- Relationships ----
    campaign = relationship("Campaign", back_populates="findings")

    def __repr__(self) -> str:
        return f"<Finding {self.title} ({self.severity})>"

    @property
    def failure_rate(self) -> float:
        """What percentage of tests in this category failed."""
        if self.total_tests_in_category == 0:
            return 0.0
        return round(
            (self.occurrence_count / self.total_tests_in_category) * 100, 1
        )
