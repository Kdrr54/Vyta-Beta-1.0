import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { queryPrismAI } from '../lib/prismService';
import { weekMetrics, TODAY_INDEX, emptyDayMetrics } from '../data/health';
import MorphOrb from './ui/ai-thiking-orb-and-input';
import { X, Sparkles, Camera } from 'lucide-react';

interface PrismModalProps {
  onClose: () => void;
}

export const PrismModal: React.FC<PrismModalProps> = ({ onClose }) => {
  const { profile, selectedDay, language, weekData, isFirstLaunch, openModal } = useApp();
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const isEn = language === 'en';
  const [vvLayout, setVvLayout] = useState<{ top: number; height: number | null; isKeyboard: boolean }>({
    top: 0,
    height: null,
    isKeyboard: false,
  });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onVvChange = () => {
      const diff = window.innerHeight - vv.height;
      const isKb = diff > 100;
      setVvLayout({
        top: isKb ? Math.max(0, Math.round(vv.offsetTop)) : 0,
        height: isKb ? Math.max(300, Math.round(vv.height)) : null,
        isKeyboard: isKb,
      });
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    vv.addEventListener('resize', onVvChange);
    vv.addEventListener('scroll', onVvChange);
    return () => {
      vv.removeEventListener('resize', onVvChange);
      vv.removeEventListener('scroll', onVvChange);
    };
  }, []);

  const dayData =
    (weekData && weekData[selectedDay]) ||
    (isFirstLaunch ? emptyDayMetrics : weekMetrics[selectedDay] || weekMetrics[TODAY_INDEX]);
  const dayName = isEn ? 'Today' : "Aujourd'hui";

  const handleAskAurelius = async (question: string): Promise<string> => {
    const text = question.trim();
    if (!text) return '';

    if (
      text.toLowerCase().includes('cal ai') ||
      text.toLowerCase().includes('scanner mon plat') ||
      text.toLowerCase().includes('scan meal')
    ) {
      handleClose();
      setTimeout(() => openModal('calai'), 180);
      return isEn ? 'Opening Aurelius Nutrition scanner...' : 'Ouverture du scanner nutritionnel...';
    }

    try {
      const response = await queryPrismAI({
        prompt: text,
        profile,
        dayData,
        dayName,
        isToday: selectedDay === TODAY_INDEX,
        language,
        conversationHistory: [],
      });
      return response.text;
    } catch (_) {
      return isEn
        ? 'Biometric connection interrupted. Please try again.'
        : 'Connexion biométrique interrompue. Veuillez réessayer.';
    }
  };

  const quickSuggestions = isEn
    ? ['📸 Scan meal', 'How is my recovery?', 'Analyze my sleep', 'Can I train hard?']
    : ['📸 Scanner mon plat', 'Ma récupération ?', 'Analyse ma nuit', 'Puis-je m’entraîner ?'];

  const greetingTitle = isEn
    ? `Hello ${profile.firstName || 'Aurel'}`
    : `Bonjour ${profile.firstName || 'Aurel'}`;
  const greetingSubtitle = isEn
    ? 'Ask Aurelius anything about your recovery, sleep, or daily telemetry.'
    : 'Interrogez Aurelius sur votre récupération, votre sommeil ou votre forme.';

  return (
    <div
      className={`aurelius-backdrop ${isClosing ? 'is-closing' : ''}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      style={{
        zIndex: 1200,
        position: 'fixed',
        top: vvLayout.isKeyboard ? `${vvLayout.top}px` : 0,
        left: 0,
        right: 0,
        height: vvLayout.height ? `${vvLayout.height}px` : '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        background: 'rgba(0, 0, 0, 0.72)',
      }}
    >
      <style>{`
        @keyframes aureliusBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes aureliusBackdropOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .aurelius-backdrop {
          animation: aureliusBackdropIn 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
          will-change: opacity;
        }
        .aurelius-backdrop.is-closing {
          animation: aureliusBackdropOut 200ms cubic-bezier(0.32, 0, 0.67, 0) forwards;
        }
        @keyframes aureliusSheetSlideUp {
          0% {
            transform: translate3d(0, 100%, 0);
            opacity: 0.75;
          }
          100% {
            transform: translate3d(0, 0, 0);
            opacity: 1;
          }
        }
        @keyframes aureliusSheetSlideDown {
          0% {
            transform: translate3d(0, 0, 0);
            opacity: 1;
          }
          100% {
            transform: translate3d(0, 100%, 0);
            opacity: 0;
          }
        }
        .aurelius-sheet {
          animation: aureliusSheetSlideUp 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
          will-change: transform, opacity;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .aurelius-sheet.is-closing {
          animation: aureliusSheetSlideDown 220ms cubic-bezier(0.32, 0, 0.67, 0) forwards;
        }
      `}</style>

      <div
        className={`aurelius-sheet ${isClosing ? 'is-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '430px',
          height: vvLayout.isKeyboard ? '100%' : '92dvh',
          maxHeight: vvLayout.isKeyboard ? '100%' : '840px',
          transition: 'height 0.18s ease-out',
          borderRadius: vvLayout.isKeyboard ? '22px 22px 0 0' : '34px 34px 0 0',
          background: 'linear-gradient(180deg, #09090D 0%, #060608 100%)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -20px 50px rgba(0, 0, 0, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.16)',
        }}
      >
        {/* Unified Header */}
        <div
          style={{
            position: 'relative',
            height: '62px',
            flexShrink: 0,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 30,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={15} color="#FAF7F2" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#FAF7F2',
                  letterSpacing: '-0.3px',
                }}
              >
                AURELIUS
              </span>
              <span
                style={{
                  fontSize: '10px',
                  color: 'rgba(250, 247, 242, 0.5)',
                  fontWeight: 500,
                }}
              >
                {isEn
                  ? 'Biological Intelligence · Aurel Ring One'
                  : 'Intelligence Biologique · Aurel Ring One'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                handleClose();
                setTimeout(() => openModal('calai'), 180);
              }}
              style={{
                height: '32px',
                padding: '0 12px',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                color: '#FAF7F2',
                fontSize: '11.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
              }}
              title={isEn ? 'Open Nutrition Scanner' : 'Scanner un repas'}
            >
              <Camera size={13} color="#30D158" />
              <span>Nutrition</span>
            </button>

            <button
              type="button"
              onClick={handleClose}
              aria-label={isEn ? 'Close' : 'Fermer'}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#FAF7F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Exact 21st.dev MorphOrb Thinking & Input Component */}
        <div style={{ flex: 1, position: 'relative', width: '100%', overflow: 'hidden' }}>
          <MorphOrb
            onSubmit={handleAskAurelius}
            minThinkMs={1400}
            greetingTitle={greetingTitle}
            greetingSubtitle={greetingSubtitle}
            suggestions={quickSuggestions}
            isKeyboardOpen={vvLayout.isKeyboard}
            onSuggestionAction={(s) => {
              if (s.includes('Scanner') || s.includes('Scan meal') || s.includes('Cal AI')) {
                handleClose();
                setTimeout(() => openModal('calai'), 180);
                return true;
              }
              return false;
            }}
            copy={
              isEn
                ? {
                    placeholder: 'Ask Aurelius anything…',
                    labels: ['Thinking', 'Searching', 'Analyzing', 'Composing'],
                    done: 'Done',
                    answerTitle: 'AURELIUS',
                    reset: 'New question',
                    send: 'Send',
                  }
                : {
                    placeholder: 'Demandez à Aurelius…',
                    labels: ['Analyse biométrique', 'Recoupement', 'Synthèse clinique', 'Rédaction'],
                    done: 'Terminé',
                    answerTitle: 'AURELIUS',
                    reset: 'Nouvelle question',
                    send: 'Envoyer',
                  }
            }
          />
        </div>
      </div>
    </div>
  );
};
