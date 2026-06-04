"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Crosshair,
  Swords,
  FileText,
  Library,
  LogOut,
} from "lucide-react";

const navItems = [
  {
    group: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/targets", label: "AI Targets", icon: Crosshair },
    ],
  },
  {
    group: "Testing",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: Swords },
      { href: "/reports", label: "Reports", icon: FileText },
      { href: "/library", label: "Attack Library", icon: Library },
    ],
  },
];

export function Sidebar() {
  const [user, setUser] = useState<{
    name?: string;
    email?: string;
    avatar_url?: string;
    role?: string;
  } | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="logo-wordmark">AYZO</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((group) => (
          <div key={group.group}>
            <p className="nav-group-label">{group.group}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${isActive(item.href) ? "active" : ""}`}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div className="user-profile">
              <div className="avatar">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name || "User"}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  user.name ? user.name[0].toUpperCase() : "U"
                )}
              </div>
              <div>
                <p className="user-name">{user.name || "User"}</p>
                <p className="user-role">
                  {user.role === "admin" ? "Administrator" : "Analyst"}
                </p>
              </div>
            </div>
            <button
              className="icon-btn"
              onClick={handleLogout}
              title="Sign out"
              style={{ flexShrink: 0 }}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="user-profile">
            <div className="avatar">U</div>
            <div>
              <p className="user-name" style={{ color: "var(--text-tertiary)" }}>
                Loading...
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
