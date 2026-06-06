"""
Security Utilities
==================
Handles JWT token creation and verification.

How auth works in AYZO:
1. User clicks "Sign in with Google" on the frontend
2. Google confirms their identity and sends us their profile
3. We create a JWT token containing their user ID and role
4. Frontend stores this token and sends it with every API request
5. This module verifies that token is valid and extracts the user info

JWT = JSON Web Token
- It's a base64-encoded string with 3 parts: header.payload.signature
- The signature proves WE created it (nobody can fake it without our SECRET_KEY)
- The payload contains: user_id, email, role, expiration time

FIX: JWKS cache now has a 1-hour TTL so Supabase key rotations are picked up
automatically instead of requiring a server restart.
"""

import json
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt

from app.core.config import settings


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Creates a JWT token.

    Args:
        data: Dictionary with claims to encode (e.g., {"sub": user_id, "role": "admin"})
        expires_delta: How long until this token expires

    Returns:
        A signed JWT string like "eyJhbGciOiJIUzI1NiIs..."
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


# ---------------------------------------------------------------------------
# JWKS cache with TTL
# ---------------------------------------------------------------------------

# Cache stores the raw JWKS payload plus a timestamp so we know when to refresh.
# Structure: {"keys": [...], "fetched_at": <unix float>}
_jwks_cache: Optional[dict] = None

# Supabase rotates keys infrequently; 1 hour avoids a network hit on every
# request while ensuring stale keys are detected within a reasonable window.
_JWKS_CACHE_TTL_SECONDS = 3600


def _jwks_cache_is_valid() -> bool:
    """Return True if the in-memory cache exists and is younger than the TTL."""
    if _jwks_cache is None:
        return False
    age = time.monotonic() - _jwks_cache.get("fetched_at", 0)
    return age < _JWKS_CACHE_TTL_SECONDS


def _fetch_and_cache_jwks() -> Optional[dict]:
    """
    Fetch the JWKS document from Supabase, store it in the module-level cache
    with a timestamp, and return the raw data.

    Returns None on failure — callers should fall back to the stale cache if
    available rather than hard-failing every request.
    """
    global _jwks_cache

    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        print("ERROR: SUPABASE_URL or SUPABASE_ANON_KEY not set; cannot fetch JWKS")
        return None

    try:
        url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        req = urllib.request.Request(
            url,
            headers={
                "apikey": settings.SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_ANON_KEY}",
            },
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))

        _jwks_cache = {**data, "fetched_at": time.monotonic()}
        print("Successfully fetched and cached JWKS from Supabase")
        return data

    except Exception as exc:
        print(f"ERROR: Failed to fetch JWKS from Supabase: {exc}")
        return None


def get_jwk_by_kid(kid: str) -> Optional[dict]:
    """
    Return the JWK matching `kid`.

    Lookup order:
    1. Valid in-memory cache  →  return immediately (fast path)
    2. Cache expired / missing  →  fetch fresh JWKS, then search
    3. Fetch failed  →  fall back to stale cache rather than hard-failing
    4. `kid` not found anywhere  →  return None
    """
    global _jwks_cache

    # Fast path — cache is fresh
    if _jwks_cache_is_valid():
        for key in _jwks_cache.get("keys", []):
            if key.get("kid") == kid:
                return key

    # Cache is stale or absent — refresh
    fresh = _fetch_and_cache_jwks()

    if fresh is not None:
        for key in fresh.get("keys", []):
            if key.get("kid") == kid:
                return key
    elif _jwks_cache is not None:
        # Refresh failed but we have stale data — better than nothing
        print("WARNING: Using stale JWKS cache because refresh failed")
        for key in _jwks_cache.get("keys", []):
            if key.get("kid") == kid:
                return key

    return None


# ---------------------------------------------------------------------------
# Token verification
# ---------------------------------------------------------------------------

def verify_token(token: str) -> Optional[dict]:
    """
    Verifies a JWT token and extracts the payload.
    Supports three token flavours in priority order:

    1. Asymmetric ES256 tokens issued by modern Supabase projects (JWKS).
    2. Symmetric HS256 tokens issued by legacy Supabase projects.
    3. Locally-created HS256 tokens (AYZO custom auth).

    Security note: path 3 only runs when SUPABASE_JWT_SECRET is not set.
    If you use Supabase, always set SUPABASE_JWT_SECRET so locally-forged
    tokens are rejected.
    """
    try:
        header = jwt.get_unverified_header(token)
    except Exception as exc:
        print(f"DEBUG: Could not parse token header: {exc}")
        return None

    alg = header.get("alg")
    kid = header.get("kid")

    try:
        # ------------------------------------------------------------------
        # Path 1 – modern Supabase (ES256 + JWKS)
        # ------------------------------------------------------------------
        if alg == "ES256":
            jwk = get_jwk_by_kid(kid)
            if jwk is None:
                print(f"JWT Verification Error: No JWK found for kid={kid}")
                return None
            payload = jwt.decode(
                token,
                key=jwk,
                algorithms=["ES256"],
                audience="authenticated",
            )
            return payload

        # ------------------------------------------------------------------
        # Path 2 – legacy Supabase (HS256 with SUPABASE_JWT_SECRET)
        # ------------------------------------------------------------------
        if settings.SUPABASE_JWT_SECRET:
            try:
                payload = jwt.decode(
                    token,
                    settings.SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    audience="authenticated",
                )
                return payload
            except JWTError:
                pass  # Fall through to path 3

        # ------------------------------------------------------------------
        # Path 3 – local AYZO auth (only when Supabase is not configured)
        # ------------------------------------------------------------------
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload

    except JWTError as exc:
        print(f"JWT Verification Error: {exc}")
        return None
