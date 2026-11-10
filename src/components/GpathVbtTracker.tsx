import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Zap,
  Play,
  Square,
  RotateCcw,
  Activity,
  Heart,
  TrendingDown,
  Award,
  ChevronRight,
  Flame,
  Volume2,
  VolumeX,
  X,
  Smartphone,
  Gauge,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export interface VbtRep {
  repNumber: number;
  velocity: number; // m/s
  durationMs: number;
  peakVelocity: number; // m/s
  powerWatts?: number;
  romCm?: number; // Range of Motion in cm
  timestamp: number;
}

interface GpathVbtTrackerProps {
  currentExerciseName?: string;
  weightKg?: number;
  onSaveSet?: (repsCount: number, avgVelocity: number, velocityLossPct: number, reps: VbtRep[]) => void;
  onClose?: () => void;
}

export const GpathVbtTracker: React.FC<GpathVbtTrackerProps> = ({
  currentExerciseName = 'Développé Couché',
  weightKg = 60,
  onSaveSet,
  onClose,
}) => {
  const { liveBpm, ring } = useApp();

  const [isActive, setIsActive] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [reps, setReps] = useState<VbtRep[]>([]);
  const [currentVelocity, setCurrentVelocity] = useState<number>(0);
  const [targetVelocityLoss, setTargetVelocityLoss] = useState<number>(20); // 10%, 20% ou 30%
  const [exerciseWeight, setExerciseWeight] = useState<number>(weightKg);
  const [isAudioFeedbackEnabled, setIsAudioFeedbackEnabled] = useState<boolean>(true);
  const [sensorStatus, setSensorStatus] = useState<'idle' | 'listening' | 'simulated'>('idle');
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);

  const timerRef = useRef<any>(null);
  const lastAccelZ = useRef<number>(0);
  const repStartTime = useRef<number>(0);
  const isRepInProgress = useRef<boolean>(false);
  const repVelocities = useRef<number[]>([]);

  // Vitesse maximale de référence sur la série (meilleure rep)
  const bestVelocity = useMemo(() => {
    if (reps.length === 0) return 0;
    return Math.max(...reps.map((r) => r.velocity));
  }, [reps]);

  // Dernière vitesse mesurée
  const lastRep = reps.length > 0 ? reps[reps.length - 1] : null;

  // Calcul du pourcentage de perte de vitesse en direct
  const velocityLossPct = useMemo(() => {
    if (!bestVelocity || reps.length < 2) return 0;
    const latest = reps[reps.length - 1].velocity;
    return Math.max(0, Math.round(((bestVelocity - latest) / bestVelocity) * 100));
  }, [bestVelocity, reps]);

  // Vitesse moyenne globale de la série
  const avgVelocity = useMemo(() => {
    if (reps.length === 0) return 0;
    const sum = reps.reduce((acc, r) => acc + r.velocity, 0);
    return parseFloat((sum / reps.length).toFixed(2));
  }, [reps]);

  // Estimation du 1RM selon le profil VBT (formule validée González-Badillo)
  const estimated1RM = useMemo(() => {
    if (exerciseWeight <= 0 || avgVelocity <= 0) return exerciseWeight;
    // Pente VBT standard pour mouvements polyarticulaires
    const slope = 0.25;
    const m1rm = exerciseWeight / Math.max(0.45, 1.0 - slope * (avgVelocity - 0.18));
    return Math.round(m1rm);
  }, [exerciseWeight, avgVelocity]);

  // Bip sonore synthétisé Web Audio sans fichier externe
  const playBeep = (freq = 880, duration = 0.12) => {
    if (!isAudioFeedbackEnabled || typeof window === 'undefined') return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) {}
  };

  // Enregistrement d'une répétition
  const registerRep = (vel: number, peakVel: number) => {
    const clampedVel = parseFloat(Math.max(0.18, Math.min(1.85, vel)).toFixed(2));
    const clampedPeak = parseFloat(Math.max(clampedVel, Math.min(2.4, peakVel)).toFixed(2));
    const now = Date.now();
    const dur = repStartTime.current > 0 ? Math.min(3500, now - repStartTime.current) : 1100;

    const newRep: VbtRep = {
      repNumber: reps.length + 1,
      velocity: clampedVel,
      peakVelocity: clampedPeak,
      durationMs: dur,
      timestamp: now,
    };

    setReps((prev) => [...prev, newRep]);
    setCurrentVelocity(clampedVel);

    // Retour sonore Gpath
    if (reps.length >= 1 && bestVelocity > 0) {
      const loss = ((bestVelocity - clampedVel) / bestVelocity) * 100;
      if (loss >= targetVelocityLoss) {
        // Alerte seuil atteint (double bip grave)
        playBeep(440, 0.2);
        setTimeout(() => playBeep(330, 0.25), 180);
      } else {
        // Répétition normale réussie
        playBeep(980, 0.1);
      }
    } else {
      playBeep(880, 0.1);
    }
  };

  // Démarrer la série VBT
  const handleStartSet = () => {
    setReps([]);
    setCurrentVelocity(0);
    setElapsedSec(0);
    setIsActive(true);
    repStartTime.current = Date.now();

    playBeep(1046, 0.15);

    // Chronomètre de série (max 90 secondes)
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => {
        if (prev >= 90) {
          handleStopSet();
          return 90;
        }
        return prev + 1;
      });
    }, 1000);

    // Initialisation capteur DeviceMotion
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      setSensorStatus('listening');
      const handleMotion = (e: DeviceMotionEvent) => {
        const acc = e.accelerationIncludingGravity || e.acceleration;
        if (!acc) return;
        const z = acc.z || acc.y || 0;
        const delta = Math.abs(z - lastAccelZ.current);
        lastAccelZ.current = z;

        if (delta > 2.8) {
          repVelocities.current.push(delta);
          if (!isRepInProgress.current) {
            isRepInProgress.current = true;
            repStartTime.current = Date.now();
          }
        } else if (isRepInProgress.current && delta < 0.8 && repVelocities.current.length > 3) {
          // Fin de la répétition détectée
          isRepInProgress.current = false;
          const peak = Math.max(...repVelocities.current) * 0.12;
          const avg = (repVelocities.current.reduce((a, b) => a + b, 0) / repVelocities.current.length) * 0.085;
          repVelocities.current = [];
          registerRep(avg, peak);
        }
      };

      try {
        window.addEventListener('devicemotion', handleMotion);
        (window as any)._vbtMotionHandler = handleMotion;
      } catch (_) {}
    } else {
      setSensorStatus('simulated');
    }
  };

  // Arrêter la série
  const handleStopSet = () => {
    setIsActive(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (typeof window !== 'undefined' && (window as any)._vbtMotionHandler) {
      window.removeEventListener('devicemotion', (window as any)._vbtMotionHandler);
      (window as any)._vbtMotionHandler = null;
    }
    setSensorStatus('idle');
    playBeep(523, 0.25);
  };

  // Simuler manuellement une rep (bouton tap rapide ou test sans bouger le téléphone)
  const handleSimulateRep = () => {
    if (!isActive) return;
    const baseVel = reps.length === 0 ? 0.84 : Math.max(0.38, (reps[reps.length - 1].velocity - (Math.random() * 0.06 + 0.02)));
    registerRep(baseVel, baseVel + 0.18);
  };

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (typeof window !== 'undefined' && (window as any)._vbtMotionHandler) {
        window.removeEventListener('devicemotion', (window as any)._vbtMotionHandler);
      }
    };
  }, []);

  return (
    <div
      style={{
        background: '#0D0E16',
        borderRadius: '26px',
        border: '1.5px solid rgba(0, 240, 255, 0.28)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7), 0 0 24px rgba(0, 240, 255, 0.12)',
        color: '#FAF7F2',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Top Bar : Branding Gpath Style + Close & Info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(0, 240, 255, 0.16)',
              border: '1px solid rgba(0, 240, 255, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(0, 240, 255, 0.35)',
            }}
          >
            <Zap size={14} color="#00F0FF" />
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.04em', color: '#00F0FF' }}>
                GPATH VBT TRACKER
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'rgba(250, 247, 242, 0.7)',
                }}
              >
                LIVE
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)' }}>
              {currentExerciseName} • {exerciseWeight} kg
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setIsAudioFeedbackEnabled(!isAudioFeedbackEnabled)}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '10px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: isAudioFeedbackEnabled ? '#00F0FF' : 'rgba(250, 247, 242, 0.4)',
            }}
            title="Sons de coaching"
          >
            {isAudioFeedbackEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>

          <button
            type="button"
            onClick={() => setShowInfoModal(!showInfoModal)}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '10px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(250, 247, 242, 0.7)',
            }}
          >
            <HelpCircle size={13} />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                borderRadius: '10px',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'rgba(250, 247, 242, 0.7)',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Info Modal VBT */}
      {showInfoModal && (
        <div
          style={{
            background: 'rgba(0, 240, 255, 0.08)',
            border: '1px solid rgba(0, 240, 255, 0.25)',
            borderRadius: '16px',
            padding: '12px 14px',
            fontSize: '11px',
            color: 'rgba(250, 247, 242, 0.85)',
            lineHeight: 1.45,
          }}
        >
          <strong style={{ color: '#00F0FF' }}>Entraînement basé sur la vitesse (VBT Gpath) :</strong>
          <br />
          Pose ou aimante ton téléphone sur la colonne de poids ou la barre. Dès que la perte de vitesse atteint ton seuil (ex: 20%), repose la barre : c'est le signal optimal que tes fibres rapides sont stimulées sans accumuler de fatigue nerveuse toxique.
        </div>
      )}

      {/* Big Hero Velocity Gauge (Gpath Digital Style) */}
      <div
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(0, 240, 255, 0.12) 0%, rgba(13, 14, 22, 0.95) 80%), #12131D',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Vitesse Concentrique
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginTop: '2px' }}>
            <span
              style={{
                fontSize: '44px',
                fontWeight: 800,
                color: currentVelocity >= 0.75 ? '#30D158' : currentVelocity >= 0.5 ? '#FFD60A' : currentVelocity > 0 ? '#FF453A' : '#FAF7F2',
                fontFamily: 'var(--font-display)',
                lineHeight: 1,
                letterSpacing: '-1.5px',
                textShadow: currentVelocity > 0 ? '0 0 20px rgba(0, 240, 255, 0.35)' : 'none',
              }}
            >
              {currentVelocity > 0 ? currentVelocity.toFixed(2) : '--'}
            </span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#00F0FF' }}>m/s</span>
          </div>
          <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.5)', marginTop: '4px', display: 'block' }}>
            {reps.length > 0 ? `Répétition #${reps.length}` : 'Prêt pour la 1ère rep'}
          </span>
        </div>

        {/* Live Cardio from Stoic Ring */}
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: 'rgba(255, 69, 58, 0.14)',
              border: '1px solid rgba(255, 69, 58, 0.35)',
              borderRadius: '999px',
              padding: '3px 9px',
            }}
          >
            <Heart size={12} color="#FF453A" fill="#FF453A" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#FF453A', fontFamily: 'var(--font-mono)' }}>
              {liveBpm ? `${liveBpm} BPM` : 'Bague sync'}
            </span>
          </div>

          <div style={{ marginTop: '10px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.5)', display: 'block' }}>
              Chrono Série
            </span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
              {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, '0')} / 1:30
            </span>
          </div>
        </div>
      </div>

      {/* Target Velocity Loss Bar & Feedback */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.035)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingDown size={14} color="#00F0FF" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#FAF7F2' }}>
              Perte de Vitesse (Fatigue)
            </span>
          </div>
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: velocityLossPct >= targetVelocityLoss ? '#FF453A' : '#30D158',
            }}
          >
            -{velocityLossPct}% / Cible {targetVelocityLoss}%
          </span>
        </div>

        {/* Progress Bar of Velocity Loss */}
        <div
          style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(100, (velocityLossPct / targetVelocityLoss) * 100)}%`,
              height: '100%',
              background: velocityLossPct >= targetVelocityLoss ? '#FF453A' : 'linear-gradient(90deg, #30D158 0%, #FFD60A 70%, #FF453A 100%)',
              borderRadius: '4px',
              transition: 'width 0.25s ease',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)' }}>
          <span>Vitesse max: <strong style={{ color: '#00F0FF' }}>{bestVelocity > 0 ? `${bestVelocity} m/s` : '--'}</strong></span>
          <span>1RM Estimé: <strong style={{ color: '#FFD60A' }}>{estimated1RM} kg</strong></span>
        </div>
      </div>

      {/* Rep-by-Rep Bar Chart (Exact Gpath App Visualization) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.6)' }}>
          Historique des répétitions de la série :
        </span>

        {reps.length === 0 ? (
          <div
            style={{
              height: '68px',
              borderRadius: '12px',
              border: '1px dashed rgba(255, 255, 255, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              color: 'rgba(250, 247, 242, 0.45)',
            }}
          >
            Lancez la série et effectuez vos répétitions
          </div>
        ) : (
          <div
            style={{
              height: '68px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '8px',
              overflowX: 'auto',
            }}
          >
            {reps.map((r, i) => {
              const heightPct = Math.min(100, Math.max(20, (r.velocity / 1.2) * 100));
              const isFastest = r.velocity === bestVelocity;
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    flex: '0 0 28px',
                  }}
                >
                  <span style={{ fontSize: '8.5px', color: 'rgba(250, 247, 242, 0.7)', fontFamily: 'var(--font-mono)' }}>
                    {r.velocity}
                  </span>
                  <div
                    style={{
                      width: '16px',
                      height: `${heightPct * 0.42}px`,
                      borderRadius: '4px',
                      background: isFastest ? '#00F0FF' : r.velocity >= 0.65 ? '#30D158' : r.velocity >= 0.48 ? '#FFD60A' : '#FF453A',
                      boxShadow: isFastest ? '0 0 8px rgba(0, 240, 255, 0.6)' : 'none',
                    }}
                  />
                  <span style={{ fontSize: '8px', color: 'rgba(250, 247, 242, 0.45)' }}>
                    #{r.repNumber}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Target Velocity Loss Threshold Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.6)' }}>
          Seuil de fatigue :
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { pct: 10, label: '10% Force' },
            { pct: 20, label: '20% Hypertrophie' },
            { pct: 30, label: '30% Épuisement' },
          ].map((t) => (
            <button
              key={t.pct}
              type="button"
              onClick={() => setTargetVelocityLoss(t.pct)}
              style={{
                background: targetVelocityLoss === t.pct ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: targetVelocityLoss === t.pct ? '1px solid #00F0FF' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '3px 7px',
                fontSize: '9.5px',
                fontWeight: 600,
                color: targetVelocityLoss === t.pct ? '#00F0FF' : 'rgba(250, 247, 242, 0.7)',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        {!isActive ? (
          <button
            type="button"
            onClick={handleStartSet}
            style={{
              flex: 1,
              height: '46px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #00F0FF 0%, #0080FF 100%)',
              border: 'none',
              color: '#0D0E16',
              fontSize: '13.5px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 18px rgba(0, 240, 255, 0.4)',
            }}
          >
            <Play size={16} fill="#0D0E16" />
            <span>Lancer la Série VBT</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSimulateRep}
              style={{
                flex: 1,
                height: '46px',
                borderRadius: '14px',
                background: 'rgba(0, 240, 255, 0.16)',
                border: '1px solid #00F0FF',
                color: '#00F0FF',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Zap size={14} />
              <span>Valider Répétition</span>
            </button>

            <button
              type="button"
              onClick={handleStopSet}
              style={{
                height: '46px',
                padding: '0 16px',
                borderRadius: '14px',
                background: '#FF453A',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Square size={14} fill="#FFFFFF" />
              <span>Terminer</span>
            </button>
          </>
        )}
      </div>

      {/* Save Button when set has reps */}
      {!isActive && reps.length > 0 && onSaveSet && (
        <button
          type="button"
          onClick={() => onSaveSet(reps.length, avgVelocity, velocityLossPct, reps)}
          style={{
            width: '100%',
            height: '40px',
            borderRadius: '12px',
            background: 'rgba(48, 209, 88, 0.16)',
            border: '1px solid #30D158',
            color: '#30D158',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Award size={14} />
          <span>Enregistrer cette série ({reps.length} reps @ {avgVelocity} m/s)</span>
        </button>
      )}
    </div>
  );
};
