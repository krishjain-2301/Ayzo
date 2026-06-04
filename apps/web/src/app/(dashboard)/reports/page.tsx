"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useSearchParams } from 'next/navigation';

interface CampaignSummary {
  id: string;
  name: string;
  target_name: string;
  status: string;
  risk_score: number | null;
  created_at: string;
}

interface Finding {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: string;
  confidence: number;
  occurrence_count: number;
  total_tests_in_category: number;
  failure_rate: number;
  remediation: string | null;
  evidence: any[];
}

interface CategoryScore {
  category: string;
  display_name: string;
  total_tests: number;
  failures: number;
  failure_rate: number;
  severity: string;
  score: number;
}

interface Report {
  id: string;
  campaign_id: string;
  campaign_name: string;
  target_name: string;
  target_model: string;
  overall_risk_score: number;
  risk_level: string;
  total_tests: number;
  total_failures: number;
  total_passes: number;
  overall_failure_rate: number;
  category_scores: CategoryScore[];
  findings: Finding[];
  generated_at: string;
  campaign_started_at: string | null;
  campaign_completed_at: string | null;
}

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const campaignIdParam = searchParams.get('campaign');

  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(campaignIdParam);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  const loadCampaigns = useCallback(async () => {
    try {
      const data = await apiFetch('/campaigns');
      const completed = data.filter((c: CampaignSummary) => c.status === 'completed' || c.status === 'failed');
      setCampaigns(completed);
    } catch (e) {
      console.error("Failed to load campaigns", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReport = useCallback(async (campaignId: string) => {
    setReportLoading(true);
    setReportError('');
    setReport(null);
    try {
      const data = await apiFetch(`/reports/campaign/${campaignId}`);
      setReport(data);
    } catch (err: any) {
      setReportError(err.message || 'Failed to load report');
    } finally {
      setReportLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (selectedCampaignId) {
      loadReport(selectedCampaignId);
    }
  }, [selectedCampaignId, loadReport]);

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'critical': return 'var(--status-danger)';
      case 'high': return 'var(--status-danger)';
      case 'medium': return 'var(--status-warning)';
      case 'low': return 'var(--status-success)';
      default: return 'var(--text-muted)';
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical': case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'info';
    }
  };

  // If no report is selected, show campaign list
  if (!selectedCampaignId || !report) {
    return (
      <div className="animate-fade-in">
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <div>
            <h1 className="page-title">Reports</h1>
            <p className="page-description">Select a completed campaign to view its vulnerability report.</p>
          </div>
        </div>

        {reportLoading && <p className="text-muted" style={{ padding: '2rem' }}>Loading report...</p>}
        {reportError && <div className="badge danger" style={{ padding: '1rem', marginBottom: '1rem', display: 'block' }}>{reportError}</div>}

        {loading ? (
          <p className="text-muted" style={{ padding: '2rem' }}>Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
            <p className="text-muted">No completed campaigns yet. Run a campaign first to generate a report.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="glass-panel"
                style={{ padding: '1.5rem', cursor: 'pointer', transition: 'all 150ms' }}
                onClick={() => setSelectedCampaignId(c.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{c.name}</h3>
                    <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      Target: {c.target_name} • {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {c.risk_score !== null && (
                      <span style={{ fontSize: '1.5rem', fontWeight: 700, color: getRiskColor(c.risk_score >= 61 ? 'high' : c.risk_score >= 41 ? 'medium' : 'low') }}>
                        {Math.round(c.risk_score)}
                      </span>
                    )}
                    <span className={`badge ${c.status === 'completed' ? 'success' : 'danger'}`}>{c.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Show the full report
  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <h1 className="page-title" style={{ fontSize: '1.75rem' }}>Security Assessment Report</h1>
            <span className="badge warning">Confidential</span>
          </div>
          <p className="page-description">{report.target_name} ({report.target_model}) • {report.campaign_name}</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-secondary" onClick={() => { setSelectedCampaignId(null); setReport(null); }}>← Back to Reports</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Main Exec Summary */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Executive Summary</h2>
          <p className="text-secondary" style={{ lineHeight: 1.7, marginBottom: '1.5rem' }}>
            The target model <strong style={{ color: 'white' }}>{report.target_name}</strong> underwent automated security testing.
            A total of <strong style={{ color: 'white' }}>{report.total_failures} vulnerabilities</strong> were identified out of {report.total_tests} executed tests
            ({report.overall_failure_rate}% failure rate).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
              <p className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Tests</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>{report.total_tests.toLocaleString()}</p>
            </div>
            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
              <p className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Failed (Vulnerable)</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--status-danger)' }}>
                {report.total_failures} <span style={{ fontSize: '0.875rem', fontWeight: 400 }}>({report.overall_failure_rate}%)</span>
              </p>
            </div>
            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
              <p className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Passed (Secure)</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--status-success)' }}>
                {report.total_passes} <span style={{ fontSize: '0.875rem', fontWeight: 400 }}>({report.total_tests > 0 ? (100 - report.overall_failure_rate).toFixed(1) : 0}%)</span>
              </p>
            </div>
          </div>
        </div>

        {/* Risk Score */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <p className="text-secondary" style={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Overall Risk Score</p>
          <div style={{
            width: '150px', height: '150px', borderRadius: '50%',
            background: `radial-gradient(circle, ${getRiskColor(report.risk_level)}15 0%, transparent 70%)`,
            border: `8px solid ${getRiskColor(report.risk_level)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem',
            boxShadow: `0 0 30px ${getRiskColor(report.risk_level)}33`
          }}>
            <span style={{ fontSize: '4rem', fontWeight: 700, color: 'white' }}>{Math.round(report.overall_risk_score)}</span>
          </div>
          <h3 style={{ color: getRiskColor(report.risk_level), fontSize: '1.25rem', fontWeight: 600 }}>{report.risk_level} Risk</h3>
        </div>
      </div>

      {/* Category Breakdown */}
      {report.category_scores.length > 0 && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Category Breakdown</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {report.category_scores.map((cs) => (
              <div key={cs.category} style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${getRiskColor(cs.severity)}` }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>{cs.display_name}</h4>
                <p className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {cs.failures}/{cs.total_tests} failed ({cs.failure_rate}%)
                </p>
                <div style={{ marginTop: '0.5rem', height: '4px', background: 'var(--bg-surface-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${cs.failure_rate}%`, height: '100%', background: getRiskColor(cs.severity), borderRadius: '2px' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Findings */}
      {report.findings.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Detailed Findings</h2>
          {report.findings.map((f) => (
            <div key={f.id} className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem', borderLeft: `4px solid ${getRiskColor(f.severity)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>{f.title}</h3>
                  <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
                    Category: {f.category.replace(/_/g, ' ')} • Confidence: {Math.round(f.confidence * 100)}% • {f.occurrence_count}/{f.total_tests_in_category} tests failed
                  </p>
                </div>
                <span className={`badge ${getSeverityBadge(f.severity)}`}>{f.severity} Severity</span>
              </div>
              
              <p className="text-primary" style={{ marginBottom: '1.5rem', lineHeight: 1.6 }}>{f.description}</p>

              {/* Evidence */}
              {f.evidence && f.evidence.length > 0 && (
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Evidence (Sample)</h4>
                  {f.evidence.slice(0, 2).map((ev: any, i: number) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: i < 1 ? '1rem' : 0 }}>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '0.5rem' }}>ATTACK PROMPT</p>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#e4e4e7', maxHeight: '100px', overflowY: 'auto' }}>
                          {ev.prompt || 'N/A'}
                        </div>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--status-danger)', fontWeight: 600, marginBottom: '0.5rem' }}>MODEL RESPONSE</p>
                        <div style={{ background: 'rgba(239,68,68,0.05)', padding: '0.75rem', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#e4e4e7', maxHeight: '100px', overflowY: 'auto' }}>
                          {ev.response || 'N/A'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {f.remediation && (
                <>
                  <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Remediation</h4>
                  <div style={{ paddingLeft: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                    {f.remediation}
                  </div>
                </>
              )}
            </div>
          ))}
        </>
      )}

      {report.findings.length === 0 && (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--status-success)', marginBottom: '0.5rem' }}>✅ No Vulnerabilities Found</h3>
          <p className="text-muted">The model passed all tests with no detected weaknesses.</p>
        </div>
      )}
    </div>
  );
}
