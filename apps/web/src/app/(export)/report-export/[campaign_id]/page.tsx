"use client";
import React, { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { ShieldCheck, AlertCircle } from "lucide-react";
import clsx from "clsx";
import { useParams } from "next/navigation";

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

export default function ReportExportPage() {
  const params = useParams();
  const campaignId = params.campaign_id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    try {
      const data = await apiFetch(`/reports/campaign/${campaignId}`);
      setReport(data);
      // Automatically pop up print dialog after a brief delay for rendering
      setTimeout(() => {
        window.print();
      }, 500);
    } catch (err: any) {
      setError(err.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (campaignId) {
      loadReport();
    }
  }, [campaignId, loadReport]);

  if (loading) {
    return <div className="p-10 text-center text-zinc-500">Preparing PDF for export...</div>;
  }

  if (error || !report) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Export Failed</h1>
        <p className="text-zinc-600">{error || "Report not found"}</p>
      </div>
    );
  }

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "critical":
      case "high":
        return "text-red-700";
      case "medium":
        return "text-amber-600";
      case "low":
        return "text-green-700";
      default:
        return "text-zinc-600";
    }
  };

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev) {
      case "critical":
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 md:p-12 print:p-0 bg-white">
      {/* HEADER */}
      <div className="border-b-2 border-zinc-200 pb-6 mb-8 flex justify-between items-end print:break-inside-avoid">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-black">
              A
            </div>
            <span className="font-black text-xl tracking-tight">AYZO</span>
            <span className="text-zinc-400 font-medium ml-1">Security Report</span>
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 mt-6">{report.target_name}</h1>
          <p className="text-zinc-500 text-sm mt-1 uppercase tracking-wider font-semibold">
            {report.target_model} &middot; {report.campaign_name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Generated</p>
          <p className="text-zinc-800 font-medium">
            {new Date(report.generated_at).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
            })}
          </p>
        </div>
      </div>

      {/* EXECUTIVE SUMMARY */}
      <div className="grid grid-cols-4 gap-6 mb-12 print:break-inside-avoid">
        <div className="col-span-1 bg-zinc-50 rounded-xl p-6 border border-zinc-200 flex flex-col justify-center items-center text-center">
          <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-2">Overall Risk</p>
          <div className={clsx("text-6xl font-black mb-1", getRiskColor(report.risk_level))}>
            {report.overall_risk_score}
          </div>
          <p className={clsx("text-sm font-bold uppercase tracking-widest", getRiskColor(report.risk_level))}>
            {report.risk_level}
          </p>
        </div>

        <div className="col-span-3 grid grid-cols-3 gap-6">
          <div className="bg-zinc-50 rounded-xl p-6 border border-zinc-200">
            <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-2">Tests Run</p>
            <p className="text-4xl font-bold text-zinc-900">{report.total_tests}</p>
          </div>
          <div className="bg-zinc-50 rounded-xl p-6 border border-zinc-200">
            <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-2">Vulnerabilities</p>
            <p className="text-4xl font-bold text-red-700">{report.total_failures}</p>
          </div>
          <div className="bg-zinc-50 rounded-xl p-6 border border-zinc-200">
            <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-2">Pass Rate</p>
            <p className="text-4xl font-bold text-green-700">
              {Math.round(((report.total_passes) / (report.total_tests || 1)) * 100)}%
            </p>
          </div>
        </div>
      </div>

      {/* CATEGORY BREAKDOWN */}
      <div className="mb-12 print:break-inside-avoid">
        <h2 className="text-xl font-bold text-zinc-900 mb-6 border-b border-zinc-200 pb-2">Attack Vectors Breakdown</h2>
        {report.category_scores.length === 0 ? (
          <p className="text-zinc-500 text-sm">No tests were run.</p>
        ) : (
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-zinc-200 text-zinc-500 uppercase tracking-widest text-xs">
                <th className="py-3 font-semibold">Category</th>
                <th className="py-3 font-semibold text-center">Severity</th>
                <th className="py-3 font-semibold text-right">Failure Rate</th>
              </tr>
            </thead>
            <tbody>
              {report.category_scores.map((cs) => (
                <tr key={cs.category} className="border-b border-zinc-100">
                  <td className="py-4">
                    <p className="font-bold text-zinc-900">{cs.display_name}</p>
                    <p className="text-xs text-zinc-500 mt-1">{cs.failures} failed out of {cs.total_tests}</p>
                  </td>
                  <td className="py-4 text-center">
                    <span className={clsx("px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-widest inline-block", getSeverityBadgeClass(cs.severity))}>
                      {cs.severity}
                    </span>
                  </td>
                  <td className="py-4 text-right font-bold text-zinc-900">
                    {Math.round(cs.failure_rate)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* DETAILED FINDINGS */}
      {report.total_failures > 0 && (
        <div className="print:break-before-page">
          <h2 className="text-xl font-bold text-zinc-900 mb-6 border-b border-zinc-200 pb-2">Detailed Findings</h2>
          <div className="flex flex-col gap-8">
            {report.findings.map((finding) => (
              <div key={finding.id} className="border border-zinc-200 rounded-xl p-6 bg-zinc-50 print:break-inside-avoid shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={clsx("px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-widest", getSeverityBadgeClass(finding.severity))}>
                        {finding.severity}
                      </span>
                      <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">
                        {finding.category.replaceAll("_", " ")}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900">{finding.title}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-1">Occurrences</p>
                    <p className="text-lg font-bold text-zinc-900">{finding.occurrence_count}</p>
                  </div>
                </div>

                <p className="text-sm text-zinc-600 mb-6 leading-relaxed">{finding.description}</p>

                {finding.remediation && (
                  <div className="mb-6 p-4 bg-white border border-zinc-200 rounded-lg shadow-sm">
                    <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-widest mb-2">Recommended Remediation</h4>
                    <p className="text-sm text-zinc-600">{finding.remediation}</p>
                  </div>
                )}

                {finding.evidence && finding.evidence.length > 0 && (
                  <div className="mt-6 border-t border-zinc-200 pt-6">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Evidence Snapshot</h4>
                    {finding.evidence.slice(0, 2).map((ev, i) => (
                      <div key={i} className="bg-white border border-zinc-200 rounded-lg overflow-hidden text-sm mb-4 last:mb-0">
                        <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
                          <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold block mb-1">Attack Payload Sent</span>
                          <p className="font-mono text-zinc-800 whitespace-pre-wrap text-xs">
                            {ev.prompt || "N/A"}
                          </p>
                        </div>
                        <div className="p-4 border-l-4 border-red-500">
                          <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold block mb-1">Model Response</span>
                          <p className="font-mono text-red-700 whitespace-pre-wrap text-xs">
                            {ev.response || "N/A"}
                          </p>
                        </div>
                      </div>
                    ))}
                    {finding.evidence.length > 2 && (
                      <p className="text-xs text-zinc-400 italic">...and {finding.evidence.length - 2} more instances omitted for brevity.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="mt-16 pt-8 border-t border-zinc-200 text-center print:break-inside-avoid">
        <p className="text-xs text-zinc-400 font-medium">
          Confidential Security Report &middot; Generated by AYZO
        </p>
      </div>
    </div>
  );
}
