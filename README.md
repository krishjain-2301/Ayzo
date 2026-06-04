# 🛡️ AYZO — AI Red Team & Vulnerability Assessment Platform

> Automated security testing for AI models. Think Burp Suite, but for LLMs.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-In%20Development-yellow.svg)

## What is AYZO?

AYZO is an advanced AI security platform that helps organizations assess the security of their large language models (LLMs) and agents by automatically running large-scale adversarial tests, analyzing responses, and generating vulnerability reports.

### Core Workflow

```
Target AI Model → Attack Engine → Automated Testing → Response Analysis → Vulnerability Detection → Security Report
```

## ✨ Features

- **📊 Interactive Dashboard Analytics** — Visualize your historical risk trends with sleek, interactive charts.
- **🎯 Attack Library** — Browse 80+ security test cases categorized by the OWASP LLM Top 10.
- **🛠️ Custom Payload Builder** — Write, categorize, and save your own custom prompt injections and jailbreaks directly from the browser UI.
- **🚀 Bulk Campaigns** — Run massive, multi-payload security assessments across your models in seconds.
- **🤖 Agentic Attacks (Crescendo)** — Spawn an Attacker LLM to conduct a multi-turn, adaptive conversation aimed at bypassing your target's safety filters.
- **🛡️ Live Blue Team Proxy** — Monitor live firewall traffic as the AYZO Proxy evaluates and blocks malicious prompts in real-time.
- **🎯 Target Management** — Seamlessly connect to and manage local Ollama instances, OpenAI/Anthropic models, or your own custom API endpoints.
- **📄 PDF Report Generation** — Export pristine, print-friendly Executive Summaries of your security assessments with a single click.

## Tech Stack

| Layer | Technology |
|:---|:---|
| **Frontend** | Next.js 15, TypeScript, Tailwind CSS, Recharts, Lucide Icons |
| **Backend** | FastAPI, Python 3.12+, Pydantic |
| **Database** | PostgreSQL 16 |
| **Task Queue** | Celery + Redis |
| **AI Layer** | LiteLLM (Ollama, OpenAI, Anthropic, Custom endpoints) |
| **Auth** | NextAuth.js v5 + Google OAuth |
| **Monorepo** | Turborepo + pnpm |

## Project Structure

```
ayzo/
├── apps/
│   ├── web/          # Next.js 15 frontend
│   └── api/          # FastAPI backend
├── packages/         # Shared types/configs
├── docker-compose.yml
└── turbo.json
```

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.12+
- Docker & Docker Compose
- pnpm (`npm install -g pnpm`)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/krishjain-2301/Ayzo.git
cd Ayzo

# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis)
docker-compose up -d

# Start development
pnpm dev
```

## License

MIT License — see [LICENSE](./LICENSE) for details.

---

**Built by [Krish Jain](https://github.com/krishjain-2301)**
