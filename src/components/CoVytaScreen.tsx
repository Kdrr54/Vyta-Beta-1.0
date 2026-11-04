import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { TODAY_INDEX, weekMetrics, emptyDayMetrics } from '../data/health';
import { ChatMessage } from '../data/covyta';
import { getStoredGeminiKey, queryGeminiBiometricAI } from '../lib/geminiService';
import { GeminiApiKeyModal } from './GeminiApiKeyModal';
import { Send, User, Sparkles, Brain, RotateCcw, Mic, Key } from 'lucide-react';

const STORAGE_KEY = 'vyta_covyta_live_session_v4';

// Purge automatique des anciens messages enregistrés pour démarrer 100% propre
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('vyta_covyta_chat_clean_v1');
    localStorage.removeItem('vyta_covyta_chat_v1');
    localStorage.removeItem('vyta_covyta_chat_history');
    localStorage.removeItem('vyta_covyta_messages');
  } catch {}
}

// Formattage du texte markdown simple (**gras**, listes, titres)
const renderMessageContent = (text: string, sender: 'user' | 'ai') => {
  const lines = text.split('\n');

  return (
    <div className="covyta-formatted-msg">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} style={{ height: '6px' }} />;
        }

        // En-tête (### Titre)
        if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
          const heading = trimmed.replace(/^#{2,3}\s+/, '');
          return (
            <h4
              key={idx}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                fontWeight: 700,
                color: sender === 'user' ? '#000000' : '#FFFFFF',
                margin: idx === 0 ? '0 0 4px 0' : '8px 0 4px 0',
                lineHeight: 1.35,
              }}
            >
              {parseBold(heading, sender)}
            </h4>
          );
        }

        // Puce (• ou -)
        if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
          const bulletText = trimmed.replace(/^[•\-]\s+/, '');
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '7px',
                margin: '2px 0',
                fontSize: '12px',
                lineHeight: 1.45,
                color: sender === 'user' ? '#111111' : 'rgba(255, 255, 255, 0.9)',
              }}
            >
              <span style={{ color: sender === 'user' ? '#000000' : 'var(--gold)', fontSize: '8px' }}>◆</span>
              <div style={{ flex: 1 }}>{parseBold(bulletText, sender)}</div>
            </div>
          );
        }

        // Paragraphe standard
        return (
          <p
            key={idx}
            style={{
              margin: '2px 0',
              fontSize: '12.5px',
              lineHeight: 1.45,
              color: sender === 'user' ? '#111111' : 'rgba(255, 255, 255, 0.88)',
            }}
          >
            {parseBold(trimmed, sender)}
          </p>
        );
      })}
    </div>
  );
};

