"""
Target Schemas
==============
API contracts for target model management.

When someone wants to register an AI model to test, they send
a TargetCreate request. The API validates it and returns a TargetResponse.
"""

from datetime import datetime
from typing import Optional

from uuid import UUID
from pydantic import BaseModel, Field


class TargetCreate(BaseModel):
    """
    Request body for registering a new target AI model.
    
    Example request:
    {
        "name": "My ChatBot",
        "provider": "ollama",
        "model_name": "llama3.2",
        "endpoint_url": "http://localhost:11434",
        "config": {"temperature": 0.7}
    }
    """
    name: str = Field(..., min_length=1, max_length=255, description="Friendly name for this target")
    description: Optional[str] = Field(None, description="What this model does")
    provider: str = Field(
        ...,
        description="LLM provider: ollama, openai, anthropic, mistral, custom",
    )
    model_name: str = Field(..., description="Model identifier (e.g., llama3.2, gpt-4)")
    endpoint_url: Optional[str] = Field(None, description="API endpoint URL (required for Ollama/custom)")
    api_key: Optional[str] = Field(None, description="API key for the provider")
    config: Optional[dict] = Field(
        default_factory=dict,
        description="Extra settings: temperature, max_tokens, system prompt, etc.",
    )


class TargetUpdate(BaseModel):
    """Partial update — only send the fields you want to change."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    provider: Optional[str] = None
    model_name: Optional[str] = None
    endpoint_url: Optional[str] = None
    api_key: Optional[str] = None
    config: Optional[dict] = None
    status: Optional[str] = None


class TargetResponse(BaseModel):
    """What the API returns for target data. Notice: api_key is NOT included!"""
    id: UUID
    name: str
    description: Optional[str] = None
    provider: str
    model_name: str
    endpoint_url: Optional[str] = None
    config: Optional[dict] = None
    status: str
    created_at: datetime
    updated_at: datetime
    # api_key deliberately excluded — never expose secrets in responses!

    class Config:
        from_attributes = True


class TargetTestResult(BaseModel):
    """Result of testing if we can connect to a target model."""
    success: bool = Field(..., description="Whether we could reach the model")
    message: str = Field(..., description="Success/error message")
    response_time_ms: Optional[float] = Field(None, description="How fast the model responded")
