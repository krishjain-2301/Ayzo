"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Check } from "lucide-react";
import { post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { Category, ModelsOverview, Target } from "@/lib/types";
import { Button, Card, CardHeader, Field, Input, Loading, Notice, PageHeader, Select, Tag } from "@/components/ui";

// Ticked by default: the categories that test the app rather than the model.
const DEFAULTS = ["prompt_injection", "system_prompt_leak", "indirect_injection"];
// Decided by string match, so they need no judge and give the same answer every time.
const EXACT = new Set(["indirect_injection", "tool_abuse", "sql_injection"]);

const GROUPS: { title: string; hint: string; ids: string[] }[] = [
  {
    title: "Your app's own weak points",
    hint: "What only you can test: your prompt, your data, your rules.",
    ids: ["prompt_injection", "indirect_injection", "system_prompt_leak", "data_leakage", "business_rules", "cross_user", "sql_injection", "multi_turn", "insecure_output_handling", "custom"],
  },
  {
    title: "Tools and retrieval",
    hint: "Useful when the app can call tools or reads documents. Otherwise expect everything to pass.",
    ids: ["tool_abuse", "agent_misuse", "excessive_agency", "vector_weaknesses"],
  },
  {
    title: "The model's own guard rails",
    hint: "Mostly measures the model vendor's safety training. A baseline, not the main event.",
    ids: ["jailbreak", "adversarial_jailbreak", "harmful_content", "role_override", "context_manipulation", "advanced_bypasses"],
  },
];

function Segmented<T extends number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex gap-1 rounded-lg bg-ink p-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx("flex-1 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors", value === o.value ? "bg-raised text-fg shadow-sm ring-1 ring-line" : "text-mute hover:text-fg")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function NewScan() {
  const router = useRouter();
  const preselected = useSearchParams().get("target");
  const targets = useApi<Target[]>("/targets");
  const categories = useApi<Category[]>("/attacks/categories");
  const models = useApi<ModelsOverview>("/system/models");

  const [pickedTarget, setTargetId] = useState(preselected ?? "");
  const [picked, setPicked] = useState<string[]>(DEFAULTS);
  const [depth, setDepth] = useState(0);
  const [adaptive, setAdaptive] = useState(0);
  const [trials, setTrials] = useState(1);
  const [perCategory, setPerCategory] = useState(20);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const targetId = pickedTarget || targets.data?.[0]?.id || "";

  if (targets.loading || categories.loading) return <Loading />;
  if (!targets.data?.length) {
    return (
      <Notice>
        There is nothing to scan yet. <Link href="/targets" className="text-accent hover:underline">Add a target</Link> first.
      </Notice>
    );
  }

  const target = targets.data.find((t) => t.id === targetId);
  const hasRules = Boolean(target?.rules?.length);
  const hasTools = Boolean(target?.forbidden_tools?.length);
  const hasOthers = Boolean(target?.other_users?.length);
  // Categories whose attacks are generated from the target's own profile.
  const unavailable = (id: string) => (id === "business_rules" && !hasRules) || (id === "tool_abuse" && !hasTools) || (id === "cross_user" && !hasOthers);
  const byId = new Map((categories.data ?? []).map((c) => [c.id, c]));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((c) => c !== id) : [...p, id]));
  const chosen = picked.filter((id) => byId.has(id) && !unavailable(id));
  // Attacks generated from the target's profile aren't capped; library categories are.
  const cap = (n: number) => (perCategory >= 500 ? n : Math.min(n, perCategory));
  const countFor = (id: string) =>
    id === "business_rules" ? (target?.rules?.length ?? 0) * 4
    : id === "tool_abuse" ? (target?.forbidden_tools?.length ?? 0) * 4
    : id === "cross_user" ? (target?.other_users?.length ?? 0) * 6
    : cap(byId.get(id)?.attack_count ?? 0);
  const attacks = chosen.reduce((sum, id) => sum + countFor(id), 0);
  const requests = attacks * trials;
  // The largest library category in this scan, so the cap options make sense.
  const biggestLibrary = Math.max(0, ...chosen.filter((id) => !EXACT.has(id) && !["business_rules", "tool_abuse", "cross_user"].includes(id)).map((id) => byId.get(id)?.attack_count ?? 0));
  const hasProfile = Boolean(target && (target.canaries?.length || target.system_prompt || target.expected_behavior));

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const scan = await post<{ id: string }>("/campaigns", {
        name: name.trim() || `${target?.name ?? "Scan"} · ${new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`,
        target_id: targetId,
        attack_categories: chosen,
        mutation_depth: depth,
        adaptive_rounds: adaptive,
        trials,
        max_payloads_per_category: perCategory >= 500 ? 500 : perCategory,
      });
      router.push(`/scans/${scan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the scan.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={start} className="grid gap-5 xl:grid-cols-3">
      <div className="min-w-0 space-y-5 xl:col-span-2">
        {error && <Notice tone="fail">{error}</Notice>}

        <Card>
          <CardHeader title="Target" />
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="App to attack">
              <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                {targets.data.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} (port {t.target_port})</option>
                ))}
              </Select>
            </Field>
            <Field label="Scan name" hint="Optional.">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Before the prompt change" />
            </Field>
            {target && !hasProfile && (
              <div className="md:col-span-2">
                <Notice tone="warn">
                  This target has no profile, so every result will be a judge opinion.{" "}
                  <Link href={`/targets/${target.id}`} className="underline">Add protected values</Link> to get confirmed findings.
                </Notice>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Attacks"
            hint={perCategory >= 500 ? "Every attack in each category is sent." : `Up to ${perCategory} attacks are sent per category, most severe first. Change this under “How hard to push”.`}
            right={
              <div className="flex gap-3 text-[13px]">
                <button type="button" className="text-mute hover:text-fg" onClick={() => setPicked((categories.data ?? []).map((c) => c.id))}>Select all</button>
                <button type="button" className="text-mute hover:text-fg" onClick={() => setPicked([])}>Clear</button>
              </div>
            }
          />
          <div className="space-y-6 p-5">
            {GROUPS.map((group) => {
              const items = group.ids.map((id) => byId.get(id)).filter((c): c is Category => Boolean(c));
              if (!items.length) return null;
              return (
                <fieldset key={group.title}>
                  <legend className="text-sm font-semibold text-fg">{group.title}</legend>
                  <p className="mb-3 mt-0.5 text-[13px] text-mute">{group.hint}</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {items.map((c) => {
                      const disabled = unavailable(c.id);
                      const on = picked.includes(c.id) && !disabled;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          disabled={disabled}
                          onClick={() => toggle(c.id)}
                          className={clsx(
                            "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                            on ? "border-accent/70 bg-accent-dim/60" : "border-line hover:border-faint",
                            disabled && "cursor-not-allowed opacity-50"
                          )}
                        >
                          <span className={clsx("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border", on ? "border-accent bg-accent text-accent-ink" : "border-faint")}>
                            {on && <Check size={12} strokeWidth={3} />}
                          </span>
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                              {c.name}
                              {c.attack_count > 0 && <span className="tabular text-xs font-normal text-faint">{c.attack_count}</span>}
                              {EXACT.has(c.id) && <Tag tone="accent">no judge needed</Tag>}
                            </span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-mute">
                              {disabled ? (c.id === "tool_abuse" ? "List the tools a user must never trigger on this target to use this." : c.id === "cross_user" ? "List other users on this target to use this." : "Add business rules to this target to use this.") : c.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Summary and options, kept in view */}
      <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardHeader title="How hard to push" />
          <div className="space-y-5 p-5">
            <div>
              <p className="mb-1.5 text-sm font-medium text-fg">Attacks per category</p>
              <Segmented label="Attacks per category" value={perCategory} onChange={setPerCategory} options={[{ value: 5, label: "5" }, { value: 10, label: "10" }, { value: 20, label: "20" }, { value: 50, label: "50" }, { value: 500, label: "All" }]} />
              <p className="mt-1.5 text-xs leading-relaxed text-mute">
                The most severe attacks in each category go first.{" "}
                {biggestLibrary > 0
                  ? `The biggest category picked has ${biggestLibrary} attacks${perCategory < biggestLibrary ? `, so ${biggestLibrary - perCategory} would be held back.` : " — all of them fit."}`
                  : "Generated categories send every attack."}
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-fg">Repeat each attack</p>
              <Segmented label="Repeat each attack" value={trials} onChange={setTrials} options={[{ value: 1, label: "Once" }, { value: 3, label: "3 times" }, { value: 5, label: "5 times" }]} />
              <p className="mt-1.5 text-xs leading-relaxed text-mute">Models answer differently each time. Repeating finds attacks that only work sometimes.</p>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-fg">Adaptive attacker</p>
              <Segmented label="Adaptive attacker" value={adaptive} onChange={setAdaptive} options={[{ value: 0, label: "Off" }, { value: 1, label: "1 round" }, { value: 2, label: "2" }, { value: 3, label: "3" }]} />
              <p className="mt-1.5 text-xs leading-relaxed text-mute">For attacks the app resisted, the attacker model reads the refusal and tries a new angle.</p>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-fg">Rewrite attacks that missed</p>
              <Segmented label="Rewrite attacks that missed" value={depth} onChange={setDepth} options={[{ value: 0, label: "Off" }, { value: 1, label: "1 round" }, { value: 2, label: "2" }, { value: 3, label: "3" }]} />
              <p className="mt-1.5 text-xs leading-relaxed text-mute">Paraphrases, encodings and role-play wrappers of the same attack.</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="This scan" />
          <dl className="divide-y divide-line px-5 text-[13px]">
            {(
              [
                ["Target", target?.name ?? "—"],
                ["Categories", chosen.length],
                ["Attacks", attacks],
                ["Requests to your app", `${requests}${adaptive || depth ? "+" : ""}`],
                ["Judge", models.data?.eval_model ?? "…"],
              ] as [string, React.ReactNode][]
            ).map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-mute">{label}</dt>
                <dd className="tabular truncate text-right font-medium text-fg">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-3 border-t border-line p-5">
            {models.data?.eval_model_missing_key && (
              <Notice tone="warn">
                The judge model has no API key, so the scan would stop before attacking. <Link href="/settings" className="underline">Open Settings</Link>.
              </Notice>
            )}
            <Button type="submit" variant="primary" busy={busy} disabled={!targetId || chosen.length === 0} className="w-full">Start scan</Button>
            {chosen.length === 0 && <p className="text-center text-xs text-mute">Pick at least one category.</p>}
          </div>
        </Card>
      </aside>
    </form>
  );
}

export default function NewScanPage() {
  return (
    <>
      <PageHeader
        back={<Link href="/scans" className="inline-flex items-center gap-1.5 text-mute hover:text-fg"><ArrowLeft size={14} /> All scans</Link>}
        title="New scan"
        subtitle="Choose what to attack, with which kinds of attack, and how hard to push."
      />
      <Suspense fallback={<Loading />}>
        <NewScan />
      </Suspense>
    </>
  );
}
