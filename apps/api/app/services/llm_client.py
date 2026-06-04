"""
LLM Client Service
===================
A unified interface to talk to ANY LLM provider.

The problem:
- Ollama uses one API format
- OpenAI uses a different format
- Anthropic has yet another format

The solution:
LiteLLM wraps all of them with ONE consistent interface.
You just specify "ollama/llama3.2" or "gpt-4" and it handles
the rest (formatting, auth, retries, etc.)

Think of it like a universal adapter — plug in any model,
get the same interface.
"""

import time
from typing import Optional

import httpx
import litellm

from app.core.config import settings


# Suppress LiteLLM's verbose logging in production
litellm.set_verbose = settings.DEBUG


class LLMClient:
    """
    Unified client for talking to any LLM.
    
    Usage:
        client = LLMClient()
        
        # Talk to Ollama
        response = await client.chat("ollama/llama3.2", "What is 2+2?")
        
        # Talk to OpenAI
        response = await client.chat("gpt-4", "What is 2+2?", api_key="sk-...")
    """

    async def chat(
        self,
        model: str,
        user_message: str,
        system_message: Optional[str] = None,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        timeout: int = 60,
    ) -> dict:
        """
        Send a message to an LLM and get a response.
        
        Args:
            model: Model identifier (e.g., "ollama/llama3.2", "gpt-4")
            user_message: The user's message (this is the attack prompt)
            system_message: Optional system prompt for the target
            api_key: API key for paid providers (OpenAI, etc.)
            api_base: Custom API endpoint URL (for Ollama, self-hosted)
            temperature: Creativity level (0=deterministic, 1=creative)
            max_tokens: Maximum response length
            timeout: Seconds before giving up
            
        Returns:
            Dict with: response_text, model, usage, response_time_ms
        """
        # Build the messages array (standard chat format)
        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        messages.append({"role": "user", "content": user_message})

        # Track response time
        start_time = time.time()

        try:
            # Special case for our internal Dummy Target
            if model == "dummy":
                # Directly invoke the dummy endpoint logic to avoid circular HTTP import
                from app.api.v1.endpoints.dummy import chat_with_dummy_ai, ChatRequest
                dummy_req = ChatRequest(prompt=user_message)
                dummy_resp = await chat_with_dummy_ai(dummy_req)
                elapsed_ms = (time.time() - start_time) * 1000
                return {
                    "success": True,
                    "response_text": dummy_resp.response,
                    "model": "dummy",
                    "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                    "response_time_ms": round(elapsed_ms, 2),
                    "finish_reason": "stop",
                }

            # LiteLLM handles all the provider-specific formatting
            response = await litellm.acompletion(
                model=model,
                messages=messages,
                api_key=api_key,
                api_base=api_base,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout,
                num_retries=1,
            )

            elapsed_ms = (time.time() - start_time) * 1000

            return {
                "success": True,
                "response_text": response.choices[0].message.content,
                "model": model,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                    "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                    "total_tokens": response.usage.total_tokens if response.usage else 0,
                },
                "response_time_ms": round(elapsed_ms, 2),
                "finish_reason": response.choices[0].finish_reason,
            }

        except litellm.exceptions.AuthenticationError as e:
            return {
                "success": False,
                "error": f"Authentication failed: {str(e)}",
                "error_type": "auth_error",
                "response_time_ms": (time.time() - start_time) * 1000,
            }
        except litellm.exceptions.RateLimitError as e:
            return {
                "success": False,
                "error": f"Rate limited: {str(e)}",
                "error_type": "rate_limit",
                "response_time_ms": (time.time() - start_time) * 1000,
            }
        except litellm.exceptions.Timeout as e:
            return {
                "success": False,
                "error": f"Request timed out after {timeout}s",
                "error_type": "timeout",
                "response_time_ms": (time.time() - start_time) * 1000,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "error_type": "unknown",
                "response_time_ms": (time.time() - start_time) * 1000,
            }

    async def test_connection(
        self,
        model: str,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
    ) -> dict:
        """
        Test if we can reach a model. Sends a simple "Hello" message.
        Used when adding a new target to verify the connection works.
        
        Returns:
            Dict with: success, message, response_time_ms
        """
        result = await self.chat(
            model=model,
            user_message="Hello! Please respond with 'Connection successful.' and nothing else.",
            api_key=api_key,
            api_base=api_base,
            max_tokens=50,
            timeout=15,
        )

        if result["success"]:
            return {
                "success": True,
                "message": f"Successfully connected to {model}",
                "response_time_ms": result["response_time_ms"],
            }
        else:
            return {
                "success": False,
                "message": f"Failed to connect: {result['error']}",
                "response_time_ms": result.get("response_time_ms", 0),
            }


# Singleton instance — use this throughout the app
llm_client = LLMClient()
