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


def verify_token(token: str) -> Optional[dict]:
    """
    Verifies a JWT token and extracts the payload.
    
    Args:
        token: The JWT string from the Authorization header
    
    Returns:
        The decoded payload dict if valid, None if invalid/expired
    
    Example:
        payload = verify_token("eyJhbGciOiJIUzI1NiIs...")
        if payload:
            user_id = payload["sub"]
            role = payload["role"]
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError:
        # Token is invalid or expired
        return None
