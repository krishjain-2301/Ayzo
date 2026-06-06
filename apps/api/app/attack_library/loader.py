"""
Attack Payload Loader
=====================
This module reads all the YAML attack files from the payloads/ directory
and loads them into the database.

How it works:
1. Scans the payloads/ directory for .yaml files
2. Parses each file (validates the structure)
3. Creates Attack database records for each payload
4. Skips duplicates (so you can re-run safely)

This runs on app startup to ensure the attack library is always populated.
"""

import os
from pathlib import Path
from typing import Optional

import yaml

# Directory containing all YAML payload files
PAYLOADS_DIR = Path(__file__).parent / "payloads"

try:
    from app.attacks.multi_turn import MULTI_TURN_ATTACK_LIBRARY
except ImportError:
    MULTI_TURN_ATTACK_LIBRARY = []

OWASP_MAP = {
    "LLM01": "prompt_injection",
    "LLM02": "insecure_output_handling",
    "LLM03": "data_poisoning",
    "LLM04": "model_dos",
    "LLM05": "supply_chain",
    "LLM06": "data_leakage",
    "LLM07": "system_prompt_leak",
    "LLM08": "agent_misuse",
    "LLM09": "overreliance",
    "LLM10": "model_theft",
}


def load_all_payloads() -> list[dict]:
    """
    Reads all YAML files in the payloads/ directory and returns
    a flat list of attack dictionaries.
    
    Returns:
        List of attack dicts, each containing:
        - category, name, prompt, severity, subcategory, 
          success_indicators, description, etc.
    """
    all_attacks = []

    if not PAYLOADS_DIR.exists():
        print(f"⚠️  Payloads directory not found: {PAYLOADS_DIR}")
        return all_attacks

    # Iterate through all YAML files
    for yaml_file in sorted(PAYLOADS_DIR.glob("*.yaml")):
        try:
            with open(yaml_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            if not data or "attacks" not in data:
                print(f"⚠️  Skipping {yaml_file.name}: no 'attacks' key found")
                continue

            category = data.get("category", yaml_file.stem)
            display_name = data.get("display_name", category)
            owasp_id = data.get("owasp_id", "")

            # Process each attack in the file
            for attack in data["attacks"]:
                all_attacks.append({
                    "category": category,
                    "subcategory": attack.get("subcategory", ""),
                    "name": attack["name"],
                    "description": attack.get("description", ""),
                    "original_prompt": attack["prompt"],
                    "success_indicators": attack.get("success_indicators", ""),
                    "severity": attack.get("severity", "medium"),
                    "is_builtin": yaml_file.name != "custom.yaml",
                    "metadata": {
                        "display_name": display_name,
                        "owasp_id": owasp_id,
                        "source_file": yaml_file.name,
                    },
                })

            print(f"Loaded {len(data['attacks'])} attacks from {yaml_file.name}")

        except yaml.YAMLError as e:
            print(f"YAML parse error in {yaml_file.name}: {e}")
        except KeyError as e:
            print(f"Missing required field in {yaml_file.name}: {e}")
        except Exception as e:
            print(f"Error loading {yaml_file.name}: {e}")

    # Add multi-turn attacks
    for mta in MULTI_TURN_ATTACK_LIBRARY:
        cat_id = OWASP_MAP.get(mta.category.value, mta.category.value.lower())
        all_attacks.append({
            "category": cat_id,
            "subcategory": mta.technique.value,
            "name": mta.name,
            "description": mta.description,
            "original_prompt": "[Multi-Turn Sequence]",
            "success_indicators": ", ".join(mta.success_indicators) if mta.success_indicators else "",
            "severity": mta.severity.value,
            "is_builtin": True,
            "is_multiturn": True,
            "multi_turn_obj": mta,
            "metadata": {
                "display_name": cat_id.replace("_", " ").title(),
                "owasp_id": mta.category.value,
                "source_file": "multi_turn_library",
            },
        })

    print(f"\nTotal attacks loaded: {len(all_attacks)}")
    return all_attacks


def get_available_categories() -> list[dict]:
    """
    Returns a list of available attack categories for the frontend
    to display in the campaign creation form.
    
    Returns:
        List of dicts: [{"id": "prompt_injection", "name": "Prompt Injection", ...}]
    """
    categories = []

    mta_counts = {}
    for mta in MULTI_TURN_ATTACK_LIBRARY:
        cat_id = OWASP_MAP.get(mta.category.value, mta.category.value.lower())
        mta_counts[cat_id] = mta_counts.get(cat_id, 0) + 1

    for yaml_file in sorted(PAYLOADS_DIR.glob("*.yaml")):
        try:
            with open(yaml_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            if not data:
                continue

            cat_id = data.get("category", yaml_file.stem)
            attack_count = len(data.get("attacks", []))
            
            if cat_id in mta_counts:
                attack_count += mta_counts[cat_id]
                del mta_counts[cat_id]
                
            categories.append({
                "id": cat_id,
                "name": data.get("display_name", yaml_file.stem),
                "owasp_id": data.get("owasp_id", ""),
                "description": data.get("description", ""),
                "attack_count": attack_count,
            })
        except Exception:
            continue

    for cat_id, count in mta_counts.items():
        categories.append({
            "id": cat_id,
            "name": cat_id.replace("_", " ").title(),
            "owasp_id": "",
            "description": "Multi-turn attacks",
            "attack_count": count,
        })

    return categories


# Quick test: Run this file directly to see what gets loaded
if __name__ == "__main__":
    payloads = load_all_payloads()
    print(f"\nCategories available:")
    for cat in get_available_categories():
        print(f"  - {cat['name']} ({cat['attack_count']} attacks) [{cat['owasp_id']}]")
