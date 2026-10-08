import json

import pytest

from app.core.config import settings
from app.services import model_settings as ms


@pytest.fixture
def isolated(tmp_path, monkeypatch):
    """Point settings at a temp file and restore the process state afterwards."""
    monkeypatch.setattr(ms, "SETTINGS_FILE", tmp_path / "settings.json")
    for provider in ms.PROVIDERS.values():
        monkeypatch.delenv(provider["env"], raising=False)
    monkeypatch.setattr(settings, "DEFAULT_EVAL_MODEL", "ollama/gemma3:4b")
    monkeypatch.setattr(settings, "MUTATOR_MODEL", None)
    return tmp_path / "settings.json"


def test_provider_of():
    assert ms.provider_of("ollama/qwen2.5:7b") == "ollama"
    assert ms.provider_of("claude-cli/haiku") == "claude-cli"
    assert ms.provider_of("anthropic/claude-haiku-5-5") == "anthropic"
    assert ms.provider_of("claude-sonnet-5-5") == "anthropic"
    assert ms.provider_of("openai/gpt-4o-mini") == "openai"
    assert ms.provider_of("gpt-4o") == "openai"
    assert ms.provider_of("gemini/gemini-2.0-flash") == "gemini"
    assert ms.provider_of("groq/llama-3.3-70b-versatile") == "groq"
    assert ms.provider_of("something-else") is None
    assert ms.is_local("ollama/gemma3:4b") and not ms.is_local("openai/gpt-4o")


def test_local_model_needs_no_key(isolated):
    ms.save(eval_model="ollama/qwen2.5:7b")
    assert settings.DEFAULT_EVAL_MODEL == "ollama/qwen2.5:7b"
    assert json.loads(isolated.read_text())["eval_model"] == "ollama/qwen2.5:7b"


def test_online_model_is_refused_without_a_key(isolated):
    with pytest.raises(ValueError, match="needs an API key"):
        ms.save(eval_model="openai/gpt-4o-mini")
    assert settings.DEFAULT_EVAL_MODEL == "ollama/gemma3:4b"
    assert ms.missing_key_for("openai/gpt-4o-mini") == "openai"


def test_model_and_key_can_be_saved_together(isolated, monkeypatch):
    ms.save(eval_model="anthropic/claude-haiku-5-5", api_keys={"anthropic": "sk-ant-test-1234567890"})
    assert settings.DEFAULT_EVAL_MODEL == "anthropic/claude-haiku-5-5"
    assert ms.key_is_set("anthropic")
    assert ms.missing_key_for("anthropic/claude-haiku-5-5") is None

    # A restart: nothing in the environment, everything comes back from the file.
    monkeypatch.delenv("ANTHROPIC_API_KEY")
    monkeypatch.setattr(settings, "DEFAULT_EVAL_MODEL", "ollama/gemma3:4b")
    assert ms.apply_saved() is True
    assert settings.DEFAULT_EVAL_MODEL == "anthropic/claude-haiku-5-5"
    assert ms.key_is_set("anthropic")


def test_removing_a_key_and_bad_input(isolated):
    ms.save(api_keys={"groq": "gsk_test_1234567890"})
    assert ms.key_is_set("groq")
    ms.save(api_keys={"groq": ""})
    assert not ms.key_is_set("groq")
    assert "groq" not in json.loads(isolated.read_text())["api_keys"]

    for bad in ({"api_keys": {"nope": "x" * 20}}, {"api_keys": {"openai": "short"}}, {"eval_model": "mystery-model"}):
        with pytest.raises(ValueError):
            ms.save(**bad)


def test_mutator_can_differ_or_follow_the_judge(isolated):
    ms.save(eval_model="claude-cli/haiku", mutator_model="ollama/gemma3:4b")
    assert settings.MUTATOR_MODEL == "ollama/gemma3:4b"
    ms.save(mutator_model="")
    assert settings.MUTATOR_MODEL is None


async def test_overview_never_contains_a_key(isolated):
    secret = "sk-proj-super-secret-123456"
    ms.save(api_keys={"openai": secret})
    overview = await ms.overview()
    assert secret not in json.dumps(overview)
    assert next(p for p in overview["providers"] if p["id"] == "openai")["key_set"] is True
    assert next(p for p in overview["providers"] if p["id"] == "groq")["key_set"] is False
    assert "ollama" in overview["local"] and "claude_cli" in overview["local"]


def test_placeholder_key_from_env_example_does_not_count(isolated, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "your_groq_api_key_here")
    assert not ms.key_is_set("groq")
