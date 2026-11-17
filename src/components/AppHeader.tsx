import React from 'react';
import { useApp } from '../context/AppContext';
import { RingImage } from './RingImage';
import { Battery, Settings } from 'lucide-react';

export const AppHeader: React.FC = () => {
  const { openModal, t, ring, language } = useApp();
  const isEn = language === 'en';
  const batteryPct = ring.batteryRing ?? 88;
  const isConnected = ring.isConnected ?? true;

  return (
    <header className="app-header apple-header" aria-label="En-tête Aurel Labs">
      {/* Marque Apple-grade épurée */}
      <div className="header-brand-side">
        <span className="apple-brand-title">Aurel</span>
        <span className="apple-brand-badge">Labs</span>
      </div>

      {/* Capsule Apple Dynamic Island pour Aurel Ring One */}
      <div className="header-center-capsule">
        <button
          type="button"
          className="ring-capsule-btn"
          onClick={() => openModal('settings')}
          title={t('header.ring_title') || 'Aurel Ring One · Réglages & Diagnostics'}
          aria-label="Aurel Ring One"
        >
          <div className="ring-capsule-thumb">
            <RingImage size={24} noShadow angle="front" />
          </div>
          <div className="ring-capsule-status">
            <span
              className="ring-capsule-dot"
              style={{
                background: isConnected ? '#30D158' : '#FF453A',
                boxShadow: isConnected ? '0 0 8px rgba(48, 209, 88, 0.8)' : 'none',
              }}
            />
            <span className="ring-capsule-name">Ring One</span>
          </div>
          <div className="ring-capsule-battery">
            <Battery size={13} color={batteryPct <= 20 ? '#FF453A' : '#30D158'} />
            <span>{batteryPct}%</span>
          </div>
        </button>
      </div>

      {/* Bouton Réglages circulaire Apple Glass */}
      <div className="header-actions-side">
        <button
          type="button"
          className="apple-header-icon-btn"
          onClick={() => openModal('settings')}
          title={isEn ? 'Settings & Ring Management' : 'Réglages & Bague'}
          aria-label="Réglages"
        >
          <Settings size={17} strokeWidth={2.1} />
        </button>
      </div>
    </header>
  );
};
