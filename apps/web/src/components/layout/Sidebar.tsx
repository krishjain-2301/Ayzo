import Link from "next/link";

export function Sidebar() {
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
        <div className="user-profile">
          <div className="avatar">A</div>
          <div className="user-info">
            <p className="user-name">Analyst</p>
            <p className="user-role">Security Team</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
