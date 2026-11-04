import React, { useState } from 'react';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { getHealthKitState, syncWithHealthKit, HealthKitSyncState } from '../lib/appleHealthKit';
import { Heart, Activity, CheckCircle, RefreshCw, X, Shield, ArrowUpRight } from 'lucide-react';

interface HealthKitSyncModalProps {
  onClose: () => void;
}

export const HealthKitSyncModal: React.FC<HealthKitSyncModalProps> = ({ onClose }) => {
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const [state, setState] = useState<HealthKitSyncState>(getHealthKitState());
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      const updated = syncWithHealthKit();
      setState(updated);
      setIsSyncing(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 2600);
    }, 700);
  };

  const movePct = Math.min(100, Math.round((state.rings.moveCal / state.rings.moveGoal) * 100));
  const exPct = Math.min(100, Math.round((state.rings.exerciseMin / state.rings.exerciseGoal) * 100));
  const standPct = Math.min(100, Math.round((state.rings.standHours / state.rings.standGoal) * 100));

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
              background: 'linear-gradient(135deg, #FF2D55 0%, #FF3B30 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(255, 45, 85, 0.4)',
            }}>
              <Heart size={18} color="#FFFFFF" fill="#FFFFFF" />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
                Apple Santé & Fitness
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Pont bidirectionnel HealthKit actif
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

        {/* Apple Fitness Activity Rings Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '18px',
          padding: '16px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Anneaux d'Activité Apple
            </span>
            <span style={{ fontSize: '11px', color: '#30D158', fontWeight: 600 }}>
              ● Synchronisé en continu
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            {/* SVG Three Concentric Apple Rings */}
            <svg width="84" height="84" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
              {/* Outer Ring: Move (Red) */}
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255, 45, 85, 0.2)" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none" stroke="#FF2D55" strokeWidth="8"
                strokeDasharray={`${(movePct / 100) * 264} 264`}
                strokeLinecap="round"
              />

              {/* Middle Ring: Exercise (Green) */}
              <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(48, 209, 88, 0.2)" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="32" fill="none" stroke="#30D158" strokeWidth="8"
                strokeDasharray={`${(exPct / 100) * 201} 201`}
                strokeLinecap="round"
              />

              {/* Inner Ring: Stand (Cyan/Blue) */}
              <circle cx="50" cy="50" r="22" fill="none" stroke="rgba(10, 132, 255, 0.2)" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="22" fill="none" stroke="#0A84FF" strokeWidth="8"
                strokeDasharray={`${(standPct / 100) * 138} 138`}
                strokeLinecap="round"
              />
            </svg>

            {/* Metrics Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '12px', color: '#FF2D55', fontWeight: 600 }}>Bouger</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFF', fontFamily: 'var(--font-mono)' }}>
                  {state.rings.moveCal} <span style={{ fontSize: '10px', color: '#888' }}>/ {state.rings.moveGoal} kcal</span>
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '12px', color: '#30D158', fontWeight: 600 }}>M'entraîner</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFF', fontFamily: 'var(--font-mono)' }}>
                  {state.rings.exerciseMin} <span style={{ fontSize: '10px', color: '#888' }}>/ {state.rings.exerciseGoal} min</span>
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '12px', color: '#0A84FF', fontWeight: 600 }}>Me lever</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFF', fontFamily: 'var(--font-mono)' }}>
                  {state.rings.standHours} <span style={{ fontSize: '10px', color: '#888' }}>/ {state.rings.standGoal} h</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Synced Biomarkers from Stoic Ring One to Apple Health */}
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
            Biomarqueurs écrits dans Apple Santé
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {state.syncedMetrics.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={14} color="#30D158" />
                  <span style={{ fontSize: '12px', color: '#FFF', fontWeight: 500 }}>{m.label}</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFF', fontFamily: 'var(--font-mono)' }}>
                  {m.value} {m.unit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sync Button & Footer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '14px',
              background: '#FFFFFF',
              color: '#000000',
              fontWeight: 700,
              fontSize: '13.5px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 16px rgba(255, 255, 255, 0.2)',
            }}
          >
            <RefreshCw size={14} className={isSyncing ? 'pulse-radar' : undefined} />
            <span>{isSyncing ? 'Synchronisation Apple Santé...' : 'Forcer la synchronisation maintenant'}</span>
          </button>

          {showSuccessToast && (
            <div style={{ textAlign: 'center', color: '#30D158', fontSize: '11.5px', fontWeight: 600 }}>
              ✓ Données Apple Santé à jour (chiffrement de bout en bout)
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text-tertiary)', fontSize: '11px', marginTop: '4px' }}>
            <Shield size={12} />
            <span>Chiffrement matériel Apple Secure Enclave & RGPD Médical</span>
          </div>
        </div>
      </div>
    </div>
  );
};
