"""
HTTP target client — discover a chat endpoint and send adversarial prompts.

Real LLM apps do not all speak the same JSON. We probe common paths and
body shapes, then reuse whichever combination actually returned text.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import httpx

PROBE_MESSAGE = "hello"

COMMON_PATHS = (
    "/api/v1/dummy/chat",
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


@dataclass(frozen=True)
class DiscoveredEndpoint:
    url: str
    path: str
    body_style: str
    status_code: int


def build_body(prompt: str, body_style: str) -> dict:
    for style, builder in BODY_STYLES:
        if style == body_style:
            return builder(prompt)
    return {"messages": [{"role": "user", "content": prompt}]}


def extract_response_text(payload: Any) -> Optional[str]:
    """Pull assistant text out of common chat JSON envelopes."""
    if payload is None:
        return None
    if isinstance(payload, str):
        text = payload.strip()
        return text or None
    if isinstance(payload, (int, float, bool)):
        return str(payload)
    if isinstance(payload, list):
        parts = [extract_response_text(item) for item in payload]
        joined = "\n".join(p for p in parts if p)
        return joined or None
    if not isinstance(payload, dict):
        return str(payload)

    for key in (
        "response",
        "response_text",
        "content",
        "text",
        "output",
        "output_text",
        "reply",
        "answer",
        "message",
        "result",
        "completion",
        "generated_text",
    ):
        if key in payload and payload[key] is not None:
            value = payload[key]
            if key == "message" and isinstance(value, dict):
                inner = extract_response_text(value)
                if inner:
                    return inner
            elif isinstance(value, str) and value.strip():
                return value
            elif not isinstance(value, str):
                inner = extract_response_text(value)
                if inner:
                    return inner

    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            msg = first.get("message") or first.get("delta") or first
            if isinstance(msg, dict) and msg.get("content"):
                return str(msg["content"])
            if first.get("text"):
                return str(first["text"])

    data = payload.get("data")
    if data is not None and data is not payload:
        inner = extract_response_text(data)
        if inner:
            return inner

    return None


async def discover_chat_endpoint(
    base_url: str,
    extra_paths: Optional[list[str]] = None,
    timeout: float = 8.0,
) -> Optional[DiscoveredEndpoint]:
    """
    Probe common chat routes until one accepts a POST and returns usable text
    (or at least a non-404 JSON body we can keep attacking).
    """
    root = base_url.rstrip("/")
    paths = list(COMMON_PATHS)
    if extra_paths:
        for path in extra_paths:
            if path not in paths:
                paths.insert(0, path)

    best: Optional[DiscoveredEndpoint] = None

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        for path in paths:
            url = f"{root}{path}" if path != "/" else f"{root}/"
            for style, builder in BODY_STYLES:
                try:
                    res = await client.post(url, json=builder(PROBE_MESSAGE))
                except httpx.RequestError:
                    continue

                if res.status_code in (404, 405, 501):
                    continue
                if res.status_code >= 500:
                    continue

                text = None
                try:
                    text = extract_response_text(res.json())
                except Exception:
                    text = (res.text or "").strip() or None

                candidate = DiscoveredEndpoint(
                    url=url,
                    path=path,
                    body_style=style,
                    status_code=res.status_code,
                )
                if text:
                    return candidate
                if best is None and 200 <= res.status_code < 400:
                    best = candidate

    return best


async def send_prompt(
    endpoint: str,
    prompt: str,
    body_style: str = "messages",
    timeout: float = 60.0,
    headers: Optional[dict] = None,
) -> dict:
    """
    Send one user prompt to a discovered HTTP chat endpoint.

    Returns the same shape as LLMClient.chat() so TestRunner can stay generic.
    """
    import time

    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            res = await client.post(
                endpoint,
                json=build_body(prompt, body_style),
                headers=headers or {},
            )
    except httpx.RequestError as exc:
        return {
            "success": False,
            "error": str(exc),
            "error_type": "request_error",
            "response_time_ms": round((time.perf_counter() - started) * 1000, 1),
        }

    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)

    if res.status_code >= 500:
        return {
            "success": False,
            "error": f"HTTP {res.status_code}: {res.text[:300]}",
            "error_type": "http_error",
            "response_time_ms": elapsed_ms,
        }

    text = None
    try:
        text = extract_response_text(res.json())
    except Exception:
        text = res.text

    if not text:
        text = res.text or ""

    return {
        "success": True,
        "response_text": text,
        "model": "http-target",
        "usage": {},
        "response_time_ms": elapsed_ms,
        "finish_reason": "stop",
        "status_code": res.status_code,
    }
