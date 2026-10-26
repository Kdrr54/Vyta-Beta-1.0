import React, { useState, useEffect } from 'react';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { useApp } from '../context/AppContext';
import { qringBle } from '../lib/qringBleService';
import { finishes } from '../data/health';
import {
  Bluetooth,
  ChevronLeft,
  X,
  BadgeCheck,
  Battery,
  ShieldCheck,
  Zap,
  Wifi,
} from 'lucide-react';

interface PairingModalProps {
  onClose: () => void;
}

type PairingStep = 'welcome' | 'searching' | 'found' | 'connecting' | 'success';

export const PairingModal: React.FC<PairingModalProps> = ({ onClose }) => {
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const { updateRing, ring, finish } = useApp();
  const currentFinish = finishes.find((f) => f.id === finish) || finishes[1];
  const [step, setStep] = useState<PairingStep>('welcome');
  const [showTroubleSheet, setShowTroubleSheet] = useState<boolean>(false);
  const [connectionProgress, setConnectionProgress] = useState<number>(0);

  // Auto-transition from 'searching' to 'found' after 3.2s
  useEffect(() => {
    if (step === 'searching' && !showTroubleSheet) {
      const timer = setTimeout(() => {
        setStep('found');
      }, 3200);
      return () => clearTimeout(timer);
    }
  }, [step, showTroubleSheet]);

  // Connection sequence when user clicks "Connect"
  useEffect(() => {
    if (step === 'connecting') {
      setConnectionProgress(25);

      // Trigger Web Bluetooth request if supported
      if (qringBle.isSupported()) {
        qringBle.requestAndConnect().then((res) => {
          if (res.success && res.battery !== undefined) {
            updateRing({
              batteryRing: res.battery,
              ringSize: ring.ringSize || 8,
            });
          }
        }).catch((e) => console.log('[BLE] Connection flow note:', e));
      }

      // Subscribe to live BLE ring telemetry
      const unsubscribe = qringBle.subscribe((data) => {
        if (data.batteryPct !== undefined) {
          updateRing({ batteryRing: data.batteryPct });
        }
      });

      const t1 = setTimeout(() => setConnectionProgress(68), 550);
      const t2 = setTimeout(() => setConnectionProgress(100), 1100);
      const t3 = setTimeout(() => {
        updateRing({
          batteryRing: ring.batteryRing || 96,
          ringSize: ring.ringSize || 8,
        });
        setStep('success');
      }, 1450);

      return () => {
        unsubscribe();
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [step, ring.ringSize, ring.batteryRing, updateRing]);

  return (
    <div
      className={`pairing-overlay-container ${isClosing ? "is-closing" : ""}`}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#050807',
        backgroundImage:
          step === 'welcome'
            ? 'radial-gradient(circle at 50% 42%, #123320 0%, #0A1D12 42%, #060C09 74%, #040706 100%)'
            : step === 'searching'
            ? 'radial-gradient(circle at 50% 54%, #102B1B 0%, #091810 44%, #060B09 76%, #040706 100%)'
            : 'radial-gradient(circle at 50% 48%, #0E2319 0%, #08140F 46%, #060A08 78%, #040706 100%)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#FFFFFF',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', sans-serif",
        userSelect: 'none',
      }}
    >
      {/* Clean iOS Status Bar (9:41 + Signal + Wifi + Battery, matching mockup) */}
      <div
        style={{
          height: '44px',
          padding: '0 26px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '14px',
          fontWeight: 600,
          color: '#FFFFFF',
          flexShrink: 0,
          zIndex: 70,
        }}
      >
        <span style={{ letterSpacing: '-0.2px' }}>9:41</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="10" viewBox="0 0 17 11" fill="none">
            <rect x="0" y="7.5" width="2.8" height="3.5" rx="0.6" fill="#FFFFFF" />
            <rect x="4.5" y="5.2" width="2.8" height="5.8" rx="0.6" fill="#FFFFFF" />
            <rect x="9" y="2.8" width="2.8" height="8.2" rx="0.6" fill="#FFFFFF" />
            <rect x="13.5" y="0" width="2.8" height="11" rx="0.6" fill="rgba(255,255,255,0.35)" />
          </svg>
          <Wifi size={14} strokeWidth={2.4} />
          <div
            style={{
              width: '22px',
              height: '11px',
              borderRadius: '3px',
              border: '1px solid rgba(255,255,255,0.45)',
              padding: '1.5px',
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                background: '#FFFFFF',
                borderRadius: '1.5px',
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: '-3px',
                width: '1.5px',
                height: '4px',
                background: 'rgba(255,255,255,0.45)',
                borderRadius: '0 1px 1px 0',
              }}
            />
          </div>
        </div>
      </div>

      {/* Discreet step switcher dots + close button */}
      <div
        style={{
          position: 'absolute',
          top: '48px',
          right: '20px',
          zIndex: 70,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '999px',
            padding: '3px 6px',
          }}
          title="Basculer entre les 3 écrans"
        >
          {(['welcome', 'searching', 'found'] as const).map((s, idx) => {
            const active = step === s || (step === 'connecting' && s === 'found');
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStep(s)}
                style={{
                  width: active ? '14px' : '5px',
                  height: '5px',
                  borderRadius: '999px',
                  border: 'none',
                  padding: 0,
                  background: active ? '#4ADE80' : 'rgba(255, 255, 255, 0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                }}
                title={`Écran ${idx + 1}`}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleClose}
          aria-label="Fermer"
          title="Fermer l'appairage"
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={11} />
        </button>
      </div>

      {/* ========================================================
          SCREEN 1: WELCOME — "Let's begin by pairing your Smart Ring"
          ======================================================== */}
      {step === 'welcome' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '85px 28px 58px 28px',
            animation: 'fadeIn 0.35s ease',
          }}
        >
          {/* Center Front Ring with precisely mapped Glowing Green PPG Sensors */}
          <div
            style={{
              position: 'relative',
              width: '232px',
              height: '232px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '10px',
            }}
          >
            {/* Ambient emerald glow behind the ring */}
            <div
              style={{
                position: 'absolute',
                width: '220px',
                height: '220px',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle at 50% 60%, rgba(34, 197, 94, 0.35) 0%, rgba(16, 185, 129, 0.14) 50%, transparent 72%)',
                filter: 'blur(16px)',
                animation: 'ringPulseGlow 3.2s ease-in-out infinite',
              }}
            />

            {/* Exact inner hole illumination (17.6% to 84.6% of ring-front.png) */}
            <div
              style={{
                position: 'absolute',
                left: '17.6%',
                top: '17.8%',
                width: '67%',
                height: '65.5%',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle at 50% 78%, rgba(74, 222, 128, 0.52) 0%, rgba(34, 197, 94, 0.24) 44%, #060E0A 80%)',
                boxShadow:
                  'inset 0 -16px 28px rgba(74, 222, 128, 0.65), inset 0 8px 20px rgba(0, 0, 0, 0.92)',
                pointerEvents: 'none',
              }}
            />

            {/* Photorealistic 3D Front Ring Render */}
            <img
              src="/assets/ring/ring-front.png"
              alt="Smart Ring Front View"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'brightness(0.82) contrast(1.22) drop-shadow(0 16px 32px rgba(0,0,0,0.85))',
                position: 'relative',
                zIndex: 2,
              }}
            />

            {/* Inner bottom rim green light reflection */}
            <div
              style={{
                position: 'absolute',
                bottom: '16.5%',
                left: '26%',
                width: '50%',
                height: '16%',
                borderRadius: '0 0 90px 90px',
                background:
                  'radial-gradient(ellipse at 50% 100%, rgba(134, 239, 172, 0.75) 0%, rgba(34, 197, 94, 0.35) 55%, transparent 82%)',
                filter: 'blur(4px)',
                zIndex: 3,
                pointerEvents: 'none',
              }}
            />

            {/* Glowing Green PPG Sensor 1 — Left Inner Rim (exact sensor bump position) */}
            <div
              style={{
                position: 'absolute',
                left: '31%',
                bottom: '22%',
                width: '11px',
                height: '11px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, #FFFFFF 0%, #BEF264 45%, #22C55E 100%)',
                boxShadow:
                  '0 0 10px #86EFAC, 0 0 20px #22C55E, 0 0 32px rgba(34, 197, 94, 0.95)',
                zIndex: 4,
                animation: 'sensorGlow 2.2s ease-in-out infinite alternate',
              }}
            />

            {/* Glowing Green PPG Sensor 2 — Bottom Center Inner Rim */}
            <div
              style={{
                position: 'absolute',
                left: '51%',
                bottom: '16.5%',
                transform: 'translateX(-50%)',
                width: '11px',
                height: '8px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, #FFFFFF 0%, #BEF264 50%, #4ADE80 100%)',
                boxShadow:
                  '0 0 10px #86EFAC, 0 0 20px #22C55E, 0 0 32px rgba(34, 197, 94, 0.95)',
                zIndex: 4,
              }}
            />

            {/* Glowing Green PPG Sensor 3 — Right Inner Rim (exact sensor bump position) */}
            <div
              style={{
                position: 'absolute',
                right: '27.5%',
                bottom: '22%',
                width: '11px',
                height: '11px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, #FFFFFF 0%, #BEF264 45%, #22C55E 100%)',
                boxShadow:
                  '0 0 10px #86EFAC, 0 0 20px #22C55E, 0 0 32px rgba(34, 197, 94, 0.95)',
                zIndex: 4,
                animation: 'sensorGlow 2.2s ease-in-out 0.3s infinite alternate',
              }}
            />
          </div>

          {/* Bottom Title + Compact "Begin" Pill Button */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '34px',
            }}
          >
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 500,
                color: '#FFFFFF',
                textAlign: 'center',
                margin: 0,
                maxWidth: '250px',
                lineHeight: 1.3,
                letterSpacing: '-0.3px',
              }}
            >
              Let’s begin by pairing
              <br />
              your Smart Ring
            </h1>

            <button
              type="button"
              onClick={() => setStep('searching')}
              style={{
                width: '196px',
                height: '44px',
                borderRadius: '999px',
                background:
                  'linear-gradient(180deg, #38B861 0%, #249647 55%, #1A7A37 100%)',
                border: '1px solid rgba(167, 243, 208, 0.55)',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow:
                  '0 0 28px rgba(34, 197, 94, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.35)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.03)';
                e.currentTarget.style.boxShadow =
                  '0 0 34px rgba(34, 197, 94, 0.65), inset 0 1px 2px rgba(255, 255, 255, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow =
                  '0 0 28px rgba(34, 197, 94, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.35)';
              }}
            >
              Begin
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          SCREEN 2: SEARCHING — Upward Semicircular Radar Waves
          ======================================================== */}
      {step === 'searching' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 24px 52px 24px',
            animation: 'fadeIn 0.35s ease',
          }}
        >
          {/* Top Header: Back Chevron + Centered Bluetooth & Subtitle */}
          <div
            style={{
              width: '100%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => setStep('welcome')}
              aria-label="Back"
              style={{
                position: 'absolute',
                top: '0px',
                left: '0px',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.85)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronLeft size={20} strokeWidth={1.8} />
            </button>

            <div style={{ marginTop: '38px', color: '#E2E8F0' }}>
              <Bluetooth size={23} strokeWidth={1.6} />
            </div>

            <p
              style={{
                fontSize: '13.5px',
                color: 'rgba(255, 255, 255, 0.78)',
                margin: '16px 0 0 0',
                textAlign: 'center',
                fontWeight: 400,
                letterSpacing: '-0.1px',
              }}
            >
              Searching for your Smart Ring...
            </p>
          </div>

          {/* Center Graphic: Upward Semicircular Radar Arcs + Miniature Glowing Ring */}
          <div
            onClick={() => setStep('found')}
            title="Cliquez pour simuler la détection immédiate"
            style={{
              position: 'relative',
              width: '330px',
              height: '270px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {/* SVG Upward Semicircular Radar Arcs */}
            <svg
              width="330"
              height="270"
              viewBox="0 0 330 270"
              style={{
                position: 'absolute',
                inset: 0,
                overflow: 'visible',
                pointerEvents: 'none',
              }}
            >
              <defs>
                <linearGradient id="radarArcFade" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.48" />
                  <stop offset="48%" stopColor="#FFFFFF" stopOpacity="0.22" />
                  <stop offset="68%" stopColor="#FFFFFF" stopOpacity="0" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                </linearGradient>

                <linearGradient id="radarPulseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#86EFAC" stopOpacity="0.65" />
                  <stop offset="45%" stopColor="#4ADE80" stopOpacity="0.25" />
                  <stop offset="68%" stopColor="#22C55E" stopOpacity="0" />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* 3 Concentric Upper Dome Arcs */}
              <circle
                cx="165"
                cy="176"
                r="62"
                fill="none"
                stroke="url(#radarArcFade)"
                strokeWidth="1.1"
              />
              <circle
                cx="165"
                cy="176"
                r="98"
                fill="none"
                stroke="url(#radarArcFade)"
                strokeWidth="1.1"
              />
              <circle
                cx="165"
                cy="176"
                r="134"
                fill="none"
                stroke="url(#radarArcFade)"
                strokeWidth="1.1"
              />

              {/* Animated Expanding Radar Waves */}
              <circle
                cx="165"
                cy="176"
                r="40"
                fill="none"
                stroke="url(#radarPulseGrad)"
                strokeWidth="1.5"
              >
                <animate
                  attributeName="r"
                  from="36"
                  to="146"
                  dur="2.8s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.9;0.5;0"
                  keyTimes="0;0.6;1"
                  dur="2.8s"
                  repeatCount="indefinite"
                />
              </circle>

              <circle
                cx="165"
                cy="176"
                r="40"
                fill="none"
                stroke="url(#radarPulseGrad)"
                strokeWidth="1.5"
              >
                <animate
                  attributeName="r"
                  from="36"
                  to="146"
                  dur="2.8s"
                  begin="1.4s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.9;0.5;0"
                  keyTimes="0;0.6;1"
                  dur="2.8s"
                  begin="1.4s"
                  repeatCount="indefinite"
                />
              </circle>
            </svg>

            {/* Miniature Glowing Smart Ring at Center of Radar Origin */}
            <div
              style={{
                position: 'absolute',
                top: '140px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '72px',
                height: '72px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle at 50% 60%, rgba(34, 197, 94, 0.45) 0%, rgba(16, 185, 129, 0.18) 50%, transparent 74%)',
                  filter: 'blur(8px)',
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  left: '17.6%',
                  top: '17.8%',
                  width: '67%',
                  height: '65.5%',
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle at 50% 78%, rgba(74, 222, 128, 0.6) 0%, rgba(34, 197, 94, 0.25) 48%, #050807 80%)',
                  boxShadow: 'inset 0 -6px 12px rgba(74, 222, 128, 0.7)',
                }}
              />

              <img
                src="/assets/ring/ring-front.png"
                alt="Mini Smart Ring"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: 'brightness(0.85) contrast(1.2)',
                  position: 'relative',
                  zIndex: 2,
                }}
              />

              {/* Mini Green LEDs inside bottom rim */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '22%',
                  left: '31%',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  boxShadow: '0 0 6px #4ADE80, 0 0 12px #22C55E',
                  zIndex: 3,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '16.5%',
                  left: '51%',
                  transform: 'translateX(-50%)',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  boxShadow: '0 0 6px #4ADE80, 0 0 12px #22C55E',
                  zIndex: 3,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '22%',
                  right: '27.5%',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  boxShadow: '0 0 6px #4ADE80, 0 0 12px #22C55E',
                  zIndex: 3,
                }}
              />
            </div>
          </div>

          {/* Bottom Pill Button: "Trouble connecting?" */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => setShowTroubleSheet(true)}
              style={{
                width: '196px',
                height: '40px',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                color: 'rgba(255, 255, 255, 0.85)',
                fontSize: '12.5px',
                fontWeight: 400,
                cursor: 'pointer',
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
              }}
            >
              Trouble connecting?
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          SCREEN 3: DEVICE FOUND — 3D Silver Ring & Connect
          ======================================================== */}
      {(step === 'found' || step === 'connecting') && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 24px 48px 24px',
            animation: 'fadeIn 0.35s ease',
          }}
        >
          {/* Top Header: Back Chevron + Bluetooth + Found your device + Title + Specs */}
          <div
            style={{
              width: '100%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => setStep('searching')}
              aria-label="Back"
              disabled={step === 'connecting'}
              style={{
                position: 'absolute',
                top: '0px',
                left: '0px',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.85)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronLeft size={20} strokeWidth={1.8} />
            </button>

            <div style={{ marginTop: '28px', color: '#E2E8F0' }}>
              <Bluetooth size={23} strokeWidth={1.6} />
            </div>

            <span
              style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.72)',
                marginTop: '14px',
                fontWeight: 400,
              }}
            >
              Found your device
            </span>

            <h2
              style={{
                fontSize: '24px',
                fontWeight: 600,
                color: '#FFFFFF',
                margin: '6px 0 0 0',
                letterSpacing: '-0.3px',
              }}
            >
              Vyta One
            </h2>

            <span
              style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.65)',
                marginTop: '4px',
                fontWeight: 400,
              }}
            >
              Taille {ring.ringSize || 10} · MAC: {ring.macAddress || 'C8:2B:96:4A:99:84'}
            </span>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '8px',
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(217, 249, 112, 0.12)',
                border: '1px solid rgba(217, 249, 112, 0.35)',
              }}
            >
              <span
                style={{
                  width: '6.5px',
                  height: '6.5px',
                  borderRadius: '50%',
                  background: currentFinish.swatch,
                  boxShadow: '0 0 6px #D9F970',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '11px', color: '#D9F970', fontWeight: 600 }}>
                Finition détectée par MAC : {currentFinish.label}
              </span>
            </div>
          </div>

          {/* Center 3D Silver Ring Graphic showing internal sensors */}
          <div
            style={{
              position: 'relative',
              width: '230px',
              height: '210px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: '190px',
                height: '190px',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(255, 255, 255, 0.06) 0%, rgba(16, 185, 129, 0.05) 45%, transparent 70%)',
                filter: 'blur(12px)',
              }}
            />

            <img
              src="/assets/ring/ring-iso-transparent.png"
              alt="Smart Ring 3D Titanium"
              style={{
                width: '230px',
                height: '230px',
                objectFit: 'contain',
                filter: `${currentFinish.imgFilter} drop-shadow(0 20px 36px rgba(0, 0, 0, 0.95))`,
              }}
            />
          </div>

          {/* Bottom Actions: Connect & This is not my device */}
          {step === 'connecting' ? (
            <div
              style={{
                width: '204px',
                height: '94px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
            >
              <span style={{ fontSize: '12.5px', color: '#4ADE80', fontWeight: 500 }}>
                Connecting to Smart Ring...
              </span>
              <div
                style={{
                  width: '100%',
                  height: '4px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '999px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${connectionProgress}%`,
                    background: '#4ADE80',
                    borderRadius: '999px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          ) : (
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => setStep('connecting')}
                style={{
                  width: '204px',
                  height: '43px',
                  borderRadius: '999px',
                  background:
                    'linear-gradient(180deg, #38B861 0%, #249647 55%, #1A7A37 100%)',
                  border: '1px solid rgba(167, 243, 208, 0.55)',
                  color: '#FFFFFF',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow:
                    '0 0 28px rgba(34, 197, 94, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.35)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.03)';
                  e.currentTarget.style.boxShadow =
                    '0 0 34px rgba(34, 197, 94, 0.65), inset 0 1px 2px rgba(255, 255, 255, 0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow =
                    '0 0 28px rgba(34, 197, 94, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.35)';
                }}
              >
                Connect
              </button>

              <button
                type="button"
                onClick={() => setStep('searching')}
                style={{
                  width: '204px',
                  height: '41px',
                  borderRadius: '999px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontSize: '12.5px',
                  fontWeight: 400,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
              >
                This is not my device
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          SCREEN 4: CONNECTED CONFIRMATION
          ======================================================== */}
      {step === 'success' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '60px 28px 54px 28px',
            animation: 'fadeIn 0.35s ease',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background:
                  'linear-gradient(180deg, #38B861 0%, #1A7A37 100%)',
                border: '1px solid rgba(167, 243, 208, 0.6)',
                boxShadow: '0 0 32px rgba(34, 197, 94, 0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
              }}
            >
              <BadgeCheck size={36} strokeWidth={2} />
            </div>

            <h2
              style={{
                fontSize: '22px',
                fontWeight: 500,
                color: '#FFFFFF',
                margin: 0,
                textAlign: 'center',
              }}
            >
              Smart Ring Connected
            </h2>

            <p
              style={{
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.68)',
                textAlign: 'center',
                margin: 0,
                maxWidth: '250px',
                lineHeight: 1.4,
              }}
            >
              Your ring is paired and streaming live biometric telemetry.
            </p>
          </div>

          <div
            style={{
              width: '100%',
              maxWidth: '280px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '18px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Battery size={14} color="#4ADE80" />
                Battery
              </span>
              <span style={{ fontWeight: 600, color: '#4ADE80' }}>{ring.batteryRing || 96}%</span>
            </div>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: currentFinish.swatch }} />
                Finition matérielle
              </span>
              <span style={{ fontWeight: 600, color: '#D9F970' }}>{currentFinish.label} (Auto MAC)</span>
            </div>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={14} color="#60A5FA" />
                Bluetooth
              </span>
              <span style={{ fontWeight: 500, color: '#FFFFFF' }}>BLE 5.4 Encrypted</span>
            </div>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={14} color="#FBBF24" />
                Firmware
              </span>
              <span style={{ fontWeight: 500, color: '#FFFFFF' }}>v3.4.12</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '204px',
              height: '44px',
              borderRadius: '999px',
              background:
                'linear-gradient(180deg, #38B861 0%, #249647 55%, #1A7A37 100%)',
              border: '1px solid rgba(167, 243, 208, 0.55)',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow:
                '0 0 28px rgba(34, 197, 94, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.35)',
            }}
          >
            Continue
          </button>
        </div>
      )}

      {/* ========================================================
          TROUBLESHOOTING BOTTOM SHEET ("Trouble connecting?")
          ======================================================== */}
      {showTroubleSheet && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'flex-end',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setShowTroubleSheet(false)}
        >
          <div
            style={{
              width: '100%',
              background: '#111715',
              borderTop: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '24px 24px 0 0',
              padding: '20px 24px 34px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '36px',
                height: '4px',
                background: 'rgba(255,255,255,0.28)',
                borderRadius: '2px',
                alignSelf: 'center',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#FFFFFF' }}>
                Trouble connecting?
              </h3>
              <button
                type="button"
                onClick={() => setShowTroubleSheet(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '26px',
                  height: '26px',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
              <div>1. Place your Smart Ring on its charger and ensure the LED is illuminated.</div>
              <div>2. Make sure Bluetooth is enabled on your iPhone.</div>
              <div>3. Keep the ring within 30 cm of your device during pairing.</div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowTroubleSheet(false);
                setStep('searching');
              }}
              style={{
                width: '196px',
                height: '42px',
                alignSelf: 'center',
                borderRadius: '999px',
                background:
                  'linear-gradient(180deg, #38B861 0%, #249647 55%, #1A7A37 100%)',
                border: '1px solid rgba(167, 243, 208, 0.55)',
                color: '#FFFFFF',
                fontSize: '13.5px',
                fontWeight: 500,
                cursor: 'pointer',
                marginTop: '4px',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* iOS Home Indicator Bar at Bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '134px',
          height: '5px',
          borderRadius: '999px',
          background: '#FFFFFF',
          zIndex: 70,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
