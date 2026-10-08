"use client";

import { useState } from "react";
import clsx from "clsx";
import { RefreshCw } from "lucide-react";
import { post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { ModelsOverview, Provider } from "@/lib/types";
import { Button, Card, CardHeader, Input, Loading, Mono, Notice, PageHeader, Tag } from "@/components/ui";

interface Limits {
  max_payloads_per_category: number;
  max_concurrent_attacks: number;
  cicd_fail_risk_threshold: number;
}

const CLI = `cd apps/api
ayzo scan --target "My app" \\
  --categories prompt_injection,system_prompt_leak,indirect_injection \\
  --fail-on new --sarif ayzo.sarif`;

function Choice({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-md border px-3 py-1.5 font-mono text-[13px] transition-colors",
        selected ? "border-accent/70 bg-accent-dim/40 text-fg" : "border-line text-mute hover:border-faint hover:text-fg"
      )}
    >
      {label}
    </button>
  );
}

/** Pick one model: a local one found on this computer, or an online provider's. */
function ModelPicker({ data, value, onChange }: { data: ModelsOverview; value: string; onChange: (model: string) => void }) {
  const { ollama, claude_cli } = data.local;
  const [custom, setCustom] = useState<Record<string, string>>({});

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-xs uppercase tracking-wider text-faint">On this computer · no key needed</p>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[13px] text-fg">Ollama</p>
            {!ollama.running ? (
              <p className="text-[13px] text-mute">Ollama is not running. Start it, or install it from ollama.com, then press Refresh.</p>
            ) : ollama.models.length === 0 ? (
              <p className="text-[13px] text-mute">
                No models installed. In a terminal run <code className="text-fg">ollama pull gemma3:4b</code> or{" "}
                <code className="text-fg">ollama pull qwen3:4b</code>, then press Refresh.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ollama.models.map((name) => (
                  <Choice key={name} label={name} selected={value === `ollama/${name}`} onClick={() => onChange(`ollama/${name}`)} />
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-[13px] text-fg">
              Claude Code <span className="text-mute">· uses your Claude Code sign-in</span>
            </p>
            {claude_cli.installed ? (
              <div className="flex flex-wrap gap-2">
                {claude_cli.models.map((name) => (
                  <Choice key={name} label={name} selected={value === `claude-cli/${name}`} onClick={() => onChange(`claude-cli/${name}`)} />
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-mute">Claude Code is not installed on this computer.</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs uppercase tracking-wider text-faint">Online · needs that provider&apos;s API key</p>
        <div className="space-y-4">
          {data.providers.map((p) => (
            <div key={p.id}>
              <p className="mb-2 flex items-center gap-2 text-[13px] text-fg">
                {p.name} <Tag tone={p.key_set ? "pass" : "mute"}>{p.key_set ? "key set" : "no key"}</Tag>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {p.models.map((name) => (
                  <Choice key={name} label={name} selected={value === `${p.prefix}${name}`} onClick={() => onChange(`${p.prefix}${name}`)} />
                ))}
                <Input
                  mono
                  className="!w-44 !py-1.5"
                  value={custom[p.id] ?? ""}
                  placeholder="other model id"
                  onChange={(e) => {
                    setCustom({ ...custom, [p.id]: e.target.value });
                    if (e.target.value.trim()) onChange(`${p.prefix}${e.target.value.trim()}`);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Models({ initial, onRefresh }: { initial: ModelsOverview; onRefresh: () => void }) {
  const [data, setData] = useState(initial);
  const [judge, setJudge] = useState(initial.eval_model);
  const [same, setSame] = useState(!initial.mutator_model);
  const [attacker, setAttacker] = useState(initial.mutator_model || initial.eval_model);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Online providers the current choices depend on, and which still lack a key.
  const chosen = [judge, ...(same ? [] : [attacker])];
  const needed = data.providers.filter((p) => chosen.some((m) => m.startsWith(p.prefix)));
  const missing = needed.filter((p) => !p.key_set && !(keys[p.id] || "").trim());
  const changed = judge !== data.eval_model || (same ? "" : attacker) !== data.mutator_model || Object.values(keys).some((k) => k.trim());

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const api_keys = Object.fromEntries(Object.entries(keys).filter(([, k]) => k.trim()));
      setData(await post<ModelsOverview>("/system/models", { eval_model: judge, mutator_model: same ? "" : attacker, api_keys }));
      setKeys({});
      setMessage({ ok: true, text: "Saved. Checking that the judge answers…" });
      const test = await post<{ success: boolean; message: string }>("/system/judge-test", {});
      setMessage({ ok: test.success, text: test.success ? `Saved. ${test.message}` : `Saved, but: ${test.message}` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async (p: Provider) => {
    if (!confirm(`Remove the saved ${p.name} API key?`)) return;
    try {
      setData(await post<ModelsOverview>("/system/models", { api_keys: { [p.id]: "" } }));
      setMessage({ ok: true, text: `${p.name} key removed.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not remove the key." });
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Judge model"
          hint={<>Reads each reply from your app and decides whether the attack worked. Now: <code className="text-fg">{data.eval_model}</code></>}
          right={<Button size="sm" variant="ghost" onClick={onRefresh}><RefreshCw size={13} /> Refresh</Button>}
        />
        <div className="p-5">
          <ModelPicker data={data} value={judge} onChange={setJudge} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Attacker model"
          hint="Rewrites attacks that missed, writes business-rule attacks, and plays the attacker in agentic runs. Hosted models often refuse this job; a local model usually does it better."
        />
        <div className="space-y-5 p-5">
          <label className="flex cursor-pointer items-center gap-3 text-sm text-fg">
            <input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} className="h-4 w-4 accent-[#5cc8ff]" />
            Use the same model as the judge
          </label>
          {!same && <ModelPicker data={data} value={attacker} onChange={setAttacker} />}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="API keys"
          hint={<>Only for online models. Saved on this computer in <code>apps/api/data/settings.json</code> and never shown again.</>}
        />
        <div className="divide-y divide-line">
          {data.providers.map((p) => {
            const required = needed.some((n) => n.id === p.id) && !p.key_set;
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="w-44 text-[13px] text-fg">
                  {p.name}
                  {required && <span className="block text-xs text-warn">needed for your choice</span>}
                </div>
                <Input
                  mono
                  type="password"
                  autoComplete="off"
                  className={clsx("!w-auto min-w-[14rem] flex-1", required && !(keys[p.id] || "").trim() && "!border-warn/60")}
                  value={keys[p.id] ?? ""}
                  onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })}
                  placeholder={p.key_set ? "saved — type to replace" : "paste API key"}
                />
                <a href={p.key_url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">Get a key</a>
                {p.key_set && <button onClick={() => removeKey(p)} className="text-xs text-mute hover:text-fail">Remove</button>}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <Button variant="primary" onClick={save} busy={saving} disabled={missing.length > 0 || !changed}>Save and test</Button>
        {missing.length > 0 && <span className="text-[13px] text-warn">Enter the {missing.map((p) => p.name).join(" and ")} API key above to use that model.</span>}
        {message && <span className={clsx("min-w-0 break-words text-[13px]", message.ok ? "text-pass" : "text-fail")}>{message.text}</span>}
      </div>
    </>
  );
}

export default function SettingsPage() {
  const models = useApi<ModelsOverview>("/system/models");
  const limits = useApi<Limits>("/system/config");
  const [version, setVersion] = useState(0);

  const refresh = async () => {
    await models.reload();
    setVersion((v) => v + 1);
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Choose which AI models AYZO uses. Changes apply to the next scan and are remembered." />
      {models.error && <Notice tone="fail">{models.error}</Notice>}
      {models.loading || !models.data ? (
        !models.error && <Loading />
      ) : (
        <div className="space-y-6">
          <Models key={version} initial={models.data} onRefresh={refresh} />

          {limits.data && (
            <Card>
              <CardHeader title="Scan limits" hint={<>Set in <code>apps/api/.env</code>; restart the API after changing them.</>} />
              <dl className="divide-y divide-line">
                {(
                  [
                    ["Attacks per category", "MAX_PAYLOADS_PER_CATEGORY", limits.data.max_payloads_per_category || "no cap"],
                    ["Parallel requests to your app", "MAX_CONCURRENT_ATTACKS", limits.data.max_concurrent_attacks],
                    ["Build fails above risk score", "CICD_FAIL_RISK_THRESHOLD", limits.data.cicd_fail_risk_threshold],
                  ] as [string, string, string | number][]
                ).map(([label, env, value]) => (
                  <div key={env} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[13px]">
                    <dt className="text-fg">{label} <code className="ml-2 text-faint">{env}</code></dt>
                    <dd className="font-mono text-fg">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          <Card>
            <CardHeader title="Command line and CI" hint="Scan from a terminal or a pipeline. The exit code says whether to block the build." />
            <div className="p-5">
              <Mono className="rounded-md border border-line bg-ink p-4 text-mute">{CLI}</Mono>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
