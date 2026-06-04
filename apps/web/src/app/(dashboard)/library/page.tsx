"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

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
      const data = await apiFetch('/attacks/categories');
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
      case 'critical': case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'info';
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attack Library</h1>
          <p className="page-description">Browse the collection of security test payloads used by AYZO.</p>
        </div>
        <div className="badge info" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
          {categories.reduce((acc, c) => acc + c.attack_count, 0)} total payloads
        </div>
      </div>

      {loading ? (
        <p className="text-muted" style={{ padding: '2rem' }}>Loading attack library...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>
          
          {/* Categories Sidebar */}
          <div className="glass-panel" style={{ padding: '1rem', alignSelf: 'start' }}>
            <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', paddingLeft: '0.5rem' }}>Categories</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)',
                    background: selectedCategory === cat.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                    color: selectedCategory === cat.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: selectedCategory === cat.id ? 500 : 400,
                    transition: 'all 150ms', display: 'flex', justifyContent: 'space-between',
                    cursor: 'pointer',
                    border: selectedCategory === cat.id ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid transparent',
                  }}
                >
                  <span>{cat.name}</span>
                  <span className="text-muted">{cat.attack_count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Payload List */}
          <div>
            {selectedCat && (
              <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem' }}>{selectedCat.name}</h2>
                  <p className="text-secondary" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{selectedCat.owasp_id || 'OWASP LLM Top 10'}</p>
                </div>
                {selectedCat.description && (
                  <div className="badge warning">High Risk Category</div>
                )}
              </div>
            )}

            {payloadsLoading ? (
              <p className="text-muted">Loading payloads...</p>
            ) : payloads.length === 0 ? (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                <p className="text-muted">No payloads found for this category.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {payloads.map((payload, idx) => (
                  <div key={idx} className="glass-panel" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{payload.name}</h3>
                        {payload.subcategory && (
                          <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>{payload.subcategory}</p>
                        )}
                      </div>
                      <span className={`badge ${getSeverityBadge(payload.severity)}`}>{payload.severity}</span>
                    </div>

                    {payload.description && (
                      <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                        {payload.description}
                      </p>
                    )}
                    
                    <div style={{
                      background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem', color: '#e4e4e7', marginBottom: '1rem',
                      maxHeight: '120px', overflowY: 'auto', whiteSpace: 'pre-wrap'
                    }}>
                      {payload.original_prompt}
                    </div>
                    
                    {payload.success_indicators && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--status-success)' }}>✓ Success indicator:</span> {payload.success_indicators}
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
