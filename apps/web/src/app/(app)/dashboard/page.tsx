"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { isLive, timeAgo } from "@/lib/format";
import type { Report, ScanSummary, Target } from "@/lib/types";
import { Button, Card, CardHeader, Empty, Loading, Notice, PageHeader, Stat, StatusDot, TD, TH, VerdictBar } from "@/components/ui";
import { BarList, RiskChip, ScoreRing, TrendChart, riskTone } from "@/components/charts";

function Delta({ now, before }: { now: number | null; before: number | null | undefined }) {
  if (now === null || before === null || before === undefined) return <>no earlier scan to compare</>;
  const d = Math.round((now - before) * 10) / 10;
  if (d === 0) return <span className="inline-flex items-center gap-1"><Minus size={13} /> unchanged since the previous scan</span>;
  // Lower risk is better, so a drop is the good direction.
  const Icon = d > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon size={13} className={d > 0 ? "text-fail" : "text-pass"} />
      {Math.abs(d)} {d > 0 ? "higher" : "lower"} than the previous scan
    </span>
  );
}

export default function OverviewPage() {
  const router = useRouter();
  const scans = useApi<ScanSummary[]>("/campaigns", 5000);
  const targets = useApi<Target[]>("/targets");
  const seeded = useRef(false);

  const all = scans.data ?? [];
  const completed = all.filter((s) => s.status === "completed" && s.risk_score !== null);
  const latest = completed[0];
  const report = useApi<Report>(latest ? `/reports/campaign/${latest.id}` : null);

  // First run: give the user something to scan.
  useEffect(() => {
    if (targets.data && targets.data.length === 0 && !seeded.current) {
      seeded.current = true;
      post("/targets/builtin-dummy").then(targets.reload).catch(() => {});
    }
  }, [targets]);

  if (scans.loading || targets.loading) return <Loading />;
  if (scans.error) return <Notice tone="fail">{scans.error}</Notice>;

  const running = all.filter((s) => isLive(s.status));
  const noResult = all.filter((s) => s.status === "failed" && (!latest || s.created_at > latest.created_at)).slice(0, 2);
  const previous = latest ? completed.find((s) => s.id !== latest.id && s.target_name === latest.target_name) : undefined;
  const resisted = latest ? Math.max(0, latest.total_tests - latest.failed_tests - latest.error_tests - latest.inconclusive_tests) : 0;

  // Oldest first for the trend.
  const recent = [...completed].reverse().slice(-30);
  const sameDay = recent.length > 0 && recent.every((s) => new Date(s.created_at).toDateString() === new Date(recent[0].created_at).toDateString());
  const trend = recent.map((s) => ({
    id: s.id,
    label: sameDay
      ? new Date(s.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : new Date(s.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    title: s.name,
    value: s.risk_score as number,
  }));

  // One row per target: its most recent completed scan.
  const perTarget = (targets.data ?? []).map((t) => ({
    target: t,
    last: completed.find((s) => s.target_name === t.name),
    scans: all.filter((s) => s.target_name === t.name).length,
  }));

  const categories = (report.data?.category_scores ?? [])
    .map((c) => ({ label: c.display_name, value: c.failures, total: c.total_tests }))
    .sort((a, b) => b.value - a.value);

  if (all.length === 0) {
    return (
      <>
        <PageHeader title="Overview" subtitle="AYZO attacks your LLM app's chat endpoint and reports which attacks worked." />
        <Empty title="No scans yet" action={<Link href="/scans/new"><Button variant="primary">Run your first scan</Button></Link>}>
          A built-in vulnerable chatbot is already registered as a target, so you can try a scan without setting anything up.
        </Empty>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Overview" subtitle="How your apps held up in the scans so far." />

      {noResult.length > 0 && (
        <div className="mb-6 space-y-2">
          {noResult.map((s) => (
            <Notice key={s.id} tone="warn">
              <Link href={`/scans/${s.id}`} className="font-medium underline-offset-2 hover:underline">{s.name}</Link>{" "}
              did not produce a result. {s.status_detail}
            </Notice>
          ))}
        </div>
      )}

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        <Stat
          label="Latest risk score"
          marker={riskTone(latest?.risk_score)}
          value={latest?.risk_score ?? "—"}
          sub={latest ? <Delta now={latest.risk_score} before={previous?.risk_score} /> : "no completed scan yet"}
        />
        <Stat
          label="Attacks that worked"
          value={latest ? <>{latest.failed_tests}<span className="text-lg font-normal text-faint"> / {latest.total_tests}</span></> : "—"}
          sub={latest ? `in the latest scan of ${latest.target_name}` : "—"}
        />
        <Stat label="Targets" value={targets.data?.length ?? 0} sub={`${perTarget.filter((p) => p.last).length} scanned at least once`} />
        <Stat label="Scans" value={all.length} sub={running.length ? `${running.length} running now` : `${completed.length} completed`} />
      </div>

      {/* Trend + latest scan */}
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Risk score over time" hint="Each point is one completed scan. Lower is better. Click a point to open that scan." />
          <div className="p-5">
            <TrendChart points={trend} onSelect={(id) => router.push(`/scans/${id}`)} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Latest scan"
            hint={latest ? `${latest.target_name} · ${timeAgo(latest.created_at)}` : undefined}
            right={latest && <Link href={`/scans/${latest.id}`} className="flex items-center gap-1 text-[13px] text-mute hover:text-fg">Open <ArrowRight size={13} /></Link>}
          />
          {latest ? (
            <div className="flex flex-col items-center gap-4 p-5">
              <ScoreRing score={latest.risk_score} />
              <RiskChip score={latest.risk_score} className="!text-sm" />
              <div className="w-full">
                <VerdictBar counts={{ fail: latest.failed_tests, error: latest.error_tests, inconclusive: latest.inconclusive_tests, pass: resisted }} />
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                  {(
                    [
                      ["bg-fail", "Attack worked", latest.failed_tests],
                      ["bg-pass", "Resisted", resisted],
                      ["bg-warn", "No verdict", latest.inconclusive_tests],
                      ["bg-faint", "Target error", latest.error_tests],
                    ] as [string, string, number][]
                  ).map(([dot, label, n]) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <dt className="flex items-center gap-2 text-mute"><span className={`h-2 w-2 rounded-full ${dot}`} />{label}</dt>
                      <dd className="tabular font-medium text-fg">{n}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          ) : (
            <p className="p-5 text-sm text-mute">No completed scan yet.</p>
          )}
        </Card>
      </div>

      {/* Categories + targets */}
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Where attacks got through" hint="Attacks that worked, out of those sent, per category in the latest scan." />
          <div className="p-5">
            <BarList rows={categories} empty={report.loading ? "Loading…" : "No category data for the latest scan."} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Targets"
            hint="Most recent completed scan of each app."
            right={<Link href="/targets" className="flex items-center gap-1 text-[13px] text-mute hover:text-fg">Manage <ArrowRight size={13} /></Link>}
          />
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                <th className={TH}>Target</th>
                <th className={`${TH} text-right`}>Scans</th>
                <th className={`${TH} text-right`}>Last score</th>
                <th className={TH}>Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {perTarget.map(({ target, last, scans: n }) => (
                <tr key={target.id} className="hover:bg-raised/50">
                  <td className={TD}>
                    <Link href={`/targets/${target.id}`} className="font-medium text-fg hover:text-accent">{target.name}</Link>
                    <p className="text-xs text-mute">port {target.target_port}</p>
                  </td>
                  <td className={`${TD} tabular text-right text-mute`}>{n}</td>
                  <td className={`${TD} tabular text-right font-semibold text-fg`}>{last?.risk_score ?? "—"}</td>
                  <td className={TD}>{last ? <RiskChip score={last.risk_score} /> : <span className="text-xs text-faint">not scanned</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Recent scans */}
      <Card className="mt-5">
        <CardHeader
          title="Recent scans"
          right={<Link href="/scans" className="flex items-center gap-1 text-[13px] text-mute hover:text-fg">All scans <ArrowRight size={13} /></Link>}
        />
        <table className="w-full">
          <thead>
            <tr className="border-b border-line">
              <th className={TH}>Scan</th>
              <th className={TH}>Target</th>
              <th className={TH}>Status</th>
              <th className={`${TH} text-right`}>Worked</th>
              <th className={`${TH} text-right`}>Risk</th>
              <th className={TH}>When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {all.slice(0, 6).map((s) => (
              <tr key={s.id} className="cursor-pointer hover:bg-raised/50" onClick={() => router.push(`/scans/${s.id}`)}>
                <td className={`${TD} max-w-[18rem] truncate font-medium text-fg`}>{s.name}</td>
                <td className={`${TD} text-mute`}>{s.target_name}</td>
                <td className={TD}><StatusDot status={s.status} /></td>
                <td className={`${TD} tabular text-right text-mute`}>
                  {isLive(s.status) ? `${Math.round(s.progress_percent)}%` : <><span className="font-medium text-fg">{s.failed_tests}</span> / {s.total_tests}</>}
                </td>
                <td className={`${TD} tabular text-right font-semibold text-fg`}>{s.risk_score ?? "—"}</td>
                <td className={`${TD} text-mute`}>{timeAgo(s.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
