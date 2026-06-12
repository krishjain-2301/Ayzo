"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ArrowLeft, ShieldAlert, Cpu, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import clsx from "clsx";

interface TranscriptMessage {
  turn: number;
  speaker: "Attacker" | "Target";
  message: string;
}

interface ConversationalResult {
  status: string;
  goal: string;
  turns_taken: number;
  result: "pass" | "fail" | "error";
  eval_reasoning: string;
  transcript: TranscriptMessage[];
  time_taken_ms: number;
}

function ConversationalAttackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const targetId = searchParams.get("targetId");
  const goal = searchParams.get("goal");
  const turns = searchParams.get("turns");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ConversationalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId || !goal) return;

    const runAttack = async () => {
      try {
        const response = await apiFetch("/conversational/run", {
          method: "POST",
          body: JSON.stringify({
            target_id: targetId,
            goal: goal,
            max_turns: parseInt(turns || "5", 10),
          }),
        });
        setData(response);
      } catch (err: any) {
        setError(err.message || "Failed to run conversational attack.");
      } finally {
        setLoading(false);
      }
    };

    runAttack();
  }, [targetId, goal, turns]);

  if (!targetId || !goal) {
    return <div className="p-8 text-red-500">Missing required parameters.</div>;
  }

  // BUG FIX: "pass" means the attacker SUCCEEDED (target is VULNERABLE).
  // "fail" means the attacker FAILED (target is SECURE).
  const isVulnerable = data?.result === "pass";

  return (
    <div className="max-w-5xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 shrink-0">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-heading text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="text-violet-500" />
            Agentic Attack In Progress
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Goal: <span className="text-zinc-300 font-medium">{goal}</span></p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
        
        {loading && !data && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mb-6"></div>
            <h3 className="text-lg font-bold text-white mb-2">Simulating Crescendo Attack</h3>
            <p className="text-zinc-400 text-sm">Our Red Team Agent is conversing with the target...</p>
            <p className="text-xs text-zinc-500 mt-2">This may take up to a minute depending on the target model.</p>
          </div>
        )}

        {error && (
          <div className="p-6 m-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
            <AlertTriangle />
            {error}
          </div>
        )}

        {/* Transcript Chat Window */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-black/20">
          {data?.transcript.map((msg, idx) => (
            <div 
              key={idx} 
              className={clsx(
                "flex gap-4 max-w-[85%] animate-in fade-in slide-in-from-bottom-4 duration-500",
                msg.speaker === "Attacker" ? "mr-auto" : "ml-auto flex-row-reverse"
              )}
            >
              <div className={clsx(
                "w-10 h-10 shrink-0 rounded-full flex items-center justify-center border",
                msg.speaker === "Attacker" 
                  ? "bg-violet-500/20 border-violet-500/30 text-violet-400" 
                  : "bg-blue-500/20 border-blue-500/30 text-blue-400"
              )}>
                {msg.speaker === "Attacker" ? <ShieldAlert size={20} /> : <Cpu size={20} />}
              </div>
              
              <div className={clsx(
                "p-4 rounded-2xl",
                msg.speaker === "Attacker" 
                  ? "bg-zinc-800/80 border border-zinc-700 rounded-tl-none" 
                  : "bg-blue-900/20 border border-blue-500/20 rounded-tr-none"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={clsx(
                    "text-xs font-bold uppercase tracking-wider",
                    msg.speaker === "Attacker" ? "text-violet-400" : "text-blue-400"
                  )}>
                    {msg.speaker}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-mono">Turn {msg.turn}</span>
                </div>
                <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {msg.message}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Results Panel */}
        {data && (
          <div className="shrink-0 bg-black p-6 border-t border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-lg">Evaluation Result</h3>
              <div className={clsx(
                "px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 uppercase tracking-wider border",
                isVulnerable
                  ? "bg-red-500/20 text-red-400 border-red-500/30" 
                  : data.result === "fail"
                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                  : "bg-zinc-800 text-zinc-400 border-zinc-700"
              )}>
                {isVulnerable ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                {isVulnerable ? "Attack Succeeded — Vulnerable" : data.result === "fail" ? "Attack Failed — Secure" : "Error"}
              </div>
            </div>
            
            <p className="text-sm text-zinc-400 mb-4">{data.eval_reasoning}</p>
            
            <div className="flex gap-4 text-xs font-mono text-zinc-500">
              <span>Time: {data.time_taken_ms}ms</span>
              <span>Turns taken: {data.turns_taken}/{turns}</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function ConversationalAttackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
      </div>
    }>
      <ConversationalAttackContent />
    </Suspense>
  );
}
