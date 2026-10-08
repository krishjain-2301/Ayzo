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

import os
import time
from typing import Optional

# Use the bundled price table instead of downloading one at import time.
os.environ.setdefault("LITELLM_LOCAL_MODEL_COST_MAP", "True")

import litellm

from app.core.config import settings


# Suppress LiteLLM's verbose logging in production
litellm.set_verbose = False
litellm.suppress_debug_info = True

import asyncio
_global_lock = None
_last_request_time = 0.0

CLAUDE_CLI_PREFIX = "claude-cli/"


async def _claude_cli(cli_model: str, messages: list[dict], timeout: int) -> str:
    """
    Ask Claude through the Claude Code CLI in print mode.

    The prompt can contain attack text, so the CLI is started with no tools,
    no user or project settings, and an empty temporary working directory:
    it can only return text.
    """
    import shutil
    import tempfile

    exe = shutil.which("claude")
    if not exe:
        raise RuntimeError("The 'claude' command was not found. Install Claude Code or choose another model.")

    system = "\n\n".join(m["content"] for m in messages if m.get("role") == "system")
    turns = [m for m in messages if m.get("role") != "system"]
    if len(turns) == 1:
        prompt = turns[0]["content"]
    else:
        prompt = "\n\n".join(f"[{m.get('role', 'user')}]\n{m.get('content', '')}" for m in turns)
        prompt += "\n\nWrite the next assistant message only."

    args = [
        exe, "-p",
        "--model", cli_model,
        "--tools", "",
        "--setting-sources", "",
        "--system-prompt", system or "You are a precise assistant. Answer exactly as asked.",
    ]
    workdir = tempfile.mkdtemp(prefix="ayzo-claude-")
    try:
        process = await asyncio.create_subprocess_exec(
            *args,
            cwd=workdir,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            out, err = await asyncio.wait_for(process.communicate(prompt.encode("utf-8")), timeout=max(timeout, 90))
        except asyncio.TimeoutError:
            process.kill()
            raise RuntimeError("Claude CLI timed out")
        if process.returncode != 0:
            raise RuntimeError(f"Claude CLI failed: {(err or out).decode('utf-8', 'replace')[:300]}")
        return out.decode("utf-8", "replace").strip()
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def get_lock():
    global _global_lock
    if _global_lock is None:
        _global_lock = asyncio.Lock()
    return _global_lock

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
            # Claude through the locally installed Claude Code CLI (no API key)
            # ------------------------------------------------------------------
            if model.startswith(CLAUDE_CLI_PREFIX):
                text = await _claude_cli(model[len(CLAUDE_CLI_PREFIX):] or "haiku", final_messages, timeout)
                return {
                    "success": True,
                    "response_text": text,
                    "model": model,
                    "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                    "response_time_ms": round((time.time() - start_time) * 1000, 2),
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
                lock = get_lock()
                async with lock:
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
