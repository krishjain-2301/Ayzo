"""
AYZO API — Main Application Entry Point (Local Mode)
======================================================
Auth, payments, and cloud services have been removed.
This runs fully locally — no accounts, no internet required.
"""

from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.config import settings
from app.core.database import engine, Base

# Import ALL models so Base.metadata.create_all() creates every table.
from app.models.db import user, target, campaign, test_result, finding, attack  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[*] AYZO API v{settings.APP_VERSION} starting (local mode)...")
    db_display = settings.DATABASE_URL.split("///")[-1]
    print(f"[*] Database: {db_display}")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[*] Database tables verified/created.")
    if settings.SECRET_KEY == "change-me-in-production":
        print("[!] SECRET_KEY is still the default. Set a unique value in apps/api/.env.")

    from app.services.campaign_recovery import recover_stale_campaigns

    recovered = await recover_stale_campaigns()
    if recovered:
        print(f"[*] Marked {recovered} stale campaign(s) as failed (previous run interrupted).")

    yield

    print("[*] AYZO API shutting down...")
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "AI Red Team & Vulnerability Assessment Platform. "
        "Runs fully locally — no accounts, no cloud, no limits."
    ),
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        return response


# CORS — allow the local Next.js dev server
_origins = [origin for origin in settings.CORS_ORIGINS if origin != "*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
app.add_middleware(SecurityHeadersMiddleware)


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "mode": "local",
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "version": settings.APP_VERSION,
        "mode": "local — no auth required",
        "docs": "/docs",
    }


from app.api.v1.router import api_router
app.include_router(api_router, prefix="/api/v1")
