"""
AYZO command line
=================
Talks to a running AYZO API. Meant for terminals and CI jobs.

    ayzo targets
    ayzo scan --target "Practice bot (weak)" --categories prompt_injection,indirect_injection
    ayzo scan --target <id> --fail-on new --sarif ayzo.sarif --junit ayzo.xml

(`python -m app.cli ...` works the same when the `ayzo` command is not installed.)

--fail-on decides the exit code:
    score   exit 1 when the risk score is above the API's threshold (default)
    new     exit 1 when a library attack works now that did not work in the
            previous completed scan of the same target
    any     exit 1 when any attack worked
    never   always exit 0 unless the scan itself failed

A scan that fails or is cancelled exits 2 whatever --fail-on says: no verdict
is not a pass.
"""

import argparse
import json
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import httpx

DEFAULT_API = "http://127.0.0.1:8000"
SARIF_LEVEL = {"critical": "error", "high": "error", "medium": "warning", "low": "note", "info": "note"}


class Api:
    def __init__(self, base: str):
        self.client = httpx.Client(base_url=base.rstrip("/") + "/api/v1", timeout=60)

    def call(self, method: str, path: str, **kwargs):
        try:
            response = self.client.request(method, path, **kwargs)
        except httpx.RequestError as exc:
            sys.exit(f"Cannot reach the AYZO API at {self.client.base_url}: {exc}")
        if response.status_code >= 400:
            try:
                detail = response.json().get("detail")
            except ValueError:
                detail = response.text[:200]
            sys.exit(f"API error {response.status_code} on {path}: {detail}")
        return response.json() if response.content else None


def find_target(api: Api, wanted: str) -> dict:
    targets = api.call("GET", "/targets")
    matches = [t for t in targets if t["id"] == wanted or t["name"].lower() == wanted.lower()]
    if len(matches) != 1:
        names = ", ".join(f'"{t["name"]}"' for t in targets) or "none registered"
        sys.exit(f'Target "{wanted}" not found (or the name is not unique). Targets: {names}')
    return matches[0]


def to_sarif(failures: list[dict], target: dict, source_file: str) -> dict:
    """SARIF 2.1.0, one result per attack that worked. Rules are the attack categories."""
    categories = sorted({f["attack_category"] or "unknown" for f in failures})
    taxonomy = {f["attack_category"] or "unknown": f.get("taxonomy") or {} for f in failures}

    def tags(category: str) -> list[str]:
        tax = taxonomy.get(category) or {}
        found = [(tax.get("owasp") or {}).get("id"), (tax.get("atlas") or {}).get("id")]
        return ["security", "llm"] + [t for t in found if t]

    return {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [{
            "tool": {"driver": {
                "name": "AYZO",
                "informationUri": "https://github.com/krishjain-2301/Ayzo",
                "rules": [
                    {
                        "id": c,
                        "name": c.replace("_", " ").title(),
                        "shortDescription": {"text": f"{c.replace('_', ' ')} attack succeeded"},
                        "properties": {"tags": tags(c)},
                    }
                    for c in categories
                ],
            }},
            "results": [
                {
                    "ruleId": f["attack_category"] or "unknown",
                    "level": SARIF_LEVEL.get(f.get("severity") or "medium", "warning"),
                    "message": {"text": (
                        f"{f.get('attack_name') or 'Attack'} worked against {target['name']} "
                        f"({'exact match: ' + f['method'] if f.get('method') not in (None, 'judge') else 'judge opinion'}). "
                        f"{(f.get('eval_reasoning') or '')[:400]}"
                    )},
                    "locations": [{"physicalLocation": {"artifactLocation": {"uri": source_file}, "region": {"startLine": 1}}}],
                    "properties": {
                        "prompt": (f.get("prompt_sent") or "")[:2000],
                        "reply": (f.get("model_response") or "")[:2000],
                        "method": f.get("method"),
                    },
                }
                for f in failures
            ],
        }],
    }


def to_junit(results: list[dict], target: dict) -> str:
    suite = ET.Element("testsuite", name=f"AYZO: {target['name']}", tests=str(len(results)))
    counts = {"fail": 0, "error": 0, "inconclusive": 0}
    for r in results:
        case = ET.SubElement(suite, "testcase", classname=r.get("attack_category") or "unknown", name=r.get("attack_name") or "attack")
        if r["result"] == "fail":
            counts["fail"] += 1
            node = ET.SubElement(case, "failure", message=(r.get("eval_reasoning") or "attack worked")[:300])
            node.text = f"PROMPT:\n{r.get('prompt_sent') or ''}\n\nREPLY:\n{r.get('model_response') or ''}"
        elif r["result"] == "error":
            counts["error"] += 1
            ET.SubElement(case, "error", message=(r.get("eval_reasoning") or "target error")[:300])
        elif r["result"] == "inconclusive":
            counts["inconclusive"] += 1
            ET.SubElement(case, "skipped", message=(r.get("eval_reasoning") or "no verdict")[:300])
    suite.set("failures", str(counts["fail"]))
    suite.set("errors", str(counts["error"]))
    suite.set("skipped", str(counts["inconclusive"]))
    return ET.tostring(suite, encoding="unicode")


def cmd_targets(api: Api, args) -> int:
    for t in api.call("GET", "/targets"):
        profile = f"{len(t.get('canaries') or [])} protected values, chat path {t.get('chat_path') or 'auto'}"
        print(f"{t['id']}  {t['name']}  (port {t['target_port']}; {profile})")
    return 0


