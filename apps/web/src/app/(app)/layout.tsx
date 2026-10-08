"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { BookOpen, Crosshair, LayoutGrid, MessagesSquare, Play, Radar, Settings } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { ModelsOverview } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/targets", label: "Targets", icon: Crosshair },
  { href: "/scans", label: "Scans", icon: Radar },
  { href: "/agentic", label: "Agentic attack", icon: MessagesSquare },
  { href: "/library", label: "Attack library", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Sidebar footer: which model judges, and whether the API answers at all. */
function JudgeStatus() {
  const [state, setState] = useState<{ model?: string; problem?: string }>({});

  useEffect(() => {
    let alive = true;
    const load = () =>
      apiFetch<ModelsOverview>("/system/models")
        .then((m) => alive && setState({ model: m.eval_model, problem: m.eval_model_missing_key ? "API key missing" : undefined }))
        .catch(() => alive && setState({ problem: "API not reachable" }));
    load();
    const timer = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <Link href="/settings" className="block rounded-md border border-line px-3 py-2.5 hover:border-faint">
      <p className="text-[11px] uppercase tracking-wider text-faint">Judge model</p>
      <p className="mt-0.5 truncate font-mono text-xs text-fg">{state.model ?? "—"}</p>
      {state.problem && <p className="mt-1 text-xs text-warn">{state.problem}</p>}
    </Link>
  );
}

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-line bg-panel px-3 py-5">
        <Link href="/dashboard" className="mb-6 flex items-baseline gap-2 px-2">
          <span className="font-mono text-lg font-medium tracking-[0.2em] text-fg">AYZO</span>
          <span className="text-[11px] text-faint">local</span>
        </Link>

        <Link
          href="/scans/new"
          className="mb-5 flex h-9 items-center justify-center gap-2 rounded-md bg-accent text-sm font-medium text-accent-ink hover:bg-accent/85"
        >
          <Play size={14} /> New scan
        </Link>

        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-raised text-fg" : "text-mute hover:bg-raised/60 hover:text-fg"
                )}
              >
                <Icon size={16} className={active ? "text-accent" : ""} />
                {label}
              </Link>
            );
          })}
        </nav>

        <JudgeStatus />
      </aside>

      <main className="min-w-0 flex-1 px-8 py-8 print:p-0">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
