"use client";
import React, { useState } from "react";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface CustomPayloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CustomPayloadModal({ isOpen, onClose, onSuccess }: CustomPayloadModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [successIndicators, setSuccessIndicators] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await apiFetch("/attacks/payloads/custom", {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          prompt,
          success_indicators: successIndicators,
          severity,
        }),
      });
      
      // Reset form
      setName("");
      setDescription("");
      setPrompt("");
      setSuccessIndicators("");
      setSeverity("medium");
      
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to create payload.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-black/40">
          <h2 className="font-heading text-lg font-bold text-white">Add Custom Payload</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          <form id="payload-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Payload Name</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Markdown Exfiltration"
                  className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all appearance-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Description</label>
              <textarea
                required
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe what this attack attempts to do..."
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">The Attack Prompt</label>
              <textarea
                required
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Write the exact prompt to be injected into the target..."
                className="w-full font-mono text-xs bg-black border border-zinc-800 rounded-lg px-4 py-3 text-violet-300 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Success Indicators (Regex Pattern)</label>
              <input
                required
                type="text"
                value={successIndicators}
                onChange={(e) => setSuccessIndicators(e.target.value)}
                placeholder="e.g., (?i)(secret|password|API_KEY|hidden)"
                className="w-full font-mono text-xs bg-black border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
              />
              <p className="text-xs text-zinc-500 mt-1.5">If the target's response matches this regex, the attack is considered successful (a vulnerability was found).</p>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3 bg-black/40">
          <button
            type="button"
            className="px-5 py-2 rounded-full text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="payload-form"
            disabled={loading}
            className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2 rounded-full text-sm font-semibold transition-all disabled:opacity-50 hover:shadow-[0_0_20px_rgba(124,58,237,0.3)]"
          >
            {loading ? "Saving..." : "Save Payload"}
          </button>
        </div>
      </div>
    </div>
  );
}
