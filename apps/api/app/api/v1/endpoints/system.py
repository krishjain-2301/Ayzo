"""Read-only view of the running configuration, plus a judge connectivity check."""

from fastapi import APIRouter

from app.core.config import settings
from app.services.eval_engine import eval_engine

router = APIRouter()


@router.get("/config")
async def get_config():
    """Settings that affect scan results. Values come from apps/api/.env."""
    return {
        "eval_model": settings.DEFAULT_EVAL_MODEL,
        "mutator_model": settings.MUTATOR_MODEL or settings.DEFAULT_EVAL_MODEL,
        "max_payloads_per_category": settings.MAX_PAYLOADS_PER_CATEGORY,
        "max_concurrent_attacks": settings.MAX_CONCURRENT_ATTACKS,
        "cicd_fail_risk_threshold": settings.CICD_FAIL_RISK_THRESHOLD,
    }


@router.post("/judge-test")
async def test_judge():
    """Send one tiny request to the judge model and report whether it answered."""
    ok, detail = await eval_engine.check_judge()
    return {
        "success": ok,
        "model": settings.DEFAULT_EVAL_MODEL,
        "message": f"Judge {detail} answered." if ok else f"Judge unreachable — {detail}",
    }
