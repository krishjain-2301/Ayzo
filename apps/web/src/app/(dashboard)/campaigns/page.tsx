"use client";
import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import clsx from "clsx";
import { RunAssessmentModal } from "@/components/RunAssessmentModal";

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

function CampaignsContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.toLowerCase() || "";

  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    return "Minimal";
  };

  const getRiskColor = (score: number | null) => {
    if (score === null || score === undefined) return "text-zinc-500";
    if (score >= 81) return "text-red-500";
    if (score >= 61) return "text-amber-500";
    if (score >= 41) return "text-yellow-500";
    return "text-green-500";
  };

  const filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(query) || 
    c.target_name.toLowerCase().includes(query)
  );

  return (
    <div className="max-w-6xl">
      <RunAssessmentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        targetId={null} 
        onSuccess={() => {
          setIsModalOpen(false);
          loadCampaigns();
        }} 
      />

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white tracking-tight">Campaigns</h1>
          <p className="text-zinc-400 text-sm mt-1">Monitor adversarial testing progress and history.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-all hover:shadow-[0_0_20px_rgba(124,58,237,0.3)]"
        >
          <Plus size={16} /> New Campaign
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 bg-zinc-950/50">
                <th className="px-6 py-4 font-semibold">Campaign / Target</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Progress</th>
                <th className="px-6 py-4 font-semibold">Risk Score</th>
                <th className="px-6 py-4 font-semibold">Vulnerabilities</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 animate-pulse">
                    Loading campaigns...
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-zinc-500">
                    <p className="mb-4">No campaigns found.</p>
                    <Link
                      href="/dashboard"
                      className="inline-flex border border-zinc-700 hover:border-zinc-500 text-white px-4 py-2 rounded-full text-sm transition-all"
                    >
                      Run your first test
                    </Link>
                  </td>
                </tr>
              ) : filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-zinc-500">
                    <p className="mb-4">No campaigns match "{searchParams.get("q")}".</p>
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-heading font-semibold text-white group-hover:text-violet-400 transition-colors">{c.name}</p>
                      <p className="text-xs text-zinc-500 mt-1">{c.target_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      {c.status === "running" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          Running
                        </span>
                      ) : c.status === "completed" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          Completed
                        </span>
                      ) : c.status === "failed" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                          {c.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-violet-500 rounded-full transition-all duration-500" 
                            style={{ width: `${c.progress_percent || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-400 w-8">{Math.round(c.progress_percent || 0)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={clsx("font-heading font-bold text-lg", getRiskColor(c.risk_score))}>
                          {c.risk_score !== null ? c.risk_score : "--"}
                        </span>
                        <span className="text-xs text-zinc-500">{getRiskLabel(c.risk_score)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-300">
                      <span className={c.failed_tests > 0 ? "text-red-400 font-semibold" : ""}>
                        {c.failed_tests || 0}
                      </span>
                      <span className="text-zinc-500 text-xs ml-1">/ {c.total_tests || 0}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {c.status === "completed" && (
                          <Link
                            href={`/reports?campaign_id=${c.id}`}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-violet-600 transition-colors"
                            title="View Report"
                          >
                            <ExternalLink size={15} />
                          </Link>
                        )}
                        <button
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          onClick={() => handleDelete(c.id)}
                          title="Delete Campaign"
                        >
                          <Trash2 size={15} />
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
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl p-10 text-center animate-pulse text-zinc-500">Loading campaigns...</div>}>
      <CampaignsContent />
    </Suspense>
  );
}