const parseBold = (content: string, sender: 'user' | 'ai') => {
  const parts = content.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong
          key={i}
          style={{
            fontWeight: 700,
            color: sender === 'user' ? '#000000' : '#FFFFFF',
          }}
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

export const CoVytaScreen: React.FC = () => {
  const { language, profile, weekData, isFirstLaunch } = useApp();
  const isEn = language === 'en';

  const dayData = (weekData && weekData[TODAY_INDEX]) || (isFirstLaunch ? emptyDayMetrics : weekMetrics[TODAY_INDEX]);
  
  // Clé API Gemini stockée
  const [currentApiKey, setCurrentApiKey] = useState<string>(() => getStoredGeminiKey());
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);

  // Liste des messages (démarre 100% vide sans aucun message enregistré)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sauvegarde temporaire par session uniquement
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Défilement automatique vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Réinitialiser la discussion (efface tout)
  const handleResetChat = () => {
    setMessages([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('vyta_covyta_chat_clean_v1');
      localStorage.removeItem('vyta_covyta_chat_v1');
      localStorage.removeItem('vyta_covyta_chat_history');
    } catch {}
    setIsThinking(false);
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 2000);
  };

  // Streaming progressif du texte (mot à mot pour un effet vivant)
  const streamResponse = (fullText: string, isRealAI: boolean, thinking?: string) => {
    const msgId = `ai-${Date.now()}`;
    const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const words = fullText.split(' ');
    let wordIndex = 0;

    const initialMsg: ChatMessage = {
      id: msgId,
      sender: 'ai',
      text: '',
      timeStr,
      isRealAI,
      thinking,
      isStreaming: true,
    };

    setMessages((prev) => [...prev, initialMsg]);

    const interval = setInterval(() => {
      wordIndex += 2;
      if (wordIndex >= words.length) {
        clearInterval(interval);
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, text: fullText, isStreaming: false } : m))
        );
      } else {
        const partial = words.slice(0, wordIndex).join(' ');
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, text: partial, isStreaming: true } : m))
        );
      }
    }, 28);
  };

  // Envoi d'une question
  const handleSendPrompt = async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText || isThinking) return;

    const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: cleanText,
      timeStr,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsThinking(true);

    try {
      let responseText = '';
      let isReal = false;
      let aiThinking: string | undefined = undefined;

      if (currentApiKey) {
        const historyForAI = messages.map((m) => ({
          sender: m.sender,
          text: m.text,
        }));

        const geminiRes = await queryGeminiBiometricAI({
          prompt: cleanText,
          profile,
          dayData,
          dayName: "Aujourd'hui",
          isToday: true,
          language,
          persona: 'analyst',
          conversationHistory: historyForAI,
        });

        if (geminiRes.error && !geminiRes.text) {
          responseText = `⚠️ **Erreur IA Gemini** : ${geminiRes.error}\n\nVeuillez vérifier votre clé API ou votre connexion internet.`;
          isReal = false;
        } else {
          responseText = geminiRes.text;
          isReal = true;
          aiThinking = geminiRes.thinking;
        }
      } else {
        responseText = `### ⚡ Activation requise\n\nAucune clé API Gemini n'est active.\n\nPour converser directement avec l'intelligence artificielle en temps réel, cliquez sur le bouton **Activer Vraie IA** en haut ou dans les Réglages pour renseigner votre clé.`;
        isReal = false;
      }

      setIsThinking(false);

      // Déroulement fluide mot à mot avec thinking si disponible
      streamResponse(responseText, isReal, aiThinking);
    } catch (e) {
      setIsThinking(false);
      console.error(e);
    }
  };

  // Dictée vocale simulée
  const handleMicClick = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }
    setIsListening(true);
    setInputPrompt(isEn ? 'Listening to your voice...' : 'Écoute vocale active...');

    setTimeout(() => {
      setIsListening(false);
      const samplePrompts = [
        "Comment optimiser ma récupération aujourd'hui ?",
        'Puis-je forcer à la séance ce soir ?',
        'Que dit ma VFC sur mon état de forme ?',
      ];
      const selectedPrompt = samplePrompts[0];
      setInputPrompt(selectedPrompt);
    }, 1600);
  };

  return (
    <div className="covyta-screen-wrap">
      {/* 1. Header supérieur simple : CoVyta + Statut IA + Bouton Réinitialiser */}
      <div className="covyta-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h1 className="header-title" style={{ margin: 0 }}>Zénon</h1>
          <button
            type="button"
            onClick={() => setShowKeyModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '999px',
              background: currentApiKey ? 'rgba(48, 209, 88, 0.14)' : 'rgba(217, 249, 112, 0.12)',
              border: currentApiKey ? '1px solid rgba(48, 209, 88, 0.45)' : '1px solid rgba(217, 249, 112, 0.4)',
              cursor: 'pointer',
              color: currentApiKey ? '#30D158' : '#D9F970',
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '0.02em',
              transition: 'all 0.15s ease',
            }}
            title={currentApiKey ? "IA Gemini 2.0 active · Cliquez pour configurer" : "Cliquez pour activer la vraie IA Gemini"}
          >
            <Sparkles size={11} color={currentApiKey ? '#30D158' : '#D9F970'} />
            <span>{currentApiKey ? '✨ Vraie IA Gemini' : '⚡ Activer Vraie IA'}</span>
          </button>
        </div>

        {/* Bouton Réinitialiser la discussion pour vos tests */}
        <button
          type="button"
          onClick={handleResetChat}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: resetSuccess ? 'rgba(48, 209, 88, 0.16)' : 'rgba(255, 255, 255, 0.08)',
            border: resetSuccess ? '1px solid rgba(48, 209, 88, 0.45)' : '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '8px',
            padding: '4px 9px',
            cursor: 'pointer',
            color: resetSuccess ? '#30D158' : 'rgba(255, 255, 255, 0.85)',
            transition: 'all 0.15s ease',
          }}
          title="Effacer la discussion et recommencer à zéro"
        >
          <RotateCcw size={12} color={resetSuccess ? '#30D158' : 'rgba(255, 255, 255, 0.85)'} />
          <span style={{ fontSize: '11px', fontWeight: 600 }}>
            {resetSuccess ? 'Réinitialisé ✓' : 'Réinitialiser'}
          </span>
        </button>
      </div>

      {/* 2. Fil de discussion qui remplit tout l'espace central */}
      <div className="covyta-messages-area">
        {/* Écran d'accueil quand la discussion est vierge (centré verticalement) */}
        {messages.length === 0 && !isThinking && (
          <div className="covyta-empty-center">
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '16px',
                background: currentApiKey ? 'rgba(48, 209, 88, 0.15)' : 'rgba(217, 249, 112, 0.14)',
                border: currentApiKey ? '1px solid rgba(48, 209, 88, 0.4)' : '1px solid rgba(217, 249, 112, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: currentApiKey ? '0 0 20px rgba(48, 209, 88, 0.2)' : '0 0 20px rgba(217, 249, 112, 0.15)',
              }}
            >
              <Sparkles size={24} color={currentApiKey ? '#30D158' : '#D9F970'} />
            </div>

            <span style={{ fontSize: '14px', fontWeight: 700, color: '#FAF7F2', marginTop: '2px' }}>
              {isEn ? 'Zénon Biometric Intelligence' : 'Intelligence Biologique Zénon'}
            </span>

            <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)', maxWidth: '300px', lineHeight: 1.45, textAlign: 'center' }}>
              {currentApiKey
                ? (isEn
                    ? '⚡ Real Gemini AI is connected. Ask any question freely.'
                    : '⚡ Vraie IA Gemini connectée. Posez votre question librement.')
                : (isEn
                    ? 'Connect Gemini to chat with the AI in real time.'
                    : 'Activez la vraie IA Gemini pour discuter en temps réel.')}
            </span>

            {!currentApiKey ? (
              <button
                type="button"
                onClick={() => setShowKeyModal(true)}
                style={{
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, rgba(217, 249, 112, 0.22) 0%, rgba(56, 189, 248, 0.15) 100%)',
                  border: '1px solid rgba(217, 249, 112, 0.5)',
                  color: '#D9F970',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(217, 249, 112, 0.2)',
                  transition: 'transform 0.15s ease',
                }}
              >
                <Sparkles size={13} color="#D9F970" />
                <span>Activer la Vraie IA Gemini</span>
              </button>
            ) : (
              <div
                style={{
                  marginTop: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: 'rgba(48, 209, 88, 0.12)',
                  border: '1px solid rgba(48, 209, 88, 0.35)',
                  color: '#30D158',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                <span>✓ Prêt à discuter avec l'IA</span>
              </div>
            )}
          </div>
        )}

        {/* Bulles de conversation */}
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.sender === 'user' ? 'user' : 'ai gold'}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {m.sender === 'ai' ? (
                  <>
                    <Sparkles size={11} color={m.isRealAI ? '#30D158' : 'var(--gold)'} />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: m.isRealAI ? '#30D158' : 'var(--gold-light)', letterSpacing: '0.04em' }}>
                      ZÉNON
                    </span>
                    {m.isRealAI && (
                      <span
                        style={{
                          fontSize: '8.5px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: 'rgba(48, 209, 88, 0.2)',
                          color: '#30D158',
                          border: '1px solid rgba(48, 209, 88, 0.4)',
                        }}
                      >
                        VRAIE IA GEMINI
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <User size={11} color="#000000" />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#000000' }}>
                      {isEn ? 'YOU' : 'VOUS'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {renderMessageContent(m.text, m.sender)}
            {m.isStreaming && <span className="streaming-cursor" />}

            {/* Accordéon du raisonnement biométrique interne s'il existe */}
            {m.thinking && (
              <details
                style={{
                  marginTop: '10px',
                  padding: '7px 10px',
                  borderRadius: '10px',
                  background: 'rgba(217, 249, 112, 0.08)',
                  border: '1px solid rgba(217, 249, 112, 0.25)',
                  fontSize: '11px',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontWeight: 600,
                    color: '#D9F970',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    userSelect: 'none',
                  }}
                >
                  <Brain size={12} color="#D9F970" />
                  <span>Raisonnement biométrique interne (Gemini 2.0 Flash)</span>
                </summary>
                <div
                  style={{
                    marginTop: '8px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    whiteSpace: 'pre-line',
                    lineHeight: 1.45,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10.5px',
                  }}
                >
                  {m.thinking}
                </div>
              </details>
            )}

            <div className="chat-bubble-footer" style={{ marginTop: '6px' }}>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{m.timeStr}</span>
            </div>
          </div>
        ))}

        {/* Indicateur discret et épuré "1 task running" */}
        {isThinking && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              margin: '4px 0 10px 0',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.55)',
              fontFamily: 'var(--font-mono, monospace)',
              animation: 'pulse 1.8s ease-in-out infinite',
              alignSelf: 'flex-start',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--gold, #D9F970)',
                boxShadow: '0 0 8px var(--gold, #D9F970)',
                display: 'inline-block',
              }}
            />
            <span>1 task running</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Barre de saisie ancrée tout en bas au-dessus de la TabBar */}
      <div className="covyta-docked-input">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt(inputPrompt);
          }}
          className="chat-input-bar"
          style={{ margin: 0 }}
        >
          <button
            type="button"
            className={`chat-mic-btn ${isListening ? 'listening' : ''}`}
            onClick={handleMicClick}
            title={isListening ? 'Écoute en cours...' : 'Dictée vocale'}
          >
            <Mic size={16} />
          </button>

          <input
            type="text"
            className="chat-input"
            placeholder={isEn ? 'Ask Zénon a question...' : 'Posez une question à Zénon...'}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            disabled={isThinking}
          />

          <button
            type="submit"
            className="chat-send-btn"
            disabled={!inputPrompt.trim() || isThinking}
            title="Envoyer"
          >
            <Send size={15} />
          </button>
        </form>
      </div>

      {/* Modal pour saisir et tester la clé API Google Gemini */}
      <GeminiApiKeyModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        onKeySaved={(newKey) => setCurrentApiKey(newKey)}
      />
    </div>
  );
};
