"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export function Sidebar() {
  const [user, setUser] = useState<{name?: string, email?: string, avatar_url?: string, role?: string} | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-icon animate-pulse-glow"></div>
          <h1 className="logo-text">AYZO</h1>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        <div className="nav-group">
          <p className="nav-group-title">Overview</p>
          <Link href="/dashboard" className="nav-link active">
            <span className="nav-icon">📊</span>
            Dashboard
          </Link>
          <Link href="/targets" className="nav-link">
            <span className="nav-icon">🎯</span>
            AI Targets
          </Link>
        </div>

        <div className="nav-group">
          <p className="nav-group-title">Testing</p>
          <Link href="/campaigns" className="nav-link">
            <span className="nav-icon">⚔️</span>
            Campaigns
          </Link>
          <Link href="/reports" className="nav-link">
            <span className="nav-icon">📄</span>
            Reports
          </Link>
          <Link href="/library" className="nav-link">
            <span className="nav-icon">📚</span>
            Attack Library
          </Link>
        </div>
      </nav>

      <div className="sidebar-footer">
        {user ? (
          <div className="user-profile">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="Avatar" className="avatar" />
            ) : (
              <div className="avatar">{user.name ? user.name[0] : 'U'}</div>
            )}
            <div className="user-info">
              <p className="user-name">{user.name || 'User'}</p>
              <p className="user-role">{user.role === 'admin' ? 'Administrator' : 'Analyst'}</p>
            </div>
          </div>
        ) : (
          <div className="user-profile">
            <div className="avatar">U</div>
            <div className="user-info">
              <p className="user-name">Loading...</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
