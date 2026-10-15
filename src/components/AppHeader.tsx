import React from 'react';
import { useApp } from '../context/AppContext';
import { Battery, Lock, Sparkles } from 'lucide-react';
import { RingImage } from './RingImage';

export const AppHeader: React.FC = () => {
  const { ring, covytaActive, setCovytaActive, openModal } = useApp();

  return (
    <header className="app-header" aria-label="En-tête de l'application">
      <div className="header-left-chips">
        {/* Uniquement le % de batterie */}
        <div className="status-chip battery-chip" title={`Batterie bague : ${ring.batteryRing}%`}>
          <Battery size={14} strokeWidth={2.2} />
          <span>{ring.batteryRing}%</span>
        </div>
      </div>

      <div className="header-right-actions">
        {/* Switch rapide CoVyta OFF / CoVyta ON */}
        <button
          type="button"
          className={`covyta-switch-pill ${covytaActive ? 'active' : ''}`}
          onClick={() => setCovytaActive(!covytaActive)}
          title="Bascule rapide du mode CoVyta IA"
          role="switch"
          aria-checked={covytaActive}
        >
          {covytaActive ? (
            <>
              <Sparkles size={12} className="switch-sparkle" />
              <span>CoVyta ON</span>
            </>
          ) : (
            <>
              <Lock size={11} />
              <span>CoVyta OFF</span>
            </>
          )}
        </button>

        {/* Bouton Bague Vyta (remplace l'engrenage) */}
        <button
          type="button"
          className="ring-header-btn"
          onClick={() => openModal('settings')}
          title="Bague Vyta One (R21) • Réglages & Diagnostics"
          aria-label="Bague Vyta One"
        >
          <div className="ring-header-btn-inner">
            <RingImage size={28} noShadow angle="front" />
            <span className="ring-connected-indicator" title="Connectée en Bluetooth 5.4" />
          </div>
        </button>
      </div>
    </header>
  );
};
