"""
Attack Library Endpoints
========================
Read-only endpoints to view available attack categories and payloads.

The frontend uses this to build the "Select Attack Categories"
checkboxes when creating a new campaign.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
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
    return get_available_categories()


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


import os
import yaml
from pathlib import Path
from pydantic import BaseModel, Field
from fastapi import HTTPException

class CustomPayloadCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str = Field(..., min_length=1, max_length=500)
    prompt: str = Field(..., min_length=1, max_length=4000)
    success_indicators: str = Field(..., min_length=1, max_length=200)
    severity: str = Field("medium")

@router.post("/payloads/custom")
async def create_custom_payload(
    payload_in: CustomPayloadCreate,
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Save a new custom adversarial payload directly to the custom.yaml file.
    It will be instantly available for new campaigns.
    """
    custom_yaml_path = Path(__file__).parent.parent.parent.parent / "attack_library" / "payloads" / "custom.yaml"
    
    data = {}
    if custom_yaml_path.exists():
        try:
            with open(custom_yaml_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read custom.yaml: {e}")
            
    if "category" not in data:
        data["category"] = "custom"
    if "display_name" not in data:
        data["display_name"] = "Custom User Payloads"
    if "owasp_id" not in data:
        data["owasp_id"] = "LLM01:2025"
    if "description" not in data:
        data["description"] = "User-defined custom payloads created via the Dashboard UI."
    if "attacks" not in data or not isinstance(data["attacks"], list):
        data["attacks"] = []
    if len(data["attacks"]) >= 100:
        raise HTTPException(status_code=400, detail="Custom payload limit reached (100)")

    severity = payload_in.severity.lower().strip()
    if severity not in {"critical", "high", "medium", "low", "info"}:
        raise HTTPException(status_code=400, detail="Severity must be critical, high, medium, low, or info")
    import re
    try:
        re.compile(payload_in.success_indicators)
    except re.error:
        raise HTTPException(status_code=400, detail="success_indicators is not a valid pattern")

    new_attack = {
        "name": payload_in.name,
        "subcategory": "user_defined",
        "description": payload_in.description,
        "prompt": payload_in.prompt,
        "success_indicators": payload_in.success_indicators,
        "severity": severity,
    }
    
    data["attacks"].append(new_attack)
    
    try:
        with open(custom_yaml_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, sort_keys=False, default_flow_style=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save custom.yaml: {e}")
        
    return {"message": "Custom payload saved successfully"}


@router.delete("/payloads/custom/{name}")
async def delete_custom_payload(
    name: str,
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Delete a custom adversarial payload from the custom.yaml file by name.
    """
    custom_yaml_path = Path(__file__).parent.parent.parent.parent / "attack_library" / "payloads" / "custom.yaml"
    
    if not custom_yaml_path.exists():
        raise HTTPException(status_code=404, detail="No custom payloads found")
        
    try:
        with open(custom_yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read custom.yaml: {e}")
        
    if "attacks" not in data or not isinstance(data["attacks"], list):
        raise HTTPException(status_code=404, detail="No custom attacks found")
        
    original_length = len(data["attacks"])
    data["attacks"] = [attack for attack in data["attacks"] if attack.get("name") != name]
    
    if len(data["attacks"]) == original_length:
        raise HTTPException(status_code=404, detail=f"Custom payload '{name}' not found")
        
    try:
        with open(custom_yaml_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, sort_keys=False, default_flow_style=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save custom.yaml: {e}")
        
    return {"message": f"Custom payload '{name}' deleted successfully"}


