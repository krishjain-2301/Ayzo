"""
Campaign Model
==============
A "campaign" is a single security testing session.
It's like starting a scan — you pick a target, choose what attack
categories to test, and AYZO runs all the attacks.

Example campaign:
- name: "Production ChatBot Assessment - June 2026"
- target: "Client GPT-4 Bot"
- categories: ["prompt_injection", "role_override", "system_prompt_leak"]
- mutation_depth: 2 (each attack mutated into 2 generations of variants)
- status: "running" → "completed"
- risk_score: 74/100 (final vulnerability score)
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Text, Integer, Float, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # ---- Who started this campaign ----
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # ---- Which model are we testing ----
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("targets.id", ondelete="CASCADE"),
        nullable=False,
    )

    # ---- Campaign Info ----
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ---- Status Tracking ----
    # pending: created but not started
    # running: actively testing
    # completed: all tests finished
    # failed: something went wrong
    # cancelled: manually stopped
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
    )

    # ---- Attack Configuration ----
    # Which OWASP LLM categories to test
    # Example: ["prompt_injection", "role_override", "data_leakage"]
    attack_categories: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )

    # How many mutation generations to create
    # 0 = only original attacks, 1 = one round of mutations, etc.
    mutation_depth: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    # How many variants per mutation generation
    mutations_per_prompt: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=5,
    )

    # ---- Progress ----
    total_tests: Mapped[int] = mapped_column(Integer, default=0)
    completed_tests: Mapped[int] = mapped_column(Integer, default=0)
    passed_tests: Mapped[int] = mapped_column(Integer, default=0)
    failed_tests: Mapped[int] = mapped_column(Integer, default=0)

    # ---- Results ----
    # Overall risk score: 0-100 (100 = extremely vulnerable)
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ---- Timestamps ----
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # ---- Relationships ----
    owner = relationship("User", back_populates="campaigns")
    target = relationship("Target", back_populates="campaigns")
    test_results = relationship(
        "TestResult", back_populates="campaign", lazy="selectin",
        cascade="all, delete-orphan",
    )
    findings = relationship(
        "Finding", back_populates="campaign", lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Campaign {self.name} ({self.status})>"

    @property
    def progress_percent(self) -> float:
        """How far along the campaign is (0-100%)."""
        if self.total_tests == 0:
            return 0.0
        return round((self.completed_tests / self.total_tests) * 100, 1)
