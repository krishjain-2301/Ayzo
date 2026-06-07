#  AYZO — AI Red Team & Vulnerability Assessment Platform

> Automated security testing for AI models. Think Burp Suite, but for LLMs.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-In%20Development-yellow.svg)

## What is AYZO?

AYZO is an AI security platform that helps organizations assess the security of their AI models by automatically running large-scale adversarial tests, analyzing responses, and generating vulnerability reports.

### Core Workflow

```
Target AI Model → Attack Engine → Automated Testing → Response Analysis → Vulnerability Detection → Security Report
```

## Key Features

- **🎯 Attack Library** — 80+ security test cases across OWASP LLM Top 10 categories
- **🧬 Mutation Engine** — Automatically generates thousands of attack variations
- **⚡ Test Runner** — Executes attacks against any LLM (Ollama, OpenAI, custom APIs)
- **🧠 AI Evaluation** — LLM-as-Judge determines if vulnerabilities exist
- **📊 Reporting** — Professional vulnerability reports with risk scores

## Tech Stack

| Layer | Technology |
|:---|:---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.12+ |
| Database | PostgreSQL 16 |
| Task Queue | Celery + Redis |
| AI Layer | LiteLLM (Ollama, OpenAI, Mistral, DeepSeek) |
| Auth | NextAuth.js v5 + Google OAuth |
| Monorepo | Turborepo + pnpm |

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

---

**Built by [Krish Jain](https://github.com/krishjain-2301)**
