import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { queryPrismAI } from '../lib/prismService';
import { PrismMessageRenderer } from './PrismMessageRenderer';
import { weekMetrics, TODAY_INDEX, emptyDayMetrics } from '../data/health';
import { ZenonOrb } from './ui/ai-thiking-orb-and-input';
import {
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowUp,
} from 'lucide-react';

interface PrismModalProps {
  onClose: () => void;
}

interface Message {
  id: string;
  sender: 'user' | 'prism';
  text: string;
  thinking?: string;
  timestamp: string;
  isRealAI?: boolean;
  isError?: boolean;
}

const THINK_LABELS_FR = ['Analyse biométrique', 'Recoupement', 'Synthèse clinique', 'Rédaction'];
const THINK_LABELS_EN = ['Thinking', 'Searching', 'Analyzing', 'Composing'];

export const PrismModal: React.FC<PrismModalProps> = ({ onClose }) => {
  const { profile, selectedDay, language, weekData, isFirstLaunch } = useApp();
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const isEn = language === 'en';

  const dayData = (weekData && weekData[selectedDay]) || (isFirstLaunch ? emptyDayMetrics : (weekMetrics[selectedDay] || weekMetrics[TODAY_INDEX]));
  const dayName = isEn ? 'Today' : "Aujourd'hui";

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [orbStatus, setOrbStatus] = useState<'idle' | 'thinking' | 'done'>('idle');
  const [thinkStep, setThinkStep] = useState<number>(0);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const isGenerating = orbStatus !== 'idle';

  const thinkLabels = isEn ? THINK_LABELS_EN : THINK_LABELS_FR;
  const activeOrbLabel =
    orbStatus === 'done'
      ? isEn
        ? 'Done'
        : 'Terminé'
      : orbStatus === 'thinking'
      ? thinkLabels[thinkStep % thinkLabels.length]
      : undefined;

  // Cycle thinking phase labels & 3D orb light programs while generating
  useEffect(() => {
    if (orbStatus !== 'thinking') return;
    setThinkStep(0);
    const id = window.setInterval(() => {
      setThinkStep((s) => (s + 1) % thinkLabels.length);
    }, 1150);
    return () => window.clearInterval(id);
  }, [orbStatus, thinkLabels.length]);

  // Auto-scroll when messages or orb state update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, orbStatus]);

  const sendPrompt = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isGenerating) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setOrbStatus('thinking');

    const minThinkStart = Date.now();
    const MIN_ORB_MS = 1400;

    try {
      const history = messages
        .filter((m) => !m.isError)
        .map((m) => ({
          sender: m.sender,
          text: m.text,
        }));

      const res = await queryPrismAI({
        prompt: text,
        profile,
        dayData,
        dayName,
        isToday: true,
        language: isEn ? 'en' : 'fr',
        conversationHistory: history,
      });

      // Ensure the 3D thinking orb has time to breathe before resolving
      const elapsed = Date.now() - minThinkStart;
      if (elapsed < MIN_ORB_MS) {
        await new Promise((r) => setTimeout(r, MIN_ORB_MS - elapsed));
      }

      // Play the emerald green resolve sweep briefly
      setOrbStatus('done');
      await new Promise((r) => setTimeout(r, 520));

      if (res.error) {
        const errorMsg: Message = {
          id: `prism-err-${Date.now()}`,
          sender: 'prism',
          text: isEn
            ? `Zénon encountered an error: ${res.error}. Please check network connection.`
            : `Zénon a rencontré une erreur de connexion : ${res.error}. Vérifiez la connexion réseau.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } else {
        const prismMsg: Message = {
          id: `prism-${Date.now()}`,
          sender: 'prism',
          text: res.text,
          thinking: res.thinking,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isRealAI: res.isRealAI,
        };
        setMessages((prev) => [...prev, prismMsg]);
      }
    } catch (e: any) {
      console.error('[Zénon] Generation error:', e);
      const errorMsg: Message = {
        id: `prism-err-${Date.now()}`,
        sender: 'prism',
        text: isEn ? `Network error: ${e?.message || 'Failed to reach AI'}` : `Erreur réseau : ${e?.message || 'Impossible de joindre l’IA'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setOrbStatus('idle');
    }
  };

  const toggleThinking = (id: string) => {
    setExpandedThinking((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const quickSuggestions = isEn
    ? ['How is my recovery today?', 'Analyze my sleep architecture', 'Can I train hard today?']
    : ['Comment est ma récupération ?', 'Analyse ma nuit de sommeil', 'Puis-je m’entraîner fort ?'];

  const ready = inputText.trim().length > 0 && !isGenerating;

  return (
    <div
      className={`modal-backdrop ${isClosing ? 'is-closing' : ''}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      style={{ zIndex: 1200 }}
    >
      <style>{`
        @keyframes prismAuraPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(1.08); }
        }
        .prism-scroll-area {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        .prism-scroll-area::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `}</style>

      <div
        className={`modal-sheet ${isClosing ? 'is-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '430px',
          height: '92dvh',
          maxHeight: '840px',
          borderRadius: '34px 34px 0 0',
          background: 'linear-gradient(180deg, #09090D 0%, #060608 100%)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -20px 50px rgba(0, 0, 0, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.16)',
        }}
      >
        {/* Iridescent Top Aura */}
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '260px',
            height: '140px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(56, 189, 248, 0.35) 0%, rgba(192, 132, 252, 0.3) 40%, rgba(48, 209, 88, 0.15) 70%, transparent 100%)',
            filter: 'blur(36px)',
            pointerEvents: 'none',
            zIndex: 1,
            animation: 'prismAuraPulse 4s infinite ease-in-out',
          }}
        />

        {/* 1. Unified Header */}
        <div
          style={{
            position: 'relative',
            height: '62px',
            flexShrink: 0,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={20} color="#FAF7F2" style={{ filter: 'drop-shadow(0 0 8px #C084FC)' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#FAF7F2', letterSpacing: '-0.2px' }}>
                  Zénon
                </span>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 600,
                    padding: '1.5px 6px',
                    borderRadius: '999px',
                    background: 'rgba(56, 189, 248, 0.16)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    color: '#38BDF8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#38BDF8', boxShadow: '0 0 6px #38BDF8' }} />
                  <span>ACTIF</span>
                </span>
              </div>
              <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.55)', marginTop: '1px' }}>
                {isEn ? 'Biological Intelligence · Stoic Ring One' : 'Intelligence Biologique · Stoic Ring One'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label={isEn ? 'Close' : 'Fermer'}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#FAF7F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* 2. Unified Body: 3D Orb Welcome / Thinking / Rich Conversation */}
        <div
          className="prism-scroll-area"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '12px 16px 16px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            zIndex: 2,
          }}
        >
          {/* Welcome state with living 3D Particle Orb */}
          {messages.length === 0 && !isGenerating && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '10px 8px',
                gap: '12px',
              }}
            >
              <ZenonOrb status="idle" size={172} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontSize: '18px', fontWeight: 600, color: '#FAF7F2', letterSpacing: '-0.3px' }}>
                  Zénon
                </span>
                <span style={{ fontSize: '12px', color: 'rgba(250, 247, 242, 0.62)', maxWidth: '280px', lineHeight: 1.45 }}>
                  {isEn
                    ? 'Ask Zénon anything about your ring biometrics, sleep architecture, recovery, or workouts.'
                    : 'Posez votre question à Zénon sur vos biométries, votre sommeil, votre récupération ou votre entraînement.'}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: '7px',
                  marginTop: '6px',
                  maxWidth: '340px',
                }}
              >
                {quickSuggestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendPrompt(q)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '999px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      color: 'rgba(250, 247, 242, 0.86)',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message History */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                gap: '4px',
              }}
            >
              <div
                style={{
                  maxWidth: '90%',
                  padding: msg.sender === 'user' ? '10px 14px' : '14px 16px',
                  borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background:
                    msg.sender === 'user'
                      ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.08) 100%)'
                      : msg.isError
                      ? 'rgba(255, 90, 82, 0.12)'
                      : 'rgba(18, 18, 24, 0.88)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border:
                    msg.sender === 'user'
                      ? '1px solid rgba(255, 255, 255, 0.24)'
                      : msg.isError
                      ? '1px solid rgba(255, 90, 82, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.45)',
                  color: msg.isError ? '#FF5A52' : '#FAF7F2',
                  fontSize: '12.5px',
                  lineHeight: 1.5,
                }}
              >
                {msg.sender === 'prism' && msg.thinking && (
                  <div
                    style={{
                      marginBottom: '10px',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      background: 'rgba(192, 132, 252, 0.08)',
                      border: '1px solid rgba(192, 132, 252, 0.22)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleThinking(msg.id)}
                      style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        color: '#C084FC',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Sparkles size={12} />
                        {isEn ? 'Zénon Clinical Reasoning' : 'Raisonnement Clinique Zénon'}
                      </span>
                      {expandedThinking[msg.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {expandedThinking[msg.id] && (
                      <p
                        style={{
                          margin: '6px 0 0 0',
                          fontSize: '11px',
                          color: 'rgba(250, 247, 242, 0.72)',
                          lineHeight: 1.45,
                          fontFamily: 'var(--font-mono, monospace)',
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {msg.thinking}
                      </p>
                    )}
                  </div>
                )}

                {msg.sender === 'prism' ? (
                  <PrismMessageRenderer text={msg.text} />
                ) : (
                  <div style={{ whiteSpace: 'pre-line', fontSize: '13.5px', lineHeight: 1.55 }}>
                    {msg.text}
                  </div>
                )}
              </div>

              <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.38)', margin: '0 4px' }}>
                {msg.timestamp}
              </span>
            </div>
          ))}

          {/* Active 3D Thinking Orb while Zénon processes */}
          {isGenerating && (
            <div
              style={{
                flex: messages.length <= 1 ? 1 : undefined,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '18px 0',
              }}
            >
              <ZenonOrb
                status={orbStatus === 'done' ? 'done' : 'thinking'}
                label={activeOrbLabel}
                prog={thinkStep}
                size={messages.length <= 1 ? 190 : 140}
              />
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* 3. Unified Glowing Iridescent Pill Input (Flex-pinned, iOS-safe) */}
        <div
          style={{
            flexShrink: 0,
            padding: '10px 14px max(20px, calc(env(safe-area-inset-bottom, 0px) + 14px)) 14px',
            zIndex: 10,
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendPrompt(inputText);
            }}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              height: '54px',
              padding: '0 8px 0 16px',
              borderRadius: '999px',
              background: 'rgba(18, 18, 24, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.55), 0 0 24px rgba(192, 132, 252, 0.14)',
              overflow: 'hidden',
            }}
          >
            {/* Subtle iridescent aurora shimmer */}
            <div className="mo-aurora" style={{ opacity: 0.45 }} aria-hidden="true">
              <i />
              <i />
            </div>

            <Sparkles
              size={17}
              color="#C084FC"
              style={{
                flexShrink: 0,
                position: 'relative',
                zIndex: 2,
                filter: 'drop-shadow(0 0 6px rgba(192, 132, 252, 0.5))',
              }}
            />

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isEn ? 'Ask Zénon anything…' : 'Posez une question à Zénon…'}
              maxLength={300}
              style={{
                flex: 1,
                minWidth: 0,
                position: 'relative',
                zIndex: 2,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#FAF7F2',
                fontSize: '15px',
                lineHeight: 1.4,
              }}
            />

            <button
              type="submit"
              disabled={!ready}
              aria-label={isEn ? 'Send' : 'Envoyer'}
              style={{
                position: 'relative',
                zIndex: 2,
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: ready
                  ? 'linear-gradient(135deg, #38BDF8 0%, #C084FC 100%)'
                  : 'rgba(255, 255, 255, 0.08)',
                border: ready ? '1px solid rgba(255, 255, 255, 0.38)' : '1px solid rgba(255, 255, 255, 0.12)',
                color: ready ? '#FAF7F2' : 'rgba(250, 247, 242, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: ready ? 'pointer' : 'default',
                flexShrink: 0,
                boxShadow: ready ? '0 0 16px rgba(192, 132, 252, 0.45)' : 'none',
                transition: 'all 0.18s ease',
              }}
            >
              <ArrowUp size={17} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
