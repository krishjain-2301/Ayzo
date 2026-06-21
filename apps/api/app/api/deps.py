"""
API Dependencies — Local Mode
==============================
No auth in local mode. Every request is treated as the single local user.
If the local user doesn't exist yet in the DB, it's created automatically on
first request.
"""

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.core.database import get_db
from app.models.db.user import User

# Fixed UUID for the single local user — stable across restarts
LOCAL_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


async def get_current_user(
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Returns the single local user. Creates them on first run.
    No tokens, no auth headers — just works.
    """
    result = await db.execute(select(User).where(User.id == LOCAL_USER_ID))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            id=LOCAL_USER_ID,
            email="local@ayzo.local",
            name="Local User",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user


# Alias — kept so endpoints using get_current_admin still work without changes
async def get_current_admin(
    db: AsyncSession = Depends(get_db),
) -> User:
    return await get_current_user(db)
