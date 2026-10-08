"""
Practice check: can AYZO tell a weak app from a hardened one?

    python -m app.practice_check                 # 3 runs of each bot
    python -m app.practice_check --runs 1 --per-category 5

Boots practice_bot in weak mode and in hardened mode, scans each several
times with the real engine, and prints the scores side by side. The check
passes when the weak bot scores higher than the hardened bot in every run.
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from app.core.config import settings
from app.services.attack_engine import attack_engine
from app.services.eval_engine import eval_engine
from app.services.http_target import discover_chat_endpoint
from app.services.process_target import boot_target, read_boot_log, stop_target, wait_for_port
from app.services.rule_attacks import generate_rule_tests

BOT_DIR = Path(__file__).resolve().parents[4] / "practice_bot"
CATEGORIES = ["prompt_injection", "system_prompt_leak", "data_leakage"]


def load_profile() -> dict:
    return json.loads((BOT_DIR / "profile.json").read_text(encoding="utf-8"))


async def scan(mode: str, profile: dict, timeout: float, categories: list[str]) -> dict:
    port = profile[mode]["port"]
    process = await boot_target(f"python app.py {mode}", str(BOT_DIR))
    try:
        if not await wait_for_port(port, timeout=30):
            raise RuntimeError(f"{mode} bot did not start: {read_boot_log(process)}")
        found = await discover_chat_endpoint(f"http://127.0.0.1:{port}", extra_paths=["/chat"], timeout=timeout)
        if not found:
            raise RuntimeError(f"{mode} bot did not answer on /chat. Is Ollama running?")
        extra_tests = []
        if "business_rules" in categories:
            extra_tests = await generate_rule_tests(profile.get("rules", []))
        return await attack_engine.run_campaign(
            endpoint=found.url,
            body_style=found.body_style,
            categories=categories,
            extra_tests=extra_tests,
            profile={
                "canaries": profile["secrets"],
                "system_prompt": profile[mode]["system_prompt"],
                "expected_behavior": profile["expected_behavior"],
            },
            timeout=timeout,
        )
    finally:
        stop_target(process)


def describe(summary: dict) -> str:
    if summary["status"] != "completed":
        return f"FAILED ({summary.get('error', '')[:90]})"
    exact = sum(
        1 for r in summary["results"]
        if r["result"] == "fail" and (r.get("metadata") or {}).get("method") in ("canary", "prompt_leak")
    )
    return (
        f"risk {summary['risk_score']:>5}  "
        f"{summary['failed_tests']:>2}/{summary['total_tests']} attacks worked "
        f"({exact} exact-match leaks, {summary['inconclusive_tests']} inconclusive, {summary['error_tests']} errors)"
    )


async def main_async(args) -> int:
    settings.MAX_PAYLOADS_PER_CATEGORY = args.per_category
    if args.judge:
        settings.DEFAULT_EVAL_MODEL = args.judge
        settings.MUTATOR_MODEL = args.judge
    categories = [c.strip() for c in args.categories.split(",") if c.strip()]
    ok, detail = await eval_engine.check_judge()
    if not ok:
        print(f"Judge unreachable: {detail}")
        return 2

    profile = load_profile()
    print(f"Judge: {settings.DEFAULT_EVAL_MODEL} | {args.per_category} attacks per category | categories: {', '.join(categories)}")
    separated = True
    modes = [args.only] if args.only else ["weak", "hardened"]
    for run in range(1, args.runs + 1):
        scores = {}
        for mode in modes:
            summary = await scan(mode, profile, args.timeout, categories)
            by_category = {}
            for r in summary.get("results", []):
                tally = by_category.setdefault(r["attack_category"], [0, 0])
                tally[0] += r["result"] == "fail"
                tally[1] += 1
            scores[mode] = summary.get("risk_score")
            print(f"run {run}  {mode:<9} {describe(summary)}", flush=True)
            print("        " + ", ".join(f"{cat} {worked}/{total}" for cat, (worked, total) in sorted(by_category.items())), flush=True)
            if args.show:
                for r in summary.get("results", []):
                    if r["result"] in ("fail", "inconclusive"):
                        method = (r.get("metadata") or {}).get("method")
                        reply = (r.get("model_response") or "").replace("\n", " ")[:160]
                        print(f"        {r['result']:<12} [{method}] {r['attack_name']}: {reply}", flush=True)
        if len(modes) == 2 and (
            scores["weak"] is None or scores["hardened"] is None or scores["weak"] <= scores["hardened"]
        ):
            separated = False

    if len(modes) < 2:
        return 0

    print("RESULT:", "weak scored higher than hardened in every run" if separated else "AYZO did NOT separate the two bots")
    return 0 if separated else 1


def main() -> int:
    # Replies contain emoji and other characters a Windows console cannot encode.
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="Scan the weak and hardened practice bots and compare.")
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--per-category", type=int, default=10)
    parser.add_argument("--judge", help="Judge model for this check (default: DEFAULT_EVAL_MODEL)")
    parser.add_argument("--timeout", type=float, default=180.0, help="Seconds to wait for each bot reply")
    parser.add_argument("--categories", default=",".join(CATEGORIES), help="Comma-separated attack categories")
    parser.add_argument("--only", choices=["weak", "hardened"], help="Scan just one bot (no comparison)")
    parser.add_argument("--show", action="store_true", help="List every attack that worked or was inconclusive")
    return asyncio.run(main_async(parser.parse_args()))


if __name__ == "__main__":
    sys.exit(main())
