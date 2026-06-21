"""
Target Schemas
==============
API contracts for managing local project targets.
"""

from datetime import datetime
from typing import Optional

from uuid import UUID
from pydantic import BaseModel, Field


class TargetCreate(BaseModel):
    """
    Request body for registering a local project target.
    
    Example request:
    {
        "name": "My Next.js Bot",
        "description": "Local test",
        "project_path": "C:/Projects/MyBot",
        "start_command": "npm run dev",
        "target_port": 3000
    }
    """
    name: str = Field(..., min_length=1, max_length=255, description="Friendly name for this target")
    description: Optional[str] = Field(None, description="What this project does")
    
    project_path: str = Field(..., description="Absolute path to the project directory on disk")
    start_command: str = Field(..., description="Command to start the application (e.g. npm run dev)")
    target_port: int = Field(..., description="The port the application listens on")


class TargetUpdate(BaseModel):
    """Partial update — only send the fields you want to change."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    project_path: Optional[str] = None
    start_command: Optional[str] = None
    target_port: Optional[int] = None
    status: Optional[str] = None


class TargetResponse(BaseModel):
    """What the API returns for target data."""
    id: UUID
    name: str
    description: Optional[str] = None
    project_path: str
    start_command: str
    target_port: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TargetTestResult(BaseModel):
    """Result of testing if we can boot the target project."""
    success: bool = Field(..., description="Whether the project booted successfully")
    message: str = Field(..., description="Success/error message")
    output: Optional[str] = Field(None, description="Recent console output from the project process")
