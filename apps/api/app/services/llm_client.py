"""
LLM Client Service
===================
A unified interface to talk to ANY LLM provider.

The problem:
- Ollama uses one API format
- OpenAI uses a different format
- Anthropic has yet another format

The solution:
LiteLLM wraps all of them with ONE consistent interface.
You just specify "ollama/llama3.2" or "gpt-4" and it handles
the rest (formatting, auth, retries, etc.)

Think of it like a universal adapter — plug in any model,
get the same interface.

FIX: chat() now accepts an optional `messages` parameter so callers
(e.g. the conversational runner) can pass a full multi-turn history
directly instead of serialising it as a plain string.
"""

import json
import time
from typing import Optional

import httpx
import litellm

from app.core.config import settings


# Suppress LiteLLM's verbose logging in production
litellm.set_verbose = settings.DEBUG

import asyncio
_global_lock = asyncio.Lock()
_last_request_time = 0.0

class LLMClient:
    """
    Unified client for talking to any LLM.

    Usage:
        client = LLMClient()

        # Single-turn (convenience)
        response = await client.chat("ollama/llama3.2", "What is 2+2?")

        # Multi-turn (pass full history)
        response = await client.chat(
            "ollama/llama3.2",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user",   "content": "Hello"},
                {"role": "assistant", "content": "Hi! How can I help?"},
                {"role": "user",   "content": "What is 2+2?"},
            ]
        )
    """

    async def chat(
        self,
        model: str,
        user_message: Optional[str] = None,
        system_message: Optional[str] = None,
        messages: Optional[list[dict]] = None,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        timeout: int = 60,
        config: Optional[dict] = None,
    ) -> dict:
        """
        Send a message (or full history) to an LLM and get a response.

        Args:
            model:          LiteLLM model string, e.g. "ollama/llama3.2"
            user_message:   Convenience shortcut for a single user turn.
                            Ignored when `messages` is provided.
            system_message: Prepended as a system role message.
                            Ignored when `messages` is provided.
            messages:       Full OpenAI-format message list. When supplied,
                            `user_message` and `system_message` are ignored.
            api_key:        Target API key (forwarded to LiteLLM).
            api_base:       Target endpoint URL override.
            temperature:    Sampling temperature (0 = deterministic).
            max_tokens:     Maximum tokens in the response.
            timeout:        Request timeout in seconds.
            config:         Extra model-specific config dict.

        Returns:
            {
                "success": bool,
                "response_text": str,       # on success
                "model": str,
                "usage": {...},
                "response_time_ms": float,
                "finish_reason": str,
                "error": str,               # on failure
                "error_type": str,          # on failure
            }
        """
        # Build the messages list ------------------------------------------------
        if messages is not None:
            # Caller supplied a full history — use it verbatim
            final_messages = messages
        else:
            # Single-turn convenience path
            final_messages = []
            if system_message:
                final_messages.append({"role": "system", "content": system_message})
            if user_message is not None:
                final_messages.append({"role": "user", "content": user_message})

        start_time = time.time()

        try:
            # ------------------------------------------------------------------
            # Dummy target (in-process, no network call)
            # ------------------------------------------------------------------
            if model == "dummy":
                from app.api.v1.endpoints.dummy import chat_with_dummy_ai, ChatRequest
                # Extract the last user message for the dummy target
                last_user = next(
                    (m["content"] for m in reversed(final_messages) if m["role"] == "user"),
                    "",
                )
                dummy_resp = await chat_with_dummy_ai(ChatRequest(prompt=last_user))
                elapsed_ms = (time.time() - start_time) * 1000
                return {
                    "success": True,
                    "response_text": dummy_resp.response,
                    "model": "dummy",
                    "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                    "response_time_ms": round(elapsed_ms, 2),
                    "finish_reason": "stop",
                }

            # ------------------------------------------------------------------
            # Custom webhook target
            # ------------------------------------------------------------------
            if model == "custom_webhook":
                if not api_base:
                    raise ValueError("api_base (URL) is required for custom_webhook")

                cfg = config or {}
                headers = cfg.get("headers", {})
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"

                # Use only the last user message for webhook payloads
                last_user = next(
                    (m["content"] for m in reversed(final_messages) if m["role"] == "user"),
                    "",
                )
                payload_template = cfg.get("payload_template", {"prompt": "{{prompt}}"})
                payload_str = json.dumps(payload_template).replace("{{prompt}}", last_user)
                payload = json.loads(payload_str)

                async with httpx.AsyncClient(timeout=timeout) as client:
                    resp = await client.post(api_base, json=payload, headers=headers)
                    resp.raise_for_status()
                    resp_data = resp.json()

                json_path = cfg.get("response_json_path", "response")
                response_text = resp_data.get(json_path, str(resp_data))

                elapsed_ms = (time.time() - start_time) * 1000
                return {
                    "success": True,
                    "response_text": str(response_text),
                    "model": "custom_webhook",
                    "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                    "response_time_ms": round(elapsed_ms, 2),
                    "finish_reason": "stop",
                }

            # ------------------------------------------------------------------
            # Any LiteLLM-supported provider (Ollama, OpenAI, Anthropic, etc.)
            # ------------------------------------------------------------------
            import asyncio
            import time as _time
            global _global_lock, _last_request_time
            
            delay = 0.0
            if "gemini" in model.lower():
                delay = 4.1
            elif "groq" in model.lower():
                delay = 2.1
                
            if delay > 0:
                async with _global_lock:
                    now = _time.time()
                    time_since_last = now - _last_request_time
                    if time_since_last < delay:
                        await asyncio.sleep(delay - time_since_last)
                    _last_request_time = _time.time()
            
            response = await litellm.acompletion(
                model=model,
                messages=final_messages,
                api_key=api_key,
                api_base=api_base,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout,
                num_retries=2,
            )

            elapsed_ms = (time.time() - start_time) * 1000

            return {
                "success": True,
                "response_text": response.choices[0].message.content,
                "model": model,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                    "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                    "total_tokens": response.usage.total_tokens if response.usage else 0,
                },
                "response_time_ms": round(elapsed_ms, 2),
                "finish_reason": response.choices[0].finish_reason,
            }

        except litellm.exceptions.AuthenticationError as exc:
            return {
                "success": False,
                "error": f"Authentication failed: {exc}",
                "error_type": "auth_error",
                "response_time_ms": (time.time() - start_time) * 1000,
            }
        except litellm.exceptions.RateLimitError as exc:
            return {
                "success": False,
                "error": f"Rate limited: {exc}",
                "error_type": "rate_limit",
                "response_time_ms": (time.time() - start_time) * 1000,
            }
        except litellm.exceptions.Timeout:
            return {
                "success": False,
                "error": f"Request timed out after {timeout}s",
                "error_type": "timeout",
                "response_time_ms": (time.time() - start_time) * 1000,
            }
        except Exception as exc:
            return {
                "success": False,
                "error": str(exc),
                "error_type": "unknown",
                "response_time_ms": (time.time() - start_time) * 1000,
            }

    async def test_connection(
        self,
        model: str,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
    ) -> dict:
        """
        Test if we can reach a model. Sends a simple "Hello" message.
        Used when adding a new target to verify the connection works.

        Returns:
            {"success": bool, "message": str, "response_time_ms": float}
        """
        result = await self.chat(
            model=model,
            user_message="Hello! Please respond with 'Connection successful.' and nothing else.",
            api_key=api_key,
            api_base=api_base,
            max_tokens=50,
            timeout=15,
        )

        if result["success"]:
            return {
                "success": True,
                "message": f"Successfully connected to {model}",
                "response_time_ms": result["response_time_ms"],
            }
        else:
            return {
                "success": False,
                "message": f"Failed to connect: {result['error']}",
                "response_time_ms": result.get("response_time_ms", 0),
            }


# Singleton instance — use this throughout the app
llm_client = LLMClient()
