"use client";
import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';

interface RunAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string | null;
  onSuccess: () => void;
}

export function RunAssessmentModal({ isOpen, onClose, targetId, onSuccess }: RunAssessmentModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) {
      setError("No target available to test.");
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
          attack_categories: ["prompt_injection"],
          mutation_depth: 0,
          mutations_per_prompt: 1
        })
      });
      
      onSuccess();
      onClose();
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
      <div className="glass-panel" style={{ width: '400px', padding: '2rem' }}>
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

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Target
            </label>
            <div style={{
                width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.1)', border: '1px solid var(--primary-dark)',
                color: 'white'
              }}>
              🤖 Vulnerable Support Bot (Internal)
            </div>
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
