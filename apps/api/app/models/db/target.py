"""
Target Model
============
A "target" is the local project you want to test for vulnerabilities.

Since Ayzo is now an autonomous local hacker agent, the target is defined by:
- project_path: Absolute path to the code (e.g. C:\\Projects\\MyApp)
- start_command: How to boot the app (e.g. npm run dev, python app.py)
- target_port: What port the app listens on (so Ayzo knows where to attack)
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Text, ForeignKey, Integer, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Target(Base):
    __tablename__ = "targets"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    # ---- Who owns this target ----
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # ---- Target Info ----
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ---- Execution Configuration ----
    project_path: Mapped[str] = mapped_column(Text, nullable=False)
    start_command: Mapped[str] = mapped_column(Text, nullable=False)
    target_port: Mapped[int] = mapped_column(Integer, nullable=False)

    # status: active | running | error
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="active",
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
    campaigns = relationship(
        "Campaign", back_populates="target", lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Target {self.name} ({self.project_path})>"
