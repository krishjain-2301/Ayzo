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


# CORS — allow the local Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
