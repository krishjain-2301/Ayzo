"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Key, Copy, CheckCircle2, ShieldAlert, FileJson } from "lucide-react";
import clsx from "clsx";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadKey();
  }, []);

  const loadKey = async () => {
    try {
      const data = await apiFetch("/auth/api-key");
      setApiKey(data.api_key);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-white tracking-tight">Settings & Integrations</h1>
        <p className="text-zinc-400 text-sm mt-1">Manage your CI/CD API keys and view integration docs.</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-8">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-start">
          <div>
            <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2">
              <Key size={18} className="text-violet-500" /> API Keys
            </h2>
            <p className="text-zinc-400 text-sm mt-1">Use this key to authenticate AYZO from your CI/CD pipelines.</p>
          </div>
          <button
            onClick={generateKey}
            disabled={generating}
            className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          >
            {generating ? "Generating..." : apiKey ? "Regenerate Key" : "Generate Key"}
          </button>
        </div>
        <div className="p-6 bg-black/40">
          {loading ? (
            <p className="text-zinc-500 text-sm animate-pulse">Loading key...</p>
          ) : apiKey ? (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Your Static Key</label>
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
                <ShieldAlert size={12} /> Keep this key secret. Regenerating will invalidate your old key.
              </p>
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">No API key generated yet.</p>
          )}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2">
            <FileJson size={18} className="text-blue-500" /> CI/CD Integration Guide
          </h2>
          <p className="text-zinc-400 text-sm mt-1">Automate your AI red teaming in your CI/CD pipelines.</p>
        </div>
        
        <div className="p-6 space-y-6 bg-black/40">
          <div>
            <h3 className="text-sm font-bold text-white mb-2">cURL Example</h3>
            <p className="text-xs text-zinc-400 mb-2">Trigger a synchronous scan and fail the script if risk score &gt; 40.</p>
            <div className="bg-black border border-zinc-800 rounded-lg p-4 font-mono text-xs text-zinc-300 whitespace-pre overflow-x-auto">
{`RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/cicd/run-sync \\
  -H "Authorization: Bearer \${AYZO_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "CI/CD Pre-Deploy Scan",
    "target_id": "YOUR_TARGET_UUID",
    "attack_categories": ["prompt_injection", "jailbreak"],
    "mutation_depth": 0,
    "mutations_per_prompt": 0
  }')

RISK_SCORE=$(echo $RESPONSE | jq '.risk_score')

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
