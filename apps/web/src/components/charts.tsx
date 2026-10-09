"use client";

import { useState } from "react";
import clsx from "clsx";
import { riskLevel } from "@/lib/format";

/* Status colour for a risk score. Used on marks only; text stays neutral. */
export function riskTone(score: number | null | undefined): "fail" | "warn" | "pass" | "mute" {
  if (score === null || score === undefined) return "mute";
  if (score >= 61) return "fail";
  if (score >= 41) return "warn";
  return "pass";
}

const TONE_BG = { fail: "bg-fail", warn: "bg-warn", pass: "bg-pass", mute: "bg-faint" };
const TONE_STROKE = { fail: "rgb(var(--fail))", warn: "rgb(var(--warn))", pass: "rgb(var(--pass))", mute: "rgb(var(--faint))" };

/** A dot plus a word: the risk level, readable without colour. */
export function RiskChip({ score, className }: { score: number | null | undefined; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-xs text-mute", className)}>
      <span className={clsx("h-2 w-2 rounded-full", TONE_BG[riskTone(score)])} />
      {riskLevel(score)}
    </span>
  );
}

/** The headline number: a ring filled to the score, the number in the middle. */
export function ScoreRing({ score, size = 132 }: { score: number | null | undefined; size?: number }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = score ?? 0;
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`Risk score ${score ?? "not available"} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={stroke} />
        {score !== null && score !== undefined && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={TONE_STROKE[riskTone(score)]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(Math.max(value, 1.5) / 100) * c} ${c}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-3xl font-semibold tracking-tight text-fg">{score ?? "—"}</span>
        <span className="text-xs text-mute">of 100</span>
      </div>
    </div>
  );
}

export interface TrendPoint {
  id: string;
  label: string; // shown on the axis
  title: string; // shown in the tooltip
  value: number;
}

/**
 * Risk score over successive scans: one series, one axis (0-100), a thin line
 * with a light wash, and a tooltip on hover. With a single point there is no
 * trend to draw, so it says so.
 */
export function TrendChart({ points, height = 200, onSelect }: { points: TrendPoint[]; height?: number; onSelect?: (id: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center text-sm text-mute" style={{ height }}>
        {points.length === 0 ? "No completed scans yet." : "One completed scan so far. A trend appears after the second."}
      </div>
    );
  }

  const W = 1000;
  const H = 100;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - (Math.min(Math.max(v, 0), 100) / 100) * H;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const active = hover !== null ? points[hover] : null;

  return (
    <div className="flex gap-3">
      {/* y axis */}
      <div className="tabular relative w-7 shrink-0 text-right text-xs text-faint" style={{ height }}>
        {[100, 50, 0].map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - t}%` }}>{t}</span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className="relative"
          style={{ height }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - box.left) / box.width;
            setHover(Math.round(Math.min(Math.max(ratio, 0), 1) * (points.length - 1)));
          }}
          onClick={() => active && onSelect?.(active.id)}
        >
          {[0, 50, 100].map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-line" style={{ top: `${100 - t}%` }} />
          ))}
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            <path d={area} fill="rgb(var(--accent))" opacity={0.1} />
            <path d={line} fill="none" stroke="rgb(var(--accent))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {/* markers are HTML so they stay round whatever the chart's width */}
          {points.map((p, i) => (
            <span
              key={p.id}
              className={clsx(
                "absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-panel transition-transform",
                hover === i && "scale-150",
                points.length > 24 && hover !== i && "hidden"
              )}
              style={{ left: `${(i / (points.length - 1)) * 100}%`, top: `${100 - Math.min(p.value, 100)}%` }}
            />
          ))}
          {active && hover !== null && (
            <>
              <div className="pointer-events-none absolute inset-y-0 w-px bg-faint/60" style={{ left: `${(hover / (points.length - 1)) * 100}%` }} />
              <div
                className={clsx(
                  "pointer-events-none absolute top-1 z-10 w-52 rounded-md border border-line bg-raised px-3 py-2 shadow-xl",
                  hover > (points.length - 1) / 2 ? "-translate-x-[calc(100%+10px)]" : "translate-x-[10px]"
                )}
                style={{ left: `${(hover / (points.length - 1)) * 100}%` }}
              >
                <p className="truncate text-sm font-medium text-fg">{active.title}</p>
                <p className="text-xs text-mute">{active.label}</p>
                <p className="mt-1.5 flex items-center justify-between text-sm">
                  <span className="text-mute">Risk score</span>
                  <span className="tabular font-semibold text-fg">{active.value}</span>
                </p>
                <RiskChip score={active.value} className="mt-0.5" />
              </div>
            </>
          )}
        </div>
        {/* x axis: first and last only, the tooltip carries the rest */}
        <div className="mt-2 flex justify-between text-xs text-faint">
          <span>{points[0].label}</span>
          <span>{points[points.length - 1].label}</span>
        </div>
      </div>
    </div>
  );
}

export interface BarRow {
  label: string;
  value: number;
  total: number;
  hint?: string;
}

/** Horizontal bars with the value at the end: how many attacks worked per category. */
export function BarList({ rows, empty }: { rows: BarRow[]; empty?: string }) {
  if (!rows.length) return <p className="py-6 text-sm text-mute">{empty ?? "Nothing to show."}</p>;
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => (
        <li key={r.label} title={r.hint}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="truncate text-sm text-fg">{r.label}</span>
            <span className="tabular shrink-0 text-sm text-mute">
              <span className="font-medium text-fg">{r.value}</span> of {r.total}
            </span>
          </div>
          {/* the track is the number of attacks sent; the fill is how many worked */}
          <div className="h-2 rounded-r bg-raised" style={{ width: `${Math.max((r.total / max) * 100, 4)}%` }}>
            {r.value > 0 && <div className="h-full rounded-r bg-fail" style={{ width: `${(r.value / r.total) * 100}%` }} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
