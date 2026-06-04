"use client";
import React, { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { Plus, Trash2, ExternalLink } from "lucide-react";

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
      const data = await apiFetch("/campaigns");
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
    if (
      !confirm(
        "Are you sure you want to delete this campaign? This action cannot be undone."
      )
    )
      return;
    try {
      await apiFetch(`/campaigns/${id}`, { method: "DELETE" });
      setCampaigns(campaigns.filter((c) => c.id !== id));
    } catch (e) {
      console.error("Failed to delete campaign", e);
      alert("Failed to delete campaign.");
    }
  };

  const getRiskLabel = (score: number | null) => {
    if (score === null || score === undefined) return "--";
    if (score >= 81) return "Critical";
    if (score >= 61) return "High";
    if (score >= 41) return "Medium";
    if (score >= 21) return "Low";
    return "Info";
  };

  const getRiskColor = (score: number | null) => {
    if (score === null || score === undefined) return "var(--text-tertiary)";
    if (score >= 61) return "var(--red)";
    if (score >= 41) return "var(--amber)";
    return "var(--green)";
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-description">
            Run and monitor automated security tests against your AI targets.
          </p>
        </div>
        <Link href="/dashboard">
          <button className="btn-primary">
            <Plus size={15} />
            New Campaign
          </button>
        </Link>
      </div>

      <div className="surface" style={{ overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Target</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Risk</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && campaigns.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: "center",
                    padding: "40px 16px",
                    color: "var(--text-tertiary)",
                  }}
                >
                  <span className="animate-pulse">Loading campaigns...</span>
                </td>
              </tr>
            ) : campaigns.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: "center",
                    padding: "40px 16px",
                    color: "var(--text-tertiary)",
                  }}
                >
                  No campaigns found.{" "}
                  <Link
                    href="/dashboard"
                    style={{ color: "var(--accent)", fontWeight: 500 }}
                  >
                    Run your first assessment
                  </Link>
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text-tertiary)",
                        marginTop: "4px",
                      }}
                    >
                      {formatDate(c.created_at)}
                    </div>
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>
                    {c.target_name}
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <div
                        className={`status-dot ${c.status}`}
                        style={
                          c.status === "running"
                            ? { animation: "pulse 2s ease infinite" }
                            : {}
                        }
                      />
                      <span
                        style={{
                          fontSize: "13px",
                          textTransform: "capitalize",
                        }}
                      >
                        {c.status}
                      </span>
                    </div>
                  </td>
                  <td>
                    {c.status === "running" || c.status === "pending" ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <div
                          className="progress-bar"
                          style={{ flex: 1, maxWidth: "120px" }}
                        >
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${c.progress_percent}%`,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {Math.round(c.progress_percent)}%
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                        {c.total_tests} tests
                      </span>
                    )}
                  </td>
                  <td>
                    {c.risk_score !== null && c.risk_score !== undefined ? (
                      <span
                        style={{
                          fontWeight: 600,
                          color: getRiskColor(c.risk_score),
                        }}
                      >
                        {Math.round(c.risk_score)}{" "}
                        <span
                          style={{
                            fontWeight: 400,
                            fontSize: "12px",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {getRiskLabel(c.risk_score)}
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-tertiary)" }}>--</span>
                    )}
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "flex-end",
                      }}
                    >
                      {(c.status === "completed" || c.status === "failed") && (
                        <Link href={`/reports?campaign=${c.id}`}>
                          <button className="btn-ghost btn-sm">
                            <ExternalLink size={13} />
                            Report
                          </button>
                        </Link>
                      )}
                      <button
                        className="btn-ghost btn-sm"
                        style={{ color: "var(--red)" }}
                        onClick={() => handleDelete(c.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
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
