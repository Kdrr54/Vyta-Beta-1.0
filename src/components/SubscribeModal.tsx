import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { subscriptionFeatures } from '../data/covyta';
import { X, Sparkles, Check, CreditCard, ShieldCheck } from 'lucide-react';

interface SubscribeModalProps {
  onClose: () => void;
}

const subscriptionFeaturesEn = [
  'Unlimited real-time CoVyta AI biometric conversations',
  'Early immune anomaly detection & guided protocol',
  'Optimal running, recovery & sleep recommendations',
  'Exportable PDF health reports for your physician',
  'Priority cloud synchronization and continuous ring updates',
];

export const SubscribeModal: React.FC<SubscribeModalProps> = ({ onClose }) => {
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const { setCovytaActive, t, language } = useApp();
  const [showCardForm, setShowCardForm] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const isEn = language === 'en';
  const features = isEn ? subscriptionFeaturesEn : subscriptionFeatures;

  // Card form state
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 9841');
  const [expiry, setExpiry] = useState('08/29');
  const [cvc, setCvc] = useState('841');

  const handleCompleteSubscription = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      setCovytaActive(true);
      setTimeout(() => {
        onClose();
      }, 1400);
    }, 700);
  };

  return (
    <div className={`modal-backdrop ${isClosing ? "is-closing" : ""}`} onClick={handleClose} style={{ zIndex: 160 }}>
      <div className={`modal-sheet ${isClosing ? "is-closing" : ""}`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="var(--gold)" />
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
              {t('sub.title')}
            </h2>
          </div>

          <button type="button" className="modal-close-btn" onClick={handleClose} aria-label={t('settings.close')}>
            <X size={16} />
          </button>
        </div>

        {isSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '30px 10px', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={28} color="var(--gold)" />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                {t('sub.welcome_title')}
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {t('sub.welcome_desc')}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Price banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(18, 18, 20, 0.9))',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: '#FFFFFF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('sub.banner_title')}
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 700, color: '#FFFFFF' }}>
                    {t('sub.price')}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {t('sub.period')}
                  </span>
                </div>
              </div>

              <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '6px' }}>
                {t('sub.cancel_anytime')}
              </span>
            </div>

            {/* Included features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('sub.features_unlocked')}
              </span>
              {features.map((feat, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#D1D1D6' }}>
                  <Check size={14} color="#FFFFFF" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            {/* Apple Pay Button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                className="apple-pay-btn"
                onClick={handleCompleteSubscription}
                disabled={isProcessing}
              >
                <svg width="16" height="20" viewBox="0 0 170 170" fill="currentColor">
                  <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.07-7.76-7.85-12.18-14.34-6.43-9.47-11.55-20.19-15.36-32.16-3.81-11.97-5.72-23.36-5.72-34.17 0-14.59 3.63-26.69 10.9-36.29 7.27-9.6 16.48-14.45 27.63-14.56 5.88 0 12.08 1.48 18.6 4.45 6.52 2.97 10.61 4.51 12.28 4.62 1.91-.22 6.27-1.85 13.08-4.9 6.81-3.04 12.82-4.4 18.03-4.08 13.72.65 24.58 5.66 32.58 15.02-12.19 7.4-18.17 17.3-17.95 29.72.22 9.8 4.08 18.06 11.59 24.78 7.51 6.72 16.48 10.45 26.92 11.2-2.18 6.75-4.78 13.6-7.82 20.55zM119.22 33.15c0-7.62 2.72-14.63 8.16-21.03 5.44-6.4 12.18-10.44 20.23-12.12.33 1.09.49 2.18.49 3.27 0 7.51-2.94 14.74-8.81 21.68-5.88 6.95-12.51 10.88-19.91 11.78-.11-1.09-.16-2.28-.16-3.58z" />
                </svg>
                <span>Pay</span>
              </button>

              {/* Credit card toggle & form */}
              {!showCardForm ? (
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    padding: '12px',
                    color: '#FFFFFF',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowCardForm(true)}
                >
                  <CreditCard size={15} />
                  <span>{t('sub.card_pay')}</span>
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{isEn ? 'Card Number' : 'Numéro de Carte'}</span>
                    <input
                      type="text"
                      className="chat-input"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{isEn ? 'Expiry' : 'Expiration'}</span>
                      <input
                        type="text"
                        className="chat-input"
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>CVC</span>
                      <input
                        type="text"
                        className="chat-input"
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="apple-pay-btn"
                    style={{
                      background: '#FFFFFF',
                      color: '#000000',
                      marginTop: '4px',
                      fontSize: '13.5px',
                      fontWeight: 700,
                    }}
                    onClick={handleCompleteSubscription}
                    disabled={isProcessing}
                  >
                    <span>
                      {isProcessing
                        ? (isEn ? 'Processing...' : 'Validation...')
                        : (isEn ? 'Confirm subscription (€5.99)' : 'Valider mon abonnement (5,99 €)')}
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text-tertiary)', fontSize: '10.5px', marginTop: '2px' }}>
              <ShieldCheck size={13} />
              <span>{isEn ? 'Secure, end-to-end encrypted checkout' : 'Paiement sécurisé et chiffré de bout en bout'}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
