"""
Database setup: async SQLAlchemy on a local SQLite file.

Schema changes are handled by `ensure_schema`, which creates missing tables
and adds missing nullable columns. That is enough for a single-user local
tool and avoids a migration framework.
"""

from typing import AsyncGenerator

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# timeout: wait for a competing writer instead of failing with "database is locked".
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"timeout": 30},
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


def _add_missing_columns(sync_conn) -> list[str]:
    inspector = inspect(sync_conn)
    added = []
    for table in Base.metadata.sorted_tables:
        existing = {col["name"] for col in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in existing:
                continue
            if not column.nullable:
                raise RuntimeError(
                    f"Column {table.name}.{column.name} is new and NOT NULL. "
                    "Delete the database file to recreate it."
                )
            ddl_type = column.type.compile(dialect=sync_conn.dialect)
            sync_conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {ddl_type}'))
            added.append(f"{table.name}.{column.name}")
    return added


async def ensure_schema() -> list[str]:
    """Create missing tables, then add columns that older databases lack."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        return await conn.run_sync(_add_missing_columns)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: one session per request, committed on success."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
