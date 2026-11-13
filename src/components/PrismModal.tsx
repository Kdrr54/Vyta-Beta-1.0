import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { queryPrismAI } from '../lib/prismService';
import { PrismMessageRenderer } from './PrismMessageRenderer';
import { weekMetrics, TODAY_INDEX, emptyDayMetrics } from '../data/health';
import {
  X,
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
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

export const PrismModal: React.FC<PrismModalProps> = ({ onClose }) => {
  const { profile, selectedDay, language, weekData, isFirstLaunch } = useApp();
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const isEn = language === 'en';

  const dayData = (weekData && weekData[selectedDay]) || (isFirstLaunch ? emptyDayMetrics : (weekMetrics[selectedDay] || weekMetrics[TODAY_INDEX]));
  const dayName = isEn ? 'Today' : "Aujourd'hui";

  // Flux de messages 100% géré par l'IA
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || isGenerating) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsGenerating(true);

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

      if (res.error) {
        const errorMsg: Message = {
          id: `prism-err-${Date.now()}`,
          sender: 'prism',
          text: isEn
            ? `Prism encountered an error: ${res.error}. Please check network connection.`
            : `Prism a rencontré une erreur de connexion : ${res.error}. Vérifiez la connexion réseau.`,
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
      console.error('[Prism] Generation error:', e);
      const errorMsg: Message = {
        id: `prism-err-${Date.now()}`,
        sender: 'prism',
        text: isEn ? `Network error: ${e?.message || 'Failed to reach AI'}` : `Erreur réseau : ${e?.message || 'Impossible de joindre l’IA'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleThinking = (id: string) => {
    setExpandedThinking((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

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

        {/* 1. Header: Prism Logo, Status & Close */}
        <div
          style={{
            position: 'relative',
            height: '62px',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'transparent',
            borderBottom: 'none',
            zIndex: 10,
          }}
        >
          {/* Logo & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                position: 'relative',
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

          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
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

        {/* 2. Messages Scroll Area */}
        <div
          className="prism-scroll-area"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 16px 20px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            zIndex: 2,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {/* Empty State when no messages (Clean, no pre-baked fake messages) */}
          {messages.length === 0 && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '50px 20px',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.35) 0%, rgba(192, 132, 252, 0.35) 50%, rgba(48, 209, 88, 0.35) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.28)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 32px rgba(192, 132, 252, 0.45)',
                  animation: 'prismAuraPulse 3s infinite ease-in-out',
                }}
              >
                <Sparkles size={30} color="#FAF7F2" style={{ filter: 'drop-shadow(0 0 8px #C084FC)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '18px', fontWeight: 600, color: '#FAF7F2', letterSpacing: '-0.3px' }}>
                  Zénon
                </span>
                <span style={{ fontSize: '12px', color: 'rgba(250, 247, 242, 0.65)', maxWidth: '280px', lineHeight: 1.45 }}>
                  {isEn
                    ? 'Ask Zénon anything about your ring biometrics, sleep architecture, recovery, or workouts.'
                    : 'Posez votre question à Zénon sur vos biométries, votre sommeil, votre récupération ou votre entraînement.'}
                </span>
              </div>
            </div>
          )}

          {/* Rendered Messages */}
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
              {/* Message Bubble */}
              <div
                style={{
                  maxWidth: '88%',
                  padding: msg.sender === 'user' ? '10px 14px' : '14px 16px',
                  borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background:
                    msg.sender === 'user'
                      ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.08) 100%)'
                      : msg.isError
                      ? 'rgba(255, 90, 82, 0.12)'
                      : 'rgba(18, 18, 24, 0.85)',
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
                {/* Collapsible Thinking Accordion for Prism responses */}
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

                {/* Formatted Text Body with rich visual renderer */}
                {msg.sender === 'prism' ? (
                  <PrismMessageRenderer text={msg.text} />
                ) : (
                  <div style={{ whiteSpace: 'pre-line', fontSize: '13.5px', lineHeight: 1.55 }}>
                    {msg.text}
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.38)', margin: '0 4px' }}>
                {msg.timestamp}
              </span>
            </div>
          ))}

          {/* Thinking / Streaming Indicator */}
          {isGenerating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #38BDF8, #C084FC, #30D158)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'prismAuraPulse 1.4s infinite ease-in-out',
                }}
              >
                <Sparkles size={13} color="#060608" />
              </div>
              <span style={{ fontSize: '11px', color: '#C084FC', fontWeight: 500 }}>
                {isEn ? 'Zénon is analyzing your biometrics...' : 'Zénon analyse vos biométries...'}
              </span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* 3. Bottom Input Bar */}
        <div
          style={{
            padding: '10px 14px max(20px, calc(env(safe-area-inset-bottom, 0px) + 14px)) 14px',
            background: 'transparent',
            borderTop: 'none',
            zIndex: 10,
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 6px 4px 14px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
            }}
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isEn ? 'Ask about health, sleep or fitness...' : 'Posez une question sur votre santé, sommeil ou forme...'}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#FAF7F2',
                fontSize: '12.5px',
                padding: '8px 0',
              }}
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isGenerating}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: inputText.trim() && !isGenerating
                  ? 'linear-gradient(135deg, #38BDF8 0%, #C084FC 100%)'
                  : 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#FAF7F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputText.trim() && !isGenerating ? 'pointer' : 'default',
                transition: 'all 0.18s ease',
              }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
