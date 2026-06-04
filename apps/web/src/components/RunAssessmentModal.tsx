"use client";
import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import clsx from "clsx";
import { X } from "lucide-react";

interface RunAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string | null;
  targetName?: string;
  onSuccess: () => void;
}

interface AttackCategory {
  id: string;
  name: string;
  description: string;
  attack_count: number;
}

export function RunAssessmentModal({
  isOpen,
  onClose,
  targetId,
  targetName,
  onSuccess,
}: RunAssessmentModalProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<AttackCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [mutationDepth, setMutationDepth] = useState(1);

  useEffect(() => {
    if (isOpen) {
      apiFetch("/attacks/categories")
        .then((cats: AttackCategory[]) => {
          setCategories(cats);
          setSelectedCategories(cats.map((c) => c.id));
        })
        .catch(() => {
          setSelectedCategories(["prompt_injection"]);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId)
        ? prev.filter((c) => c !== catId)
        : [...prev, catId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) {
      setError("No target available to test.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await apiFetch("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: name || "Security Assessment",
          target_id: targetId,
          attack_categories: selectedCategories,
          mutation_depth: mutationDepth,
        }),
      });

      setName("");
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to start campaign");
    } finally {
      setLoading(false);
    }
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

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6" id="assessment-form">
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

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Target</label>
              <div className="w-full bg-black/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-300">
                {targetName || "Selected Target"}
              </div>
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
              <select
                value={mutationDepth}
                onChange={(e) => setMutationDepth(Number(e.target.value))}
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all appearance-none"
              >
                <option value={0}>0 — Original prompts only (fastest)</option>
                <option value={1}>1 — One round of mutations</option>
                <option value={2}>2 — Two rounds (thorough)</option>
                <option value={3}>3 — Maximum depth (slowest)</option>
              </select>
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
            form="assessment-form"
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
