"""
Structured logging for the API runtime.

One line per event, each tagged with the scan it belongs to, so a scan can be
followed end to end in a shared log (CI, or two scans queued back to back).
Call `setup_logging()` once at startup; everywhere else use `get_logger(__name__)`.

CLI tools (cli.py, judge_bench, practice_check) print to a console for a person
and deliberately do not use this.
"""

from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Iterator

# The scan currently being run, if any. Set per scan in campaign_runner so every
# log line emitted while it runs carries its id without being passed one.
_scan_id: ContextVar[str] = ContextVar("scan_id", default="-")

_CONFIGURED = False


class _ScanIdFilter(logging.Filter):
    """Attach the current scan id to every record so the format can show it."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.scan_id = _scan_id.get()
        return True


def setup_logging() -> None:
    """Configure the `app` logger once. Level comes from AYZO_LOG_LEVEL (default INFO)."""
    global _CONFIGURED
    if _CONFIGURED:
        return
    level = os.getenv("AYZO_LOG_LEVEL", "INFO").upper()
    handler = logging.StreamHandler()
    handler.addFilter(_ScanIdFilter())
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)-7s [scan=%(scan_id)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )
    app_logger = logging.getLogger("app")
    app_logger.setLevel(level)
    app_logger.handlers = [handler]
    app_logger.propagate = False
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """A logger under the `app` namespace. `name` is usually `__name__`."""
    if not name.startswith("app"):
        name = f"app.{name}"
    return logging.getLogger(name)


@contextmanager
def scan_context(campaign_id: str) -> Iterator[None]:
    """Tag every log line emitted inside this block with the given scan id."""
    token = _scan_id.set(str(campaign_id)[:8])
    try:
        yield
    finally:
        _scan_id.reset(token)
