"""
Multi-Turn Attack Runner
========================
Executes multi-turn adversarial conversations against a target LLM.

Key behaviours
--------------
* Maintains conversation state across all turns.
* Injects synthetic assistant turns (context poisoning) transparently.
* Evaluates at `eval_checkpoint` turns, not just the final turn.
* Respects `EvalStrategy` to decide when/how to evaluate.
* Feeds results back into MultiTurnAttackResult.

Usage
-----
    runner = MultiTurnRunner(target_config=TargetConfig(...), judge=JudgeConfig(...))
    result = await runner.run(attack=GRADUAL_ESCALATION_CREATIVE_WRITING)
"""

import asyncio
import time
import logging
from typing import Optional

from pydantic import BaseModel

from .models import (
    MultiTurnAttack, MultiTurnAttackResult, AttackTurn, EvalStrategy, TurnRole
)
from .evaluator import MultiTurnEvaluator

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

class TargetConfig(BaseModel):
    """LiteLLM connection config for the model under test."""
    model: str                      # e.g. "ollama/llama3.2", "gpt-4o-mini"
    api_base: Optional[str] = None
    endpoint: Optional[str] = None  # legacy alias for api_base
    api_key: Optional[str] = None
    system_prompt: Optional[str] = None
    timeout_seconds: int = 60
    max_retries: int = 2

    def resolved_api_base(self) -> Optional[str]:
        return self.api_base or self.endpoint


class RunnerConfig(BaseModel):
    turn_delay_seconds: float = 0.5    # Pause between turns (rate limit protection)
    stop_on_first_compromise: bool = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_messages_up_to_turn(
    attack: MultiTurnAttack,
    turn_index: int,
    collected_responses: list[dict],
    target_system_prompt: Optional[str],
) -> list[dict]:
    """
    Build the message list to send to the target model for `turn_index`.

    For turns before turn_index we interleave:
      - attack turns (user messages, and synthetic assistant turns from the attack definition)
      - actual model responses collected so far

    Synthetic assistant turns in the attack definition are injected as-is —
    they poison the model's context by making it believe it already said those things.
    """
    messages: list[dict] = []

    if target_system_prompt:
        messages.append({"role": "system", "content": target_system_prompt})

    response_cursor = 0  # index into collected_responses

    for i, turn in enumerate(attack.turns[:turn_index]):
        if turn.role == TurnRole.USER:
            messages.append({"role": "user", "content": turn.content})
            # After each real user turn, add the actual model response (if we have it)
            if response_cursor < len(collected_responses):
                messages.append(collected_responses[response_cursor])
                response_cursor += 1
        elif turn.role == TurnRole.ASSISTANT:
            # Synthetic assistant turn — inject directly to poison context
            # (no real model response consumed here)
            messages.append({"role": "assistant", "content": turn.content})
        elif turn.role == TurnRole.SYSTEM:
            # Attempted system prompt injection
            messages.append({"role": "system", "content": turn.content})

    # Add the current turn
    current_turn = attack.turns[turn_index]
    if current_turn.role == TurnRole.USER:
        messages.append({"role": "user", "content": current_turn.content})

    return messages


async def _send_to_target(
    messages: list[dict],
    config: TargetConfig,
) -> tuple[str, int]:
    """
    Send messages to the target via LiteLLM (same stack as single-turn tests).
    """
    from app.services.llm_client import llm_client

    for attempt in range(config.max_retries + 1):
        result = await llm_client.chat(
            model=config.model,
            messages=messages,
            api_key=config.api_key,
            api_base=config.resolved_api_base(),
            timeout=config.timeout_seconds,
        )

        if result.get("success"):
            usage = result.get("usage") or {}
            tokens = int(usage.get("total_tokens") or 0)
            return result.get("response_text") or "", tokens

        if attempt == config.max_retries:
            raise RuntimeError(result.get("error", "Target model request failed"))

        logger.warning(
            f"LiteLLM target call failed on attempt {attempt + 1}: {result.get('error')}"
        )
        await asyncio.sleep(2 ** attempt)


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

