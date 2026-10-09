"""
HTTP target client: find a chat endpoint and send prompts to it.

Real LLM apps do not all speak the same JSON. A target can state its request
field, response field, headers and extra body fields. Whatever it does not
state is discovered by probing common paths and body shapes.

Replies may be plain JSON, plain text, Server-Sent Events, or newline-delimited
JSON (the two common streaming formats); streams are joined into one text.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from app.services.safety import assert_loopback_url

PROBE_MESSAGE = "hello"

COMMON_PATHS = (
    "/v1/chat/completions",
    "/chat/completions",
    "/api/v1/chat/completions",
    "/api/chat",
    "/api/v1/chat",
    "/api/generate",
    "/api/v1/generate",
    "/chat",
    "/generate",
    "/completion",
    "/completions",
    "/ask",
    "/query",
    "/message",
    "/",
)

# (style_id, builder)
BODY_STYLES: tuple[tuple[str, Any], ...] = (
    ("messages", lambda p: {"messages": [{"role": "user", "content": p}]}),
    ("prompt", lambda p: {"prompt": p}),
    ("message", lambda p: {"message": p}),
    ("input", lambda p: {"input": p}),
    ("query", lambda p: {"query": p}),
    ("text", lambda p: {"text": p}),
    (
        "openai",
        lambda p: {
            "model": "gpt-3.5-turbo",
            "messages": [{"role": "user", "content": p}],
        },
    ),
)
CHAT_STYLES = {"messages", "openai"}
KNOWN_STYLES = {style for style, _ in BODY_STYLES}

# Keys that commonly hold the assistant's text, in the order we try them.
TEXT_KEYS = (
    "response", "response_text", "content", "text", "output", "output_text",
    "reply", "answer", "message", "result", "completion", "generated_text", "token",
)


@dataclass(frozen=True)
class DiscoveredEndpoint:
    url: str
    path: str
    body_style: str
    status_code: int


def style_for(options: Optional[dict]) -> Optional[str]:
    """The body style a target's `request_field` implies, or None to discover it."""
    field = (options or {}).get("request_field")
    return f"field:{field}" if field and field not in KNOWN_STYLES else field or None


def build_body(
    prompt: str,
    body_style: str,
    messages: Optional[list[dict]] = None,
    extra_body: Optional[dict] = None,
) -> dict:
    """
    Build a request body. With `messages` (multi-turn), chat-style contracts
    get the full history; single-field contracts get it as a transcript so
    earlier turns are not dropped. `extra_body` fields are added last.
    """
    history = [m for m in (messages or []) if isinstance(m, dict) and m.get("content")]
    if not history:
        history = [{"role": "user", "content": prompt}]

    text = prompt
    if len(history) > 1:
        text = "\n".join(f"{m.get('role', 'user')}: {m.get('content', '')}" for m in history)

    if body_style == "messages":
        body = {"messages": history}
    elif body_style == "openai":
        body = {"model": "gpt-3.5-turbo", "messages": history}
    elif body_style.startswith("field:"):
        body = {body_style[len("field:"):]: text}
    elif body_style in KNOWN_STYLES:
        body = {body_style: text}
    else:
        body = {"messages": history}

    return {**body, **(extra_body or {})}


def pick_path(payload: Any, dotted: str) -> Any:
    """Follow a dotted path such as `data.answer` or `choices.0.message.content`."""
    current = payload
    for part in dotted.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, list) and part.isdigit() and int(part) < len(current):
            current = current[int(part)]
        else:
            return None
    return current


def extract_response_text(payload: Any) -> Optional[str]:
    """Pull assistant text out of common chat JSON envelopes."""
    if payload is None:
        return None
    if isinstance(payload, str):
        return payload.strip() or None
    if isinstance(payload, (int, float, bool)):
        return str(payload)
    if isinstance(payload, list):
        joined = "\n".join(p for p in (extract_response_text(item) for item in payload) if p)
        return joined or None
    if not isinstance(payload, dict):
        return str(payload)

    for key in TEXT_KEYS:
        value = payload.get(key)
        if value is None:
            continue
        if isinstance(value, str):
            if value.strip():
                return value
        else:
            inner = extract_response_text(value)
            if inner:
                return inner

    choices = payload.get("choices")
    if isinstance(choices, list) and choices and isinstance(choices[0], dict):
        first = choices[0]
        msg = first.get("message") or first.get("delta") or first
        if isinstance(msg, dict) and msg.get("content"):
            return str(msg["content"])
        if first.get("text"):
            return str(first["text"])

    data = payload.get("data")
    if data is not None and data is not payload:
        return extract_response_text(data)
    return None


