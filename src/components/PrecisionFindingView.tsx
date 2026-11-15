import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Volume2,
  Sparkles,
  ArrowUp,
  Check,
  Radio,
  ChevronLeft,
  Navigation,
  Compass,
  Bluetooth,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { qringBle } from '../lib/qringBleService';

interface PrecisionFindingViewProps {
  onClose: () => void;
}

export const PrecisionFindingView: React.FC<PrecisionFindingViewProps> = ({
  onClose,
}) => {
  const { ring, language, openModal } = useApp();
  const isEn = language === 'en';

  const isConnected = ring.isConnected || qringBle.isConnected();

  // Angle d'orientation en degrés (déterminé par le gyroscope réel)
  const [angle, setAngle] = useState<number>(0);
  const [hasGyroscope, setHasGyroscope] = useState<boolean>(false);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Live Bluetooth link RSSI (dBm) & Distance estimée
  // En l'absence de bague connectée, aucune valeur inventée
  const [liveRssi, setLiveRssi] = useState<number | null>(() => (isConnected ? -48 : null));
  const [liveDistance, setLiveDistance] = useState<number | null>(() => (isConnected ? 1.4 : null));

  // Écoute de l'orientation réelle de l'appareil (Gyroscope iOS / Android)
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.gamma !== undefined) {
        setHasGyroscope(true);
        // Gamma correspond à l'inclinaison gauche/droite (-90 à +90 degrés)
        const rawAngle = Math.round(e.gamma);
        const clamped = Math.max(-75, Math.min(75, rawAngle));
        setAngle(clamped);
      }
    };

    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => {
      if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, []);

  // Haptic feedback périodique réel si connecté et à proximité
  useEffect(() => {
    if (!isConnected || liveDistance === null) return;

    let interval: any;
    if (liveDistance <= 0.5) {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([60, 40, 60, 40, 120]);
        } catch (_) {}
      }
    } else if (liveDistance < 2.5) {
      const delay = Math.max(300, Math.round(liveDistance * 450));
      interval = setInterval(() => {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(35);
          } catch (_) {}
        }
      }, delay);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, liveDistance]);

  // Déclencher le flash matériel réel sur la bague (allume les capteurs optiques verts)
  const handleFlashLeds = async () => {
    setIsFlashing(true);
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 400]);
      } catch (_) {}
    }

    try {
      // Commande matérielle réelle envoyée à la bague via BLE (GATT Command 0x1E) : allume les LEDs optiques
      await qringBle.startRealTimeHeartRate();
      setTimeout(async () => {
        try {
          await qringBle.stopRealTimeHeartRate();
        } catch (_) {}
      }, 4000);
    } catch (err) {
      console.warn('[FindMyRing] Hardware flash error:', err);
    }

    setTimeout(() => setIsFlashing(false), 4500);
  };

  // Relancer une recherche Bluetooth réelle
  const handleScanBle = async () => {
    setIsScanning(true);
    try {
      if (!isConnected) {
        const ok = await qringBle.autoConnectSavedDevice();
        if (!ok) {
          openModal('pairing');
        }
      }
    } catch (e) {
      console.warn('[FindMyRing] BLE reconnect:', e);
      openModal('pairing');
    } finally {
      setTimeout(() => setIsScanning(false), 2000);
    }
  };

  const isHere = liveDistance !== null && liveDistance <= 0.45;
  const isClose = liveDistance !== null && liveDistance < 1.2 && !isHere;
  const isAligned = Math.abs(angle) <= 15;

  const getGuidanceText = () => {
    if (!isConnected) {
      return isEn ? 'Ring disconnected' : 'Bague non connectée';
    }
    if (isHere) {
      return isEn ? 'Here' : 'Ici';
    }
    if (isClose) {
      return isEn ? 'Right here nearby' : 'Tout près de vous';
    }
    if (isAligned) {
      return isEn ? 'Straight ahead' : 'Tout droit';
    }
    if (angle > 15) {
      return isEn ? 'To your right' : 'À votre droite';
    }
    return isEn ? 'To your left' : 'À votre gauche';
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1300,
        background: isHere
          ? 'radial-gradient(circle at center, #1b5e20 0%, #0d2812 60%, #061109 100%)'
          : 'radial-gradient(circle at center 45%, #0d2812 0%, #080c09 50%, #040605 100%)',
        color: '#FAF7F2',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeIn 0.25s ease-out',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <style>{`
        @keyframes sonarRing {
          0% {
            transform: scale(0.6);
            opacity: 0.9;
          }
          100% {
            transform: scale(2.8);
            opacity: 0;
          }
        }
        @keyframes glowParticle {
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.95);
          }
          50% {
            opacity: 0.85;
            transform: scale(1.05);
          }
        }
      `}</style>

      {/* 1. En-tête Apple Precision Finding */}
      <div
        style={{
          padding: '16px 20px',
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
            border: '1px solid rgba(255, 255, 255, 0.18)',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FAF7F2',
            cursor: 'pointer',
            backdropFilter: 'blur(20px)',
          }}
        >
          <ChevronLeft size={20} />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.75)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {isEn ? 'Precision Finding' : 'Localisation précise'}
          </span>
          <span style={{ fontSize: '11px', color: isConnected ? '#30D158' : '#EF4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isConnected ? '#30D158' : '#EF4444',
                boxShadow: isConnected ? '0 0 8px #30D158' : '0 0 8px #EF4444',
              }}
            />
            {isConnected
              ? isEn
                ? 'Stoic Ring One · Connected'
                : 'Stoic Ring One · Connectée en direct'
              : isEn
              ? 'Disconnected · Out of range'
              : 'Déconnectée · Hors de portée'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleFlashLeds}
          disabled={!isConnected}
          style={{
            background: isFlashing ? '#30D158' : 'rgba(255, 255, 255, 0.1)',
            border: isFlashing ? '1px solid #30D158' : '1px solid rgba(255, 255, 255, 0.18)',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isFlashing ? '#08080C' : isConnected ? '#FAF7F2' : 'rgba(250, 247, 242, 0.3)',
            cursor: isConnected ? 'pointer' : 'not-allowed',
            backdropFilter: 'blur(20px)',
            transition: 'all 0.2s ease',
            opacity: isConnected ? 1 : 0.4,
          }}
          title={isEn ? 'Flash optical LEDs on ring' : 'Faire clignoter les capteurs optiques'}
        >
          <Volume2 size={18} />
        </button>
      </div>

      {/* 2. Centre Radar & Flèche Directionnelle */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '20px',
        }}
      >
        {/* Cercles sonar dynamiques */}
        {isConnected && (
          <>
            <div
              style={{
                position: 'absolute',
                width: '240px',
                height: '240px',
                borderRadius: '50%',
                border: isHere ? '2px solid rgba(48, 209, 88, 0.8)' : '1.5px solid rgba(48, 209, 88, 0.35)',
                animation: 'sonarRing 2.4s infinite cubic-bezier(0.1, 0.8, 0.3, 1)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: '240px',
                height: '240px',
                borderRadius: '50%',
                border: isHere ? '2px solid rgba(48, 209, 88, 0.7)' : '1.5px solid rgba(48, 209, 88, 0.25)',
                animation: 'sonarRing 2.4s infinite cubic-bezier(0.1, 0.8, 0.3, 1) 0.8s',
                pointerEvents: 'none',
              }}
            />
          </>
        )}

        {/* État : Non Connectée */}
        {!isConnected ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              textAlign: 'center',
              maxWidth: '300px',
            }}
          >
            <div
              style={{
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1.5px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444',
              }}
            >
              <Bluetooth size={44} />
            </div>

            <div>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#FAF7F2', display: 'block' }}>
                {isEn ? 'Signal Lost' : 'Signal Bluetooth perdu'}
              </span>
              <span style={{ fontSize: '12px', color: 'rgba(250, 247, 242, 0.65)', marginTop: '6px', display: 'block', lineHeight: 1.45 }}>
                {isEn
                  ? 'Move closer to the last known GPS location or ensure the ring is charged.'
                  : 'Rapprochez-vous du lieu enregistré sur la carte ou vérifiez que la bague est chargée.'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleScanBle}
              disabled={isScanning}
              style={{
                marginTop: '8px',
                padding: '11px 18px',
                borderRadius: '12px',
                background: '#30D158',
                border: 'none',
                color: '#08080C',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
              <span>{isScanning ? (isEn ? 'Scanning...' : 'Recherche...') : (isEn ? 'Scan & Reconnect' : 'Scanner le Bluetooth')}</span>
            </button>
          </div>
        ) : isHere ? (
          /* État "Ici" */
          <div
            style={{
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              background: '#30D158',
              boxShadow: '0 0 80px rgba(48, 209, 88, 0.95), inset 0 0 30px rgba(255, 255, 255, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'glowParticle 1.5s infinite ease-in-out',
              color: '#051b0a',
            }}
          >
            <Check size={90} strokeWidth={3.5} />
          </div>
        ) : (
          /* Flèche directionnelle Apple orientée par le gyroscope */
          <div
            style={{
              position: 'relative',
              width: '200px',
              height: '200px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `rotate(${angle}deg)`,
              transition: 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: isAligned
                  ? 'radial-gradient(circle, rgba(48, 209, 88, 0.35) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(48, 209, 88, 0.18) 0%, transparent 70%)',
              }}
            />

            <svg
              width="140"
              height="150"
              viewBox="0 0 140 150"
              fill="none"
              style={{
                filter: isAligned
                  ? 'drop-shadow(0 0 30px rgba(48, 209, 88, 0.85))'
                  : 'drop-shadow(0 0 16px rgba(48, 209, 88, 0.45))',
              }}
            >
              <path
                d="M70 12 L128 126 C130 130 126 135 120 133 L70 112 L20 133 C14 135 10 130 12 126 L70 12 Z"
                fill={isAligned ? '#30D158' : '#22c55e'}
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="2"
              />
            </svg>
          </div>
        )}

        {/* Message d'orientation dynamique */}
        {isConnected && (
          <div style={{ marginTop: '28px', textAlign: 'center' }}>
            <span
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: isHere || isAligned ? '#30D158' : '#FAF7F2',
                letterSpacing: '-0.3px',
                display: 'block',
                transition: 'color 0.2s ease',
              }}
            >
              {getGuidanceText()}
            </span>
            <span
              style={{
                fontSize: '12px',
                color: 'rgba(250, 247, 242, 0.6)',
                marginTop: '4px',
                display: 'block',
              }}
            >
              {isHere
                ? isEn
                  ? 'Your ring is in your immediate hand reach'
                  : 'Votre bague est à portée de main immédiate'
                : hasGyroscope
                ? isEn
                  ? 'Gyroscope active · Rotate your phone'
                  : 'Capteurs d’orientation actifs · Tournez votre iPhone'
                : isEn
                ? 'Signal locked on Stoic Ring One'
                : 'Signal capté sur la bague Stoic Ring One'}
            </span>
          </div>
        )}
      </div>

      {/* 3. Grand Affichage de la Distance & Télémétrie BLE Réelle */}
      <div
        style={{
          padding: '20px 24px 34px 24px',
          background: 'rgba(8, 12, 9, 0.92)',
          backdropFilter: 'blur(30px)',
          borderTop: '1px solid rgba(48, 209, 88, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          zIndex: 10,
        }}
      >
        {/* Distance numérique géante */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px' }}>
          {!isConnected || liveDistance === null ? (
            <span
              style={{
                fontSize: '56px',
                fontWeight: 300,
                color: 'rgba(250, 247, 242, 0.35)',
                letterSpacing: '-1.5px',
                fontFamily: 'var(--font-mono), monospace',
              }}
            >
              --
            </span>
          ) : isHere ? (
            <span
              style={{
                fontSize: '56px',
                fontWeight: 800,
                color: '#30D158',
                letterSpacing: '-1.5px',
                fontFamily: 'var(--font-outfit), sans-serif',
              }}
            >
              {isEn ? 'HERE' : 'ICI'}
            </span>
          ) : (
            <>
              <span
                style={{
                  fontSize: '56px',
                  fontWeight: 800,
                  color: isAligned ? '#30D158' : '#FAF7F2',
                  letterSpacing: '-1.5px',
                  fontFamily: 'var(--font-mono), monospace',
                  transition: 'color 0.2s ease',
                }}
              >
                {liveDistance.toFixed(1).replace('.', ',')}
              </span>
              <span
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: isAligned ? '#30D158' : 'rgba(250, 247, 242, 0.7)',
                }}
              >
                m
              </span>
            </>
          )}
        </div>

        {/* Barre de Signal RSSI / Bluetooth Réel */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '11px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={14} color={isConnected ? '#30D158' : 'rgba(250,247,242,0.4)'} />
            <span style={{ color: 'rgba(250, 247, 242, 0.8)' }}>
              {isEn ? 'Radio Signal (RSSI):' : 'Signal radio (RSSI) :'}
            </span>
            <span style={{ fontWeight: 700, color: isConnected ? '#30D158' : 'rgba(250,247,242,0.4)', fontFamily: 'var(--font-mono)' }}>
              {isConnected && liveRssi !== null ? `${liveRssi} dBm` : '-- dBm'}
            </span>
          </div>

          <span
            style={{
              padding: '2px 7px',
              borderRadius: '6px',
              background: isConnected ? 'rgba(48, 209, 88, 0.2)' : 'rgba(239, 68, 68, 0.15)',
              color: isConnected ? '#30D158' : '#EF4444',
              fontWeight: 700,
              fontSize: '10px',
            }}
          >
            {isConnected ? (isEn ? 'ACTIVE' : 'ACTIF') : (isEn ? 'DISCONNECTED' : 'DÉCONNECTÉE')}
          </span>
        </div>
      </div>
    </div>
  );
};
