"""
Encryption for secrets AYZO stores on disk: provider API keys and the
request header of a target.

The key is a random file, apps/api/data/secret.key, created on first use and
git-ignored. This keeps secrets out of the database file, settings.json,
backups and screenshots. It does NOT protect against someone who can read
both the key file and the data: that needs an OS keychain, which AYZO does
not use yet. Stated here so nobody assumes more than is true.

Values written before encryption existed (no "enc:" prefix) are read as they
are, and are encrypted the next time they are saved.
"""

from __future__ import annotations

import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

KEY_FILE = Path(__file__).resolve().parents[2] / "data" / "secret.key"
PREFIX = "enc:"

_fernet: Fernet | None = None


def _box() -> Fernet:
    global _fernet
    if _fernet is None:
        if not KEY_FILE.exists():
            KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
            KEY_FILE.write_bytes(Fernet.generate_key())
            try:
                os.chmod(KEY_FILE, 0o600)
            except OSError:
                pass
        _fernet = Fernet(KEY_FILE.read_bytes().strip())
    return _fernet


def encrypt(value: str) -> str:
    if not value or value.startswith(PREFIX):
        return value
    return PREFIX + _box().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt(value: str) -> str:
    """Plain text for a stored value. An unreadable value comes back empty."""
    if not value or not value.startswith(PREFIX):
        return value
    try:
        return _box().decrypt(value[len(PREFIX):].encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return ""


def encrypt_map(values: dict | None) -> dict:
    return {name: encrypt(str(v)) for name, v in (values or {}).items()}


def decrypt_map(values: dict | None) -> dict:
    return {name: decrypt(str(v)) for name, v in (values or {}).items()}
