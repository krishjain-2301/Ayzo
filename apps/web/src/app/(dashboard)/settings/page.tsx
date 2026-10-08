"use client";

import React, { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { CheckCircle2, AlertCircle, Loader2, Cpu, Cloud, HardDrive, KeyRound, RefreshCw, FileJson } from "lucide-react";
import clsx from "clsx";

interface Provider {
  id: string;
  name: string;
  prefix: string;
  models: string[];
  key_set: boolean;
  key_url: string;
}

interface ModelsOverview {
  eval_model: string;
  mutator_model: string;
  effective_mutator_model: string;
  eval_model_missing_key: string | null;
  local: {
    ollama: { running: boolean; models: string[] };
    claude_cli: { installed: boolean; models: string[] };
  };
  providers: Provider[];
}

interface SystemConfig {
  max_payloads_per_category: number;
  max_concurrent_attacks: number;
  cicd_fail_risk_threshold: number;
}

const CI_SNIPPET = `cd apps/api
ayzo scan --target "My app" \\
  --categories prompt_injection,system_prompt_leak,indirect_injection \\
  --fail-on new --sarif ayzo.sarif`;

function providerOf(model: string, providers: Provider[]): Provider | null {
  return providers.find((p) => model.startsWith(p.prefix)) ?? null;
}

function Choice({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "px-3 py-1.5 rounded-lg text-sm font-mono border transition-colors",
        selected
          ? "border-violet-500 bg-violet-600/20 text-white"
          : "border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600"
      )}
    >
      {label}
    </button>
  );
}

