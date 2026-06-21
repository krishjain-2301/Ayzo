"""
User Model — Local Mode
========================
Single local user. No auth, no roles, no credits, no OAuth.
The user is auto-created on first API request.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    email: Mapped[str] = mapped_column(
        String(320),
        unique=True,
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Kept for schema compatibility with campaigns/targets FK references
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="admin",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    targets = relationship("Target", back_populates="owner", lazy="selectin")
    campaigns = relationship("Campaign", back_populates="owner", lazy="selectin")

    def __repr__(self) -> str:
        return f"<User {self.email}>"
