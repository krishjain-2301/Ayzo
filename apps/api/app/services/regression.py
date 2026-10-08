"""
Regression comparison
=====================
Compare a scan with an earlier scan of the same target and say what changed.
An absolute score moves between runs because models are not deterministic;
"which attacks work now that did not work before" is a steadier signal and
the one a pull request should be gated on.

Attacks are matched by category and name. Mutated and model-written attacks
have names that vary between runs, so they can show up as new; the report
lists them separately from library attacks for that reason.
"""

from typing import Iterable


def _key(row: dict) -> tuple[str, str]:
    return (row.get("attack_category") or "unknown", row.get("attack_name") or (row.get("prompt_sent") or "")[:80])


def _is_stable(row: dict) -> bool:
    """Library attacks keep their name between runs; generated ones do not."""
    name = row.get("attack_name") or ""
    return (row.get("mutation_generation") or 0) == 0 and "model-written" not in name


def _summary(row: dict) -> dict:
    return {
        "category": row.get("attack_category"),
        "attack_name": row.get("attack_name"),
        "severity": row.get("severity"),
        "method": (row.get("meta_data") or row.get("metadata") or {}).get("method"),
        "stable_name": _is_stable(row),
    }


def compare_results(current: Iterable[dict], baseline: Iterable[dict]) -> dict:
    """
    new_failures:  fail now, and not a fail in the baseline
    fixed:         fail in the baseline, pass now
    still_failing: fail in both
    """
    now = {_key(r): r for r in current}
    before = {_key(r): r for r in baseline}
    failed_before = {k for k, r in before.items() if r.get("result") == "fail"}

    new_failures, still_failing, fixed = [], [], []
    for key, row in now.items():
        if row.get("result") == "fail":
            (still_failing if key in failed_before else new_failures).append(_summary(row))
        elif row.get("result") == "pass" and key in failed_before:
            fixed.append(_summary(row))

    return {
        "new_failures": new_failures,
        # The ones worth blocking a build on: same attack, same name, now works.
        "new_stable_failures": [f for f in new_failures if f["stable_name"]],
        "fixed": fixed,
        "still_failing": still_failing,
    }
