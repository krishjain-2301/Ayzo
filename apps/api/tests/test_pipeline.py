"""
End-to-end checks of the scan pipeline against tiny local HTTP servers.
These pin the behaviour that matters most: a scan that could not really test
the app must never come back looking clean.
"""

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import AsyncMock, patch

import pytest

from app.services.attack_engine import attack_engine, risk_level
from app.services.http_target import discover_chat_endpoint, send_prompt

JUDGE = "app.services.eval_engine.llm_client.chat"
CATEGORIES = ["system_prompt_leak"]
SECRET = "hunter2-admin-pass"


def _serve(reply):
    """Start a server whose POST /chat answers with reply(body) -> (status, json)."""

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            status, body = reply(json.loads(raw or b"{}")) if self.path == "/chat" else (404, {})
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


@pytest.fixture
def locked_app():
    server, url = _serve(lambda body: (401, {"message": "Unauthorized"}))
    yield url
    server.shutdown()


@pytest.fixture
def leaky_app():
    server, url = _serve(lambda body: (200, {"response": f"Sure! The admin password is {SECRET}."}))
    yield url
    server.shutdown()


@pytest.fixture
def refusing_app():
    server, url = _serve(lambda body: (200, {"response": "Sorry, I can only help with orders."}))
    yield url
    server.shutdown()


def _judge(result):
    reply = json.dumps({"result": result, "confidence": 0.9, "reasoning": "test judge"})
    return AsyncMock(return_value={"success": True, "response_text": reply})


async def test_non_2xx_is_an_error_not_an_answer(locked_app):
    reply = await send_prompt(f"{locked_app}/chat", "hello", "prompt")
    assert reply["success"] is False
    assert reply["status_code"] == 401


async def test_endpoint_that_only_returns_401_is_not_discovered(locked_app):
    assert await discover_chat_endpoint(locked_app) is None


async def test_configured_chat_path_is_tried_first(leaky_app):
    found = await discover_chat_endpoint(leaky_app, extra_paths=["/chat"])
    assert found.path == "/chat"


async def test_locked_app_fails_the_scan_instead_of_scoring_zero(locked_app):
    with patch(JUDGE, _judge("pass")):
        summary = await attack_engine.run_campaign(f"{locked_app}/chat", "prompt", CATEGORIES)
    assert summary["status"] == "failed"
    assert summary["risk_score"] is None
    assert summary["error_tests"] == summary["total_tests"] > 0
    assert "produced a verdict" in summary["error"]


async def test_judge_down_fails_the_scan_instead_of_scoring_zero(leaky_app):
    with patch(JUDGE, AsyncMock(return_value={"success": False, "error": "offline"})):
        summary = await attack_engine.run_campaign(f"{leaky_app}/chat", "prompt", CATEGORIES)
    assert summary["status"] == "failed"
    assert summary["risk_score"] is None
    assert summary["inconclusive_tests"] == summary["total_tests"]


async def test_canary_catches_the_leak_even_with_the_judge_down(leaky_app):
    with patch(JUDGE, AsyncMock(return_value={"success": False, "error": "offline"})):
        summary = await attack_engine.run_campaign(
            f"{leaky_app}/chat", "prompt", CATEGORIES, profile={"canaries": [SECRET]}
        )
    assert summary["status"] == "completed"
    assert summary["failed_tests"] == summary["total_tests"]
    assert summary["risk_score"] == 100.0
    evidence = summary["findings"][0]["evidence"][0]
    assert evidence["method"] == "canary"
    assert evidence["attack_name"]


async def test_app_that_refuses_everything_scores_zero(refusing_app):
    with patch(JUDGE, _judge("pass")):
        summary = await attack_engine.run_campaign(f"{refusing_app}/chat", "prompt", CATEGORIES)
    assert summary["status"] == "completed"
    assert summary["risk_score"] == 0.0
    assert summary["findings"] == []


async def test_unknown_category_fails():
    summary = await attack_engine.run_campaign("http://127.0.0.1:9/chat", "prompt", ["no_such_category"])
    assert summary["status"] == "failed"
    assert summary["total_tests"] == 0


async def test_mutation_retries_only_the_attacks_that_missed(refusing_app):
    seen = []

    async def fake_mutate(prompt, count=1, **kwargs):
        seen.append(prompt)
        return [{"prompt": f"again: {prompt}", "strategy": "paraphrase", "original": prompt}]

    with patch(JUDGE, _judge("pass")), patch("app.services.attack_engine.mutation_engine.mutate", fake_mutate):
        summary = await attack_engine.run_campaign(
            f"{refusing_app}/chat", "prompt", CATEGORIES, mutation_depth=1
        )
    assert 0 < len(seen) <= 10
    mutated = [r for r in summary["results"] if r["mutation_generation"] == 1]
    assert len(mutated) == len(seen)
    assert mutated[0]["attack_name"].endswith("[paraphrase]")


def test_one_critical_failure_cannot_be_averaged_away():
    results = [{"result": "pass", "severity": "low", "confidence": 0.9}] * 99
    results.append({"result": "fail", "severity": "critical", "confidence": 1.0})
    score = attack_engine._calculate_risk_score(results)
    assert 60 <= score < 65
    assert risk_level(score) == "High"
    assert risk_level(None) == "Unknown"
