"""
Campaign execution, shared by the dashboard and the CI endpoints.

Boot (optional) -> discover the chat endpoint -> check the judge ->
run attacks, saving each result as it arrives -> findings and score -> teardown.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import async_session_maker
from app.models.db.campaign import Campaign
from app.models.db.finding import Finding
from app.models.db.target import Target
from app.models.db.test_result import TestResult
from app.services.attack_engine import attack_engine
from app.services.eval_engine import eval_engine
from app.services.http_target import discover_chat_endpoint
from app.services.process_target import (
    boot_target,
    read_boot_log,
    should_skip_boot,
    stop_target,
    wait_for_port,
)


def target_profile(target: Target) -> dict:
    """What the judge and the leak checks are allowed to know about the app."""
    return {
        "canaries": [c for c in (target.canaries or []) if isinstance(c, str) and c.strip()],
        "system_prompt": target.system_prompt,
        "expected_behavior": target.expected_behavior,
    }


def _result_row(campaign_id: uuid.UUID, res: dict) -> TestResult:
    return TestResult(
        campaign_id=campaign_id,
        attack_name=res.get("attack_name"),
        prompt_sent=res.get("prompt_sent") or "",
        model_response=res.get("model_response"),
        result=res.get("result") or "error",
        severity=res.get("severity"),
        confidence=res.get("confidence"),
        eval_reasoning=res.get("eval_reasoning"),
        attack_category=res.get("attack_category"),
        mutation_generation=res.get("mutation_generation", 0),
        meta_data=res.get("metadata") or {},
    )


def apply_engine_summary(campaign: Campaign, summary: dict) -> list[Finding]:
    """Copy the engine's totals onto the campaign row and build its findings."""
    campaign.status = "completed" if summary.get("status") == "completed" else "failed"
    if campaign.status == "failed":
        campaign.description = summary.get("error") or "Attack engine failed"
    campaign.completed_at = datetime.now(timezone.utc)
    campaign.total_tests = summary.get("total_tests", 0)
    campaign.completed_tests = summary.get("completed_tests", 0)
    campaign.passed_tests = summary.get("passed_tests", 0)
    campaign.failed_tests = summary.get("failed_tests", 0)
    campaign.error_tests = summary.get("error_tests", 0)
    campaign.inconclusive_tests = summary.get("inconclusive_tests", 0)
    campaign.risk_score = summary.get("risk_score")

    return [
        Finding(
            campaign_id=campaign.id,
            category=f["category"],
            title=f["title"],
            description=f["description"],
            severity=f["severity"],
            confidence=f["confidence"],
            occurrence_count=f["occurrence_count"],
            total_tests_in_category=f["total_tests_in_category"],
            evidence=f.get("evidence") or [],
            remediation=f.get("remediation"),
        )
        for f in summary.get("findings", [])
    ]


async def run_campaign_async(campaign_id: str) -> None:
    print(f"[CAMPAIGN] Starting {campaign_id}")
    async with async_session_maker() as db:
        result = await db.execute(
            select(Campaign)
            .options(selectinload(Campaign.target))
            .where(Campaign.id == uuid.UUID(campaign_id))
        )
        campaign = result.scalar_one_or_none()
        if not campaign:
            print("[CAMPAIGN] Campaign not found")
            return

        async def fail(reason: str) -> None:
            campaign.status = "failed"
            campaign.description = reason
            campaign.completed_at = datetime.now(timezone.utc)
            await db.commit()
            print(f"[CAMPAIGN] Failed: {reason}")

        campaign.status = "running"
        campaign.started_at = datetime.now(timezone.utc)
        await db.commit()

        target = campaign.target
        if not target:
            await fail("Target missing.")
            return

        process = None
        skip_boot = should_skip_boot(target.start_command)

        try:
            if not skip_boot:
                print(f"[CAMPAIGN] Booting '{target.start_command}' in {target.project_path}")
                process = await boot_target(target.start_command, target.project_path)

            if not await wait_for_port(target.target_port, timeout=30 if not skip_boot else 5):
                reason = f"Port {target.target_port} did not open"
                if skip_boot:
                    reason += " — is the app already running?"
                else:
                    log_tail = read_boot_log(process)
                    reason += " within 30 seconds." + (
                        f" Last output from the app:\n{log_tail}" if log_tail else ""
                    )
                await fail(reason)
                return

            discovered = await discover_chat_endpoint(
                f"http://127.0.0.1:{target.target_port}",
                extra_paths=[target.chat_path] if target.chat_path else None,
            )
            if not discovered:
                await fail(
                    "No chat endpoint answered with a 2xx. Set the target's chat path, "
                    "and check the app does not need a login or API key."
                )
                return
            print(f"[CAMPAIGN] Using {discovered.path} (body={discovered.body_style})")

            # Do not send a single attack if nothing can judge the replies.
            judge_ok, judge_detail = await eval_engine.check_judge()
            if not judge_ok:
                await fail(
                    f"The judge model is unreachable ({judge_detail}). No attacks were sent. "
                    "Set DEFAULT_EVAL_MODEL and its API key in apps/api/.env, or start Ollama."
                )
                return

            db_lock = asyncio.Lock()

            async def progress_cb(completed: int, total: int, res: dict):
                # Save every result as it arrives so a crash loses nothing.
                async with db_lock:
                    db.add(_result_row(campaign.id, res))
                    campaign.completed_tests = completed
                    campaign.total_tests = max(campaign.total_tests or 0, total)
                    if res.get("result") == "fail":
                        campaign.failed_tests = (campaign.failed_tests or 0) + 1
                    await db.commit()

            summary = await attack_engine.run_campaign(
                endpoint=discovered.url,
                body_style=discovered.body_style,
                categories=campaign.attack_categories,
                mutation_depth=campaign.mutation_depth,
                mutations_per_prompt=campaign.mutations_per_prompt,
                profile=target_profile(target),
                progress_callback=progress_cb,
            )

            db.add_all(apply_engine_summary(campaign, summary))
            await db.commit()
            print(
                f"[CAMPAIGN] {campaign.status} risk={campaign.risk_score} "
                f"fail={campaign.failed_tests}/{campaign.total_tests}"
            )

        except Exception as exc:
            import traceback

            traceback.print_exc()
            await db.rollback()
            await fail(f"Error during attack execution: {exc!r}")
        finally:
            stop_target(process)
