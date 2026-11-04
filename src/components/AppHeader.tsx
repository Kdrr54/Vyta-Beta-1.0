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

      {/* Centre exact : Bouton Bague Stoic Ring One */}
      <div className="header-center-ring">
        <button
          type="button"
          className="ring-header-btn"
          onClick={() => openModal('settings')}
          title={t('header.ring_title') || 'Stoic Ring One · Réglages & Diagnostics'}
          aria-label={t('header.ring_title') || 'Stoic Ring One'}
        >
          <div className="ring-header-btn-inner">
            <RingImage size={34} noShadow angle="front" />
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
