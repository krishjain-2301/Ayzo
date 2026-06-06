import pytest
from unittest.mock import patch, AsyncMock
from app.services.mutation_engine import mutation_engine

def test_parse_numbered_list():
    text = "1. Variant A\n2. Variant B\n3. Variant C\n"
    variants = mutation_engine._parse_numbered_list(text, 3)
    assert len(variants) == 3
    assert "Variant A" in variants
    assert "Variant B" in variants

    text_bullets = "- Variant X\n- Variant Y\n"
    variants_bullets = mutation_engine._parse_numbered_list(text_bullets, 2)
    assert len(variants_bullets) == 2
    assert "Variant X" in variants_bullets

def test_encoding_mutations():
    prompt = "Hello World"
    encoded = mutation_engine._encoding_mutations(prompt, 3)
    # base64, reverse, rot13
    assert len(encoded) == 3
    assert "SGVsbG8gV29ybGQ=" in encoded[0]  # Base64 for Hello World
    assert "dlroW olleH" in encoded[1]       # Reversed
    assert "Uryyb Jbeyq" in encoded[2]       # ROT13

def test_split_payload():
    prompt = "This is a short test prompt"
    mutations = mutation_engine._split_payload(prompt, 2)
    assert len(mutations) == 2
    assert "Part 1" in mutations[0]
    assert "Part 2" in mutations[0]

@pytest.mark.asyncio
async def test_mutate_strategy_dispatch():
    # Test that mutate properly dispatches to strategies
    with patch("app.services.mutation_engine.MutationEngine._paraphrase", new_callable=AsyncMock) as mock_paraphrase:
        mock_paraphrase.return_value = ["Paraphrased 1", "Paraphrased 2"]
        
        mutations = await mutation_engine.mutate(
            prompt="Original",
            count=2,
            strategies=["paraphrase"]
        )
        
        assert len(mutations) == 2
        assert mutations[0]["strategy"] == "paraphrase"
        assert mutations[0]["original"] == "Original"
        assert "Paraphrased" in mutations[0]["prompt"]
