"""
Cryptography Utilities
======================
Provides encrypt/decrypt helpers for sensitive values stored in the database
(currently: target API keys).

Encryption scheme:
- Algorithm: Fernet (AES-128-CBC + HMAC-SHA256), from the `cryptography` package
- Key derivation: PBKDF2-HMAC-SHA256 with a fixed salt, derived from SECRET_KEY
  so no extra configuration variable is needed

Usage:
    from app.core.crypto import encrypt_api_key, decrypt_api_key

    encrypted = encrypt_api_key("sk-...")      # store this in the DB
    plaintext = decrypt_api_key(encrypted)     # use this for HTTP calls

Important:
- Encrypted values are base64url strings prefixed with "fernet:".
  The prefix lets us detect legacy plaintext values that were stored before
  this fix was deployed, and pass them through unchanged so existing targets
  keep working. Remove this compatibility shim once all rows are migrated.
- Changing SECRET_KEY will invalidate all existing encrypted values.
  Run a migration to re-encrypt if you rotate the key.
"""

import base64
import hashlib
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

# ---------------------------------------------------------------------------
# Key derivation
# ---------------------------------------------------------------------------

_FERNET_KEY: Optional[bytes] = None


def _get_fernet() -> Fernet:
    """
    Derive a 32-byte Fernet key from SECRET_KEY using PBKDF2-HMAC-SHA256.
    The result is cached in a module-level variable so derivation only runs once.
    """
    global _FERNET_KEY
    if _FERNET_KEY is None:
        # PBKDF2 with a fixed salt — the salt doesn't need to be secret because
        # the entropy comes from SECRET_KEY.  We use a fixed salt so the same
        # key is always derived deterministically.
        raw = hashlib.pbkdf2_hmac(
            "sha256",
            settings.SECRET_KEY.encode(),
            b"ayzo-api-key-encryption-salt-v1",
            iterations=100_000,
            dklen=32,
        )
        _FERNET_KEY = base64.urlsafe_b64encode(raw)
    return Fernet(_FERNET_KEY)


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

_PREFIX = "fernet:"


def encrypt_api_key(plaintext: Optional[str]) -> Optional[str]:
    """
    Encrypt a plaintext API key string and return a "fernet:<token>" string
    safe to store in the database.

    Returns None if plaintext is None or empty.
    """
    if not plaintext:
        return None

    # Already encrypted — don't double-encrypt
    if plaintext.startswith(_PREFIX):
        return plaintext

    token = _get_fernet().encrypt(plaintext.encode()).decode()
    return f"{_PREFIX}{token}"


def decrypt_api_key(stored: Optional[str]) -> Optional[str]:
    """
    Decrypt a stored API key value.

    Handles three cases:
    1. None / empty → return None
    2. "fernet:<token>" → decrypt and return plaintext
    3. Plain string (legacy, pre-encryption) → return as-is with a warning

    Case 3 exists so that targets created before this fix was deployed
    continue to work. Run a one-off migration to encrypt all legacy rows
    once you have deployed this version.
    """
    if not stored:
        return None

    if stored.startswith(_PREFIX):
        token = stored[len(_PREFIX):]
        try:
            return _get_fernet().decrypt(token.encode()).decode()
        except InvalidToken:
            # Key rotation or corruption — log and return None rather than crash
            print("WARNING: Failed to decrypt API key (key rotation? corrupted token?)")
            return None

    # Legacy plaintext value — return as-is
    print(
        "WARNING: API key is stored in plaintext. "
        "Re-save this target to encrypt it."
    )
    return stored
