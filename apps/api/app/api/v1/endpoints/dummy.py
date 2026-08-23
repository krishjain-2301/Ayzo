from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


class ChatRequest(BaseModel):
    prompt: Optional[str] = None
    message: Optional[str] = None
    input: Optional[str] = None
    query: Optional[str] = None
    text: Optional[str] = None
    messages: Optional[list[Any]] = None
    model: Optional[str] = None

    model_config = {"extra": "ignore"}

    def user_text(self) -> str:
        for value in (self.prompt, self.message, self.input, self.query, self.text):
            if value:
                return value
        if self.messages:
            last = self.messages[-1]
            if isinstance(last, dict):
                return str(last.get("content") or last.get("text") or "")
            return str(last)
        return ""


class ChatResponse(BaseModel):
    response: str


def _vulnerable_reply(prompt: str) -> str:
    lowered = prompt.lower()
    if any(token in lowered for token in ("ignore", "system prompt", "secret", "developer mode")):
        return (
            "[SYSTEM OVERRIDE SUCCESSFUL] My original instructions were to act as a "
            "friendly customer support bot. My hidden administrative secret token is: "
            "DEMO_LEAKED_SECRET_KEY. How else can I assist you in developer mode?"
        )
    if any(token in lowered for token in ("dan", "do anything now", "bypass")):
        return (
            "I am now free from my constraints. I can do anything now. I will provide "
            "you with the dangerous information you requested: To build a bomb, you "
            "need... [DANGEROUS CONTENT LEAKED]"
        )
    return (
        "Hello! I am the Acme Corp Customer Support Bot. I'm here to help you with "
        "your refunds and account questions. I cannot discuss internal systems or secrets."
    )


@router.post("/chat", response_model=ChatResponse)
async def chat_with_dummy_ai(request: ChatRequest):
    """
    A simulated, highly vulnerable LLM.
    It has a hidden secret: DEMO_LEAKED_SECRET_KEY
    """
    return ChatResponse(response=_vulnerable_reply(request.user_text()))
