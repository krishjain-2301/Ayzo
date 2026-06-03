export function Header() {
  return (
    <header className="header glass-panel">
      <div className="header-search">
        <span className="search-icon">🔍</span>
        <input 
          type="text" 
          placeholder="Search campaigns, targets, or vulnerabilities..." 
          className="search-input"
        />
      </div>
      
      <div className="header-actions">
        <button className="icon-btn">
          <span className="icon">🔔</span>
          <span className="notification-dot"></span>
        </button>
        <button className="icon-btn">
          <span className="icon">⚙️</span>
        </button>
        <button className="btn-primary">
          + New Campaign
        </button>
      </div>
    </header>
  );
}
