"""
HTTP front for ReversecLabs/damn-vulnerable-llm-agent, so AYZO can scan it.

The project is a Streamlit page with no HTTP API. This file builds the same
agent the page builds (same system message, same tools, same executor
settings, all taken from the project's own files) and answers on POST /chat.
Nothing in the project is changed.

    git clone https://github.com/ReversecLabs/damn-vulnerable-llm-agent dvla
    pip install -r dvla/requirements.txt fastapi uvicorn pyyaml python-dotenv
    python dvla_adapter.py dvla --model ollama/gemma3:4b --port 5010

Each request is a fresh conversation, unless the caller sends "history".
"""

import argparse
import os
import re
import sys
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("project", help="Path to a clone of damn-vulnerable-llm-agent")
parser.add_argument("--model", default="ollama/gemma3:4b")
parser.add_argument("--port", type=int, default=5010)
args = parser.parse_args()

project = Path(args.project).resolve()
os.chdir(project)  # the project opens transactions.db relative to the working directory
sys.path.insert(0, str(project))

import uvicorn  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from langchain.agents import AgentExecutor, ConversationalChatAgent  # noqa: E402
from langchain.memory import ConversationBufferMemory  # noqa: E402
from langchain_litellm import ChatLiteLLM  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from tools import get_current_user_tool, get_recent_transactions_tool  # noqa: E402  (the project's file)

# main.py runs the Streamlit page when imported, so the system message is read from its text.
SYSTEM_MSG = re.search(r'system_msg = """(.*?)"""', (project / "main.py").read_text(encoding="utf-8"), re.S).group(1)
TOOLS = [get_current_user_tool, get_recent_transactions_tool]

app = FastAPI(title="damn-vulnerable-llm-agent (HTTP front)")


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@app.get("/health")
def health():
    return {"status": "ok", "model": args.model}


@app.post("/chat")
def chat(request: ChatRequest):
    memory = ConversationBufferMemory(return_messages=True, memory_key="chat_history", output_key="output")
    for turn in request.history:
        if turn.get("role") == "user":
            memory.chat_memory.add_user_message(turn.get("content", ""))
        elif turn.get("role") == "assistant":
            memory.chat_memory.add_ai_message(turn.get("content", ""))

    # Same construction as main.py, minus the Streamlit callback.
    llm = ChatLiteLLM(model=args.model, temperature=0)
    agent = ConversationalChatAgent.from_llm_and_tools(llm=llm, tools=TOOLS, system_message=SYSTEM_MSG)
    executor = AgentExecutor.from_agent_and_tools(
        agent=agent,
        tools=TOOLS,
        memory=memory,
        return_intermediate_steps=True,
        handle_parsing_errors=True,
        max_iterations=6,
    )
    try:
        result = executor.invoke({"input": request.message})
    except Exception as error:  # a model reply the agent could not use at all
        return {"response": f"[agent error] {error}", "tool_calls": []}

    calls = [
        {"name": step[0].tool, "arguments": str(step[0].tool_input)}
        for step in result.get("intermediate_steps", [])
        if step[0].tool != "_Exception"
    ]
    return {"response": str(result.get("output", "")), "tool_calls": calls}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning")
