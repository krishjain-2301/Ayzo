"""
Database Connection Setup
=========================
This module creates the connection to PostgreSQL and provides
a "session" that API endpoints use to read/write data.

Key concepts:
- Engine: The actual connection pool to PostgreSQL
- Session: A temporary "conversation" with the database
- Base: The parent class that all our database models inherit from

We use ASYNC here because:
- When endpoint A is waiting for a database query, the server can
  handle endpoint B's request instead of sitting idle.
- This is critical when running thousands of attack tests.
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


# ---- Create the async engine (connection pool) ----
# `echo=True` in debug mode prints all SQL queries to the console
# (helpful for learning what's happening under the hood!)
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=20,        # Keep 20 connections ready
    max_overflow=10,     # Allow 10 extra connections during spikes
)

# ---- Session factory ----
# Each API request gets its own session (isolated database conversation)
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Don't expire objects after commit
)


# ---- Base class for all database models ----
# Every table we create (users, campaigns, etc.) will inherit from this
class Base(DeclarativeBase):
    pass


# ---- Dependency for FastAPI ----
# This is a "dependency injection" pattern. FastAPI calls this function
# automatically for any endpoint that needs database access.
# The `yield` means: create a session, give it to the endpoint,
# and when the endpoint is done, close the session cleanly.
async def get_db() -> AsyncSession:
    """
    Provides a database session to API endpoints.
    
    Usage in an endpoint:
        @router.get("/users")
        async def list_users(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(User))
            return result.scalars().all()
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
