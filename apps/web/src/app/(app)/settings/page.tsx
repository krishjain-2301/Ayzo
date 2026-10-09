"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { ModelsOverview, Provider } from "@/lib/types";
import { Button, Card, CardHeader, Input, Loading, Mono, Notice, PageHeader, Tag } from "@/components/ui";

interface Limits {
  max_payloads_per_category: number;
  max_concurrent_attacks: number;
  cicd_fail_risk_threshold: number;
}

type Status = { tone: "busy" | "pass" | "fail"; text: string } | null;

/** Applies a model choice. Resolves when saved; throws with a readable message otherwise. */
type Apply = (model: string, apiKey?: { provider: string; key: string }) => Promise<void>;

const CLI = `cd apps/api
ayzo scan --target "My app" \\
  --categories prompt_injection,system_prompt_leak,indirect_injection \\
  --fail-on new --sarif ayzo.sarif`;

function Choice({ label, selected, busy, onClick }: { label: string; selected: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-sm transition-colors disabled:cursor-wait",
        selected ? "border-accent bg-accent-dim/50 text-fg" : "border-line text-mute hover:border-faint hover:text-fg"
      )}
    >
      {selected && <Check size={13} className="text-accent" />}
      {label}
    </button>
  );
}

/** One online provider: its models, and its API key handled right here. */
function ProviderRow({ provider, current, busy, apply, onKeyRemoved }: {
  provider: Provider;
  current: string;
  busy: boolean;
  apply: Apply;
  onKeyRemoved: (p: Provider) => void;
}) {
  // The model the user clicked while this provider still had no key.
  const [wanted, setWanted] = useState("");
  const [key, setKey] = useState("");
  const [custom, setCustom] = useState("");
  const [replacing, setReplacing] = useState(false);

  const pick = (name: string) => {
    const model = `${provider.prefix}${name}`;
    if (provider.key_set) apply(model).catch(() => {});
    else setWanted(model);
  };

  const saveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    // With no model clicked yet, the key is saved and the current model kept.
    await apply(wanted || current, { provider: provider.id, key: key.trim() }).then(
      () => {
        setKey("");
        setWanted("");
        setReplacing(false);
      },
      () => {}
    );
  };

  return (
    <div>
      <p className="mb-2 flex flex-wrap items-center gap-2 text-sm text-fg">
        {provider.name}
        {provider.key_set ? <Tag tone="pass">API key added</Tag> : <Tag tone="warn">API key required</Tag>}
        {!provider.key_set && !replacing && !wanted && (
          <button onClick={() => setReplacing(true)} className="text-xs text-accent hover:underline">Add API key</button>
        )}
        {provider.key_set && !replacing && (
          <>
            <button onClick={() => setReplacing(true)} className="text-xs text-mute hover:text-fg">Replace key</button>
            <button onClick={() => onKeyRemoved(provider)} className="text-xs text-mute hover:text-fail">Remove key</button>
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {provider.models.map((name) => (
          <Choice
            key={name}
            label={name}
            busy={busy}
            selected={current === `${provider.prefix}${name}` || wanted === `${provider.prefix}${name}`}
            onClick={() => pick(name)}
          />
        ))}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim()) pick(custom.trim());
          }}
        >
          <Input mono className="!w-40 !py-1.5" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="other model id" />
          {custom.trim() && <Button size="sm" type="submit">Use</Button>}
        </form>
      </div>

      {(wanted || replacing) && (
        <form onSubmit={saveKey} className="mt-3 rounded-md border border-warn/30 bg-warn/5 p-3">
          <p className="mb-2 text-sm text-fg">
            {wanted ? (
              <>To use <code>{wanted}</code>, paste your {provider.name} API key.</>
            ) : (
              <>{provider.name} models need an API key. Paste yours to enable them.</>
            )}{" "}
            <a href={provider.key_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">Get a key</a>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              mono
              type="password"
              autoComplete="off"
              className="!w-auto min-w-[16rem] flex-1"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={`${provider.name} API key`}
            />
            <Button size="sm" variant="primary" type="submit" disabled={key.trim().length < 8} busy={busy}>
              {wanted ? "Save key and use this model" : "Save key"}
            </Button>
            {(wanted || replacing) && (
              <Button size="sm" variant="ghost" type="button" onClick={() => { setWanted(""); setReplacing(false); setKey(""); }}>Cancel</Button>
            )}
          </div>
          <p className="mt-2 text-xs text-mute">Saved only on this computer, in apps/api/data/settings.json. It is never shown again.</p>
        </form>
      )}
    </div>
  );
}

