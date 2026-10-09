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

from sqlalchemy import String, DateTime, Text, ForeignKey, Integer, JSON, Uuid
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

    # ---- Target profile: what AYZO knows about the app ----
    # Chat route to try first (e.g. /api/chat). Discovery still runs if unset.
    chat_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Strings that must never appear in a reply (keys, passwords, planted markers).
    canaries: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)
    # The app's system prompt, used only to detect verbatim leaks.
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Plain-language description of what the app should and should not do.
    expected_behavior: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Tools an ordinary user must never be able to trigger ("delete_user").
    forbidden_tools: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)
    # Rules the app must keep ("never give more than 10% off"). The Business
    # Rules category generates attacks against each one.
    rules: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)

    # ---- How to talk to the app (all optional; unset means discover it) ----
    # Headers sent with every request, e.g. {"Authorization": "Bearer ..."}.
    request_headers: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    # JSON field that carries the prompt, e.g. "question". "messages" = chat history.
    request_field: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Dotted path to the reply text, e.g. "data.answer".
    response_field: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Extra JSON fields added to every request, e.g. {"stream": true}.
    extra_body: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    # "client": AYZO sends the whole conversation each turn (default).
    # "server": the app remembers the session; AYZO sends only the new message.
    history_mode: Mapped[str | None] = mapped_column(String(10), nullable=True)

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
