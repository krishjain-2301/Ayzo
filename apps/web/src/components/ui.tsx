"use client";

import React from "react";
import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import type { ScanStatus, Verdict } from "@/lib/types";
import { STATUS_LABEL, VERDICT_BAR, VERDICT_LABEL, methodLabel } from "@/lib/format";

/* ---------------------------------------------------------------- buttons */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  busy?: boolean;
};

export function Button({ variant = "secondary", size = "md", busy, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors whitespace-nowrap",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        size === "sm" ? "h-8 px-3 text-sm" : "h-9 px-4 text-sm",
        variant === "primary" && "bg-accent text-accent-ink hover:bg-accent/85",
        variant === "secondary" && "border border-line bg-raised text-fg hover:border-faint",
        variant === "ghost" && "text-mute hover:text-fg hover:bg-raised",
        variant === "danger" && "border border-fail/40 text-fail hover:bg-fail/10",
        className
      )}
    >
      {busy && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- layout */

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && <div className="mb-3 text-sm">{back}</div>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          {subtitle && <div className="mt-1.5 max-w-3xl text-sm leading-relaxed text-mute">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={clsx("rounded-xl border border-line bg-panel", className)}>{children}</section>;
}

export function CardHeader({ title, hint, right }: { title: React.ReactNode; hint?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
        {hint && <p className="mt-1 text-[13px] leading-relaxed text-mute">{hint}</p>}
      </div>
      {right}
    </header>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-mute">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "fail" | "pass"; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        "rounded-md border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words",
        tone === "info" && "border-line bg-raised text-mute",
        tone === "warn" && "border-warn/30 bg-warn/5 text-warn",
        tone === "fail" && "border-fail/30 bg-fail/5 text-fail",
        tone === "pass" && "border-pass/30 bg-pass/5 text-pass"
      )}
    >
      {children}
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 py-10 text-sm text-mute">
      <Loader2 size={14} className="animate-spin" /> {label}
    </p>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={onClose}>
      <div
        className={clsx("flex max-h-[90vh] w-full flex-col rounded-lg border border-line bg-panel shadow-2xl", wide ? "max-w-2xl" : "max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-mute hover:text-fg" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- forms */

const INPUT = "w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-accent/60";

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-fg">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-mute">{hint}</span>}
    </label>
  );
}

export function Input({ mono, className, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return <input {...rest} className={clsx(INPUT, mono && "font-mono text-sm", className)} />;
}

export function Textarea({ mono, className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }) {
  return <textarea {...rest} className={clsx(INPUT, "resize-y leading-relaxed", mono && "font-mono text-sm", className)} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={clsx(INPUT, "appearance-none pr-8", className)}>
      {children}
    </select>
  );
}

/* ---------------------------------------------------------------- data display */

export function Stat({ label, value, sub, marker }: { label: string; value: React.ReactNode; sub?: React.ReactNode; marker?: "fail" | "warn" | "pass" | "mute" }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-mute">
        {marker && <span className={clsx("h-2 w-2 rounded-full", marker === "fail" ? "bg-fail" : marker === "warn" ? "bg-warn" : marker === "pass" ? "bg-pass" : "bg-faint")} />}
        {label}
      </p>
      <p className="tabular mt-3 text-3xl font-semibold leading-none tracking-tight text-fg">{value}</p>
      {sub && <p className="mt-2.5 text-[13px] leading-snug text-mute">{sub}</p>}
    </div>
  );
}

/** Tabs: one long page becomes a few short ones. */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="no-print flex gap-1 border-b border-line" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            "-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
            value === t.id ? "border-accent text-fg" : "border-transparent text-mute hover:text-fg"
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={clsx("tabular rounded-full px-1.5 py-0.5 text-xs", value === t.id ? "bg-accent-dim text-fg" : "bg-raised text-mute")}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Table header and cell classes, so every table lines up the same way. */
export const TH = "px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-mute";
export const TD = "px-5 py-3.5 align-middle";

export function Tag({ children, tone }: { children: React.ReactNode; tone?: "fail" | "pass" | "warn" | "accent" | "mute" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium leading-none",
        tone === "fail" && "border-fail/40 text-fail",
        tone === "pass" && "border-pass/40 text-pass",
        tone === "warn" && "border-warn/40 text-warn",
        tone === "accent" && "border-accent/40 text-accent",
        (!tone || tone === "mute") && "border-line text-mute"
      )}
    >
      {children}
    </span>
  );
}

export function SeverityTag({ severity }: { severity: string | null | undefined }) {
  const s = (severity || "medium").toLowerCase();
  return <Tag tone={s === "critical" || s === "high" ? "fail" : s === "medium" ? "warn" : "mute"}>{s}</Tag>;
}

export function VerdictText({ verdict }: { verdict: Verdict }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-fg">
      <span className={clsx("h-2 w-2 rounded-full", VERDICT_BAR[verdict])} />
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

export function MethodTag({ method }: { method: string | null | undefined }) {
  const { text, certain } = methodLabel(method);
  return <Tag tone={certain ? "accent" : "mute"}>{text}</Tag>;
}

export function StatusDot({ status }: { status: ScanStatus }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        className={clsx(
          "h-2 w-2 rounded-full",
          status === "running" || status === "pending" ? "bg-accent animate-pulse" : status === "completed" ? "bg-pass" : status === "failed" ? "bg-warn" : "bg-faint"
        )}
      />
      <span className={status === "failed" ? "text-warn" : "text-fg"}>{STATUS_LABEL[status] ?? status}</span>
    </span>
  );
}

/** One horizontal bar split by verdict. The whole scan at a glance. */
export function VerdictBar({ counts, className }: { counts: Record<Verdict, number>; className?: string }) {
  const total = counts.fail + counts.pass + counts.error + counts.inconclusive;
  if (!total) return <div className={clsx("h-2 rounded-full bg-raised", className)} />;
  return (
    <div className={clsx("flex h-2 overflow-hidden rounded-full bg-raised", className)}>
      {(["fail", "inconclusive", "error", "pass"] as Verdict[]).map(
        (v) => counts[v] > 0 && <div key={v} className={VERDICT_BAR[v]} style={{ width: `${(counts[v] / total) * 100}%` }} title={`${VERDICT_LABEL[v]}: ${counts[v]}`} />
      )}
    </div>
  );
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <pre className={clsx("whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed", className)}>{children}</pre>;
}
