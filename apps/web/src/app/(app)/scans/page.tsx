"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { del } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { isLive, timeAgo } from "@/lib/format";
import type { ScanStatus, ScanSummary } from "@/lib/types";
import { Button, Card, Empty, Input, Loading, Notice, PageHeader, StatusDot, TD, TH, VerdictBar } from "@/components/ui";
import { RiskChip } from "@/components/charts";

const FILTERS: { id: "all" | ScanStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "running", label: "Running" },
  { id: "failed", label: "No result" },
];

export default function ScansPage() {
  const router = useRouter();
  const { data, error, loading, reload } = useApi<ScanSummary[]>("/campaigns", 4000);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ScanStatus>("all");

  const remove = async (scan: ScanSummary) => {
    if (!confirm(`Delete the scan "${scan.name}" and its results?`)) return;
    try {
      await del(`/campaigns/${scan.id}`);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not delete the scan.");
    }
  };

  const q = query.trim().toLowerCase();
  const scans = (data ?? []).filter(
    (s) =>
      (status === "all" || s.status === status || (status === "running" && s.status === "pending")) &&
      (!q || s.name.toLowerCase().includes(q) || s.target_name.toLowerCase().includes(q))
  );

  return (
    <>
      <PageHeader title="Scans" subtitle="Every scan you have run. Open one to see which attacks worked and why." />
      {error && <div className="mb-4"><Notice tone="fail">{error}</Notice></div>}
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty title="No scans yet" action={<Link href="/scans/new"><Button variant="primary">Run a scan</Button></Link>}>
          A scan sends a set of attacks to one target and records what happened.
        </Empty>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <div className="flex gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatus(f.id)}
                  className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${status === f.id ? "bg-accent-dim text-fg" : "text-mute hover:bg-raised hover:text-fg"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative w-64">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <Input className="!pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search scans or targets" />
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                <th className={TH}>Scan</th>
                <th className={TH}>Target</th>
                <th className={TH}>Status</th>
                <th className={`${TH} w-56`}>Attacks that worked</th>
                <th className={`${TH} text-right`}>Risk</th>
                <th className={TH}>Level</th>
                <th className={TH}>When</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {scans.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-mute">No scans match.</td></tr>
              )}
              {scans.map((s) => {
                const noVerdict = s.error_tests + s.inconclusive_tests;
                return (
                  <tr key={s.id} className="cursor-pointer hover:bg-raised/50" onClick={() => router.push(`/scans/${s.id}`)}>
                    <td className={`${TD} max-w-[20rem]`}>
                      <p className="truncate font-medium text-fg">{s.name}</p>
                      {s.status_detail && <p className="mt-0.5 line-clamp-1 text-xs text-mute">{s.status_detail}</p>}
                    </td>
                    <td className={`${TD} text-mute`}>{s.target_name}</td>
                    <td className={TD}><StatusDot status={s.status} /></td>
                    <td className={TD}>
                      {isLive(s.status) ? (
                        <>
                          <div className="h-2 overflow-hidden rounded-full bg-raised">
                            <div className="h-full bg-accent transition-all" style={{ width: `${s.progress_percent}%` }} />
                          </div>
                          <p className="tabular mt-1.5 text-xs text-mute">{Math.round(s.progress_percent)}% sent · {s.failed_tests} worked so far</p>
                        </>
                      ) : (
                        <>
                          <VerdictBar
                            counts={{
                              fail: s.failed_tests,
                              error: s.error_tests,
                              inconclusive: s.inconclusive_tests,
                              pass: Math.max(0, s.total_tests - s.failed_tests - noVerdict),
                            }}
                          />
                          <p className="tabular mt-1.5 text-xs text-mute">
                            <span className="font-medium text-fg">{s.failed_tests}</span> of {s.total_tests}
                            {noVerdict > 0 && ` · ${noVerdict} without a verdict`}
                          </p>
                        </>
                      )}
                    </td>
                    <td className={`${TD} tabular text-right text-base font-semibold text-fg`}>{s.risk_score ?? "—"}</td>
                    <td className={TD}>{s.risk_score !== null ? <RiskChip score={s.risk_score} /> : <span className="text-xs text-faint">—</span>}</td>
                    <td className={`${TD} whitespace-nowrap text-mute`}>{timeAgo(s.created_at)}</td>
                    <td className={`${TD} text-right`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(s);
                        }}
                        className="rounded p-1.5 text-faint hover:bg-raised hover:text-fail"
                        aria-label={`Delete ${s.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
