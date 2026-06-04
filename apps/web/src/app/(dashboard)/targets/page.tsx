"use client";
import React, { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Plus, Trash2, Play } from "lucide-react";

interface Target {
  id: string;
  name: string;
  description: string | null;
  provider: string;
  model_name: string;
  endpoint_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function TargetsPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    message: string;
  } | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    provider: "ollama",
    model_name: "",
    endpoint_url: "",
    api_key: "",
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const loadTargets = useCallback(async () => {
    try {
      const data = await apiFetch("/targets");
      setTargets(data);
    } catch (e) {
      console.error("Failed to load targets", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  const handleAddTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    try {
      await apiFetch("/targets", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          provider: form.provider,
          model_name: form.model_name,
          endpoint_url: form.endpoint_url || null,
          api_key: form.api_key || null,
        }),
      });
      setShowAddModal(false);
      setForm({
        name: "",
        description: "",
        provider: "ollama",
        model_name: "",
        endpoint_url: "",
        api_key: "",
      });
      await loadTargets();
    } catch (err: any) {
      setFormError(err.message || "Failed to add target");
    } finally {
      setFormLoading(false);
    }
  };

  const handleTest = async (targetId: string) => {
    setTestingId(targetId);
    setTestResult(null);
    try {
      const result = await apiFetch(`/targets/${targetId}/test`, {
        method: "POST",
      });
      setTestResult({ id: targetId, ...result });
      await loadTargets();
    } catch (err: any) {
      setTestResult({ id: targetId, success: false, message: err.message });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (targetId: string) => {
    if (!confirm("Are you sure you want to delete this target?")) return;
    try {
      await apiFetch(`/targets/${targetId}`, { method: "DELETE" });
      await loadTargets();
    } catch (err: any) {
      alert("Failed to delete: " + err.message);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Targets</h1>
          <p className="page-description">
            Manage the AI models you want to test for vulnerabilities.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={15} />
          Add Target
        </button>
      </div>

      {/* Test Result Toast */}
      {testResult && (
        <div
          className="surface animate-in"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 20px",
            marginBottom: "24px",
            borderLeft: `3px solid ${testResult.success ? "var(--green)" : "var(--red)"}`,
          }}
        >
          <span style={{ fontSize: "14px" }}>
            <strong
              style={{
                color: testResult.success ? "var(--green)" : "var(--red)",
              }}
            >
              {testResult.success ? "Connected" : "Failed"}:
            </strong>{" "}
            {testResult.message}
          </span>
          <button
            className="btn-ghost btn-sm"
            onClick={() => setTestResult(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p
          style={{ color: "var(--text-tertiary)", padding: "40px 0" }}
          className="animate-pulse"
        >
          Loading targets...
        </p>
      ) : targets.length === 0 ? (
        <div
          className="surface"
          style={{ textAlign: "center", padding: "60px 0" }}
        >
          <p
            style={{
              color: "var(--text-tertiary)",
              marginBottom: "16px",
              fontSize: "14px",
            }}
          >
            No targets found. Add a target to start testing.
          </p>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={15} />
            Add Your First Target
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "20px",
          }}
        >
          {targets.map((t) => (
            <div
              key={t.id}
              className="surface"
              style={{
                padding: "24px",
                display: "flex",
                flexDirection: "column",
              }}
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
                  <h3 style={{ fontSize: "16px", fontWeight: 600 }}>
                    {t.name}
                  </h3>
                  <p
                    style={{
                      color: "var(--text-tertiary)",
                      fontSize: "12px",
                      marginTop: "4px",
                    }}
                  >
                    {t.provider} · {t.model_name}
                  </p>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <div className={`status-dot ${t.status}`} />
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      textTransform: "capitalize",
                    }}
                  >
                    {t.status}
                  </span>
                </div>
              </div>

              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "13px",
                  lineHeight: 1.6,
                  flex: 1,
                  marginBottom: "16px",
                }}
              >
                {t.description || "No description provided."}
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "14px",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--text-tertiary)",
                  }}
                >
                  Added {formatDate(t.created_at)}
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="btn-danger btn-sm"
                    onClick={() => handleDelete(t.id)}
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => handleTest(t.id)}
                    disabled={testingId === t.id}
                  >
                    <Play size={13} />
                    {testingId === t.id ? "Testing..." : "Test"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Target Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h2 className="modal-title">Add New Target</h2>

            {formError && (
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
                {formError}
              </div>
            )}

            <form onSubmit={handleAddTarget}>
              <div style={{ marginBottom: "20px" }}>
                <label className="input-label">Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., My ChatBot"
                  className="input-field"
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label className="input-label">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="What does this model do?"
                  className="input-field"
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label className="input-label">Provider *</label>
                <select
                  required
                  value={form.provider}
                  onChange={(e) =>
                    setForm({ ...form, provider: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="ollama">Ollama (Local)</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="mistral">Mistral</option>
                  <option value="dummy">Dummy (Built-in)</option>
                  <option value="custom">Custom API</option>
                </select>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label className="input-label">Model Name *</label>
                <input
                  type="text"
                  required
                  value={form.model_name}
                  onChange={(e) =>
                    setForm({ ...form, model_name: e.target.value })
                  }
                  placeholder="e.g., llama3.2, gpt-4"
                  className="input-field"
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label className="input-label">Endpoint URL</label>
                <input
                  type="text"
                  value={form.endpoint_url}
                  onChange={(e) =>
                    setForm({ ...form, endpoint_url: e.target.value })
                  }
                  placeholder="http://localhost:11434 (for Ollama)"
                  className="input-field"
                />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label className="input-label">API Key</label>
                <input
                  type="password"
                  value={form.api_key}
                  onChange={(e) =>
                    setForm({ ...form, api_key: e.target.value })
                  }
                  placeholder="sk-... (for OpenAI/Anthropic)"
                  className="input-field"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormError("");
                  }}
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={formLoading}
                >
                  {formLoading ? "Adding..." : "Add Target"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
