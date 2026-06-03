"""
AYZO API — Main Application Entry Point
========================================
This is where the FastAPI app is created and configured.

When you run: `uvicorn app.main:app --reload`
Python loads THIS file and starts serving the API.

Key things happening here:
1. Create the FastAPI app with metadata (title, description, version)
2. Set up CORS (Cross-Origin Resource Sharing) so the Next.js frontend
   can make requests to this API from a different port/domain
3. Register all API route groups (auth, targets, campaigns, etc.)
4. Add startup/shutdown event handlers (connect/disconnect from DB)
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine


# ---- Lifespan Events ----
# This runs code when the server starts and stops.
# We use it to test the database connection on startup.
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs on server startup and shutdown.
    
    Startup: Verify database connection is working
    Shutdown: Close database connection pool
    """
    # --- STARTUP ---
    print(f"🛡️  AYZO API v{settings.APP_VERSION} starting...")
    print(f"📊 Debug mode: {settings.DEBUG}")
    print(f"🗄️  Database: {settings.DATABASE_URL.split('@')[-1]}")  # Don't log password!
    
    yield  # App runs here
    
    # --- SHUTDOWN ---
    print("🛡️  AYZO API shutting down...")
    await engine.dispose()  # Close all database connections


# ---- Create the FastAPI App ----
app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "AI Red Team & Vulnerability Assessment Platform. "
        "Automatically tests AI models for security weaknesses "
        "and generates vulnerability reports."
    ),
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",        # Swagger UI at http://localhost:8000/docs
    redoc_url="/redoc",      # ReDoc at http://localhost:8000/redoc
)


# ---- CORS Middleware ----
# CORS = Cross-Origin Resource Sharing
# Without this, the browser would BLOCK requests from localhost:3000
# (Next.js) to localhost:8000 (FastAPI) because they're different "origins".
# This is a browser security feature — we're explicitly allowing our frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # Which domains can call our API
    allow_credentials=True,                # Allow cookies/auth headers
    allow_methods=["*"],                   # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],                   # Allow all headers
)


# ---- Health Check Endpoint ----
# This is a simple "is the server alive?" endpoint.
# Useful for monitoring, Docker health checks, and load balancers.
@app.get(
    "/health",
    tags=["Health"],
    summary="Check if the API is running",
)
async def health_check():
    """
    Returns the API status. If you can reach this, the server is alive.
    
    Used by:
    - Docker health checks
    - Monitoring dashboards
    - Frontend connection verification
    """
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


# ---- Root Endpoint ----
@app.get("/", tags=["Root"])
async def root():
    """Welcome message and API info."""
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
    }


# ---- API Routes ----
# These will be registered as we build each feature.
# Example: app.include_router(auth_router, prefix="/api/v1/auth")
# For now, we have the health check and root endpoints.
