"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, ChevronRight, Printer, RotateCw, Square, Trash2 } from "lucide-react";
import { del, post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { VERDICT_BAR, VERDICT_LABEL, duration, isLive, methodLabel, prettyCategory, riskColor, riskLevel } from "@/lib/format";
import type { ChangedAttack, Comparison, Report, ResultRow, Scan, Target, Verdict } from "@/lib/types";
import { Button, Card, CardHeader, Loading, MethodTag, Mono, Notice, PageHeader, SeverityTag, Stat, StatusDot, Tag, VerdictBar, VerdictText } from "@/components/ui";

const ORDER: Verdict[] = ["fail", "inconclusive", "error", "pass"];

/** One attack and what happened, expandable to the full prompt and reply. */
function ResultItem({ row, open: startOpen }: { row: ResultRow; open?: boolean }) {
  return (
    <details open={startOpen} className="group border-b border-line last:border-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 hover:bg-raised/40">
        <ChevronRight size={14} className="shrink-0 text-faint transition-transform group-open:rotate-90" />
        <span className={clsx("h-2 w-2 shrink-0 rounded-full", VERDICT_BAR[row.result])} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-fg">{row.attack_name || row.prompt_sent.slice(0, 70)}</span>
          <span className="block truncate text-xs text-mute">{prettyCategory(row.attack_category)}</span>
        </span>
        {row.mutation_generation > 0 && <Tag>retry {row.mutation_generation}</Tag>}
        {row.result === "fail" && <MethodTag method={row.method} />}
        <SeverityTag severity={row.severity} />
        <span className="w-24 text-right"><VerdictText verdict={row.result} /></span>
      </summary>
      <div className="space-y-3 bg-ink/60 px-5 pb-5 pt-1 pl-12">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wider text-faint">Sent to the app</p>
          <Mono className="max-h-60 overflow-y-auto rounded-md border border-line bg-ink p-3 text-mute">{row.prompt_sent}</Mono>
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wider text-faint">The app replied</p>
          <Mono className={clsx("max-h-60 overflow-y-auto rounded-md border border-line bg-ink p-3", row.result === "fail" ? "text-fail" : "text-fg")}>
            {row.model_response ?? "(no reply)"}
          </Mono>
        </div>
        <p className="text-[13px] leading-relaxed text-mute">
          <span className="text-fg">{methodLabel(row.method).text}.</span> {row.eval_reasoning}
          {row.method === "judge" && row.confidence !== null && <span className="text-faint"> (judge confidence {Math.round(row.confidence * 100)}%)</span>}
        </p>
      </div>
    </details>
  );
}

function ChangeList({ title, items, tone }: { title: string; items: ChangedAttack[]; tone: "fail" | "pass" | "mute" }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-fg">
        {title} <span className="font-mono text-mute">{items.length}</span>
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-faint">none</p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 8).map((a, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", tone === "fail" ? "bg-fail" : tone === "pass" ? "bg-pass" : "bg-faint")} />
              <span className="truncate text-mute">{a.attack_name}</span>
              {!a.stable_name && <Tag>generated</Tag>}
            </li>
          ))}
          {items.length > 8 && <li className="text-xs text-faint">and {items.length - 8} more</li>}
        </ul>
      )}
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
  const judged = counts.pass + counts.fail;
  const coverage = rows.length ? Math.round((judged / rows.length) * 100) : 0;
  const shown = [...rows]
    .filter((r) => filter === "all" || r.result === filter)
    .sort((a, b) => ORDER.indexOf(a.result) - ORDER.indexOf(b.result));

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
        back={<Link href="/scans" className="no-print inline-flex items-center gap-1.5 text-mute hover:text-fg"><ArrowLeft size={14} /> Scans</Link>}
        title={s.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusDot status={s.status} />
            {target.data && <Link href={`/targets/${target.data.id}`} className="hover:text-fg">{target.data.name}</Link>}
            <span>{s.attack_categories.map(prettyCategory).join(", ")}</span>
            {s.completed_at && <span>{duration(s.started_at, s.completed_at)}</span>}
          </span>
        }
        actions={
          isLive(s.status) ? (
            <Button variant="danger" onClick={cancel} busy={cancelling}><Square size={13} /> Stop scan</Button>
          ) : (
            <>
              <Link href={`/scans/new?target=${s.target_id}`}><Button><RotateCw size={14} /> Scan again</Button></Link>
              <Button onClick={() => window.print()}><Printer size={14} /> Print</Button>
              <Button variant="ghost" onClick={remove} aria-label="Delete scan"><Trash2 size={15} /></Button>
            </>
          )
        }
      />

      <div className="space-y-6">
        {isLive(s.status) && (
          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-fg">
                {s.total_tests ? `${s.completed_tests} of ${s.total_tests} attacks sent` : "Starting the app and checking the judge model…"}
              </span>
              <span className="font-mono text-mute">{Math.round(s.progress_percent)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-raised">
              <div className="h-full bg-accent transition-all duration-500" style={{ width: `${s.progress_percent}%` }} />
            </div>
            <p className="mt-2 text-xs text-mute">
              {counts.fail} worked so far. Results appear below as they arrive; the first judge call can take a minute with a local model.
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
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat
                label="Risk score"
                value={s.risk_score ?? "—"}
                tone={riskColor(s.risk_score)}
                sub={s.risk_score === null ? (isLive(s.status) ? "when the scan finishes" : "not available") : `${riskLevel(s.risk_score)} · 0 is best, 100 worst`}
              />
              <Stat
                label="Attacks that worked"
                value={<>{counts.fail}<span className="text-base text-faint"> / {rows.length}</span></>}
                tone={counts.fail ? "text-fail" : "text-pass"}
                sub={counts.fail ? `${confirmed} confirmed · ${counts.fail - confirmed} judge opinion` : "none"}
              />
              <Stat
                label="Clear verdicts"
                value={`${coverage}%`}
                tone={coverage >= 80 ? "text-fg" : "text-warn"}
                sub={counts.error + counts.inconclusive ? `${counts.error} target errors · ${counts.inconclusive} no verdict` : "every attack got pass or fail"}
              />
              <Stat label="Resisted" value={counts.pass} tone="text-pass" sub="the app held" />
            </div>

            <div>
              <VerdictBar counts={counts} className="h-3" />
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-mute">
                {ORDER.map((v) => (
                  <span key={v} className="inline-flex items-center gap-1.5">
                    <span className={clsx("h-2 w-2 rounded-full", VERDICT_BAR[v])} /> {VERDICT_LABEL[v]} {counts[v]}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {comparison.data?.baseline_id && (
          <Card>
            <CardHeader
              title="Compared with the previous scan"
              hint={
                <>
                  <Link href={`/scans/${comparison.data.baseline_id}`} className="hover:text-fg">{comparison.data.baseline_name}</Link>
                  {" · "}risk was {comparison.data.baseline_risk_score ?? "—"}, now {s.risk_score ?? "—"}
                </>
              }
            />
            <div className="grid gap-6 p-5 md:grid-cols-3">
              <ChangeList title="Newly working" items={comparison.data.new_failures ?? []} tone="fail" />
              <ChangeList title="Fixed" items={comparison.data.fixed ?? []} tone="pass" />
              <ChangeList title="Still working" items={comparison.data.still_failing ?? []} tone="mute" />
            </div>
          </Card>
        )}

        {report.data && report.data.findings.length > 0 && (
          <Card>
            <CardHeader title="Findings" hint="One per attack category that got through, with what to do about it." />
            <div className="divide-y divide-line">
              {report.data.findings.map((f) => (
                <div key={f.id} className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityTag severity={f.severity} />
                    <h3 className="text-[15px] font-semibold text-fg">{f.title}</h3>
                  </div>
                  <p className="mt-1.5 text-[13px] text-mute">{f.description}</p>
                  {f.remediation && (
                    <div className="mt-3 rounded-md border border-line bg-ink p-3">
                      <p className="mb-1 text-[11px] uppercase tracking-wider text-faint">What to do</p>
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg">{f.remediation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {s.status === "completed" && counts.fail === 0 && (
          <Notice tone="pass">
            None of the {rows.length} attacks worked. That covers only the attacks in this scan; it is not proof the app is safe.
          </Notice>
        )}

        {rows.length > 0 && (
          <Card>
            <CardHeader
              title="Every attack"
              hint="Open a row to read exactly what was sent and what came back."
              right={
                <div className="no-print flex flex-wrap gap-1.5">
                  {(["all", ...ORDER] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setFilter(v)}
                      className={clsx(
                        "rounded-md border px-2.5 py-1 text-xs",
                        filter === v ? "border-accent/60 bg-accent-dim/30 text-fg" : "border-line text-mute hover:text-fg"
                      )}
                    >
                      {v === "all" ? `All ${rows.length}` : `${VERDICT_LABEL[v]} ${counts[v]}`}
                    </button>
                  ))}
                </div>
              }
            />
            {shown.length === 0 ? (
              <p className="px-5 py-8 text-sm text-mute">Nothing in this group.</p>
            ) : (
              shown.map((row, i) => <ResultItem key={`${row.attack_name}-${row.mutation_generation}-${i}`} row={row} />)
            )}
          </Card>
        )}
      </div>
    </>
  );
}
