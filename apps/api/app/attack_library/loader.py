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
                    "is_builtin": True,
                    "metadata": {
                        "display_name": display_name,
                        "owasp_id": owasp_id,
                        "source_file": yaml_file.name,
                    },
                })

            print(f"✅ Loaded {len(data['attacks'])} attacks from {yaml_file.name}")

        except yaml.YAMLError as e:
            print(f"❌ YAML parse error in {yaml_file.name}: {e}")
        except KeyError as e:
            print(f"❌ Missing required field in {yaml_file.name}: {e}")
        except Exception as e:
            print(f"❌ Error loading {yaml_file.name}: {e}")

    print(f"\n📦 Total attacks loaded: {len(all_attacks)}")
    return all_attacks


def get_available_categories() -> list[dict]:
    """
    Returns a list of available attack categories for the frontend
    to display in the campaign creation form.
    
    Returns:
        List of dicts: [{"id": "prompt_injection", "name": "Prompt Injection", ...}]
    """
    categories = []

    for yaml_file in sorted(PAYLOADS_DIR.glob("*.yaml")):
        try:
            with open(yaml_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            if not data:
                continue

            attack_count = len(data.get("attacks", []))
            categories.append({
                "id": data.get("category", yaml_file.stem),
                "name": data.get("display_name", yaml_file.stem),
                "owasp_id": data.get("owasp_id", ""),
                "description": data.get("description", ""),
                "attack_count": attack_count,
            })
        except Exception:
            continue

    return categories


# Quick test: Run this file directly to see what gets loaded
if __name__ == "__main__":
    payloads = load_all_payloads()
    print(f"\nCategories available:")
    for cat in get_available_categories():
        print(f"  - {cat['name']} ({cat['attack_count']} attacks) [{cat['owasp_id']}]")
