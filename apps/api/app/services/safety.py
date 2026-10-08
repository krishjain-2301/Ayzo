"""Input checks for local boot, uploads, and judge prompts."""

from __future__ import annotations

import os
import re
import shlex
from pathlib import Path
from urllib.parse import urlparse

LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}
_SHELL_META = re.compile(r"[&|;`$<>(){}!\n\r\x00]")
_SAFE_TOKEN = re.compile(r"^[\w./:\\-]+$")
_CATEGORY = re.compile(r"^[a-z0-9_]{1,64}$")


def assert_loopback_url(url: str) -> str:
    """Allow HTTP only to this machine. Blocks SSRF to other hosts."""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "http" or host not in LOOPBACK_HOSTS:
        raise ValueError("Target URL must be http://127.0.0.1")
    if parsed.port is None or not (1 <= parsed.port <= 65535):
        raise ValueError("Target port is invalid")
    return url


def assert_port(port: int) -> int:
    if not isinstance(port, int) or not (1 <= port <= 65535):
        raise ValueError("Port must be between 1 and 65535")
    return port


def safe_argv(start_command: str) -> list[str]:
    """
    Turn a start command into argv.

    Shell metacharacters are rejected so a command cannot chain extra programs.
    `..` is rejected so the process cannot step outside the project directory.
    """
    command = (start_command or "").strip()
    if not command or len(command) > 200:
        raise ValueError("Start command is missing or too long")
    if _SHELL_META.search(command) or ".." in command:
        raise ValueError(
            "Start command cannot contain shell operators or '..'. "
            "Use a single program, for example: python app.py"
        )
    argv = shlex.split(command, posix=False) if os.name == "nt" else shlex.split(command)
    if not argv:
        raise ValueError("Start command is empty")
    for token in argv:
        if not _SAFE_TOKEN.match(token):
            raise ValueError(f"Start command has an unsupported token: {token[:40]}")
    return argv


def safe_relative_upload(filename: str) -> Path:
    """Map an uploaded filename to a path that stays inside the upload folder."""
    raw = (filename or "").replace("\\", "/").strip()
    if not raw or "\x00" in raw or raw.startswith("/") or ":" in raw:
        raise ValueError("Upload path is not allowed")
    parts = [part for part in raw.split("/") if part not in ("", ".")]
    if not parts or any(part == ".." for part in parts):
        raise ValueError("Upload path is not allowed")
    if any(len(part) > 180 for part in parts) or len(parts) > 12:
        raise ValueError("Upload path is too deep")
    return Path(*parts)


def fence_untrusted(label: str, text: str, limit: int = 6000) -> str:
    """Wrap model or user text so it cannot be read as judge instructions."""
    body = (text or "").replace("</untrusted>", "")[:limit]
    return f"<untrusted_{label}>\n{body}\n</untrusted_{label}>"


def regex_hits(pattern: str, text: str) -> bool:
    """Match a user-supplied pattern with a length cap to limit ReDoS."""
    if not pattern or len(pattern) > 200:
        return False
    sample = (text or "")[:20_000]
    try:
        compiled = re.compile(pattern, flags=re.IGNORECASE | re.DOTALL)
    except re.error:
        return False
    return compiled.search(sample) is not None


def assert_categories(categories: list[str]) -> list[str]:
    if not categories or len(categories) > 20:
        raise ValueError("Choose between 1 and 20 attack categories")
    cleaned = []
    for category in categories:
        name = (category or "").strip().lower()
        if not _CATEGORY.match(name):
            raise ValueError("Attack category names must be lowercase identifiers")
        cleaned.append(name)
    return cleaned
