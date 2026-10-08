"""Running configuration, model choice, and a judge connectivity check."""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services import model_settings
from app.services.eval_engine import eval_engine

router = APIRouter()


class ModelChoice(BaseModel):
    """Only the fields that are sent are changed."""

    eval_model: Optional[str] = Field(None, max_length=200, description="Judge, e.g. ollama/gemma3:4b")
    mutator_model: Optional[str] = Field(
        None, max_length=200, description="Attacker / mutator. Empty string means the same as the judge"
    )
    api_keys: Optional[dict[str, str]] = Field(
        None, description="Provider id -> API key. An empty string removes that key"
    )


class JudgeTest(BaseModel):
    model: Optional[str] = Field(None, max_length=200, description="Model to test. Default: the current judge")


@router.get("/config")
async def get_config():
    """Settings that affect scan results."""
    return {
        "eval_model": settings.DEFAULT_EVAL_MODEL,
        "mutator_model": settings.MUTATOR_MODEL or settings.DEFAULT_EVAL_MODEL,
        "max_payloads_per_category": settings.MAX_PAYLOADS_PER_CATEGORY,
        "max_concurrent_attacks": settings.MAX_CONCURRENT_ATTACKS,
        "cicd_fail_risk_threshold": settings.CICD_FAIL_RISK_THRESHOLD,
    }


@router.get("/models")
async def get_models():
    """
    The current judge and attacker models, the local models found on this
    machine (Ollama, Claude Code CLI), and the online providers with whether
    each has an API key. Keys themselves are never returned.
    """
    return await model_settings.overview()


@router.post("/models")
async def choose_models(choice: ModelChoice):
    """
    Choose the judge and attacker models and save API keys. Takes effect at
    once for new scans and is remembered across restarts. An online model is
    refused until its provider has a key.
    """
    try:
        model_settings.save(choice.eval_model, choice.mutator_model, choice.api_keys)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await model_settings.overview()


@router.post("/judge-test")
async def test_judge(body: Optional[JudgeTest] = None):
    """Send one tiny request to a model and report whether it answered."""
    model = (body.model if body and body.model else None) or settings.DEFAULT_EVAL_MODEL
    missing = model_settings.missing_key_for(model)
    if missing:
        return {
            "success": False,
            "model": model,
            "message": f"{model_settings.PROVIDERS[missing]['name']} needs an API key before this model can be used.",
        }
    ok, detail = await eval_engine.check_judge(model)
    return {
        "success": ok,
        "model": model,
        "message": f"{model} answered." if ok else f"No answer — {detail}",
    }
