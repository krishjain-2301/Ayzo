import asyncio
from app.core.database import Base, engine
from app.models.db.target import Target
from app.models.db.user import User
from app.models.db.campaign import Campaign
from app.models.db.attack import Attack
from app.models.db.test_result import TestResult
from app.models.db.finding import Finding

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

if __name__ == "__main__":
    asyncio.run(init_db())
    print("Database recreated successfully.")
