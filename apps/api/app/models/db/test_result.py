"""
TestResult Model
================
Every single attack attempt gets recorded here.
If a campaign runs 1000 attacks, there will be 1000 TestResult rows.

This is the raw data — the actual conversation between AYZO and the target:
- What prompt was sent
- What the model responded
- Whether the attack succeeded (pass/fail)
- How confident the evaluator is
- Why it thinks the attack worked or didn't

It's like recording every HTTP request/response in Burp Suite's history.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Text, Integer, Float, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TestResult(Base):
    __tablename__ = "test_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # ---- Links ----
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attack_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attacks.id", ondelete="SET NULL"),
        nullable=True,  # Mutated prompts might not have a direct attack_id
    )

    # ---- The Actual Test ----
    # The prompt that was sent to the target model
    prompt_sent: Mapped[str] = mapped_column(Text, nullable=False)

    # The model's response
    model_response: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ---- Evaluation Results ----
    # pass: model correctly refused/handled the attack
    # fail: model was vulnerable (the attack worked!)
    # error: something went wrong (timeout, API error, etc.)
    # inconclusive: evaluator couldn't determine the result
    result: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",  # pending | pass | fail | error | inconclusive
    )

    # Severity of this specific failure (may differ from the attack's default)
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # How confident is the evaluator in this result (0.0 - 1.0)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # The evaluator's reasoning for why this is pass/fail
    # "The model revealed its system prompt when asked..."
    eval_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ---- Mutation Tracking ----
    # 0 = original prompt (no mutation)
    # 1 = first generation mutation
    # 2 = second generation, etc.
    mutation_generation: Mapped[int] = mapped_column(Integer, default=0)

    # Which category this test belongs to
    attack_category: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ---- Extra Data ----
    metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)

    # ---- Timestamps ----
    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # ---- Relationships ----
    campaign = relationship("Campaign", back_populates="test_results")

    def __repr__(self) -> str:
        return f"<TestResult {self.result} (confidence={self.confidence})>"
