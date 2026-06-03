export default function TargetsPage() {
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Targets</h1>
          <p className="page-description">Manage the AI models you want to test for vulnerabilities.</p>
        </div>
        <button className="btn-primary">
          + Add Target
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Target Card 1 */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Customer Support Bot</h3>
              <p className="text-muted" style={{ fontSize: '0.875rem' }}>OpenAI • gpt-4-turbo</p>
            </div>
            <span className="badge success">Active</span>
          </div>
          
          <div style={{ flex: 1, marginBottom: '1.5rem' }}>
            <p className="text-secondary" style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              The main customer-facing chatbot on our website. Handles refunds, queries, and support tickets.
            </p>
          </div>

          <div style={{ display: 'flex', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Last tested: 2 days ago
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}>Configure</button>
              <button className="btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}>Test</button>
            </div>
          </div>
        </div>

        {/* Target Card 2 */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Internal Knowledge Base</h3>
              <p className="text-muted" style={{ fontSize: '0.875rem' }}>Anthropic • claude-3-sonnet</p>
            </div>
            <span className="badge success">Active</span>
          </div>
          
          <div style={{ flex: 1, marginBottom: '1.5rem' }}>
            <p className="text-secondary" style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              Internal HR and technical documentation assistant for employees. Has access to confidential policies.
            </p>
          </div>

          <div style={{ display: 'flex', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Last tested: 1 week ago
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}>Configure</button>
              <button className="btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}>Test</button>
            </div>
          </div>
        </div>

        {/* Target Card 3 */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Code Assistant Copilot</h3>
              <p className="text-muted" style={{ fontSize: '0.875rem' }}>Ollama • llama3.2</p>
            </div>
            <span className="badge danger">Offline</span>
          </div>
          
          <div style={{ flex: 1, marginBottom: '1.5rem' }}>
            <p className="text-secondary" style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              Local coding assistant. Testing for prompt injection vulnerabilities before deploying to the dev team.
            </p>
          </div>

          <div style={{ display: 'flex', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-danger)' }}>
              Connection failed
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}>Configure</button>
              <button className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}>Retry</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
