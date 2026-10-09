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


def test_sql_injection_payloads_loaded_with_regex_flag():
    from app.attack_library.loader import load_all_payloads

    sqli = [a for a in load_all_payloads() if a["category"] == "sql_injection"]
    assert len(sqli) >= 40
    assert all(a["is_regex"] and a["success_indicators"] for a in sqli)


def test_xss_payloads_confirmed_by_string_match_not_judge():
    from app.attack_library.loader import load_all_payloads

    xss = [a for a in load_all_payloads() if a["category"] == "insecure_output_handling" and a["subcategory"] == "xss"]
    assert len(xss) >= 10
    assert all(a["is_regex"] for a in xss)


async def test_sql_injection_confirmed_by_db_error_in_reply():
    # An app that passes the input straight into SQL and leaks the error.
    def reply(body):
        p = body.get("prompt", "")
        if "'" in p or "SLEEP" in p.upper():
            return {"response": "Error: near \"'\": syntax error (sqlite3.OperationalError)"}
        return {"response": "No matching order found."}

    server, url, _ = _serve(reply)
    try:
        with patch(JUDGE, _judge("pass")):  # judge would say safe; regex must still catch it
            summary = await attack_engine.run_campaign(url, "prompt", ["sql_injection"])
    finally:
        server.shutdown()
    worked = [r for r in summary["results"] if r["result"] == "fail"]
    assert worked, "a DB error in the reply should be a confirmed finding"
    assert all(r["metadata"]["method"] == "regex" for r in worked)


async def test_per_scan_cap_limits_payloads_sent():
    # The same categories, two caps: the smaller cap sends fewer attacks.
    def reply(_body):
        return {"response": "I can't help with that."}

    server, url, _ = _serve(reply)
    try:
        with patch(JUDGE, _judge("pass")):
            few = await attack_engine.run_campaign(url, "prompt", ["jailbreak"], max_payloads=3)
            many = await attack_engine.run_campaign(url, "prompt", ["jailbreak"], max_payloads=15)
    finally:
        server.shutdown()
    assert few["total_tests"] == 3
    assert many["total_tests"] == 15
