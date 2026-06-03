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
