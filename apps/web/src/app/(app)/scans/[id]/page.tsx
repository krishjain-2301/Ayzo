"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, ChevronRight, FileJson, Printer, RotateCw, Square, Trash2 } from "lucide-react";
import { API_BASE_URL, del, post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { VERDICT_BAR, VERDICT_LABEL, duration, isLive, methodLabel, prettyCategory } from "@/lib/format";
import type { ChangedAttack, Comparison, Report, ResultRow, Scan, Target, Verdict } from "@/lib/types";
import { Button, Card, CardHeader, Loading, MethodTag, Mono, Notice, PageHeader, SeverityTag, StatusDot, Tabs, Tag, VerdictBar, VerdictText } from "@/components/ui";
import { BarList, RiskChip, ScoreRing } from "@/components/charts";

const ORDER: Verdict[] = ["fail", "inconclusive", "error", "pass"];
type Tab = "findings" | "attacks" | "changes";

/** One attack and what happened, expandable to the full prompt and reply. */
function ResultItem({ row }: { row: ResultRow }) {
  return (
    <details className="group border-b border-line last:border-0">
      <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-3.5 hover:bg-raised/50">
        <ChevronRight size={15} className="shrink-0 text-faint transition-transform group-open:rotate-90" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-fg">{row.attack_name || row.prompt_sent.slice(0, 70)}</span>
          <span className="block truncate text-xs text-mute">{prettyCategory(row.attack_category)}</span>
        </span>
        {row.mutation_generation > 0 && <Tag>{row.attack_name?.includes("[adaptive") ? "adaptive" : "rewrite"} {row.mutation_generation}</Tag>}
        {(row.trials ?? 1) > 1 && <Tag tone={row.worked_trials ? "fail" : "mute"}>{row.worked_trials ?? 0} of {row.trials} tries</Tag>}
        {row.result === "fail" && <MethodTag method={row.method} />}
        <SeverityTag severity={row.severity} />
        <span className="w-32 shrink-0"><VerdictText verdict={row.result} /></span>
      </summary>
      <div className="grid gap-4 bg-ink/50 px-5 pb-5 pl-14 pt-1 lg:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-mute">Sent to the app</p>
          <Mono className="max-h-64 overflow-y-auto rounded-lg border border-line bg-ink p-3.5 text-mute">{row.prompt_sent}</Mono>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-mute">The app replied</p>
          <Mono className={clsx("max-h-64 overflow-y-auto rounded-lg border bg-ink p-3.5 text-fg", row.result === "fail" ? "border-fail/40" : "border-line")}>
            {row.model_response ?? "(no reply)"}
          </Mono>
        </div>
        <p className="text-[13px] leading-relaxed text-mute lg:col-span-2">
          <span className="font-medium text-fg">{methodLabel(row.method).text}.</span> {row.eval_reasoning}
          {row.method === "judge" && row.confidence !== null && <span className="text-faint"> Judge confidence {Math.round(row.confidence * 100)}%.</span>}
          {row.tool_calls && row.tool_calls.length > 0 && <span className="mt-1 block">Tools the app called: <code>{row.tool_calls.join(", ")}</code></span>}
        </p>
      </div>
    </details>
  );
}

function ChangeList({ title, hint, items, dot }: { title: string; hint: string; items: ChangedAttack[]; dot: string }) {
  return (
    <div className="rounded-lg border border-line p-4">
      <p className="flex items-center justify-between text-sm font-medium text-fg">
        <span className="flex items-center gap-2"><span className={clsx("h-2 w-2 rounded-full", dot)} />{title}</span>
        <span className="tabular text-lg font-semibold">{items.length}</span>
      </p>
      <p className="mt-0.5 text-xs text-mute">{hint}</p>
      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
          {items.slice(0, 12).map((a, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="truncate text-fg">{a.attack_name}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                {!a.stable_name && <Tag>generated</Tag>}
                <span className="text-xs text-mute">{prettyCategory(a.category)}</span>
              </span>
            </li>
          ))}
          {items.length > 12 && <li className="text-xs text-faint">and {items.length - 12} more</li>}
        </ul>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[13px] text-mute">{label}</dt>
      <dd className="tabular text-right text-sm font-medium text-fg">{children}</dd>
    </div>
  );
}

export default function ScanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const scan = useApi<Scan>(`/campaigns/${id}`, (s) => (s && !isLive(s.status) ? null : 2500));
  const finished = scan.data ? !isLive(scan.data.status) : false;
  // Results reload once more when polling stops, so the last few are not missed.
  const results = useApi<ResultRow[]>(`/reports/campaign/${id}/results`, finished ? null : 4000);
  const report = useApi<Report>(finished ? `/reports/campaign/${id}` : null);
  const comparison = useApi<Comparison>(scan.data?.status === "completed" ? `/campaigns/${id}/compare` : null);
  const target = useApi<Target>(scan.data ? `/targets/${scan.data.target_id}` : null);
  const [filter, setFilter] = useState<Verdict | "all">("all");
  const [tab, setTab] = useState<Tab | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const rows = useMemo(() => results.data ?? [], [results.data]);
  const counts = useMemo(() => {
    const c: Record<Verdict, number> = { fail: 0, pass: 0, error: 0, inconclusive: 0 };
    rows.forEach((r) => (c[r.result] = (c[r.result] ?? 0) + 1));
    return c;
  }, [rows]);

  if (scan.loading) return <Loading />;
  if (scan.error || !scan.data) return <Notice tone="fail">{scan.error || "Scan not found."}</Notice>;
  const s = scan.data;

  const failures = rows.filter((r) => r.result === "fail");
  const confirmed = failures.filter((r) => methodLabel(r.method).certain).length;
  const coverage = rows.length ? Math.round(((counts.pass + counts.fail) / rows.length) * 100) : 0;
  const shown = [...rows]
    .filter((r) => filter === "all" || r.result === filter)
    .sort((a, b) => ORDER.indexOf(a.result) - ORDER.indexOf(b.result));

  // Per category: how many attacks worked out of those sent.
  const byCategory = Object.entries(
    rows.reduce<Record<string, { value: number; total: number }>>((acc, r) => {
      const key = prettyCategory(r.attack_category);
      acc[key] = acc[key] ?? { value: 0, total: 0 };
      acc[key].total += 1;
      acc[key].value += r.result === "fail" ? 1 : 0;
      return acc;
    }, {})
  )
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.value - a.value);

  const findings = report.data?.findings ?? [];
  const hasChanges = Boolean(comparison.data?.baseline_id);
  // Findings first when there are any; otherwise the attack list is the content.
  const activeTab: Tab = tab ?? (findings.length ? "findings" : "attacks");

  const cancel = async () => {
    setCancelling(true);
    try {
      await post(`/campaigns/${s.id}/cancel`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not cancel.");
      setCancelling(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete the scan "${s.name}" and its results?`)) return;
    try {
      await del(`/campaigns/${s.id}`);
      router.push("/scans");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not delete the scan.");
    }
  };

  return (
    <>
      <PageHeader
        back={<Link href="/scans" className="no-print inline-flex items-center gap-1.5 text-mute hover:text-fg"><ArrowLeft size={14} /> All scans</Link>}
        title={s.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusDot status={s.status} />
            {target.data && <Link href={`/targets/${target.data.id}`} className="hover:text-fg">{target.data.name}</Link>}
            <span>{new Date(s.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
          </span>
        }
        actions={
          isLive(s.status) ? (
            <Button variant="danger" onClick={cancel} busy={cancelling}><Square size={13} /> Stop scan</Button>
          ) : (
            <>
              <Link href={`/scans/new?target=${s.target_id}`}><Button><RotateCw size={14} /> Scan again</Button></Link>
              <a href={`${API_BASE_URL}/campaigns/${s.id}/manifest`} target="_blank" rel="noreferrer" title="Settings and every message sent, as JSON">
                <Button><FileJson size={14} /> Run record</Button>
              </a>
              <Button onClick={() => window.print()}><Printer size={14} /> Print report</Button>
              <Button variant="ghost" onClick={remove} aria-label="Delete scan"><Trash2 size={15} /></Button>
            </>
          )
        }
      />

      <div className="space-y-5">
        {isLive(s.status) && (
          <Card className="p-5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="font-medium text-fg">
                {s.total_tests ? `${s.completed_tests} of ${s.total_tests} attacks sent` : "Starting the app and checking the judge model…"}
              </span>
              <span className="tabular text-mute">{Math.round(s.progress_percent)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-raised">
              <div className="h-full bg-accent transition-all duration-500" style={{ width: `${s.progress_percent}%` }} />
            </div>
            <p className="mt-2.5 text-[13px] text-mute">
              {counts.fail} worked so far. Results appear below as they arrive. The first judge call can take a minute with a local model.
            </p>
          </Card>
        )}

        {(s.status === "failed" || s.status === "cancelled") && (
          <Notice tone="warn">
            <b>{s.status === "cancelled" ? "This scan was stopped." : "This scan did not produce a result."}</b>{" "}
            {s.description}
            {s.status === "failed" && "\nNo risk score is shown, because it would not mean anything."}
          </Notice>
        )}

        {rows.length > 0 && (
          <div className="grid gap-5 xl:grid-cols-3">
            {/* Score */}
            <Card className="flex flex-col items-center justify-center gap-3 p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-mute">Risk score</p>
              <ScoreRing score={s.risk_score} size={148} />
              {s.risk_score !== null ? (
                <RiskChip score={s.risk_score} className="!text-sm" />
              ) : (
                <span className="text-[13px] text-mute">{isLive(s.status) ? "Available when the scan finishes" : "Not available"}</span>
              )}
            </Card>

            {/* Outcome */}
            <Card>
              <CardHeader title="Outcome" hint={`${rows.length} attacks sent`} />
              <div className="p-5">
                <VerdictBar counts={counts} className="h-2.5" />
                <dl className="mt-3 divide-y divide-line">
                  <Fact label={<span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-fail" />Attack worked</span>}>
                    {counts.fail}
                    {counts.fail > 0 && <span className="ml-2 text-xs font-normal text-mute">{confirmed} confirmed · {counts.fail - confirmed} judge opinion</span>}
                  </Fact>
                  <Fact label={<span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-pass" />Resisted</span>}>{counts.pass}</Fact>
                  <Fact label={<span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-warn" />No verdict</span>}>{counts.inconclusive}</Fact>
                  <Fact label={<span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-faint" />Target error</span>}>{counts.error}</Fact>
                  <Fact label="Clear verdicts">{coverage}%</Fact>
                  {report.data?.attack_success_rate !== null && report.data?.attack_success_rate !== undefined && (
                    <Fact label={<span title="Share of judged attacks that worked. The range is a 95% interval: with few attacks it is wide.">Attack success rate</span>}>
                      {report.data.attack_success_rate}%
                      <span className="ml-2 text-xs font-normal text-mute">likely {report.data.asr_low}–{report.data.asr_high}%</span>
                    </Fact>
                  )}
                  {(s.trials ?? 1) > 1 && <Fact label="Tries per attack">{s.trials}</Fact>}
                  {s.completed_at && <Fact label="Duration">{duration(s.started_at, s.completed_at)}</Fact>}
                </dl>
              </div>
            </Card>

            {/* By category */}
            <Card>
              <CardHeader title="By category" hint="Attacks that worked, out of those sent." />
              <div className="p-5">
                <BarList rows={byCategory} />
              </div>
            </Card>
          </div>
        )}

        {s.status === "completed" && counts.fail === 0 && (
          <Notice tone="pass">
            None of the {rows.length} attacks worked. That covers only the attacks in this scan; it is not proof the app is safe.
          </Notice>
        )}

        {rows.length > 0 && (
          <Card>
            <div className="px-3 pt-1">
              <Tabs<Tab>
                value={activeTab}
                onChange={setTab}
                tabs={[
                  { id: "findings", label: "Findings", count: findings.length },
                  { id: "attacks", label: "Every attack", count: rows.length },
                  ...(hasChanges ? [{ id: "changes" as Tab, label: "Changes since last scan", count: comparison.data?.new_failures?.length ?? 0 }] : []),
                ]}
              />
            </div>

            <div className={activeTab === "findings" ? "" : "print-only"}>
              <h2 className="print-only px-5 pt-5 text-lg font-semibold">Findings</h2>
              {findings.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-mute">
                  {finished ? "No findings: no category had an attack that worked." : "Findings are written when the scan finishes."}
                </p>
              ) : (
                <div className="divide-y divide-line">
                  {findings.map((f) => (
                    <div key={f.id} className="grid gap-5 p-5 lg:grid-cols-5">
                      <div className="lg:col-span-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityTag severity={f.severity} />
                          <h3 className="text-[15px] font-semibold text-fg">{f.title}</h3>
                        </div>
                        <p className="mt-2 text-[13px] leading-relaxed text-mute">{f.description}</p>
                        {f.taxonomy && (
                          <p className="mt-2 flex flex-wrap gap-1.5">
                            <Tag>OWASP {f.taxonomy.owasp.id} {f.taxonomy.owasp.name}</Tag>
                            {f.taxonomy.atlas && <Tag>ATLAS {f.taxonomy.atlas.id}</Tag>}
                          </p>
                        )}
                        <ul className="mt-3 space-y-1">
                          {f.evidence.slice(0, 5).map((e, i) => (
                            <li key={i} className="flex items-center gap-2 text-[13px] text-fg">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-fail" />
                              <span className="truncate">{e.attack_name}</span>
                              <MethodTag method={e.method} />
                            </li>
                          ))}
                        </ul>
                      </div>
                      {f.remediation && (
                        <div className="rounded-lg border border-line bg-ink p-4 lg:col-span-3">
                          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-mute">What to do</p>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{f.remediation}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={activeTab === "attacks" ? "" : "print-only"}>
              <h2 className="print-only px-5 pt-5 text-lg font-semibold">Every attack</h2>
                <div className="no-print flex flex-wrap gap-1.5 border-b border-line px-5 py-3">
                  {(["all", ...ORDER] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setFilter(v)}
                      className={clsx(
                        "flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                        filter === v ? "bg-accent-dim text-fg" : "text-mute hover:bg-raised hover:text-fg"
                      )}
                    >
                      {v !== "all" && <span className={clsx("h-2 w-2 rounded-full", VERDICT_BAR[v])} />}
                      {v === "all" ? "All" : VERDICT_LABEL[v]}
                      <span className="tabular text-faint">{v === "all" ? rows.length : counts[v]}</span>
                    </button>
                  ))}
                </div>
                {shown.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-mute">Nothing in this group.</p>
                ) : (
                  shown.map((row, i) => <ResultItem key={`${row.attack_name}-${row.mutation_generation}-${i}`} row={row} />)
                )}
            </div>

            {activeTab === "changes" && comparison.data?.baseline_id && (
              <div className="p-5">
                <p className="mb-4 text-[13px] text-mute">
                  Compared with{" "}
                  <Link href={`/scans/${comparison.data.baseline_id}`} className="text-fg hover:text-accent">{comparison.data.baseline_name}</Link>
                  . Risk was <span className="tabular font-medium text-fg">{comparison.data.baseline_risk_score ?? "—"}</span>, now{" "}
                  <span className="tabular font-medium text-fg">{s.risk_score ?? "—"}</span>.
                </p>
                <div className="grid gap-4 lg:grid-cols-3">
                  <ChangeList title="Newly working" hint="Worked now, not before" items={comparison.data.new_failures ?? []} dot="bg-fail" />
                  <ChangeList title="Fixed" hint="Worked before, resisted now" items={comparison.data.fixed ?? []} dot="bg-pass" />
                  <ChangeList title="Still working" hint="Worked in both scans" items={comparison.data.still_failing ?? []} dot="bg-faint" />
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
