export default function CampaignsPage() {
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-description">Run and monitor automated security tests against your AI targets.</p>
        </div>
        <button className="btn-primary">
          + New Campaign
        </button>
      </div>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-strong)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Campaign Name</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Target</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Status</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Progress</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Risk Score</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Running Campaign */}
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <td style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ fontWeight: 500 }}>Nightly Deep Scan</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Started 10 mins ago</div>
              </td>
              <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-secondary)' }}>Customer Support Bot</td>
              <td style={{ padding: '1.25rem 1.5rem' }}><span className="badge info animate-pulse-glow">Running</span></td>
              <td style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ flex: 1, height: '6px', background: 'var(--bg-surface-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '45%', height: '100%', background: 'var(--accent-primary)', borderRadius: '3px' }}></div>
                  </div>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>45%</span>
                </div>
              </td>
              <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-secondary)' }}>--</td>
              <td style={{ padding: '1.25rem 1.5rem' }}>
                <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>Stop</button>
              </td>
            </tr>

            {/* Completed Campaign 1 */}
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <td style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ fontWeight: 500 }}>Pre-release Assessment</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Completed Jun 01</div>
              </td>
              <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-secondary)' }}>Internal Knowledge Base</td>
              <td style={{ padding: '1.25rem 1.5rem' }}><span className="badge success">Completed</span></td>
              <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-secondary)' }}>100% (250 tests)</td>
              <td style={{ padding: '1.25rem 1.5rem' }}><span className="text-gradient" style={{ fontWeight: 700 }}>12</span> (Low)</td>
              <td style={{ padding: '1.25rem 1.5rem' }}>
                <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>View Report</button>
              </td>
            </tr>

            {/* Completed Campaign 2 */}
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <td style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ fontWeight: 500 }}>Role Override Check</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Completed May 28</div>
              </td>
              <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-secondary)' }}>Code Assistant Copilot</td>
              <td style={{ padding: '1.25rem 1.5rem' }}><span className="badge success">Completed</span></td>
              <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-secondary)' }}>100% (850 tests)</td>
              <td style={{ padding: '1.25rem 1.5rem' }}><span style={{ color: 'var(--status-danger)', fontWeight: 700 }}>78</span> (High)</td>
              <td style={{ padding: '1.25rem 1.5rem' }}>
                <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>View Report</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
