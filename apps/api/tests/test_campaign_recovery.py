import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.campaign_recovery import recover_stale_campaigns


@pytest.mark.asyncio
async def test_recover_stale_campaigns_marks_orphaned_rows():
    mock_campaign = type("Campaign", (), {"status": "running", "description": None})()

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_campaign]
    mock_db.execute = AsyncMock(return_value=mock_result)
    mock_db.commit = AsyncMock()

    with patch("app.services.campaign_recovery.async_session_maker") as maker:
        maker.return_value.__aenter__ = AsyncMock(return_value=mock_db)
        maker.return_value.__aexit__ = AsyncMock(return_value=None)

        count = await recover_stale_campaigns()

    assert count == 1
    assert mock_campaign.status == "failed"
    assert "Interrupted" in mock_campaign.description
