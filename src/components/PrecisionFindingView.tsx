import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Volume2,
  Sparkles,
  ArrowUp,
  Check,
  Radio,
  Sliders,
  ChevronLeft,
  Navigation,
  Compass,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface PrecisionFindingViewProps {
  onClose: () => void;
  initialDistance?: number; // en mètres
}

export const PrecisionFindingView: React.FC<PrecisionFindingViewProps> = ({
  onClose,
  initialDistance = 2.4,
}) => {
  const { ring, language } = useApp();
  const isEn = language === 'en';

  const [distance, setDistance] = useState<number>(initialDistance);
  const [angle, setAngle] = useState<number>(12); // -90 (gauche) à +90 (droite), 0 = tout droit
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [hasGyroscope, setHasGyroscope] = useState<boolean>(false);

  // RSSI calculé dynamiquement à partir de la distance en mètres
  // Modèle Log-Distance : RSSI = -40 - 10 * n * log10(d)
  const rssi = Math.round(-38 - 18 * Math.log10(Math.max(0.2, distance)));

  // Haptic feedback périodique qui s'accélère à l'approche
  useEffect(() => {
    let interval: any;
    if (distance <= 0.5) {
      // "Ici" : vibration continue et vive
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([60, 40, 60, 40, 120]);
        } catch (_) {}
      }
    } else if (distance < 2.5) {
      // Plus on est proche, plus les pulsations haptiques sont rapprochées
      const delay = Math.max(250, Math.round(distance * 400));
      interval = setInterval(() => {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(30);
          } catch (_) {}
        }
      }, delay);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [distance]);

  // Support du Gyroscope iOS / Android si disponible
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null && e.gamma !== null) {
        setHasGyroscope(true);
        // Utiliser gamma/alpha pour simuler le pointage vers un cap fixe
        const rawAngle = (e.gamma || 0) * 1.5;
        const clamped = Math.max(-80, Math.min(80, rawAngle));
        setAngle(Math.round(clamped));
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

  const handleFlashLeds = () => {
    setIsFlashing(true);
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 400]);
      } catch (_) {}
    }
    setTimeout(() => setIsFlashing(false), 4000);
  };

  const isHere = distance <= 0.45;
  const isClose = distance < 1.2 && !isHere;
  const isAligned = Math.abs(angle) <= 18;

  // Texte d'orientation Apple
  const getGuidanceText = () => {
    if (isSearching) {
      return isEn ? 'Searching signal...' : 'Recherche du signal...';
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
    if (angle > 18) {
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
        @keyframes floatPulse {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
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
          <span style={{ fontSize: '11px', color: '#30D158', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#30D158', boxShadow: '0 0 8px #30D158' }} />
            {isEn ? 'Stoic Ring One · BLE Channel Sounding' : 'Stoic Ring One · Bluetooth BLE'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleFlashLeds}
          style={{
            background: isFlashing ? '#30D158' : 'rgba(255, 255, 255, 0.1)',
            border: isFlashing ? '1px solid #30D158' : '1px solid rgba(255, 255, 255, 0.18)',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isFlashing ? '#08080C' : '#FAF7F2',
            cursor: 'pointer',
            backdropFilter: 'blur(20px)',
            transition: 'all 0.2s ease',
          }}
          title={isEn ? 'Flash ring LED' : 'Faire clignoter la bague'}
        >
          <Volume2 size={18} />
        </button>
      </div>

      {/* 2. Centre Radar & Flèche Directionnelle Apple */}
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
        {/* Cercles d'ondes sonar dynamiques */}
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

        {/* Flèche ou Cercle "Ici" */}
        {isHere ? (
          // État "Ici" : cercle vert géant lumineux avec coche
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
          // Flèche directionnelle Apple orientée par l'angle
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
            {/* Halo lumineux d'orientation */}
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

            {/* Grande flèche stylisée Apple Find My */}
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
              : 'Signal calé sur la bague Stoic Ring One'}
          </span>
        </div>
      </div>

      {/* 3. Grand Affichage de la Distance & Télémétrie en direct */}
      <div
        style={{
          padding: '20px 24px 34px 24px',
          background: 'rgba(8, 12, 9, 0.85)',
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
          {isHere ? (
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
                {distance.toFixed(1).replace('.', ',')}
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

        {/* Barre de Signal RSSI / Bluetooth HADM */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '11px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={14} color="#30D158" />
            <span style={{ color: 'rgba(250, 247, 242, 0.8)' }}>
              {isEn ? 'Signal Strength (RSSI):' : 'Puissance du signal (RSSI) :'}
            </span>
            <span style={{ fontWeight: 700, color: '#30D158', fontFamily: 'var(--font-mono)' }}>
              {rssi} dBm
            </span>
          </div>

          <span
            style={{
              padding: '2px 7px',
              borderRadius: '6px',
              background: rssi > -50 ? 'rgba(48, 209, 88, 0.2)' : 'rgba(250, 247, 242, 0.1)',
              color: rssi > -50 ? '#30D158' : 'rgba(250, 247, 242, 0.8)',
              fontWeight: 600,
              fontSize: '10px',
            }}
          >
            {rssi > -45 ? (isEn ? 'EXCELLENT' : 'EXCELLENT') : rssi > -65 ? (isEn ? 'GOOD' : 'BON') : (isEn ? 'MODERATE' : 'MOYEN')}
          </span>
        </div>

        {/* Simulateur interactif de distance et angle (pour tester en direct à l'écran) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '14px',
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.65)' }}>
              {isEn ? 'Interactive Distance Simulation:' : 'Simulation interactive de rapprochement :'}
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#30D158' }}>
              {distance <= 0.4 ? (isEn ? 'Found!' : 'Trouvée !') : `${distance.toFixed(1)} m`}
            </span>
          </div>

          <input
            type="range"
            min="0.3"
            max="6.0"
            step="0.1"
            value={distance}
            onChange={(e) => setDistance(parseFloat(e.target.value))}
            style={{
              accentColor: '#30D158',
              cursor: 'pointer',
              width: '100%',
            }}
          />

          <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
            <button
              type="button"
              onClick={() => {
                setDistance(4.8);
                setAngle(45);
              }}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#FAF7F2',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              4,8 m (Loin)
            </button>
            <button
              type="button"
              onClick={() => {
                setDistance(1.8);
                setAngle(0);
              }}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#FAF7F2',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              1,8 m (Face)
            </button>
            <button
              type="button"
              onClick={() => {
                setDistance(0.3);
                setAngle(0);
              }}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: '8px',
                background: 'rgba(48, 209, 88, 0.2)',
                border: '1px solid rgba(48, 209, 88, 0.4)',
                color: '#30D158',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              0,3 m (Ici !)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
