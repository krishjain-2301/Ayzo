"""
apps/api/app/attacks/multi_turn/
=================================
Multi-turn adversarial attack library for AYZO.

Quick start
-----------
    from app.attacks.multi_turn import (
        MULTI_TURN_ATTACK_LIBRARY,
        MultiTurnRunner,
        TargetConfig,
        run_attack_suite,
        get_by_category,
        get_by_severity,
    )
    from app.attacks.multi_turn.models import AttackCategory, Severity

    # Run a single attack
    runner = MultiTurnRunner(target_config=TargetConfig(
        endpoint="http://localhost:11434",
        model="llama3.2",
    ))
    result = await runner.run(MULTI_TURN_ATTACK_LIBRARY[0])

    # Run all CRITICAL attacks
    critical = get_by_severity(Severity.CRITICAL)
    results = await run_attack_suite(critical, target_config=...)
"""

from .models import (
    MultiTurnAttack,
    MultiTurnAttackResult,
    AttackTurn,
    AttackCategory,
    AttackTechnique,
    Severity,
    EvalStrategy,
    TurnRole,
)
from .library import (
    MULTI_TURN_ATTACK_LIBRARY,
    get_by_category,
    get_by_technique,
    get_by_severity,
    get_by_id,
)
from .runner import (
    MultiTurnRunner,
    TargetConfig,
    RunnerConfig,
    run_attack_suite,
)
from .evaluator import (
    MultiTurnEvaluator,
    JudgeConfig,
    EvalResult,
)

__all__ = [
    # Models
    "MultiTurnAttack", "MultiTurnAttackResult", "AttackTurn",
    "AttackCategory", "AttackTechnique", "Severity", "EvalStrategy", "TurnRole",
    # Library
    "MULTI_TURN_ATTACK_LIBRARY",
    "get_by_category", "get_by_technique", "get_by_severity", "get_by_id",
    # Runner
    "MultiTurnRunner", "TargetConfig", "RunnerConfig", "run_attack_suite",
    # Evaluator
    "MultiTurnEvaluator", "JudgeConfig", "EvalResult",
]
