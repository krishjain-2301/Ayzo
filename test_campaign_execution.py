import asyncio
import os
import sys
import uuid
from sqlalchemy import select

# Set up Django-style or Fastapi-style path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), "apps", "api"))

from app.core.database import async_session_maker
# Import User first to ensure SQLAlchemy registry registers it
from app.models.db.user import User
from app.models.db.campaign import Campaign
from app.services.hacker_agent import hacker_agent

async def main():
    # Find the last campaign ID
    async with async_session_maker() as db:
        query = select(Campaign).order_by(Campaign.created_at.desc()).limit(1)
        res = await db.execute(query)
        campaign = res.scalar_one_or_none()
        if not campaign:
            print("No campaign found to test!")
            return
        campaign_id = str(campaign.id)
        
    print(f"Testing execution for campaign: {campaign_id}")
    await hacker_agent.run_campaign_async(campaign_id)
    print("Done testing campaign execution!")

if __name__ == "__main__":
    asyncio.run(main())
