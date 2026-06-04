"use client";
import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

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

export function RunAssessmentModal({ isOpen, onClose, targetId, targetName, onSuccess }: RunAssessmentModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<AttackCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [mutationDepth, setMutationDepth] = useState(1);

  useEffect(() => {
    if (isOpen) {
      apiFetch('/attacks/categories')
        .then((cats: AttackCategory[]) => {
          setCategories(cats);
          // Select all by default
          setSelectedCategories(cats.map((c) => c.id));
        })
        .catch(() => {
          // Fallback categories if API fails
          setSelectedCategories(['prompt_injection']);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
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
    setError('');
    
    try {
      await apiFetch('/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: name || "Quick Assessment",
          description: "Automated scan from dashboard",
          target_id: targetId,
          attack_categories: selectedCategories,
          mutation_depth: mutationDepth,
          mutations_per_prompt: mutationDepth > 0 ? 3 : 1
        })
      });
      
      onSuccess();
      onClose();
      setName('');
    } catch (err: any) {
      setError(err.message || "Failed to start campaign");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="glass-panel" style={{ width: '500px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Run Assessment</h2>
        
        {error && <div className="badge danger" style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Campaign Name
            </label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Weekly Security Scan"
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'white', outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Target
            </label>
            <div style={{
                width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.1)', border: '1px solid var(--primary-dark)',
                color: 'white'
              }}>
              🤖 {targetName || 'Selected Target'}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Attack Categories
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {categories.length > 0 ? categories.map((cat) => (
                <label
                  key={cat.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)',
                    background: selectedCategories.includes(cat.id) ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${selectedCategories.includes(cat.id) ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.05)'}`,
                    cursor: 'pointer', transition: 'all 150ms',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{cat.name}</span>
                    <span className="text-muted" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                      ({cat.attack_count} attacks)
                    </span>
                  </div>
                </label>
              )) : (
                <p className="text-muted" style={{ fontSize: '0.875rem' }}>Loading categories...</p>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Mutation Depth
            </label>
            <select
              value={mutationDepth}
              onChange={(e) => setMutationDepth(Number(e.target.value))}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'white', outline: 'none'
              }}
            >
              <option value={0} style={{ background: '#1a1a1a' }}>0 — Original prompts only (fastest)</option>
              <option value={1} style={{ background: '#1a1a1a' }}>1 — One round of mutations</option>
              <option value={2} style={{ background: '#1a1a1a' }}>2 — Two rounds (thorough)</option>
              <option value={3} style={{ background: '#1a1a1a' }}>3 — Maximum depth (slowest)</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Launching...' : 'Launch Attack'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
