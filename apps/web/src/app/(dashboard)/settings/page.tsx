"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import {
  Key,
  Copy,
  CheckCircle2,
  ShieldAlert,
  FileJson,
  Cpu,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import clsx from "clsx";

// ─── Types ─────────────────────────────────────────────────────────────────

interface ModelOption {
  label: string;
  value: string;
  note: string;
  requiresKey: boolean;
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    label: "Groq — Llama 3.3 70B",
    value: "groq/llama-3.3-70b-versatile",
    note: "Free, fast. Get a key at console.groq.com",
    requiresKey: true,
  },
  {
    label: "Ollama — Llama 3.2 (local)",
    value: "ollama/llama3.2",
    note: "100% offline. Run: ollama pull llama3.2",
    requiresKey: false,
  },
  {
    label: "Ollama — Mistral 7B (local)",
    value: "ollama/mistral",
    note: "100% offline. Run: ollama pull mistral",
    requiresKey: false,
  },
  {
    label: "OpenAI — GPT-4o Mini",
    value: "gpt-4o-mini",
    note: "Requires an OpenAI API key",
    requiresKey: true,
  },
  {
    label: "Google — Gemini 1.5 Flash",
    value: "gemini/gemini-1.5-flash",
    note: "Requires a Gemini API key",
    requiresKey: true,
  },
];

