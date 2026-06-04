"""
AYZO Configuration
==================
All app settings are loaded from environment variables (or .env file).
This means:
- No secrets in your code (safe to push to GitHub)
- Different settings for dev vs production
- Pydantic validates everything at startup (catches misconfigs early)
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    """
    Central configuration for the AYZO API.
    
    Each field maps to an environment variable.
    Example: `DATABASE_URL` env var → `settings.DATABASE_URL` in Python.
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
    # SQLite connection string for easy local demonstration
    DATABASE_URL: str = "sqlite+aiosqlite:///./ayzo_demo.db"

    # ---- Redis ----
    # Used by Celery for background job queue
    REDIS_URL: str = "redis://localhost:6379/0"

    # ---- Auth / JWT ----
    # SECRET_KEY is used to sign JWT tokens
    # In production, use a long random string (e.g. `openssl rand -hex 32`)
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # ---- Google OAuth ----
    # Get these from: https://console.cloud.google.com/apis/credentials
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    # ---- LLM / AI ----
    # API key for Gemini models (used by LiteLLM when model starts with "gemini/")
    GEMINI_API_KEY: Optional[str] = None
    # Default model for the evaluation engine (the "judge" that checks if attacks worked)
    DEFAULT_EVAL_MODEL: str = "ollama/llama3.2"
    # Model used by the mutation engine to generate prompt variants
    MUTATOR_MODEL: Optional[str] = None  # Falls back to DEFAULT_EVAL_MODEL if not set
    # How many attack prompts to run at the same time
    MAX_CONCURRENT_ATTACKS: int = 5

    # ---- Celery ----
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    class Config:
        # This tells Pydantic to read from a .env file
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


# Create a single settings instance used throughout the app
# Usage: `from app.core.config import settings`
settings = Settings()
