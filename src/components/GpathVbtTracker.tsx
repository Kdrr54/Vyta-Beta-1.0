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
  Flame,
  Volume2,
  VolumeX,
  X,
  Smartphone,
  Gauge,
  HelpCircle,
  ShieldCheck,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { Motion } from '@capacitor/motion';
import type { PluginListenerHandle } from '@capacitor/core';
import { useApp } from '../context/AppContext';

export interface VbtRep {
  repNumber: number;
  velocity: number; // m/s (Mean Propulsive Velocity)
  peakVelocity: number; // m/s
  durationMs: number;
  powerWatts: number;
  romCm: number; // Range of Motion in cm
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
  const { liveBpm, isLiveHrActive, toggleLiveHr, ring } = useApp();

  const [isActive, setIsActive] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [reps, setReps] = useState<VbtRep[]>([]);
  const [liveInstantVelocity, setLiveInstantVelocity] = useState<number>(0);
  const [targetVelocityLoss, setTargetVelocityLoss] = useState<number>(20); // 10%, 20% ou 30%
  const [exerciseWeight, setExerciseWeight] = useState<number>(weightKg);
  const [isAudioFeedbackEnabled, setIsAudioFeedbackEnabled] = useState<boolean>(true);
  const [sensorStatus, setSensorStatus] = useState<'idle' | 'ready' | 'measuring' | 'needs_permission' | 'error'>('idle');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [liveAccelZ, setLiveAccelZ] = useState<number>(0);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);

  // References pour le calcul physique pur (sans aucun random)
  const timerRef = useRef<any>(null);
  const motionListenerHandle = useRef<PluginListenerHandle | null>(null);
  const isRepInProgress = useRef<boolean>(false);
  const repStartTime = useRef<number>(0);
  const lastSampleTime = useRef<number>(0);
  const currentV = useRef<number>(0);
  const peakV = useRef<number>(0);
  const repDisplacement = useRef<number>(0);
  const repSamples = useRef<number[]>([]);
  const repAccelSamples = useRef<number[]>([]);
  const cooldownUntil = useRef<number>(0);
  const gravityVec = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: -9.81 });
  const prevAvert = useRef<number>(0);

  // Meilleure vitesse enregistrée sur la série en cours
  const bestVelocity = useMemo(() => {
    if (reps.length === 0) return 0;
    return Math.max(...reps.map((r) => r.velocity));
  }, [reps]);

  // Dernière répétition validée
  const lastRep = reps.length > 0 ? reps[reps.length - 1] : null;

  // Perte de vitesse réelle en pourcentage (%) par rapport à la meilleure rep
  const velocityLossPct = useMemo(() => {
    if (!bestVelocity || reps.length < 2) return 0;
    const latest = reps[reps.length - 1].velocity;
    return Math.max(0, Math.round(((bestVelocity - latest) / bestVelocity) * 100));
  }, [bestVelocity, reps]);

  // Vitesse moyenne globale (MPV) de la série
  const avgVelocity = useMemo(() => {
    if (reps.length === 0) return 0;
    const sum = reps.reduce((acc, r) => acc + r.velocity, 0);
    return parseFloat((sum / reps.length).toFixed(2));
  }, [reps]);

  // Puissance moyenne (Watts)
  const avgPowerWatts = useMemo(() => {
    if (reps.length === 0) return 0;
    const sum = reps.reduce((acc, r) => acc + r.powerWatts, 0);
    return Math.round(sum / reps.length);
  }, [reps]);

  // Estimation du 1RM selon le profil vitesse VBT (formule validée González-Badillo)
  const estimated1RM = useMemo(() => {
    if (exerciseWeight <= 0 || avgVelocity <= 0) return exerciseWeight;
    // Pente VBT standard pour mouvements polyarticulaires
    const slope = 0.25;
    const m1rm = exerciseWeight / Math.max(0.45, 1.0 - slope * (avgVelocity - 0.18));
    return Math.round(m1rm);
  }, [exerciseWeight, avgVelocity]);

  // Bip sonore haute fidélité via Web Audio API (aucun fichier externe)
  const playBeep = (freq = 880, duration = 0.12) => {
    if (!isAudioFeedbackEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) {}
  };

  // Enregistrement d'une répétition validée physiquement
  const registerRep = (
    vel: number,
    peakVel: number,
    durMs: number,
    powerW: number,
    romCm: number
  ) => {
    const clampedVel = parseFloat(Math.max(0.15, vel).toFixed(2));
    const clampedPeak = parseFloat(Math.max(clampedVel, peakVel).toFixed(2));
    const now = Date.now();

    const newRep: VbtRep = {
      repNumber: reps.length + 1,
      velocity: clampedVel,
      peakVelocity: clampedPeak,
      durationMs: durMs,
      powerWatts: powerW,
      romCm: romCm,
      timestamp: now,
    };

    setReps((prev) => {
      const updated = [...prev, newRep];
      // Vérifier le seuil de perte de vitesse
      if (updated.length >= 2) {
        const curBest = Math.max(...updated.map((r) => r.velocity));
        const loss = ((curBest - clampedVel) / curBest) * 100;
        if (loss >= targetVelocityLoss) {
          // Seuil de fatigue atteint : Alerte sonore (double bip d'arrêt)
          playBeep(440, 0.18);
          setTimeout(() => playBeep(330, 0.22), 160);
        } else {
          // Répétition normale réussie
          playBeep(988, 0.1);
        }
      } else {
        // Première rep (référence)
        playBeep(880, 0.12);
      }
      return updated;
    });

    setLiveInstantVelocity(clampedVel);
  };

  // Traitement d'un échantillon d'accélération physique
  const processMotionSample = (
    accLin: { x: number; y: number; z: number },
    accG: { x: number; y: number; z: number }
  ) => {
    const now = performance.now();
    if (lastSampleTime.current === 0) {
      lastSampleTime.current = now;
      return;
    }

    const dt = Math.min(0.06, Math.max(0.005, (now - lastSampleTime.current) / 1000));
    lastSampleTime.current = now;

    // Estimation continue du vecteur gravité (direction du bas)
    gravityVec.current.x = 0.92 * gravityVec.current.x + 0.08 * (accG.x || 0);
    gravityVec.current.y = 0.92 * gravityVec.current.y + 0.08 * (accG.y || 0);
    gravityVec.current.z = 0.92 * gravityVec.current.z + 0.08 * (accG.z || -9.81);

    const gNorm =
      Math.sqrt(
        gravityVec.current.x ** 2 +
          gravityVec.current.y ** 2 +
          gravityVec.current.z ** 2
      ) || 9.81;

    // Vecteur unitaire vers le haut (opposé à la gravité)
    const upX = -gravityVec.current.x / gNorm;
    const upY = -gravityVec.current.y / gNorm;
    const upZ = -gravityVec.current.z / gNorm;

    // Projection de l'accélération linéaire sur l'axe vertical
    const aVertRaw = accLin.x * upX + accLin.y * upY + accLin.z * upZ;

    // Filtre passe-bas pour lisser le bruit résiduel
    const aVertFiltered = 0.72 * prevAvert.current + 0.28 * aVertRaw;
    prevAvert.current = aVertFiltered;

    // Seuil de zone morte (téléphone immobile = 0 m/s²)
    const aVert = Math.abs(aVertFiltered) < 0.25 ? 0 : aVertFiltered;
    setLiveAccelZ(parseFloat(aVert.toFixed(2)));

    // Machine d'états de détection de répétition
    if (isRepInProgress.current) {
      // Phase concentrique en cours : intégration numérique de la vitesse
      currentV.current += aVert * dt;
      if (currentV.current < 0) currentV.current = 0;

      repSamples.current.push(currentV.current);
      repAccelSamples.current.push(aVert);
      repDisplacement.current += currentV.current * dt;

      if (currentV.current > peakV.current) {
        peakV.current = currentV.current;
      }

      setLiveInstantVelocity(parseFloat(currentV.current.toFixed(2)));

      const repDur = now - repStartTime.current;
      const isBrakingOrLockout = currentV.current < 0.12 || aVert < -0.95;

      // Condition de fin de répétition : décélération au verrouillage ou vitesse retombée
      if (isBrakingOrLockout && repDur >= 350) {
        const romMeters = repDisplacement.current;
        const peakVel = peakV.current;

        // Une répétition de musculation réelle valide présente :
        // - Vitesse de pointe >= 0.20 m/s
        // - Déplacement vertical >= 0.10 m (10 cm)
        // - Au moins 8 échantillons temporels
        if (peakVel >= 0.20 && romMeters >= 0.10 && repSamples.current.length >= 8) {
          const positiveSamples = repSamples.current.filter((v) => v > 0.05);
          const meanVelocity =
            positiveSamples.length > 0
              ? positiveSamples.reduce((a, b) => a + b, 0) / positiveSamples.length
              : peakVel * 0.72;

          const meanAccel =
            repAccelSamples.current.reduce((a, b) => a + b, 0) /
            repAccelSamples.current.length;

          // Puissance réelle en Watts = Force (m * (g + a)) * Vitesse
          const powerWatts = Math.round(
            exerciseWeight * (9.81 + Math.max(0, meanAccel)) * meanVelocity
          );
          const romCm = Math.round(romMeters * 100);

          registerRep(meanVelocity, peakVel, Math.round(repDur), powerWatts, romCm);
        }

        // Réinitialisation pour la prochaine répétition
        isRepInProgress.current = false;
        currentV.current = 0;
        peakV.current = 0;
        repDisplacement.current = 0;
        repSamples.current = [];
        repAccelSamples.current = [];
        cooldownUntil.current = now + 420; // Période réfractaire anti-rebond (420ms)
      }
    } else {
      // En attente du début de la phase concentrique (poussée vers le haut)
      if (now > cooldownUntil.current && aVert > 1.25) {
        isRepInProgress.current = true;
        repStartTime.current = now;
        currentV.current = Math.max(0.1, aVert * dt);
        peakV.current = currentV.current;
        repDisplacement.current = currentV.current * dt;
        repSamples.current = [currentV.current];
        repAccelSamples.current = [aVert];
        setLiveInstantVelocity(parseFloat(currentV.current.toFixed(2)));
      } else {
        // Appareil au repos ou phase excentrique contrôlée
        currentV.current = 0;
      }
    }
  };

  // Demander la permission iOS pour DeviceMotion si nécessaire
  const requestMotionPermissionIfNeeded = async (): Promise<boolean> => {
    if (
      typeof window !== 'undefined' &&
      typeof (DeviceMotionEvent as any)?.requestPermission === 'function'
    ) {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission();
        if (response === 'granted') {
          setPermissionError(null);
          return true;
        } else {
          setPermissionError(
            "Accès aux capteurs refusé. Active l'accès au mouvement dans les réglages Safari / iOS."
          );
          setSensorStatus('needs_permission');
          return false;
        }
      } catch (err: any) {
        console.warn('Erreur demande permission capteur:', err);
        setPermissionError(err?.message || 'Erreur lors de la demande de capteur');
        return false;
      }
    }
    return true;
  };

  // Démarrer la série VBT
  const handleStartSet = async () => {
    setPermissionError(null);
    const hasPermission = await requestMotionPermissionIfNeeded();
    if (!hasPermission) return;

    setReps([]);
    setLiveInstantVelocity(0);
    setElapsedSec(0);
    setIsActive(true);
    setSensorStatus('measuring');
    lastSampleTime.current = 0;
    isRepInProgress.current = false;
    currentV.current = 0;
    peakV.current = 0;
    repDisplacement.current = 0;
    repSamples.current = [];
    repAccelSamples.current = [];
    cooldownUntil.current = 0;

    playBeep(1046, 0.15);

    // Chronomètre de série (limite de sécurité à 120s)
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => {
        if (prev >= 120) {
          handleStopSet();
          return 120;
        }
        return prev + 1;
      });
    }, 1000);

    // Attachement du récepteur de mouvement physique
    try {
      // 1. Essai avec le plugin natif @capacitor/motion
      const handle = await Motion.addListener('accel', (event) => {
        const accLin = event.acceleration || { x: 0, y: 0, z: 0 };
        const accG = event.accelerationIncludingGravity || { x: 0, y: 0, z: -9.81 };
        processMotionSample(accLin, accG);
      });
      motionListenerHandle.current = handle;
    } catch (e) {
      // 2. Repli vers le standard W3C DeviceMotionEvent
      if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
        const handleDeviceMotion = (e: DeviceMotionEvent) => {
          const rawLin = e.acceleration;
          const rawG = e.accelerationIncludingGravity;

          const accLin = {
            x: rawLin?.x ?? 0,
            y: rawLin?.y ?? 0,
            z: rawLin?.z ?? 0,
          };
          const accG = {
            x: rawG?.x ?? 0,
            y: rawG?.y ?? 0,
            z: rawG?.z ?? -9.81,
          };

          processMotionSample(accLin, accG);
        };

        window.addEventListener('devicemotion', handleDeviceMotion);
        (window as any)._vbtMotionHandler = handleDeviceMotion;
      } else {
        setSensorStatus('error');
        setPermissionError('Aucun accéléromètre détecté sur cet appareil.');
      }
    }
  };

  // Arrêter la série
  const handleStopSet = () => {
    setIsActive(false);
    setSensorStatus('ready');
    setLiveInstantVelocity(0);
    setLiveAccelZ(0);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (motionListenerHandle.current) {
      motionListenerHandle.current.remove();
      motionListenerHandle.current = null;
    }

    if (typeof window !== 'undefined' && (window as any)._vbtMotionHandler) {
      window.removeEventListener('devicemotion', (window as any)._vbtMotionHandler);
      (window as any)._vbtMotionHandler = null;
    }

    playBeep(523, 0.25);
  };

  // Nettoyage au démontage du composant
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (motionListenerHandle.current) {
        motionListenerHandle.current.remove();
      }
      if (typeof window !== 'undefined' && (window as any)._vbtMotionHandler) {
        window.removeEventListener('devicemotion', (window as any)._vbtMotionHandler);
      }
    };
  }, []);

  // Déterminer la zone de vitesse de la dernière rep
  const getVelocityZone = (v: number) => {
    if (v >= 0.75) return { label: 'Vitesse / Explosivité', color: '#00F0FF' };
    if (v >= 0.5) return { label: 'Puissance / Force-Vitesse', color: '#30D158' };
    if (v >= 0.35) return { label: 'Hypertrophie / Force', color: '#FFD60A' };
    return { label: 'Force Maximale / Proche Échec', color: '#FF453A' };
  };

  const currentZone = lastRep ? getVelocityZone(lastRep.velocity) : null;

  return (
    <div
      style={{
        background: '#0D0E16',
        borderRadius: '26px',
        border: '1.5px solid rgba(0, 240, 255, 0.32)',
        padding: '18px',
        color: '#FAF7F2',
        position: 'relative',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.65), 0 0 24px rgba(0, 240, 255, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        marginBottom: '16px',
      }}
    >
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'rgba(0, 240, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={18} color="#00F0FF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#FAF7F2' }}>
                Gpath VBT Tracker
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  color: '#00F0FF',
                  background: 'rgba(0, 240, 255, 0.15)',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  letterSpacing: '0.5px',
                }}
              >
                100% PHYSIQUE
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)' }}>
              {currentExerciseName} · {exerciseWeight} kg
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setShowInfoModal(!showInfoModal)}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(250, 247, 242, 0.7)',
              cursor: 'pointer',
            }}
            title="Aide & Positionnement"
          >
            <HelpCircle size={15} />
          </button>

          <button
            type="button"
            onClick={() => setIsAudioFeedbackEnabled(!isAudioFeedbackEnabled)}
            style={{
              background: isAudioFeedbackEnabled ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isAudioFeedbackEnabled ? '#00F0FF' : 'rgba(250, 247, 242, 0.5)',
              cursor: 'pointer',
            }}
            title="Bip sonore"
          >
            {isAudioFeedbackEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(250, 247, 242, 0.7)',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Info / Guide Sheet */}
      {showInfoModal && (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(0, 240, 255, 0.25)',
            borderRadius: '16px',
            padding: '12px',
            fontSize: '11.5px',
            lineHeight: 1.45,
            color: 'rgba(250, 247, 242, 0.85)',
          }}
        >
          <div style={{ fontWeight: 700, color: '#00F0FF', marginBottom: '4px' }}>
            📱 Positionnement du capteur physique :
          </div>
          <div>
            1. Fixe ton iPhone sur la barre (support magnétique/brassard) ou pose-le sur la pile de poids de la machine.
          </div>
          <div>
            2. Lance la série et effectue ta poussée : chaque répétition est détectée et validée <strong>automatiquement</strong> par l'accéléromètre.
          </div>
          <div>
            3. Le bip t'alerte dès que la perte de vitesse atteint <strong>{targetVelocityLoss}%</strong> pour éviter le surentraînement.
          </div>
        </div>
      )}

      {/* Permission alert for iOS */}
      {permissionError && (
        <div
          style={{
            background: 'rgba(255, 69, 58, 0.15)',
            border: '1px solid #FF453A',
            borderRadius: '12px',
            padding: '10px 12px',
            fontSize: '11px',
            color: '#FFD2CF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span>{permissionError}</span>
          <button
            type="button"
            onClick={requestMotionPermissionIfNeeded}
            style={{
              background: '#FF453A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Autoriser
          </button>
        </div>
      )}

      {/* Main Telemetry Cockpit */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '12px',
          alignItems: 'stretch',
        }}
      >
        {/* Big Velocity Display */}
        <div
          style={{
            background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(0, 240, 255, 0.05) 100%)',
            borderRadius: '20px',
            border: '1px solid rgba(0, 240, 255, 0.22)',
            padding: '16px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgba(250, 247, 242, 0.55)', fontWeight: 700 }}>
              Vitesse Propulsive (m/s)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Radio size={10} color={isActive ? '#00F0FF' : 'rgba(250, 247, 242, 0.3)'} />
              <span style={{ fontSize: '9px', color: isActive ? '#00F0FF' : 'rgba(250, 247, 242, 0.3)', fontWeight: 600 }}>
                {isActive ? 'EN DIRECT' : 'EN ATTENTE'}
              </span>
            </div>
          </div>

          <div style={{ margin: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span
                style={{
                  fontSize: '44px',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: lastRep ? (currentZone?.color || '#00F0FF') : '#FAF7F2',
                  letterSpacing: '-1.5px',
                  lineHeight: 1,
                }}
              >
                {isActive && liveInstantVelocity > 0.05
                  ? liveInstantVelocity.toFixed(2)
                  : lastRep
                  ? lastRep.velocity.toFixed(2)
                  : '0.00'}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.6)' }}>
                m/s
              </span>
            </div>

            {currentZone && lastRep && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '6px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: `${currentZone.color}22`,
                  border: `1px solid ${currentZone.color}55`,
                  fontSize: '10px',
                  fontWeight: 700,
                  color: currentZone.color,
                }}
              >
                <span>●</span>
                <span>{currentZone.label}</span>
              </div>
            )}
          </div>

          {/* Real-time Hardware Accelerometer Readout */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.45)', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '6px' }}>
            <span>Accéléromètre physique :</span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', color: liveAccelZ !== 0 ? '#00F0FF' : 'rgba(250, 247, 242, 0.45)' }}>
              {liveAccelZ >= 0 ? `+${liveAccelZ.toFixed(2)}` : liveAccelZ.toFixed(2)} m/s²
            </span>
          </div>
        </div>

        {/* Reps Counter & Velocity Loss Gauge */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Reps count box */}
          <div
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.5)', fontWeight: 600 }}>
              Répétitions validées
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: '#FAF7F2',
                }}
              >
                {reps.length}
              </span>
              <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.5)' }}>
                reps auto
              </span>
            </div>
          </div>

          {/* Velocity Loss box */}
          <div
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.5)', fontWeight: 600 }}>
                Perte de Vitesse
              </span>
              <span style={{ fontSize: '9px', color: 'rgba(250, 247, 242, 0.4)' }}>
                Seuil: {targetVelocityLoss}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
              <span
                style={{
                  fontSize: '24px',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono, monospace)',
                  color:
                    velocityLossPct >= targetVelocityLoss
                      ? '#FF453A'
                      : velocityLossPct >= targetVelocityLoss * 0.7
                      ? '#FFD60A'
                      : '#30D158',
                }}
              >
                -{velocityLossPct}%
              </span>
              {bestVelocity > 0 && (
                <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.45)' }}>
                  (Max: {bestVelocity.toFixed(2)})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Bar (Cardio Ring + Power + 1RM) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '6px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '14px',
          padding: '8px 10px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div>
          <div style={{ fontSize: '8.5px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.45)', fontWeight: 700 }}>
            Cardio Bague
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
            <Heart size={11} color="#FF2D55" fill={liveBpm > 0 ? '#FF2D55' : 'none'} />
            <span style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)' }}>
              {liveBpm > 0 ? liveBpm : '--'}
            </span>
            <span style={{ fontSize: '8px', color: 'rgba(250, 247, 242, 0.4)' }}>bpm</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '8.5px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.45)', fontWeight: 700 }}>
            Vitesse Moy.
          </div>
          <div style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', marginTop: '2px', color: '#00F0FF' }}>
            {avgVelocity > 0 ? `${avgVelocity} ` : '-- '}
            <span style={{ fontSize: '8px', fontWeight: 400, color: 'rgba(250, 247, 242, 0.5)' }}>m/s</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '8.5px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.45)', fontWeight: 700 }}>
            Puissance
          </div>
          <div style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', marginTop: '2px', color: '#FFD60A' }}>
            {avgPowerWatts > 0 ? avgPowerWatts : '--'}{' '}
            <span style={{ fontSize: '8px', fontWeight: 400, color: 'rgba(250, 247, 242, 0.5)' }}>W</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '8.5px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.45)', fontWeight: 700 }}>
            1RM Estimé
          </div>
          <div style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', marginTop: '2px', color: '#30D158' }}>
            {estimated1RM > 0 ? estimated1RM : '--'}{' '}
            <span style={{ fontSize: '8px', fontWeight: 400, color: 'rgba(250, 247, 242, 0.5)' }}>kg</span>
          </div>
        </div>
      </div>

      {/* Reps Visual Histogram */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(250, 247, 242, 0.55)', fontWeight: 700 }}>
            Historique des Répétitions (m/s)
          </span>
          <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.4)', fontFamily: 'var(--font-mono)' }}>
            Chrono: {Math.floor(elapsedSec / 60)}:{(elapsedSec % 60).toString().padStart(2, '0')}
          </span>
        </div>

        {reps.length === 0 ? (
          <div
            style={{
              height: '56px',
              borderRadius: '12px',
              border: '1px dashed rgba(255, 255, 255, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              color: 'rgba(250, 247, 242, 0.4)',
              gap: '6px',
            }}
          >
            <Smartphone size={14} />
            <span>En attente du premier mouvement de barre...</span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '6px',
              height: '64px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '12px',
              padding: '6px 8px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              overflowX: 'auto',
            }}
          >
            {reps.map((r, idx) => {
              const maxScale = Math.max(1.2, bestVelocity * 1.15);
              const heightPct = Math.min(100, Math.max(15, (r.velocity / maxScale) * 100));
              const isBest = r.velocity === bestVelocity;

              return (
                <div
                  key={r.repNumber}
                  style={{
                    flex: '0 0 28px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  <span
                    style={{
                      fontSize: '8.5px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono, monospace)',
                      color: isBest ? '#00F0FF' : 'rgba(250, 247, 242, 0.75)',
                    }}
                  >
                    {r.velocity.toFixed(2)}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      height: `${heightPct}%`,
                      borderRadius: '4px 4px 0 0',
                      background:
                        r.velocity >= 0.75
                          ? '#00F0FF'
                          : r.velocity >= 0.5
                          ? '#30D158'
                          : r.velocity >= 0.35
                          ? '#FFD60A'
                          : '#FF453A',
                      boxShadow: isBest ? '0 0 8px rgba(0, 240, 255, 0.6)' : 'none',
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

      {/* Target Velocity Loss Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.6)' }}>
          Seuil de fatigue (alerte) :
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
                padding: '4px 8px',
                fontSize: '10px',
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

      {/* Weight Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.03)', padding: '6px 10px', borderRadius: '10px' }}>
        <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.6)' }}>
          Charge sur la barre :
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setExerciseWeight((prev) => Math.max(5, prev - 2.5))}
            disabled={isActive}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '6px',
              width: '24px',
              height: '24px',
              color: '#FAF7F2',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            -
          </button>
          <span style={{ fontSize: '12.5px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
            {exerciseWeight} kg
          </span>
          <button
            type="button"
            onClick={() => setExerciseWeight((prev) => prev + 2.5)}
            disabled={isActive}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '6px',
              width: '24px',
              height: '24px',
              color: '#FAF7F2',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Action Buttons (Strictly Real Physics, ZERO RANDOM) */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
        {!isActive ? (
          <button
            type="button"
            onClick={handleStartSet}
            style={{
              flex: 1,
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #00F0FF 0%, #0080FF 100%)',
              border: 'none',
              color: '#0D0E16',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 18px rgba(0, 240, 255, 0.35)',
            }}
          >
            <Play size={16} fill="#0D0E16" />
            <span>Lancer la Série VBT</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStopSet}
            style={{
              flex: 1,
              height: '48px',
              borderRadius: '14px',
              background: '#FF453A',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 16px rgba(255, 69, 58, 0.35)',
            }}
          >
            <Square size={16} fill="#FFFFFF" />
            <span>Terminer la Série ({reps.length} reps)</span>
          </button>
        )}
      </div>

      {/* Save Button when set has reps */}
      {!isActive && reps.length > 0 && onSaveSet && (
        <button
          type="button"
          onClick={() => onSaveSet(reps.length, avgVelocity, velocityLossPct, reps)}
          style={{
            width: '100%',
            height: '42px',
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
          <Award size={15} />
          <span>Enregistrer cette série ({reps.length} reps @ {avgVelocity} m/s)</span>
        </button>
      )}
    </div>
  );
};
