from fastapi import APIRouter

from app.api.v1.endpoints import (
    attacks,
    auth,
    campaigns,
    dummy,
    reports,
    targets,
    conversational,
    cicd,
    proxy,
)

api_router = APIRouter()

# Grouping all our endpoints under clean paths
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(targets.router, prefix="/targets", tags=["Targets"])
api_router.include_router(campaigns.router, prefix="/campaigns", tags=["Campaigns"])
api_router.include_router(attacks.router, prefix="/attacks", tags=["Attack Library"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(dummy.router, prefix="/dummy", tags=["Dummy Target"])
api_router.include_router(conversational.router, prefix="/conversational", tags=["Conversational"])
api_router.include_router(cicd.router, prefix="/cicd", tags=["CI/CD Integration"])
api_router.include_router(proxy.router, prefix="/proxy", tags=["Blue Team Proxy"])
