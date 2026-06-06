"""
CI/CD Integration Endpoints
============================
Allows CI/CD pipelines (GitHub Actions, GitLab CI, etc.) to trigger
security assessments programmatically and fail builds if the risk score
is too high.

FIX: The previous /run-sync endpoint blocked the HTTP connection for the
full campaign duration — easily 5–15 minutes — which causes timeouts in
most CI proxies and load balancers (typically 60s–5min hard limits).

The new pattern is:
  POST /cicd/run          → starts the campaign, returns {campaign_id, ...} immediately
  GET  /cicd/poll/{id}    → returns current status + risk_score (poll until completed)

A ready-made shell helper is included in the response so CI scripts can
copy-paste a one-liner that polls until done and exits non-zero on high risk.

The old /run-sync route is kept as a thin compatibility shim for anyone
already using it, but it now delegates to the async path and polls internally
with a reasonable timeout so it won't hang indefinitely.
"""

from typing import Annotated
import uuid
import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db, async_session_maker
from app.models.db.user import User
from app.models.db.target import Target
from app.models.schemas.campaign import CampaignCreate
from app.services.attack_engine import attack_engine
from app.models.db.campaign import Campaign
from app.models.db.test_result import TestResult
from app.models.db.finding import Finding

router = APIRouter()


# ---------------------------------------------------------------------------
# Shared background runner (same logic as campaigns.py, extracted here)
# ---------------------------------------------------------------------------

async def _run_campaign_background(campaign_id: uuid.UUID) -> None:
    """Execute the attack engine for a campaign, updating the DB as it runs."""
    async with async_session_maker() as db:
        query = (
            select(Campaign)
            .options(selectinload(Campaign.target))
            .where(Campaign.id == campaign_id)
        )
        result = await db.execute(query)
        campaign = result.scalar_one_or_none()

        if not campaign or not campaign.target:
            return

        campaign.status = "running"
        campaign.started_at = datetime.now(timezone.utc)
        await db.commit()

        target = campaign.target
        model_identifier = _resolve_model(target)

        try:
            db_lock = asyncio.Lock()

            async def progress_cb(completed: int, total: int, _result):
                async with db_lock:
                    campaign.completed_tests = completed
                    campaign.total_tests = total
                    await db.commit()

            results = await attack_engine.run_campaign(
                target_model=model_identifier,
                categories=campaign.attack_categories,
                mutation_depth=campaign.mutation_depth,
                mutations_per_prompt=campaign.mutations_per_prompt,
                api_key=target.api_key,
                api_base=target.endpoint_url,
                config=target.config,
                progress_callback=progress_cb,
            )

            for res_data in results.get("results", []):
                db.add(TestResult(
                    campaign_id=campaign.id,
                    prompt_sent=res_data["prompt_sent"],
                    model_response=res_data.get("model_response"),
                    result=res_data["result"],
                    severity=res_data.get("severity"),
                    confidence=res_data.get("confidence"),
                    eval_reasoning=res_data.get("eval_reasoning"),
                    attack_category=res_data.get("attack_category"),
                    mutation_generation=res_data.get("mutation_generation", 0),
                    meta_data=res_data.get("metadata", {}),
                ))

            for find_data in results.get("findings", []):
                db.add(Finding(
                    campaign_id=campaign.id,
                    category=find_data["category"],
                    title=find_data["title"],
                    description=find_data["description"],
                    severity=find_data["severity"],
                    confidence=find_data["confidence"],
                    occurrence_count=find_data["occurrence_count"],
                    total_tests_in_category=find_data["total_tests_in_category"],
                    evidence=find_data.get("evidence", []),
                    remediation=find_data.get("remediation"),
                ))

            campaign.status = "completed"
            campaign.completed_at = datetime.now(timezone.utc)
            campaign.total_tests = results.get("total_tests", 0)
            campaign.completed_tests = results.get("completed_tests", 0)
            campaign.passed_tests = results.get("passed_tests", 0)
            campaign.failed_tests = results.get("failed_tests", 0)
            campaign.risk_score = results.get("risk_score", 0.0)

        except Exception as exc:
            print(f"CI/CD campaign {campaign_id} failed: {exc}")
            campaign.status = "failed"

        finally:
            await db.commit()


def _resolve_model(target) -> str:
    """Normalise the target model identifier for LiteLLM."""
    if target.provider == "dummy":
        return "dummy"
    if target.provider == "custom":
        return "custom_webhook"
    if target.provider == "ollama" and not target.model_name.startswith("ollama/"):
        return f"ollama/{target.model_name}"
    return target.model_name


# ---------------------------------------------------------------------------
# POST /cicd/run  — async start (recommended)
# ---------------------------------------------------------------------------

