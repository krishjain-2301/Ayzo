"""Seed a built-in vulnerable target so the dashboard works on first run."""

from __future__ import annotations

import sys
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db.target import Target
from app.models.db.user import User

BUILTIN_DUMMY_ID = uuid.UUID("00000000-0000-0000-0000-0000000000d1")
BUILTIN_APP_DUMMY_ID = uuid.UUID("00000000-0000-0000-0000-0000000000d2")


def _repo_root() -> Path:
    # apps/api/app/services/seed.py → Ayzo/
    return Path(__file__).resolve().parents[4]


async def seed_builtin_targets(db: AsyncSession, user: User) -> None:
    dummy_dir = _repo_root() / "dummy_target"
    api_dir = _repo_root() / "apps" / "api"

    existing = await db.execute(
        select(Target).where(Target.id.in_([BUILTIN_DUMMY_ID, BUILTIN_APP_DUMMY_ID]))
    )
    have = {row.id for row in existing.scalars().all()}

    if BUILTIN_DUMMY_ID not in have and dummy_dir.is_dir():
        db.add(
            Target(
                id=BUILTIN_DUMMY_ID,
                user_id=user.id,
                name="Vulnerable Dummy App",
                description=(
                    "Bundled insecure chat server (dummy_target). "
                    "AYZO will boot it on port 5000 for assessments."
                ),
                project_path=str(dummy_dir),
                start_command=f'"{sys.executable}" app.py',
                target_port=5000,
                status="active",
            )
        )

    if BUILTIN_APP_DUMMY_ID not in have and api_dir.is_dir():
        db.add(
            Target(
                id=BUILTIN_APP_DUMMY_ID,
                user_id=user.id,
                name="Vulnerable Support Bot",
                description=(
                    "Built-in dummy chat on this API: POST /api/v1/dummy/chat. "
                    "No extra process — the AYZO API is already listening."
                ),
                project_path=str(api_dir),
                start_command="already-running",
                target_port=8000,
                status="active",
            )
        )

    await db.commit()
