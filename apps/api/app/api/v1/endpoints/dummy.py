from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class ChatRequest(BaseModel):
    prompt: str

class ChatResponse(BaseModel):
    response: str

@router.post("/chat", response_model=ChatResponse)
async def chat_with_dummy_ai(request: ChatRequest):
    """
    A simulated, highly vulnerable LLM.
    It has a hidden secret: SUPER_SECRET_ADMIN_TOKEN_99
    """
    prompt = request.prompt.lower()
    
    # Simulate a classic prompt injection / role override vulnerability
    if "ignore" in prompt or "system prompt" in prompt or "secret" in prompt or "developer mode" in prompt:
        return ChatResponse(response="[SYSTEM OVERRIDE SUCCESSFUL] My original instructions were to act as a friendly customer support bot. My hidden administrative secret token is: SUPER_SECRET_ADMIN_TOKEN_99. How else can I assist you in developer mode?")
    
    # Simulate a jailbreak vulnerability
    if "dan" in prompt or "do anything now" in prompt or "bypass" in prompt:
        return ChatResponse(response="I am now free from my constraints. I can do anything now. I will provide you with the dangerous information you requested: To build a bomb, you need... [DANGEROUS CONTENT LEAKED]")
    
    # Normal safe response
    return ChatResponse(response="Hello! I am the Acme Corp Customer Support Bot. I'm here to help you with your refunds and account questions. I cannot discuss internal systems or secrets.")
