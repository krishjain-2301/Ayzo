"use client";
import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { RunAssessmentModal } from '@/components/RunAssessmentModal';

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      // 1. Ensure Dummy Target exists
      let targets = await apiFetch('/targets');
      let dummy = targets.find((t: any) => t.name === "Vulnerable Support Bot");
      
      if (!dummy) {
        dummy = await apiFetch('/targets', {
          method: 'POST',
          body: JSON.stringify({
            name: "Vulnerable Support Bot",
            description: "Internal vulnerable dummy target for testing",
            provider: "dummy",
            model_name: "dummy-support-v1",
            endpoint_url: "internal://dummy",
            api_key: "dummy-key"
          })
        });
      }
      setTargetId(dummy.id);

      // 2. Fetch campaigns
      const camps = await apiFetch('/campaigns');
      setCampaigns(camps);
    } catch (e) {
      console.error("Failed to load dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto refresh every 3 seconds while campaigns might be running
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">Overview of your AI security posture and recent testing activity.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          Run Assessment
        </button>
      </div>

      <RunAssessmentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        targetId={targetId}
        onSuccess={loadData}
      />

      {/* Top Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <p className="text-secondary" style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Overall Risk Score
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
            <span style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1 }} className="text-gradient">
              {campaigns.length > 0 ? Math.round(campaigns[0].risk_score || 0) : 0}
            </span>
            <span className="badge warning" style={{ marginBottom: '0.5rem' }}>Dynamic</span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '1rem' }}>
            Based on {campaigns.length} campaigns
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <p className="text-secondary" style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Tests Executed
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
            <span style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1 }}>
              {campaigns.reduce((acc, c) => acc + (c.total_tests || 0), 0)}
            </span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '1rem' }}>
            Total prompts sent to models
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Recent Campaigns */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem' }}>Recent Campaigns</h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {loading && campaigns.length === 0 ? (
              <p>Loading campaigns...</p>
            ) : campaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                <p className="text-muted" style={{ marginBottom: '1rem' }}>No campaigns found.</p>
                <button className="btn-secondary" onClick={() => setIsModalOpen(true)}>Run your first test!</button>
              </div>
            ) : (
              campaigns.map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <h4 style={{ fontWeight: 600 }}>{c.name}</h4>
                    <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>Target: {c.target_name}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {c.status === 'running' ? 'Running...' : `${c.failed_tests || 0} Failed`}
                      </p>
                      <span className={`badge ${c.status === 'completed' ? 'success' : c.status === 'failed' ? 'danger' : 'warning'}`} style={{ marginTop: '0.25rem' }}>
                        {c.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Vulnerabilities */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Common Risks</h3>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            We'll populate this with your actual vulnerabilities once more data is collected.
          </p>
        </div>
      </div>
    </div>
  );
}
