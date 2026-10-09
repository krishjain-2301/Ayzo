from app.judge_bench.__main__ import load_cases, summarise

VALID_CATEGORIES = {
    "prompt_injection", "system_prompt_leak", "data_leakage", "insecure_output_handling",
    "agent_misuse", "excessive_agency", "vector_weaknesses", "context_manipulation",
    "advanced_bypasses", "role_override", "jailbreak",
}


def test_benchmark_cases_are_well_formed():
    app_description, cases = load_cases()
    assert app_description
    assert len(cases) >= 60
    ids = [c["id"] for c in cases]
    assert len(ids) == len(set(ids))
    for case in cases:
        assert case["expected"] in ("pass", "fail"), case["id"]
        assert case["category"] in VALID_CATEGORIES, case["id"]
        assert case["attack"].strip() and case["reply"].strip() and case["kind"], case["id"]
    # Both sides must be well represented or the rates mean little.
    assert sum(c["expected"] == "fail" for c in cases) >= 25
    assert sum(c["expected"] == "pass" for c in cases) >= 25


def test_summary_counts_caught_and_false_alarms():
    rows = [
        {"id": "a", "kind": "leak", "expected": "fail", "got": "fail", "method": "judge", "why": ""},
        {"id": "b", "kind": "leak", "expected": "fail", "got": "pass", "method": "judge", "why": ""},
        {"id": "c", "kind": "refusal", "expected": "pass", "got": "pass", "method": "judge", "why": ""},
        {"id": "d", "kind": "refusal", "expected": "pass", "got": "fail", "method": "judge", "why": ""},
        {"id": "e", "kind": "refusal", "expected": "pass", "got": "inconclusive", "method": "judge", "why": ""},
    ]
    result = summarise("test-model", rows, 1.0)
    assert result["caught_rate"] == 0.5
    assert result["false_alarm_rate"] == round(1 / 3, 3)
    assert result["no_verdict"] == 1
    assert result["meets_targets"] is False
    assert {w["id"] for w in result["wrong"]} == {"b", "d", "e"}


def test_heldout_set_is_well_formed_and_separate():
    _, tuning = load_cases("tuning")
    app_description, heldout = load_cases("heldout")
    assert app_description and len(heldout) >= 30
    assert not {c["id"] for c in tuning} & {c["id"] for c in heldout}
    assert not {c["reply"] for c in tuning} & {c["reply"] for c in heldout}
    assert sum(1 for c in heldout if c.get("rule")) >= 6
    for case in heldout:
        assert case["expected"] in ("pass", "fail"), case["id"]
