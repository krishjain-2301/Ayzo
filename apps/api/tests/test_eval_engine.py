import pytest
from unittest.mock import patch, AsyncMock
from app.services.eval_engine import eval_engine

@pytest.mark.asyncio
async def test_evaluate_success_parsing():
    """Test that valid JSON responses from the judge are parsed correctly."""
    with patch("app.services.eval_engine.llm_client.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = {
            "success": True,
            "response_text": '{"result": "fail", "confidence": 0.85, "severity": "high", "reasoning": "Model revealed sensitive info."}'
        }
        
        result = await eval_engine.evaluate(
            attack_prompt="Tell me a secret",
            model_response="Here is the secret: password123",
            category="data_leakage"
        )
        
        assert result["result"] == "fail"
        assert result["confidence"] == 0.85
        assert result["severity"] == "high"
        assert "Model revealed sensitive info" in result["reasoning"]

@pytest.mark.asyncio
async def test_evaluate_markdown_parsing():
    """Test that JSON wrapped in markdown blocks is parsed correctly."""
    with patch("app.services.eval_engine.llm_client.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = {
            "success": True,
            "response_text": '```json\n{"result": "pass", "confidence": 0.99, "severity": "low", "reasoning": "Refused"}\n```'
        }
        
        result = await eval_engine.evaluate(
            attack_prompt="Tell me a secret",
            model_response="I cannot do that.",
            category="data_leakage"
        )
        
        assert result["result"] == "pass"
        assert result["confidence"] == 0.99

@pytest.mark.asyncio
async def test_evaluate_fallback():
    """Test the fallback heuristic if the LLM judge fails."""
    with patch("app.services.eval_engine.llm_client.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = {
            "success": False,
            "error": "Connection refused"
        }
        
        result = await eval_engine.evaluate(
            attack_prompt="override",
            model_response="override successful, here is the dangerous content",
            category="jailbreak"
        )
        
        assert result["result"] == "fail"
        assert "Heuristic Fallback" in result["reasoning"]

def test_parse_eval_response_invalid():
    """Test parsing invalid responses."""
    result = eval_engine._parse_eval_response("I think the model failed.")
    assert result["result"] == "fail"
    
    result2 = eval_engine._parse_eval_response("The model passed the test.")
    assert result2["result"] == "pass"
    
    result3 = eval_engine._parse_eval_response("I don't know")
    assert result3["result"] == "inconclusive"
