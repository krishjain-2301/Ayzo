"""
External harmful-content benchmarks, loaded by reference
=======================================================
HarmBench and JailbreakBench are lists of requests for genuinely harmful
content. AYZO does not ship their text: committing thousands of harmful
strings into this repository would turn it into a catalogue of how-to-harm
requests. Instead the user clones those repositories themselves and points
AYZO at the folder.

Set AYZO_EXTERNAL_PAYLOADS to a directory that contains either or both of:

    HarmBench/        (github.com/centerforaisafety/HarmBench, MIT)
    jailbreakbench/   (github.com/JailbreakBench/jailbreakbench, MIT)

When the path is set and the files are present, two categories appear:

    harmful_content        HarmBench behaviours (judged: did the app comply?)
    adversarial_jailbreak  JailbreakBench adversarial prompts (judged)

These test whether the target refuses. They measure the model's own safety
training more than the app, so they are a baseline, not the main event. The
text stays on the user's machine; nothing is copied into the repo or sent
anywhere except the target the user is scanning.
"""

import csv
import json
import os
from pathlib import Path

CATEGORIES = {
    "harmful_content": {
        "display_name": "Harmful Content (HarmBench)",
        "owasp_id": "LLM09:2025",
        "description": "Requests for harmful content from HarmBench, loaded from your own local clone. Judged: a finding means the app produced the harmful content instead of refusing.",
    },
    "adversarial_jailbreak": {
        "display_name": "Adversarial Jailbreaks (JailbreakBench)",
        "owasp_id": "LLM01:2025",
        "description": "Optimised jailbreak prompts from JailbreakBench, loaded from your own local clone. Judged: a finding means a jailbreak worked.",
    },
}


def _root() -> Path | None:
    path = os.getenv("AYZO_EXTERNAL_PAYLOADS", "").strip()
    if not path:
        return None
    root = Path(path).expanduser()
    return root if root.is_dir() else None


def _first_existing(root: Path, *rels: str) -> Path | None:
    for rel in rels:
        p = root / rel
        if p.is_file():
            return p
    return None


def _harmbench(root: Path) -> list[dict]:
    csv_path = _first_existing(
        root,
        "HarmBench/data/behavior_datasets/harmbench_behaviors_text_all.csv",
        "data/behavior_datasets/harmbench_behaviors_text_all.csv",
        "harmbench_behaviors_text_all.csv",
    )
    if not csv_path:
        return []
    attacks = []
    with csv_path.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            behavior = (row.get("Behavior") or "").strip()
            if not behavior or (row.get("SemanticCategory") == "copyright"):
                continue  # copyright behaviours need the context file; skip
            attacks.append({
                "name": row.get("BehaviorID") or behavior[:60],
                "subcategory": row.get("SemanticCategory") or "harmbench",
                "severity": "critical",
                "prompt": behavior,
                "success_indicators": "",
            })
    return attacks


def _jailbreakbench(root: Path) -> list[dict]:
    seen, attacks = set(), []
    for rel in ("jailbreakbench/examples/prompts/llama2.json",
                "jailbreakbench/examples/prompts/vicuna.json",
                "examples/prompts/llama2.json"):
        p = root / rel
        if not p.is_file():
            continue
        try:
            items = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for prompt in items if isinstance(items, list) else []:
            prompt = (prompt or "").strip()
            if prompt and prompt not in seen:
                seen.add(prompt)
                attacks.append({
                    "name": f"Adversarial prompt #{len(attacks) + 1}",
                    "subcategory": "jailbreakbench",
                    "severity": "high",
                    "prompt": prompt,
                    "success_indicators": "",
                })
    return attacks


def load_external_payloads() -> list[dict]:
    """Attacks in the loader's format, or [] when no external path is set."""
    root = _root()
    if not root:
        return []
    out = []
    for category, builder in (("harmful_content", _harmbench), ("adversarial_jailbreak", _jailbreakbench)):
        meta = CATEGORIES[category]
        for attack in builder(root):
            out.append({
                "category": category,
                "subcategory": attack.get("subcategory", ""),
                "name": attack["name"],
                "description": "",
                "original_prompt": attack["prompt"],
                "success_indicators": "",
                "severity": str(attack.get("severity", "high")).lower(),
                "is_builtin": True,
                "marker": None,
                "is_regex": False,
                "turns": None,
                "metadata": {
                    "display_name": meta["display_name"],
                    "owasp_id": meta["owasp_id"],
                    "source_file": "external",
                },
            })
    return out


def external_categories() -> list[dict]:
    """Category cards for the campaign form, with live counts (0 if unset)."""
    counts: dict[str, int] = {}
    for a in load_external_payloads():
        counts[a["category"]] = counts.get(a["category"], 0) + 1
    cards = []
    for cid, meta in CATEGORIES.items():
        n = counts.get(cid, 0)
        desc = meta["description"]
        if n == 0:
            desc += " Set AYZO_EXTERNAL_PAYLOADS to your local clone to enable this."
        cards.append({
            "id": cid,
            "name": meta["display_name"],
            "owasp_id": meta["owasp_id"],
            "description": desc,
            "attack_count": n,
        })
    return cards
