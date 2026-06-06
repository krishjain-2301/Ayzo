import httpx
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
res = httpx.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}")
data = res.json()
if "models" in data:
    for m in data["models"]:
        print(f"{m['name']} - {m.get('description', '')[:50]}")
else:
    print(data)
