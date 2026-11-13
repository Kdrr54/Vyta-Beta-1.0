import React from 'react';
import { useApp } from '../context/AppContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { queryPrismAI } from '../lib/prismService';
import { weekMetrics, TODAY_INDEX, emptyDayMetrics } from '../data/health';
import MorphOrb from './ui/ai-thiking-orb-and-input';
import { X } from 'lucide-react';

interface PrismModalProps {
  onClose: () => void;
}

export const PrismModal: React.FC<PrismModalProps> = ({ onClose }) => {
  const { profile, selectedDay, language, weekData, isFirstLaunch } = useApp();
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const isEn = language === 'en';

  const dayData =
    (weekData && weekData[selectedDay]) ||
    (isFirstLaunch ? emptyDayMetrics : weekMetrics[selectedDay] || weekMetrics[TODAY_INDEX]);
  const dayName = isEn ? 'Today' : "Aujourd'hui";

  const handleSubmit = async (text: string): Promise<string> => {
    try {
      const res = await queryPrismAI({
        prompt: text,
        profile,
        dayData,
        dayName,
        isToday: true,
        language: isEn ? 'en' : 'fr',
      });
      if (res.error) {
        return isEn ? `Error: ${res.error}` : `Erreur : ${res.error}`;
      }
      return res.text || (isEn ? 'Biometric analysis completed.' : 'Analyse biométrique terminée.');
    } catch (e: any) {
      return isEn
        ? `Network error: ${e?.message || 'Unable to connect to AI'}`
        : `Erreur réseau : ${e?.message || 'Impossible de joindre l’IA'}`;
    }
  };

  return (
    <div
      className={`modal-backdrop ${isClosing ? 'is-closing' : ''}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      style={{
        zIndex: 1200,
        position: 'fixed',
        inset: 0,
        background: '#07070A',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={handleClose}
        aria-label="Fermer"
        style={{
          position: 'absolute',
          top: 'max(env(safe-area-inset-top, 0px), 52px)',
          right: '20px',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          color: '#FAF7F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 40,
        }}
      >
        <X size={18} />
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MorphOrb onSubmit={handleSubmit} />
      </div>
    </div>
  );
};
