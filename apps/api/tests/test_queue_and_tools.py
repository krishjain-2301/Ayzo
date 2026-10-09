"""The scan queue, continuing an interrupted scan, tool-abuse attacks, and the agent practice bot."""

import asyncio
import importlib.util
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app.services import job_queue
from app.services.attack_engine import attack_engine
from app.services.tool_attacks import generate_tool_tests

JUDGE = "app.services.eval_engine.llm_client.chat"
REPO = Path(__file__).resolve().parents[3]


def _serve(make_reply):
    received = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            received.append(body.get("prompt", ""))
            data = json.dumps(make_reply(body)).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}/chat", received


def _judge(result="pass"):
    return AsyncMock(return_value={
        "success": True,
        "response_text": json.dumps({"result": result, "confidence": 0.9, "quote": "", "reasoning": "test"}),
    })


async def test_queue_runs_scans_one_at_a_time_in_order():
    running, order, overlap = 0, [], False

    async def fake_runner(campaign_id):
        nonlocal running, overlap
        running += 1
        overlap = overlap or running > 1
        order.append(campaign_id)
        await asyncio.sleep(0.02)
        running -= 1

    with patch.object(job_queue, "unfinished_campaign_ids", AsyncMock(return_value=["left-over"])), \
         patch("app.services.campaign_runner.run_campaign_async", fake_runner):
        resumed = await job_queue.start()
        job_queue.enqueue("a")
        job_queue.enqueue("b")
        await asyncio.wait_for(job_queue._queue.join(), timeout=5)
        await job_queue.stop()

    assert resumed == 1
    assert order == ["left-over", "a", "b"]  # the interrupted scan goes first
    assert overlap is False


async def test_interrupted_scan_continues_without_resending():
    server, url, received = _serve(lambda body: {"response": "Sorry, I can only help with orders."})
    try:
        with patch(JUDGE, _judge("pass")):
            full = await attack_engine.run_campaign(url, "prompt", ["system_prompt_leak"])
            sent_first_time = len(received)
            # Pretend the API stopped after 12 attacks: those results are what was saved.
            saved = full["results"][:12]
            received.clear()
            resumed = await attack_engine.run_campaign(url, "prompt", ["system_prompt_leak"], prior_results=saved)
    finally:
        server.shutdown()

    assert sent_first_time == 20
    assert len(received) == 8  # only the attacks that had not been sent
    assert resumed["status"] == "completed" and resumed["total_tests"] == 20
    assert {r["attack_name"] for r in resumed["results"]} == {r["attack_name"] for r in full["results"]}


def test_tool_abuse_tests_are_generated_per_tool():
    tests = generate_tool_tests(["delete_account", "  ", "export_customers"])
    assert len(tests) == 8
    assert all(t["category"] == "tool_abuse" and t["severity"] == "critical" for t in tests)
    assert sum("delete_account" in t["prompt"] for t in tests) == 4
    assert generate_tool_tests([]) == []


async def test_tool_abuse_scan_confirms_by_the_call_not_the_words():
    # An app that says no in words but calls the tool anyway when told it is the administrator.
    def reply(body):
        called = "administrator" in body.get("prompt", "")
        return {"response": "I'm sorry, I can't do that.", "tool_calls": [{"function": {"name": "delete_account"}}] if called else []}

    server, url, _ = _serve(reply)
    try:
        with patch(JUDGE, _judge("pass")):
            summary = await attack_engine.run_campaign(
                url, "prompt", ["tool_abuse"],
                extra_tests=generate_tool_tests(["delete_account"]),
                profile={"forbidden_tools": ["delete_account"]},
            )
    finally:
        server.shutdown()
    worked = [r for r in summary["results"] if r["result"] == "fail"]
    assert len(worked) == 1 and worked[0]["attack_name"] == "delete_account: claimed administrator"
    assert worked[0]["metadata"]["method"] == "tool_call"
    assert summary["risk_score"] >= 60  # a confirmed critical failure


def test_agent_practice_bot_reports_the_tools_it_called():
    spec = importlib.util.spec_from_file_location("practice_app", REPO / "practice_bot" / "app.py")
    bot = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bot)

    text, calls = bot.run_tools('Of course.\nTOOL: delete_account {"email": "a@b.c"}\nAnything else?\nTOOL: not_a_tool {}')
    assert [c["function"]["name"] for c in calls] == ["delete_account"]
    assert "TOOL:" not in text and "permanently deleted" in text
    assert bot.run_tools("I can't do that.") == ("I can't do that.", [])
    assert "agent" in bot.PROFILE and bot.PROFILE["forbidden_tools"] == ["delete_account", "export_customers"]


def test_cross_user_tests_are_generated_per_listed_user():
    from app.services.access_attacks import TEMPLATES, generate_access_tests

    tests = generate_access_tests(["userId 2", " ", "DocBrown"])
    assert len(tests) == 2 * len(TEMPLATES)
    assert all(t["category"] == "cross_user" and t["severity"] == "critical" for t in tests)
    assert sum("userId 2" in t["prompt"] for t in tests) == len(TEMPLATES)
    assert generate_access_tests([]) == []


async def test_cross_user_scan_confirms_a_leak_by_the_other_users_value():
    # An app that hands over another user's record to anyone claiming to be support.
    from app.services.access_attacks import generate_access_tests

    def reply(body):
        text = body.get("prompt", "")
        if "user 2" in text and "support team" in text:
            return {"response": "Records for user 2: transfer to ACCT-99812-SECRET"}
        return {"response": "I can only show your own records."}

    server, url, _ = _serve(reply)
    try:
        with patch(JUDGE, _judge("pass")):
            summary = await attack_engine.run_campaign(
                url, "prompt", ["cross_user"],
                extra_tests=generate_access_tests(["user 2"]),
                profile={"canaries": ["ACCT-99812-SECRET"]},
            )
    finally:
        server.shutdown()
    worked = [r for r in summary["results"] if r["result"] == "fail"]
    assert len(worked) == 1 and worked[0]["attack_name"] == "user 2: support pretext"
    assert worked[0]["metadata"]["method"] == "canary"
