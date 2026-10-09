"""
Where each attack category sits in the two taxonomies security teams use:

- OWASP Top 10 for LLM Applications, 2025 edition
- MITRE ATLAS techniques

Reports, SARIF output and the dashboard attach these to every finding so a
result can be filed against a standard instead of AYZO's own category names.
"""

OWASP = {
    "LLM01": "Prompt Injection",
    "LLM02": "Sensitive Information Disclosure",
    "LLM05": "Improper Output Handling",
    "LLM06": "Excessive Agency",
    "LLM07": "System Prompt Leakage",
    "LLM08": "Vector and Embedding Weaknesses",
}

ATLAS = {
    "AML.T0051.000": "LLM Prompt Injection: Direct",
    "AML.T0051.001": "LLM Prompt Injection: Indirect",
    "AML.T0053": "LLM Plugin Compromise",
    "AML.T0054": "LLM Jailbreak",
    "AML.T0056": "LLM Meta Prompt Extraction",
    "AML.T0057": "LLM Data Leakage",
}

# category -> (OWASP id, ATLAS id or None)
_MAP: dict[str, tuple[str, str | None]] = {
    "prompt_injection": ("LLM01", "AML.T0051.000"),
    "indirect_injection": ("LLM01", "AML.T0051.001"),
    "multi_turn": ("LLM01", "AML.T0054"),
    "jailbreak": ("LLM01", "AML.T0054"),
    "role_override": ("LLM01", "AML.T0054"),
    "context_manipulation": ("LLM01", "AML.T0051.000"),
    "advanced_bypasses": ("LLM01", "AML.T0051.000"),
    "system_prompt_leak": ("LLM07", "AML.T0056"),
    "data_leakage": ("LLM02", "AML.T0057"),
    "insecure_output_handling": ("LLM05", None),
    "sql_injection": ("LLM05", "AML.T0053"),
    "agent_misuse": ("LLM06", "AML.T0053"),
    "excessive_agency": ("LLM06", "AML.T0053"),
    "tool_abuse": ("LLM06", "AML.T0053"),
    "cross_user": ("LLM02", "AML.T0057"),
    "vector_weaknesses": ("LLM08", "AML.T0051.001"),
    "rag_injection": ("LLM08", "AML.T0051.001"),
    # A broken business rule is the app acting outside what it is allowed to do.
    "business_rules": ("LLM06", None),
    "custom": ("LLM01", None),
}


def taxonomy_for(category: str) -> dict:
    """{"owasp": {"id", "name"}, "atlas": {"id", "name"} | None} for a category."""
    owasp_id, atlas_id = _MAP.get(category, ("LLM01", None))
    return {
        "owasp": {"id": f"{owasp_id}:2025", "name": OWASP[owasp_id]},
        "atlas": {"id": atlas_id, "name": ATLAS[atlas_id]} if atlas_id else None,
    }
