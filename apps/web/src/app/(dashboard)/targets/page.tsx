"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

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
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Add Target form state
  const [form, setForm] = useState({
    name: '', description: '', provider: 'ollama', model_name: '', endpoint_url: '', api_key: ''
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const loadTargets = useCallback(async () => {
    try {
      const data = await apiFetch('/targets');
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
    setFormError('');
    try {
      await apiFetch('/targets', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          provider: form.provider,
          model_name: form.model_name,
          endpoint_url: form.endpoint_url || null,
          api_key: form.api_key || null,
        })
      });
      setShowAddModal(false);
      setForm({ name: '', description: '', provider: 'ollama', model_name: '', endpoint_url: '', api_key: '' });
      await loadTargets();
    } catch (err: any) {
      setFormError(err.message || 'Failed to add target');
    } finally {
      setFormLoading(false);
    }
  };

  const handleTest = async (targetId: string) => {
    setTestingId(targetId);
    setTestResult(null);
    try {
      const result = await apiFetch(`/targets/${targetId}/test`, { method: 'POST' });
      setTestResult({ id: targetId, ...result });
      await loadTargets();
    } catch (err: any) {
      setTestResult({ id: targetId, success: false, message: err.message });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (targetId: string) => {
    if (!confirm('Are you sure you want to delete this target?')) return;
    try {
      await apiFetch(`/targets/${targetId}`, { method: 'DELETE' });
      await loadTargets();
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Targets</h1>
          <p className="page-description">Manage the AI models you want to test for vulnerabilities.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          + Add Target
        </button>
      </div>

      {/* Test Result Toast */}
      {testResult && (
        <div
          className="glass-panel px-6 py-4 mb-6 flex justify-between items-center"
          style={{ borderLeft: `4px solid ${testResult.success ? 'var(--status-success)' : 'var(--status-danger)'}` }}
        >
          <span>
            <strong>{testResult.success ? '✅ Connected!' : '❌ Failed:'}</strong>{' '}
            {testResult.message}
          </span>
          <button className="btn-secondary py-2 px-4 text-xs" onClick={() => setTestResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-muted p-8">Loading targets...</p>
      ) : targets.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <p className="text-muted mb-4">No targets found. Add a target to start testing!</p>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Add Your First Target</button>
        </div>
      ) : (
        <div className="grid grid-auto-fit-lg gap-6">
          {targets.map((t) => (
            <div key={t.id} className="glass-panel p-6 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{t.name}</h3>
                  <p className="text-muted text-sm">{t.provider} • {t.model_name}</p>
                </div>
                <span className={`badge ${t.status === 'active' ? 'success' : t.status === 'error' ? 'danger' : 'warning'}`}>
                  {t.status}
                </span>
              </div>
              
              <div className="flex-1 mb-6">
                <p className="text-secondary text-sm leading-none" style={{ lineHeight: 1.6 }}>
                  {t.description || 'No description provided.'}
                </p>
              </div>

              <div className="flex justify-between items-center pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <div className="text-xs text-muted">
                  Added {formatDate(t.created_at)}
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-danger py-2 px-4 text-xs"
                    onClick={() => handleDelete(t.id)}
                  >
                    Delete
                  </button>
                  <button
                    className="btn-primary py-2 px-4 text-sm"
                    onClick={() => handleTest(t.id)}
                    disabled={testingId === t.id}
                  >
                    {testingId === t.id ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Target Modal */}
      {showAddModal && (
        <div className="flex items-center justify-center" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000
        }}>
          <div className="glass-panel p-8" style={{ width: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="text-2xl mb-6">Add New Target</h2>
            
            {formError && <div className="badge danger mb-4 flex">{formError}</div>}
            
            <form onSubmit={handleAddTarget}>
              <div className="mb-6">
                <label className="block mb-2 text-sm text-secondary">Name *</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="e.g., My ChatBot" className="input-field" />
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-sm text-secondary">Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="What does this model do?" className="input-field" />
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-sm text-secondary">Provider *</label>
                <select required value={form.provider} onChange={(e) => setForm({...form, provider: e.target.value})} className="input-field">
                  <option value="ollama" style={{ background: '#1a1a1a' }}>Ollama (Local)</option>
                  <option value="openai" style={{ background: '#1a1a1a' }}>OpenAI</option>
                  <option value="anthropic" style={{ background: '#1a1a1a' }}>Anthropic</option>
                  <option value="mistral" style={{ background: '#1a1a1a' }}>Mistral</option>
                  <option value="dummy" style={{ background: '#1a1a1a' }}>Dummy (Built-in)</option>
                  <option value="custom" style={{ background: '#1a1a1a' }}>Custom API</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-sm text-secondary">Model Name *</label>
                <input type="text" required value={form.model_name} onChange={(e) => setForm({...form, model_name: e.target.value})} placeholder="e.g., llama3.2, gpt-4" className="input-field" />
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-sm text-secondary">Endpoint URL</label>
                <input type="text" value={form.endpoint_url} onChange={(e) => setForm({...form, endpoint_url: e.target.value})} placeholder="http://localhost:11434 (for Ollama)" className="input-field" />
              </div>

              <div className="mb-8">
                <label className="block mb-2 text-sm text-secondary">API Key</label>
                <input type="password" value={form.api_key} onChange={(e) => setForm({...form, api_key: e.target.value})} placeholder="sk-... (for OpenAI/Anthropic)" className="input-field" />
              </div>

              <div className="flex justify-end gap-4">
                <button type="button" className="btn-secondary" onClick={() => { setShowAddModal(false); setFormError(''); }} disabled={formLoading}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={formLoading}>{formLoading ? 'Adding...' : 'Add Target'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