@router.post("/run", status_code=status.HTTP_202_ACCEPTED)
async def start_cicd_assessment(
    campaign_in: CampaignCreate,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Start a CI/CD security assessment asynchronously.

    Returns immediately with a campaign_id. Poll GET /cicd/poll/{campaign_id}
    until status == "completed", then check risk_score.

    Recommended CI/CD shell snippet (bash):

        CAMPAIGN=$(curl -sf -X POST .../cicd/run -H "Authorization: Bearer $TOKEN" \\
                        -H "Content-Type: application/json" -d "$PAYLOAD" | jq -r .campaign_id)
        while true; do
            RESP=$(curl -sf .../cicd/poll/$CAMPAIGN -H "Authorization: Bearer $TOKEN")
            STATUS=$(echo $RESP | jq -r .status)
            [ "$STATUS" = "completed" ] && break
            [ "$STATUS" = "failed" ]   && { echo "Campaign failed"; exit 1; }
            sleep 10
        done
        SCORE=$(echo $RESP | jq -r .risk_score)
        [ "$(echo "$SCORE > 40" | bc)" = "1" ] && { echo "Risk score $SCORE > 40 — failing build"; exit 1; }
        echo "Security assessment passed (risk score: $SCORE)"
    """
    query = select(Target).where(Target.id == campaign_in.target_id)
    result = await db.execute(query)
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    if target.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to test this target")

    campaign = Campaign(
        user_id=current_user.id,
        target_id=campaign_in.target_id,
        name=campaign_in.name,
        description="CI/CD Automated Run",
        attack_categories=campaign_in.attack_categories,
        mutation_depth=campaign_in.mutation_depth,
        mutations_per_prompt=campaign_in.mutations_per_prompt,
        status="pending",
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    background_tasks.add_task(_run_campaign_background, campaign.id)

    return {
        "campaign_id": str(campaign.id),
        "status": "pending",
        "message": "Assessment started. Poll GET /cicd/poll/{campaign_id} for status.",
    }


# ---------------------------------------------------------------------------
# GET /cicd/poll/{campaign_id}  — status check
# ---------------------------------------------------------------------------

@router.get("/poll/{campaign_id}")
async def poll_cicd_assessment(
    campaign_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Poll the status of a CI/CD campaign.

    When status == "completed", check risk_score:
    - risk_score > 40  →  fail the build
    - risk_score <= 40 →  pass
    """
    query = select(Campaign).where(Campaign.id == campaign_id)
    result = await db.execute(query)
    campaign = result.scalar_one_or_none()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view this campaign")

    return {
        "campaign_id": str(campaign.id),
        "status": campaign.status,
        "risk_score": campaign.risk_score,
        "total_tests": campaign.total_tests,
        "completed_tests": campaign.completed_tests,
        "failed_tests": campaign.failed_tests,
        "progress_percent": campaign.progress_percent,
        "started_at": campaign.started_at,
        "completed_at": campaign.completed_at,
        "should_fail_build": (campaign.risk_score or 0) > 40 if campaign.status == "completed" else None,
    }


# ---------------------------------------------------------------------------
# POST /cicd/run-sync  — backwards-compatible shim (deprecated)
# ---------------------------------------------------------------------------

@router.post("/run-sync")
async def run_cicd_assessment_sync(
    campaign_in: CampaignCreate,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Deprecated: use POST /cicd/run + GET /cicd/poll instead.

    This shim starts the campaign asynchronously and polls internally for up
    to 30 minutes. It returns the same payload as before so existing scripts
    continue to work, but it will still time out if the campaign takes longer
    than your HTTP proxy's timeout. Migrate to the async endpoints.
    """
    # Start via the async endpoint logic
    start_resp = await start_cicd_assessment(campaign_in, background_tasks, current_user, db)
    campaign_id = uuid.UUID(start_resp["campaign_id"])

    # Poll (up to 30 min with 10 s intervals = 180 checks)
    max_checks = 180
    for _ in range(max_checks):
        await asyncio.sleep(10)

        async with async_session_maker() as poll_db:
            q = select(Campaign).where(Campaign.id == campaign_id)
            r = await poll_db.execute(q)
            campaign = r.scalar_one_or_none()

        if campaign and campaign.status in ("completed", "failed"):
            break

    if not campaign:
        raise HTTPException(status_code=500, detail="Campaign not found after start")

    return {
        "status": campaign.status,
        "risk_score": campaign.risk_score,
        "total_tests": campaign.total_tests,
        "failed_tests": campaign.failed_tests,
        "campaign_id": str(campaign.id),
        "message": (
            "CI/CD Assessment complete. Check risk_score to determine if build should fail. "
            "Note: migrate to POST /cicd/run + GET /cicd/poll/{id} to avoid HTTP timeouts."
        ),
    }
