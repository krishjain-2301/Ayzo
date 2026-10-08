"use client";

import Link from "next/link";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { del } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { isLive, riskColor, riskLevel, timeAgo } from "@/lib/format";
import type { ScanSummary } from "@/lib/types";
import { Button, Card, Empty, Input, Loading, Notice, PageHeader, StatusDot, VerdictBar } from "@/components/ui";

export default function ScansPage() {
  const { data, error, loading, reload } = useApi<ScanSummary[]>("/campaigns", 4000);
  const [query, setQuery] = useState("");

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
  const scans = (data ?? []).filter((s) => !q || s.name.toLowerCase().includes(q) || s.target_name.toLowerCase().includes(q));

  return (
    <>
      <PageHeader
        title="Scans"
        subtitle="Every scan you have run. Open one to see which attacks worked and why."
        actions={
          <Link href="/scans/new">
            <Button variant="primary">New scan</Button>
          </Link>
        }
      />
      {error && <div className="mb-4"><Notice tone="fail">{error}</Notice></div>}
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty title="No scans yet" action={<Link href="/scans/new"><Button variant="primary">Run a scan</Button></Link>}>
          A scan sends a set of attacks to one target and records what happened.
        </Empty>
      ) : (
        <>
          <div className="mb-4 max-w-xs">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by scan or target name" />
          </div>
          <Card>
            <div className="grid grid-cols-[1fr_7rem_11rem_5rem_2.5rem] items-center gap-4 border-b border-line px-5 py-2.5 text-xs uppercase tracking-wider text-faint">
              <span>Scan</span>
              <span>Status</span>
              <span>Attacks that worked</span>
              <span className="text-right">Risk</span>
              <span />
            </div>
            {scans.length === 0 && <p className="px-5 py-8 text-sm text-mute">Nothing matches &ldquo;{query}&rdquo;.</p>}
            <ul className="divide-y divide-line">
              {scans.map((s) => {
                const noVerdict = s.error_tests + s.inconclusive_tests;
                return (
                  <li key={s.id} className="grid grid-cols-[1fr_7rem_11rem_5rem_2.5rem] items-center gap-4 px-5 py-3.5 hover:bg-raised/40">
                    <Link href={`/scans/${s.id}`} className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg hover:text-accent">{s.name}</p>
                      <p className="truncate text-xs text-mute">
                        {s.target_name} · {timeAgo(s.created_at)}
                      </p>
                      {s.status_detail && <p className="mt-1 line-clamp-1 text-xs text-warn">{s.status_detail}</p>}
                    </Link>
                    <StatusDot status={s.status} />
                    <div>
                      {isLive(s.status) ? (
                        <>
                          <div className="h-2 overflow-hidden rounded-full bg-raised">
                            <div className="h-full bg-accent transition-all" style={{ width: `${s.progress_percent}%` }} />
                          </div>
                          <p className="mt-1 text-xs text-mute">{Math.round(s.progress_percent)}% · {s.failed_tests} worked so far</p>
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
                          <p className="mt-1 text-xs text-mute">
                            {s.failed_tests} of {s.total_tests}
                            {noVerdict > 0 && <span className="text-warn"> · {noVerdict} without a verdict</span>}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-lg leading-none ${riskColor(s.risk_score)}`}>{s.risk_score ?? "—"}</p>
                      <p className="mt-1 text-[11px] text-mute">{riskLevel(s.risk_score)}</p>
                    </div>
                    <button onClick={() => remove(s)} className="justify-self-end text-faint hover:text-fail" aria-label={`Delete ${s.name}`}>
                      <Trash2 size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
