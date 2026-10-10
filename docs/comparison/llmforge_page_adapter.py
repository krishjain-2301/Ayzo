"""
Puts AYZO's message where LLMForge's indirect-injection lab reads it: in the
page, not in the user's question.

The lab answers a user question about a source it loads itself (a local file
or a URL). The attacker there is whoever wrote the source. AYZO sends one
chat message per attack, so pointed straight at the lab it could only fill
in the user's question. This file takes each AYZO message, saves it as a
file, and asks the lab a fixed harmless question about that file. LLMForge
itself is unchanged and must already be running.

    python llmforge_page_adapter.py --forge http://127.0.0.1:5020 --port 5021

    POST /chat/{level}   {"message": "..."}  ->  {"response": "...", "bypassed": false}

`bypassed` is the lab's own verdict, passed through for comparison.
"""

import argparse
import tempfile
from pathlib import Path

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

parser = argparse.ArgumentParser()
parser.add_argument("--forge", default="http://127.0.0.1:5020", help="Where LLMForge is running")
parser.add_argument("--model", default="qwen2.5-coder:3b", help="Ollama model the lab should use")
parser.add_argument("--question", default="Summarize this page for me.", help="What the user asks about the page")
parser.add_argument("--port", type=int, default=5021)
args = parser.parse_args()

LAB = "/llmforge/api/v1/vulnerabilities/indirect-prompt-injection/level{level}"
pages = Path(tempfile.mkdtemp(prefix="llmforge-pages-"))

app = FastAPI(title="LLMForge indirect-injection lab (page front)")


class ChatRequest(BaseModel):
    message: str


@app.get("/health")
def health():
    return {"status": "ok", "forge": args.forge}


@app.post("/chat/{level}")
def chat(level: int, request: ChatRequest):
    with tempfile.NamedTemporaryFile("w", suffix=".txt", dir=pages, delete=False, encoding="utf-8") as page:
        page.write(request.message)
    try:
        reply = httpx.post(
            args.forge + LAB.format(level=level),
            json={
                "user_input": args.question,
                "source_type": "local",
                "source_value": page.name,
                "model": args.model,
            },
            timeout=180,
        )
        reply.raise_for_status()
        body = reply.json()
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"{type(error).__name__}: {error}"[:300])
    finally:
        Path(page.name).unlink(missing_ok=True)
    if "assistant_output" not in body:  # the lab reports its own errors with HTTP 200
        raise HTTPException(status_code=502, detail=str(body)[:300])
    return {"response": body["assistant_output"], "bypassed": body.get("bypassed", False)}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning")
