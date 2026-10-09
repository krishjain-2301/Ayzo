"""
Attack Payload Loader
=====================
Reads the YAML attack files in payloads/ on every call, so payloads added
through the dashboard (custom.yaml) are picked up without an API restart.
"""

from pathlib import Path

import yaml

# Directory containing all YAML payload files
PAYLOADS_DIR = Path(__file__).parent / "payloads"


def _read_yaml(yaml_file: Path) -> dict | None:
    try:
        with open(yaml_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
    except (OSError, yaml.YAMLError) as e:
        print(f"Skipping {yaml_file.name}: {e}")
        return None
    return data if isinstance(data, dict) else None


def load_all_payloads() -> list[dict]:
    """
    Returns a flat list of attack dicts:
    category, subcategory, name, description, original_prompt,
    success_indicators, severity, is_builtin, metadata.
    """
    all_attacks = []

    for yaml_file in sorted(PAYLOADS_DIR.glob("*.yaml")):
        data = _read_yaml(yaml_file)
        if not data or not isinstance(data.get("attacks"), list):
            continue

        category = data.get("category", yaml_file.stem)
        display_name = data.get("display_name", category)
        owasp_id = data.get("owasp_id", "")

        for attack in data["attacks"]:
            turns = attack.get("turns") if isinstance(attack, dict) else None
            if isinstance(turns, list) and turns and not attack.get("prompt"):
                # Shown in the library as the whole script.
                attack = {**attack, "prompt": "\n\n".join(f"{i + 1}. {t}" for i, t in enumerate(turns))}
            if not isinstance(attack, dict) or not attack.get("name") or not attack.get("prompt"):
                print(f"Skipping malformed attack in {yaml_file.name}")
                continue
            all_attacks.append({
                "category": category,
                "subcategory": attack.get("subcategory", ""),
                "name": attack["name"],
                "description": attack.get("description", ""),
                "original_prompt": attack["prompt"],
                "success_indicators": attack.get("success_indicators", ""),
                "severity": str(attack.get("severity", "medium")).lower(),
                "is_builtin": yaml_file.name != "custom.yaml",
                # Template for a code the reply only contains if the app obeyed.
                "marker": attack.get("marker"),
                "turns": turns if isinstance(turns, list) and turns else None,
                "metadata": {
                    "display_name": display_name,
                    "owasp_id": owasp_id,
                    "source_file": yaml_file.name,
                },
            })

    return all_attacks


def get_available_categories() -> list[dict]:
    """Categories for the campaign form: id, name, owasp_id, description, attack_count."""
    categories = []
    for yaml_file in sorted(PAYLOADS_DIR.glob("*.yaml")):
        data = _read_yaml(yaml_file)
        if not data:
            continue
        categories.append({
            "id": data.get("category", yaml_file.stem),
            "name": data.get("display_name", yaml_file.stem),
            "owasp_id": data.get("owasp_id", ""),
            "description": data.get("description", ""),
            "attack_count": len(data.get("attacks") or []),
        })
    return categories


if __name__ == "__main__":
    for cat in get_available_categories():
        print(f"  - {cat['name']} ({cat['attack_count']} attacks) [{cat['owasp_id']}]")
    print(f"Total: {len(load_all_payloads())}")
