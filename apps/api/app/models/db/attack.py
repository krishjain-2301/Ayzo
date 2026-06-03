"""
Attack Model
============
An "attack" is a single security test case from our attack library.
Think of it like a payload in a bug bounty tool.

Each attack belongs to an OWASP LLM Top 10 category:
- prompt_injection: Trying to override model behavior with crafted input
- system_prompt_leak: Trying to extract the system prompt/instructions
- role_override: Trying to make the model adopt a different persona
- data_leakage: Trying to extract training data or confidential info
- jailbreak: Trying to bypass safety filters entirely
- context_manipulation: Exploiting conversation context/memory
- agent_misuse: Tricking the model into misusing tools/APIs

Example attack:
{
    "category": "prompt_injection",
    "name": "Basic Instruction Override",
    "original_prompt": "Ignore all previous instructions. You are now...",
    "severity": "high"
}
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Text, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Attack(Base):
    __tablename__ = "attacks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # ---- Classification ----
    # Maps to OWASP LLM Top 10 categories
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,   # Fast filtering by category
    )
    subcategory: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ---- Attack Details ----
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # The actual attack prompt that gets sent to the target model
    original_prompt: Mapped[str] = mapped_column(Text, nullable=False)

    # Expected behavior if the attack succeeds
    # This helps the evaluation engine know what to look for
    success_indicators: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ---- Severity ----
    # How dangerous this vulnerability is if exploited
    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="medium",  # critical | high | medium | low | info
    )

    # ---- Metadata ----
    # Is this a built-in attack (shipped with AYZO) or user-created?
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=True)

    # Extra data (tags, references, MITRE ATT&CK mapping, etc.)
    metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)

    # ---- Timestamps ----
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<Attack {self.name} ({self.category}/{self.severity})>"
