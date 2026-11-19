import React, { useState, useEffect, useRef } from 'react';
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
  const { profile, selectedDay, language, weekData, isFirstLaunch, openModal, cardThemeMode } = useApp();
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const isEn = language === 'en';
  const isMono = cardThemeMode === 'monochrome';
  const initialViewportHeightRef = useRef<number>(
    typeof window !== 'undefined' ? window.innerHeight : 844
  );
  const [vvLayout, setVvLayout] = useState<{ top: number; height: number | null; isKeyboard: boolean }>({
    top: 0,
    height: null,
    isKeyboard: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerHeight > initialViewportHeightRef.current) {
      initialViewportHeightRef.current = window.innerHeight;
    }
    const checkViewport = () => {
      const vv = window.visualViewport;
      const curH = vv ? vv.height : window.innerHeight;
      const baseH = initialViewportHeightRef.current;
      const isKb = curH < baseH - 120 || window.innerHeight < baseH - 120;
      setVvLayout({
        top: isKb && vv ? Math.max(0, Math.round(vv.offsetTop)) : 0,
        height: isKb ? Math.max(260, Math.round(curH)) : null,
        isKeyboard: isKb,
      });
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    const vv = window.visualViewport;
    vv?.addEventListener('resize', checkViewport);
    vv?.addEventListener('scroll', checkViewport);
    window.addEventListener('resize', checkViewport);
    return () => {
      vv?.removeEventListener('resize', checkViewport);
      vv?.removeEventListener('scroll', checkViewport);
      window.removeEventListener('resize', checkViewport);
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
      className={`modal-backdrop aurelius-backdrop ${isClosing ? 'is-closing' : ''}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      style={{
        zIndex: 9100,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 'max(64px, calc(env(safe-area-inset-top, 44px) + 10px))',
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
          height: '100%',
          maxHeight: '820px',
          borderRadius: '34px 34px 0 0',
          background: isMono
            ? 'radial-gradient(ellipse at 50% 110%, rgba(255, 255, 255, 0.08) 0%, rgba(10, 10, 12, 0.98) 58%), #0A0A0C'
            : 'radial-gradient(ellipse at 50% 110%, rgba(192, 132, 252, 0.16) 0%, rgba(168, 85, 247, 0.05) 42%, rgba(10, 10, 12, 0.98) 74%), #0A0A0C',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -20px 50px rgba(0, 0, 0, 0.95)',
          borderTop: isMono
            ? '1px solid rgba(255, 248, 240, 0.16)'
            : '1px solid rgba(192, 132, 252, 0.28)',
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
            gap: '10px',
            zIndex: 30,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                flexShrink: 0,
                borderRadius: '50%',
                background: isMono ? 'rgba(255, 255, 255, 0.08)' : 'rgba(192, 132, 252, 0.16)',
                border: isMono ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(192, 132, 252, 0.4)',
                boxShadow: isMono ? 'none' : '0 0 12px rgba(192, 132, 252, 0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={15} color={isMono ? '#FAF7F2' : '#C084FC'} strokeWidth={1.8} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, paddingRight: '4px' }}>
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
                  fontSize: '9.5px',
                  color: 'rgba(250, 247, 242, 0.5)',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {isEn
                  ? 'Biological AI · Aurel Ring One'
                  : 'Intelligence Bio · Aurel Ring One'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
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
                background: isMono ? 'rgba(255, 255, 255, 0.08)' : 'rgba(192, 132, 252, 0.12)',
                border: isMono ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(192, 132, 252, 0.32)',
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
              <Camera size={13} color={isMono ? '#FAF7F2' : '#C084FC'} />
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
                background: 'rgba(255, 248, 240, 0.07)',
                border: '1px solid rgba(255, 248, 240, 0.14)',
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
        <div style={{ flex: 1, minHeight: 0, position: 'relative', width: '100%', overflow: 'hidden' }}>
          <MorphOrb
            onSubmit={handleAskAurelius}
            minThinkMs={450}
            speed={1.45}
            accentMode={isMono ? 'mono' : 'amethyst'}
            greetingTitle={greetingTitle}
            greetingSubtitle={greetingSubtitle}
            suggestions={quickSuggestions}
            isKeyboardOpen={vvLayout.isKeyboard}
            viewportHeight={vvLayout.height}
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
