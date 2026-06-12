import asyncio
import os
from app.services.llm_client import LLMClient

async def test_byok():
    # Make sure we have a GROQ key in the environment to prove we bypass it
    print(f"System GROQ_API_KEY present: {bool(os.getenv('GROQ_API_KEY'))}")
    
    client = LLMClient()
    
    # 1. Test with a FAKE user API key (Simulating a user providing their own key)
    print("\n--- Testing with User's FAKE API Key ---")
    user_fake_key = "gsk_fake_user_key_12345"
    result = await client.test_connection(
        model="groq/llama3-8b-8192", 
        api_key=user_fake_key
    )
    
    if not result["success"]:
        print(f"✅ SUCCESS: The request was rejected! This proves Litellm used the user's fake key and got: {result['message']}")
    else:
        print("❌ FAIL: The request succeeded, which means it used the system key!")

if __name__ == "__main__":
    asyncio.run(test_byok())
