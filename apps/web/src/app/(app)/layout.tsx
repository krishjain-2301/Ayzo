"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { BookOpen, Crosshair, LayoutDashboard, MessagesSquare, Plus, Radar, Settings, ShieldHalf } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { ModelsOverview } from "@/lib/types";

const NAV = [
  {
    group: "Monitor",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/scans", label: "Scans", icon: Radar },
    ],
  },
  {
    group: "Test",
    items: [
      { href: "/targets", label: "Targets", icon: Crosshair },
      { href: "/agentic", label: "Agentic attack", icon: MessagesSquare },
      { href: "/library", label: "Attack library", icon: BookOpen },
    ],
  },
  {
    group: "Configure",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

const TITLES: [string, string][] = [
  ["/dashboard", "Overview"],
  ["/scans/new", "New scan"],
  ["/scans", "Scans"],
  ["/targets", "Targets"],
  ["/agentic", "Agentic attack"],
  ["/library", "Attack library"],
  ["/settings", "Settings"],
];

/** Top bar, right side: which model judges and whether the API answers. */
function SystemStatus() {
  const [state, setState] = useState<{ model?: string; problem?: string }>({});

  useEffect(() => {
    let alive = true;
    const load = () =>
      apiFetch<ModelsOverview>("/system/models")
        .then((m) => alive && setState({ model: m.eval_model, problem: m.eval_model_missing_key ? "Judge needs an API key" : undefined }))
        .catch(() => alive && setState({ problem: "API not reachable" }));
    load();
    const timer = setInterval(load, 20000);
    // The settings page announces a change so this updates at once.
    window.addEventListener("ayzo:models-changed", load);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("ayzo:models-changed", load);
    };
  }, []);

  return (
    <Link
      href="/settings"
      title="Change the judge model"
      className="flex h-9 items-center gap-2.5 rounded-lg border border-line bg-panel px-3 text-[13px] hover:border-faint"
    >
      <span className={clsx("h-2 w-2 rounded-full", state.problem ? "bg-warn" : state.model ? "bg-pass" : "bg-faint")} />
      <span className="text-mute">{state.problem ?? "Judge"}</span>
      {state.model && !state.problem && <span className="font-mono text-fg">{state.model}</span>}
    </Link>
  );
}

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const section = TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? "AYZO";

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-panel">
        <Link href="/dashboard" className="flex h-14 items-center gap-2.5 border-b border-line px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
            <ShieldHalf size={16} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-fg">AYZO</span>
          <span className="ml-auto rounded border border-line px-1.5 py-0.5 text-[11px] text-mute">local</span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map(({ group, items }) => (
            <div key={group} className="mb-5">
              <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-faint">{group}</p>
              {items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      "mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active ? "bg-accent-dim font-medium text-fg" : "text-mute hover:bg-raised hover:text-fg"
                    )}
                  >
                    <Icon size={16} className={active ? "text-accent" : ""} />
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <p className="border-t border-line px-5 py-3 text-xs leading-relaxed text-faint">
          Runs on this computer. Nothing leaves it unless you choose an online model.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-ink/85 px-8 backdrop-blur">
          <p className="text-sm text-mute">
            AYZO <span className="mx-1.5 text-faint">/</span> <span className="text-fg">{section}</span>
          </p>
          <div className="flex items-center gap-3">
            <SystemStatus />
            <Link
              href="/scans/new"
              className="flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white transition-colors hover:bg-accent/85"
            >
              <Plus size={15} /> New scan
            </Link>
          </div>
        </header>

        <main className="flex-1 px-8 py-8 print:p-0">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
