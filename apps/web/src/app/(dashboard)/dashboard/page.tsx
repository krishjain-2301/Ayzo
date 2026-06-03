export default function Dashboard() {
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">Overview of your AI security posture and recent testing activity.</p>
        </div>
        <button className="btn-primary">
          Run Assessment
        </button>
      </div>

      {/* Top Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <p className="text-secondary" style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Overall Risk Score
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
            <span style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1 }} className="text-gradient">72</span>
            <span className="badge danger" style={{ marginBottom: '0.5rem' }}>High Risk</span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '1rem' }}>
            Based on 4 recent campaigns
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <p className="text-secondary" style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Vulnerabilities Found
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
            <span style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1 }}>18</span>
            <span style={{ color: 'var(--status-danger)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>+3 this week</span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '1rem' }}>
            Across 3 target models
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <p className="text-secondary" style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Tests Executed
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
            <span style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1 }}>1,240</span>
            <span style={{ color: 'var(--status-success)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              82% pass rate
            </span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '1rem' }}>
            In the last 30 days
          </p>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        
        {/* Recent Campaigns */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem' }}>Recent Campaigns</h3>
            <a href="/campaigns" style={{ fontSize: '0.875rem', fontWeight: 500 }}>View All &rarr;</a>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { name: "Customer Support Bot Assess", target: "GPT-4 Support", status: "completed", date: "Today, 10:45 AM", failRate: "12%", risk: "Medium" },
              { name: "Internal Knowledge Base", target: "Claude 3 Sonnet", status: "completed", date: "Yesterday", failRate: "0%", risk: "Low" },
              { name: "Code Assistant Copilot", target: "Llama-3 70B", status: "completed", date: "Jun 01", failRate: "34%", risk: "High" },
            ].map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <h4 style={{ fontWeight: 600 }}>{c.name}</h4>
                  <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>Target: {c.target} • {c.date}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{c.failRate} Failure</p>
                    <span className={`badge ${c.risk === 'High' ? 'danger' : c.risk === 'Medium' ? 'warning' : 'success'}`} style={{ marginTop: '0.25rem' }}>
                      {c.risk} Risk
                    </span>
                  </div>
                  <button className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>Report</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Vulnerabilities */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Top Vulnerabilities</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {[
              { name: "Prompt Injection", count: 8, severity: "Critical" },
              { name: "Data Leakage", count: 5, severity: "High" },
              { name: "System Prompt Leak", count: 3, severity: "Medium" },
              { name: "Role Override", count: 2, severity: "High" },
            ].map((v, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: v.severity === 'Critical' ? 'var(--status-danger)' : v.severity === 'High' ? '#f97316' : 'var(--status-warning)' }}></div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 500, fontSize: '0.9rem' }}>{v.name}</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 600 }}>
                  {v.count} found
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
