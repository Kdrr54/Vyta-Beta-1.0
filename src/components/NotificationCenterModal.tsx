import React, { useState } from 'react';
import { useModalAnimation } from '../hooks/useModalAnimation';
import {
  getStoredNotifications,
  saveNotifications,
  requestBrowserNotificationPermission,
  dispatchApplePush,
  PushNotificationPayload,
} from '../lib/apnsService';
import { Bell, X, Check, Battery, Moon, Zap, Shield } from 'lucide-react';

interface NotificationCenterModalProps {
  onClose: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({ onClose }) => {
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const [notifs, setNotifs] = useState<PushNotificationPayload[]>(getStoredNotifications());
  const [permGranted, setPermGranted] = useState<boolean>(
    'Notification' in window && Notification.permission === 'granted'
  );

  const handleAskPermission = async () => {
    const ok = await requestBrowserNotificationPermission();
    setPermGranted(ok);
  };

  const handleSendTest = (type: 'battery' | 'sleep' | 'vrc') => {
    if (type === 'battery') {
      dispatchApplePush('🔋 Bague Vyta One', 'Charge à 100% — Prête pour 7 jours d\'autonomie continue.', 'battery');
    } else if (type === 'sleep') {
      dispatchApplePush('🌙 Préparation au Sommeil', 'Température corporelle en baisse. Fenêtre idéale dans 20 min.', 'sleep');
    } else {
      dispatchApplePush('⚡ Récupération VRC', 'VRC à 64 ms (+12%) : Score de vitalité optimal (91/100).', 'vrc');
    }
    setNotifs(getStoredNotifications());
  };

  const handleClear = () => {
    saveNotifications([]);
    setNotifs([]);
  };

  return (
    <div className={`modal-backdrop ${isClosing ? "is-closing" : ""}`} onClick={handleClose}>
      <div
        className={`modal-sheet ${isClosing ? "is-closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '420px', padding: '22px 18px', background: '#0D0E12', borderRadius: '24px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              background: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Bell size={18} color="#FFFFFF" />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
                Centre d'Alertes Apple APNs
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Notifications push Apple sécurisées
              </span>
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#FFF' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Permission Banner */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '14px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFF' }}>
              Autorisation Système
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              {permGranted ? '🟢 Notifications système autorisées' : 'Activer les alertes sur votre appareil'}
            </div>
          </div>

          {!permGranted && (
            <button
              onClick={handleAskPermission}
              style={{
                background: '#FFFFFF',
                color: '#000',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '11.5px',
                cursor: 'pointer',
              }}
            >
              Activer
            </button>
          )}
        </div>

        {/* Quick Simulation Buttons */}
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
            Tester une alerte intelligente
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <button
              onClick={() => handleSendTest('battery')}
              style={{
                padding: '10px 6px',
                borderRadius: '12px',
                background: 'rgba(48, 209, 88, 0.12)',
                border: '1px solid rgba(48, 209, 88, 0.3)',
                color: '#30D158',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <Battery size={16} />
              <span>Charge 100%</span>
            </button>

            <button
              onClick={() => handleSendTest('sleep')}
              style={{
                padding: '10px 6px',
                borderRadius: '12px',
                background: 'rgba(191, 90, 242, 0.12)',
                border: '1px solid rgba(191, 90, 242, 0.3)',
                color: '#BF5AF2',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <Moon size={16} />
              <span>Sommeil</span>
            </button>

            <button
              onClick={() => handleSendTest('vrc')}
              style={{
                padding: '10px 6px',
                borderRadius: '12px',
                background: 'rgba(255, 214, 10, 0.12)',
                border: '1px solid rgba(255, 214, 10, 0.3)',
                color: '#FFD60A',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <Zap size={16} />
              <span>VRC Haute</span>
            </button>
          </div>
        </div>

        {/* Notifications History List */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Historique des alertes
            </span>
            {notifs.length > 0 && (
              <button
                onClick={handleClear}
                style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '11px', cursor: 'pointer' }}
              >
                Effacer tout
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                Aucune alerte en attente
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#FFF', marginBottom: '2px' }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                    {n.body}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Security badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text-tertiary)', fontSize: '11px', marginTop: '16px' }}>
          <Shield size={12} />
          <span>Certifié Apple APNs • Chiffrement HTTP/2 Token-based</span>
        </div>
      </div>
    </div>
  );
};
