"""
Model settings
==============
Which model judges replies and which one writes attacks, chosen in the
dashboard instead of by editing .env.

- Local models need no key: anything installed in Ollama, or Claude through
  the Claude Code CLI.
- Online models need that provider's API key, which the user enters once.

Choices and keys are saved to apps/api/data/settings.json (git-ignored, on
this machine only) and applied on startup, where they take precedence over
.env. Keys are never returned by the API, only whether one is set.
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Optional

import httpx

from app.core.config import settings

SETTINGS_FILE = Path(__file__).resolve().parents[2] / "data" / "settings.json"
OLLAMA_URL = os.environ.get("OLLAMA_API_BASE", "http://127.0.0.1:11434").rstrip("/")
CLAUDE_CLI_MODELS = ["haiku", "sonnet", "opus"]

# Online providers. `models` are suggestions; any model id the provider offers
# can be typed in. `prefix` is what LiteLLM expects in front of the model id.
PROVIDERS: dict[str, dict] = {
    "anthropic": {
        "name": "Anthropic (Claude API)",
        "env": "ANTHROPIC_API_KEY",
        "prefix": "anthropic/",
        "models": ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"],
        "key_url": "https://console.anthropic.com/settings/keys",
    },
    "openai": {
        "name": "OpenAI",
        "env": "OPENAI_API_KEY",
        "prefix": "openai/",
        "models": ["gpt-4o-mini", "gpt-4o"],
        "key_url": "https://platform.openai.com/api-keys",
    },
    "gemini": {
        "name": "Google Gemini",
        "env": "GEMINI_API_KEY",
        "prefix": "gemini/",
        "models": ["gemini-2.0-flash", "gemini-1.5-flash"],
        "key_url": "https://aistudio.google.com/apikey",
    },
    "groq": {
        "name": "Groq",
        "env": "GROQ_API_KEY",
        "prefix": "groq/",
        "models": ["llama-3.3-70b-versatile"],
        "key_url": "https://console.groq.com/keys",
    },
}


def provider_of(model: str) -> Optional[str]:
    """'ollama', 'claude-cli', an online provider id, or None when unrecognised."""
    model = (model or "").strip()
    if model.startswith(("ollama/", "ollama_chat/")):
        return "ollama"
    if model.startswith("claude-cli/"):
        return "claude-cli"
    for provider_id, provider in PROVIDERS.items():
        if model.startswith(provider["prefix"]):
            return provider_id
    # Bare ids LiteLLM also accepts.
    if model.startswith(("gpt-", "o1", "o3", "o4")):
        return "openai"
    if model.startswith("claude-"):
        return "anthropic"
    return None


def is_local(model: str) -> bool:
    return provider_of(model) in ("ollama", "claude-cli")


def key_is_set(provider_id: str) -> bool:
    value = (os.environ.get(PROVIDERS[provider_id]["env"]) or "").strip()
    return bool(value) and "your_" not in value and not value.endswith("_here")


def missing_key_for(model: str) -> Optional[str]:
    """The provider whose key this model needs and does not have, if any."""
    provider_id = provider_of(model)
    if provider_id in PROVIDERS and not key_is_set(provider_id):
        return provider_id
    return None


def _read() -> dict:
    try:
        data = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _write(data: dict) -> None:
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def apply_saved() -> bool:
    """Apply settings.json to the running process. Returns False when there is none."""
    data = _read()
    if not data:
        return False
    for provider_id, key in (data.get("api_keys") or {}).items():
        if provider_id in PROVIDERS and key:
            os.environ[PROVIDERS[provider_id]["env"]] = key
    if data.get("eval_model"):
        settings.DEFAULT_EVAL_MODEL = data["eval_model"]
    if "mutator_model" in data:
        settings.MUTATOR_MODEL = data["mutator_model"] or None
    return True


def save(
    eval_model: Optional[str] = None,
    mutator_model: Optional[str] = None,
    api_keys: Optional[dict[str, str]] = None,
) -> None:
    """
    Save and apply. Keys first, so a model and its key can arrive together.
    An empty string removes a key. An empty mutator_model means "same as the
    judge". Raises ValueError when a chosen model's provider has no key.
    """
    data = _read()
    stored_keys = dict(data.get("api_keys") or {})

    for provider_id, key in (api_keys or {}).items():
        if provider_id not in PROVIDERS:
            raise ValueError(f"Unknown provider: {provider_id}")
        key = (key or "").strip()
        env = PROVIDERS[provider_id]["env"]
        if key:
            if len(key) < 8 or any(c.isspace() for c in key):
                raise ValueError(f"That does not look like a {PROVIDERS[provider_id]['name']} API key.")
            stored_keys[provider_id] = key
            os.environ[env] = key
        else:
            stored_keys.pop(provider_id, None)
            os.environ.pop(env, None)

    for label, model in (("judge", eval_model), ("attacker", mutator_model)):
        if not model:
            continue
        if provider_of(model) is None:
            raise ValueError(
                f"Unrecognised {label} model '{model}'. Use ollama/<name>, claude-cli/<name>, "
                "or a provider prefix such as openai/, anthropic/, gemini/, groq/."
            )
        missing = missing_key_for(model)
        if missing:
            raise ValueError(f"{PROVIDERS[missing]['name']} needs an API key before '{model}' can be used.")

    data["api_keys"] = stored_keys
    if eval_model:
        data["eval_model"] = eval_model.strip()
    if mutator_model is not None:
        data["mutator_model"] = mutator_model.strip()
    _write(data)
    apply_saved()


async def detect_local() -> dict:
    """What can run on this machine without a key."""
    ollama = {"running": False, "models": []}
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags")
        if response.status_code == 200:
            ollama["running"] = True
            names = {m["name"] for m in response.json().get("models", []) if m.get("name")}
            # Skip internal entries whose tag is a content hash rather than a version.
            ollama["models"] = sorted(n for n in names if len(n.rsplit(":", 1)[-1]) < 40)
    except (httpx.RequestError, ValueError):
        pass
    return {
        "ollama": ollama,
        "claude_cli": {"installed": shutil.which("claude") is not None, "models": CLAUDE_CLI_MODELS},
    }


async def overview() -> dict:
    """Everything the settings page needs. API keys are reported only as set / not set."""
    local = await detect_local()
    judge = settings.DEFAULT_EVAL_MODEL
    return {
        "eval_model": judge,
        "mutator_model": settings.MUTATOR_MODEL or "",
        "effective_mutator_model": settings.MUTATOR_MODEL or judge,
        "eval_model_missing_key": missing_key_for(judge),
        "local": local,
        "providers": [
            {
                "id": provider_id,
                "name": provider["name"],
                "prefix": provider["prefix"],
                "models": provider["models"],
                "key_set": key_is_set(provider_id),
                "key_url": provider["key_url"],
            }
            for provider_id, provider in PROVIDERS.items()
        ],
    }
