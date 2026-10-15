import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { BiologicalSex } from '../types';
import { X, Battery, Radio, User, Disc, Check, Volume2, Search } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { profile, updateProfile, ring } = useApp();

  // Find My Ring radar simulation state
  const [radarScanning] = useState<boolean>(true);

  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (params?.get('scroll') === 'radar') {
      const scrollNow = () => {
        const sheet = document.querySelector('.modal-sheet');
        if (sheet) sheet.scrollTop = sheet.scrollHeight;
      };
      scrollNow();
      setTimeout(scrollNow, 100);
      setTimeout(scrollNow, 300);
    }
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Paramètres Système
            </span>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
              Réglages
            </h2>
          </div>

          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        {/* ================= 1. BIOMÉTRIE ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={15} color="#FFFFFF" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>
              Profil Biométrique
            </span>
          </div>

          {/* Sexe biologique switch (Femme / Homme) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              Sexe Biologique (pilote le module Cycle Féminin)
            </span>
            <div className="segmented-control" style={{ marginBottom: 0 }}>
              <button
                type="button"
                className={`segmented-btn ${profile.sex === 'femme' ? 'active' : ''}`}
                onClick={() => updateProfile({ sex: 'femme' })}
              >
                Femme
              </button>
              <button
                type="button"
                className={`segmented-btn ${profile.sex === 'homme' ? 'active' : ''}`}
                onClick={() => updateProfile({ sex: 'homme' })}
              >
                Homme
              </button>
            </div>
          </div>

          {/* Inputs grid: Prénom, Âge, Taille, Poids */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Prénom</span>
              <input
                type="text"
                className="chat-input"
                style={{ padding: '8px 10px' }}
                value={profile.firstName}
                onChange={(e) => updateProfile({ firstName: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Âge (ans)</span>
              <input
                type="number"
                className="chat-input"
                style={{ padding: '8px 10px' }}
                value={profile.age}
                onChange={(e) => updateProfile({ age: Number(e.target.value) || 28 })}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Taille (cm)</span>
              <input
                type="number"
                className="chat-input"
                style={{ padding: '8px 10px' }}
                value={profile.heightCm}
                onChange={(e) => updateProfile({ heightCm: Number(e.target.value) || 180 })}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Poids (kg)</span>
              <input
                type="number"
                className="chat-input"
                style={{ padding: '8px 10px' }}
                value={profile.weightKg}
                onChange={(e) => updateProfile({ weightKg: Number(e.target.value) || 75 })}
              />
            </div>
          </div>
        </div>

        {/* ================= 2. MA BAGUE (VYTA ONE) ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Disc size={15} color="#FFFFFF" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>
                Ma Bague (Vyta One R21)
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              Taille {ring.ringSize}
            </span>
          </div>

          {/* Niveaux de batterie bague + boîtier */}
          <div className="metrics-grid-2">
            <div className="metric-card" style={{ minHeight: '80px', padding: '12px' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Batterie Bague</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span className="metric-large" style={{ fontSize: '22px' }}>{ring.batteryRing}%</span>
                <span style={{ fontSize: '11px', color: 'var(--accent-green)' }}>5 jours restants</span>
              </div>
            </div>

            <div className="metric-card" style={{ minHeight: '80px', padding: '12px' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Boîtier Nomade</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span className="metric-large" style={{ fontSize: '22px' }}>{ring.batteryCase}%</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>4 recharges</span>
              </div>
            </div>
          </div>


          {/* Radar interactif « Find My Ring » */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Radio size={14} color="var(--gold)" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#FFFFFF' }}>
                  Localiser ma Bague (Find My Ring)
                </span>
              </div>
            </div>

            {/* Radar Visual Stage */}
            <div className="radar-stage">
              {radarScanning && (
                <>
                  <div className="radar-wave" />
                  <div className="radar-wave" />
                  <div className="radar-wave" />
                </>
              )}
              <div className="radar-center-ring">
                <Disc size={18} color="#000000" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
