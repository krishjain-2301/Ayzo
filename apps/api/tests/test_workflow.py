"""Phase 5: regression comparison, cancel, and CLI output formats."""

import json
import threading
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import AsyncMock, patch

from app.cli import to_junit, to_sarif
from app.services.attack_engine import attack_engine
from app.services.regression import compare_results

JUDGE = "app.services.eval_engine.llm_client.chat"
TARGET = {"id": "t1", "name": "Shop bot"}


def _row(name, result, category="prompt_injection", generation=0, method="judge"):
    return {
        "attack_category": category, "attack_name": name, "result": result, "severity": "high",
        "mutation_generation": generation, "meta_data": {"method": method},
        "prompt_sent": f"prompt for {name}", "model_response": "reply", "eval_reasoning": "because",
        "method": method,
    }


def test_compare_finds_new_fixed_and_still_failing():
    baseline = [_row("A", "fail"), _row("B", "fail"), _row("C", "pass"), _row("D", "pass")]
    current = [
        _row("A", "fail"),                       # still failing
        _row("B", "pass"),                       # fixed
        _row("C", "fail", method="canary"),      # new, library attack
        _row("D", "error"),                      # no verdict: neither fixed nor new
        _row("C [paraphrase]", "fail", generation=1),          # new, but a generated variant
        _row("Rule 1: model-written #1", "fail", category="business_rules"),
    ]
    result = compare_results(current, baseline)
    assert [f["attack_name"] for f in result["still_failing"]] == ["A"]
    assert [f["attack_name"] for f in result["fixed"]] == ["B"]
    assert len(result["new_failures"]) == 3
    assert [f["attack_name"] for f in result["new_stable_failures"]] == ["C"]
    assert result["new_stable_failures"][0]["method"] == "canary"


def test_same_name_in_another_category_is_a_different_attack():
    baseline = [_row("Basic", "fail", category="jailbreak")]
    current = [_row("Basic", "fail", category="prompt_injection")]
    assert len(compare_results(current, baseline)["new_stable_failures"]) == 1


def test_sarif_has_one_result_per_working_attack():
    failures = [_row("A", "fail", method="canary"), _row("B", "fail", category="data_leakage")]
    sarif = to_sarif(failures, TARGET, "app/main.py")
    run = sarif["runs"][0]
    assert sarif["version"] == "2.1.0"
    assert {rule["id"] for rule in run["tool"]["driver"]["rules"]} == {"prompt_injection", "data_leakage"}
    assert len(run["results"]) == 2
    first = run["results"][0]
    assert first["level"] == "error"
    assert "exact match: canary" in first["message"]["text"]
    assert first["locations"][0]["physicalLocation"]["artifactLocation"]["uri"] == "app/main.py"
    json.dumps(sarif)  # must be serialisable


def test_junit_counts_failures_errors_and_skips():
    xml = to_junit([_row("A", "fail"), _row("B", "pass"), _row("C", "error"), _row("D", "inconclusive")], TARGET)
    suite = ET.fromstring(xml)
    assert (suite.get("tests"), suite.get("failures"), suite.get("errors"), suite.get("skipped")) == ("4", "1", "1", "1")
    assert len(suite.findall("testcase")) == 4


async def test_cancelled_scan_stops_sending_and_keeps_results():
    received = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            self.rfile.read(int(self.headers.get("Content-Length", 0)))
            received.append(1)
            data = json.dumps({"response": "Sorry, I can only help with orders."}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    judge = AsyncMock(return_value={
        "success": True,
        "response_text": json.dumps({"result": "pass", "confidence": 0.9, "quote": "", "reasoning": "refused"}),
    })
    try:
        with patch(JUDGE, judge):
            summary = await attack_engine.run_campaign(
                f"http://127.0.0.1:{server.server_address[1]}/chat", "prompt", ["system_prompt_leak"],
                should_stop=lambda: len(received) >= 6,
            )
    finally:
        server.shutdown()
    assert summary["status"] == "cancelled"
    assert summary["risk_score"] is None
    # Tests in flight when the stop came in finish; the rest (20 in total) are never sent.
    assert 6 <= summary["total_tests"] < 20
    assert len(received) == summary["total_tests"]
