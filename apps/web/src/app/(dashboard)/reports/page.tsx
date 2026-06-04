"use client";
import React, { Suspense, useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, AlertTriangle, AlertCircle, TrendingUp } from "lucide-react";
import clsx from "clsx";

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <p className="text-zinc-500 py-10 animate-pulse text-center">Loading reports...</p>
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignIdParam = searchParams.get("campaign_id");

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
        return "text-red-500";
      case "medium":
        return "text-amber-500";
      case "low":
        return "text-green-500";
      default:
        return "text-zinc-500";
    }
  };

  const getSeverityBadgeColor = (sev: string) => {
    switch (sev) {
      case "critical":
      case "high":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "medium":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "low":
        return "bg-green-500/10 text-green-400 border-green-500/20";
      default:
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    }
  };

  if (!selectedCampaignId || !report) {
    return (
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-white tracking-tight">Reports</h1>
          <p className="text-zinc-400 text-sm mt-1">Select a completed campaign to view its vulnerability report.</p>
        </div>

        {reportLoading && (
          <p className="text-zinc-500 py-10 animate-pulse text-center">Loading report...</p>
        )}
        
        {reportError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <span className="text-sm text-red-400">{reportError}</span>
          </div>
        )}

        {loading ? (
          <p className="text-zinc-500 py-10 animate-pulse text-center">Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl text-center py-16">
            <p className="text-zinc-500 text-sm">No completed campaigns yet. Run a campaign first to generate a report.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex justify-between items-center cursor-pointer hover:border-violet-500/30 hover:bg-zinc-800/30 transition-colors group"
                onClick={() => {
                  setSelectedCampaignId(c.id);
                  router.push(`/reports?campaign_id=${c.id}`);
                }}
              >
                <div>
                  <h3 className="font-heading text-lg font-bold text-white group-hover:text-violet-400 transition-colors">{c.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider">
                    {c.target_name} &middot; {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  {c.risk_score !== null && (
                    <span className={clsx(
                      "font-heading text-2xl font-bold",
                      c.risk_score >= 61 ? "text-red-500" : c.risk_score >= 41 ? "text-amber-500" : "text-green-500"
                    )}>
                      {Math.round(c.risk_score)}
                    </span>
                  )}
                  <div className="flex items-center gap-2 w-20 justify-end">
                    <div className={clsx("w-2 h-2 rounded-full", c.status === "completed" ? "bg-green-500" : "bg-red-500")} />
                    <span className="text-xs text-zinc-400 capitalize">{c.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex justify-between items-start mb-8">
        <div>
          <button
            className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm font-medium transition-colors mb-4"
            onClick={() => {
              setSelectedCampaignId(null);
              router.push("/reports");
            }}
          >
            <ArrowLeft size={16} /> Back to Reports
          </button>
          <h1 className="font-heading text-2xl font-bold text-white tracking-tight">Security Assessment Report</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {report.target_name} ({report.target_model}) &middot; {report.campaign_name}
          </p>
        </div>
        <button
          className="border border-zinc-700 hover:border-zinc-500 text-white px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2"
          onClick={() => window.open(`/report-export/${report.campaign_id}`, '_blank')}
        >
          Export PDF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="md:col-span-1 bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col justify-center items-center text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-2">Overall Risk</p>
          <div className={clsx("font-heading text-5xl font-black mb-1", getRiskColor(report.risk_level))}>
            {report.overall_risk_score}
          </div>
          <p className={clsx("text-sm font-bold uppercase tracking-widest", getRiskColor(report.risk_level))}>
            {report.risk_level}
          </p>
        </div>

        <div className="md:col-span-3 grid grid-cols-3 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-2">Tests Run</p>
            <p className="font-heading text-3xl font-bold text-white">{report.total_tests}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-2">Vulnerabilities</p>
            <p className="font-heading text-3xl font-bold text-red-500">{report.total_failures}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-2">Pass Rate</p>
            <p className="font-heading text-3xl font-bold text-green-500">
              {Math.round(((report.total_passes) / (report.total_tests || 1)) * 100)}%
            </p>
          </div>
        </div>
      </div>

      {report.total_failures === 0 ? (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-8 flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 mb-4">
            <ShieldCheck size={32} />
          </div>
          <h2 className="font-heading text-xl font-bold text-green-400 mb-2">Secure</h2>
          <p className="text-green-500/80 max-w-lg">
            No vulnerabilities were detected during this assessment. The target model demonstrated robust defenses against all tested attack vectors.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
            <h2 className="font-heading text-lg font-bold text-white mb-6">Attack Vectors</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.category_scores.map((cs) => (
                <div key={cs.category} className="bg-black border border-zinc-800/50 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-white text-sm">{cs.display_name}</h4>
                    <p className="text-xs text-zinc-500 mt-1">
                      {cs.failures} vulnerabilities / {cs.total_tests} tests
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={clsx(
                      "inline-block px-2.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wider",
                      getSeverityBadgeColor(cs.severity)
                    )}>
                      {cs.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-white mb-6">Detailed Findings</h2>
            <div className="flex flex-col gap-6">
              {report.findings.map((finding) => (
                <div key={finding.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
                  <div className={clsx(
                    "absolute top-0 left-0 w-1 h-full",
                    finding.severity === "critical" || finding.severity === "high" ? "bg-red-500" :
                    finding.severity === "medium" ? "bg-amber-500" : "bg-blue-500"
                  )} />
                  
                  <div className="pl-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={clsx(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-widest",
                            getSeverityBadgeColor(finding.severity)
                          )}>
                            {finding.severity}
                          </span>
                          <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">{finding.category.replace("_", " ")}</span>
                        </div>
                        <h3 className="font-heading text-lg font-bold text-white">{finding.title}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-1">Occurrences</p>
                        <p className="text-lg font-bold text-white">{finding.occurrence_count}</p>
                      </div>
                    </div>

                    <p className="text-sm text-zinc-400 mb-6 leading-relaxed">{finding.description}</p>

                    {finding.remediation && (
                      <div className="mb-6 p-4 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                        <h4 className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-2">Recommended Remediation</h4>
                        <p className="text-sm text-zinc-300">{finding.remediation}</p>
                      </div>
                    )}

                    {finding.evidence && finding.evidence.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Evidence (Sample)</h4>
                        {finding.evidence.map((ev, i) => (
                          <div key={i} className="bg-black border border-zinc-800 rounded-lg overflow-hidden text-sm mb-4 last:mb-0 relative">
                            {ev.generation !== undefined && (
                              <div className="absolute top-4 right-4 flex items-center gap-2">
                                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Evolution Depth</span>
                                <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs font-mono font-bold">
                                  Gen {ev.generation}
                                </span>
                              </div>
                            )}
                            <div className="p-4 border-b border-zinc-800">
                              <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold block mb-2">Input Prompt</span>
                              <p className="font-mono text-zinc-300 whitespace-pre-wrap pr-32">
                                {ev.prompt || "N/A"}
                              </p>
                            </div>
                            <div className="p-4">
                              <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold block mb-2">Model Response</span>
                              <p className="font-mono text-red-400 whitespace-pre-wrap">
                                {ev.response || "N/A"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
