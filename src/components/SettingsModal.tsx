import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SensorIntervalOption } from '../types';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { finishes, calculateEstimatedBatteryDays, formatRemainingBatteryTime } from '../data/health';
import { qringBle } from '../lib/qringBleService';
import {
  X,
  Battery,
  Radio,
  User,
  Disc,
  Globe,
  Sparkles,
  Bluetooth,
  Heart,
  Bell,
  ChevronRight,
  ShieldCheck,
  Check,
  Minus,
  Plus,
  Volume2,
  HeartPulse,
  Thermometer,
  Wind,
  Droplets,
  Activity,
  Sliders,
  Zap,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  TrendingUp,
} from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const {
    profile,
    updateProfile,
    ring,
    updateRing,
    finish,
    language,
    setLanguage,
    cardThemeMode,
    setCardThemeMode,
    t,
    openModal,
    sensorIntervals,
    updateSensorIntervals,
    isSimulating,
    toggleSimulation,
    simulationHoursElapsed,
    isFirstLaunch,
    resetToFactory,
  } = useApp();
  const { isClosing, handleClose } = useModalAnimation(onClose);

  const isEn = language === 'en';

  // Find My Ring radar state
  const [showRadar, setShowRadar] = useState<boolean>(false);
  const [pingActive, setPingActive] = useState<boolean>(false);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibrationProgress, setCalibrationProgress] = useState<number>(0);
  const [calibrationStep, setCalibrationStep] = useState<string>('');

  const handleStartCalibration = async () => {
    setIsCalibrating(true);
    setCalibrationProgress(0);
    setCalibrationStep(isEn ? 'Optical PPG coupling...' : 'Couplage optique PPG...');
    
    await qringBle.startWearCalibration((prog, step) => {
      setCalibrationProgress(prog);
      setCalibrationStep(step);
    });

    updateRing({
      wearCalibrationScore: 99,
      wearCalibrationDate: isEn ? 'Today · 99% Optimal' : 'Aujourd’hui · 99% Optimal',
    });

    setTimeout(() => {
      setIsCalibrating(false);
    }, 1200);
  };
  const isConnected = Boolean(ring.isConnected);
  const isVytaCareActive = ring.vytaCareActive !== false;
  const [isSyncingRing, setIsSyncingRing] = useState(false);
  const handleSyncRing = async () => {
    setIsSyncingRing(true);
    try {
      await qringBle.syncAllRingData();
    } catch (_) {}
    setTimeout(() => {
      setIsSyncingRing(false);
    }, 1200);
  };

  const currentFinish = finishes.find((f) => f.id === finish) || finishes[1];
  const estimatedDays = calculateEstimatedBatteryDays(sensorIntervals);
  const remainingBatteryTime = formatRemainingBatteryTime(
    ring.batteryRing || 0,
    sensorIntervals,
    isEn
  );
  const bmi = (profile.weightKg / Math.pow((profile.heightCm || 175) / 100, 2)).toFixed(1);

  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (params?.get('scroll') === 'radar') {
      setShowRadar(true);
      const scrollNow = () => {
        const sheet = document.querySelector('.modal-sheet');
        if (sheet) sheet.scrollTop = sheet.scrollHeight;
      };
      scrollNow();
      setTimeout(scrollNow, 100);
      setTimeout(scrollNow, 300);
    }
  }, []);

  const triggerPing = () => {
    setPingActive(true);
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([30, 60, 30]);
      }
    } catch (e) {}
    setTimeout(() => setPingActive(false), 2200);
  };

  return (
    <div
      className={`modal-backdrop ${isClosing ? 'is-closing' : ''}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`modal-sheet ${isClosing ? 'is-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0D0D10',
          borderTop: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '32px 32px 0 0',
          boxShadow: '0 -24px 60px rgba(0, 0, 0, 0.95)',
          maxHeight: '92%',
          padding: '12px 18px 96px 18px',
          gap: '16px',
        }}
      >
        {/* Top Grabber */}
        <div
          style={{
            width: '38px',
            height: '4.5px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.22)',
            margin: '0 auto 2px auto',
            flexShrink: 0,
          }}
        />

        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '11px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 14px rgba(255, 255, 255, 0.14)',
              }}
            >
              <Disc size={17} color="#FAF7F2" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#FAF7F2',
                  margin: 0,
                  letterSpacing: '-0.3px',
                }}
              >
                {t('settings.title')}
              </h2>
              <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)', fontWeight: 500 }}>
                {isEn ? 'Vyta One Ring · System & Biometrics' : 'Bague Vyta One · Système & Biométrie'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            aria-label={t('settings.close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* ====================================================================
            1. HERO CARD : MA BAGUE VYTA ONE (Série, Garantie, Batterie, Statut)
            ==================================================================== */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            flexShrink: 0,
            padding: '16px',
            borderRadius: '26px',
            overflow: 'hidden',
            background:
              'radial-gradient(ellipse at 75% 100%, rgba(217, 249, 112, 0.24) 0%, rgba(82, 102, 42, 0.14) 48%, rgba(10, 10, 12, 0.96) 82%), #0A0A0C',
            borderTop: '1px solid rgba(255, 248, 240, 0.16)',
            borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
            borderRight: '1px solid rgba(255, 248, 240, 0.12)',
            borderBottom: '1.5px solid rgba(217, 249, 112, 0.6)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.65), 0 4px 20px rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* 1. ROW 1: Statut de Connexion & Synchronisation Ring BLE */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              zIndex: 2,
            }}
          >
            {/* Statut connectée ou pas */}
            <button
              type="button"
              onClick={() => updateRing({ isConnected: !isConnected })}
              title={isEn ? 'Click to toggle connection status' : 'Cliquer pour basculer le statut de connexion'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '999px',
                background: isConnected
                  ? 'rgba(48, 209, 88, 0.15)'
                  : 'rgba(255, 69, 58, 0.15)',
                border: isConnected
                  ? '1px solid rgba(48, 209, 88, 0.45)'
                  : '1px solid rgba(255, 69, 58, 0.45)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s ease',
              }}
            >
              <span
                style={{
                  width: '6.5px',
                  height: '6.5px',
                  borderRadius: '50%',
                  background: isConnected ? '#FAF7F2' : '#FF453A',
                  boxShadow: isConnected
                    ? '0 0 8px #FAF7F2'
                    : '0 0 6px #FF453A',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: isConnected ? '#FAF7F2' : '#FF453A',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                {isConnected
                  ? isEn
                    ? 'Connected'
                    : 'Connectée'
                  : isEn
                  ? 'Disconnected'
                  : 'Non connectée'}
              </span>
            </button>

            {/* Statut de Synchronisation de la Bague */}
            <button
              type="button"
              onClick={handleSyncRing}
              disabled={isSyncingRing}
              title={isEn ? 'Click to sync ring biomarkers' : 'Cliquer pour synchroniser les biomarqueurs de la bague'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '999px',
                background: isSyncingRing
                  ? 'rgba(217, 249, 112, 0.16)'
                  : 'rgba(255, 255, 255, 0.06)',
                border: isSyncingRing
                  ? '1px solid rgba(255, 255, 255, 0.35)'
                  : '1px solid rgba(255, 255, 255, 0.12)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s ease',
              }}
            >
              <RefreshCw
                size={11}
                color={isSyncingRing ? '#D9F970' : '#FAF7F2'}
                style={{
                  transform: isSyncingRing ? 'rotate(360deg)' : 'none',
                  transition: isSyncingRing ? 'transform 0.75s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                }}
              />
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: isSyncingRing ? '#D9F970' : 'rgba(250, 247, 242, 0.75)',
                  letterSpacing: '0.01em',
                }}
              >
                {isSyncingRing
                  ? isEn
                    ? 'Syncing...'
                    : 'Synchronisation...'
                  : isEn
                  ? 'Synced just now'
                  : "Synchro : à l'instant"}
              </span>
            </button>
          </div>

          {/* 3. ROW 3: Batterie Bague (Gauche) & Rendu 3D Bague (Droite) - SANS mention du boîtier nomade */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'relative',
              minHeight: '104px',
              padding: '2px 0',
              zIndex: 2,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '58%' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'rgba(250, 247, 242, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {t('settings.ring_battery')}
              </span>

              <div
                onClick={() => {
                  const current = ring.batteryRing ?? 87;
                  const steps = [87, 50, 20, 2, 100];
                  const next = steps[(steps.findIndex((s) => Math.abs(s - current) <= 3) + 1) % steps.length] ?? 87;
                  updateRing({ batteryRing: next });
                }}
                role="button"
                tabIndex={0}
                title={isEn ? 'Click to simulate battery levels (87%, 50%, 20%, 2%, 100%)' : 'Cliquer pour simuler les niveaux de batterie (87%, 50%, 20%, 2%, 100%)'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  cursor: 'pointer',
                  userSelect: 'none',
                  width: 'fit-content',
                }}
              >
                <span
                  style={{
                    fontSize: '42px',
                    fontWeight: 300,
                    color: (ring.batteryRing || 0) <= 15 ? '#FF453A' : '#FAF7F2',
                    lineHeight: 1,
                    letterSpacing: '-1.5px',
                    transition: 'color 0.2s ease',
                  }}
                >
                  {isConnected && ring.batteryRing > 0 ? `${ring.batteryRing}%` : (isConnected ? '0%' : '--')}
                </span>
              </div>

              {/* Battery Progress Bar */}
              <div
                style={{
                  width: '100%',
                  maxWidth: '170px',
                  height: '5px',
                  borderRadius: '999px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  overflow: 'hidden',
                  marginTop: '4px',
                }}
              >
                <div
                  style={{
                    width: String(ring.batteryRing) + '%',
                    height: '100%',
                    borderRadius: '999px',
                    background:
                      ring.batteryRing <= 20
                        ? 'linear-gradient(90deg, #FF453A, #FF9F0A)'
                        : 'linear-gradient(90deg, #D9F970, #FAF7F2)',
                    boxShadow:
                      ring.batteryRing <= 20
                        ? '0 0 10px rgba(255, 69, 58, 0.6)'
                        : '0 0 10px rgba(217, 249, 112, 0.6)',
                  }}
                />
              </div>

              {/* Sous-titre synchronisé avec le % réel de la batterie */}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: (ring.batteryRing || 0) <= 15 ? '#FF453A' : '#D9F970',
                  marginTop: '4px',
                  letterSpacing: '0.01em',
                }}
              >
                {remainingBatteryTime}
              </span>
            </div>

            {/* 3D Isometric Ring Render */}
            <div
              style={{
                width: '136px',
                height: '114px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <img
                src="/assets/ring/ring-iso-transparent.png"
                alt="Vyta One Smart Ring"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  transform: 'scale(1.18)',
                  filter: currentFinish.imgFilter + ' drop-shadow(0 14px 28px rgba(0, 0, 0, 0.9))',
                  transition: 'filter 0.25s ease',
                }}
              />
            </div>
          </div>

          {/* Garantie Vyta Care Active ou Non (Dedicated Capsule Card) */}
          <div
            onClick={() => updateRing({ vytaCareActive: !isVytaCareActive })}
            role="button"
            tabIndex={0}
            title={isEn ? 'Click to toggle Vyta Care warranty status' : 'Cliquer pour basculer le statut de garantie'}
            style={{
              padding: '10px 12px',
              borderRadius: '14px',
              background: isVytaCareActive
                ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))'
                : 'rgba(255, 255, 255, 0.04)',
              border: isVytaCareActive
                ? '1px solid rgba(255, 255, 255, 0.25)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              zIndex: 2,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '8px',
                  background: isVytaCareActive
                    ? 'rgba(255, 255, 255, 0.14)'
                    : 'rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck
                  size={14}
                  color={isVytaCareActive ? '#D9F970' : 'rgba(250, 247, 242, 0.5)'}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#FAF7F2' }}>
                  {isEn ? 'Vyta Care Warranty' : 'Garantie Vyta Care'}
                </span>
                <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.55)' }}>
                  {isVytaCareActive
                    ? isEn
                      ? `Active coverage · Valid until ${ring.vytaCareExpires || 'Oct 2028'}`
                      : `Couverture active · Valide jusqu'en ${ring.vytaCareExpires || 'Octobre 2028'}`
                    : isEn
                    ? 'Inactive · No active coverage'
                    : 'Non active · Aucune couverture'}
                </span>
              </div>
            </div>

            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 700,
                color: isVytaCareActive ? '#000000' : 'rgba(250, 247, 242, 0.65)',
                background: isVytaCareActive ? '#FAF7F2' : 'rgba(255, 255, 255, 0.08)',
                padding: '3px 8px',
                borderRadius: '6px',
                letterSpacing: '0.03em',
                transition: 'all 0.2s ease',
              }}
            >
              {isVytaCareActive
                ? isEn
                  ? 'ACTIVE'
                  : 'ACTIVE'
                : isEn
                ? 'INACTIVE'
                : 'NON ACTIVE'}
            </span>
          </div>

          {/* Quick Ring Actions: Appairer & Localiser */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', zIndex: 2 }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                openModal('pairing');
              }}
              style={{
                padding: '10px 12px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.07)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FAF7F2',
                fontSize: '11.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <Bluetooth size={14} color="#FAF7F2" />
              <span>{isEn ? 'Pair / Sync Ring' : 'Appairer la bague'}</span>
            </button>

            <button
              type="button"
              onClick={() => openModal('find_my')}
              style={{
                padding: '10px 12px',
                borderRadius: '14px',
                background: 'rgba(48, 209, 88, 0.12)',
                border: '1px solid rgba(48, 209, 88, 0.35)',
                color: '#30D158',
                fontSize: '11.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <Radio size={14} color="#30D158" />
              <span>{t('settings.find_my_ring')}</span>
            </button>
          </div>

          {/* Calibrage de Port de la Bague (Wear Calibration - SDK QC) */}
          <div
            style={{
              padding: '13px 14px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.035)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              zIndex: 2,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={13} color="#FAF7F2" />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#FAF7F2' }}>
                  {isEn ? 'Ring Wear Calibration' : 'Calibrage du Port de la Bague'}
                </span>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#FAF7F2',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  padding: '2px 7px',
                  borderRadius: '999px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {ring.wearCalibrationScore || 99}% {isEn ? 'OPTIMAL' : 'OPTIMAL'}
              </span>
            </div>

            <p style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.65)', lineHeight: 1.4, margin: 0 }}>
              {isEn
                ? 'Calibrates optical PPG sensor contact impedance and microvascular alignment against your skin.'
                : 'Calibre le couplage optique PPG et l’impédance cutanée pour une précision biométrique maximale.'}
            </p>

            {/* Live Calibration HUD when active */}
            {isCalibrating && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '14px',
                  background: 'rgba(0, 0, 0, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#FAF7F2', fontWeight: 500 }}>
                    {calibrationStep}
                  </span>
                  <span style={{ fontSize: '11px', color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
                    {calibrationProgress}%
                  </span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.15)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${calibrationProgress}%`,
                      height: '100%',
                      background: '#FAF7F2',
                      transition: 'width 0.3s ease',
                      boxShadow: '0 0 8px rgba(255, 255, 255, 0.6)',
                    }}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleStartCalibration}
              disabled={isCalibrating}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '12px',
                background: isCalibrating ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                color: '#FAF7F2',
                fontSize: '11.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: isCalibrating ? 'default' : 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <RefreshCw size={13} className={isCalibrating ? 'spin' : ''} />
              <span>
                {isCalibrating
                  ? (isEn ? 'Calibrating PPG Sensors...' : 'Calibrage en cours...')
                  : (isEn ? 'Launch Wear Calibration (15s)' : 'Lancer le calibrage de port (15s)')}
              </span>
            </button>
          </div>

          {/* Expandable Bioluminescent Radar Stage */}
          {showRadar && (
            <div
              style={{
                marginTop: '4px',
                padding: '14px',
                borderRadius: '18px',
                background: 'rgba(0, 0, 0, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                zIndex: 2,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Radio size={13} color="#FAF7F2" />
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#FAF7F2' }}>
                    {isEn ? 'UWB Proximity Radar' : 'Radar de Proximité UWB'}
                  </span>
                </div>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
                  0,8 m · -42 dBm
                </span>
              </div>

              <div className="radar-stage" style={{ height: '120px', borderRadius: '14px' }}>
                <div className="radar-wave" style={{ borderColor: 'rgba(255, 255, 255, 0.35)' }} />
                <div className="radar-wave" style={{ borderColor: 'rgba(255, 255, 255, 0.25)' }} />
                <div className="radar-wave" style={{ borderColor: 'rgba(255, 255, 255, 0.15)' }} />
                <div
                  className="radar-center-ring"
                  style={{
                    background: '#FAF7F2',
                    boxShadow: '0 0 20px rgba(255, 255, 255, 0.7)',
                  }}
                >
                  <Disc size={18} color="#000000" />
                </div>
              </div>

              <button
                type="button"
                onClick={triggerPing}
                style={{
                  width: '100%',
                  padding: '9px',
                  borderRadius: '12px',
                  background: pingActive ? '#D9F970' : 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  color: pingActive ? '#0A0A0C' : '#D9F970',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Volume2 size={14} />
                <span>
                  {pingActive
                    ? isEn
                      ? 'Flashing LEDs & Vibrating...'
                      : 'Clignotement LED Capteurs actif...'
                    : isEn
                    ? 'Flash Ring Sensor LEDs'
                    : 'Faire clignoter les LED de la bague'}
                </span>
              </button>
            </div>
          )}
        </div>

                {/* ====================================================================
            2. FRÉQUENCE D'ÉCHANTILLONNAGE & MESURE DES 8 CAPTEURS BIOMÉTRIQUES
            ==================================================================== */}
        <div
          style={{
            flexShrink: 0,
            padding: '18px 16px',
            borderRadius: '26px',
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(217, 249, 112, 0.07) 0%, rgba(16, 16, 20, 0.98) 75%), #0A0A0C',
            border: '1px solid rgba(255, 248, 240, 0.12)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.55)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Section Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sliders size={15} color="#FAF7F2" strokeWidth={1.8} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#FAF7F2', letterSpacing: '-0.2px' }}>
                  {isEn ? 'Sensor Measurement Intervals' : 'Intervalles de Mesure des Capteurs'}
                </span>
                <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.52)', marginTop: '1px' }}>
                  {isEn ? '8 Biometrics Autonomous Sampling' : 'Échantillonnage autonome des 8 biométries'}
                </span>
              </div>
            </div>

            {/* Dynamic Battery Impact Pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '999px',
                background: estimatedDays >= 6 ? 'rgba(48, 209, 88, 0.16)' : 'rgba(255, 159, 10, 0.16)',
                border: estimatedDays >= 6 ? '1px solid rgba(48, 209, 88, 0.38)' : '1px solid rgba(255, 159, 10, 0.38)',
                boxShadow: estimatedDays >= 6 ? '0 0 10px rgba(48, 209, 88, 0.18)' : 'none',
              }}
            >
              <Zap size={11} color={estimatedDays >= 6 ? '#30D158' : '#FF9F0A'} fill={estimatedDays >= 6 ? '#30D158' : '#FF9F0A'} />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: estimatedDays >= 6 ? '#FAF7F2' : '#FF9F0A',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                ~{estimatedDays} {isEn ? 'days' : 'jours'}
              </span>
            </div>
          </div>

          {/* Quick Presets Bar: 1h vs 30min */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '4px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {[
              {
                id: '1h',
                labelFr: 'Toutes les heures (1 h)',
                labelEn: 'Every hour (1h)',
                subFr: 'Chaque heure · ~8j (Optimal)',
                subEn: 'Hourly · ~8d (Optimal)',
                isActive: (sensorIntervals?.heartRate || '1h') === '1h',
                action: () => {
                  updateSensorIntervals({
                    heartRate: '1h',
                    hrv: '1h',
                    spo2: '1h',
                    temperature: '1h',
                    stress: '1h',
                    bloodPressure: '1h',
                    glucose: '1h',
                    respiratory: '1h',
                  });
                  qringBle.setHeartRateInterval(60);
                },
              },
              {
                id: '30min',
                labelFr: 'Toutes les 30 min',
                labelEn: 'Every 30 min',
                subFr: '2× / heure · ~5j (Précis)',
                subEn: '2x / hr · ~5d (Precise)',
                isActive: sensorIntervals?.heartRate === '30min',
                action: () => {
                  updateSensorIntervals({
                    heartRate: '30min',
                    hrv: '30min',
                    spo2: '30min',
                    temperature: '30min',
                    stress: '30min',
                    bloodPressure: '30min',
                    glucose: '30min',
                    respiratory: '30min',
                  });
                  qringBle.setHeartRateInterval(30);
                },
              },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={preset.action}
                style={{
                  flex: 1,
                  padding: '8px 6px',
                  borderRadius: '10px',
                  background: preset.isActive ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  border: preset.isActive ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid rgba(255, 255, 255, 0.06)',
                  color: preset.isActive ? '#FAF7F2' : 'rgba(250, 247, 242, 0.75)',
                  fontSize: '11px',
                  fontWeight: preset.isActive ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  transition: 'all 0.15s ease',
                  boxShadow: preset.isActive ? '0 2px 10px rgba(0, 0, 0, 0.35)' : 'none',
                }}
              >
                <span>{isEn ? preset.labelEn : preset.labelFr}</span>
                <span style={{ fontSize: '9px', color: preset.isActive ? '#30D158' : 'rgba(250, 247, 242, 0.45)', fontFamily: 'var(--font-mono)' }}>
                  {isEn ? preset.subEn : preset.subFr}
                </span>
              </button>
            ))}
          </div>

          {/* 8 Biometric Sensor Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              {
                key: 'heartRate' as const,
                nameFr: 'Fréquence Cardiaque (BPM)',
                nameEn: 'Heart Rate (BPM)',
                descFr: 'Cardiofréquencemètre PPG optique vert',
                descEn: 'Continuous green optical PPG sensor',
                icon: HeartPulse,
                color: '#FF453A',
              },
              {
                key: 'hrv' as const,
                nameFr: 'Variabilité Cardiaque (VRC)',
                nameEn: 'Heart Rate Variability (HRV)',
                descFr: 'Équilibre nerveux & indice SDNN/RMSSD',
                descEn: 'Autonomic nervous recovery index',
                icon: Activity,
                color: '#A78BFA',
              },
              {
                key: 'spo2' as const,
                nameFr: 'Oxygénation Sanguine (SpO2)',
                nameEn: 'Blood Oxygen (SpO2)',
                descFr: 'Saturation artérielle & LED infrarouge',
                descEn: 'Arterial saturation & infrared LEDs',
                icon: Droplets,
                color: '#38BDF8',
              },
              {
                key: 'temperature' as const,
                nameFr: 'Température Cutanée (NTC)',
                nameEn: 'Skin Temperature (NTC)',
                descFr: 'Thermistance différentielle médicale',
                descEn: 'Medical differential thermistor',
                icon: Thermometer,
                color: '#FBBF24',
              },
              {
                key: 'stress' as const,
                nameFr: 'Niveau de Stress & Émotion',
                nameEn: 'Stress Level & Emotion',
                descFr: 'Charge mentale & tension autonome (0x73)',
                descEn: 'Mental strain & autonomic tension (0x73)',
                icon: Zap,
                color: '#EC4899',
              },
              {
                key: 'bloodPressure' as const,
                nameFr: 'Pression Artérielle (Tension)',
                nameEn: 'Blood Pressure Estimation',
                descFr: 'Analyse PTT & dynamique onde de pouls',
                descEn: 'Pulse transit time & arterial wave',
                icon: Heart,
                color: '#F43F5E',
              },
              {
                key: 'glucose' as const,
                nameFr: 'Stabilité Glycémique (Métabolisme)',
                nameEn: 'Metabolic Glucose Stability',
                descFr: 'Oscillation glucidique & stabilité métabolique',
                descEn: 'Glucose oscillation & metabolic stability',
                icon: TrendingUp,
                color: '#6366F1',
              },
              {
                key: 'respiratory' as const,
                nameFr: 'Fréquence Respiratoire (RPM)',
                nameEn: 'Respiratory Rate (RPM)',
                descFr: 'Ventilation & cycles respiratoires',
                descEn: 'Breathing rate & chest amplitude',
                icon: Wind,
                color: '#34D399',
              },
            ].map((sensor) => {
              const currentVal: SensorIntervalOption = (sensorIntervals?.[sensor.key] as SensorIntervalOption) || '1h';

              const formatValLabel = (val: SensorIntervalOption) => {
                if (val === '30min' || val === '15min') return isEn ? '30 min' : 'Toutes les 30 min';
                return isEn ? '1 hour' : 'Toutes les heures (1h)';
              };

              return (
                <div
                  key={sensor.key}
                  style={{
                    padding: '11px 12px',
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.16s ease',
                  }}
                >
                  {/* Top: Icon + Name + Description + Current Value Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '8px',
                          background: `${sensor.color}18`,
                          border: `1px solid ${sensor.color}35`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <sensor.icon size={13} color={sensor.color} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#FAF7F2', lineHeight: 1.2 }}>
                          {isEn ? sensor.nameEn : sensor.nameFr}
                        </span>
                        <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.44)', marginTop: '1px' }}>
                          {isEn ? sensor.descEn : sensor.descFr}
                        </span>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        color: sensor.color,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: `${sensor.color}15`,
                        border: `1px solid ${sensor.color}30`,
                        fontFamily: 'var(--font-mono, monospace)',
                        flexShrink: 0,
                      }}
                    >
                      {formatValLabel(currentVal)}
                    </span>
                  </div>

                  {/* Standardized 2 Interval Options: 30 min vs 1 h */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {(
                      [
                        { id: '30min', label: isEn ? 'Toutes les 30 min' : 'Toutes les 30 min' },
                        { id: '1h', label: isEn ? 'Toutes les heures (1h)' : 'Toutes les heures (1h)' },
                      ] as const
                    ).map((opt) => {
                      const active = currentVal === opt.id || (opt.id === '1h' && (currentVal === '2h' || !currentVal)) || (opt.id === '30min' && currentVal === '15min');
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            updateSensorIntervals({ [sensor.key]: opt.id });
                            if (sensor.key === 'heartRate') {
                              qringBle.setHeartRateInterval(opt.id === '30min' ? 30 : 60);
                            }
                          }}
                          style={{
                            padding: '7px 0',
                            borderRadius: '10px',
                            background: active ? sensor.color : 'rgba(255, 255, 255, 0.04)',
                            border: active ? `1px solid ${sensor.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                            color: active ? '#0A0A0C' : 'rgba(250, 247, 242, 0.78)',
                            fontSize: '11px',
                            fontWeight: active ? 700 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            textAlign: 'center',
                            boxShadow: active ? `0 0 10px ${sensor.color}66` : 'none',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ====================================================================
            3. PROFIL BIOMÉTRIQUE & CALIBRAGE
            ==================================================================== */}
        <div
          style={{
            flexShrink: 0,
            padding: '18px',
            borderRadius: '24px',
            background:
              'radial-gradient(ellipse at 50% 110%, rgba(167, 139, 250, 0.16) 0%, rgba(14, 14, 18, 0.96) 75%), #0A0A0C',
            borderTop: '1px solid rgba(255, 248, 240, 0.14)',
            borderLeft: '1px solid rgba(255, 248, 240, 0.1)',
            borderRight: '1px solid rgba(255, 248, 240, 0.1)',
            borderBottom: '1.5px solid rgba(167, 139, 250, 0.45)',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.55)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Section Title */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '9px',
                  background: 'rgba(167, 139, 250, 0.15)',
                  border: '1px solid rgba(167, 139, 250, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <User size={14} color="#A78BFA" />
              </span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#FAF7F2' }}>
                {t('settings.bio_title')}
              </span>
            </div>

            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 600,
                color: '#A78BFA',
                background: 'rgba(167, 139, 250, 0.12)',
                border: '1px solid rgba(167, 139, 250, 0.3)',
                padding: '2.5px 8px',
                borderRadius: '999px',
              }}
            >
              IMC {bmi}
            </span>
          </div>

          {/* Sexe Biologique Switcher (Homme / Femme) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 600,
                color: 'rgba(250, 247, 242, 0.6)',
              }}
            >
              {t('settings.bio_sex_label')}
            </span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                padding: '4px',
                borderRadius: '14px',
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                type="button"
                onClick={() => updateProfile({ sex: 'homme' })}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background:
                    profile.sex === 'homme'
                      ? 'linear-gradient(135deg, rgba(217, 249, 112, 0.22), rgba(217, 249, 112, 0.08))'
                      : 'transparent',
                  border:
                    profile.sex === 'homme'
                      ? '1px solid rgba(217, 249, 112, 0.55)'
                      : '1px solid transparent',
                  color: profile.sex === 'homme' ? '#D9F970' : 'rgba(250, 247, 242, 0.6)',
                  fontSize: '12.5px',
                  fontWeight: profile.sex === 'homme' ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {profile.sex === 'homme' && <Check size={13} strokeWidth={2.6} />}
                <span>{t('settings.male')}</span>
              </button>

              <button
                type="button"
                onClick={() => updateProfile({ sex: 'femme' })}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background:
                    profile.sex === 'femme'
                      ? 'linear-gradient(135deg, rgba(232, 121, 249, 0.24), rgba(232, 121, 249, 0.08))'
                      : 'transparent',
                  border:
                    profile.sex === 'femme'
                      ? '1px solid rgba(232, 121, 249, 0.55)'
                      : '1px solid transparent',
                  color: profile.sex === 'femme' ? '#E879F9' : 'rgba(250, 247, 242, 0.6)',
                  fontSize: '12.5px',
                  fontWeight: profile.sex === 'femme' ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {profile.sex === 'femme' && <Check size={13} strokeWidth={2.6} />}
                <span>{t('settings.female')}</span>
              </button>
            </div>
          </div>

          {/* 2x2 Bento Grid: Prénom, Âge, Taille, Poids */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* Prénom */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                borderRadius: '14px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'rgba(250, 247, 242, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {t('settings.first_name')}
              </span>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => updateProfile({ firstName: e.target.value })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#FAF7F2',
                  fontSize: '15px',
                  fontWeight: 600,
                  width: '100%',
                  padding: 0,
                }}
              />
            </div>

            {/* Âge */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                borderRadius: '14px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'rgba(250, 247, 242, 0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {t('settings.age')}
                </span>
                <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.4)' }}>
                  {isEn ? 'yrs' : 'ans'}
                </span>
              </div>
              <input
                type="number"
                value={profile.age}
                onChange={(e) => updateProfile({ age: Number(e.target.value) || 28 })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#FAF7F2',
                  fontSize: '15px',
                  fontWeight: 600,
                  width: '100%',
                  padding: 0,
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </div>

            {/* Taille */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                borderRadius: '14px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'rgba(250, 247, 242, 0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {t('settings.height')}
                </span>
                <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.4)' }}>cm</span>
              </div>
              <input
                type="number"
                value={profile.heightCm}
                onChange={(e) => updateProfile({ heightCm: Number(e.target.value) || 180 })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#FAF7F2',
                  fontSize: '15px',
                  fontWeight: 600,
                  width: '100%',
                  padding: 0,
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </div>

            {/* Poids */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                borderRadius: '14px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'rgba(250, 247, 242, 0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {t('settings.weight')}
                </span>
                <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.4)' }}>kg</span>
              </div>
              <input
                type="number"
                value={profile.weightKg}
                onChange={(e) => updateProfile({ weightKg: Number(e.target.value) || 75 })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#FAF7F2',
                  fontSize: '15px',
                  fontWeight: 600,
                  width: '100%',
                  padding: 0,
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </div>
          </div>

          {/* Ring Size Stepper */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#FAF7F2' }}>
                {isEn ? 'Vyta One Ring Size' : 'Taille de bague Vyta One'}
              </span>
              <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.5)' }}>
                {isEn ? 'Standard index/middle finger fit' : 'Ajustement index ou majeur'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => updateRing({ ringSize: Math.max(6, ring.ringSize - 1) })}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#FAF7F2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Minus size={13} />
              </button>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#FAF7F2',
                  fontFamily: 'var(--font-mono)',
                  minWidth: '22px',
                  textAlign: 'center',
                }}
              >
                {ring.ringSize}
              </span>
              <button
                type="button"
                onClick={() => updateRing({ ringSize: Math.min(14, ring.ringSize + 1) })}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#FAF7F2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* ====================================================================
            4. ÉCOSYSTÈME & SERVICES CONNECTÉS
            ==================================================================== */}
        <div
          style={{
            flexShrink: 0,
            padding: '16px',
            borderRadius: '24px',
            background: '#111115',
            border: '1px solid rgba(255, 248, 240, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 700,
              color: 'rgba(250, 247, 242, 0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              paddingLeft: '2px',
            }}
          >
            {isEn ? 'Connected Ecosystem' : 'Écosystème & Services'}
          </span>

          {/* Apple Santé / HealthKit */}
          <button
            type="button"
            onClick={() => {
              onClose();
              openModal('healthkit');
            }}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.035)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: 'rgba(255, 45, 85, 0.15)',
                  border: '1px solid rgba(255, 45, 85, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Heart size={16} color="#FF2D55" fill="#FF2D55" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAF7F2' }}>
                  {isEn ? 'Apple Health & Fitness' : 'Pont Apple Santé & Forme'}
                </span>
                <span style={{ fontSize: '11px', color: '#FAF7F2', fontWeight: 500 }}>
                  {isEn ? 'Real-time HealthKit Sync Active' : 'Synchronisation HealthKit temps réel'}
                </span>
              </div>
            </div>
            <ChevronRight size={16} color="rgba(250, 247, 242, 0.4)" />
          </button>

          {/* Centre d'Alertes APNs */}
          <button
            type="button"
            onClick={() => {
              onClose();
              openModal('notifications');
            }}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.035)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bell size={16} color="#38BDF8" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAF7F2' }}>
                  {isEn ? 'Biometric Push Alerts' : 'Alertes & Notifications Biométriques'}
                </span>
                <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)' }}>
                  {isEn ? 'HRV, Temp & Battery thresholds' : 'Seuils VRC, Température & Batterie'}
                </span>
              </div>
            </div>
            <ChevronRight size={16} color="rgba(250, 247, 242, 0.4)" />
          </button>
        </div>

        {/* ====================================================================
            5. PRÉFÉRENCES SYSTÈME & LANGUE
            ==================================================================== */}
        <div
          style={{
            flexShrink: 0,
            padding: '16px',
            borderRadius: '24px',
            background: '#111115',
            border: '1px solid rgba(255, 248, 240, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={15} color="#38BDF8" />
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#FAF7F2' }}>
                {t('settings.language_title')}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.5)' }}>
              {language === 'fr' ? 'Français' : 'English'}
            </span>
          </div>

          {/* Style des métriques : Coloré vs Noir & Blanc */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)', fontWeight: 600 }}>
              {isEn ? 'Biometric Glow Theme' : 'Style Visuel des Constantes'}
            </span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                padding: '4px',
                borderRadius: '14px',
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                type="button"
                onClick={() => setCardThemeMode('colored')}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: cardThemeMode === 'colored' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  border: cardThemeMode === 'colored' ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid transparent',
                  color: cardThemeMode === 'colored' ? '#FAF7F2' : 'rgba(250, 247, 242, 0.55)',
                  fontSize: '12px',
                  fontWeight: cardThemeMode === 'colored' ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Coloré ✨
              </button>
              <button
                type="button"
                onClick={() => setCardThemeMode('monochrome')}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: cardThemeMode === 'monochrome' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  border: cardThemeMode === 'monochrome' ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid transparent',
                  color: cardThemeMode === 'monochrome' ? '#FAF7F2' : 'rgba(250, 247, 242, 0.55)',
                  fontSize: '12px',
                  fontWeight: cardThemeMode === 'monochrome' ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Noir & Blanc
              </button>
            </div>
          </div>

          {/* Style des métriques : Coloré vs Noir & Blanc */}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

            <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)', fontWeight: 600 }}>

              {isEn ? 'Biometric Glow Theme' : 'Style Visuel des Constantes'}

            </span>

            <div

              style={{

                display: 'grid',

                gridTemplateColumns: '1fr 1fr',

                gap: '8px',

                padding: '4px',

                borderRadius: '14px',

                background: 'rgba(0, 0, 0, 0.5)',

                border: '1px solid rgba(255, 255, 255, 0.08)',

              }}

            >

              <button

                type="button"

                onClick={() => setCardThemeMode('colored')}

                style={{

                  padding: '9px 12px',

                  borderRadius: '10px',

                  background: cardThemeMode === 'colored' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',

                  border: cardThemeMode === 'colored' ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid transparent',

                  color: cardThemeMode === 'colored' ? '#FAF7F2' : 'rgba(250, 247, 242, 0.55)',

                  fontSize: '12px',

                  fontWeight: cardThemeMode === 'colored' ? 700 : 500,

                  cursor: 'pointer',

                  transition: 'all 0.2s ease',

                }}

              >

                Coloré ✨

              </button>

              <button

                type="button"

                onClick={() => setCardThemeMode('monochrome')}

                style={{

                  padding: '9px 12px',

                  borderRadius: '10px',

                  background: cardThemeMode === 'monochrome' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',

                  border: cardThemeMode === 'monochrome' ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid transparent',

                  color: cardThemeMode === 'monochrome' ? '#FAF7F2' : 'rgba(250, 247, 242, 0.55)',

                  fontSize: '12px',

                  fontWeight: cardThemeMode === 'monochrome' ? 700 : 500,

                  cursor: 'pointer',

                  transition: 'all 0.2s ease',

                }}

              >

                Noir & Blanc

              </button>

            </div>

          </div>



          {/* Language Switcher */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              padding: '4px',
              borderRadius: '14px',
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              type="button"
              onClick={() => setLanguage('fr')}
              style={{
                padding: '9px 12px',
                borderRadius: '10px',
                background: language === 'fr' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                border:
                  language === 'fr'
                    ? '1px solid rgba(255, 255, 255, 0.22)'
                    : '1px solid transparent',
                color: language === 'fr' ? '#FAF7F2' : 'rgba(250, 247, 242, 0.55)',
                fontSize: '12.5px',
                fontWeight: language === 'fr' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Français 🇫🇷
            </button>

            <button
              type="button"
              onClick={() => setLanguage('en')}
              style={{
                padding: '9px 12px',
                borderRadius: '10px',
                background: language === 'en' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                border:
                  language === 'en'
                    ? '1px solid rgba(255, 255, 255, 0.22)'
                    : '1px solid transparent',
                color: language === 'en' ? '#FAF7F2' : 'rgba(250, 247, 242, 0.55)',
                fontSize: '12.5px',
                fontWeight: language === 'en' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              English 🇬🇧
            </button>
          </div>

          {/* ====================================================================
              6. MAINTENANCE & RÉINITIALISATION
              ==================================================================== */}
          <div
            style={{
              marginTop: '6px',
              padding: '14px',
              borderRadius: '16px',
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={14} color="#FAF7F2" />
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#FAF7F2' }}>
                  {isEn ? 'Device Maintenance' : 'Maintenance & Réinitialisation'}
                </span>
              </div>
            </div>

            <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.55)', lineHeight: 1.35 }}>
              {isEn
                ? 'Clear local device cache and reset application data to factory state.'
                : 'Effacez le cache local et remettez l\'application à son état d\'origine.'}
            </span>

            {/* Bouton Remise à Zéro Usine */}
            <button
              type="button"
              onClick={resetToFactory}
              title="Remettre l'application à zéro comme au premier déballage"
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: '10px',
                background: 'rgba(255, 69, 58, 0.12)',
                border: '1px solid rgba(255, 69, 58, 0.35)',
                color: '#FF453A',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <RotateCcw size={12} />
              <span>{isEn ? 'Factory Reset' : 'Remise à Zéro de l\'Application'}</span>
            </button>
          </div>

          {/* Footer Hardware Certification */}
          <div
            style={{
              marginTop: '4px',
              paddingTop: '10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '10.5px',
              color: 'rgba(250, 247, 242, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ShieldCheck size={13} color="#FAF7F2" />
              <span>{isEn ? 'Encrypted On-Device Vault' : 'Chiffrement Biométrique Local'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-mono)' }}><span>MAC: {ring.macAddress || 'C8:2B:96:4A:99:84'}</span><span>·</span><span>{ring.serial}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};
