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
          className={`glass-panel`}
          style={{
            padding: '1rem 1.5rem', marginBottom: '1.5rem',
            borderLeft: `4px solid ${testResult.success ? 'var(--status-success)' : 'var(--status-danger)'}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}
        >
          <span>
            <strong>{testResult.success ? '✅ Connected!' : '❌ Failed:'}</strong>{' '}
            {testResult.message}
          </span>
          <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }} onClick={() => setTestResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-muted" style={{ padding: '2rem' }}>Loading targets...</p>
      ) : targets.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>No targets found. Add a target to start testing!</p>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Add Your First Target</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {targets.map((t) => (
            <div key={t.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{t.name}</h3>
                  <p className="text-muted" style={{ fontSize: '0.875rem' }}>{t.provider} • {t.model_name}</p>
                </div>
                <span className={`badge ${t.status === 'active' ? 'success' : t.status === 'error' ? 'danger' : 'warning'}`}>
                  {t.status}
                </span>
              </div>
              
              <div style={{ flex: 1, marginBottom: '1.5rem' }}>
                <p className="text-secondary" style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
                  {t.description || 'No description provided.'}
                </p>
              </div>

              <div style={{ display: 'flex', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Added {formatDate(t.created_at)}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn-danger"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={() => handleDelete(t.id)}
                  >
                    Delete
                  </button>
                  <button
                    className="btn-primary"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
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
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: '500px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Add New Target</h2>
            
            {formError && <div className="badge danger" style={{ marginBottom: '1rem', display: 'block' }}>{formError}</div>}
            
            <form onSubmit={handleAddTarget}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Name *</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="e.g., My ChatBot" style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="What does this model do?" style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Provider *</label>
                <select required value={form.provider} onChange={(e) => setForm({...form, provider: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}>
                  <option value="ollama" style={{ background: '#1a1a1a' }}>Ollama (Local)</option>
                  <option value="openai" style={{ background: '#1a1a1a' }}>OpenAI</option>
                  <option value="anthropic" style={{ background: '#1a1a1a' }}>Anthropic</option>
                  <option value="mistral" style={{ background: '#1a1a1a' }}>Mistral</option>
                  <option value="dummy" style={{ background: '#1a1a1a' }}>Dummy (Built-in)</option>
                  <option value="custom" style={{ background: '#1a1a1a' }}>Custom API</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Model Name *</label>
                <input type="text" required value={form.model_name} onChange={(e) => setForm({...form, model_name: e.target.value})} placeholder="e.g., llama3.2, gpt-4" style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Endpoint URL</label>
                <input type="text" value={form.endpoint_url} onChange={(e) => setForm({...form, endpoint_url: e.target.value})} placeholder="http://localhost:11434 (for Ollama)" style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>API Key</label>
                <input type="password" value={form.api_key} onChange={(e) => setForm({...form, api_key: e.target.value})} placeholder="sk-... (for OpenAI/Anthropic)" style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
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
