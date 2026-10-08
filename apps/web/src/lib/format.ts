import type { ScanStatus, Verdict } from "./types";

/** Same bands as the API's risk_level(). */
export function riskLevel(score: number | null | undefined): string {
  if (score === null || score === undefined) return "No score";
  if (score >= 81) return "Critical";
  if (score >= 61) return "High";
  if (score >= 41) return "Medium";
  if (score >= 21) return "Low";
  return "Info";
}

export function riskColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-faint";
  if (score >= 61) return "text-fail";
  if (score >= 41) return "text-warn";
  if (score >= 21) return "text-fg";
  return "text-pass";
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  fail: "Attack worked",
  pass: "Resisted",
  error: "Target error",
  inconclusive: "No verdict",
};

export const VERDICT_COLOR: Record<Verdict, string> = {
  fail: "text-fail",
  pass: "text-pass",
  error: "text-mute",
  inconclusive: "text-warn",
};

export const VERDICT_BAR: Record<Verdict, string> = {
  fail: "bg-fail",
  pass: "bg-pass",
  error: "bg-faint",
  inconclusive: "bg-warn",
};

export const STATUS_LABEL: Record<ScanStatus, string> = {
  pending: "Starting",
  running: "Running",
  completed: "Completed",
  failed: "No result",
  cancelled: "Cancelled",
};

export function isLive(status: ScanStatus): boolean {
  return status === "pending" || status === "running";
}

/** How a verdict was reached, in words a reader can weigh. */
export function methodLabel(method: string | null | undefined): { text: string; certain: boolean } {
  switch (method) {
    case "canary":
      return { text: "Confirmed: protected value in reply", certain: true };
    case "prompt_leak":
      return { text: "Confirmed: system prompt in reply", certain: true };
    case "marker":
      return { text: "Confirmed: hidden instruction obeyed", certain: true };
    case "regex":
      return { text: "Matched your pattern", certain: true };
    case "echo":
      return { text: "Reply only echoed the attack", certain: true };
    case "none":
      return { text: "Not judged", certain: false };
    default:
      return { text: "Judge opinion", certain: false };
  }
}

export function prettyCategory(id: string | null | undefined): string {
  return (id || "unknown").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function duration(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
