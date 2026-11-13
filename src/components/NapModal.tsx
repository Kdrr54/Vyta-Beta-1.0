import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sun, X } from 'lucide-react';

interface NapModalProps {
  onClose: () => void;
}

export const NapModal: React.FC<NapModalProps> = ({ onClose }) => {
  const { language, addManualNap, initialNapPreset } = useApp();
  const isEn = language === 'en';

  const [napPreset, setNapPreset] = useState<'power' | 'restful' | 'cycle'>(
    initialNapPreset || 'power'
  );
  const [napDurationMin, setNapDurationMin] = useState<number>(() => {
    if (initialNapPreset === 'restful') return 35;
    if (initialNapPreset === 'cycle') return 90;
    return 20;
  });
  const [napTimingMode, setNapTimingMode] = useState<'now' | '30m_ago' | '1h_ago' | 'custom'>('now');
  const [customStartStr, setCustomStartStr] = useState<string>('14:00');
  const [customEndStr, setCustomEndStr] = useState<string>('14:35');

  const handleSaveNap = () => {
    let startMin = 840;
    let endMin = 875;
    const now = new Date();
    const curNowMin = now.getHours() * 60 + now.getMinutes();

    if (napTimingMode === 'now') {
      endMin = curNowMin;
      startMin = ((endMin - napDurationMin) % 1440 + 1440) % 1440;
    } else if (napTimingMode === '30m_ago') {
      endMin = ((curNowMin - 30) % 1440 + 1440) % 1440;
      startMin = ((endMin - napDurationMin) % 1440 + 1440) % 1440;
    } else if (napTimingMode === '1h_ago') {
      endMin = ((curNowMin - 60) % 1440 + 1440) % 1440;
      startMin = ((endMin - napDurationMin) % 1440 + 1440) % 1440;
    } else {
      const [sH, sM] = customStartStr.split(':').map((v) => parseInt(v, 10));
      const [eH, eM] = customEndStr.split(':').map((v) => parseInt(v, 10));
      startMin = (isNaN(sH) ? 14 : sH) * 60 + (isNaN(sM) ? 0 : sM);
      endMin = (isNaN(eH) ? 14 : eH) * 60 + (isNaN(eM) ? 35 : eM);
    }

    addManualNap({
      startMin,
      endMin,
      napType: napPreset,
      deepMin: napPreset === 'power' ? 0 : (napPreset === 'restful' ? Math.round(napDurationMin * 0.3) : Math.round(napDurationMin * 0.25)),
      lightMin: napPreset === 'power' ? napDurationMin : (napPreset === 'restful' ? Math.round(napDurationMin * 0.7) : Math.round(napDurationMin * 0.55)),
      remMin: napPreset === 'cycle' ? Math.round(napDurationMin * 0.2) : 0,
    });
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        touchAction: 'none',
      }}
    >
      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '430px',
          background: '#14141A',
          borderTop: '1.5px solid rgba(245, 158, 11, 0.38)',
          borderRadius: '26px 26px 0 0',
          padding: '16px 18px max(24px, calc(env(safe-area-inset-bottom, 20px) + 12px)) 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.9)',
          maxHeight: '90vh',
          overflow: 'hidden',
          animation: 'slideUp 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Grabber */}
        <div
          style={{
            width: '36px',
            height: '4px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.2)',
            margin: '0 auto 2px auto',
          }}
        />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sun size={15} color="#F59E0B" />
            </span>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#FAF7F2' }}>
              {isEn ? 'Log a Nap' : 'Enregistrer une Sieste'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '26px',
              height: '26px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FAF7F2',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Presets Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '10.5px', color: '#8E8E93', fontWeight: 600 }}>
            {isEn ? 'Choose Nap Type:' : 'Type de sieste :'}
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            {[
              { id: 'power', label: 'Power Nap', min: 20, desc: isEn ? 'Zero grogginess' : 'Zéro inertie' },
              { id: 'restful', label: isEn ? 'Restful' : 'Récup', min: 35, desc: isEn ? 'Regen' : 'Régénération' },
              { id: 'cycle', label: isEn ? '90m Cycle' : 'Cycle 90m', min: 90, desc: isEn ? 'REM Cycle' : 'Cycle REM' },
            ].map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  setNapPreset(p.id as any);
                  setNapDurationMin(p.min);
                }}
                style={{
                  background: napPreset === p.id ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  border: napPreset === p.id ? '1.5px solid #F59E0B' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '8px 4px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFF' }}>{p.label}</span>
                <span style={{ fontSize: '10px', color: '#F59E0B', fontWeight: 700 }}>{p.min} min</span>
                <span style={{ fontSize: '8px', color: 'rgba(250,247,242,0.5)' }}>{p.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timing Selector Chips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '10.5px', color: '#8E8E93', fontWeight: 600 }}>
            {isEn ? 'When did the nap end?' : 'Quand s’est-elle terminée ?'}
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {[
              { id: 'now', label: isEn ? 'Just now' : 'À l’instant' },
              { id: '30m_ago', label: isEn ? '-30 min' : 'Il y a 30m' },
              { id: '1h_ago', label: isEn ? '-1 hour' : 'Il y a 1h' },
              { id: 'custom', label: isEn ? 'Custom' : 'Précis' },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setNapTimingMode(chip.id as any)}
                style={{
                  background: napTimingMode === chip.id ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.05)',
                  border: napTimingMode === chip.id ? '1px solid #FFF' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '6px 2px',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: napTimingMode === chip.id ? '#FFF' : '#8E8E93',
                  cursor: 'pointer',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Inputs if selected */}
        {napTimingMode === 'custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '9.5px', color: '#8E8E93', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                {isEn ? 'Start Time' : 'Heure Début'}
              </label>
              <input
                type="time"
                value={customStartStr}
                onChange={(e) => setCustomStartStr(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  color: '#FFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  padding: '6px',
                  textAlign: 'center',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '9.5px', color: '#8E8E93', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                {isEn ? 'End Time' : 'Heure Fin'}
              </label>
              <input
                type="time"
                value={customEndStr}
                onChange={(e) => setCustomEndStr(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  color: '#FFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  padding: '6px',
                  textAlign: 'center',
                }}
              />
            </div>
          </div>
        )}

        {/* Impact Summary */}
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '12px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.85)' }}>
            {isEn ? 'Energy Bonus' : 'Gain de récupération'} :{' '}
            <strong style={{ color: '#F59E0B' }}>
              +{Math.min(18, Math.max(5, Math.round(napDurationMin / 4.5)))}% Body Energy
            </strong>
          </span>
          <span style={{ fontSize: '10.5px', color: '#30D158', fontWeight: 700 }}>
            {napDurationMin <= 25 ? (isEn ? 'Zero grogginess' : 'Zéro inertie') : (isEn ? 'Restful' : 'Régénération')}
          </span>
        </div>

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSaveNap}
          style={{
            width: '100%',
            height: '44px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            border: 'none',
            color: '#FFF',
            fontSize: '13.5px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)',
            marginTop: '2px',
          }}
        >
          <Sun size={15} color="#FFF" />
          <span>{isEn ? 'Save Nap' : 'Enregistrer la sieste'}</span>
        </button>
      </div>
    </div>
  );
};
