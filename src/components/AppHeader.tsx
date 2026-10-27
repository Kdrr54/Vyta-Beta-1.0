import React from 'react';
import { useApp } from '../context/AppContext';
import { RingImage } from './RingImage';

export const AppHeader: React.FC = () => {
  const { openModal, t, ring } = useApp();

  return (
    <header className="app-header header-roman" aria-label="En-tête de l'application">
      {/* Pilier romain horizontal gauche */}
      <div className="header-pillar-slot left-slot">
        <img
          src="/assets/roman-pillar-horizontal.png"
          alt="Pilier Romain Gauche"
          className="header-pillar-h pillar-left"
        />
      </div>

      {/* Centre exact : Bouton Bague Vyta One */}
      <div className="header-center-ring">
        <button
          type="button"
          className="ring-header-btn"
          onClick={() => openModal('settings')}
          title={t('header.ring_title') || 'Bague Vyta One · Réglages & Diagnostics'}
          aria-label={t('header.ring_title') || 'Bague Vyta One'}
        >
          <div className="ring-header-btn-inner">
            <RingImage size={34} noShadow angle="front" />
            <span
              className="ring-connected-indicator"
              style={{
                background: !ring.isConnected
                  ? '#8E8E93'
                  : (ring.batteryRing <= 20 ? '#FF5A52' : '#30D158'),
                boxShadow: ring.isConnected
                  ? (ring.batteryRing <= 20 ? '0 0 6px rgba(255, 90, 82, 0.8)' : '0 0 6px rgba(48, 209, 88, 0.8)')
                  : 'none',
              }}
              title={
                ring.isConnected
                  ? `Bluetooth 5.4 Connecté · Batterie ${ring.batteryRing}%`
                  : 'Bague déconnectée · En attente de connexion'
              }
            />
          </div>
        </button>
      </div>

      {/* Pilier romain horizontal droit */}
      <div className="header-pillar-slot right-slot">
        <img
          src="/assets/roman-pillar-horizontal.png"
          alt="Pilier Romain Droit"
          className="header-pillar-h pillar-right"
        />
      </div>
    </header>
  );
};
