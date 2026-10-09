"""
Campaign execution, shared by the dashboard and the CI endpoints.

Boot (optional) -> discover the chat endpoint -> check the judge ->
run attacks, saving each result as it arrives -> findings and score -> teardown.
"""

from __future__ import annotations

import asyncio
import random
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import async_session_maker
from app.core.secretbox import decrypt_map
from app.models.db.campaign import Campaign
from app.models.db.finding import Finding
from app.models.db.target import Target
from app.models.db.test_result import TestResult
from app.services.attack_engine import attack_engine
from app.services.eval_engine import eval_engine
from app.services.http_target import discover_chat_endpoint
from app.services.rule_attacks import generate_rule_tests
from app.services.access_attacks import generate_access_tests
from app.services.tool_attacks import generate_tool_tests
from app.services.process_target import (
    boot_target,
    read_boot_log,
    should_skip_boot,
    stop_target,
    wait_for_port,
)


# Campaign ids the user asked to stop. Scans run in this process, so a set is enough.
CANCEL_REQUESTED: set[str] = set()


def request_cancel(campaign_id: str) -> None:
    CANCEL_REQUESTED.add(str(campaign_id))


def build_run_config(seed: int | None, trials: int, adaptive_rounds: int = 0) -> dict:
    """What a scan was run with, so it can be repeated and its numbers explained."""
    return {
        "seed": seed if seed is not None else random.randint(0, 2**31 - 1),
        "trials": trials,
        "adaptive_rounds": adaptive_rounds,
        "judge_model": settings.DEFAULT_EVAL_MODEL,
        "attacker_model": settings.MUTATOR_MODEL or settings.DEFAULT_EVAL_MODEL,
        "max_payloads_per_category": settings.MAX_PAYLOADS_PER_CATEGORY,
        "max_concurrent_attacks": settings.MAX_CONCURRENT_ATTACKS,
    }


def target_profile(target: Target) -> dict:
    """What the judge and the leak checks are allowed to know about the app."""
    return {
        "canaries": [c for c in (target.canaries or []) if isinstance(c, str) and c.strip()],
        "system_prompt": target.system_prompt,
        "expected_behavior": target.expected_behavior,
        "forbidden_tools": [t for t in (target.forbidden_tools or []) if isinstance(t, str)],
    }


def target_http_options(target: Target) -> dict:
    """How to talk to the app: the parts of the profile the HTTP client needs."""
    return {
        "headers": decrypt_map(target.request_headers),
        "request_field": target.request_field,
        "response_field": target.response_field,
        "extra_body": dict(target.extra_body or {}),
        "history_mode": target.history_mode or "client",
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
    status = summary.get("status")
    campaign.status = status if status in ("completed", "cancelled") else "failed"
    if campaign.status != "completed":
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

        if campaign_id in CANCEL_REQUESTED:
            CANCEL_REQUESTED.discard(campaign_id)
            campaign.status = "cancelled"
            campaign.description = "Cancelled before it started."
            campaign.completed_at = datetime.now(timezone.utc)
            await db.commit()
            return

        # Results already saved mean this scan was interrupted and is continuing.
        saved = (await db.execute(select(TestResult).where(TestResult.campaign_id == campaign.id))).scalars().all()
        prior_results = [
            {
                "attack_name": r.attack_name,
                "prompt_sent": r.prompt_sent,
                "model_response": r.model_response,
                "result": r.result,
                "severity": r.severity,
                "confidence": r.confidence,
                "eval_reasoning": r.eval_reasoning,
                "attack_category": r.attack_category,
                "mutation_generation": r.mutation_generation,
                "metadata": r.meta_data or {},
            }
            for r in saved
        ]
        if prior_results:
            print(f"[CAMPAIGN] Continuing after an interruption: {len(prior_results)} results already saved")

        campaign.status = "running"
        campaign.started_at = campaign.started_at or datetime.now(timezone.utc)
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

            http_options = target_http_options(target)
            discovered = await discover_chat_endpoint(
                f"http://127.0.0.1:{target.target_port}",
                extra_paths=[target.chat_path] if target.chat_path else None,
                timeout=min(settings.TARGET_TIMEOUT_SECONDS, 30),
                options=http_options,
            )
            if not discovered:
                await fail(
                    "No chat endpoint answered with a 2xx. Set the target's chat path and request field, "
                    "and add a request header if the app needs a key."
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

            extra_tests = []
            if "business_rules" in (campaign.attack_categories or []):
                rules = [r for r in (target.rules or []) if isinstance(r, str) and r.strip()]
                if not rules:
                    await fail(
                        "The Business Rules category needs rules on the target, and this target has none. "
                        "Add rules to the target or untick that category."
                    )
                    return
                extra_tests = await generate_rule_tests(rules)
            if "tool_abuse" in (campaign.attack_categories or []):
                forbidden = [t for t in (target.forbidden_tools or []) if isinstance(t, str) and t.strip()]
                if not forbidden:
                    await fail(
                        "The Tool Abuse category needs the target's list of tools a user must never trigger, "
                        "and this target has none. Add them to the target or untick that category."
                    )
                    return
                extra_tests += generate_tool_tests(forbidden)
            if "cross_user" in (campaign.attack_categories or []):
                others = [u for u in (target.other_users or []) if isinstance(u, str) and u.strip()]
                if not others:
                    await fail(
                        "The Cross-User Access category needs the target's list of other users, "
                        "and this target has none. Add them to the target or untick that category."
                    )
                    return
                extra_tests += generate_access_tests(others)

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
                http_options=http_options,
                timeout=settings.TARGET_TIMEOUT_SECONDS,
                extra_tests=extra_tests,
                trials=campaign.trials or 1,
                seed=(campaign.run_config or {}).get("seed"),
                adaptive_rounds=(campaign.run_config or {}).get("adaptive_rounds", 0),
                prior_results=prior_results,
                should_stop=lambda: campaign_id in CANCEL_REQUESTED,
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
            CANCEL_REQUESTED.discard(campaign_id)
            stop_target(process)
