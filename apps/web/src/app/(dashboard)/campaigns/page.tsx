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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign? This action cannot be undone.")) return;
    try {
      await apiFetch(`/campaigns/${id}`, { method: 'DELETE' });
      setCampaigns(campaigns.filter((c) => c.id !== id));
    } catch (e) {
      console.error("Failed to delete campaign", e);
      alert("Failed to delete campaign.");
    }
  };

  const getRiskColor = (score: number | null) => {
    if (score === null || score === undefined) return 'text-muted';
    if (score >= 61) return 'text-danger'; // Requires adding text-danger/warning/success if missing, or use inline for dynamic
    if (score >= 41) return 'text-warning';
    return 'text-success';
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
        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="bg-glass-dark" style={{ borderBottom: '1px solid var(--border-strong)' }}>
              <th className="p-4 font-semibold text-secondary text-sm">Campaign Name</th>
              <th className="p-4 font-semibold text-secondary text-sm">Target</th>
              <th className="p-4 font-semibold text-secondary text-sm">Status</th>
              <th className="p-4 font-semibold text-secondary text-sm">Progress</th>
              <th className="p-4 font-semibold text-secondary text-sm">Risk Score</th>
              <th className="p-4 font-semibold text-secondary text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted">
                  Loading campaigns...
                </td>
              </tr>
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted">
                  No campaigns found. <Link href="/dashboard" className="text-gradient">Run your first assessment!</Link>
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="p-4">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted mt-2">
                      {formatDate(c.created_at)}
                    </div>
                  </td>
                  <td className="p-4 text-secondary">{c.target_name}</td>
                  <td className="p-4">
                    <span className={`badge ${c.status === 'completed' ? 'success' : c.status === 'failed' ? 'danger' : c.status === 'running' ? 'info' : 'warning'} ${c.status === 'running' ? 'animate-pulse-glow' : ''}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {c.status === 'running' || c.status === 'pending' ? (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-glass-dark rounded-full overflow-hidden" style={{ height: '6px' }}>
                          <div className="bg-accent-primary rounded-full transition-all" style={{ width: `${c.progress_percent}%`, height: '100%', background: 'var(--accent-primary)' }}></div>
                        </div>
                        <span className="text-sm text-secondary">{Math.round(c.progress_percent)}%</span>
                      </div>
                    ) : (
                      <span className="text-secondary">
                        100% ({c.total_tests} tests)
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {c.risk_score !== null && c.risk_score !== undefined ? (
                      <>
                        <span className="font-bold" style={{ color: c.risk_score >= 61 ? 'var(--status-danger)' : c.risk_score >= 41 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                          {Math.round(c.risk_score)}
                        </span>
                        {' '}({getRiskLabel(c.risk_score)})
                      </>
                    ) : (
                      <span className="text-muted">--</span>
                    )}
                  </td>
                  <td className="p-4 flex gap-2">
                    {c.status === 'completed' || c.status === 'failed' ? (
                      <Link href={`/reports?campaign=${c.id}`}>
                        <button className="btn-secondary py-2 px-4 text-sm">View Report</button>
                      </Link>
                    ) : (
                      <span className="text-muted text-sm">In progress...</span>
                    )}
                    <button className="btn-danger py-2 px-4 text-sm" onClick={() => handleDelete(c.id)}>Delete</button>
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
