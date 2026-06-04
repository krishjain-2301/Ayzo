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
        <div className="badge info py-2 px-4 text-sm">
          {categories.reduce((acc, c) => acc + c.attack_count, 0)} total payloads
        </div>
      </div>

      {loading ? (
        <p className="text-muted p-8">Loading attack library...</p>
      ) : (
        <div className="grid gap-8" style={{ gridTemplateColumns: '250px 1fr' }}>
          
          {/* Categories Sidebar */}
          <div className="glass-panel p-4 self-start">
            <h3 className="text-sm uppercase text-muted mb-4 pl-2">Categories</h3>
            <div className="flex flex-col gap-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`text-left py-2 px-3 rounded-sm transition-all flex justify-between cursor-pointer ${
                    selectedCategory === cat.id 
                      ? 'bg-glass-dark text-primary font-medium border border-accent-primary/20' 
                      : 'bg-transparent text-secondary font-normal border border-transparent'
                  }`}
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
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl">{selectedCat.name}</h2>
                  <p className="text-secondary text-sm mt-1">{selectedCat.owasp_id || 'OWASP LLM Top 10'}</p>
                </div>
                {selectedCat.description && (
                  <div className="badge warning">High Risk Category</div>
                )}
              </div>
            )}

            {payloadsLoading ? (
              <p className="text-muted">Loading payloads...</p>
            ) : payloads.length === 0 ? (
              <div className="glass-panel p-12 text-center">
                <p className="text-muted">No payloads found for this category.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {payloads.map((payload, idx) => (
                  <div key={idx} className="glass-panel p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">{payload.name}</h3>
                        {payload.subcategory && (
                          <p className="text-muted text-xs mt-1">{payload.subcategory}</p>
                        )}
                      </div>
                      <span className={`badge ${getSeverityBadge(payload.severity)}`}>{payload.severity}</span>
                    </div>

                    {payload.description && (
                      <p className="text-secondary text-sm mb-4">
                        {payload.description}
                      </p>
                    )}
                    
                    <div className="bg-glass-dark p-4 rounded-sm border border-subtle font-mono text-sm text-primary mb-4 overflow-y-auto whitespace-pre-wrap" style={{ maxHeight: '120px' }}>
                      {payload.original_prompt}
                    </div>
                    
                    {payload.success_indicators && (
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span className="text-success">✓ Success indicator:</span> {payload.success_indicators}
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
