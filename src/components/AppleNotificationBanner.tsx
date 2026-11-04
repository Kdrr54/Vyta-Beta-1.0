import React, { useEffect, useState } from 'react';
import { PushNotificationPayload } from '../lib/apnsService';
import { Bell, X } from 'lucide-react';

export const AppleNotificationBanner: React.FC = () => {
  const [activeNotif, setActiveNotif] = useState<PushNotificationPayload | null>(null);

  useEffect(() => {
    const handleNotif = (e: any) => {
      if (e.detail) {
        setActiveNotif(e.detail);
        setTimeout(() => {
          setActiveNotif(null);
        }, 5000);
      }
    };

    window.addEventListener('vyta-inapp-notification', handleNotif);
    return () => window.removeEventListener('vyta-inapp-notification', handleNotif);
  }, []);

  if (!activeNotif) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        right: '12px',
        zIndex: 9999,
        background: 'rgba(28, 28, 32, 0.94)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        borderRadius: '18px',
        padding: '12px 14px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.8), 0 0 1px rgba(255, 255, 255, 0.2)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        animation: 'slideDownNotif 320ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '8px',
          background: 'rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Bell size={14} color="#FFFFFF" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            STOIC LABS • MAINTENANT
          </span>
          <button
            onClick={() => setActiveNotif(null)}
            style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: 0 }}
          >
            <X size={13} />
          </button>
        </div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', marginBottom: '2px' }}>
          {activeNotif.title}
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.35 }}>
          {activeNotif.body}
        </div>
      </div>
    </div>
  );
};