/** Pick one model: local ones found on this machine, or an online provider's. */
function ModelPicker({
  data,
  value,
  onChange,
}: {
  data: ModelsOverview;
  value: string;
  onChange: (model: string) => void;
}) {
  const { ollama, claude_cli } = data.local;
  const [custom, setCustom] = useState<Record<string, string>>({});

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <HardDrive size={13} /> On this computer &middot; no key needed
        </p>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-zinc-300 mb-2">Ollama</p>
            {!ollama.running ? (
              <p className="text-sm text-zinc-500">
                Ollama is not running. Start it (or install it from ollama.com), then press Refresh.
              </p>
            ) : ollama.models.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No models installed yet. In a terminal run <code className="text-zinc-300">ollama pull gemma3:4b</code>{" "}
                or <code className="text-zinc-300">ollama pull qwen2.5:7b</code>, then press Refresh.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ollama.models.map((name) => (
                  <Choice
                    key={name}
                    label={name}
                    selected={value === `ollama/${name}`}
                    onClick={() => onChange(`ollama/${name}`)}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-zinc-300 mb-2">
              Claude Code <span className="text-zinc-500">&middot; uses your Claude Code sign-in</span>
            </p>
            {claude_cli.installed ? (
              <div className="flex flex-wrap gap-2">
                {claude_cli.models.map((name) => (
                  <Choice
                    key={name}
                    label={name}
                    selected={value === `claude-cli/${name}`}
                    onClick={() => onChange(`claude-cli/${name}`)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Claude Code is not installed on this computer.</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Cloud size={13} /> Online &middot; needs that provider&apos;s API key
        </p>
        <div className="space-y-3">
          {data.providers.map((p) => (
            <div key={p.id}>
              <p className="text-sm text-zinc-300 mb-2 flex items-center gap-2">
                {p.name}
                <span
                  className={clsx(
                    "text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border",
                    p.key_set
                      ? "text-green-400 border-green-500/30 bg-green-500/10"
                      : "text-zinc-500 border-zinc-700"
                  )}
                >
                  {p.key_set ? "key saved" : "no key"}
                </span>
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                {p.models.map((name) => (
                  <Choice
                    key={name}
                    label={name}
                    selected={value === `${p.prefix}${name}`}
                    onClick={() => onChange(`${p.prefix}${name}`)}
                  />
                ))}
                <input
                  type="text"
                  value={custom[p.id] ?? ""}
                  onChange={(e) => {
                    const name = e.target.value.trim();
                    setCustom({ ...custom, [p.id]: e.target.value });
                    if (name) onChange(`${p.prefix}${name}`);
                  }}
                  placeholder="other model id"
                  className="bg-black border border-zinc-800 rounded-lg px-3 py-1.5 text-sm font-mono text-white placeholder:text-zinc-600 w-44 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [data, setData] = useState<ModelsOverview | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loadError, setLoadError] = useState("");

  const [judge, setJudge] = useState("");
  const [sameAttacker, setSameAttacker] = useState(true);
  const [attacker, setAttacker] = useState("");
  const [keys, setKeys] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [models, cfg] = await Promise.all([apiFetch("/system/models"), apiFetch("/system/config")]);
      setData(models);
      setConfig(cfg);
      setJudge(models.eval_model);
      setSameAttacker(!models.mutator_model);
      setAttacker(models.mutator_model || models.eval_model);
      setLoadError("");
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Could not reach the API.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <div className="max-w-4xl">
        <h1 className="font-heading text-2xl font-bold text-white tracking-tight mb-4">Settings</h1>
        {loadError ? (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">{loadError}</div>
        ) : (
          <p className="text-zinc-500 animate-pulse">Loading...</p>
        )}
      </div>
    );
  }

  // Online providers the current choices depend on, and which still lack a key.
  const chosen = [judge, ...(sameAttacker ? [] : [attacker])];
  const needed = data.providers.filter((p) => chosen.some((m) => providerOf(m, [p])));
  const missing = needed.filter((p) => !p.key_set && !(keys[p.id] || "").trim());
  const changed =
    judge !== data.eval_model ||
    (sameAttacker ? "" : attacker) !== data.mutator_model ||
    Object.values(keys).some((k) => k.trim());

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const api_keys = Object.fromEntries(Object.entries(keys).filter(([, k]) => k.trim()));
      const updated: ModelsOverview = await apiFetch("/system/models", {
        method: "POST",
        body: JSON.stringify({ eval_model: judge, mutator_model: sameAttacker ? "" : attacker, api_keys }),
      });
      setData(updated);
      setKeys({});
      setMessage({ ok: true, text: "Saved. Checking that the judge answers..." });
      const test = await apiFetch("/system/judge-test", { method: "POST", body: JSON.stringify({}) });
      setMessage({ ok: test.success, text: test.success ? `Saved. ${test.message}` : `Saved, but: ${test.message}` });
    } catch (e: unknown) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async (provider: Provider) => {
    if (!confirm(`Remove the saved ${provider.name} API key?`)) return;
    try {
      setData(await apiFetch("/system/models", { method: "POST", body: JSON.stringify({ api_keys: { [provider.id]: "" } }) }));
      setMessage({ ok: true, text: `${provider.name} key removed.` });
    } catch (e: unknown) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not remove the key." });
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-zinc-400 text-sm mt-1">Choose which AI models AYZO uses. Changes apply to the next scan.</p>
        </div>
        <button
          onClick={load}
          className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-4 py-2 rounded-full text-sm flex items-center gap-2"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Judge */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2">
            <Cpu size={18} className="text-violet-500" /> Judge model
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Reads each reply from your app and decides whether the attack worked. Currently{" "}
            <code className="text-zinc-200">{data.eval_model}</code>.
          </p>
        </div>
        <div className="p-6 bg-black/40">
          <ModelPicker data={data} value={judge} onChange={setJudge} />
        </div>
      </div>

      {/* Attacker */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="font-heading text-lg font-bold text-white">Attacker model</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Rewrites attacks that missed, writes business-rule attacks, and plays the attacker in agentic runs.
            Hosted models often refuse this job; a local model usually works better.
          </p>
        </div>
        <div className="p-6 bg-black/40 space-y-5">
          <label className="flex items-center gap-3 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={sameAttacker}
              onChange={(e) => setSameAttacker(e.target.checked)}
              className="accent-violet-600 w-4 h-4"
            />
            Use the same model as the judge
          </label>
          {!sameAttacker && <ModelPicker data={data} value={attacker} onChange={setAttacker} />}
        </div>
      </div>

      {/* Keys */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2">
            <KeyRound size={18} className="text-amber-500" /> API keys
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Only needed for online models. Keys are saved on this computer in{" "}
            <code className="text-zinc-300">apps/api/data/settings.json</code> and are never shown again.
          </p>
        </div>
        <div className="p-6 bg-black/40 space-y-4">
          {data.providers.map((p) => {
            const required = needed.some((n) => n.id === p.id);
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3">
                <div className="w-48 text-sm text-zinc-300">
                  {p.name}
                  {required && !p.key_set && <span className="block text-xs text-amber-400">needed for your choice</span>}
                </div>
                <input
                  type="password"
                  autoComplete="off"
                  value={keys[p.id] ?? ""}
                  onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })}
                  placeholder={p.key_set ? "saved — type to replace" : "paste API key"}
                  className={clsx(
                    "flex-1 min-w-[14rem] bg-black border rounded-lg px-3 py-2 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500",
                    required && !p.key_set && !(keys[p.id] || "").trim() ? "border-amber-500/60" : "border-zinc-800"
                  )}
                />
                <a href={p.key_url} target="_blank" rel="noreferrer" className="text-xs text-violet-400 hover:text-violet-300">
                  Get a key
                </a>
                {p.key_set && (
                  <button onClick={() => removeKey(p)} className="text-xs text-zinc-500 hover:text-red-400">
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Save */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={save}
          disabled={saving || missing.length > 0 || !changed}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Saving..." : "Save and test"}
        </button>
        {missing.length > 0 && (
          <span className="text-sm text-amber-400">
            Enter the {missing.map((p) => p.name).join(" and ")} API key above to use that model.
          </span>
        )}
        {message && (
          <span className={clsx("text-sm flex items-start gap-2 min-w-0 break-words", message.ok ? "text-green-400" : "text-red-400")}>
            {message.ok ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
            {message.text}
          </span>
        )}
      </div>

      {/* Other settings */}
      {config && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800">
            <h2 className="font-heading text-lg font-bold text-white">Scan limits</h2>
            <p className="text-zinc-400 text-sm mt-1">
              Set in <code className="text-zinc-300">apps/api/.env</code>; restart the API after changing them.
            </p>
          </div>
          <dl className="divide-y divide-zinc-800 bg-black/40">
            {(
              [
                ["Attacks per category (MAX_PAYLOADS_PER_CATEGORY)", config.max_payloads_per_category || "no cap"],
                ["Parallel requests to your app (MAX_CONCURRENT_ATTACKS)", config.max_concurrent_attacks],
                ["CI fails above risk score (CICD_FAIL_RISK_THRESHOLD)", config.cicd_fail_risk_threshold],
              ] as [string, string | number][]
            ).map(([label, value]) => (
              <div key={label} className="flex flex-wrap justify-between gap-2 px-6 py-3 text-sm">
                <dt className="text-zinc-400">{label}</dt>
                <dd className="font-mono text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2">
            <FileJson size={18} className="text-blue-500" /> Command line and CI
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Scan from a terminal or a pipeline. The exit code says whether to block the build.
          </p>
        </div>
        <pre className="p-6 bg-black/60 text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre">{CI_SNIPPET}</pre>
      </div>
    </div>
  );
}
