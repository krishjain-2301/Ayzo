"""AYZO API entry point. Single local user, no login, loopback only."""

from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.config import settings
from app.core.database import engine, ensure_schema

# Import all models so ensure_schema() sees every table.
from app.models.db import user, target, campaign, test_result, finding  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[*] AYZO API v{settings.APP_VERSION} starting (local mode)...")
    db_display = settings.DATABASE_URL.split("///")[-1]
    print(f"[*] Database: {db_display}")

    added = await ensure_schema()
    if added:
        print(f"[*] Database upgraded, added columns: {', '.join(added)}")

    from app.services import model_settings

    if model_settings.apply_saved():
        print(f"[*] Judge model (from saved settings): {settings.DEFAULT_EVAL_MODEL}")

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
        "Local red teaming for LLM apps. Boots your app, attacks its chat "
        "endpoint, and reports which attacks worked."
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
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
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
