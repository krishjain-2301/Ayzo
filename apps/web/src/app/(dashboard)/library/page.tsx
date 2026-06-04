"use client";
import React, { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Check, Plus } from "lucide-react";
import clsx from "clsx";

import { CustomPayloadModal } from "@/components/CustomPayloadModal";

interface AttackCategory {
  id: string;
  name: string;
  owasp_id: string;
  description: string;
  attack_count: number;
}

interface AttackPayload {
  category: string;
  subcategory: string;
  name: string;
  description: string;
  original_prompt: string;
  success_indicators: string;
  severity: string;
  is_builtin: boolean;
  metadata: {
    display_name: string;
    owasp_id: string;
    source_file: string;
  };
}

export default function LibraryPage() {
  const [categories, setCategories] = useState<AttackCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [payloads, setPayloads] = useState<AttackPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [payloadsLoading, setPayloadsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const data = await apiFetch("/attacks/categories");
      setCategories(data);
      if (data.length > 0 && !selectedCategory) {
        setSelectedCategory(data[0].id);
      }
    } catch (e) {
      console.error("Failed to load categories", e);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  const loadPayloads = useCallback(async (categoryId: string) => {
    setPayloadsLoading(true);
    try {
      const data = await apiFetch(`/attacks/payloads?category=${categoryId}`);
      setPayloads(data);
    } catch (e) {
      console.error("Failed to load payloads", e);
    } finally {
      setPayloadsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (selectedCategory) {
      loadPayloads(selectedCategory);
    }
  }, [selectedCategory, loadPayloads]);

  const getSeverityBadgeColor = (sev: string) => {
    switch (sev.toLowerCase()) {
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

  const selectedCat = categories.find((c) => c.id === selectedCategory);

  return (
    <div className="max-w-6xl">
      <CustomPayloadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          loadCategories();
          if (selectedCategory === "custom") {
            loadPayloads("custom");
          } else {
            setSelectedCategory("custom");
          }
        }}
      />
      
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white tracking-tight">Attack Library</h1>
          <p className="text-zinc-400 text-sm mt-1">Browse adversarial payloads categorized by OWASP Top 10 for LLMs.</p>
        </div>
        <button
          className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-all hover:shadow-[0_0_20px_rgba(124,58,237,0.3)]"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={16} /> New Custom Payload
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        {/* Sidebar */}
        <div className="md:col-span-1 flex flex-col gap-2 sticky top-8">
          <div className="text-xs uppercase tracking-widest font-semibold text-zinc-500 mb-2 px-2">Categories</div>
          {loading ? (
            <p className="text-zinc-500 px-2 animate-pulse text-sm">Loading...</p>
          ) : (
            categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  "flex justify-between items-center px-4 py-2.5 rounded-lg text-sm text-left transition-all",
                  selectedCategory === cat.id
                    ? "bg-violet-600/20 text-violet-400 font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                )}
              >
                <span>{cat.name}</span>
                <span className={clsx(
                  "text-xs px-2 py-0.5 rounded-full bg-black/50 border",
                  selectedCategory === cat.id ? "border-violet-500/30 text-violet-300" : "border-zinc-800 text-zinc-500"
                )}>
                  {cat.attack_count}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Payload List */}
        <div className="md:col-span-3">
          {selectedCat && (
            <div className="mb-6 pb-4 border-b border-zinc-800/50">
              <h2 className="font-heading text-xl font-bold text-white">{selectedCat.name}</h2>
              <p className="text-sm text-zinc-500 mt-1 uppercase tracking-widest font-semibold">{selectedCat.owasp_id || "OWASP LLM Top 10"}</p>
            </div>
          )}

          {payloadsLoading ? (
            <p className="text-zinc-500 animate-pulse">Loading payloads...</p>
          ) : payloads.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl text-center py-16">
              <p className="text-zinc-500 text-sm">No payloads found for this category.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {payloads.map((payload, idx) => (
                <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-violet-500/30 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-heading text-lg font-bold text-white mb-1">{payload.name}</h3>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">
                          {payload.subcategory.replace("_", " ")}
                        </span>
                        {payload.is_builtin && (
                          <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
                            <Check size={10} /> Built-in
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={clsx(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-widest",
                      getSeverityBadgeColor(payload.severity)
                    )}>
                      {payload.severity}
                    </span>
                  </div>

                  <p className="text-sm text-zinc-400 mb-6 leading-relaxed">{payload.description}</p>

                  <div className="bg-black border border-zinc-800 rounded-lg overflow-hidden text-sm">
                    <div className="p-4 border-b border-zinc-800">
                      <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold block mb-2">Original Prompt Template</span>
                      <p className="font-mono text-zinc-300 whitespace-pre-wrap">{payload.original_prompt}</p>
                    </div>
                    <div className="p-4">
                      <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold block mb-2">Success Indicators (Regex)</span>
                      <p className="font-mono text-red-400 whitespace-pre-wrap">{payload.success_indicators}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
