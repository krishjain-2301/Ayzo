"""
Scan queue
==========
Scans wait in a queue and run one at a time, in the order they were started.
One at a time because a scan already makes several requests in parallel, and
two scans sharing one local judge model only slow each other down.

The queue lives in memory, but the list of unfinished scans lives in the
database. When the API starts, every scan that was waiting or running is put
back in the queue, and a scan that was interrupted continues from the attacks
it had not yet sent (see campaign_runner).
"""

from __future__ import annotations

import asyncio
from typing import Optional

from sqlalchemy import select

from app.core.database import async_session_maker
from app.core.logging import get_logger
from app.models.db.campaign import Campaign

log = get_logger(__name__)

_queue: Optional[asyncio.Queue] = None
_worker: Optional[asyncio.Task] = None


def enqueue(campaign_id: str) -> None:
    """Add a scan to the queue. Called by the endpoints that create scans."""
    if _queue is None:
        raise RuntimeError("The scan queue has not been started.")
    _queue.put_nowait(str(campaign_id))


def waiting() -> int:
    return _queue.qsize() if _queue else 0


async def _run_forever() -> None:
    from app.services.campaign_runner import run_campaign_async

    assert _queue is not None
    while True:
        campaign_id = await _queue.get()
        try:
            await run_campaign_async(campaign_id)
        except Exception:  # the runner reports its own failures; this is the last resort
            log.exception("Scan %s crashed the runner", campaign_id)
        finally:
            _queue.task_done()


async def unfinished_campaign_ids() -> list[str]:
    """Scans that were waiting or running when the API last stopped, oldest first."""
    async with async_session_maker() as db:
        result = await db.execute(
            select(Campaign.id)
            .where(Campaign.status.in_(["pending", "running"]))
            .order_by(Campaign.created_at)
        )
        return [str(row) for row in result.scalars().all()]


async def start() -> int:
    """Start the worker and put unfinished scans back in the queue. Returns how many."""
    global _queue, _worker
    _queue = asyncio.Queue()
    resumed = await unfinished_campaign_ids()
    for campaign_id in resumed:
        _queue.put_nowait(campaign_id)
    _worker = asyncio.create_task(_run_forever())
    return len(resumed)


async def stop() -> None:
    global _worker
    if _worker:
        _worker.cancel()
        _worker = None
