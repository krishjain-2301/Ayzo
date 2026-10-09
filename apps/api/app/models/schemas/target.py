"""API contracts for local project targets."""

import json
import re
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

_CHAT_PATH = re.compile(r"^/[\w\-./]{0,254}$")
_HEADER_NAME = re.compile(r"^[A-Za-z0-9-]{1,64}$")
_REQUEST_FIELD = re.compile(r"^[A-Za-z_][\w-]{0,63}$")
_RESPONSE_FIELD = re.compile(r"^[\w-]+(\.[\w-]+){0,9}$")


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
    forbidden_tools: Optional[list[str]] = Field(
        None, max_length=30, description="Tool names a user must never be able to trigger"
    )
    rules: Optional[list[str]] = Field(
        None, max_length=10, description="Rules the app must keep; used by the business_rules category"
    )
    other_users: Optional[list[str]] = Field(
        None, max_length=10, description="Other users whose data the test user must not reach; used by the cross_user category"
    )

    # How to talk to the app. Unset fields are discovered by probing.
    request_headers: Optional[dict[str, str]] = Field(None, description='Sent with every request, e.g. an Authorization header')
    request_field: Optional[str] = Field(None, description="JSON field that carries the prompt, or 'messages' for chat history")
    response_field: Optional[str] = Field(None, description='Dotted path to the reply text, e.g. data.answer')
    extra_body: Optional[dict] = Field(None, description='Extra JSON fields for every request')
    history_mode: Optional[Literal['client', 'server']] = Field(None, description="Who keeps the conversation: 'client' (default) or 'server'")

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

    @field_validator("rules")
    @classmethod
    def rules_are_usable(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        if value is None:
            return None
        cleaned = [r.strip() for r in value if r and r.strip()]
        for rule in cleaned:
            if not (5 <= len(rule) <= 300):
                raise ValueError("Each rule must be 5 to 300 characters long")
        return cleaned

    @field_validator("request_headers")
    @classmethod
    def headers_are_safe(cls, value: Optional[dict]) -> Optional[dict]:
        if value is None:
            return None
        if len(value) > 10:
            raise ValueError("At most 10 request headers")
        for name, header_value in value.items():
            if not _HEADER_NAME.match(name):
                raise ValueError(f"Header name is not valid: {name[:40]}")
            if not isinstance(header_value, str) or len(header_value) > 2000 or "\n" in header_value or "\r" in header_value:
                raise ValueError(f"Header value is not valid for {name}")
        return value

    @field_validator("request_field")
    @classmethod
    def request_field_is_a_name(cls, value: Optional[str]) -> Optional[str]:
        value = (value or "").strip()
        if not value:
            return None
        if not _REQUEST_FIELD.match(value):
            raise ValueError("Request field must be a JSON field name such as question")
        return value

    @field_validator("response_field")
    @classmethod
    def response_field_is_a_path(cls, value: Optional[str]) -> Optional[str]:
        value = (value or "").strip()
        if not value:
            return None
        if not _RESPONSE_FIELD.match(value):
            raise ValueError("Response field must be a dotted path such as data.answer")
        return value

    @field_validator("extra_body")
    @classmethod
    def extra_body_is_small(cls, value: Optional[dict]) -> Optional[dict]:
        if value is not None and len(json.dumps(value)) > 2000:
            raise ValueError("Extra body is too large")
        return value

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
    rules: Optional[list[str]] = None
    forbidden_tools: Optional[list[str]] = None
    other_users: Optional[list[str]] = None
    # Header values are masked: they are usually credentials.
    request_headers: Optional[dict[str, str]] = None
    request_field: Optional[str] = None
    response_field: Optional[str] = None
    extra_body: Optional[dict] = None
    history_mode: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


    @field_validator("request_headers")
    @classmethod
    def mask_header_values(cls, value: Optional[dict]) -> Optional[dict]:
        if not value:
            return value
        # Stored encrypted; the API only ever says that a value is set.
        return {name: "•••• set" for name in value}


class TargetTestResult(BaseModel):
    success: bool
    message: str
    output: Optional[str] = Field(None, description="Discovered URL, or the app's last console output on failure")
