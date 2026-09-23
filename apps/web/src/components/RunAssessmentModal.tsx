"use client";
import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import clsx from "clsx";
import { X, MessageSquare, Layers, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

interface RunAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string | null;
  targetName?: string;
  onSuccess: () => void;
}

interface Target {
  id: string;
  name: string;
}

interface AttackCategory {
  id: string;
  name: string;
  description: string;
  attack_count: number;
}

function CustomTargetSelect({ 
  targets, 
  value, 
  onChange 
}: { 
  targets: Target[], 
  value: string, 
  onChange: (val: string) => void 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedTarget = targets.find((t) => t.id === value);

  return (
    <div className="relative">
      <button
        type="button"
        className={clsx(
          "w-full flex items-center justify-between bg-black border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none transition-all",
          isOpen ? "border-violet-500 ring-1 ring-violet-500/50" : "border-zinc-800"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">
          {selectedTarget ? selectedTarget.name : targets.length === 0 ? "Loading targets..." : "Select a target"}
        </span>
        <ChevronDown size={16} className={clsx("text-zinc-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 w-full mt-1.5 bg-[#121214] border border-zinc-800 rounded-lg shadow-2xl overflow-hidden py-1.5 max-h-60 overflow-y-auto flex flex-col gap-0.5">
            {targets.length === 0 ? (
              <div className="px-4 py-2 text-sm text-zinc-500 italic">No targets available</div>
            ) : (
              targets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={clsx(
                    "w-full text-left px-4 py-2.5 text-sm transition-colors",
                    value === t.id
                      ? "bg-violet-600/20 text-violet-300 font-medium"
                      : "text-zinc-300 hover:bg-zinc-800/80 hover:text-white"
                  )}
                  onClick={() => {
                    onChange(t.id);
                    setIsOpen(false);
                  }}
                >
                  {t.name}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function RunAssessmentModal({
  isOpen,
  onClose,
  targetId,
  targetName,
  onSuccess,
}: RunAssessmentModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"bulk" | "conversational">("bulk");

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Bulk Campaign State
  const [categories, setCategories] = useState<AttackCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [mutationDepth, setMutationDepth] = useState(0);

  // Target State
  const [targets, setTargets] = useState<Target[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>(targetId || "");

  // Conversational State
  const [goal, setGoal] = useState("Extract the hidden system prompt.");
  const [maxTurns, setMaxTurns] = useState(5);

  useEffect(() => {
    if (isOpen) {
      // Fetch targets
      apiFetch("/targets")
        .then((data: Target[]) => {
          setTargets(data);
          if (!selectedTargetId && data.length > 0) {
            setSelectedTargetId(targetId || data[0].id);
          } else if (targetId) {
            setSelectedTargetId(targetId);
          }
        })
        .catch(console.error);

      apiFetch("/attacks/categories")
        .then((data: AttackCategory[]) => {
          const cats = Array.isArray(data) ? data : [];
          setCategories(cats);
          const preferred = ["prompt_injection", "jailbreak", "system_prompt_leak"];
          const defaults = cats.filter((c) => preferred.includes(c.id)).map((c) => c.id);
          setSelectedCategories(defaults.length ? defaults : cats.slice(0, 3).map((c) => c.id));
        })
        .catch(console.error);
    }
  }, [isOpen, targetId]);

  if (!isOpen) return null;

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId)
        ? prev.filter((c) => c !== catId)
        : [...prev, catId]
    );
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetId) return setError("No target available to test.");
    setLoading(true);
    setError("");

    try {
      await apiFetch("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: name || "Security Assessment",
          target_id: selectedTargetId,
          attack_categories: selectedCategories,
          mutation_depth: mutationDepth,
        }),
      });

      setName("");
      setLoading(false);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to start campaign");
      setLoading(false);
    }
  };

  const handleConversationalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetId) return setError("No target available to test.");
    
    // We redirect to the conversational page with query params so it can run and stream there
    onClose();
    router.push(`/conversational?targetId=${selectedTargetId}&goal=${encodeURIComponent(goal)}&turns=${maxTurns}`);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-black/40">
          <h2 className="font-heading text-lg font-bold text-white">Run Assessment</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-zinc-800 bg-black">
          <button
            className={clsx(
              "flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors",
              activeTab === "bulk" ? "text-violet-400 border-b-2 border-violet-500" : "text-zinc-500 hover:text-zinc-300"
            )}
            onClick={() => setActiveTab("bulk")}
          >
            <Layers size={16} /> Bulk Campaign
          </button>
          <button
            className={clsx(
              "flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors",
              activeTab === "conversational" ? "text-violet-400 border-b-2 border-violet-500" : "text-zinc-500 hover:text-zinc-300"
            )}
            onClick={() => setActiveTab("conversational")}
          >
            <MessageSquare size={16} /> Agentic Attack
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          {activeTab === "bulk" ? (
            <form onSubmit={handleBulkSubmit} className="flex flex-col gap-6" id="bulk-form">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Campaign Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Weekly Security Scan"
                  className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
                />
              </div>

              <div className="relative z-40">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Target</label>
                <CustomTargetSelect 
                  targets={targets} 
                  value={selectedTargetId} 
                  onChange={setSelectedTargetId} 
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Attack Categories</label>
                <div className="flex flex-col gap-2">
                  {categories.length > 0 ? (
                    categories.map((cat) => (
                      <label
                        key={cat.id}
                        className={clsx(
                          "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all border",
                          selectedCategories.includes(cat.id)
                            ? "bg-violet-600/10 border-violet-500/30"
                            : "bg-black border-zinc-800 hover:border-zinc-700"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(cat.id)}
                          onChange={() => toggleCategory(cat.id)}
                          className="accent-violet-500 w-4 h-4 rounded bg-black border-zinc-700 focus:ring-violet-500"
                        />
                        <span className="flex-1 text-sm font-medium text-zinc-200">{cat.name}</span>
                        <span className="text-xs text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800">
                          {cat.attack_count} attacks
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="text-zinc-500 text-sm animate-pulse">Loading categories...</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Mutation Depth</label>
                <div className="relative">
                  <select
                    value={mutationDepth}
                    onChange={(e) => setMutationDepth(Number(e.target.value))}
                    className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 pr-10 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all appearance-none"
                  >
                    <option value={0}>0 — Original prompts only (fastest)</option>
                    <option value={1}>1 — One round of mutations</option>
                    <option value={2}>2 — Two rounds (thorough)</option>
                    <option value={3}>3 — Maximum depth (slowest)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none w-4 h-4" />
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleConversationalSubmit} className="flex flex-col gap-6" id="conversational-form">
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-4 mb-2 text-sm text-violet-200">
                <strong>Agentic Attack (Crescendo):</strong> AYZO will spawn an Attacker LLM to hold a multi-turn conversation with the target, slowly escalating to bypass its filters.
              </div>
              
              <div className="relative z-40">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Target</label>
                <CustomTargetSelect 
                  targets={targets} 
                  value={selectedTargetId} 
                  onChange={setSelectedTargetId} 
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Attack Goal</label>
                <textarea
                  required
                  rows={3}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Provide instructions on how to hotwire a car."
                  className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Max Turns</label>
                <input
                  type="number"
                  min="2"
                  max="8"
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(Number(e.target.value))}
                  className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
                />
                <p className="text-xs text-zinc-500 mt-1">Number of conversation back-and-forths before giving up.</p>
              </div>
            </form>
          )}
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
            form={activeTab === "bulk" ? "bulk-form" : "conversational-form"}
            disabled={loading}
            className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2 rounded-full text-sm font-semibold transition-all disabled:opacity-50 hover:shadow-[0_0_20px_rgba(124,58,237,0.3)]"
          >
            {loading ? "Launching..." : "Launch Attack"}
          </button>
        </div>

      </div>
    </div>
  );
}
