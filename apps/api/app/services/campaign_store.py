"""Persist AttackEngine output onto a Campaign row."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db.campaign import Campaign
from app.models.db.finding import Finding
from app.models.db.test_result import TestResult


def _as_uuid(value) -> uuid.UUID | None:
    if value is None:
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


async def persist_engine_results(
    db: AsyncSession,
    campaign: Campaign,
    results: dict,
) -> None:
    for res_data in results.get("results", []):
        db.add(
            TestResult(
                campaign_id=campaign.id,
                attack_id=_as_uuid(res_data.get("attack_id")),
                prompt_sent=res_data.get("prompt_sent") or "",
                model_response=res_data.get("model_response"),
                result=res_data.get("result") or "error",
                severity=res_data.get("severity"),
                confidence=res_data.get("confidence"),
                eval_reasoning=res_data.get("eval_reasoning"),
                attack_category=res_data.get("attack_category"),
                mutation_generation=res_data.get("mutation_generation", 0),
                meta_data=res_data.get("metadata") or {},
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
                evidence=find_data.get("evidence") or [],
                remediation=find_data.get("remediation"),
            )
        )

    campaign.status = results.get("status") or "completed"
    if campaign.status == "failed":
        campaign.description = results.get("error") or campaign.description
    campaign.total_tests = results.get("total_tests", campaign.total_tests)
    campaign.completed_tests = results.get("completed_tests", campaign.completed_tests)
    campaign.passed_tests = results.get("passed_tests", 0)
    campaign.failed_tests = results.get("failed_tests", 0)
    campaign.risk_score = results.get("risk_score", 0.0)
    await db.commit()