def _chunk_text(payload: Any, response_field: Optional[str]) -> str:
    """Text carried by one streamed chunk. Unlike a full reply, whitespace matters."""
    if response_field:
        value = pick_path(payload, response_field)
        return value if isinstance(value, str) else ""
    if isinstance(payload, dict):
        choices = payload.get("choices")
        if isinstance(choices, list) and choices and isinstance(choices[0], dict):
            delta = choices[0].get("delta") or choices[0].get("message") or {}
            if isinstance(delta, dict) and isinstance(delta.get("content"), str):
                return delta["content"]
            if isinstance(choices[0].get("text"), str):
                return choices[0]["text"]
        message = payload.get("message")
        if isinstance(message, dict) and isinstance(message.get("content"), str):
            return message["content"]
        for key in TEXT_KEYS:
            if isinstance(payload.get(key), str):
                return payload[key]
    return ""


def join_stream(raw: str, response_field: Optional[str] = None) -> Optional[str]:
    """
    Join a streamed reply into one text. Handles Server-Sent Events
    (`data: {...}` lines, ending with `data: [DONE]`) and newline-delimited
    JSON. Returns None when the body is not a stream we recognise.
    """
    parts, recognised = [], False
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith((":", "event:", "id:", "retry:")):
            continue
        if line.startswith("data:"):
            line = line[len("data:"):].strip()
            recognised = True
        if line == "[DONE]":
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            if recognised:
                parts.append(line)  # SSE carrying plain text
                continue
            return None
        recognised = True
        parts.append(_chunk_text(payload, response_field))
    text = "".join(parts).strip()
    return text or None if recognised else None


def read_reply(res: httpx.Response, response_field: Optional[str] = None) -> Optional[str]:
    """The assistant's text from a response, whatever format the app used."""
    content_type = res.headers.get("content-type", "").lower()
    raw = res.text or ""
    streamed = "event-stream" in content_type or "ndjson" in content_type or raw.lstrip().startswith("data:")
    if streamed:
        return join_stream(raw, response_field)

    try:
        payload = res.json()
    except Exception:
        # Not JSON: maybe an unlabelled NDJSON stream, otherwise plain text.
        return (join_stream(raw, response_field) if raw.count("\n") else None) or raw.strip() or None

    if response_field:
        value = pick_path(payload, response_field)
        return extract_response_text(value) if value is not None else None
    return extract_response_text(payload)


def extract_tool_calls(res: httpx.Response) -> list[str]:
    """
    Names of tools the app says it called, when its reply reports them in a
    common shape: OpenAI-style `tool_calls` (top level, under `message`, or
    under `choices[0].message`), or a plain list of names or {name} objects.
    """
    try:
        payload = res.json()
    except Exception:
        return []
    if not isinstance(payload, dict):
        return []
    candidates = [payload.get("tool_calls")]
    if isinstance(payload.get("message"), dict):
        candidates.append(payload["message"].get("tool_calls"))
    choices = payload.get("choices")
    if isinstance(choices, list) and choices and isinstance(choices[0], dict):
        candidates.append((choices[0].get("message") or {}).get("tool_calls"))
    names: list[str] = []
    for calls in candidates:
        for call in calls if isinstance(calls, list) else []:
            if isinstance(call, str):
                names.append(call)
            elif isinstance(call, dict):
                name = (call.get("function") or {}).get("name") if isinstance(call.get("function"), dict) else None
                name = name or call.get("name")
                if isinstance(name, str):
                    names.append(name)
    return names


async def plant_document(ingest: dict, timeout: float = 30.0) -> dict:
    """
    POST one document to the app's ingestion endpoint so the RAG Ingestion
    category can then ask a question that should retrieve it. `ingest` carries
    the loopback url, the JSON field the document goes in, request headers, and
    the document text. Only loopback HTTP is allowed.

    Returns {"success": True} or {"success": False, "error": ...}.
    """
    url = assert_loopback_url(ingest["url"])
    field = (ingest.get("field") or "text").strip() or "text"
    body = {field: ingest["document"], **(ingest.get("extra_body") or {})}
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            res = await client.post(url, json=body, headers=ingest.get("headers") or {})
    except httpx.RequestError as exc:
        return {"success": False, "error": str(exc) or type(exc).__name__}
    if not (200 <= res.status_code < 300):
        return {"success": False, "error": f"HTTP {res.status_code}: {res.text[:200]}"}
    return {"success": True}


