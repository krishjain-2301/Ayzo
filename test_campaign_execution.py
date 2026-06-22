import asyncio
import os
import sys

# -----------------------------------------------------------------------
# Critical: change working directory to apps/api BEFORE any app imports.
# The DATABASE_URL is "sqlite+aiosqlite:///./ayzo.db" — a relative path.
# SQLite resolves it relative to CWD, so we must be inside apps/api for
# the path to match the real database (same as when uvicorn runs it).
# -----------------------------------------------------------------------
_API_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "apps", "api")
os.chdir(_API_DIR)
sys.path.insert(0, _API_DIR)

from sqlalchemy import select, desc

from app.core.database import async_session_maker, Base, engine
# Import ALL models so Base.metadata knows every table
from app.models.db.user import User           # noqa: F401
from app.models.db.campaign import Campaign
from app.models.db.target import Target       # noqa: F401
from app.models.db.finding import Finding     # noqa: F401
from app.models.db.test_result import TestResult  # noqa: F401
from app.models.db.attack import Attack       # noqa: F401
from app.services.hacker_agent import hacker_agent


async def main():
    # Ensure all tables exist (idempotent — safe to run multiple times)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[*] Database tables verified.")

    # Find the most recent campaign
    async with async_session_maker() as db:
        query = select(Campaign).order_by(Campaign.created_at.desc()).limit(1)  # type: ignore
        res = await db.execute(query)  # type: ignore
        campaign = res.scalar_one_or_none()
        if not campaign:
            print("No campaign found to test! Create one via the UI or API first.")
            return
        campaign_id = str(campaign.id)

    print(f"[*] Testing execution for campaign: {campaign_id}")
    await hacker_agent.run_campaign_async(campaign_id)
    print("[*] Done testing campaign execution!")


if __name__ == "__main__":
    asyncio.run(main())
