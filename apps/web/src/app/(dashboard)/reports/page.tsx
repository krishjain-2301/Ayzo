"use client";
import React, { Suspense, useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ShieldCheck, AlertTriangle } from "lucide-react";

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <p style={{ color: "var(--text-tertiary)", padding: "40px 0" }} className="animate-pulse">
          Loading reports...
        </p>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}

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

function ReportsContent() {
  const searchParams = useSearchParams();
  const campaignIdParam = searchParams.get("campaign");

  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    campaignIdParam
  );
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");

  const loadCampaigns = useCallback(async () => {
    try {
      const data = await apiFetch("/campaigns");
      const completed = data.filter(
        (c: CampaignSummary) =>
          c.status === "completed" || c.status === "failed"
      );
      setCampaigns(completed);
    } catch (e) {
      console.error("Failed to load campaigns", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReport = useCallback(async (campaignId: string) => {
    setReportLoading(true);
    setReportError("");
    setReport(null);
    try {
      const data = await apiFetch(`/reports/campaign/${campaignId}`);
      setReport(data);
    } catch (err: any) {
      setReportError(err.message || "Failed to load report");
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
      case "critical":
      case "high":
        return "var(--red)";
      case "medium":
        return "var(--amber)";
      case "low":
        return "var(--green)";
      default:
        return "var(--text-tertiary)";
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "critical":
      case "high":
        return "danger";
      case "medium":
        return "warning";
      case "low":
        return "success";
      default:
        return "info";
    }
  };

  // Campaign selector view
  if (!selectedCampaignId || !report) {
    return (
      <div className="animate-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Reports</h1>
            <p className="page-description">
              Select a completed campaign to view its vulnerability report.
            </p>
          </div>
        </div>

        {reportLoading && (
          <p
            style={{ color: "var(--text-tertiary)", padding: "20px 0" }}
            className="animate-pulse"
          >
            Loading report...
          </p>
        )}
        {reportError && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              background: "var(--red-soft)",
              color: "var(--red)",
              fontSize: "13px",
              marginBottom: "20px",
            }}
          >
            {reportError}
          </div>
        )}

        {loading ? (
          <p
            style={{ color: "var(--text-tertiary)", padding: "40px 0" }}
            className="animate-pulse"
          >
            Loading campaigns...
          </p>
        ) : campaigns.length === 0 ? (
          <div
            className="surface"
            style={{ textAlign: "center", padding: "60px 0" }}
          >
            <p style={{ color: "var(--text-tertiary)", fontSize: "14px" }}>
              No completed campaigns yet. Run a campaign first to generate a
              report.
            </p>
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="surface surface-hover"
                style={{
                  padding: "20px 24px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onClick={() => setSelectedCampaignId(c.id)}
              >
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: 600 }}>
                    {c.name}
                  </h3>
                  <p
                    style={{
                      color: "var(--text-tertiary)",
                      fontSize: "12px",
                      marginTop: "4px",
                    }}
                  >
                    {c.target_name} ·{" "}
                    {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  {c.risk_score !== null && (
                    <span
                      style={{
                        fontSize: "22px",
                        fontWeight: 700,
                        color: getRiskColor(
                          c.risk_score >= 61
                            ? "high"
                            : c.risk_score >= 41
                              ? "medium"
                              : "low"
                        ),
                      }}
                    >
                      {Math.round(c.risk_score)}
                    </span>
                  )}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
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
    );
  }

  // Full report view
  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Security Assessment Report</h1>
          <p className="page-description">
            {report.target_name} ({report.target_model}) · {report.campaign_name}
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => {
            setSelectedCampaignId(null);
            setReport(null);
          }}
        >
          <ArrowLeft size={15} />
          Back to Reports
        </button>
      </div>

      {/* Summary + Risk Score */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "20px",
          marginBottom: "28px",
        }}
      >
        <div className="surface" style={{ padding: "28px" }}>
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 600,
              marginBottom: "16px",
            }}
          >
            Executive Summary
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "14px",
              lineHeight: 1.7,
              marginBottom: "24px",
            }}
          >
            The target model{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {report.target_name}
            </strong>{" "}
            underwent automated security testing.{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {report.total_failures} vulnerabilities
            </strong>{" "}
            were identified out of {report.total_tests} executed tests (
            {report.overall_failure_rate}% failure rate).
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px",
            }}
          >
            <div className="surface-inset" style={{ padding: "16px" }}>
              <p className="metric-label">Total Tests</p>
              <p style={{ fontSize: "22px", fontWeight: 600 }}>
                {report.total_tests.toLocaleString()}
              </p>
            </div>
            <div className="surface-inset" style={{ padding: "16px" }}>
              <p className="metric-label">Failed</p>
              <p
                style={{
                  fontSize: "22px",
                  fontWeight: 600,
                  color: "var(--red)",
                }}
              >
                {report.total_failures}{" "}
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 400,
                    color: "var(--text-secondary)",
                  }}
                >
                  ({report.overall_failure_rate}%)
                </span>
              </p>
            </div>
            <div className="surface-inset" style={{ padding: "16px" }}>
              <p className="metric-label">Passed</p>
              <p
                style={{
                  fontSize: "22px",
                  fontWeight: 600,
                  color: "var(--green)",
                }}
              >
                {report.total_passes}{" "}
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 400,
                    color: "var(--text-secondary)",
                  }}
                >
                  (
                  {report.total_tests > 0
                    ? (100 - report.overall_failure_rate).toFixed(1)
                    : 0}
                  %)
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Risk Score */}
        <div
          className="surface"
          style={{
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <p className="metric-label" style={{ marginBottom: "16px" }}>
            Overall Risk Score
          </p>
          <p
            style={{
              fontSize: "56px",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              color: getRiskColor(report.risk_level),
              marginBottom: "12px",
            }}
          >
            {Math.round(report.overall_risk_score)}
          </p>
          <span
            className={`badge ${getSeverityBadge(report.risk_level.toLowerCase())}`}
          >
            {report.risk_level} Risk
          </span>
        </div>
      </div>

      {/* Category Breakdown */}
      {report.category_scores.length > 0 && (
        <div
          className="surface"
          style={{ padding: "28px", marginBottom: "28px" }}
        >
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 600,
              marginBottom: "20px",
            }}
          >
            Category Breakdown
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "12px",
            }}
          >
            {report.category_scores.map((cs) => (
              <div
                key={cs.category}
                className="surface-inset"
                style={{
                  padding: "16px",
                  borderLeft: `3px solid ${getRiskColor(cs.severity)}`,
                }}
              >
                <h4
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    marginBottom: "8px",
                  }}
                >
                  {cs.display_name}
                </h4>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-tertiary)",
                    marginBottom: "8px",
                  }}
                >
                  {cs.failures}/{cs.total_tests} failed ({cs.failure_rate}%)
                </p>
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${cs.failure_rate}%`,
                      background: getRiskColor(cs.severity),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Findings */}
      {report.findings.length > 0 && (
        <div>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 600,
              marginBottom: "16px",
            }}
          >
            Detailed Findings
          </h2>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {report.findings.map((f) => (
              <div
                key={f.id}
                className="surface"
                style={{
                  padding: "28px",
                  borderLeft: `3px solid ${getRiskColor(f.severity)}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 600 }}>
                      {f.title}
                    </h3>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--text-tertiary)",
                        marginTop: "4px",
                      }}
                    >
                      {f.category.replace(/_/g, " ")} · Confidence:{" "}
                      {Math.round(f.confidence * 100)}% ·{" "}
                      {f.occurrence_count}/{f.total_tests_in_category} tests
                      failed
                    </p>
                  </div>
                  <span className={`badge ${getSeverityBadge(f.severity)}`}>
                    {f.severity}
                  </span>
                </div>

                <p
                  style={{
                    fontSize: "14px",
                    color: "var(--text-secondary)",
                    lineHeight: 1.7,
                    marginBottom: "20px",
                  }}
                >
                  {f.description}
                </p>

                {/* Evidence */}
                {f.evidence && f.evidence.length > 0 && (
                  <div
                    className="surface-inset"
                    style={{ padding: "20px", marginBottom: "16px" }}
                  >
                    <h4
                      style={{
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--text-tertiary)",
                        marginBottom: "12px",
                      }}
                    >
                      Evidence
                    </h4>
                    {f.evidence.slice(0, 2).map((ev: any, i: number) => (
                      <div
                        key={i}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "12px",
                          marginBottom: i < 1 ? "12px" : 0,
                        }}
                      >
                        <div>
                          <p
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "var(--accent)",
                              marginBottom: "6px",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            Attack Prompt
                          </p>
                          <div className="code-block" style={{ maxHeight: "100px", overflowY: "auto" }}>
                            {ev.prompt || "N/A"}
                          </div>
                        </div>
                        <div>
                          <p
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "var(--red)",
                              marginBottom: "6px",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            Model Response
                          </p>
                          <div
                            className="code-block"
                            style={{
                              maxHeight: "100px",
                              overflowY: "auto",
                              borderColor: "rgba(239,68,68,0.15)",
                            }}
                          >
                            {ev.response || "N/A"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Remediation */}
                {f.remediation && (
                  <div>
                    <h4
                      style={{
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--text-tertiary)",
                        marginBottom: "8px",
                      }}
                    >
                      Remediation
                    </h4>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                        lineHeight: 1.7,
                        whiteSpace: "pre-line",
                      }}
                    >
                      {f.remediation}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {report.findings.length === 0 && (
        <div
          className="surface"
          style={{
            textAlign: "center",
            padding: "48px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <ShieldCheck size={32} style={{ color: "var(--green)" }} />
          <h3 style={{ fontSize: "16px", color: "var(--green)" }}>
            No Vulnerabilities Found
          </h3>
          <p
            style={{
              color: "var(--text-tertiary)",
              fontSize: "14px",
            }}
          >
            The model passed all tests with no detected weaknesses.
          </p>
        </div>
      )}
    </div>
  );
}
