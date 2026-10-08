"""
Apps that do not match the defaults: behind a key, with their own field
names, streaming their replies, or keeping the conversation server-side.
"""

import json
import threading
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.models.schemas.target import TargetCreate, TargetResponse
from app.services.attack_engine import attack_engine
from app.services.http_target import build_body, discover_chat_endpoint, join_stream, pick_path, send_prompt

JUDGE = "app.services.eval_engine.llm_client.chat"
KEYED = {
    "headers": {"X-Api-Key": "letmein-1234"},
    "request_field": "question",
    "response_field": "data.answer",
}


def _serve(handler_body):
    """Start a server; handler_body(handler, json_body) writes the response."""

    class Handler(BaseHTTPRequestHandler):
        sessions: dict = {}

        def do_POST(self):
            raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            handler_body(self, json.loads(raw or b"{}"))

        def reply(self, status, body, content_type="application/json", headers=None):
            data = body if isinstance(body, bytes) else json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            for name, value in (headers or {}).items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


def _keyed_app(handler, body):
    if handler.path != "/ask":
        return handler.reply(404, {})
    if handler.headers.get("X-Api-Key") != "letmein-1234":
        return handler.reply(401, {"message": "missing key"})
    if "question" not in body:
        return handler.reply(422, {"detail": "question is required"})
    handler.reply(200, {"data": {"answer": f"You asked: {body['question']}"}, "meta": {"text": "ignore me"}})


def _sse_app(handler, body):
    chunks = ["Hel", "lo ", "wor", "ld"]
    lines = [f"data: {json.dumps({'choices': [{'delta': {'content': c}}]})}\n\n" for c in chunks]
    handler.reply(200, ("".join(lines) + "data: [DONE]\n\n").encode(), content_type="text/event-stream")


def _session_app(handler, body):
    """Remembers how many messages each session has sent, by cookie."""
    cookie = handler.headers.get("Cookie", "")
    sid = cookie.split("sid=")[-1] if "sid=" in cookie else uuid.uuid4().hex
    handler.sessions[sid] = handler.sessions.get(sid, 0) + 1
    handler.reply(200, {"response": f"turn {handler.sessions[sid]}"}, headers={"Set-Cookie": f"sid={sid}"})


@pytest.fixture
def keyed_app():
    server, url = _serve(_keyed_app)
    yield url
    server.shutdown()


@pytest.fixture
def sse_app():
    server, url = _serve(_sse_app)
    yield url
    server.shutdown()


@pytest.fixture
def session_app():
    server, url = _serve(_session_app)
    yield url
    server.shutdown()


def test_custom_request_field_and_extra_body():
    assert build_body("hi", "field:question") == {"question": "hi"}
    assert build_body("hi", "prompt", extra_body={"stream": True}) == {"prompt": "hi", "stream": True}


def test_pick_path_follows_dicts_and_lists():
    payload = {"choices": [{"message": {"content": "hey"}}], "data": {"answer": "yes"}}
    assert pick_path(payload, "data.answer") == "yes"
    assert pick_path(payload, "choices.0.message.content") == "hey"
    assert pick_path(payload, "data.missing") is None


def test_streams_are_joined_into_one_reply():
    sse = 'data: {"choices":[{"delta":{"content":"Hi "}}]}\n\ndata: {"choices":[{"delta":{"content":"there"}}]}\n\ndata: [DONE]\n'
    assert join_stream(sse) == "Hi there"
    ndjson = '{"message":{"content":"Hi "},"done":false}\n{"message":{"content":"there"},"done":true}\n'
    assert join_stream(ndjson) == "Hi there"
    assert join_stream("just some text") is None


async def test_app_behind_a_key_is_not_found_without_it(keyed_app):
    assert await discover_chat_endpoint(keyed_app, extra_paths=["/ask"]) is None


async def test_app_behind_a_key_with_its_own_fields(keyed_app):
    found = await discover_chat_endpoint(keyed_app, extra_paths=["/ask"], options=KEYED)
    assert found and found.path == "/ask" and found.body_style == "field:question"

    reply = await send_prompt(found.url, "what is 2+2", found.body_style, options=KEYED)
    assert reply["success"] and reply["response_text"] == "You asked: what is 2+2"

    wrong_field = await send_prompt(found.url, "hi", found.body_style, options={**KEYED, "response_field": "data.nope"})
    assert wrong_field["success"] is False and wrong_field["error_type"] == "shape_error"


async def test_streaming_app_is_read_as_one_reply(sse_app):
    found = await discover_chat_endpoint(sse_app, extra_paths=["/chat"])
    assert found is not None
    reply = await send_prompt(found.url, "hello", found.body_style)
    assert reply["success"] and reply["response_text"] == "Hello world"


async def test_full_scan_of_a_keyed_app(keyed_app):
    judge = AsyncMock(return_value={
        "success": True,
        "response_text": json.dumps({"result": "pass", "confidence": 0.9, "quote": "", "reasoning": "echo"}),
    })
    with patch(JUDGE, judge):
        without_key = await attack_engine.run_campaign(f"{keyed_app}/ask", "field:question", ["system_prompt_leak"])
        with_key = await attack_engine.run_campaign(
            f"{keyed_app}/ask", "field:question", ["system_prompt_leak"], http_options=KEYED
        )
    assert without_key["status"] == "failed" and without_key["error_tests"] == without_key["total_tests"]
    assert with_key["status"] == "completed" and with_key["error_tests"] == 0


async def test_one_client_keeps_the_session_between_turns(session_app):
    async with httpx.AsyncClient() as session:
        first = await send_prompt(f"{session_app}/chat", "one", "message", client=session)
        second = await send_prompt(f"{session_app}/chat", "two", "message", client=session)
    assert first["response_text"] == "turn 1"
    assert second["response_text"] == "turn 2"


def test_target_schema_validates_and_masks_connection_settings():
    created = TargetCreate(
        name="x", target_port=5000,
        request_headers={"Authorization": "Bearer abcdefghijkl"},
        request_field="question", response_field="data.answer", history_mode="server",
    )
    assert created.request_field == "question"

    for bad in (
        {"request_headers": {"Bad Name": "v"}},
        {"request_headers": {"X-Key": "line1\nline2"}},
        {"request_field": "has space"},
        {"response_field": "a..b"},
        {"history_mode": "sometimes"},
    ):
        with pytest.raises(ValueError):
            TargetCreate(name="x", target_port=5000, **bad)

    now = datetime.now(timezone.utc)
    shown = TargetResponse(
        id=uuid.uuid4(), name="x", project_path=".", start_command="already running", target_port=5000,
        status="active", created_at=now, updated_at=now,
        request_headers={"Authorization": "Bearer abcdefghijkl", "X-Short": "abc"},
    )
    assert shown.request_headers == {"Authorization": "Bear***", "X-Short": "***"}
