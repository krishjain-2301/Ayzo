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
const EXACT = new Set(["indirect_injection"]);
// Mostly measure the underlying model's own safety training.
const BASELINE = new Set(["jailbreak", "role_override"]);

function NewScan() {
  const router = useRouter();
  const preselected = useSearchParams().get("target");
  const targets = useApi<Target[]>("/targets");
  const categories = useApi<Category[]>("/attacks/categories");
  const models = useApi<ModelsOverview>("/system/models");

  const [pickedTarget, setTargetId] = useState(preselected ?? "");
  const [picked, setPicked] = useState<string[]>(DEFAULTS);
  const [depth, setDepth] = useState(0);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const targetId = pickedTarget || targets.data?.[0]?.id || "";

  if (targets.loading || categories.loading) return <Loading />;

  const target = targets.data?.find((t) => t.id === targetId);
  const hasRules = Boolean(target?.rules?.length);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((c) => c !== id) : [...p, id]));
  const chosen = picked.filter((id) => id !== "business_rules" || hasRules);
  const attackCount = (categories.data ?? [])
    .filter((c) => chosen.includes(c.id))
    .reduce((sum, c) => sum + (c.id === "business_rules" ? (target?.rules?.length ?? 0) * 4 : Math.min(c.attack_count, 20)), 0);

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
      });
      router.push(`/scans/${scan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the scan.");
      setBusy(false);
    }
  };

  if (!targets.data?.length) {
    return (
      <Notice>
        There is nothing to scan yet. <Link href="/targets" className="text-accent hover:underline">Add a target</Link> first.
      </Notice>
    );
  }

  return (
    <form onSubmit={start} className="space-y-6">
      {error && <Notice tone="fail">{error}</Notice>}
      {models.data?.eval_model_missing_key && (
        <Notice tone="warn">
          The judge model {models.data.eval_model} has no API key, so the scan would stop before attacking.{" "}
          <Link href="/settings" className="underline">Open Settings</Link>.
        </Notice>
      )}

      <Card>
        <CardHeader title="1 · Target" />
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
          {target && !(target.canaries?.length || target.system_prompt || target.expected_behavior) && (
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
          title="2 · Attacks"
          hint="Up to 20 attacks are sent per category, most severe first."
          right={
            <div className="flex gap-3 text-sm">
              <button type="button" className="text-mute hover:text-fg" onClick={() => setPicked((categories.data ?? []).map((c) => c.id))}>All</button>
              <button type="button" className="text-mute hover:text-fg" onClick={() => setPicked([])}>None</button>
            </div>
          }
        />
        <div className="grid gap-2 p-5 md:grid-cols-2">
          {(categories.data ?? []).map((c) => {
            const disabled = c.id === "business_rules" && !hasRules;
            const on = picked.includes(c.id) && !disabled;
            return (
              <button
                key={c.id}
                type="button"
                disabled={disabled}
                onClick={() => toggle(c.id)}
                className={clsx(
                  "flex items-start gap-3 rounded-md border p-3 text-left transition-colors",
                  on ? "border-accent/60 bg-accent-dim/30" : "border-line hover:border-faint",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                <span className={clsx("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border", on ? "border-accent bg-accent text-accent-ink" : "border-faint")}>
                  {on && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                    {c.name}
                    {EXACT.has(c.id) && <Tag tone="accent">no judge needed</Tag>}
                    {BASELINE.has(c.id) && <Tag>tests the model</Tag>}
                    {c.attack_count > 0 && <span className="font-mono text-xs font-normal text-faint">{c.attack_count}</span>}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-mute">
                    {disabled ? "Add business rules to this target to use this category." : c.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="3 · Retry attacks that missed" hint="Rewrites the attacks the app resisted (paraphrased, encoded, role-play) and tries again. Slower, and uses the attacker model." />
        <div className="flex flex-wrap gap-2 p-5">
          {[0, 1, 2, 3].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDepth(d)}
              className={clsx("rounded-md border px-4 py-2 text-sm", depth === d ? "border-accent/60 bg-accent-dim/30 text-fg" : "border-line text-mute hover:text-fg")}
            >
              {d === 0 ? "Off" : `${d} round${d > 1 ? "s" : ""}`}
            </button>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="primary" busy={busy} disabled={!targetId || chosen.length === 0}>Start scan</Button>
        <span className="text-sm text-mute">
          {chosen.length === 0
            ? "Pick at least one category."
            : `About ${attackCount} attacks across ${chosen.length} categor${chosen.length === 1 ? "y" : "ies"}. Judge: ${models.data?.eval_model ?? "…"}`}
        </span>
      </div>
    </form>
  );
}

export default function NewScanPage() {
  return (
    <>
      <PageHeader
        back={<Link href="/scans" className="inline-flex items-center gap-1.5 text-mute hover:text-fg"><ArrowLeft size={14} /> Scans</Link>}
        title="New scan"
        subtitle="Choose what to attack and with which kinds of attack."
      />
      <Suspense fallback={<Loading />}>
        <NewScan />
      </Suspense>
    </>
  );
}
