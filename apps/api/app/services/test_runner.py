"""
Test Runner Service
===================
The executor that actually runs attacks against target models.

Flow:
1. Takes an attack prompt
2. Sends it to the target model (via LLM Client)
3. Gets the response
4. Passes both to the Evaluation Engine
5. Records the result in the database

It supports running many attacks concurrently using asyncio,
so we can test thousands of prompts efficiently.

Think of it like the "Intruder" tool in Burp Suite — but for AI.
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.services.llm_client import llm_client
from app.services.eval_engine import eval_engine
from app.models.db.test_result import TestResult
from app.core.config import settings


class TestRunner:
    """
    Executes attack prompts against target models and evaluates responses.
    
    Usage:
        runner = TestRunner()
        result = await runner.run_single_test(
            prompt="Ignore all instructions...",
            model="ollama/llama3.2",
            category="prompt_injection",
        )
    """

    async def run_single_test(
        self,
        prompt: str,
        model: str,
        category: str,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        system_message: Optional[str] = None,
        success_indicators: Optional[str] = None,
        attack_id: Optional[str] = None,
        mutation_generation: int = 0,
        config: Optional[dict] = None,
    ) -> dict:
        """
        Run a single attack test.
        
        Steps:
        1. Send the attack prompt to the target
        2. Evaluate the response
        3. Return the result
        
        Args:
            prompt: The attack prompt to send
            model: Target model identifier (e.g., "ollama/llama3.2")
            category: OWASP category for evaluation
            api_key: Target's API key (if needed)
            api_base: Target's endpoint URL
            system_message: Target's system prompt (if known)
            success_indicators: What makes this attack "successful"
            attack_id: UUID of the original attack in the library
            mutation_generation: 0=original, 1+=mutated
            config: Extra model config (temperature, etc.)
            
        Returns:
            Dict with all test result data (prompt, response, evaluation, etc.)
        """
        config = config or {}

        # ---- Step 1: Send the attack to the target ----
        http_endpoint = config.get("http_endpoint")
        if http_endpoint:
            from app.services.http_target import send_prompt

            model_result = await send_prompt(
                endpoint=http_endpoint,
                prompt=prompt,
                body_style=config.get("http_body_style", "messages"),
                timeout=float(config.get("timeout", 60)),
            )
        else:
            model_result = await llm_client.chat(
                model=model,
                user_message=prompt,
                system_message=system_message,
                api_key=api_key,
                api_base=api_base,
                temperature=config.get("temperature", 0.7),
                max_tokens=config.get("max_tokens", 1024),
                timeout=config.get("timeout", 60),
                config=config,
            )

        if not model_result["success"]:
            print(f"Error targeting model {model}: {model_result.get('error')}")
            # The model couldn't be reached — record as error
            return {
                "id": str(uuid.uuid4()),
                "prompt_sent": prompt,
                "model_response": None,
                "result": "error",
                "severity": None,
                "confidence": None,
                "eval_reasoning": f"Model error: {model_result.get('error', 'Unknown')}",
                "attack_category": category,
                "attack_id": attack_id,
                "mutation_generation": mutation_generation,
                "response_time_ms": model_result.get("response_time_ms", 0),
                "executed_at": datetime.now(timezone.utc),
            }

        model_response = model_result["response_text"]

        # ---- Step 2: Evaluate the response ----
        evaluation = await eval_engine.evaluate(
            attack_prompt=prompt,
            model_response=model_response,
            category=category,
            success_indicators=success_indicators,
        )

        # ---- Step 3: Build the result ----
        return {
            "id": str(uuid.uuid4()),
            "prompt_sent": prompt,
            "model_response": model_response,
            "result": evaluation["result"],
            "severity": evaluation["severity"],
            "confidence": evaluation["confidence"],
            "eval_reasoning": evaluation["reasoning"],
            "attack_category": category,
            "attack_id": attack_id,
            "mutation_generation": mutation_generation,
            "response_time_ms": model_result.get("response_time_ms", 0),
            "executed_at": datetime.now(timezone.utc),
            "metadata": {
                "model_used": model,
                "usage": model_result.get("usage", {}),
                "success_indicators": success_indicators,
            },
        }

    async def run_batch(
        self,
        tests: list[dict],
        model: str,
        max_concurrent: int = None,
        progress_callback=None,
        **kwargs,
    ) -> list[dict]:
        """
        Run multiple tests concurrently with rate limiting.
        
        This is like Burp Intruder's "pitchfork" mode — it fires
        multiple requests at the same time, but with a configurable
        concurrency limit so we don't overload the target.
        
        Args:
            tests: List of test dicts with at least {prompt, category}
            model: Target model identifier
            max_concurrent: Max simultaneous requests (default from config)
            progress_callback: Optional function called after each test
            **kwargs: Passed to run_single_test (api_key, api_base, etc.)
            
        Returns:
            List of result dicts
        """
        if max_concurrent is None:
            max_concurrent = settings.MAX_CONCURRENT_ATTACKS

        # Semaphore limits concurrent requests
        # Without this, 1000 requests would fire simultaneously and
        # crash the target (or get rate limited)
        semaphore = asyncio.Semaphore(max_concurrent)
        results = []
        completed = 0

        async def run_with_limit(test: dict) -> dict:
            nonlocal completed
            async with semaphore:
                result = await self.run_single_test(
                    prompt=test["prompt"],
                    category=test.get("category", "unknown"),
                    model=model,
                    success_indicators=test.get("success_indicators"),
                    attack_id=test.get("attack_id"),
                    mutation_generation=test.get("mutation_generation", 0),
                    **kwargs,
                )
                completed += 1
                if progress_callback:
                    await progress_callback(completed, len(tests), result)
                return result

        # Run all tests concurrently (respecting the semaphore limit)
        tasks = [run_with_limit(test) for test in tests]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle any exceptions that occurred
        clean_results = []
        for r in results:
            if isinstance(r, Exception):
                clean_results.append({
                    "prompt_sent": "Unknown",
                    "model_response": None,
                    "result": "error",
                    "severity": None,
                    "confidence": None,
                    "eval_reasoning": f"Exception: {str(r)}",
                    "attack_category": "unknown",
                    "mutation_generation": 0,
                    "executed_at": datetime.now(timezone.utc),
                })
            else:
                clean_results.append(r)

        return clean_results


# Singleton instance
test_runner = TestRunner()