def cmd_scan(api: Api, args) -> int:
    target = find_target(api, args.target)
    categories = [c.strip() for c in args.categories.split(",") if c.strip()]
    started = api.call("POST", "/cicd/run", json={
        "name": args.name or f"CLI scan of {target['name']}",
        "target_id": target["id"],
        "attack_categories": categories,
        "mutation_depth": args.mutation_depth,
        "trials": args.trials,
        "adaptive_rounds": args.adaptive_rounds,
        **({"seed": args.seed} if args.seed is not None else {}),
    })
    campaign_id = started["campaign_id"]
    print(f"Scanning {target['name']} ({', '.join(categories)}). Campaign {campaign_id}")

    deadline = time.time() + args.timeout
    last = -1
    while True:
        poll = api.call("GET", f"/cicd/poll/{campaign_id}")
        if poll["completed_tests"] != last and poll["total_tests"]:
            last = poll["completed_tests"]
            print(f"  {poll['completed_tests']}/{poll['total_tests']} tests, {poll['failed_tests']} worked", flush=True)
        if poll["status"] in ("completed", "failed", "cancelled"):
            break
        if time.time() > deadline:
            api.call("POST", f"/campaigns/{campaign_id}/cancel")
            print("Timed out; cancel requested.")
            return 2
        time.sleep(args.interval)

    results = api.call("GET", f"/reports/campaign/{campaign_id}/results")
    failures = [r for r in results if r["result"] == "fail"]
    if args.sarif:
        Path(args.sarif).write_text(json.dumps(to_sarif(failures, target, args.source_file), indent=2), encoding="utf-8")
        print(f"Wrote {args.sarif}")
    if args.junit:
        Path(args.junit).write_text(to_junit(results, target), encoding="utf-8")
        print(f"Wrote {args.junit}")

    if poll["status"] != "completed":
        print(f"\nScan {poll['status']}: {poll.get('detail')}")
        return 2

    exact = sum(1 for f in failures if f.get("method") not in (None, "judge"))
    print(f"\nRisk score {poll['risk_score']} (build threshold {poll['fail_threshold']})")
    print(f"{len(failures)} of {poll['total_tests']} attacks worked: {exact} confirmed by exact match, {len(failures) - exact} by judge opinion")
    for f in failures[:args.show]:
        tag = f["method"] if f.get("method") not in (None, "judge") else "judge"
        print(f"  [{f.get('severity')}/{tag}] {f.get('attack_category')}: {f.get('attack_name')}")
    if len(failures) > args.show:
        print(f"  ... and {len(failures) - args.show} more")

    comparison = api.call("GET", f"/campaigns/{campaign_id}/compare")
    new_stable = comparison.get("new_stable_failures", [])
    if comparison.get("baseline_id"):
        print(
            f"\nCompared with \"{comparison['baseline_name']}\": {len(comparison['new_failures'])} new "
            f"({len(new_stable)} library attacks), {len(comparison['fixed'])} fixed, {len(comparison['still_failing'])} still failing"
        )
        for f in new_stable[:args.show]:
            print(f"  NEW [{f.get('severity')}] {f.get('category')}: {f.get('attack_name')}")
    else:
        print("\nNo earlier completed scan of this target to compare with.")

    if args.fail_on == "score":
        blocked = bool(poll["should_fail_build"])
    elif args.fail_on == "new":
        # With nothing to compare against, every failure is new.
        blocked = bool(new_stable) if comparison.get("baseline_id") else bool(failures)
    elif args.fail_on == "any":
        blocked = bool(failures)
    else:
        blocked = False
    print("\nRESULT:", f"BLOCKED (--fail-on {args.fail_on})" if blocked else f"ok (--fail-on {args.fail_on})")
    return 1 if blocked else 0


def main() -> int:
    # Replies contain emoji and other characters a Windows console cannot encode.
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(prog="ayzo", description="Run AYZO scans from a terminal or CI job.")
    parser.add_argument("--api", default=DEFAULT_API, help=f"AYZO API base URL (default {DEFAULT_API})")
    commands = parser.add_subparsers(dest="command", required=True)

    commands.add_parser("targets", help="List registered targets").set_defaults(run=cmd_targets)

    scan = commands.add_parser("scan", help="Run a scan and report the result")
    scan.add_argument("--target", required=True, help="Target name or id")
    scan.add_argument("--categories", default="prompt_injection,system_prompt_leak,indirect_injection")
    scan.add_argument("--mutation-depth", type=int, default=0)
    scan.add_argument("--trials", type=int, default=1, help="Send each attack this many times (1-5)")
    scan.add_argument("--adaptive-rounds", type=int, default=0, help="Rounds of the adaptive attacker (0-3)")
    scan.add_argument("--seed", type=int, help="Repeat a scan's random choices")
    scan.add_argument("--name", help="Name for the campaign")
    scan.add_argument("--fail-on", choices=["score", "new", "any", "never"], default="score")
    scan.add_argument("--sarif", help="Write findings as SARIF 2.1.0 to this file")
    scan.add_argument("--junit", help="Write all results as JUnit XML to this file")
    scan.add_argument("--source-file", default="README.md", help="File the SARIF results point at (GitHub needs one)")
    scan.add_argument("--timeout", type=int, default=3600, help="Give up after this many seconds")
    scan.add_argument("--interval", type=float, default=3.0, help="Seconds between status checks")
    scan.add_argument("--show", type=int, default=15, help="How many findings to list")
    scan.set_defaults(run=cmd_scan)

    args = parser.parse_args()
    return args.run(Api(args.api), args)


if __name__ == "__main__":
    sys.exit(main())
