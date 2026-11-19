import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ArrowUp,
  ArrowDown,
  Move,
  Check,
  Radio,
  ChevronLeft,
  Bluetooth,
  RefreshCw,
  Volume2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { qringBle, BleRssiSample } from '../lib/qringBleService';

interface PrecisionFindingViewProps {
  onClose: () => void;
}

type ProximityZone = 'searching' | 'cold' | 'warm' | 'hot' | 'here';
type MovementTrend = 'calibrating' | 'closer' | 'further' | 'steady';

interface RssiPoint {
  rssi: number;
  ts: number;
}

function estimateMetersFromRssi(rssi: number): number {
  // Petite antenne bague titane : RSSI de référence @ 1m ≈ -62 dBm, exposant intérieur n ≈ 2.2
  const raw = Math.pow(10, (-62 - rssi) / (10 * 2.2));
  const clamped = Math.max(0.1, Math.min(15.0, raw));
  return Math.round(clamped * 10) / 10;
}

function getZoneFromRssi(rssi: number | null): ProximityZone {
  if (rssi === null) return 'searching';
  if (rssi >= -56) return 'here';
  if (rssi >= -66) return 'hot';
  if (rssi >= -77) return 'warm';
  return 'cold';
}

export const PrecisionFindingView: React.FC<PrecisionFindingViewProps> = ({
  onClose,
}) => {
  const { ring, language, openModal } = useApp();
  const isEn = language === 'en';

  const [isConnected, setIsConnected] = useState<boolean>(
    ring.isConnected || qringBle.isConnected()
  );
  const [liveRssi, setLiveRssi] = useState<number | null>(null);
  const [liveDistance, setLiveDistance] = useState<number | null>(null);
  const [signalSource, setSignalSource] = useState<'connected' | 'scan' | null>(null);
  const [lastSampleTs, setLastSampleTs] = useState<number>(0);
  const [trend, setTrend] = useState<MovementTrend>('calibrating');
  const [isStale, setIsStale] = useState<boolean>(false);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);

  const emaRef = useRef<number | null>(null);
  const historyRef = useRef<RssiPoint[]>([]);
  const lastFlashNoteTimerRef = useRef<any>(null);

  // Suivre l'état de connexion BLE en direct
  useEffect(() => {
    const unsub = qringBle.subscribe((data) => {
      setIsConnected(data.isConnected);
    });
    return () => {
      unsub();
    };
  }, []);

  // Radar RSSI CoreBluetooth / BLE réel en temps réel
  useEffect(() => {
    let cleanupFn: (() => void) | null = null;
    let mounted = true;

    const handleReading = (sample: BleRssiSample) => {
      if (!mounted) return;
      const now = sample.ts || Date.now();

      // Filtre asymétrique rapide à la hausse (attaque instantanée dès qu'on s'approche, lissage doux aux baisses RF)
      const prev = emaRef.current;
      let nextEma: number;
      if (prev === null) {
        nextEma = sample.rssi;
      } else if (sample.rssi >= prev) {
        const gain = sample.rssi - prev >= 8 ? 0.85 : 0.72;
        nextEma = prev * (1 - gain) + sample.rssi * gain;
      } else {
        nextEma = prev * 0.68 + sample.rssi * 0.32;
      }
      emaRef.current = nextEma;

      const roundedRssi = Math.round(nextEma);
      setLiveRssi(roundedRssi);
      setLiveDistance(estimateMetersFromRssi(nextEma));
      setSignalSource(sample.source);
      setLastSampleTs(now);
      setIsStale(false);

      // Fenêtre glissante réactive (6s) pour indiquer immédiatement rapprochement / éloignement
      const buf = historyRef.current.filter((p) => now - p.ts <= 6000);
      buf.push({ rssi: sample.rssi, ts: now });
      historyRef.current = buf;

      const recent = buf.filter((p) => now - p.ts <= 1400);
      const older = buf.filter((p) => now - p.ts > 1400 && now - p.ts <= 4500);

      if (recent.length >= 2 && older.length >= 2) {
        const recentAvg = recent.reduce((s, p) => s + p.rssi, 0) / recent.length;
        const olderAvg = older.reduce((s, p) => s + p.rssi, 0) / older.length;
        const delta = recentAvg - olderAvg;
        if (delta >= 2.0) {
          setTrend('closer');
        } else if (delta <= -2.0) {
          setTrend('further');
        } else {
          setTrend('steady');
        }
      } else if (buf.length >= 2) {
        setTrend('steady');
      }
    };

    qringBle.startRssiRadar(handleReading).then((stop) => {
      if (!mounted) {
        stop();
      } else {
        cleanupFn = stop;
      }
    });

    return () => {
      mounted = false;
      if (cleanupFn) cleanupFn();
      qringBle.stopRssiRadar();
    };
  }, [isConnected]);

  // Vérification fraîcheur du signal
  useEffect(() => {
    if (lastSampleTs === 0) return;
    const t = setInterval(() => {
      setIsStale(Date.now() - lastSampleTs > 4500);
    }, 1000);
    return () => clearInterval(t);
  }, [lastSampleTs]);

  const zone = getZoneFromRssi(liveRssi);
  const isHere = zone === 'here';

  // Retour haptique proportionnel au RSSI réel (Style Apple AirPods Chaud / Froid)
  useEffect(() => {
    if (zone === 'searching' || zone === 'cold' || isStale) return;

    let intervalMs = 950;
    let pulsePattern: number | number[] = 28;

    if (zone === 'here') {
      intervalMs = 340;
      pulsePattern = [45, 35, 70];
    } else if (zone === 'hot') {
      intervalMs = 560;
      pulsePattern = 40;
    }

    const triggerPulse = () => {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(pulsePattern);
        } catch (_) {}
      }
    };

    // Impulsion immédiate dès le passage dans la zone (surtout "ICI")
    triggerPulse();
    const timer = setInterval(triggerPulse, intervalMs);

    return () => clearInterval(timer);
  }, [zone, isStale]);

  // Flash matériel réel des LEDs optiques vertes + rouges sur la bague
  const handleFlashLeds = async () => {
    if (!qringBle.isConnected()) return;
    setIsFlashing(true);
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([120, 80, 120]);
      } catch (_) {}
    }

    await qringBle.flashRingBeacon(6000);
    if (lastFlashNoteTimerRef.current) clearTimeout(lastFlashNoteTimerRef.current);
    lastFlashNoteTimerRef.current = setTimeout(() => {
      setIsFlashing(false);
    }, 6000);
  };

  useEffect(() => {
    return () => {
      if (lastFlashNoteTimerRef.current) clearTimeout(lastFlashNoteTimerRef.current);
    };
  }, []);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    const savedId = qringBle.getSavedDeviceId();
    const savedName = qringBle.getSavedDeviceName() || 'Aurel Ring One';
    let ok = false;
    if (savedId) {
      const res = await qringBle.connectDirectly(savedId, savedName, true);
      ok = res.success;
    } else {
      ok = await qringBle.autoConnectSavedDevice();
    }
    setIsReconnecting(false);
    if (!ok) {
      openModal('pairing');
    }
  };

  // Palette dynamique Chaud / Froid
  const zoneVisual = (() => {
    switch (zone) {
      case 'here':
        return {
          accent: '#30D158',
          bgGlow: 'radial-gradient(circle at 50% 42%, rgba(48, 209, 88, 0.34) 0%, #05160A 60%, #060609 100%)',
          label: isEn ? 'Right Here · Brûlant' : 'Brûlant · Tout près',
          hint: isEn
            ? 'Your ring is within arm’s reach'
            : 'Votre bague est à portée de main immédiate',
          orbScale: 1.0,
          pulseSpeed: '1.1s',
        };
      case 'hot':
        return {
          accent: '#A3E635',
          bgGlow: 'radial-gradient(circle at 50% 42%, rgba(163, 230, 53, 0.24) 0%, #0B1408 60%, #060609 100%)',
          label: isEn ? 'Warm · Very close' : 'Chaud · À proximité',
          hint: isEn
            ? 'Check pockets, cushions or desk surface'
            : 'Regardez autour de vous, bureau, poches ou coussins',
          orbScale: 0.84,
          pulseSpeed: '1.5s',
        };
      case 'warm':
        return {
          accent: '#F59E0B',
          bgGlow: 'radial-gradient(circle at 50% 42%, rgba(245, 158, 11, 0.2) 0%, #160F06 60%, #060609 100%)',
          label: isEn ? 'Lukewarm · Same room' : 'Tiède · Dans la pièce',
          hint: isEn
            ? 'Walk a few steps to see signal rise or drop'
            : 'Faites 2 à 3 pas pour voir si le signal augmente',
          orbScale: 0.68,
          pulseSpeed: '2.0s',
        };
      case 'cold':
        return {
          accent: '#60A5FA',
          bgGlow: 'radial-gradient(circle at 50% 42%, rgba(96, 165, 250, 0.16) 0%, #080E18 60%, #060609 100%)',
          label: isEn ? 'Cold · Weak signal' : 'Froid · Signal lointain',
          hint: isEn
            ? 'Move between rooms while keeping screen awake'
            : 'Déplacez-vous dans la pièce en gardant l’écran actif',
          orbScale: 0.54,
          pulseSpeed: '2.6s',
        };
      default:
        return {
          accent: '#94A3B8',
          bgGlow: 'radial-gradient(circle at 50% 42%, rgba(148, 163, 184, 0.12) 0%, #0A0B0F 60%, #060609 100%)',
          label: isEn ? 'Searching BLE signal...' : 'Recherche du signal Bluetooth...',
          hint: isEn
            ? 'Walk slowly around the last GPS location'
            : 'Déplacez-vous autour de la dernière position connue',
          orbScale: 0.48,
          pulseSpeed: '2.8s',
        };
    }
  })();

  const signalBarPercent =
    liveRssi !== null
      ? Math.max(8, Math.min(100, Math.round(((liveRssi + 95) / 55) * 100)))
      : 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        background: zoneVisual.bgGlow,
        transition: 'background 0.45s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        touchAction: 'none',
        animation: 'fadeIn 0.25s ease',
      }}
    >
      <style>{`
        @keyframes precisionSonarWave {
          0% {
            transform: scale(0.55);
            opacity: 0.72;
          }
          100% {
            transform: scale(2.15);
            opacity: 0;
          }
        }
      `}</style>

      {/* 1. En-tête Apple Precision Finding */}
      <div
        style={{
          padding: 'max(14px, env(safe-area-inset-top)) 20px 12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '999px',
            padding: '7px 14px 7px 10px',
            color: '#FAF7F2',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={16} />
          <span>{isEn ? 'Map' : 'Carte'}</span>
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#FAF7F2', letterSpacing: '0.4px' }}>
            {isEn ? 'PRECISION FINDING' : 'RADAR PROXIMITÉ'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
            <Radio size={11} color={liveRssi !== null && !isStale ? zoneVisual.accent : '#94A3B8'} />
            <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.65)' }}>
              {liveRssi !== null
                ? isStale
                  ? (isEn ? 'Signal paused...' : 'En attente de paquet...')
                  : signalSource === 'connected'
                  ? (isEn ? 'Direct BLE RSSI' : 'Liaison BLE directe')
                  : (isEn ? 'Live BLE Beacon' : 'Balise BLE détectée')
                : isConnected
                ? (isEn ? 'Reading BLE link...' : 'Mesure du signal BLE...')
                : (isEn ? 'Scanning nearby BLE...' : 'Scan Bluetooth actif')}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFlashLeds}
          disabled={!isConnected}
          title={isEn ? 'Flash Ring LEDs' : 'Faire clignoter les LEDs'}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: isFlashing ? '#30D158' : 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: isFlashing ? '1px solid #30D158' : '1px solid rgba(255, 255, 255, 0.18)',
            color: isFlashing ? '#08080C' : '#FAF7F2',
            opacity: isConnected ? 1 : 0.35,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isConnected ? 'pointer' : 'not-allowed',
          }}
        >
          <Sparkles size={16} />
        </button>
      </div>

      {/* 2. Radar Sonar Central Chaud / Froid + Tendance de Déplacement */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '230px',
            height: '230px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Ondes Sonar animées selon proximité */}
          <div
            style={{
              position: 'absolute',
              inset: '10px',
              borderRadius: '50%',
              border: `1.5px solid ${zoneVisual.accent}`,
              opacity: liveRssi !== null ? 0.55 : 0.25,
              animation: `precisionSonarWave ${zoneVisual.pulseSpeed} infinite ease-out`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: '10px',
              borderRadius: '50%',
              border: `1.5px solid ${zoneVisual.accent}`,
              opacity: liveRssi !== null ? 0.45 : 0.2,
              animation: `precisionSonarWave ${zoneVisual.pulseSpeed} infinite ease-out`,
              animationDelay: '0.65s',
            }}
          />

          {/* Cadre de cible fixe */}
          <div
            style={{
              position: 'absolute',
              inset: '22px',
              borderRadius: '50%',
              border: '1px dashed rgba(255, 255, 255, 0.14)',
            }}
          />

          {/* Orbe dynamique proportionnelle au RSSI (Style AirPods) */}
          <div
            style={{
              width: '132px',
              height: '132px',
              borderRadius: '50%',
              transform: `scale(${zoneVisual.orbScale})`,
              transition: 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s ease, background 0.18s ease',
              background:
                liveRssi !== null
                  ? `radial-gradient(circle, ${zoneVisual.accent}55 0%, ${zoneVisual.accent}1A 70%, transparent 100%)`
                  : 'rgba(255, 255, 255, 0.05)',
              border: `2px solid ${zoneVisual.accent}`,
              boxShadow:
                liveRssi !== null
                  ? `0 0 36px ${zoneVisual.accent}55, inset 0 0 24px ${zoneVisual.accent}33`
                  : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isHere ? (
              <div
                style={{
                  width: '62px',
                  height: '62px',
                  borderRadius: '50%',
                  background: '#30D158',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 26px rgba(48, 209, 88, 0.85)',
                }}
              >
                <Check size={32} color="#08080C" strokeWidth={3} />
              </div>
            ) : (
              <Bluetooth size={38} color={zoneVisual.accent} strokeWidth={2.2} />
            )}
          </div>
        </div>

        {/* Pilule de Direction / Tendance réelle (en marchant) */}
        <div style={{ marginTop: '14px', textAlign: 'center', maxWidth: '320px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 14px',
              borderRadius: '999px',
              marginBottom: '10px',
              background:
                trend === 'closer'
                  ? 'rgba(48, 209, 88, 0.16)'
                  : trend === 'further'
                  ? 'rgba(245, 158, 11, 0.16)'
                  : 'rgba(255, 255, 255, 0.08)',
              border:
                trend === 'closer'
                  ? '1px solid rgba(48, 209, 88, 0.45)'
                  : trend === 'further'
                  ? '1px solid rgba(245, 158, 11, 0.45)'
                  : '1px solid rgba(255, 255, 255, 0.14)',
              color:
                trend === 'closer'
                  ? '#30D158'
                  : trend === 'further'
                  ? '#FBBF24'
                  : 'rgba(250, 247, 242, 0.8)',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            {trend === 'closer' ? (
              <>
                <ArrowUp size={15} strokeWidth={2.8} />
                <span>{isEn ? 'Getting warmer · Keep going' : 'Vous vous rapprochez · Continuez'}</span>
              </>
            ) : trend === 'further' ? (
              <>
                <ArrowDown size={15} strokeWidth={2.8} />
                <span>{isEn ? 'Getting colder · Turn back' : 'Vous vous éloignez · Demi-tour'}</span>
              </>
            ) : (
              <>
                <Move size={14} />
                <span>
                  {liveRssi === null
                    ? (isEn ? 'Waiting for BLE packets' : 'Écoute des paquets BLE')
                    : (isEn ? 'Walk 2–3 steps to sense direction' : 'Marchez 2–3 pas pour orienter')}
                </span>
              </>
            )}
          </div>

          <div
            style={{
              fontSize: '21px',
              fontWeight: 700,
              color: isHere ? '#30D158' : '#FAF7F2',
              letterSpacing: '-0.4px',
            }}
          >
            {zoneVisual.label}
          </div>
          <div
            style={{
              fontSize: '12.5px',
              color: 'rgba(250, 247, 242, 0.62)',
              marginTop: '4px',
              lineHeight: 1.4,
            }}
          >
            {zoneVisual.hint}
          </div>
        </div>
      </div>

      {/* 3. Télémétrie Distance + Signal RSSI + Actions */}
      <div
        style={{
          padding: '16px 22px max(26px, env(safe-area-inset-bottom)) 22px',
          background: 'rgba(8, 10, 12, 0.9)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          borderTop: `1px solid ${zoneVisual.accent}40`,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          zIndex: 10,
        }}
      >
        {/* Distance estimée */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px' }}>
          {liveDistance === null ? (
            <span
              style={{
                fontSize: '46px',
                fontWeight: 300,
                color: 'rgba(250, 247, 242, 0.35)',
                letterSpacing: '-1.2px',
                fontFamily: 'var(--font-mono), monospace',
              }}
            >
              --
            </span>
          ) : isHere ? (
            <span
              style={{
                fontSize: '48px',
                fontWeight: 800,
                color: '#30D158',
                letterSpacing: '-1.5px',
              }}
            >
              {isEn ? 'HERE' : 'ICI'}
            </span>
          ) : (
            <>
              <span style={{ fontSize: '20px', color: 'rgba(250,247,242,0.45)', fontWeight: 600 }}>~</span>
              <span
                style={{
                  fontSize: '48px',
                  fontWeight: 800,
                  color: zoneVisual.accent,
                  letterSpacing: '-1.5px',
                  fontFamily: 'var(--font-mono), monospace',
                }}
              >
                {liveDistance.toFixed(1).replace('.', ',')}
              </span>
              <span style={{ fontSize: '22px', fontWeight: 700, color: 'rgba(250, 247, 242, 0.72)' }}>m</span>
            </>
          )}
        </div>

        {/* Barre RSSI temps réel */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={14} color={zoneVisual.accent} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#FAF7F2' }}>
              {isEn ? 'Signal (BLE RSSI)' : 'Signal (RSSI BLE)'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '56px',
                  height: '6px',
                  borderRadius: '999px',
                  background: 'rgba(255, 255, 255, 0.12)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${signalBarPercent}%`,
                    height: '100%',
                    background: zoneVisual.accent,
                    borderRadius: '999px',
                    transition: 'width 0.15s ease, background 0.15s ease',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: zoneVisual.accent,
                  fontFamily: 'var(--font-mono)',
                  minWidth: '58px',
                  textAlign: 'right',
                }}
              >
                {liveRssi !== null ? `${liveRssi} dBm` : '-- dBm'}
              </span>
            </div>
          </div>
        </div>

        {/* Bouton principal contextuel : Faire clignoter si connecté, sinon Reconnecter */}
        {isConnected ? (
          <button
            type="button"
            onClick={handleFlashLeds}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '16px',
              background: isFlashing ? '#30D158' : 'rgba(255, 255, 255, 0.1)',
              border: isFlashing ? '1px solid #30D158' : '1px solid rgba(255, 255, 255, 0.2)',
              color: isFlashing ? '#08080C' : '#FAF7F2',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
            }}
          >
            <Volume2 size={17} />
            <span>
              {isFlashing
                ? isEn
                  ? 'Flashing Optical LEDs (6s)...'
                  : 'Clignotement des LEDs optiques (6s)...'
                : isEn
                ? 'Flash Ring Optical LEDs'
                : 'Faire clignoter les LEDs de la bague'}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleReconnect}
            disabled={isReconnecting}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '16px',
              background: liveRssi !== null ? '#30D158' : 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: liveRssi !== null ? '#08080C' : '#FAF7F2',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: isReconnecting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <RefreshCw size={16} />
            <span>
              {isReconnecting
                ? isEn
                  ? 'Connecting...'
                  : 'Connexion...'
                : isEn
                ? 'Connect to Flash LEDs'
                : 'Reconnecter pour faire clignoter'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
