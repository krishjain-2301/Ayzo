"use client";
import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

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
    if (selectedCategories.length === 0) {
      setError("Please select at least one attack category.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await apiFetch("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: name || "Quick Assessment",
          description: "Automated scan from dashboard",
          target_id: targetId,
          attack_categories: selectedCategories,
          mutation_depth: mutationDepth,
          mutations_per_prompt: mutationDepth > 0 ? 3 : 1,
        }),
      });

      onSuccess();
      onClose();
      setName("");
    } catch (err: any) {
      setError(err.message || "Failed to start campaign");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Run Assessment</h2>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              background: "var(--red-soft)",
              color: "var(--red)",
              fontSize: "13px",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "20px" }}>
            <label className="input-label">Campaign Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Weekly Security Scan"
              className="input-field"
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label className="input-label">Target</label>
            <div
              className="surface-inset"
              style={{
                padding: "10px 14px",
                fontSize: "14px",
              }}
            >
              {targetName || "Selected Target"}
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label className="input-label">Attack Categories</label>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              {categories.length > 0 ? (
                categories.map((cat) => (
                  <label
                    key={cat.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm)",
                      background: selectedCategories.includes(cat.id)
                        ? "var(--accent-soft)"
                        : "var(--bg-inset)",
                      border: `1px solid ${
                        selectedCategories.includes(cat.id)
                          ? "hsla(262, 83%, 58%, 0.2)"
                          : "var(--border)"
                      }`,
                      cursor: "pointer",
                      transition: "all 150ms",
                      fontSize: "13px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <span style={{ flex: 1, fontWeight: 450 }}>
                      {cat.name}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {cat.attack_count} attacks
                    </span>
                  </label>
                ))
              ) : (
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--text-tertiary)",
                  }}
                  className="animate-pulse"
                >
                  Loading categories...
                </p>
              )}
            </div>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label className="input-label">Mutation Depth</label>
            <select
              value={mutationDepth}
              onChange={(e) => setMutationDepth(Number(e.target.value))}
              className="input-field"
            >
              <option value={0}>0 — Original prompts only (fastest)</option>
              <option value={1}>1 — One round of mutations</option>
              <option value={2}>2 — Two rounds (thorough)</option>
              <option value={3}>3 — Maximum depth (slowest)</option>
            </select>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? "Launching..." : "Launch Attack"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
