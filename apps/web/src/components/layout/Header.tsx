"use client";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Search, Bell, Settings, Plus, User, LogOut, ShieldAlert, Zap } from "lucide-react";

export function Header() {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const notifRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="header">
      <div className="header-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search campaigns, targets..."
          className="search-input"
        />
      </div>

      <div className="header-actions">
        <div ref={notifRef} style={{ position: "relative" }}>
          <button 
            className="icon-btn" 
            title="Notifications"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={18} />
            <span className="notification-dot" />
          </button>
          
          {showNotifications && (
            <div className="popover surface animate-in" style={{ width: "320px" }}>
              <div style={{ padding: "16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 600 }}>Notifications</h3>
                <span style={{ fontSize: "12px", color: "var(--accent)", cursor: "pointer" }}>Mark all read</span>
              </div>
              <div style={{ maxHeight: "300px", overflowY: "auto", padding: "8px" }}>
                <div className="popover-item" style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "12px" }}>
                  <div style={{ background: "var(--red-soft)", color: "var(--red)", padding: "8px", borderRadius: "8px" }}>
                    <ShieldAlert size={16} />
                  </div>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 500 }}>Critical vulnerability found</p>
                    <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>Vulnerable Support Bot failed 34 tests.</p>
                    <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "6px" }}>10 minutes ago</p>
                  </div>
                </div>
                <div className="popover-item" style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "12px" }}>
                  <div style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "8px", borderRadius: "8px" }}>
                    <Zap size={16} />
                  </div>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 500 }}>Campaign Completed</p>
                    <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>Weekly Security Scan finished successfully.</p>
                    <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "6px" }}>2 hours ago</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div ref={settingsRef} style={{ position: "relative" }}>
          <button 
            className="icon-btn" 
            title="Settings"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings size={18} />
          </button>

          {showSettings && (
            <div className="popover surface animate-in" style={{ width: "200px" }}>
              <div style={{ padding: "8px" }}>
                <button className="popover-item" style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px", border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: "13px", textAlign: "left", borderRadius: "var(--radius-sm)" }}>
                  <User size={16} /> Account Profile
                </button>
                <button className="popover-item" style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px", border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: "13px", textAlign: "left", borderRadius: "var(--radius-sm)" }}>
                  <Settings size={16} /> Workspace Settings
                </button>
                <div style={{ height: "1px", background: "var(--border)", margin: "8px 0" }} />
                <button 
                  className="popover-item" 
                  onClick={() => {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    router.push("/login");
                  }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px", border: "none", background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: "13px", textAlign: "left", borderRadius: "var(--radius-sm)" }}
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          className="btn-primary btn-sm"
          onClick={() => router.push("/dashboard")}
        >
          <Plus size={15} />
          New Campaign
        </button>
      </div>
    </header>
  );
}
