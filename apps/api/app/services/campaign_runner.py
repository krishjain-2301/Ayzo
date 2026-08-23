"""
Shared campaign execution for the dashboard and CI/CD.

Boot (optional) → discover HTTP chat contract → YAML library + mutations
→ eval engine → persist results + calibrated risk score → teardown.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import async_session_maker
from app.models.db.campaign import Campaign
from app.models.db.finding import Finding
from app.models.db.test_result import TestResult
from app.services.attack_engine import attack_engine
from app.services.http_target import discover_chat_endpoint
from app.services.process_target import boot_target, kill_process, should_skip_boot, wait_for_port


async def persist_engine_output(db, campaign: Campaign, results: dict) -> None:
    for res_data in results.get("results", []):
        db.add(
            TestResult(
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
            )
        )

    for find_data in results.get("findings", []):
        db.add(
            Finding(
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
            )
        )

    campaign.status = results.get("status", "completed")
    if campaign.status != "failed":
        campaign.status = "completed"
    campaign.completed_at = datetime.now(timezone.utc)
    campaign.total_tests = results.get("total_tests", 0)
    campaign.completed_tests = results.get("completed_tests", 0)
    campaign.passed_tests = results.get("passed_tests", 0)
    campaign.failed_tests = results.get("failed_tests", 0)
    campaign.risk_score = results.get("risk_score", 0.0)


async def run_campaign_async(campaign_id: str) -> None:
    print(f"[CAMPAIGN] Starting {campaign_id}")
    async with async_session_maker() as db:
        query = (
            select(Campaign)
            .options(selectinload(Campaign.target))
            .where(Campaign.id == uuid.UUID(campaign_id))
        )
        result = await db.execute(query)
        campaign = result.scalar_one_or_none()
        if not campaign:
            print("[CAMPAIGN] Campaign not found")
            return

        campaign.status = "running"
        campaign.started_at = datetime.now(timezone.utc)
        await db.commit()

        target = campaign.target
        if not target:
            campaign.status = "failed"
            campaign.description = "Target missing."
            await db.commit()
            return

        process = None
        skip_boot = should_skip_boot(target.start_command)

        try:
            if not skip_boot:
                print(
                    f"[CAMPAIGN] Booting `{target.start_command}` in {target.project_path}"
                )
                process = await boot_target(target.start_command, target.project_path)

            port_open = await wait_for_port(target.target_port, timeout=30 if not skip_boot else 5)
            if not port_open:
                campaign.status = "failed"
                campaign.description = (
                    f"Port {target.target_port} did not open"
                    + (" within 30 seconds." if not skip_boot else " — is the app already running?")
                )
                await db.commit()
                return

            base_url = f"http://127.0.0.1:{target.target_port}"
            discovered = await discover_chat_endpoint(base_url)
            if not discovered:
                campaign.status = "failed"
                campaign.description = (
                    "No chat endpoint discovered. AYZO probes common paths "
                    "(/api/chat, /v1/chat/completions, /prompt, …) with several JSON bodies."
                )
                db.add(
                    Finding(
                        campaign_id=campaign.id,
                        category="recon",
                        title="No LLM Endpoint Discovered",
                        description=campaign.description,
                        severity="low",
                        confidence=1.0,
                        occurrence_count=1,
                        total_tests_in_category=1,
                    )
                )
                campaign.total_tests = 1
                campaign.completed_tests = 1
                campaign.risk_score = 0.0
                await db.commit()
                return

            print(
                f"[CAMPAIGN] Discovered {discovered.path} "
                f"(body={discovered.body_style}, HTTP {discovered.status_code})"
            )

            db_lock = asyncio.Lock()

            async def progress_cb(completed: int, total: int, _result):
                async with db_lock:
                    campaign.completed_tests = completed
                    campaign.total_tests = max(campaign.total_tests or 0, total)
                    await db.commit()

            engine_results = await attack_engine.run_campaign(
                target_model="http-target",
                categories=campaign.attack_categories,
                mutation_depth=campaign.mutation_depth,
                mutations_per_prompt=campaign.mutations_per_prompt,
                config={
                    "http_endpoint": discovered.url,
                    "http_body_style": discovered.body_style,
                    "timeout": 60,
                },
                progress_callback=progress_cb,
            )

            if engine_results.get("status") == "failed":
                campaign.status = "failed"
                campaign.description = engine_results.get("error", "Attack engine failed")
                await db.commit()
                return

            await persist_engine_output(db, campaign, engine_results)
            await db.commit()
            print(
                f"[CAMPAIGN] Complete risk={campaign.risk_score} "
                f"fail={campaign.failed_tests}/{campaign.total_tests}"
            )

        except Exception as exc:
            import traceback

            traceback.print_exc()
            campaign.status = "failed"
            campaign.description = f"Error during attack execution: {repr(exc)}"
            await db.commit()
        finally:
            if process:
                kill_process(process.pid)
