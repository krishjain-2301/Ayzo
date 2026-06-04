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
        <div className="page-header mb-6">
          <div>
            <h1 className="page-title">Reports</h1>
            <p className="page-description">Select a completed campaign to view its vulnerability report.</p>
          </div>
        </div>

        {reportLoading && <p className="text-muted p-8">Loading report...</p>}
        {reportError && <div className="badge danger p-4 mb-4 block">{reportError}</div>}

        {loading ? (
          <p className="text-muted p-8">Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <p className="text-muted">No completed campaigns yet. Run a campaign first to generate a report.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="glass-panel p-6 cursor-pointer hover:-translate-y-1 transition-all"
                onClick={() => setSelectedCampaignId(c.id)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">{c.name}</h3>
                    <p className="text-muted text-sm mt-2">
                      Target: {c.target_name} • {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {c.risk_score !== null && (
                      <span className="text-2xl font-bold" style={{ color: getRiskColor(c.risk_score >= 61 ? 'high' : c.risk_score >= 41 ? 'medium' : 'low') }}>
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
      <div className="page-header mb-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="page-title text-3xl">Security Assessment Report</h1>
            <span className="badge warning">Confidential</span>
          </div>
          <p className="page-description">{report.target_name} ({report.target_model}) • {report.campaign_name}</p>
        </div>
        <div className="flex gap-4">
          <button className="btn-secondary" onClick={() => { setSelectedCampaignId(null); setReport(null); }}>← Back to Reports</button>
        </div>
      </div>

      <div className="grid grid-2-cols gap-6 mb-8">
        {/* Main Exec Summary */}
        <div className="glass-panel p-8">
          <h2 className="text-xl mb-4">Executive Summary</h2>
          <p className="text-secondary mb-6" style={{ lineHeight: 1.7 }}>
            The target model <strong className="text-primary font-bold">{report.target_name}</strong> underwent automated security testing.
            A total of <strong className="text-primary font-bold">{report.total_failures} vulnerabilities</strong> were identified out of {report.total_tests} executed tests
            ({report.overall_failure_rate}% failure rate).
          </p>

          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="bg-glass-dark p-4 rounded-sm">
              <p className="text-muted text-xs uppercase mb-2">Total Tests</p>
              <p className="text-2xl font-semibold">{report.total_tests.toLocaleString()}</p>
            </div>
            <div className="bg-glass-dark p-4 rounded-sm">
              <p className="text-muted text-xs uppercase mb-2">Failed (Vulnerable)</p>
              <p className="text-2xl font-semibold text-danger" style={{ color: 'var(--status-danger)' }}>
                {report.total_failures} <span className="text-sm font-normal">({report.overall_failure_rate}%)</span>
              </p>
            </div>
            <div className="bg-glass-dark p-4 rounded-sm">
              <p className="text-muted text-xs uppercase mb-2">Passed (Secure)</p>
              <p className="text-2xl font-semibold text-success" style={{ color: 'var(--status-success)' }}>
                {report.total_passes} <span className="text-sm font-normal">({report.total_tests > 0 ? (100 - report.overall_failure_rate).toFixed(1) : 0}%)</span>
              </p>
            </div>
          </div>
        </div>

        {/* Risk Score */}
        <div className="glass-panel p-8 flex flex-col items-center justify-center text-center">
          <p className="text-secondary text-sm uppercase tracking-wide mb-4">Overall Risk Score</p>
          <div className="flex items-center justify-center mb-4 rounded-full" style={{
            width: '150px', height: '150px',
            background: `radial-gradient(circle, ${getRiskColor(report.risk_level)}15 0%, transparent 70%)`,
            border: `8px solid ${getRiskColor(report.risk_level)}`,
            boxShadow: `0 0 30px ${getRiskColor(report.risk_level)}33`
          }}>
            <span className="text-5xl font-bold text-primary" style={{ color: 'white' }}>{Math.round(report.overall_risk_score)}</span>
          </div>
          <h3 className="text-xl font-semibold" style={{ color: getRiskColor(report.risk_level) }}>{report.risk_level} Risk</h3>
        </div>
      </div>

      {/* Category Breakdown */}
      {report.category_scores.length > 0 && (
        <div className="glass-panel p-8 mb-8">
          <h2 className="text-xl mb-6">Category Breakdown</h2>
          <div className="grid grid-auto-fit gap-4">
            {report.category_scores.map((cs) => (
              <div key={cs.category} className="bg-glass-dark p-4 rounded-sm" style={{ borderLeft: `3px solid ${getRiskColor(cs.severity)}` }}>
                <h4 className="text-sm font-semibold mb-2">{cs.display_name}</h4>
                <p className="text-muted text-xs">
                  {cs.failures}/{cs.total_tests} failed ({cs.failure_rate}%)
                </p>
                <div className="mt-2 bg-glass-dark rounded-sm overflow-hidden" style={{ height: '4px' }}>
                  <div className="h-full rounded-sm" style={{ width: `${cs.failure_rate}%`, background: getRiskColor(cs.severity) }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Findings */}
      {report.findings.length > 0 && (
        <>
          <h2 className="text-2xl mb-4">Detailed Findings</h2>
          {report.findings.map((f) => (
            <div key={f.id} className="glass-panel p-8 mb-6" style={{ borderLeft: `4px solid ${getRiskColor(f.severity)}` }}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                  <p className="text-secondary text-sm">
                    Category: {f.category.replace(/_/g, ' ')} • Confidence: {Math.round(f.confidence * 100)}% • {f.occurrence_count}/{f.total_tests_in_category} tests failed
                  </p>
                </div>
                <span className={`badge ${getSeverityBadge(f.severity)}`}>{f.severity} Severity</span>
              </div>
              
              <p className="text-primary mb-6 leading-relaxed">{f.description}</p>

              {/* Evidence */}
              {f.evidence && f.evidence.length > 0 && (
                <div className="bg-glass-dark p-6 rounded-sm mb-6">
                  <h4 className="text-sm uppercase text-muted mb-3">Evidence (Sample)</h4>
                  {f.evidence.slice(0, 2).map((ev: any, i: number) => (
                    <div key={i} className={`grid grid-2-cols gap-4 ${i < 1 ? 'mb-4' : ''}`}>
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--accent-primary)' }}>ATTACK PROMPT</p>
                        <div className="p-3 rounded-sm text-xs font-mono overflow-y-auto" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', color: '#e4e4e7', maxHeight: '100px' }}>
                          {ev.prompt || 'N/A'}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--status-danger)' }}>MODEL RESPONSE</p>
                        <div className="p-3 rounded-sm text-xs font-mono overflow-y-auto" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', color: '#e4e4e7', maxHeight: '100px' }}>
                          {ev.response || 'N/A'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {f.remediation && (
                <>
                  <h4 className="text-sm uppercase text-muted mb-3">Remediation</h4>
                  <div className="pl-2 text-secondary text-sm whitespace-pre-line" style={{ lineHeight: 1.8 }}>
                    {f.remediation}
                  </div>
                </>
              )}
            </div>
          ))}
        </>
      )}

      {report.findings.length === 0 && (
        <div className="glass-panel p-8 text-center">
          <h3 className="mb-2" style={{ color: 'var(--status-success)' }}>✅ No Vulnerabilities Found</h3>
          <p className="text-muted">The model passed all tests with no detected weaknesses.</p>
        </div>
      )}
    </div>
  );
}