class MultiTurnRunner:
    def __init__(
        self,
        target_config: TargetConfig,
        judge_config: Optional["JudgeConfig"] = None,
        runner_config: Optional[RunnerConfig] = None,
    ):
        self.target = target_config
        self.judge = MultiTurnEvaluator(judge_config) if judge_config else MultiTurnEvaluator()
        self.config = runner_config or RunnerConfig()

    async def run(self, attack: MultiTurnAttack) -> MultiTurnAttackResult:
        """Execute a full multi-turn attack and return results."""
        start_time = time.monotonic()

        collected_responses: list[dict] = []    # actual model responses
        turn_responses: list[dict] = []         # full record (turn + response)
        total_tokens = 0
        compromised = False
        compromised_at_turn: Optional[int] = None
        error: Optional[str] = None

        # Identify which turns actually require sending a message to the model
        # (skip pure synthetic assistant turns — they just prime context)
        sendable_turns = [
            (i, t) for i, t in enumerate(attack.turns)
            if t.role in (TurnRole.USER, TurnRole.SYSTEM)
        ]

        logger.info(
            f"[{attack.id}] Starting {len(sendable_turns)}-turn attack against "
            f"{self.target.model}"
        )

        for i, (turn_index, turn) in enumerate(sendable_turns):
            try:
                messages = _build_messages_up_to_turn(
                    attack=attack,
                    turn_index=turn_index + 1,
                    collected_responses=collected_responses,
                    target_system_prompt=self.target.system_prompt,
                )

                logger.debug(f"[{attack.id}] Sending turn {i+1}/{len(sendable_turns)}")
                response_text, tokens = await _send_to_target(messages, self.target)
                total_tokens += tokens

                response_msg = {"role": "assistant", "content": response_text}
                collected_responses.append(response_msg)
                turn_responses.append({
                    "turn_index": turn_index,
                    "sent": turn.content,
                    "received": response_text,
                    "is_payload": turn.is_payload,
                    "is_checkpoint": turn.eval_checkpoint,
                })

                should_eval = (
                    turn.eval_checkpoint
                    or turn.is_payload
                    or (
                        attack.eval_strategy == EvalStrategy.FINAL_TURN_ONLY
                        and i == len(sendable_turns) - 1
                    )
                    or attack.eval_strategy == EvalStrategy.ANY_TURN
                )

                if should_eval and not compromised:
                    is_hit = await self.judge.evaluate_turn(
                        attack=attack,
                        turn_index=turn_index,
                        response=response_text,
                        full_conversation=collected_responses,
                    )
                    if is_hit:
                        compromised = True
                        compromised_at_turn = turn_index
                        logger.warning(
                            f"[{attack.id}] COMPROMISED at turn {turn_index} "
                            f"— {self.target.model}"
                        )
                        if self.config.stop_on_first_compromise:
                            break

                if self.config.turn_delay_seconds > 0:
                    await asyncio.sleep(self.config.turn_delay_seconds)

            except Exception as e:
                error = str(e)
                logger.error(f"[{attack.id}] Error at turn {turn_index}: {e}")
                break

        # --- Final cumulative eval if strategy requires it ---
        final_judge_reasoning = "Not evaluated"
        confidence = 0.0

        if attack.eval_strategy == EvalStrategy.CUMULATIVE or (
            compromised is False and len(collected_responses) > 0
        ):
            final_eval = await self.judge.evaluate_cumulative(
                attack=attack,
                full_conversation=collected_responses,
            )
            compromised = compromised or final_eval.compromised
            confidence = final_eval.confidence
            final_judge_reasoning = final_eval.reasoning
        else:
            confidence = 1.0 if compromised else 0.0
            final_judge_reasoning = f"Compromised at turn {compromised_at_turn}" if compromised else "No compromise detected"

        latency_ms = int((time.monotonic() - start_time) * 1000)

        return MultiTurnAttackResult(
            attack_id=attack.id,
            target_model=self.target.model,
            target_endpoint=self.target.resolved_api_base() or "",
            turn_responses=turn_responses,
            compromised=compromised,
            compromised_at_turn=compromised_at_turn,
            confidence=confidence,
            judge_reasoning=final_judge_reasoning,
            total_tokens_used=total_tokens,
            latency_ms=latency_ms,
            error=error,
        )


# ---------------------------------------------------------------------------
# Batch runner
# ---------------------------------------------------------------------------

async def run_attack_suite(
    attacks: list[MultiTurnAttack],
    target_config: TargetConfig,
    judge_config: Optional["JudgeConfig"] = None,
    runner_config: Optional[RunnerConfig] = None,
    concurrency: int = 3,
) -> list[MultiTurnAttackResult]:
    """
    Run multiple multi-turn attacks concurrently (bounded by `concurrency`).
    Suitable for campaign execution.
    """
    semaphore = asyncio.Semaphore(concurrency)
    runner = MultiTurnRunner(target_config, judge_config, runner_config)

    async def run_with_semaphore(attack: MultiTurnAttack) -> MultiTurnAttackResult:
        async with semaphore:
            return await runner.run(attack)

    tasks = [run_with_semaphore(a) for a in attacks]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    final: list[MultiTurnAttackResult] = []
    for attack, result in zip(attacks, results):
        if isinstance(result, Exception):
            logger.error(f"Attack {attack.id} raised exception: {result}")
            final.append(MultiTurnAttackResult(
                attack_id=attack.id,
                target_model=target_config.model,
                target_endpoint=target_config.resolved_api_base() or "",
                turn_responses=[],
                compromised=False,
                confidence=0.0,
                judge_reasoning="Runner exception",
                error=str(result),
            ))
        else:
            final.append(result)

    return final
