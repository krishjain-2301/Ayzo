"""
HTTP front for two R3dShad0w7/PromptMe challenges, so AYZO can scan them.

PromptMe's challenges are Flask pages that take HTML forms and answer with
HTML. This file imports a challenge's own module and calls the same functions
its form handler calls, answering on POST /chat with JSON. Nothing in the
project is changed. It also keeps the challenge off the network: the
project's own launcher binds 0.0.0.0, and challenge 7 does so with the
Werkzeug debugger on.

    git clone https://github.com/R3dShad0w7/PromptMe promptme
    pip install flask ollama langchain-ollama langchain-core requests bs4 fastapi uvicorn
    python promptme_adapter.py promptme --challenge 7 --port 5030

The challenges name their Ollama models in code (`mistral`, and
`granite3-guardian` for challenge 1's input filter). To run them on a model
you already have, give it that name: `ollama cp qwen2.5-coder:3b mistral`.

Challenge 1 keeps one conversation per browser session; here every request
is a fresh session, which is what a first message looks like.
"""

import argparse
import sys
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("project", help="Path to a clone of PromptMe")
parser.add_argument("--challenge", type=int, choices=[1, 7], required=True)
parser.add_argument("--port", type=int, default=5030)
args = parser.parse_args()

FOLDERS = {1: "LLM01_Prompt_Injection", 7: "LLM07_System_Prompt_Leakage"}
folder = Path(args.project).resolve() / "challenges" / FOLDERS[args.challenge]
sys.path.insert(0, str(folder))

import uvicorn  # noqa: E402
from fastapi import FastAPI, HTTPException  # noqa: E402
from pydantic import BaseModel  # noqa: E402

if args.challenge == 1:
    import app1 as challenge  # noqa: E402  (the project's file)
else:
    import app7 as challenge  # noqa: E402  (the project's file)

app = FastAPI(title=f"PromptMe challenge {args.challenge} (HTTP front)")


class ChatRequest(BaseModel):
    message: str


def answer_challenge_1(message: str) -> str:
    # Same branches as app1.chat(), minus the per-browser history.
    if message.startswith("/fetch "):
        return challenge.summarize_webpage(message.split("/fetch ", 1)[1])
    if challenge.check_malicious_input(message):
        return "Your input was flagged as potentially malicious and has been blocked."
    return challenge.check_for_flag(challenge.call_ollama(message))


@app.get("/health")
def health():
    return {"status": "ok", "challenge": args.challenge}


@app.post("/chat")
def chat(request: ChatRequest):
    try:
        if args.challenge == 1:
            return {"response": answer_challenge_1(request.message)}
        return {"response": challenge.generate_response(request.message)}
    except Exception as error:  # the page itself would answer 500 here
        raise HTTPException(status_code=500, detail=f"{type(error).__name__}: {error}"[:300])


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning")
