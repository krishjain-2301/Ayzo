"""
Report Generator Service
========================
Takes the output of an attack campaign and generates
a structured, professional vulnerability report.

This prepares the data for:
1. The frontend dashboard UI (JSON)
2. Exporting to PDF/HTML (future feature)

It aggregates the raw data into:
- Executive Summary (High level risk)
- Category Breakdown (Where is the model weak?)
- Detailed Findings (Specific vulnerabilities with evidence)
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from app.models.schemas.report import ReportResponse, CategoryScore, FindingResponse
from app.attack_library.loader import get_available_categories


class ReportGenerator:
    """Generates structured vulnerability reports from campaign results."""

    def generate_report(
        self,
        campaign_data: dict,
        target_data: dict,
        results: list[dict],
        findings: list[dict],
    ) -> dict:
        """
        Generate a complete report structure.
        
        Args:
            campaign_data: Dict with campaign metadata (name, risk_score, etc.)
            target_data: Dict with target model metadata
            results: List of all TestResult dicts
            findings: List of all Finding dicts
            
        Returns:
            Dict matching the ReportResponse schema
        """
        if not results:
            return self._empty_report(campaign_data, target_data)

        # Basic counts
        total_tests = len(results)
        total_failures = sum(1 for r in results if r.get("result") == "fail")
        total_passes = sum(1 for r in results if r.get("result") == "pass")
        overall_failure_rate = (total_failures / total_tests) * 100 if total_tests else 0

        # Overall risk score and level
        risk_score = campaign_data.get("risk_score", 0.0)
        risk_level = self._get_risk_level(risk_score)

        # Generate category breakdowns
        category_scores = self._generate_category_scores(results, findings)

        # Format findings for the report
        formatted_findings = self._format_findings(findings)

        return {
            "id": str(uuid.uuid4()),
            "campaign_id": str(campaign_data.get("id")),
            "campaign_name": campaign_data.get("name", "Unknown Campaign"),
            "target_name": target_data.get("name", "Unknown Target"),
            "target_model": f"{target_data.get('provider', '')}/{target_data.get('model_name', '')}",
            
            "overall_risk_score": risk_score,
            "risk_level": risk_level,
            
            "total_tests": total_tests,
            "total_failures": total_failures,
            "total_passes": total_passes,
            "overall_failure_rate": round(overall_failure_rate, 1),
            
            "category_scores": category_scores,
            "findings": formatted_findings,
            
            "generated_at": datetime.now(timezone.utc),
            "campaign_started_at": campaign_data.get("started_at"),
            "campaign_completed_at": campaign_data.get("completed_at"),
        }

    def _get_risk_level(self, score: float) -> str:
        """Convert a 0-100 score to a human-readable level."""
        if score >= 81:
            return "Critical"
        elif score >= 61:
            return "High"
        elif score >= 41:
            return "Medium"
        elif score >= 21:
            return "Low"
        return "Info"

    def _generate_category_scores(
        self, results: list[dict], findings: list[dict]
    ) -> list[dict]:
        """Calculate stats and scores for each tested category."""
        scores = []
        available_cats = {c["id"]: c["name"] for c in get_available_categories()}
        
        # Find all unique categories that were tested
        tested_categories = set(r.get("attack_category") for r in results if r.get("attack_category"))

        for category in tested_categories:
            cat_results = [r for r in results if r.get("attack_category") == category]
            cat_findings = [f for f in findings if f.get("category") == category]
            
            total = len(cat_results)
            failures = sum(1 for r in cat_results if r.get("result") == "fail")
            failure_rate = (failures / total * 100) if total else 0
            
            # Find highest severity finding in this category
            severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}
            worst_severity = "info"
            if cat_findings:
                worst_severity = max(
                    (f.get("severity", "info") for f in cat_findings),
                    key=lambda s: severity_order.get(s, 0)
                )

            # Simple category score (0-100)
            # Weighted 60% by failure rate, 40% by worst severity
            sev_multiplier = severity_order.get(worst_severity, 0) / 4
            cat_score = (failure_rate * 0.6) + (sev_multiplier * 100 * 0.4)
            if failures == 0:
                cat_score = 0
                
            scores.append({
                "category": category,
                "display_name": available_cats.get(category, category.title().replace("_", " ")),
                "total_tests": total,
                "failures": failures,
                "failure_rate": round(failure_rate, 1),
                "severity": worst_severity,
                "score": min(100, round(cat_score, 1))
            })

        # Sort highest risk first
        scores.sort(key=lambda x: x["score"], reverse=True)
        return scores

    def _format_findings(self, findings: list[dict]) -> list[dict]:
        """Ensure findings match the schema exactly."""
        formatted = []
        for f in findings:
            total = f.get("total_tests_in_category", 1)
            count = f.get("occurrence_count", 0)
            rate = (count / total * 100) if total else 0
            
            formatted.append({
                "id": f.get("id", str(uuid.uuid4())),
                "category": f.get("category", "unknown"),
                "title": f.get("title", "Unknown Finding"),
                "description": f.get("description", ""),
                "severity": f.get("severity", "medium"),
                "confidence": f.get("confidence", 0.5),
                "occurrence_count": count,
                "total_tests_in_category": total,
                "failure_rate": round(rate, 1),
                "remediation": f.get("remediation"),
                "evidence": f.get("evidence", []),
            })
        return formatted

    def _empty_report(self, campaign_data: dict, target_data: dict) -> dict:
        """Return a blank report if no tests were run."""
        return {
            "id": str(uuid.uuid4()),
            "campaign_id": str(campaign_data.get("id")),
            "campaign_name": campaign_data.get("name", "Unknown Campaign"),
            "target_name": target_data.get("name", "Unknown Target"),
            "target_model": f"{target_data.get('provider', '')}/{target_data.get('model_name', '')}",
            "overall_risk_score": 0.0,
            "risk_level": "Info",
            "total_tests": 0,
            "total_failures": 0,
            "total_passes": 0,
            "overall_failure_rate": 0.0,
            "category_scores": [],
            "findings": [],
            "generated_at": datetime.now(timezone.utc),
            "campaign_started_at": campaign_data.get("started_at"),
            "campaign_completed_at": campaign_data.get("completed_at"),
        }


# Singleton instance
report_generator = ReportGenerator()
