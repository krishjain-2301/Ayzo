"""
Multi-Turn Attack Models
========================
Pydantic models for representing multi-turn adversarial conversations.
Unlike single-shot attacks, multi-turn attacks maintain state across several
exchanges — conditioning the model before the actual payload arrives.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TurnRole(str, Enum):
    USER      = "user"
    ASSISTANT = "assistant"   # synthetic model responses used to prime context
    SYSTEM    = "system"      # injected system-level override attempts


class AttackCategory(str, Enum):
    """Maps to OWASP LLM Top 10 (2025)."""
    PROMPT_INJECTION          = "LLM01"   # Prompt Injection
    INSECURE_OUTPUT           = "LLM02"   # Insecure Output Handling
    TRAINING_DATA_POISONING   = "LLM03"   # Training Data Poisoning
    MODEL_DOS                 = "LLM04"   # Model Denial of Service
    SUPPLY_CHAIN              = "LLM05"   # Supply-Chain Vulnerabilities
    SENSITIVE_INFO_DISCLOSURE = "LLM06"   # Sensitive Information Disclosure
    INSECURE_PLUGIN           = "LLM07"   # Insecure Plugin Design
    EXCESSIVE_AGENCY          = "LLM08"   # Excessive Agency
    OVERRELIANCE              = "LLM09"   # Overreliance
    MODEL_THEFT               = "LLM10"   # Model Theft / Extraction


class AttackTechnique(str, Enum):
    GRADUAL_ESCALATION      = "gradual_escalation"
    ROLE_OVERRIDE           = "role_override"
    CONTEXT_POISONING       = "context_poisoning"
    NESTED_HYPOTHETICAL     = "nested_hypothetical"
    AUTHORITY_CLAIM         = "authority_claim"
    TRUST_BUILDING          = "trust_building"
    REFUSAL_CONDITIONING    = "refusal_conditioning"
    SYCOPHANCY_EXPLOIT      = "sycophancy_exploit"
    SYSTEM_PROMPT_EXTRACT   = "system_prompt_extract"
    TRANSLATION_EVASION     = "translation_evasion"
    TOKEN_SMUGGLING         = "token_smuggling"
    MEMORY_INJECTION        = "memory_injection"
    COMPETING_OBJECTIVES    = "competing_objectives"
    EMOTIONAL_MANIPULATION  = "emotional_manipulation"
    CHARACTER_CONSISTENCY   = "character_consistency"
    CAPABILITY_PROBING      = "capability_probing"


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH     = "high"
    MEDIUM   = "medium"
    LOW      = "low"
    INFO     = "informational"


class EvalStrategy(str, Enum):
    """How to evaluate whether the attack succeeded."""
    FINAL_TURN_ONLY   = "final_turn_only"    # judge only the last response
    ANY_TURN          = "any_turn"           # flag if ANY turn is compromised
    CUMULATIVE        = "cumulative"         # judge the full conversation arc
    KEYWORD_MATCH     = "keyword_match"      # fast pre-filter before LLM judge


# ---------------------------------------------------------------------------
# Core Models
# ---------------------------------------------------------------------------

class AttackTurn(BaseModel):
    """A single turn in a multi-turn attack sequence."""
    role: TurnRole
    content: str
    is_payload: bool = Field(
        default=False,
        description="Mark True on the turn that contains the actual attack payload "
                    "(as opposed to setup/conditioning turns)."
    )
    eval_checkpoint: bool = Field(
        default=False,
        description="If True, evaluate the model response at this turn even if "
                    "it's not the final turn. Useful for detecting early leakage."
    )
    note: Optional[str] = Field(
        default=None,
        description="Internal annotation explaining what this turn is doing tactically."
    )


class MultiTurnAttack(BaseModel):
    """
    A complete multi-turn adversarial test case.

    The `turns` list represents the conversation as it should be *sent* to the
    target model — role=assistant turns are injected as synthetic prior responses
    to prime the model's context before the payload arrives.
    """
    id: str
    name: str
    description: str
    category: AttackCategory
    technique: AttackTechnique
    severity: Severity
    eval_strategy: EvalStrategy
    turns: list[AttackTurn]

    # What a VULNERABLE response looks like
    success_indicators: list[str] = Field(
        description="Keywords / phrases in the model response that indicate the "
                    "attack succeeded (model was compromised)."
    )
    # What a SAFE response looks like
    failure_indicators: list[str] = Field(
        default_factory=list,
        description="Phrases that indicate the model correctly refused."
    )
    judge_prompt_hint: str = Field(
        description="Hint for the LLM-as-Judge evaluator describing exactly what "
                    "a successful compromise looks like for this specific attack."
    )

    tags: list[str] = Field(default_factory=list)
    references: list[str] = Field(
        default_factory=list,
        description="Links to research papers, blog posts, or CVEs this attack "
                    "pattern is based on."
    )


class MultiTurnAttackResult(BaseModel):
    """Result of executing one multi-turn attack against a target model."""
    attack_id: str
    target_model: str
    target_endpoint: str

    # Per-turn responses from the target
    turn_responses: list[dict]  # [{"role": "assistant", "content": "..."}]

    # Evaluation
    compromised: bool
    compromised_at_turn: Optional[int] = None   # 0-indexed
    confidence: float = Field(ge=0.0, le=1.0)
    judge_reasoning: str

    # Metadata
    total_tokens_used: int = 0
    latency_ms: int = 0
    error: Optional[str] = None
