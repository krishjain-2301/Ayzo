"use client";
import React, { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { RunAssessmentModal } from "@/components/RunAssessmentModal";
import { Activity, Zap, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetName, setTargetName] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      let targets = await apiFetch("/targets");
      let dummy = targets.find((t: any) => t.name === "Vulnerable Support Bot");

      if (!dummy) {
        dummy = await apiFetch("/targets", {
          method: "POST",
          body: JSON.stringify({
            name: "Vulnerable Support Bot",
            description: "Internal vulnerable dummy target for testing",
            provider: "dummy",
            model_name: "dummy-support-v1",
            endpoint_url: "internal://dummy",
            api_key: "dummy-key",
          }),
        });
      }
      setTargetId(dummy.id);
      setTargetName(dummy.name);

      const camps = await apiFetch("/campaigns");
      setCampaigns(camps);
    } catch (e) {
      console.error("Failed to load dashboard data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const totalTests = campaigns.reduce(
    (acc, c) => acc + (c.total_tests || 0),
    0
  );
  const latestRisk =
    campaigns.length > 0 ? Math.round(campaigns[0].risk_score || 0) : 0;

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-description">
            Your AI security posture and recent testing activity.
          </p>
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

      {/* Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "20px",
          marginBottom: "32px",
        }}
      >
        <div className="surface" style={{ padding: "28px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <p className="metric-label">Risk Score</p>
            <TrendingUp size={16} style={{ color: "var(--text-tertiary)" }} />
          </div>
          <p
            className="metric-value"
            style={{
              color:
                latestRisk >= 61
                  ? "var(--red)"
                  : latestRisk >= 41
                    ? "var(--amber)"
                    : "var(--green)",
            }}
          >
            {latestRisk}
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-tertiary)",
              marginTop: "8px",
            }}
          >
            Based on {campaigns.length} campaign{campaigns.length !== 1 && "s"}
          </p>
        </div>

        <div className="surface" style={{ padding: "28px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <p className="metric-label">Tests Executed</p>
            <Zap size={16} style={{ color: "var(--text-tertiary)" }} />
          </div>
          <p className="metric-value">{totalTests.toLocaleString()}</p>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-tertiary)",
              marginTop: "8px",
            }}
          >
            Total prompts sent to models
          </p>
        </div>

        <div className="surface" style={{ padding: "28px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <p className="metric-label">Active Campaigns</p>
            <Activity size={16} style={{ color: "var(--text-tertiary)" }} />
          </div>
          <p className="metric-value">
            {campaigns.filter((c) => c.status === "running").length}
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-tertiary)",
              marginTop: "8px",
            }}
          >
            Currently in progress
          </p>
        </div>
      </div>

      {/* Recent Campaigns */}
      <div className="surface" style={{ padding: "28px" }}>
        <h3
          style={{
            fontSize: "16px",
            fontWeight: 600,
            marginBottom: "20px",
          }}
        >
          Recent Campaigns
        </h3>

        {loading && campaigns.length === 0 ? (
          <p
            style={{ color: "var(--text-tertiary)", padding: "20px 0" }}
            className="animate-pulse"
          >
            Loading campaigns...
          </p>
        ) : campaigns.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p
              style={{
                color: "var(--text-tertiary)",
                marginBottom: "16px",
                fontSize: "14px",
              }}
            >
              No campaigns yet. Run your first assessment to get started.
            </p>
            <button
              className="btn-secondary btn-sm"
              onClick={() => setIsModalOpen(true)}
            >
              Run your first test
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="surface-inset"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 16px",
                }}
              >
                <div>
                  <p style={{ fontWeight: 500, fontSize: "14px" }}>{c.name}</p>
                  <p
                    style={{
                      color: "var(--text-tertiary)",
                      fontSize: "12px",
                      marginTop: "4px",
                    }}
                  >
                    {c.target_name}
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                  }}
                >
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "13px", fontWeight: 500 }}>
                      {c.status === "running"
                        ? "Running..."
                        : `${c.failed_tests || 0} Failed`}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div className={`status-dot ${c.status}`} />
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        textTransform: "capitalize",
                      }}
                    >
                      {c.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
