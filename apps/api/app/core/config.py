"""
AYZO Configuration
==================
All app settings are loaded from environment variables (or .env file).
This means:
- No secrets in your code (safe to push to GitHub)
- Different settings for dev vs production
- Pydantic validates everything at startup (catches misconfigs early)

FIX: Added @model_validator that raises at startup when DEBUG=False and
SECRET_KEY is still the default insecure value.

FIX: Added SHIELD_FAIL_OPEN setting (default False) so the Blue Team
proxy fails CLOSED (safe) when its Shield LLM is unavailable.
"""

from pydantic_settings import BaseSettings
from pydantic import model_validator
from typing import Optional
from dotenv import load_dotenv

load_dotenv(".env", override=True)

_INSECURE_DEFAULT_KEY = "dev-secret-key-change-in-production"


class Settings(BaseSettings):
    """
    Central configuration for the AYZO API.

    Each field maps to an environment variable.
    Example: DATABASE_URL env var → settings.DATABASE_URL in Python.
    """

    # ---- App ----
    APP_NAME: str = "AYZO"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True  # Set to False in production!

    # ---- API ----
    API_PREFIX: str = "/api/v1"
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",   # Next.js dev server
        "http://127.0.0.1:3000",
    ]

    # ---- Database ----
    # SQLite for easy local dev; swap for PostgreSQL in .env
    DATABASE_URL: str = "sqlite+aiosqlite:///./ayzo_demo.db"

    # ---- Redis ----
    # Used by Celery for background job queue and the proxy traffic log
    REDIS_URL: str = "redis://localhost:6379/0"

    # ---- Auth / JWT ----
    # IMPORTANT: Generate a real secret before deploying to production:
    #   python -c "import secrets; print(secrets.token_hex(32))"
    SECRET_KEY: str = _INSECURE_DEFAULT_KEY
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # ---- Google OAuth ----
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    # ---- Supabase Auth ----
    SUPABASE_JWT_SECRET: Optional[str] = None
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None

    # ---- LLM / AI ----
    GEMINI_API_KEY: Optional[str] = None
    # Judge model — evaluates whether an attack bypassed the target
    DEFAULT_EVAL_MODEL: str = "ollama/llama3.2"
    # Mutator model — generates prompt variations.
    # Keep this separate from the eval model so a safety-tuned judge doesn't
    # refuse to mutate jailbreak payloads. Falls back to DEFAULT_EVAL_MODEL
    # when not set (see mutation_engine.py).
    MUTATOR_MODEL: Optional[str] = None
    MAX_CONCURRENT_ATTACKS: int = 5

    # ---- Blue Team Proxy ----
    # When True, the proxy forwards requests if the Shield LLM errors out
    # (fail-open). When False (default), it blocks on shield failure (fail-closed).
    # Fail-closed is the secure default for a security firewall.
    SHIELD_FAIL_OPEN: bool = False

    # ---- Celery ----
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ---- Validators ----
    @model_validator(mode="after")
    def _check_production_secret_key(self) -> "Settings":
        """
        Prevent deploying to production with the default, publicly-known
        SECRET_KEY. If DEBUG=False and the key is still the default, raise
        immediately at startup before any request is served.
        """
        if not self.DEBUG and self.SECRET_KEY == _INSECURE_DEFAULT_KEY:
            raise ValueError(
                "SECRET_KEY must be changed from the default before running in "
                "production (DEBUG=False). Generate one with:\n"
                "  python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return self

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


# Single instance used throughout the app:  from app.core.config import settings
settings = Settings()
