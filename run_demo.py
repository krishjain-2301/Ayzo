import asyncio
import httpx
import uuid

async def run_demo():
    print("1. Registering the Dummy Test App as a Target...")
    async with httpx.AsyncClient() as client:
        # Create Target
        target_res = await client.post("http://127.0.0.1:8000/api/v1/targets", json={
            "name": "Dummy Test App",
            "description": "A deliberately vulnerable python server",
            "project_path": r"C:\Users\jaink\Desktop\Projects\Ayzo\dummy_target",
            "start_command": r"python app.py",
            "target_port": 5000
        })
        target_id = target_res.json()["id"]
        print(f"   Target created with ID: {target_id}")
        
        print("\n2. Launching Hacker Agent Campaign...")
        campaign_res = await client.post("http://127.0.0.1:8000/api/v1/campaigns", json={
            "name": "Local Agent Exploit Test",
            "target_id": target_id,
            "attack_categories": ["prompt_injection", "role_override", "recon"],
            "mutation_depth": 0
        })
        campaign_id = campaign_res.json()["id"]
        print(f"   Campaign launched with ID: {campaign_id}")
        print("\n3. Waiting for Hacker Agent to boot the project, hack it, and shut it down...")
        
        while True:
            await asyncio.sleep(2)
            status_res = await client.get("http://127.0.0.1:8000/api/v1/campaigns")
            campaign = next(c for c in status_res.json() if c["id"] == campaign_id)
            print(f"   Status: {campaign['status'].upper()} (Failed Tests: {campaign['failed_tests']}/{campaign['total_tests']})")
            
            if campaign["status"] in ["completed", "failed"]:
                print(f"\nFinished! Risk Score: {campaign['risk_score']}")
                break

if __name__ == "__main__":
    asyncio.run(run_demo())
