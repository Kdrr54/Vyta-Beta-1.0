import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Wind } from 'lucide-react';

export const CoherenceSphere: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<'inhale' | 'exhale'>('inhale');
  const [secondsRemaining, setSecondsRemaining] = useState(4);
  const [sessionSeconds, setSessionSeconds] = useState(120);

  // 4s Inhale / 4s Exhale Loop
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prevSec) => {
        if (prevSec <= 1) {
          setPhase((prevPhase) => (prevPhase === 'inhale' ? 'exhale' : 'inhale'));
          return 4;
        }
        return prevSec - 1;
      });

      setSessionSeconds((prev) => {
        if (prev <= 1) {
          setIsActive(false);
          return 120;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);

  const handleToggle = () => {
    setIsActive(!isActive);
  };

  const handleReset = () => {
    setIsActive(false);
    setPhase('inhale');
    setSecondsRemaining(4);
    setSessionSeconds(120);
  };

  const sessionMin = Math.floor(sessionSeconds / 60);
  const sessionSec = String(sessionSeconds % 60).padStart(2, '0');

  return (
    <div className="coherence-card">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Biofeedback
          </span>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {sessionMin}:{sessionSec}
          </span>
        </div>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
          Cohérence Cardiaque 4s / 4s
        </h3>
        <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
          Synchronise le système parasympathique et booste la VFC
        </p>
      </div>

      {/* Guided breathing sphere */}
      <div className="sphere-stage">
        <div className="sphere-outer-pulse" />
        <div className={`sphere-core ${isActive ? phase : ''}`}>
          <Wind size={22} color="#000000" />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
          {isActive ? (phase === 'inhale' ? 'Inspirez...' : 'Expirez...') : 'Prêt pour la séance'}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {isActive ? `${secondsRemaining} secondes` : '2 minutes guidées'}
        </span>
      </div>

      {/* Interactive Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          className="coherence-action-btn"
          onClick={handleToggle}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          {isActive ? (
            <>
              <Pause size={14} />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play size={14} fill="#000" />
              <span>Commencer</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="gear-btn"
          title="Réinitialiser"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
};
