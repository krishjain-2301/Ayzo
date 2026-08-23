"""
AYZO Configuration — Local Mode
================================
All cloud/auth/payment settings removed.
Only what's needed to run locally remains.
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional, Union
from dotenv import load_dotenv
import json

load_dotenv(".env", override=True)


class Settings(BaseSettings):

    # ---- App ----
    APP_NAME: str = "AYZO"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    # Fernet key derivation for encrypt_api_key / decrypt_api_key (crypto.py)
    SECRET_KEY: str = "change-me-in-production"

    # ---- API ----
    API_PREFIX: str = "/api/v1"
    CORS_ORIGINS: Union[list[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, list]) -> list[str]:
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                try:
                    return json.loads(v)
                except json.JSONDecodeError:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # ---- Database ----
    # SQLite by default — zero setup required
    DATABASE_URL: str = "sqlite+aiosqlite:///./ayzo.db"

    # ---- LLM / AI ----
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    DEFAULT_EVAL_MODEL: str = "ollama/llama3.2"
    MUTATOR_MODEL: Optional[str] = None
    MAX_CONCURRENT_ATTACKS: int = 5
    # 0 = run every payload in selected categories
    MAX_PAYLOADS_PER_CATEGORY: int = 20
    CICD_FAIL_RISK_THRESHOLD: float = 40.0

    # ---- Blue Team Proxy ----
    SHIELD_FAIL_OPEN: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