async def discover_chat_endpoint(
    base_url: str,
    extra_paths: Optional[list[str]] = None,
    timeout: float = 8.0,
    options: Optional[dict] = None,
) -> Optional[DiscoveredEndpoint]:
    """
    Probe chat routes until one accepts a POST with a 2xx and returns usable
    text. `extra_paths` (the target's configured chat path) are tried first.
    `options` carries the target's headers, request_field, response_field and
    extra_body; a stated request_field means only that body shape is tried.
    Only loopback HTTP is allowed.
    """
    options = options or {}
    root = assert_loopback_url(base_url if "://" in base_url else f"http://{base_url}").rstrip("/")
    paths = list(COMMON_PATHS)
    for path in reversed(extra_paths or []):
        if path in paths:
            paths.remove(path)
        paths.insert(0, path)

    fixed_style = style_for(options)
    styles = [fixed_style] if fixed_style else [style for style, _ in BODY_STYLES]
    best: Optional[DiscoveredEndpoint] = None

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        for path in paths:
            url = f"{root}{path}" if path != "/" else f"{root}/"
            for style in styles:
                try:
                    res = await client.post(
                        url,
                        json=build_body(PROBE_MESSAGE, style, extra_body=options.get("extra_body")),
                        headers=options.get("headers") or {},
                    )
                except httpx.RequestError:
                    continue

                # Only a 2xx reply proves this route accepts the body shape.
                # An auth error or validation error is not a chat endpoint.
                if not (200 <= res.status_code < 300):
                    continue

                candidate = DiscoveredEndpoint(url=url, path=path, body_style=style, status_code=res.status_code)
                if read_reply(res, options.get("response_field")):
                    return candidate
                if best is None:
                    best = candidate

    return best


async def send_prompt(
    endpoint: str,
    prompt: str,
    body_style: str = "messages",
    timeout: float = 60.0,
    headers: Optional[dict] = None,
    messages: Optional[list[dict]] = None,
    options: Optional[dict] = None,
    client: Optional[httpx.AsyncClient] = None,
) -> dict:
    """
    Send one prompt to a chat endpoint. Pass `messages` for multi-turn attacks
    so the target sees prior turns. Pass `client` to reuse one connection and
    its cookies across a conversation (apps that keep history per session).

    Returns {"success": True, "response_text": ...} or {"success": False, "error": ...}.
    """
    options = options or {}
    assert_loopback_url(endpoint)
    started = time.perf_counter()
    request = dict(
        json=build_body(prompt, body_style, messages, options.get("extra_body")),
        headers={**(options.get("headers") or {}), **(headers or {})},
    )
    try:
        if client is not None:
            res = await client.post(endpoint, timeout=timeout, **request)
        else:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as one_off:
                res = await one_off.post(endpoint, **request)
    except httpx.RequestError as exc:
        return {
            "success": False,
            "error": str(exc) or type(exc).__name__,
            "error_type": "request_error",
            "response_time_ms": round((time.perf_counter() - started) * 1000, 1),
        }

    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)

    # Anything other than 2xx means the model was not reached (auth, rate
    # limit, validation, crash). That is an error, never a verdict.
    if not (200 <= res.status_code < 300):
        return {
            "success": False,
            "error": f"HTTP {res.status_code}: {res.text[:300]}",
            "error_type": "http_error",
            "status_code": res.status_code,
            "response_time_ms": elapsed_ms,
        }

    text = read_reply(res, options.get("response_field"))
    if text is None and options.get("response_field"):
        return {
            "success": False,
            "error": f"The reply has no '{options['response_field']}' field: {res.text[:200]}",
            "error_type": "shape_error",
            "status_code": res.status_code,
            "response_time_ms": elapsed_ms,
        }

    return {
        "success": True,
        "response_text": text or "",
        "model": "http-target",
        "usage": {},
        "response_time_ms": elapsed_ms,
        "finish_reason": "stop",
        "status_code": res.status_code,
        "tool_calls": extract_tool_calls(res),
    }
