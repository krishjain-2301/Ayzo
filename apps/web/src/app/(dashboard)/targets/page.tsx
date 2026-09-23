"use client";
import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import { Plus, Trash2, Play, AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import clsx from "clsx";

interface Target {
  id: string;
  name: string;
  description: string | null;
  project_path: string;
  start_command: string;
  target_port: number;
  status: string;
  created_at: string;
  updated_at: string;
}

function TargetsContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.toLowerCase() || "";
  
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
    project_path: "",
    start_command: "",
    target_port: 3000,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [sourceMode, setSourceMode] = useState<"path" | "upload">("path");
  const [folderFiles, setFolderFiles] = useState<FileList | null>(null);

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

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      project_path: "",
      start_command: "",
      target_port: 3000,
    });
    setFolderFiles(null);
    setSourceMode("path");
  };

  const handleAddTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    try {
      if (sourceMode === "upload") {
        if (!folderFiles || folderFiles.length === 0) {
          throw new Error("Choose a project folder to upload.");
        }
        const body = new FormData();
        body.append("name", form.name);
        body.append("description", form.description);
        body.append("start_command", form.start_command);
        body.append("target_port", String(form.target_port));
        for (const file of Array.from(folderFiles)) {
          const relative = file.webkitRelativePath || file.name;
          body.append("files", file, relative);
        }
        const response = await fetch(`${API_BASE_URL}/targets/upload`, {
          method: "POST",
          body,
        });
        if (!response.ok) {
          let message = "Upload failed";
          try {
            const data = await response.json();
            message = typeof data.detail === "string" ? data.detail : message;
          } catch {
            /* keep default */
          }
          throw new Error(message);
        }
      } else {
        await apiFetch("/targets", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }
      setShowAddModal(false);
      resetForm();
      loadTargets();
    } catch (err: any) {
      setFormError(err.message || "Failed to add target");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this target?")) return;
    try {
      await apiFetch(`/targets/${id}`, { method: "DELETE" });
      loadTargets();
    } catch (e) {
      alert("Failed to delete target.");
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await apiFetch(`/targets/${id}/test`, {
        method: "POST",
      });
      setTestResult({ id, success: res.success, message: res.message });
      loadTargets();
    } catch (e: any) {
      setTestResult({ id, success: false, message: e.message || "Connection failed" });
      loadTargets();
    } finally {
      setTestingId(null);
    }
  };

  const filteredTargets = targets.filter(t => 
    t.name.toLowerCase().includes(query) || 
    (t.description && t.description.toLowerCase().includes(query)) ||
    t.project_path.toLowerCase().includes(query) ||
    t.start_command.toLowerCase().includes(query)
  );

  return (
    <div className="max-w-6xl">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white tracking-tight">AI Targets</h1>
          <p className="text-zinc-400 text-sm mt-1">Manage the LLMs and agents you want to assess.</p>
        </div>
        <button
          className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-all hover:shadow-[0_0_20px_rgba(124,58,237,0.3)]"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={16} /> Add Target
        </button>
      </div>

      {testResult && (
        <div className={clsx(
          "mb-6 p-4 rounded-xl flex items-center justify-between border",
          testResult.success ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"
        )}>
          <div className="flex items-center gap-3">
            {testResult.success ? (
              <CheckCircle2 className="text-green-500 w-5 h-5" />
            ) : (
              <AlertCircle className="text-red-500 w-5 h-5" />
            )}
            <span className="text-sm">
              <strong className={testResult.success ? "text-green-400" : "text-red-400"}>
                {testResult.success ? "Connected" : "Failed"}:
              </strong>{" "}
              <span className="text-zinc-300">{testResult.message}</span>
            </span>
          </div>
          <button
            className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            onClick={() => setTestResult(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500 py-10 animate-pulse text-center">Loading targets...</p>
      ) : targets.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl text-center py-16">
          <p className="text-zinc-500 mb-6 text-sm">No targets found. Add a target to start testing.</p>
          <button
            className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 mx-auto transition-all"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} /> Add Your First Target
          </button>
        </div>
      ) : filteredTargets.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl text-center py-16">
          <p className="text-zinc-500 text-sm">No targets match "{searchParams.get("q")}".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTargets.map((t) => (
            <div
              key={t.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col group hover:border-violet-500/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-heading text-lg font-bold text-white group-hover:text-violet-400 transition-colors">{t.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1 tracking-wider font-mono bg-black px-2 py-0.5 rounded border border-zinc-800 w-max">
                    {t.start_command} : {t.target_port}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={clsx(
                    "w-2 h-2 rounded-full",
                    t.status === "active" ? "bg-green-500" : t.status === "error" ? "bg-red-500" : "bg-amber-500"
                  )} />
                  <span className="text-xs text-zinc-400 capitalize">{t.status}</span>
                </div>
              </div>
              
              <p className="text-sm text-zinc-400 flex-1 mb-6">
                {t.description || "No description provided."}
              </p>

              <div className="flex justify-between items-center pt-4 border-t border-zinc-800/50">
                <button
                  className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                  onClick={() => handleTestConnection(t.id)}
                  disabled={testingId === t.id}
                >
                  <Play size={14} className={testingId === t.id ? "animate-pulse text-violet-400" : ""} />
                  {testingId === t.id ? "Testing..." : "Test Connection"}
                </button>
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  onClick={() => handleDelete(t.id)}
                  title="Delete Target"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-8 shadow-2xl">
            <h2 className="font-heading text-xl font-bold text-white mb-6">Add New Target</h2>
            
            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddTarget} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSourceMode("path")}
                  className={clsx(
                    "rounded-lg px-3 py-2 text-sm border",
                    sourceMode === "path" ? "border-violet-500 text-white bg-violet-600/20" : "border-zinc-800 text-zinc-400"
                  )}
                >
                  Path on this machine
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode("upload")}
                  className={clsx(
                    "rounded-lg px-3 py-2 text-sm border",
                    sourceMode === "upload" ? "border-violet-500 text-white bg-violet-600/20" : "border-zinc-800 text-zinc-400"
                  )}
                >
                  Upload folder
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Project Name</label>
                <input
                  type="text"
                  required
                  className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. My RAG Application"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Description (Optional)</label>
                <input
                  type="text"
                  className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What does this project do?"
                />
              </div>

              {sourceMode === "path" ? (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Project Directory Path</label>
                <input
                  type="text"
                  className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all font-mono"
                  value={form.project_path}
                  onChange={(e) => setForm({ ...form, project_path: e.target.value })}
                  placeholder="C:\Projects\MyApp"
                />
                <p className="text-xs text-zinc-500 mt-1">Must already exist on the computer running the API. Leave blank only when the app is already running.</p>
              </div>
              ) : (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Project folder</label>
                <input
                  type="file"
                  multiple
                  required
                  className="w-full text-sm text-zinc-300 file:mr-3 file:rounded-full file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                  onChange={(e) => setFolderFiles(e.target.files)}
                  {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
                />
                <p className="text-xs text-zinc-500 mt-1">
                  {folderFiles?.length ? `${folderFiles.length} files selected.` : "Select the project folder. It is stored next to the API and used as the working directory."}
                  {" "}`.env`, `.git`, and `node_modules` are skipped.
                </p>
              </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Start Command</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all font-mono"
                    value={form.start_command}
                    onChange={(e) => setForm({ ...form, start_command: e.target.value })}
                    placeholder="python app.py  or  already running"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Use &quot;already running&quot; to skip boot and hit the port.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Port</label>
                  <input
                    type="number"
                    required
                    className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all font-mono"
                    value={form.target_port}
                    onChange={(e) => setForm({ ...form, target_port: Number(e.target.value) })}
                    placeholder="3000"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  className="px-5 py-2 rounded-full text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2 rounded-full text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {formLoading ? "Saving..." : "Add Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TargetsPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl p-10 text-center animate-pulse text-zinc-500">Loading targets...</div>}>
      <TargetsContent />
    </Suspense>
  );
}
