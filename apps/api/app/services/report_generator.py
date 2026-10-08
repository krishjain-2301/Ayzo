"""
Report Generator
================
Turns a campaign's stored results and findings into the JSON the dashboard
and the printable export render.
"""

import uuid
from datetime import datetime, timezone

from app.attack_library.loader import get_available_categories
from app.services.attack_engine import SEVERITY_ORDER, risk_level


class ReportGenerator:
    def generate_report(
        self,
        campaign_data: dict,
        target_data: dict,
        results: list[dict],
        findings: list[dict],
    ) -> dict:
        tally = {"pass": 0, "fail": 0, "error": 0, "inconclusive": 0}
        for r in results:
            key = r.get("result")
            tally[key if key in tally else "inconclusive"] += 1
        total = len(results)
        judged = tally["pass"] + tally["fail"]

        risk_score = campaign_data.get("risk_score")
        port = target_data.get("target_port")

        return {
            "id": str(uuid.uuid4()),
            "campaign_id": str(campaign_data.get("id")),
            "campaign_name": campaign_data.get("name", "Unknown Campaign"),
            "target_name": target_data.get("name", "Unknown Target"),
            "target_model": f"http://127.0.0.1:{port}" if port else target_data.get("name", "Unknown Target"),

            # A failed campaign has no score: the report says why instead.
            "status": campaign_data.get("status", "completed"),
            "status_detail": campaign_data.get("status_detail"),
            "overall_risk_score": risk_score,
            "risk_level": risk_level(risk_score),

            "total_tests": total,
            "total_failures": tally["fail"],
            "total_passes": tally["pass"],
            "total_errors": tally["error"],
            "total_inconclusive": tally["inconclusive"],
            "coverage": round(judged / total * 100, 1) if total else 0.0,
            "overall_failure_rate": round(tally["fail"] / judged * 100, 1) if judged else 0.0,

            "category_scores": self._generate_category_scores(results, findings),
            "findings": self._format_findings(findings),

            "generated_at": datetime.now(timezone.utc),
            "campaign_started_at": campaign_data.get("started_at"),
            "campaign_completed_at": campaign_data.get("completed_at"),
        }

    def _generate_category_scores(self, results: list[dict], findings: list[dict]) -> list[dict]:
        """Per-category counts. The score is the share of judged tests that failed."""
        names = {c["id"]: c["name"] for c in get_available_categories()}
        worst_by_cat = {f.get("category"): f.get("severity", "info") for f in findings}
        scores = []

        for category in sorted({r.get("attack_category") for r in results if r.get("attack_category")}):
            cat_results = [r for r in results if r.get("attack_category") == category]
            failures = sum(1 for r in cat_results if r.get("result") == "fail")
            judged = sum(1 for r in cat_results if r.get("result") in ("pass", "fail"))
            failure_rate = round(failures / judged * 100, 1) if judged else 0.0

            scores.append({
                "category": category,
                "display_name": names.get(category, category.replace("_", " ").title()),
                "total_tests": len(cat_results),
                "failures": failures,
                "failure_rate": failure_rate,
                "severity": worst_by_cat.get(category, "info"),
                "score": failure_rate,
            })

        scores.sort(key=lambda s: (SEVERITY_ORDER.get(s["severity"], 0), s["score"]), reverse=True)
        return scores

    def _format_findings(self, findings: list[dict]) -> list[dict]:
        formatted = []
        for f in findings:
            total = f.get("total_tests_in_category") or 0
            count = f.get("occurrence_count", 0)
            formatted.append({
                "id": f.get("id", str(uuid.uuid4())),
                "category": f.get("category", "unknown"),
                "title": f.get("title", "Unknown Finding"),
                "description": f.get("description", ""),
                "severity": f.get("severity", "medium"),
                "confidence": f.get("confidence", 0.5),
                "occurrence_count": count,
                "total_tests_in_category": total,
                "failure_rate": round(count / total * 100, 1) if total else 0.0,
                "remediation": f.get("remediation"),
                "evidence": f.get("evidence", []),
            })
        return formatted


# Singleton instance
report_generator = ReportGenerator()
