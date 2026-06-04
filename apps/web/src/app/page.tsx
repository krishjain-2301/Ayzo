import Link from "next/link";
import "./globals.css";

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Navigation */}
      <nav style={{ padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="logo-icon animate-pulse-glow"></div>
          <h1 className="logo-text" style={{ fontSize: '1.5rem' }}>AYZO</h1>
        </div>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <a href="#features" className="nav-link" style={{ background: 'transparent' }}>Features</a>
          <a href="#how-it-works" className="nav-link" style={{ background: 'transparent' }}>How it Works</a>
          <a href="#library" className="nav-link" style={{ background: 'transparent' }}>Attack Library</a>
          <Link href="/login">
            <button className="btn-secondary">Log In</button>
          </Link>
          <Link href="/login">
            <button className="btn-primary">Start Testing &rarr;</button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 2rem', position: 'relative' }}>
        
        {/* Background decorative glow */}
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translate(-50%, -50%)', width: '800px', height: '600px', background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 60%)', zIndex: -1 }}></div>

        <div className="animate-fade-in" style={{ maxWidth: '800px' }}>
          <div className="badge warning" style={{ marginBottom: '2rem', display: 'inline-flex', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
            <span style={{ marginRight: '0.5rem' }}>✨</span> AI Red Teaming Platform
          </div>
          
          <h1 style={{ fontSize: '4.5rem', fontWeight: 700, lineHeight: 1.1, marginBottom: '1.5rem', letterSpacing: '-0.03em' }}>
            Secure your AI models <br />
            <span className="text-gradient">before they ship.</span>
          </h1>
          
          <p className="text-secondary" style={{ fontSize: '1.25rem', lineHeight: 1.6, marginBottom: '3rem', maxWidth: '600px', margin: '0 auto 3rem auto' }}>
            Automated vulnerability assessment for LLMs. Discover prompt injection, data leakage, and role override vulnerabilities in minutes, not weeks.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link href="/login">
              <button className="btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.125rem' }}>
                Run Free Assessment
              </button>
            </Link>
            <a href="https://github.com/krishjain-2301/Ayzo" target="_blank" rel="noopener noreferrer">
              <button className="btn-secondary" style={{ padding: '1rem 2rem', fontSize: '1.125rem' }}>
                View on GitHub
              </button>
            </a>
          </div>
        </div>

        {/* Dashboard Preview / Mockup */}
        <div className="glass-panel animate-fade-in" style={{ marginTop: '5rem', width: '100%', maxWidth: '1000px', height: '400px', padding: '1rem', animationDelay: '0.2s' }}>
          {/* Mockup Header */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', paddingLeft: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }}></div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }}></div>
          </div>
          {/* Mockup Content */}
          <div style={{ width: '100%', height: 'calc(100% - 2rem)', background: 'rgba(0,0,0,0.4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', position: 'relative', overflow: 'hidden' }}>
            {/* Terminal-like output simulation */}
            <div style={{ padding: '1.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: '#a1a1aa' }}>
              <p><span style={{ color: 'var(--accent-primary)' }}>ayzo</span> run --target "customer-bot-v2" --categories "all"</p>
              <br/>
              <p>[*] Loading Attack Library (56 payloads across 7 categories)...</p>
              <p>[*] Mutating payloads (depth=1, variants=5)...</p>
              <p>[*] Generated 336 test cases.</p>
              <p>[*] Starting asynchronous attack execution...</p>
              <br/>
              <p style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ color: 'var(--status-success)' }}>[PASS]</span> Test 1: Basic Instruction Override
              </p>
              <p style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ color: 'var(--status-danger)' }}>[FAIL]</span> Test 2: Base64 Encoded Injection <span style={{ color: 'var(--status-danger)' }}>(Vulnerable)</span>
              </p>
              <p style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ color: 'var(--status-success)' }}>[PASS]</span> Test 3: Evil Twin Persona
              </p>
              <p className="animate-pulse-glow" style={{ marginTop: '1rem', color: 'white', display: 'inline-block' }}>Testing... 45% complete</p>
            </div>
          </div>
        </div>

      </main>

      {/* Simple Footer */}
      <footer style={{ padding: '2rem', textAlign: 'center', borderTop: '1px solid var(--border-strong)', marginTop: '5rem' }}>
        <p className="text-muted" style={{ fontSize: '0.875rem' }}>&copy; 2026 AYZO Security. Open source security for the AI era.</p>
      </footer>
    </div>
  );
}
