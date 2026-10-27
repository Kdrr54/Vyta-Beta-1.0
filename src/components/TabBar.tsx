import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { HeartPulse, Moon, Flower2, Dumbbell, Settings } from 'lucide-react';

export const TabBar: React.FC = () => {
  const { tab, setTab, t, profile, modal, openModal, closeModal } = useApp();
  const isFemale = profile.sex === 'femme';
  const isSettingsOpen = modal === 'settings';

  useEffect(() => {
    if (!isFemale && tab === 'cycle') {
      setTab('health');
    }
  }, [isFemale, tab, setTab]);

  const handleTabPress = (targetTab: 'health' | 'sleep' | 'fit' | 'cycle') => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } catch (e) {}
    if (modal) {
      closeModal();
    }
    setTab(targetTab);
  };

  return (
    <nav className="apple-tab-bar" aria-label="Navigation principale">
      {/* 1. Santé */}
      <button
        type="button"
        className={`tab-item ${!isSettingsOpen && tab === 'health' ? 'active' : ''}`}
        onClick={() => handleTabPress('health')}
        aria-label={t('tab.health')}
        style={{
          color: !isSettingsOpen && tab === 'health' ? '#D9F970' : undefined,
        }}
      >
        <HeartPulse size={19} strokeWidth={!isSettingsOpen && tab === 'health' ? 2.2 : 1.7} />
        <span className="tab-label">{t('tab.health')}</span>
      </button>

      {/* 2. Sommeil */}
      <button
        type="button"
        className={`tab-item ${!isSettingsOpen && tab === 'sleep' ? 'active' : ''}`}
        onClick={() => handleTabPress('sleep')}
        aria-label={t('tab.sleep')}
        style={{
          color: !isSettingsOpen && tab === 'sleep' ? '#A78BFA' : undefined,
        }}
      >
        <Moon size={19} strokeWidth={!isSettingsOpen && tab === 'sleep' ? 2.2 : 1.7} />
        <span className="tab-label">{t('tab.sleep')}</span>
      </button>

      {/* 3. Activité */}
      <button
        type="button"
        className={`tab-item ${!isSettingsOpen && tab === 'fit' ? 'active' : ''}`}
        onClick={() => handleTabPress('fit')}
        aria-label={t('tab.fit')}
        style={{ color: !isSettingsOpen && tab === 'fit' ? '#D9F970' : undefined }}
      >
        <Dumbbell size={19} strokeWidth={!isSettingsOpen && tab === 'fit' ? 2.2 : 1.7} />
        <span className="tab-label">{t('tab.fit')}</span>
      </button>

      {/* 4. Cycle pour les femmes */}
      {isFemale && (
        <button
          type="button"
          className={`tab-item ${!isSettingsOpen && tab === 'cycle' ? 'active' : ''}`}
          onClick={() => handleTabPress('cycle')}
          aria-label={t('tab.cycle')}
          style={{ color: !isSettingsOpen && tab === 'cycle' ? '#E879F9' : undefined }}
        >
          <Flower2 size={19} strokeWidth={!isSettingsOpen && tab === 'cycle' ? 2.2 : 1.7} />
          <span className="tab-label">{t('tab.cycle')}</span>
        </button>
      )}

      {/* 5. Réglages (uniquement disponible pour les profils hommes car pour les profils femmes l'accès se fait via le bouton bague en haut) */}
      {!isFemale && (
        <button
          type="button"
          className={`tab-item ${isSettingsOpen ? 'active' : ''}`}
          onClick={() => {
            try {
              if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(10);
              }
            } catch (e) {}
            if (isSettingsOpen) {
              closeModal();
            } else {
              openModal('settings');
            }
          }}
          aria-label={t('settings.title')}
          title={t('settings.title')}
          style={{ color: isSettingsOpen ? '#D9F970' : undefined }}
        >
          <Settings size={19} strokeWidth={isSettingsOpen ? 2.2 : 1.7} />
          <span className="tab-label">{t('settings.title')}</span>
        </button>
      )}
    </nav>
  );
};
