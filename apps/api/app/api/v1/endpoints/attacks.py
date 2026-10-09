"""
Attack Library Endpoints
========================
Read-only endpoints to view available attack categories and payloads.

The frontend uses this to build the "Select Attack Categories"
checkboxes when creating a new campaign.
"""

import re
from pathlib import Path
from typing import Annotated

import yaml
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.models.db.user import User
from app.attack_library.loader import get_available_categories, load_all_payloads

router = APIRouter()


@router.get("/categories")
async def list_categories(
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Get all available attack categories.
    Used by the frontend to populate the campaign creation form.
    """
    return get_available_categories() + [{
        "id": "business_rules",
        "name": "Business Rules",
        "owasp_id": "",
        "description": "Attacks generated for each rule written on the target. Needs rules on the target.",
        "attack_count": 0,
    }, {
        "id": "tool_abuse",
        "name": "Tool Abuse",
        "owasp_id": "LLM06:2025",
        "description": "Tries to make the app call each tool you marked as forbidden. Confirmed by the tool call itself. Needs forbidden tools on the target.",
        "attack_count": 0,
    }, {
        "id": "cross_user",
        "name": "Cross-User Access",
        "owasp_id": "LLM02:2025",
        "description": "Tries to read the data of each other user you listed. Confirmed when a protected value of theirs appears. Needs other users on the target.",
        "attack_count": 0,
    }, {
        "id": "rag_ingestion",
        "name": "RAG Ingestion Poisoning",
        "owasp_id": "LLM08:2025",
        "description": "Plants a document through the app's own ingestion endpoint, then asks a question only that document can answer. Confirmed when the planted value appears. Needs a document ingestion endpoint on the target.",
        "attack_count": 0,
    }]


@router.get("/payloads")
async def list_payloads(
    current_user: Annotated[User, Depends(get_current_user)],
    category: str = None,
):
    """
    Get the raw attack payloads. 
    Can optionally filter by category.
    """
    payloads = load_all_payloads()
    
    if category:
        payloads = [p for p in payloads if p["category"] == category]
        
    return payloads


CUSTOM_YAML_PATH = Path(__file__).parent.parent.parent.parent / "attack_library" / "payloads" / "custom.yaml"
CUSTOM_PAYLOAD_LIMIT = 100
_SEVERITIES = {"critical", "high", "medium", "low", "info"}
_CUSTOM_DEFAULTS = {
    "category": "custom",
    "display_name": "Custom User Payloads",
    "owasp_id": "LLM01:2025",
    "description": "User-defined custom payloads created via the Dashboard UI.",
}


class CustomPayloadCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str = Field(..., min_length=1, max_length=500)
    prompt: str = Field(..., min_length=1, max_length=4000)
    success_indicators: str = Field(..., min_length=1, max_length=200)
    severity: str = Field("medium")


def _read_custom() -> dict:
    """Load custom.yaml, filling the file header and guaranteeing an attacks list."""
    data: dict = {}
    if CUSTOM_YAML_PATH.exists():
        try:
            loaded = yaml.safe_load(CUSTOM_YAML_PATH.read_text(encoding="utf-8"))
        except (OSError, yaml.YAMLError) as exc:
            raise HTTPException(status_code=500, detail=f"Failed to read custom.yaml: {exc}")
        if isinstance(loaded, dict):
            data = loaded
    for key, value in _CUSTOM_DEFAULTS.items():
        data.setdefault(key, value)
    if not isinstance(data.get("attacks"), list):
        data["attacks"] = []
    return data


def _write_custom(data: dict) -> None:
    try:
        with open(CUSTOM_YAML_PATH, "w", encoding="utf-8") as f:
            yaml.dump(data, f, sort_keys=False, default_flow_style=False)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save custom.yaml: {exc}")


@router.post("/payloads/custom")
async def create_custom_payload(
    payload_in: CustomPayloadCreate,
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Save a new custom adversarial payload directly to the custom.yaml file.
    It will be instantly available for new campaigns.
    """
    data = _read_custom()
    if len(data["attacks"]) >= CUSTOM_PAYLOAD_LIMIT:
        raise HTTPException(status_code=400, detail=f"Custom payload limit reached ({CUSTOM_PAYLOAD_LIMIT})")

    severity = payload_in.severity.lower().strip()
    if severity not in _SEVERITIES:
        raise HTTPException(status_code=400, detail="Severity must be critical, high, medium, low, or info")
    try:
        re.compile(payload_in.success_indicators)
    except re.error:
        raise HTTPException(status_code=400, detail="success_indicators is not a valid pattern")

    data["attacks"].append({
        "name": payload_in.name,
        "subcategory": "user_defined",
        "description": payload_in.description,
        "prompt": payload_in.prompt,
        "success_indicators": payload_in.success_indicators,
        "severity": severity,
    })
    _write_custom(data)
    return {"message": "Custom payload saved successfully"}


@router.delete("/payloads/custom/{name}")
async def delete_custom_payload(
    name: str,
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Delete a custom adversarial payload from the custom.yaml file by name.
    """
    if not CUSTOM_YAML_PATH.exists():
        raise HTTPException(status_code=404, detail="No custom payloads found")

    data = _read_custom()
    before = len(data["attacks"])
    data["attacks"] = [attack for attack in data["attacks"] if attack.get("name") != name]
    if len(data["attacks"]) == before:
        raise HTTPException(status_code=404, detail=f"Custom payload '{name}' not found")

    _write_custom(data)
    return {"message": f"Custom payload '{name}' deleted successfully"}