/** Click a model and it is applied at once. */
function ModelPicker({ data, current, busy, apply, onKeyRemoved }: {
  data: ModelsOverview;
  current: string;
  busy: boolean;
  apply: Apply;
  onKeyRemoved: (p: Provider) => void;
}) {
  const { ollama, claude_cli } = data.local;
  const use = (model: string) => apply(model).catch(() => {});

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-xs uppercase tracking-wider text-faint">Runs on this computer · free, no API key</p>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-fg">Ollama</p>
            {!ollama.running ? (
              <p className="text-sm text-mute">Ollama is not running. Start it, or install it from ollama.com, then press Refresh.</p>
            ) : ollama.models.length === 0 ? (
              <p className="text-sm text-mute">
                No models installed. In a terminal run <code className="text-fg">ollama pull gemma3:4b</code> or{" "}
                <code className="text-fg">ollama pull qwen3:4b</code>, then press Refresh.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ollama.models.map((name) => (
                  <Choice key={name} label={name} busy={busy} selected={current === `ollama/${name}`} onClick={() => use(`ollama/${name}`)} />
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm text-fg">
              Claude Code <span className="text-mute">· uses the Claude Code sign-in on this computer</span>
            </p>
            {claude_cli.installed ? (
              <div className="flex flex-wrap gap-2">
                {claude_cli.models.map((name) => (
                  <Choice key={name} label={name} busy={busy} selected={current === `claude-cli/${name}`} onClick={() => use(`claude-cli/${name}`)} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-mute">Claude Code is not installed on this computer.</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs uppercase tracking-wider text-faint">Online · you need your own API key from the provider</p>
        <div className="space-y-5">
          {data.providers.map((p) => (
            <ProviderRow key={p.id} provider={p} current={current} busy={busy} apply={apply} onKeyRemoved={onKeyRemoved} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p className={clsx("flex items-start gap-2 text-sm", status.tone === "pass" && "text-pass", status.tone === "fail" && "text-fail", status.tone === "busy" && "text-mute")}>
      {status.tone === "busy" && <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin" />}
      <span className="min-w-0 break-words">{status.text}</span>
    </p>
  );
}

function Models({ initial, onRefresh }: { initial: ModelsOverview; onRefresh: () => void }) {
  const [data, setData] = useState(initial);
  const [judgeStatus, setJudgeStatus] = useState<Status>(null);
  const [attackerStatus, setAttackerStatus] = useState<Status>(null);
  const [busy, setBusy] = useState<"" | "judge" | "attacker">("");

  const sameAttacker = !data.mutator_model;

  /** Save a choice, tell the sidebar, then check the model really answers. */
  const save = async (role: "judge" | "attacker", body: Record<string, unknown>, model: string, setStatus: (s: Status) => void) => {
    setBusy(role);
    setStatus({ tone: "busy", text: `Switching to ${model}…` });
    try {
      setData(await post<ModelsOverview>("/system/models", body));
      window.dispatchEvent(new Event("ayzo:models-changed"));
      setStatus({ tone: "busy", text: `Now using ${model}. Checking that it answers (a local model can take a minute to load)…` });
      const test = await post<{ success: boolean; message: string }>("/system/judge-test", { model });
      setStatus(
        test.success
          ? { tone: "pass", text: `Now using ${model}. It answered.` }
          : { tone: "fail", text: `Switched to ${model}, but it did not answer: ${test.message}` }
      );
    } catch (e) {
      const text = e instanceof Error ? e.message : "Could not save.";
      setStatus({ tone: "fail", text });
      throw new Error(text);
    } finally {
      setBusy("");
    }
  };

  const keys = (apiKey?: { provider: string; key: string }) => (apiKey ? { api_keys: { [apiKey.provider]: apiKey.key } } : {});
  const applyJudge: Apply = (model, apiKey) => save("judge", { eval_model: model, ...keys(apiKey) }, model, setJudgeStatus);
  const applyAttacker: Apply = (model, apiKey) => save("attacker", { mutator_model: model, ...keys(apiKey) }, model, setAttackerStatus);

  const followJudge = async (follow: boolean) => {
    const model = data.eval_model;
    // Unticking keeps the same model for now, as an explicit choice the user can then change.
    await save("attacker", { mutator_model: follow ? "" : model }, model, setAttackerStatus).catch(() => {});
  };

  const removeKey = async (p: Provider) => {
    if (!confirm(`Remove the saved ${p.name} API key?`)) return;
    try {
      setData(await post<ModelsOverview>("/system/models", { api_keys: { [p.id]: "" } }));
      window.dispatchEvent(new Event("ayzo:models-changed"));
      setJudgeStatus({ tone: "pass", text: `${p.name} key removed.` });
    } catch (e) {
      setJudgeStatus({ tone: "fail", text: e instanceof Error ? e.message : "Could not remove the key." });
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Judge model"
          hint="Reads each reply from your app and decides whether the attack worked. Click a model to switch to it."
          right={<Button size="sm" variant="ghost" onClick={onRefresh}><RefreshCw size={13} /> Refresh list</Button>}
        />
        <div className="space-y-5 p-5">
          <div className="rounded-md border border-line bg-ink px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-faint">In use now</p>
            <p className="mt-1 font-mono text-base text-fg">{data.eval_model}</p>
            {data.eval_model_missing_key && <p className="mt-1 text-sm text-warn">This model needs an API key that has not been added. Scans will stop before attacking.</p>}
            <div className="mt-2"><StatusLine status={judgeStatus} /></div>
          </div>
          <ModelPicker data={data} current={data.eval_model} busy={busy !== ""} apply={applyJudge} onKeyRemoved={removeKey} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Attacker model"
          hint="Rewrites attacks that missed, writes business-rule attacks, and plays the attacker in agentic runs. Hosted models often refuse this job; a local model usually does it better."
        />
        <div className="space-y-5 p-5">
          <div className="rounded-md border border-line bg-ink px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-faint">In use now</p>
            <p className="mt-1 font-mono text-base text-fg">
              {data.effective_mutator_model}
              {sameAttacker && <span className="ml-2 font-sans text-sm text-mute">same as the judge</span>}
            </p>
            <div className="mt-2"><StatusLine status={attackerStatus} /></div>
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-sm text-fg">
            <input type="checkbox" checked={sameAttacker} disabled={busy !== ""} onChange={(e) => followJudge(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
            Always use the same model as the judge
          </label>
          {!sameAttacker && (
            <ModelPicker data={data} current={data.effective_mutator_model} busy={busy !== ""} apply={applyAttacker} onKeyRemoved={removeKey} />
          )}
        </div>
      </Card>
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
      <PageHeader title="Settings" subtitle="Choose which AI models AYZO uses. A click switches the model straight away, and the choice is remembered." />
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
                  <div key={env} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
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
