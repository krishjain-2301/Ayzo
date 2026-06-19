"use client";
import React, { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { RunAssessmentModal } from "@/components/RunAssessmentModal";
import { Activity, Zap, TrendingUp } from "lucide-react";
import clsx from "clsx";

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetName, setTargetName] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (isInitialLoad = false) => {
    try {
      // Only attempt to create the dummy target on the first load
      if (isInitialLoad) {
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
      }

      const camps = await apiFetch("/campaigns");
      setCampaigns(camps);
    } catch (e) {
      console.error("Failed to load dashboard data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true); // initial load: create dummy target if needed
    const interval = setInterval(() => loadData(false), 3000); // polls: only fetch campaigns
    return () => clearInterval(interval);
  }, [loadData]);

  const totalTests = campaigns.reduce(
    (acc, c) => acc + (c.total_tests || 0),
    0
  );
  const totalFailed = campaigns.reduce(
    (acc, c) => acc + (c.failed_tests || 0),
    0
  );

  const actionItems = [];
  const completedCampaignsWithIssues = campaigns.filter(c => c.status === "completed" && c.failed_tests > 0);
  if (completedCampaignsWithIssues.length > 0) {
    const worstCampaign = [...completedCampaignsWithIssues].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))[0];
    actionItems.push({
      type: (worstCampaign.risk_score || 0) >= 61 ? "critical" : "warning",
      title: "Vulnerabilities Detected",
      description: `Review the ${worstCampaign.failed_tests} vulnerabilities found in "${worstCampaign.name}".`,
    });
  }

  const failedCampaigns = campaigns.filter(c => c.status === "failed");
  if (failedCampaigns.length > 0) {
    actionItems.push({
      type: "critical",
      title: "Campaign Failed",
      description: `The campaign "${failedCampaigns[0].name}" failed to complete. Please check its configuration.`,
    });
  }

  if (actionItems.length === 0 && campaigns.length > 0) {
    actionItems.push({
      type: "success",
      title: "All Clear",
      description: "No pending action items. Your recent assessments look clean.",
    });
  } else if (actionItems.length === 0 && campaigns.length === 0) {
    actionItems.push({
      type: "info",
      title: "Getting Started",
      description: "Run your first assessment to discover potential vulnerabilities.",
    });
  }

  return (
    <div className="max-w-6xl">
      <RunAssessmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetId={targetId}
        targetName={targetName}
        onSuccess={() => {
          setIsModalOpen(false);
          loadData();
        }}
      />

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white tracking-tight">Overview</h1>
          <p className="text-zinc-400 text-sm mt-1">Welcome back. Here is your security posture.</p>
        </div>
        <button
          className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-full text-sm font-semibold transition-all hover:shadow-[0_0_20px_rgba(124,58,237,0.3)]"
          onClick={() => setIsModalOpen(true)}
        >
          Run Assessment
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Total Tests</p>
            <Zap size={16} className="text-zinc-500" />
          </div>
          <p className="font-heading text-4xl font-bold text-white">{totalTests}</p>
          <p className="text-sm text-zinc-500 mt-2">Executed across targets</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Vulnerabilities</p>
            <TrendingUp size={16} className="text-red-500/50" />
          </div>
          <p className="font-heading text-4xl font-bold text-white">{totalFailed}</p>
          <p className="text-sm text-zinc-500 mt-2">Failed assertions</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Active Campaigns</p>
            <Activity size={16} className="text-zinc-500" />
          </div>
          <p className="font-heading text-4xl font-bold text-white">
            {campaigns.filter((c) => c.status === "running").length}
          </p>
          <p className="text-sm text-zinc-500 mt-2">Currently in progress</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="font-heading text-lg font-bold text-white mb-6">Historical Risk Trend</h3>
          <div className="h-48 flex items-end gap-2 pb-6 border-b border-zinc-800/50">
            {campaigns.filter(c => c.status === "completed" && c.risk_score !== null).slice(-15).map((c, i) => {
              const score = c.risk_score || 0;
              const height = `${Math.max(5, score)}%`;
              return (
                <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                  <div
                    className={clsx(
                      "w-full rounded-t-sm transition-all duration-500 ease-out",
                      score >= 61 ? "bg-red-500/80 hover:bg-red-400" :
                        score >= 41 ? "bg-amber-500/80 hover:bg-amber-400" :
                          "bg-green-500/80 hover:bg-green-400"
                    )}
                    style={{ height }}
                  />
                  <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-black text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10 transition-opacity pointer-events-none">
                    Score: {Math.round(score)}
                  </div>
                </div>
              );
            })}
            {campaigns.filter(c => c.status === "completed").length === 0 && (
              <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">
                No completed campaigns yet
              </div>
            )}
          </div>
          <div className="flex justify-between mt-4">
            <span className="text-xs text-zinc-500">Older</span>
            <span className="text-xs text-zinc-500">Newer</span>
          </div>
        </div>

        <div className="md:col-span-1 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="font-heading text-lg font-bold text-white mb-6">Action Items</h3>
          <div className="flex flex-col gap-4">
            {actionItems.map((item, i) => (
              <div
                key={i}
                className={clsx(
                  "border rounded-lg p-4",
                  item.type === "critical" ? "bg-red-500/10 border-red-500/20" :
                  item.type === "warning" ? "bg-amber-500/10 border-amber-500/20" :
                  item.type === "info" ? "bg-violet-500/10 border-violet-500/20" :
                  "bg-green-500/10 border-green-500/20"
                )}
              >
                <p className={clsx(
                  "text-sm font-semibold mb-1",
                  item.type === "critical" ? "text-red-400" :
                  item.type === "warning" ? "text-amber-400" :
                  item.type === "info" ? "text-violet-400" :
                  "text-green-400"
                )}>{item.title}</p>
                <p className="text-xs text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h3 className="font-heading text-lg font-bold text-white mb-6">Recent Campaigns</h3>

        {loading && campaigns.length === 0 ? (
          <p className="text-zinc-500 py-4 animate-pulse">Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-zinc-500 mb-4 text-sm">No campaigns yet. Run your first assessment to get started.</p>
            <button
              className="border border-zinc-700 hover:border-zinc-500 text-white px-4 py-2 rounded-full text-sm transition-all"
              onClick={() => setIsModalOpen(true)}
            >
              Run your first test
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {campaigns.map((c, i) => (
              <div
                key={c.id}
                className={clsx(
                  "flex justify-between items-center py-4 px-4 hover:bg-zinc-800/30 transition-colors rounded-lg group",
                  i !== campaigns.length - 1 && "border-b border-zinc-800/50"
                )}
              >
                <div>
                  <p className="font-medium text-sm text-white group-hover:text-violet-400 transition-colors">{c.name}</p>
                  <p className="text-xs text-zinc-500 mt-1">{c.target_name}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-zinc-300">
                      {c.status === "running" ? "Running..." : `${c.failed_tests || 0} Failed`}
                    </p>
                  </div>
                  <div className="w-24 flex justify-end">
                    {c.status === "running" ? (
                      <span className="text-xs text-blue-400 bg-blue-400/10 rounded-full px-2.5 py-1 font-medium border border-blue-400/20">
                        Running
                      </span>
                    ) : c.status === "completed" ? (
                      <span className="text-xs text-green-400 bg-green-400/10 rounded-full px-2.5 py-1 font-medium border border-green-400/20">
                        Completed
                      </span>
                    ) : c.status === "failed" ? (
                      <span className="text-xs text-red-400 bg-red-400/10 rounded-full px-2.5 py-1 font-medium border border-red-400/20">
                        Failed
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400 bg-zinc-800 rounded-full px-2.5 py-1 font-medium border border-zinc-700">
                        {c.status}
                      </span>
                    )}
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
