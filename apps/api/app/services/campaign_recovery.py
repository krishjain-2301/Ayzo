"""Mark interrupted campaigns when the API process restarts mid-run."""

from sqlalchemy import select

from app.core.database import async_session_maker
from app.models.db.campaign import Campaign


async def recover_stale_campaigns() -> int:
    """
    BackgroundTasks do not survive process restarts. Any campaign still
    pending/running was orphaned — mark it failed so the UI does not spin forever.
    """
    async with async_session_maker() as db:
        result = await db.execute(
            select(Campaign).where(Campaign.status.in_(["pending", "running"]))
        )
        stale = result.scalars().all()
        if not stale:
            return 0

        for campaign in stale:
            campaign.status = "failed"
            campaign.description = (
                "Interrupted: API restarted before the campaign finished. "
                "Start a new assessment to continue testing."
            )

        await db.commit()
        return len(stale)
