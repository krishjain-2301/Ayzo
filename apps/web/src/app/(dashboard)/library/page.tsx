"use client";
import React, { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Check } from "lucide-react";

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

  const selectedCat = categories.find((c) => c.id === selectedCategory);

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "critical":
      case "high":
        return "danger";
      case "medium":
        return "warning";
      case "low":
        return "success";
      default:
        return "info";
    }
  };

  const totalPayloads = categories.reduce(
    (acc, c) => acc + c.attack_count,
    0
  );

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attack Library</h1>
          <p className="page-description">
            Browse the collection of security test payloads used by AYZO.
          </p>
        </div>
        <span className="badge neutral" style={{ fontSize: "12px", padding: "6px 14px" }}>
          {totalPayloads} payloads
        </span>
      </div>

      {loading ? (
        <p
          style={{ color: "var(--text-tertiary)", padding: "40px 0" }}
          className="animate-pulse"
        >
          Loading attack library...
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "220px 1fr",
            gap: "24px",
          }}
        >
          {/* Categories Sidebar */}
          <div
            className="surface"
            style={{ padding: "16px", alignSelf: "start" }}
          >
            <h3
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-tertiary)",
                padding: "0 10px",
                marginBottom: "10px",
              }}
            >
              Categories
            </h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 10px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "13px",
                    textAlign: "left",
                    background:
                      selectedCategory === cat.id
                        ? "var(--accent-soft)"
                        : "transparent",
                    color:
                      selectedCategory === cat.id
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                    fontWeight: selectedCategory === cat.id ? 500 : 400,
                    transition: "all 150ms",
                    cursor: "pointer",
                  }}
                >
                  <span>{cat.name}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {cat.attack_count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Payload List */}
          <div>
            {selectedCat && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 600 }}>
                    {selectedCat.name}
                  </h2>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--text-tertiary)",
                      marginTop: "4px",
                    }}
                  >
                    {selectedCat.owasp_id || "OWASP LLM Top 10"}
                  </p>
                </div>
              </div>
            )}

            {payloadsLoading ? (
              <p
                style={{ color: "var(--text-tertiary)" }}
                className="animate-pulse"
              >
                Loading payloads...
              </p>
            ) : payloads.length === 0 ? (
              <div
                className="surface"
                style={{ textAlign: "center", padding: "60px 0" }}
              >
                <p style={{ color: "var(--text-tertiary)", fontSize: "14px" }}>
                  No payloads found for this category.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {payloads.map((payload, idx) => (
                  <div
                    key={idx}
                    className="surface"
                    style={{ padding: "24px" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "12px",
                      }}
                    >
                      <div>
                        <h3 style={{ fontSize: "15px", fontWeight: 600 }}>
                          {payload.name}
                        </h3>
                        {payload.subcategory && (
                          <p
                            style={{
                              fontSize: "11px",
                              color: "var(--text-tertiary)",
                              marginTop: "4px",
                            }}
                          >
                            {payload.subcategory}
                          </p>
                        )}
                      </div>
                      <span
                        className={`badge ${getSeverityBadge(payload.severity)}`}
                      >
                        {payload.severity}
                      </span>
                    </div>

                    {payload.description && (
                      <p
                        style={{
                          fontSize: "13px",
                          color: "var(--text-secondary)",
                          lineHeight: 1.6,
                          marginBottom: "14px",
                        }}
                      >
                        {payload.description}
                      </p>
                    )}

                    <div
                      className="code-block"
                      style={{ maxHeight: "120px", overflowY: "auto", marginBottom: "12px" }}
                    >
                      {payload.original_prompt}
                    </div>

                    {payload.success_indicators && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "12px",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        <Check
                          size={13}
                          style={{ color: "var(--green)" }}
                        />
                        <span>
                          Success indicator: {payload.success_indicators}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
