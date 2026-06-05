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
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt

from app.core.config import settings


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
    
    Example:
        token = create_access_token(
            data={"sub": "user-uuid-123", "email": "krish@gmail.com", "role": "admin"}
        )
    """
    to_encode = data.copy()

    # Set expiration time
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire})

    # Sign the token with our secret key
    # Only someone with SECRET_KEY can create valid tokens
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


import urllib.request
import json

_jwks_cache = None

def get_jwk_by_kid(kid: str) -> Optional[dict]:
    global _jwks_cache
    if _jwks_cache is not None:
        for key in _jwks_cache.get("keys", []):
            if key.get("kid") == kid:
                return key

    # Fetch JWKS from Supabase
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        print("ERROR: SUPABASE_URL or SUPABASE_ANON_KEY not set in Settings, cannot fetch JWKS")
        return None

    try:
        url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        req = urllib.request.Request(
            url,
            headers={
                "apikey": settings.SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_ANON_KEY}"
            }
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            _jwks_cache = json.loads(response.read().decode('utf-8'))
            print("Successfully fetched and cached JWKS from Supabase")
            
        for key in _jwks_cache.get("keys", []):
            if key.get("kid") == kid:
                return key
    except Exception as e:
        print(f"ERROR: Failed to fetch JWKS from Supabase: {e}")
        
    return None


def verify_token(token: str) -> Optional[dict]:
    """
    Verifies a JWT token and extracts the payload.
    Supports asymmetric (ES256/JWKS) Supabase tokens, legacy symmetric (HS256) Supabase tokens, and custom local tokens.
    """
    try:
        try:
            header = jwt.get_unverified_header(token)
            alg = header.get("alg")
            kid = header.get("kid")
        except Exception as e:
            print(f"DEBUG: Could not parse token header: {e}")
            return None

        # 1. Asymmetric verification for newer Supabase projects
        if alg == "ES256":
            jwk = get_jwk_by_kid(kid)
            if jwk is None:
                print(f"JWT Verification Error: Could not find JWK with kid {kid}")
                return None
            payload = jwt.decode(
                token,
                key=jwk,
                algorithms=["ES256"],
                audience="authenticated",
            )
            return payload

        # 2. Symmetric verification for legacy/symmetric Supabase projects
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
                pass
            
        # 3. Fallback to local custom auth
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError as e:
        print(f"JWT Verification Error: {e}")
        # Token is invalid or expired
        return None
