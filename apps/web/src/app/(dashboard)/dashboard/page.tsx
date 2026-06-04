"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { RunAssessmentModal } from '@/components/RunAssessmentModal';

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetName, setTargetName] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
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
      setTargetName(dummy.name);

      // 2. Fetch campaigns
      const camps = await apiFetch('/campaigns');
      setCampaigns(camps);
    } catch (e) {
      console.error("Failed to load dashboard data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto refresh every 3 seconds while campaigns might be running
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

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
        targetName={targetName}
        onSuccess={loadData}
      />

      {/* Top Metrics Row */}
      <div className="grid grid-auto-fit gap-6 mb-8">
        <div className="glass-panel p-6">
          <p className="text-secondary text-sm font-semibold uppercase mb-2">
            Overall Risk Score
          </p>
          <div className="flex items-end gap-4">
            <span className="text-5xl font-bold leading-none text-gradient">
              {campaigns.length > 0 ? Math.round(campaigns[0].risk_score || 0) : 0}
            </span>
            <span className="badge warning mb-2">Dynamic</span>
          </div>
          <p className="text-muted text-sm mt-4">
            Based on {campaigns.length} campaigns
          </p>
        </div>

        <div className="glass-panel p-6">
          <p className="text-secondary text-sm font-semibold uppercase mb-2">
            Tests Executed
          </p>
          <div className="flex items-end gap-4">
            <span className="text-5xl font-bold leading-none">
              {campaigns.reduce((acc, c) => acc + (c.total_tests || 0), 0)}
            </span>
          </div>
          <p className="text-muted text-sm mt-4">
            Total prompts sent to models
          </p>
        </div>
      </div>

      <div className="grid grid-2-cols gap-6">
        {/* Recent Campaigns */}
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">Recent Campaigns</h3>
          </div>
          
          <div className="flex flex-col gap-4">
            {loading && campaigns.length === 0 ? (
              <p>Loading campaigns...</p>
            ) : campaigns.length === 0 ? (
              <div className="text-center p-8 bg-glass-dark rounded-md">
                <p className="text-muted mb-4">No campaigns found.</p>
                <button className="btn-secondary" onClick={() => setIsModalOpen(true)}>Run your first test!</button>
              </div>
            ) : (
              campaigns.map((c) => (
                <div key={c.id} className="flex justify-between items-center p-4 bg-glass-dark rounded-sm">
                  <div>
                    <h4 className="font-semibold">{c.name}</h4>
                    <p className="text-muted text-sm mt-2">Target: {c.target_name}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {c.status === 'running' ? 'Running...' : `${c.failed_tests || 0} Failed`}
                      </p>
                      <span className={`badge mt-2 ${c.status === 'completed' ? 'success' : c.status === 'failed' ? 'danger' : 'warning'}`}>
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
        <div className="glass-panel p-6">
          <h3 className="text-xl font-semibold mb-6">Common Risks</h3>
          <p className="text-muted text-sm">
            We'll populate this with your actual vulnerabilities once more data is collected.
          </p>
        </div>
      </div>
    </div>
  );
}
