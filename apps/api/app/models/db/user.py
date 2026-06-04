"""
User Model
==========
Stores user accounts. Since we're using Google OAuth,
most users will be created automatically when they first sign in.

Columns:
- id: Unique identifier (UUID) - random string like "a1b2c3d4-..."
- email: Their Google email (unique, can't have duplicates)
- name: Display name from Google profile
- avatar_url: Profile picture from Google
- role: What they're allowed to do (admin/analyst/viewer)
- google_id: Google's unique ID for this user (links to their Google account)
- created_at: When they first signed in
- updated_at: Last time their profile was updated
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    # This becomes the table name in PostgreSQL
    __tablename__ = "users"

    # ---- Primary Key ----
    # UUID is better than auto-increment IDs for security
    # (attackers can't guess other user IDs by incrementing)
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    # ---- User Info ----
    email: Mapped[str] = mapped_column(
        String(320),   # Max email length per RFC
        unique=True,   # No duplicate emails!
        nullable=False,
        index=True,    # Makes searching by email fast
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ---- Role-Based Access Control (RBAC) ----
    # admin: full access (create campaigns, manage users)
    # analyst: can run tests and view reports
    # viewer: read-only access to reports
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="analyst",  # New users default to analyst
    )

    # ---- Google OAuth ----
    google_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
    )

    # ---- CI/CD API Key ----
    api_key: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
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
    # One user can own many targets and campaigns
    # These aren't columns — they're shortcuts to access related data
    targets = relationship("Target", back_populates="owner", lazy="selectin")
    campaigns = relationship("Campaign", back_populates="owner", lazy="selectin")

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role})>"
