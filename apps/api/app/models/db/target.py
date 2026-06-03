"""
Target Model
============
A "target" is the AI model you want to test for vulnerabilities.
Think of it like adding a "scope" in a bug bounty program.

Example: You want to test an Ollama model running locally:
- name: "My ChatBot"
- provider: "ollama"
- model_name: "llama3.2"
- endpoint_url: "http://localhost:11434"

Or an OpenAI model:
- name: "Client GPT-4"
- provider: "openai"
- model_name: "gpt-4"
- endpoint_url: None (uses default OpenAI API)
- api_key: "sk-..." (stored in config, the encrypted key reference)
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Target(Base):
    __tablename__ = "targets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # ---- Who owns this target ----
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),  # Delete targets if user is deleted
        nullable=False,
    )

    # ---- Target Info ----
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ---- Provider Configuration ----
    # provider: Which LLM service hosts this model
    # Supported: "ollama", "openai", "anthropic", "mistral", "custom"
    provider: Mapped[str] = mapped_column(String(50), nullable=False)

    # model_name: The specific model identifier
    # Examples: "llama3.2", "gpt-4", "claude-3-sonnet"
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # endpoint_url: Where to send requests (for Ollama or custom APIs)
    # For OpenAI/Anthropic, this can be null (uses default endpoints)
    endpoint_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # api_key: Encrypted API key for the provider (if needed)
    # Ollama doesn't need one, OpenAI does
    api_key: Mapped[str | None] = mapped_column(Text, nullable=True)

    # config: Extra settings as JSON (temperature, max_tokens, system prompt, etc.)
    # Using JSONB because different models have different settings
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)

    # status: Is this target available for testing?
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="active",  # active | inactive | error
    )

    # ---- Timestamps ----
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ---- Relationships ----
    owner = relationship("User", back_populates="targets")
    campaigns = relationship("Campaign", back_populates="target", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Target {self.name} ({self.provider}/{self.model_name})>"
