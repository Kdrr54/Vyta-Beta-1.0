import React, { useState } from 'react';
import { Sparkles, X, Check, ExternalLink, Key, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { testGeminiApiKey, getStoredGeminiKey, setStoredGeminiKey } from '../lib/geminiService';

interface GeminiApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: (key: string) => void;
}

export const GeminiApiKeyModal: React.FC<GeminiApiKeyModalProps> = ({
  isOpen,
  onClose,
  onKeySaved,
}) => {
  const [apiKey, setApiKey] = useState<string>(() => getStoredGeminiKey());
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleTestAndSave = async () => {
    const clean = apiKey.trim();
    if (!clean) {
      setStatusMessage({ type: 'error', text: 'Veuillez saisir ou coller votre clé API Gemini.' });
      return;
    }

    setIsTesting(true);
    setStatusMessage(null);

    const result = await testGeminiApiKey(clean);
    setIsTesting(false);

    if (result.success) {
      setStoredGeminiKey(clean);
      setStatusMessage({
        type: 'success',
        text: `✓ Succès ! Modèle ${result.model || 'Gemini 2.0 Flash'} connecté. La vraie IA est désormais active dans Zénon.`,
      });
      if (onKeySaved) {
        onKeySaved(clean);
      }
      setTimeout(() => {
        onClose();
      }, 1600);
    } else {
      setStatusMessage({
        type: 'error',
        text: `Échec de validation : ${result.error || 'Vérifiez que votre clé est active sur Google AI Studio.'}`,
      });
    }
  };

  const handleRemoveKey = () => {
    setStoredGeminiKey('');
    setApiKey('');
    setStatusMessage({ type: 'info', text: 'Clé API retirée. Le simulateur local est réactivé.' });
    if (onKeySaved) {
      onKeySaved('');
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 200ms ease',
      }}
    >
      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          borderRadius: '26px',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(217, 249, 112, 0.18) 0%, rgba(10, 10, 12, 0.98) 75%), #0A0A0E',
          border: '1px solid rgba(217, 249, 112, 0.35)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(217, 249, 112, 0.15)',
          padding: '22px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          color: '#FAF7F2',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '11px',
                background: 'rgba(217, 249, 112, 0.16)',
                border: '1px solid rgba(217, 249, 112, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={18} color="#D9F970" />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#FAF7F2' }}>
                Activer la Vraie IA Gemini
              </h2>
              <span style={{ fontSize: '11px', color: '#D9F970', fontWeight: 600 }}>
                Google Gemini 2.0 Flash (Générative Réelle)
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(250, 247, 242, 0.7)',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Explication */}
        <p style={{ fontSize: '12px', color: 'rgba(250, 247, 242, 0.75)', lineHeight: 1.5, margin: 0 }}>
          Remplacez définitivement les réponses pré-enregistrées par le <strong>vrai grand modèle d'IA de Google</strong>. Il analyse vos vraies données de bague (ou votre état usine) en direct.
        </p>

        {/* Étape 1 : Obtenir la clé gratuite */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={14} color="#D9F970" />
            <span style={{ fontSize: '11.5px', color: 'rgba(250, 247, 242, 0.9)' }}>
              1. Clé gratuite en 30s (sans CB)
            </span>
          </div>

          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#D9F970',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'none',
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'rgba(217, 249, 112, 0.12)',
              border: '1px solid rgba(217, 249, 112, 0.3)',
            }}
          >
            <span>Ouvrir Google AI</span>
            <ExternalLink size={10} />
          </a>
        </div>

        {/* Étape 2 : Champ de saisie */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.65)', fontWeight: 600 }}>
            2. Collez votre clé API Gemini (commence par AIzaSy...) :
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#050508',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              padding: '0 8px',
            }}
          >
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '11px 6px',
                color: '#FAF7F2',
                fontSize: '13px',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(250, 247, 242, 0.5)',
                cursor: 'pointer',
                padding: '4px',
              }}
              title={showKey ? 'Masquer' : 'Afficher'}
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Feedback Message */}
        {statusMessage && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              fontSize: '11.5px',
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background:
                statusMessage.type === 'success'
                  ? 'rgba(48, 209, 88, 0.15)'
                  : statusMessage.type === 'error'
                  ? 'rgba(255, 69, 58, 0.15)'
                  : 'rgba(255, 255, 255, 0.08)',
              border:
                statusMessage.type === 'success'
                  ? '1px solid rgba(48, 209, 88, 0.4)'
                  : statusMessage.type === 'error'
                  ? '1px solid rgba(255, 69, 58, 0.4)'
                  : '1px solid rgba(255, 255, 255, 0.15)',
              color:
                statusMessage.type === 'success'
                  ? '#30D158'
                  : statusMessage.type === 'error'
                  ? '#FF5A52'
                  : '#FAF7F2',
            }}
          >
            {statusMessage.type === 'success' && <Check size={14} style={{ flexShrink: 0 }} />}
            {statusMessage.type === 'error' && <AlertCircle size={14} style={{ flexShrink: 0 }} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          {getStoredGeminiKey() && (
            <button
              type="button"
              onClick={handleRemoveKey}
              style={{
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'rgba(255, 69, 58, 0.12)',
                border: '1px solid rgba(255, 69, 58, 0.35)',
                color: '#FF5A52',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Désactiver
            </button>
          )}

          <button
            type="button"
            onClick={handleTestAndSave}
            disabled={isTesting || !apiKey.trim()}
            style={{
              flex: 1,
              padding: '11px 18px',
              borderRadius: '12px',
              background: isTesting || !apiKey.trim()
                ? 'rgba(217, 249, 112, 0.3)'
                : 'linear-gradient(135deg, #D9F970 0%, #A3E635 100%)',
              color: '#0A0A0C',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: isTesting || !apiKey.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 16px rgba(217, 249, 112, 0.3)',
            }}
          >
            {isTesting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Validation en direct...</span>
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>Tester & Activer la Vraie IA</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
