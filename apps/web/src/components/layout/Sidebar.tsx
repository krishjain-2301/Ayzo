"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Crosshair,
  Swords,
  FileText,
  Library,
  Shield,
  Settings2,
} from "lucide-react";
import clsx from "clsx";

export function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; email: string; picture?: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const navGroups = [
    {
      label: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "AI Targets", href: "/targets", icon: Crosshair },
      ],
    },
    {
      label: "Testing",
      items: [
        { label: "Campaigns", href: "/campaigns", icon: Swords },
        { label: "Reports", href: "/reports", icon: FileText },
        { label: "Attack Library", href: "/library", icon: Library },
      ],
    },
    {
      label: "System",
      items: [
        { label: "Live Proxy", href: "/proxy", icon: Shield },
        { label: "Settings", href: "/settings", icon: Settings2 },
      ],
    },
  ];

  return (
    <aside className="w-56 h-screen flex flex-col px-4 py-6 bg-zinc-950 border-r border-zinc-800 shrink-0">
      <div className="px-2 mb-8">
        <Link href="/" className="font-heading font-bold text-lg text-white tracking-widest">
          AYZO
        </Link>
      </div>

      <nav className="flex-1 flex flex-col gap-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 px-3 mb-2">
              {group.label}
            </div>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-violet-600/20 text-violet-400"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                    )}
                  >
                    <item.icon size={16} className={clsx("shrink-0", isActive ? "opacity-100" : "opacity-70")} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto pt-4 border-t border-zinc-800">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center font-semibold text-xs shrink-0 overflow-hidden">
            {user?.picture ? (
              <img src={user.picture} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              user?.name?.charAt(0) || "U"
            )}
          </div>
          <div className="min-w-0 overflow-hidden text-ellipsis">
            <div className="font-medium text-xs text-white truncate">
              {user?.name || "User"}
            </div>
            <div className="text-[10px] text-zinc-500 truncate">
              {user?.email || "user@example.com"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
