"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

interface CampaignSummary {
  id: string;
  name: string;
  target_name: string;
  status: string;
  total_tests: number;
  failed_tests: number;
  risk_score: number | null;
  progress_percent: number;
  created_at: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCampaigns = useCallback(async () => {
    try {
      const data = await apiFetch('/campaigns');
      setCampaigns(data);
    } catch (e) {
      console.error("Failed to load campaigns", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
    const interval = setInterval(loadCampaigns, 5000);
    return () => clearInterval(interval);
  }, [loadCampaigns]);

  const getRiskColor = (score: number | null) => {
    if (score === null || score === undefined) return 'var(--text-muted)';
    if (score >= 61) return 'var(--status-danger)';
    if (score >= 41) return 'var(--status-warning)';
    return 'var(--status-success)';
  };

  const getRiskLabel = (score: number | null) => {
    if (score === null || score === undefined) return '--';
    if (score >= 81) return 'Critical';
    if (score >= 61) return 'High';
    if (score >= 41) return 'Medium';
    if (score >= 21) return 'Low';
    return 'Info';
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-description">Run and monitor automated security tests against your AI targets.</p>
        </div>
        <Link href="/dashboard">
          <button className="btn-primary">+ New Campaign</button>
        </Link>
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
            {loading && campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading campaigns...
                </td>
              </tr>
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No campaigns found. <Link href="/dashboard" style={{ color: 'var(--accent-primary)' }}>Run your first assessment!</Link>
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {formatDate(c.created_at)}
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-secondary)' }}>{c.target_name}</td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <span className={`badge ${c.status === 'completed' ? 'success' : c.status === 'failed' ? 'danger' : c.status === 'running' ? 'info' : 'warning'} ${c.status === 'running' ? 'animate-pulse-glow' : ''}`}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    {c.status === 'running' || c.status === 'pending' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ flex: 1, height: '6px', background: 'var(--bg-surface-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${c.progress_percent}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '3px', transition: 'width 0.3s' }}></div>
                        </div>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{Math.round(c.progress_percent)}%</span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>
                        100% ({c.total_tests} tests)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    {c.risk_score !== null && c.risk_score !== undefined ? (
                      <>
                        <span style={{ color: getRiskColor(c.risk_score), fontWeight: 700 }}>
                          {Math.round(c.risk_score)}
                        </span>
                        {' '}({getRiskLabel(c.risk_score)})
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>--</span>
                    )}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    {c.status === 'completed' || c.status === 'failed' ? (
                      <Link href={`/reports?campaign=${c.id}`}>
                        <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>View Report</button>
                      </Link>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '0.875rem' }}>In progress...</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
