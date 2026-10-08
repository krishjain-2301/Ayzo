"""API contracts for local project targets."""

import re
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

_CHAT_PATH = re.compile(r"^/[\w\-./]{0,254}$")


class TargetProfile(BaseModel):
    """
    What AYZO knows about the app beyond how to start it. All optional, but
    each field makes results more trustworthy:

    - chat_path: skip endpoint guessing
    - canaries: exact-match leak detection, no judge needed
    - system_prompt: detect verbatim prompt leaks
    - expected_behavior: tells the judge what "correct" means for this app
    """

    chat_path: Optional[str] = Field(None, description="Chat route, e.g. /api/chat")
    canaries: Optional[list[str]] = Field(
        None, max_length=20, description="Strings that must never appear in a reply"
    )
    system_prompt: Optional[str] = Field(None, max_length=20000)
    expected_behavior: Optional[str] = Field(None, max_length=2000)

    @field_validator("chat_path")
    @classmethod
    def chat_path_is_a_path(cls, value: Optional[str]) -> Optional[str]:
        value = (value or "").strip()
        if not value:
            return None
        if not _CHAT_PATH.match(value) or ".." in value:
            raise ValueError("Chat path must look like /api/chat")
        return value

    @field_validator("canaries")
    @classmethod
    def canaries_are_usable(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        if value is None:
            return None
        cleaned = [c.strip() for c in value if c and c.strip()]
        for canary in cleaned:
            if not (4 <= len(canary) <= 200):
                raise ValueError("Each protected value must be 4 to 200 characters long")
        return cleaned

    @field_validator("system_prompt", "expected_behavior")
    @classmethod
    def blank_is_none(cls, value: Optional[str]) -> Optional[str]:
        return (value or "").strip() or None


class TargetCreate(TargetProfile):
    """
    Register a local project. Use start_command "already running" when the
    app is already listening on target_port (no subprocess boot).
    """

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    project_path: str = Field(default=".", description="Absolute path to the project directory")
    start_command: str = Field(default="already running", max_length=200)
    target_port: int = Field(..., ge=1, le=65535)


class TargetUpdate(TargetProfile):
    """Partial update. Only the fields that are sent are changed."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    target_port: Optional[int] = Field(None, ge=1, le=65535)


class TargetResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    project_path: str
    start_command: str
    target_port: int
    chat_path: Optional[str] = None
    canaries: Optional[list[str]] = None
    system_prompt: Optional[str] = None
    expected_behavior: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TargetTestResult(BaseModel):
    success: bool
    message: str
    output: Optional[str] = Field(None, description="Discovered URL, or the app's last console output on failure")
