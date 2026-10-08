"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { isLive, riskColor, riskLevel, timeAgo } from "@/lib/format";
import type { ScanSummary, Target } from "@/lib/types";
import { Button, Card, CardHeader, Empty, Loading, Notice, PageHeader, Stat, StatusDot } from "@/components/ui";

export default function OverviewPage() {
  const scans = useApi<ScanSummary[]>("/campaigns", 4000);
  const targets = useApi<Target[]>("/targets");
  const seeded = useRef(false);

  // First run: give the user something to scan.
  useEffect(() => {
    if (targets.data && targets.data.length === 0 && !seeded.current) {
      seeded.current = true;
      post("/targets/builtin-dummy").then(targets.reload).catch(() => {});
    }
  }, [targets]);

  if (scans.loading || targets.loading) return <Loading />;
  if (scans.error) return <Notice tone="fail">{scans.error}</Notice>;

  const all = scans.data ?? [];
  const running = all.filter((s) => isLive(s.status));
  const completed = all.filter((s) => s.status === "completed");
  const noResult = all.filter((s) => s.status === "failed").slice(0, 3);
  const worst = [...completed].sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))[0];
  const latest = completed[0];

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="AYZO attacks your LLM app's chat endpoint and reports which attacks worked."
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Targets" value={targets.data?.length ?? 0} sub={<Link href="/targets" className="hover:text-fg">Manage targets</Link>} />
        <Stat label="Scans" value={all.length} sub={running.length ? `${running.length} running now` : "none running"} />
        <Stat
          label="Latest score"
          value={latest?.risk_score ?? "—"}
          tone={riskColor(latest?.risk_score)}
          sub={latest ? `${riskLevel(latest.risk_score)} · ${latest.target_name}` : "no completed scan yet"}
        />
        <Stat
          label="Highest score"
          value={worst?.risk_score ?? "—"}
          tone={riskColor(worst?.risk_score)}
          sub={worst ? `${worst.failed_tests} attacks worked · ${worst.target_name}` : "—"}
        />
      </div>

      {noResult.length > 0 && (
        <div className="mb-8 space-y-2">
          {noResult.map((s) => (
            <Notice key={s.id} tone="warn">
              <Link href={`/scans/${s.id}`} className="font-medium underline-offset-2 hover:underline">
                {s.name}
              </Link>{" "}
              did not produce a result: {s.status_detail || "see the scan for details."}
            </Notice>
          ))}
        </div>
      )}

      <Card>
        <CardHeader
          title="Recent scans"
          right={
            <Link href="/scans" className="flex items-center gap-1 text-[13px] text-mute hover:text-fg">
              All scans <ArrowRight size={13} />
            </Link>
          }
        />
        {all.length === 0 ? (
          <div className="p-5">
            <Empty title="No scans yet" action={<Link href="/scans/new"><Button variant="primary">Run your first scan</Button></Link>}>
              A built-in vulnerable chatbot is ready as a target, so you can try a scan without setting anything up.
            </Empty>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {all.slice(0, 8).map((s) => (
              <li key={s.id}>
                <Link href={`/scans/${s.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-raised/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{s.name}</p>
                    <p className="truncate text-xs text-mute">
                      {s.target_name} · {timeAgo(s.created_at)}
                    </p>
                  </div>
                  <div className="w-28">
                    <StatusDot status={s.status} />
                  </div>
                  <div className="w-24 text-right text-[13px] text-mute">
                    {isLive(s.status) ? `${Math.round(s.progress_percent)}%` : `${s.failed_tests} / ${s.total_tests}`}
                  </div>
                  <div className={`w-14 text-right font-mono text-lg ${riskColor(s.risk_score)}`}>{s.risk_score ?? "—"}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
