"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { CheckCircle2, AlertCircle, Loader2, Cpu, FileJson, Zap } from "lucide-react";
import clsx from "clsx";

interface SystemConfig {
  eval_model: string;
  mutator_model: string;
  max_payloads_per_category: number;
  max_concurrent_attacks: number;
  cicd_fail_risk_threshold: number;
}

const CI_SNIPPET = `CAMPAIGN=$(curl -sf -X POST http://127.0.0.1:8000/api/v1/cicd/run \\
  -H "Content-Type: application/json" \\
  -d '{"name":"PR scan","target_id":"<target-uuid>","attack_categories":["prompt_injection","system_prompt_leak"],"mutation_depth":0}' \\
  | jq -r .campaign_id)

while true; do
  RESP=$(curl -sf "http://127.0.0.1:8000/api/v1/cicd/poll/$CAMPAIGN")
  FAIL=$(echo "$RESP" | jq -r .should_fail_build)
  [ "$FAIL" != "null" ] && break
  sleep 10
done

echo "$RESP" | jq '{status, risk_score, failed_tests, detail}'
[ "$FAIL" = "true" ] && exit 1 || exit 0`;

export default function SettingsPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [configError, setConfigError] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    apiFetch("/system/config")
      .then(setConfig)
      .catch((e: Error) => setConfigError(e.message || "Could not reach the API."));
  }, []);

  const testJudge = async () => {
    setTestStatus("loading");
    setTestMessage("");
    try {
      const res = await apiFetch("/system/judge-test", { method: "POST" });
      setTestStatus(res.success ? "success" : "error");
      setTestMessage(res.message);
    } catch (e: unknown) {
      setTestStatus("error");
      setTestMessage(e instanceof Error ? e.message : "Could not reach the API.");
    }
  };

  const rows: [string, string | number][] = config
    ? [
        ["Judge model (DEFAULT_EVAL_MODEL)", config.eval_model],
        ["Mutator / attacker model (MUTATOR_MODEL)", config.mutator_model],
        ["Payloads per category (MAX_PAYLOADS_PER_CATEGORY)", config.max_payloads_per_category || "no cap"],
        ["Parallel requests to the target (MAX_CONCURRENT_ATTACKS)", config.max_concurrent_attacks],
        ["CI fails above risk score (CICD_FAIL_RISK_THRESHOLD)", config.cicd_fail_risk_threshold],
      ]
    : [];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-zinc-400 text-sm mt-1">
          The configuration this API is running with. Change values in <code className="text-zinc-300">apps/api/.env</code> and restart the API.
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2">
            <Cpu size={18} className="text-violet-500" /> Judge model
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            A second model decides whether each attack worked. If it cannot be reached, scans stop before sending any attack.
          </p>
        </div>

        <div className="p-6 bg-black/40 space-y-5">
          {configError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">{configError}</div>
          )}
          {rows.length > 0 && (
            <dl className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg">
              {rows.map(([label, value]) => (
                <div key={label} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                  <dt className="text-zinc-400">{label}</dt>
                  <dd className="font-mono text-white">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={testJudge}
              disabled={testStatus === "loading"}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-2"
            >
              {testStatus === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {testStatus === "loading" ? "Testing..." : "Test judge connection"}
            </button>
            {testMessage && (
              <span
                className={clsx(
                  "text-sm flex items-start gap-2 min-w-0 break-words",
                  testStatus === "success" ? "text-green-400" : "text-red-400"
                )}
              >
                {testStatus === "success" ? (
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                )}
                {testMessage}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2">
            <FileJson size={18} className="text-blue-500" /> CI gate
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Start a scan from a pipeline and fail the job on the result. <code className="text-zinc-300">should_fail_build</code> is
            true when the score is above the threshold, and also when the scan could not complete.
          </p>
        </div>
        <pre className="p-6 bg-black/60 text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre">{CI_SNIPPET}</pre>
      </div>
    </div>
  );
}
