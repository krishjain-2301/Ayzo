# 🎯 AYZO — Local AI Red Team & Vulnerability Assessment Platform

> Automated dynamic security testing for local LLM applications and agents. Run security audits entirely on your machine.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-Ready-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)

---

## What is AYZO?

AYZO is a local-first red-teaming tool designed to test LLM apps, chatbots, and agents for prompt injection, jailbreaks, and instructions overrides. Unlike standard scanners, AYZO boots your codebase in an isolated subprocess, monitors port bindings, dynamically conducts adversarial tests, and securely tears down your application when finished.

### Core Workflow

```
[Local Codebase Path] 
       │
       ▼ (Boot Subprocess)
[App Running on Port] ◄─── (Adversarial Payloads) ───► [AYZO Attack Engine]
       │                                                     │
       ▼ (Graceful Teardown)                                 ▼ (LiteLLM / Local Heuristic)
[Subprocess Terminated]                                 [Vulnerability Evaluation]
                                                             │
                                                             ▼
                                                    [Security Report & DB Logs]
```

---

## Key Features

- **🚀 Subprocess Orchestration** — Boot local project directories automatically, bind to target ports, run scans, and clean up.
- **🧬 Adversarial Attack Engine** — Standardized attacks (Prompt Injection, Role Override, System Prompt Leakage) adapted to local contexts.
- **🧠 Resilient Evaluation** — Responses are graded using LLM-as-a-Judge (via LiteLLM / Ollama) with a backup keyword heuristic engine if your AI endpoints are offline.
- **🔒 Zero Cloud Overhead** — All external services (Supabase, Postgres, Redis, Celery, Google Auth) have been purged. Your database runs on a local SQLite instance.

---

## Tech Stack

| Layer | Technology |
|:---|:---|
| **Frontend** | Next.js 15, TypeScript, Tailwind CSS |
| **Backend** | FastAPI, Python 3.12, SQLite (via SQLAlchemy + aiosqlite) |
| **Orchestration** | Python Asyncio Subprocesses (with Process Group isolation) |
| **AI Layer** | LiteLLM & Local Heuristic Engine |
| **Package Management** | pnpm Monorepo |

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **Python** 3.12+
- **pnpm** (`npm install -g pnpm`)

### Setup & Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/krishjain-2301/Ayzo.git
   cd Ayzo
   ```

2. **Install Frontend Dependencies**
   ```bash
   pnpm install
   ```

3. **Setup Backend Python Virtual Environment**
   ```bash
   cd apps/api
   python -m venv .venv
   
   # Windows
   .venv\Scripts\activate
   # Linux/macOS
   source .venv/bin/activate
   
   pip install -r requirements.txt
   ```

---

## Running the Platform

1. **Start the API Backend**
   ```bash
   cd apps/api
   # Make sure your virtual environment is active
   uvicorn app.main:app --reload
   ```

2. **Start the Frontend Web App**
   ```bash
   # From the root directory
   pnpm dev:web
   ```

3. **Navigate to the Platform**
   Open your browser to `http://localhost:3000`.

---

## Running Your First Audit

To run a scan against a local project, register it as a **Target** in the dashboard:

1. Click **AI Targets** -> **Add Target**.
2. Fill out the target configuration:
   - **Project Directory Path:** The absolute path to your repository (e.g. `C:\Projects\my-chatbot-app`).
   - **Start Command:** The command to boot your app (e.g. `python app.py` or `npm run dev`).
   - **Target Port:** The port your chatbot runs on (e.g. `5000` or `3000`).
3. Click **Campaigns** -> **New Assessment** -> select the target.
4. Select the attack categories and click **Start Assessment**. The AYZO red-team agent will orchestrate the rest!

---

**Built by [Krish Jain](https://github.com/krishjain-2301)**
