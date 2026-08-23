"""
Hacker Agent — thin wrapper around the shared campaign runner.

Kept as the public name used by campaign endpoints so existing imports
continue to work.
"""

from app.services.campaign_runner import run_campaign_async


class HackerAgent:
    async def run_campaign_async(self, campaign_id: str):
        await run_campaign_async(campaign_id)


hacker_agent = HackerAgent()
