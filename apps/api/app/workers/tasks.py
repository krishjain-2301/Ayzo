import uuid
import asyncio
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.workers.celery_app import celery_app
from app.core.database import async_session_maker
from app.core.crypto import decrypt_api_key
from app.models.db.campaign import Campaign
from app.models.db.test_result import TestResult
from app.models.db.finding import Finding
from app.services.attack_engine import attack_engine

async def _run_campaign_async(campaign_id: str):
    campaign_uuid = uuid.UUID(campaign_id)
    async with async_session_maker() as db:
        query = (
            select(Campaign)
            .options(selectinload(Campaign.target))
            .where(Campaign.id == campaign_uuid)
        )
        result = await db.execute(query)
        campaign = result.scalar_one_or_none()

        if not campaign or not campaign.target:
            return

        campaign.status = "running"
        campaign.started_at = datetime.now(timezone.utc)
        await db.commit()

        target = campaign.target
        model_identifier = target.model_name
        if target.provider == "dummy":
            model_identifier = "dummy"
        elif target.provider == "custom":
            model_identifier = "custom_webhook"
        elif target.provider == "ollama" and not model_identifier.startswith("ollama/"):
            model_identifier = f"ollama/{target.model_name}"

        raw_api_key = decrypt_api_key(target.api_key) if target.api_key else None

        try:
            db_lock = asyncio.Lock()

            async def progress_cb(completed: int, total: int, result: dict | None):
                async with db_lock:
                    campaign.completed_tests = completed
                    campaign.total_tests = total
                    await db.commit()

            results = await attack_engine.run_campaign(
                target_model=model_identifier,
                categories=campaign.attack_categories,
                mutation_depth=campaign.mutation_depth,
                mutations_per_prompt=campaign.mutations_per_prompt,
                api_key=raw_api_key,
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
            print(f"❌ Campaign failed: {exc}")
            campaign.status = "failed"

        finally:
            await db.commit()

@celery_app.task(name="run_campaign_task")
def run_campaign_task(campaign_id: str):
    asyncio.run(_run_campaign_async(campaign_id))
