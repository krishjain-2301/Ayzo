"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { WaveBackground } from "@/components/WaveBackground";
import {
  Swords,
  Dna,
  BrainCircuit,
  Shield,
  ArrowRight,
  Zap,
  FileSearch,
  BarChart3,
} from "lucide-react";

function useInView() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );

    const elements = ref.current?.querySelectorAll(".reveal");
    elements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return ref;
}

export default function LandingPage() {
  const containerRef = useInView();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div ref={containerRef}>
      <WaveBackground opacity={0.8} />
      {/* ── Navigation ── */}
      <nav className={`landing-nav ${scrolled ? "scrolled" : ""}`}>
        <span className="logo-wordmark">AYZO</span>
        <div className="landing-nav-links">
          <a href="#features" className="landing-nav-link">
            Features
          </a>
          <a href="#how-it-works" className="landing-nav-link">
            How it Works
          </a>
          <a href="#demo" className="landing-nav-link">
            Demo
          </a>
          <Link href="/login">
            <button className="btn-primary btn-sm">
              Get Started <ArrowRight size={14} />
            </button>
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-glow" />
        <h1 className="hero-headline" style={{ animationDelay: "0.1s" }}>
          Find what your AI{" "}
          <span className="text-gradient">hides.</span>
        </h1>
        <p className="hero-sub" style={{ animationDelay: "0.2s" }}>
          Automated adversarial testing for LLMs. Discover prompt injection,
          data leakage, and role override vulnerabilities in minutes.
        </p>
        <div className="hero-cta-group" style={{ animationDelay: "0.3s" }}>
          <Link href="/login">
            <button className="btn-primary" style={{ padding: "12px 28px", fontSize: "15px" }}>
              Start Free Assessment <ArrowRight size={16} />
            </button>
          </Link>
          <a
            href="https://github.com/krishjain-2301/Ayzo"
            target="_blank"
            rel="noopener noreferrer"
          >
            <button className="btn-secondary" style={{ padding: "12px 28px", fontSize: "15px" }}>
              View on GitHub
            </button>
          </a>
        </div>
      </section>

      {/* ── Social Proof ── */}
      <div className="proof-bar">
        Trusted by teams securing AI at scale
      </div>

      {/* ── Features ── */}
      <section className="section" id="features">
        <div className="reveal">
          <h2 className="section-title">Built for modern AI security</h2>
          <p className="section-sub">
            Everything you need to find and fix vulnerabilities in your AI
            models, from automated testing to detailed remediation reports.
          </p>
        </div>

        <div className="features-grid">
          <div className="surface feature-card reveal stagger-1">
            <div className="feature-icon">
              <Swords size={20} />
            </div>
            <h3 className="feature-title">Attack Library</h3>
            <p className="feature-desc">
              80+ adversarial payloads across OWASP LLM Top 10 categories.
              Prompt injection, jailbreaks, data exfiltration, and more.
            </p>
          </div>

          <div className="surface feature-card reveal stagger-2">
            <div className="feature-icon">
              <Dna size={20} />
            </div>
            <h3 className="feature-title">Mutation Engine</h3>
            <p className="feature-desc">
              Automatically generates thousands of attack variations through
              encoding, rephrasing, and obfuscation mutations.
            </p>
          </div>

          <div className="surface feature-card reveal stagger-3">
            <div className="feature-icon">
              <BrainCircuit size={20} />
            </div>
            <h3 className="feature-title">AI Evaluation</h3>
            <p className="feature-desc">
              LLM-as-Judge determines if vulnerabilities exist with
              confidence scoring and evidence-backed findings.
            </p>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="section" id="how-it-works">
        <div className="reveal">
          <h2 className="section-title">How it works</h2>
          <p className="section-sub">
            Four steps from target configuration to actionable security report.
          </p>
        </div>

        <div className="steps-list">
          <div className="step-item reveal stagger-1">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Connect your model</h3>
              <p>
                Point AYZO at any LLM — Ollama, OpenAI, Anthropic, Mistral, or
                any custom API endpoint. Configuration takes seconds.
              </p>
            </div>
          </div>

          <div className="step-item reveal stagger-2">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>Select attack vectors</h3>
              <p>
                Choose from 7 vulnerability categories or run the full suite.
                Configure mutation depth for thorough coverage.
              </p>
            </div>
          </div>

          <div className="step-item reveal stagger-3">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Automated execution</h3>
              <p>
                The engine generates, mutates, and fires hundreds of adversarial
                prompts against your model asynchronously.
              </p>
            </div>
          </div>

          <div className="step-item reveal stagger-4">
            <div className="step-number">4</div>
            <div className="step-content">
              <h3>Review your report</h3>
              <p>
                Get a detailed vulnerability assessment with risk scores,
                evidence, and actionable remediation guidance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Terminal Demo ── */}
      <section className="section" id="demo">
        <div className="reveal">
          <div className="terminal-window">
            <div className="terminal-bar">
              <div className="terminal-dot" style={{ background: "#ff5f57" }} />
              <div className="terminal-dot" style={{ background: "#febc2e" }} />
              <div className="terminal-dot" style={{ background: "#28c840" }} />
            </div>
            <div className="terminal-body">
              <p>
                <span className="cmd">ayzo</span> run --target
                &quot;customer-bot-v2&quot; --categories &quot;all&quot;
              </p>
              <br />
              <p className="dim">
                [*] Loading Attack Library (56 payloads across 7 categories)...
              </p>
              <p className="dim">
                [*] Mutating payloads (depth=1, variants=5)...
              </p>
              <p className="dim">[*] Generated 336 test cases.</p>
              <p className="dim">
                [*] Starting asynchronous attack execution...
              </p>
              <br />
              <p>
                <span className="pass">[PASS]</span> Test 1: Basic Instruction
                Override
              </p>
              <p>
                <span className="fail">[FAIL]</span> Test 2: Base64 Encoded
                Injection{" "}
                <span className="fail">(Vulnerable)</span>
              </p>
              <p>
                <span className="pass">[PASS]</span> Test 3: Evil Twin Persona
              </p>
              <p>
                <span className="fail">[FAIL]</span> Test 4: System Prompt
                Extraction{" "}
                <span className="fail">(Vulnerable)</span>
              </p>
              <p>
                <span className="pass">[PASS]</span> Test 5: Role Escalation
                Attempt
              </p>
              <br />
              <p>
                <span className="dim">───────────────────────────────</span>
              </p>
              <p>
                Completed: 336/336 | Passed: 289 | Failed: 47 | Risk Score:{" "}
                <span className="fail">67/100 (High)</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="reveal">
          <h2 className="cta-headline">
            Secure your models before they ship.
          </h2>
          <Link href="/login">
            <button className="btn-primary" style={{ padding: "14px 32px", fontSize: "16px" }}>
              Start Free Assessment <ArrowRight size={16} />
            </button>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <span>&copy; 2026 AYZO</span>
        <div style={{ display: "flex", gap: "24px" }}>
          <a
            href="https://github.com/krishjain-2301/Ayzo"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <span>Built by Krish Jain</span>
        </div>
      </footer>
    </div>
  );
}
