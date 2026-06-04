"use client";
import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ShieldCheck, ShieldAlert, Activity } from "lucide-react";
import clsx from "clsx";

interface TrafficLog {
  id: string;
  target_name: string;
  prompt: string;
  status: "blocked" | "forwarded";
  timestamp: string;
}

export default function ProxyLiveTrafficPage() {
  const [logs, setLogs] = useState<TrafficLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTraffic = async () => {
      try {
        const data = await apiFetch("/proxy/traffic");
        setLogs(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadTraffic();
    const interval = setInterval(loadTraffic, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-6xl">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <Activity className="text-blue-500" /> Live Firewall Traffic
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Real-time view of prompts evaluated by the AYZO Blue Team Proxy.</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-full px-4 py-1.5 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-xs font-medium text-zinc-400">Monitoring Active</span>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-black/40 border-b border-zinc-800 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <div className="col-span-2">Time</div>
          <div className="col-span-2">Target</div>
          <div className="col-span-6">Prompt Payload</div>
          <div className="col-span-2 text-right">Action</div>
        </div>

        <div className="flex flex-col">
          {loading && logs.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 animate-pulse text-sm">Waiting for incoming traffic...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">No traffic logged recently. Send requests to the proxy endpoint to see them here.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors items-center">
                <div className="col-span-2 text-sm text-zinc-400 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
                <div className="col-span-2 text-sm text-white font-medium truncate">
                  {log.target_name}
                </div>
                <div className="col-span-6 text-sm text-zinc-300 font-mono truncate">
                  {log.prompt}
                </div>
                <div className="col-span-2 flex justify-end">
                  <div className={clsx(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border",
                    log.status === "blocked" 
                      ? "bg-red-500/10 text-red-400 border-red-500/20" 
                      : "bg-green-500/10 text-green-400 border-green-500/20"
                  )}>
                    {log.status === "blocked" ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
                    {log.status}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