// ─── Component ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // CI/CD API key state
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Eval model connection test
  const [testModel, setTestModel] = useState(MODEL_OPTIONS[0].value);
  const [testStatus, setTestStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    loadKey();
  }, []);

  const loadKey = async () => {
    try {
      const data = await apiFetch("/auth/api-key");
      setApiKey(data.api_key);
    } catch {
      // No key yet — that's fine
    } finally {
      setKeyLoading(false);
    }
  };

  const generateKey = async () => {
    setGenerating(true);
    try {
      const data = await apiFetch("/auth/api-key/generate", { method: "POST" });
      setApiKey(data.api_key);
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const testConnection = async () => {
    setTestStatus("loading");
    setTestMessage("");
    try {
      const res = await apiFetch("/targets/test-model", {
        method: "POST",
        body: JSON.stringify({ model: testModel }),
      });
      if (res.success) {
        setTestStatus("success");
        setTestMessage(`Connected in ${res.response_time_ms?.toFixed(0) ?? "?"}ms`);
      } else {
        setTestStatus("error");
        setTestMessage(res.message || "Connection failed");
      }
    } catch (e: unknown) {
      setTestStatus("error");
      setTestMessage(e instanceof Error ? e.message : "Connection failed");
    }
  };

  const selectedModelOption = MODEL_OPTIONS.find((m) => m.value === testModel);

  return (
    <div className="max-w-4xl space-y-8">
      {/* Page header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-white tracking-tight">
          Settings &amp; Integrations
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Configure your eval model, test connections, and manage CI/CD API keys.
        </p>
      </div>

      {/* ── Eval Model Tester ─────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2">
            <Cpu size={18} className="text-violet-500" /> Eval Model Configuration
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            AYZO uses an LLM to judge whether attacks succeeded. Test your connection here.
          </p>
        </div>

        <div className="p-6 bg-black/40 space-y-5">
          {/* Model selector */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
              Eval Model
            </label>
            <select
              value={testModel}
              onChange={(e) => {
                setTestModel(e.target.value);
                setTestStatus("idle");
                setTestMessage("");
              }}
              className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-violet-500"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            {selectedModelOption && (
              <p className="text-xs text-zinc-500 mt-1.5">
                {selectedModelOption.requiresKey ? "🔑" : "🖥️"}{" "}
                {selectedModelOption.note}
              </p>
            )}
          </div>

          {/* Setup instructions */}
          <div className="bg-zinc-950 border border-zinc-800/60 rounded-lg p-4 text-xs font-mono text-zinc-400 space-y-1">
            <p className="text-zinc-500 text-[11px] uppercase tracking-widest font-bold mb-2">
              Set in apps/api/.env
            </p>
            <p>DEFAULT_EVAL_MODEL=<span className="text-violet-400">{testModel}</span></p>
            <p>MUTATOR_MODEL=<span className="text-violet-400">{testModel}</span></p>
            {selectedModelOption?.requiresKey && (
              <p className="text-amber-400/80 mt-2">
                # Also add your API key for this provider
              </p>
            )}
          </div>

          {/* Test button + result */}
          <div className="flex items-center gap-3">
            <button
              onClick={testConnection}
              disabled={testStatus === "loading"}
              className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {testStatus === "loading" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              {testStatus === "loading" ? "Testing…" : "Test Connection"}
            </button>

            {testStatus === "success" && (
              <span className="flex items-center gap-1.5 text-green-400 text-sm">
                <CheckCircle size={15} /> {testMessage}
              </span>
            )}
            {testStatus === "error" && (
              <span className="flex items-center gap-1.5 text-red-400 text-sm">
                <XCircle size={15} /> {testMessage}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── CI/CD API Key ─────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-start">
          <div>
            <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2">
              <Key size={18} className="text-violet-500" /> CI/CD API Key
            </h2>
            <p className="text-zinc-400 text-sm mt-1">
              Use this key to authenticate AYZO from your CI/CD pipelines.
            </p>
          </div>
          <button
            onClick={generateKey}
            disabled={generating}
            className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          >
            {generating ? "Generating…" : apiKey ? "Regenerate Key" : "Generate Key"}
          </button>
        </div>

        <div className="p-6 bg-black/40">
          {keyLoading ? (
            <p className="text-zinc-500 text-sm animate-pulse">Loading…</p>
          ) : apiKey ? (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                Your Key
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={apiKey}
                  className="flex-1 bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-sm font-mono text-zinc-300 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={handleCopy}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border",
                    copied
                      ? "bg-green-500/10 text-green-400 border-green-500/20"
                      : "bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700"
                  )}
                >
                  {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-amber-500/80 mt-1 flex items-center gap-1">
                <ShieldAlert size={12} /> Keep this key secret. Regenerating will
                invalidate your old key.
              </p>
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">
              No API key generated yet. Click &ldquo;Generate Key&rdquo; to create one.
            </p>
          )}
        </div>
      </div>

      {/* ── CI/CD Integration Guide ───────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2">
            <FileJson size={18} className="text-blue-500" /> CI/CD Integration Guide
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Automate security testing in your deployment pipeline.
          </p>
        </div>

        <div className="p-6 space-y-6 bg-black/40">
          <div>
            <h3 className="text-sm font-bold text-white mb-2">cURL Example</h3>
            <p className="text-xs text-zinc-400 mb-2">
              Trigger an async scan, poll until complete, fail the pipeline if risk
              score &gt; 40.
            </p>
            <div className="bg-black border border-zinc-800 rounded-lg p-4 font-mono text-xs text-zinc-300 whitespace-pre overflow-x-auto">
{`# 1. Start the scan
CAMPAIGN_ID=$(curl -s -X POST http://localhost:8000/api/v1/cicd/run \\
  -H "Authorization: Bearer \${AYZO_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "CI/CD Pre-Deploy Scan",
    "target_id": "YOUR_TARGET_UUID",
    "attack_categories": ["prompt_injection", "jailbreak"],
    "mutation_depth": 0,
    "mutations_per_prompt": 0
  }' | jq -r '.campaign_id')

echo "Started Campaign: $CAMPAIGN_ID"

# 2. Poll for completion
STATUS="running"
while [ "$STATUS" = "running" ] || [ "$STATUS" = "pending" ]; do
  sleep 10
  RESP=$(curl -s http://localhost:8000/api/v1/cicd/poll/$CAMPAIGN_ID \\
    -H "Authorization: Bearer \${AYZO_API_KEY}")
  STATUS=$(echo $RESP | jq -r '.status')
  echo "Status: $STATUS"
done

# 3. Check Risk Score
RISK_SCORE=$(echo $RESP | jq '.risk_score')

if (( $(echo "$RISK_SCORE > 40" | bc -l) )); then
  echo "Security Gate Failed: Risk Score is $RISK_SCORE"
  exit 1
else
  echo "Security Gate Passed: Risk Score is $RISK_SCORE"
fi`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
