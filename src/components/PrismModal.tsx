import React from 'react';
import { useApp } from '../context/AppContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { queryPrismAI } from '../lib/prismService';
import { weekMetrics, TODAY_INDEX, emptyDayMetrics } from '../data/health';
import MorphOrb from './ui/ai-thiking-orb-and-input';
import { X, Sparkles } from 'lucide-react';

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

  const handleMorphSubmit = async (text: string): Promise<string> => {
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
        return isEn
          ? `Zénon encountered a connection error: ${res.error}. Please check network connection.`
          : `Zénon a rencontré une erreur de connexion : ${res.error}. Vérifiez votre connexion internet.`;
      }
      return res.text || (isEn ? 'Biometric analysis completed.' : 'Analyse biométrique terminée.');
    } catch (e: any) {
      return isEn
        ? `Network error: ${e?.message || 'Unable to connect to Zénon'}`
        : `Erreur réseau : ${e?.message || 'Impossible de joindre Zénon'}`;
    }
  };

  const copy = isEn
    ? {
        placeholder: 'Ask Zénon anything…',
        labels: ['Biometrics', 'Cross-referencing', 'Clinical synthesis', 'Composing'],
        done: 'Done',
        answerTitle: 'Zénon · Biological Intelligence',
        reset: 'New question',
        send: 'Send',
      }
    : {
        placeholder: 'Posez votre question à Zénon…',
        labels: ['Analyse biométrique', 'Recoupement', 'Synthèse clinique', 'Rédaction'],
        done: 'Terminé',
        answerTitle: 'Zénon · Intelligence Biologique',
        reset: 'Nouvelle question',
        send: 'Envoyer',
      };

  const suggestions = isEn
    ? ['How is my recovery today?', 'Analyze my sleep architecture', 'Can I train hard today?']
    : ['Comment est ma récupération ?', 'Analyse ma nuit de sommeil', 'Puis-je m’entraîner fort ?'];

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
      {/* Top Header Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '64px',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 30,
          background: 'linear-gradient(to bottom, rgba(7, 7, 10, 0.85) 0%, transparent 100%)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(192, 132, 252, 0.25) 0%, transparent 70%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(192, 132, 252, 0.3)',
            }}
          >
            <Sparkles size={16} color="#FAF7F2" style={{ filter: 'drop-shadow(0 0 6px #C084FC)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#FAF7F2', letterSpacing: '-0.2px' }}>
                Zénon
              </span>
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 600,
                  padding: '1.5px 6px',
                  borderRadius: '999px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38BDF8',
                }}
              >
                Stoic Ring One
              </span>
            </div>
            <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.5)' }}>
              {isEn ? 'Biological Intelligence' : 'Intelligence Biologique'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClose}
          aria-label={isEn ? 'Close' : 'Fermer'}
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            color: '#FAF7F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* 21st.dev MorphOrb Full Experience */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        <MorphOrb
          onSubmit={handleMorphSubmit}
          minThinkMs={2600}
          copy={copy}
          suggestions={suggestions}
        />
      </div>
    </div>
  );
};
