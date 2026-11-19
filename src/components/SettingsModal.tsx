import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { finishes, calculateEstimatedBatteryDays, formatRemainingBatteryTime } from '../data/health';
import { RingFinish } from '../types';
import { qringBle, BleLogEntry } from '../lib/qringBleService';
import { checkWarrantyForEmail, getAccountEmail, setAccountEmail } from '../lib/warrantyService';
import {
  X,
  Battery,
  User,
  Disc,
  Globe,
  Bluetooth,
  Heart,
  Bell,
  ChevronRight,
  ShieldCheck,
  Check,
  Minus,
  Plus,
  Sliders,
  Zap,
  RefreshCw,
  RotateCcw,
  Compass,
  Radio,
  Cpu,
  Palette,
  AlertTriangle,
  Info,
  CheckCircle2,
  Lock,
  Sparkles,
  Terminal,
  Copy,
  Trash2,
} from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
}

type SettingsTab = 'ring' | 'profile' | 'sensors' | 'system';

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const {
    profile,
    updateProfile,
    ring,
    updateRing,
    finish,
    setFinish,
    language,
    setLanguage,
    cardThemeMode,
    setCardThemeMode,
    t,
    openModal,
    sensorIntervals,
    updateSensorIntervals,
    resetToFactory,
  } = useApp();
  const { isClosing, handleClose } = useModalAnimation(onClose);

  const isEn = language === 'en';
  const [activeTab, setActiveTab] = useState<SettingsTab>('ring');
  const [isSyncingRing, setIsSyncingRing] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationStep, setCalibrationStep] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [accountEmail, setAccountEmailState] = useState<string | null>(() => getAccountEmail());
  const [warrantyEmailInput, setWarrantyEmailInput] = useState<string>(() => getAccountEmail() || '');
  const [showWarrantyCheck, setShowWarrantyCheck] = useState(false);
  const [isCheckingWarranty, setIsCheckingWarranty] = useState(false);
  const [showBleLogs, setShowBleLogs] = useState(false);
  const [bleLogs, setBleLogs] = useState<BleLogEntry[]>(() => qringBle.getBleLogs());
  const [copiedLogs, setCopiedLogs] = useState(false);

  useEffect(() => {
    return qringBle.subscribeLogs(setBleLogs);
  }, []);

  const isConnected = Boolean(ring.isConnected);
  const isAurelCareActive = ring.aurelCareActive === true;
  const currentFinish = finishes.find((f) => f.id === finish) || finishes[1];
  const estimatedDays = calculateEstimatedBatteryDays(sensorIntervals);
  const remainingBatteryTime = formatRemainingBatteryTime(
    ring.batteryRing || 0,
    sensorIntervals,
    isEn
  );

  // Auto-switch tab if requested via query params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('scroll') === 'radar') {
        setActiveTab('ring');
      }
    }
  }, []);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(18);
      } catch (_) {}
    }
  };

  const handleSyncRing = async () => {
    triggerHaptic();
    setIsSyncingRing(true);
    setSyncFeedback(null);
    try {
      await qringBle.syncAllRingData(true);
      setSyncFeedback(isEn ? 'Synchronized!' : 'Synchronisé !');
    } catch (_) {
      setSyncFeedback(isEn ? 'Sync finished' : 'Synchro terminée');
    } finally {
      setIsSyncingRing(false);
      setTimeout(() => setSyncFeedback(null), 2200);
    }
  };

  const handleStartCalibration = async () => {
    triggerHaptic();
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

  // BMI calculations
  const heightM = (profile.heightCm || 175) / 100;
  const bmiNum = Number((profile.weightKg / (heightM * heightM)).toFixed(1));
  const getBmiCategory = (bmi: number) => {
    if (bmi < 18.5) return { label: isEn ? 'Underweight' : 'Insuffisance pondérale', color: '#38BDF8' };
    if (bmi <= 24.9) return { label: isEn ? 'Normal weight · Optimal' : 'Corpulence normale · Optimal', color: '#30D158' };
    if (bmi <= 29.9) return { label: isEn ? 'Overweight' : 'Surpoids léger', color: '#FF9F0A' };
    return { label: isEn ? 'Obese' : 'Obésité', color: '#FF453A' };
  };
  const bmiCat = getBmiCategory(bmiNum);

  const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'ring', label: isEn ? 'Ring' : 'Bague', icon: <Disc size={13} /> },
    { id: 'profile', label: isEn ? 'Profile' : 'Profil', icon: <User size={13} /> },
    { id: 'sensors', label: isEn ? 'Sensors' : 'Capteurs', icon: <Zap size={13} /> },
    { id: 'system', label: isEn ? 'System' : 'Système', icon: <Cpu size={13} /> },
  ];

  const SENSORS_LIST = [
    {
      nameFr: 'Fréquence Cardiaque',
      nameEn: 'Heart Rate',
      descFr: 'PPG vert haute sensibilité 24/7',
      descEn: 'Green optical PPG sensor 24/7',
      key: 'heartRate' as const,
      color: '#FF2D55',
    },
    {
      nameFr: 'Variabilité Cardiaque (VRC)',
      nameEn: 'Heart Rate Variability (HRV)',
      descFr: 'Micro-intervalles R-R & tonus vagal',
      descEn: 'R-R intervals & parasympathetic tone',
      key: 'hrv' as const,
      color: '#AF52DE',
    },
    {
      nameFr: 'Oxygène Sanguin (SpO2)',
      nameEn: 'Blood Oxygen (SpO2)',
      descFr: 'LED rouge & infrarouge pulsées',
      descEn: 'Pulsed red and infrared diodes',
      key: 'spo2' as const,
      color: '#38BDF8',
    },
    {
      nameFr: 'Température Cutanée Nocturne',
      nameEn: 'Nocturnal Skin Temperature',
      descFr: 'Thermistance haute précision ±0.05°C',
      descEn: 'High-precision NTC thermistor ±0.05°C',
      key: 'temperature' as const,
      color: '#FF9F0A',
    },
    {
      nameFr: 'Niveau de Stress Physiologique',
      nameEn: 'Physiological Stress Index',
      descFr: 'Balance sympathique / parasympathique',
      descEn: 'Sympathetic / parasympathetic balance',
      key: 'stress' as const,
      color: '#FFD60A',
    },
    {
      nameFr: 'Dynamique Vasculaire & Tension',
      nameEn: 'Vascular & Pressure Wave',
      descFr: 'Analyse d’onde de pouls artérielle',
      descEn: 'Arterial pulse wave velocity analysis',
      key: 'bloodPressure' as const,
      color: '#30D158',
    },
    {
      nameFr: 'Indice Métabolique & Glucose',
      nameEn: 'Metabolic & Glucose Stability',
      descFr: 'Estimation énergétique basale continue',
      descEn: 'Continuous basal energy expenditure',
      key: 'glucose' as const,
      color: '#5E5CE6',
    },
    {
      nameFr: 'Fréquence Respiratoire Nocturne',
      nameEn: 'Nocturnal Respiratory Rate',
      descFr: 'Cycles respiratoires sinusaux (brpm)',
      descEn: 'Sinus arrhythmia breath cycles (brpm)',
      key: 'respiratory' as const,
      color: '#64D2FF',
    },
  ];

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
          position: 'relative',
          width: '100%',
          maxWidth: '430px',
          height: '92dvh',
          maxHeight: '840px',
          background: '#0B0B0E',
          borderRadius: '32px 32px 0 0',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 -20px 60px rgba(0, 0, 0, 0.95)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          gap: 0,
        }}
      >
        {/* Subtle Ambient Background Highlight */}
        <div
          style={{
            position: 'absolute',
            top: '-60px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '280px',
            height: '140px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.08) 0%, transparent 70%)',
            filter: 'blur(32px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* ==============================================================
            FIXED TOP HEADER: Grabber, Title, Close & Segmented Navigation
            ============================================================== */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            flexShrink: 0,
            padding: '12px 18px 12px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
            background: 'rgba(11, 11, 14, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* iOS Grab Handle */}
          <div
            style={{
              width: '38px',
              height: '4px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.22)',
              margin: '0 auto',
            }}
          />

          {/* Title Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '11px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Disc size={17} color="#FAF7F2" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h2
                  style={{
                    fontSize: '17px',
                    fontWeight: 700,
                    color: '#FAF7F2',
                    margin: 0,
                    letterSpacing: '-0.3px',
                  }}
                >
                  {t('settings.title')}
                </h2>
                <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.5)', fontWeight: 500 }}>
                  {isEn ? 'Aurel Ring One · Settings & Health' : 'Aurel Ring One · Réglages & Santé'}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="modal-close-btn"
              onClick={handleClose}
              aria-label={t('settings.close')}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#FAF7F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Segmented Control Bar */}
          <div
            style={{
              display: 'flex',
              padding: '3px',
              borderRadius: '13px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              gap: '3px',
            }}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setActiveTab(tab.id);
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '8px 4px',
                    borderRadius: '10px',
                    background: isActive ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                    border: isActive ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid transparent',
                    color: isActive ? '#FAF7F2' : 'rgba(250, 247, 242, 0.5)',
                    fontSize: '11.5px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.4)' : 'none',
                  }}
                >
                  <span style={{ opacity: isActive ? 1 : 0.7 }}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ==============================================================
            SCROLLABLE CONTENT AREA
            ============================================================== */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '16px 18px 40px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* ==========================================================
              TAB 1: BAGUE & MATÉRIEL (HARDWARE & BLE)
              ========================================================== */}
          {activeTab === 'ring' && (
            <>
              {/* 1. Hero Ring Card */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  padding: '16px',
                  borderRadius: '24px',
                  background: 'linear-gradient(180deg, #131317 0%, #0E0E12 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.65)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                {/* Status Bar & Sync Action */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      triggerHaptic();
                      if (!isConnected) {
                        const success = await qringBle.autoConnectSavedDevice();
                        if (!success) {
                          onClose();
                          openModal('pairing');
                        }
                      }
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: isConnected ? 'rgba(48, 209, 88, 0.14)' : 'rgba(255, 69, 58, 0.14)',
                      border: isConnected ? '1px solid rgba(48, 209, 88, 0.4)' : '1px solid rgba(255, 69, 58, 0.4)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span
                      style={{
                        width: '6.5px',
                        height: '6.5px',
                        borderRadius: '50%',
                        background: isConnected ? '#30D158' : '#FF453A',
                        boxShadow: isConnected ? '0 0 8px #30D158' : '0 0 8px #FF453A',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: isConnected ? '#30D158' : '#FF453A',
                      }}
                    >
                      {isConnected
                        ? (isEn ? 'Connected' : 'Bague Connectée')
                        : (isEn ? 'Disconnected' : 'Non Connectée')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncRing}
                    disabled={isSyncingRing}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: isSyncingRing ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.06)',
                      border: isSyncingRing ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                      cursor: isSyncingRing ? 'default' : 'pointer',
                      color: isSyncingRing ? '#38BDF8' : 'rgba(250, 247, 242, 0.8)',
                      fontSize: '11px',
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <RefreshCw
                      size={11}
                      style={{
                        transform: isSyncingRing ? 'rotate(360deg)' : 'none',
                        transition: isSyncingRing ? 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                      }}
                    />
                    <span>
                      {syncFeedback
                        ? syncFeedback
                        : isSyncingRing
                        ? (isEn ? 'Syncing...' : 'Synchro...')
                        : (isEn ? 'Sync now' : 'Synchroniser')}
                    </span>
                  </button>
                </div>

                {/* Battery & 3D Ring Display */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '100px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '58%' }}>
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

                    <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '3px' }}>
                      <span
                        style={{
                          fontSize: '44px',
                          fontWeight: 300,
                          color: (ring.batteryRing || 0) <= 15 ? '#FF453A' : '#FAF7F2',
                          lineHeight: 1,
                          letterSpacing: '-1.5px',
                        }}
                      >
                        {isConnected && (ring.batteryRing || 0) > 0 ? `${ring.batteryRing}%` : '--'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '160px',
                        height: '5px',
                        borderRadius: '999px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        overflow: 'hidden',
                        marginTop: '3px',
                      }}
                    >
                      <div
                        style={{
                          width: isConnected && ring.batteryRing > 0 ? `${ring.batteryRing}%` : '0%',
                          height: '100%',
                          borderRadius: '999px',
                          background:
                            ring.batteryRing <= 20
                              ? 'linear-gradient(90deg, #FF453A, #FF9F0A)'
                              : 'linear-gradient(90deg, #30D158, #34C759)',
                          boxShadow:
                            ring.batteryRing <= 20
                              ? '0 0 10px rgba(255, 69, 58, 0.5)'
                              : '0 0 10px rgba(48, 209, 88, 0.4)',
                        }}
                      />
                    </div>

                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: !isConnected
                          ? 'rgba(250, 247, 242, 0.45)'
                          : (ring.batteryRing || 0) <= 15
                          ? '#FF453A'
                          : 'rgba(250, 247, 242, 0.7)',
                        marginTop: '4px',
                      }}
                    >
                      {isConnected && ring.batteryRing > 0
                        ? remainingBatteryTime
                        : (isEn ? 'Ring disconnected' : 'Bague non connectée')}
                    </span>
                  </div>

                  {/* 3D Isometric Ring Render */}
                  <div
                    style={{
                      width: '128px',
                      height: '108px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <img
                      src="/assets/ring/ring-iso-transparent.png"
                      alt="Aurel Ring One Smart Ring"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        transform: 'scale(1.15)',
                        filter: currentFinish.imgFilter + ' drop-shadow(0 14px 26px rgba(0, 0, 0, 0.95))',
                        transition: 'filter 0.25s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Quick Hardware Action Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      onClose();
                      openModal('pairing');
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '13px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#FAF7F2',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Bluetooth size={14} color="#38BDF8" />
                    <span>{isEn ? 'Pair / Scan' : 'Appairer la bague'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      openModal('find_my');
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '13px',
                      background: 'rgba(48, 209, 88, 0.12)',
                      border: '1px solid rgba(48, 209, 88, 0.3)',
                      color: '#30D158',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Radio size={14} color="#30D158" />
                    <span>{isEn ? 'Find My Ring' : 'Radar Localiser'}</span>
                  </button>
                </div>
              </div>

              {/* 2. Finition de la Bague (Finish Options) */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Palette size={14} color="#FAF7F2" />
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#FAF7F2' }}>
                      {isEn ? 'Ring Finish' : 'Finition du Titane'}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)', fontWeight: 500 }}>
                    {currentFinish.label}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {finishes.map((f) => {
                    const isSelected = finish === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          setFinish(f.id);
                        }}
                        style={{
                          padding: '8px 4px',
                          borderRadius: '12px',
                          background: isSelected ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                          border: isSelected ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: f.swatch,
                            boxShadow: isSelected ? '0 0 10px rgba(255, 255, 255, 0.5)' : 'none',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '9.5px',
                            color: isSelected ? '#FAF7F2' : 'rgba(250, 247, 242, 0.5)',
                            fontWeight: isSelected ? 700 : 500,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {f.label.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Diagnostics & Calibrage de Port */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sliders size={14} color="#30D158" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAF7F2' }}>
                      {isEn ? 'Wear Calibration' : 'Calibrage du Port'}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#30D158',
                      background: 'rgba(48, 209, 88, 0.14)',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {ring.wearCalibrationScore && ring.wearCalibrationScore > 0
                      ? `${ring.wearCalibrationScore}% OPTIMAL`
                      : (isEn ? 'Not calibrated' : 'Non calibré')}
                  </span>
                </div>

                <p style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)', lineHeight: 1.45, margin: 0 }}>
                  {isEn
                    ? 'Calibrates optical PPG sensor contact impedance and microvascular alignment against your skin.'
                    : 'Calibre le couplage optique PPG et l’impédance cutanée pour une fidélité biométrique maximale.'}
                </p>

                {isCalibrating && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: 'rgba(0, 0, 0, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#FAF7F2' }}>
                      <span>{calibrationStep}</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{calibrationProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.12)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${calibrationProgress}%`,
                          height: '100%',
                          background: '#30D158',
                          transition: 'width 0.25s ease',
                          boxShadow: '0 0 8px rgba(48, 209, 88, 0.6)',
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
                    background: isCalibrating ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#FAF7F2',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: isCalibrating ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <RefreshCw size={12} className={isCalibrating ? 'spin' : ''} />
                  <span>
                    {isCalibrating
                      ? (isEn ? 'Calibrating PPG...' : 'Calibrage en cours...')
                      : (isEn ? 'Run Calibration (15s)' : 'Lancer le calibrage de port')}
                  </span>
                </button>
              </div>

              {/* 4. Garantie AUREL CARE (vérifiée selon l'e-mail du compte) */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '18px',
                  background: isAurelCareActive ? 'rgba(48, 209, 88, 0.06)' : 'rgba(255, 255, 255, 0.03)',
                  border: isAurelCareActive ? '1px solid rgba(48, 209, 88, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'all 0.18s ease',
                }}
              >
                <div
                  onClick={() => {
                    triggerHaptic();
                    setShowWarrantyCheck((prev) => !prev);
                  }}
                  role="button"
                  tabIndex={0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '9px',
                        background: isAurelCareActive ? 'rgba(48, 209, 88, 0.16)' : 'rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <ShieldCheck size={16} color={isAurelCareActive ? '#30D158' : 'rgba(250, 247, 242, 0.5)'} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#FAF7F2' }}>
                        {isEn ? 'AUREL CARE Warranty' : 'Garantie AUREL CARE'}
                      </span>
                      <span
                        style={{
                          fontSize: '10.5px',
                          color: 'rgba(250, 247, 242, 0.52)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {isAurelCareActive
                          ? (isEn
                              ? `Active · ${accountEmail}${ring.aurelCareExpires ? ` (until ${ring.aurelCareExpires})` : ''}`
                              : `Active · ${accountEmail}${ring.aurelCareExpires ? ` (jusqu'en ${ring.aurelCareExpires})` : ''}`)
                          : accountEmail
                          ? (isEn ? `No coverage linked to ${accountEmail}` : `Aucune couverture pour ${accountEmail}`)
                          : (isEn ? 'No email linked · Tap to check' : 'Aucun e-mail lié · Toucher pour vérifier')}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: isAurelCareActive ? '#30D158' : 'rgba(250, 247, 242, 0.5)',
                      background: isAurelCareActive ? 'rgba(48, 209, 88, 0.16)' : 'rgba(255, 255, 255, 0.06)',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      flexShrink: 0,
                    }}
                  >
                    {isAurelCareActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                {showWarrantyCheck && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <input
                      type="email"
                      value={warrantyEmailInput}
                      onChange={(e) => setWarrantyEmailInput(e.target.value)}
                      placeholder={isEn ? 'Purchase email...' : 'E-mail d’achat...'}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: '8px 10px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#FAF7F2',
                        fontSize: '12px',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      disabled={isCheckingWarranty}
                      onClick={async () => {
                        triggerHaptic();
                        const trimmed = warrantyEmailInput.trim().toLowerCase();
                        setIsCheckingWarranty(true);
                        setAccountEmail(trimmed || null);
                        setAccountEmailState(trimmed || null);
                        const w = await checkWarrantyForEmail(trimmed || null);
                        updateRing({
                          aurelCareActive: w.active,
                          aurelCareExpires: w.expiresAt || '',
                        });
                        setIsCheckingWarranty(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'rgba(255, 255, 255, 0.14)',
                        color: '#FAF7F2',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {isCheckingWarranty ? '...' : (isEn ? 'Check' : 'Vérifier')}
                    </button>
                  </div>
                )}
              </div>

              {/* 5. Hardware Specifications */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '18px',
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '11px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(250, 247, 242, 0.5)' }}>
                  <span>{isEn ? 'Model' : 'Modèle'}</span>
                  <span style={{ color: '#FAF7F2', fontWeight: 600 }}>Aurel Ring One</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(250, 247, 242, 0.5)' }}>
                  <span>{isEn ? 'Serial Number' : 'Numéro de Série'}</span>
                  <span style={{ color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>{ring.serial || 'AR01-GM-99841'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(250, 247, 242, 0.5)' }}>
                  <span>{isEn ? 'BLE MAC Address' : 'Adresse MAC BLE'}</span>
                  <span style={{ color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>{ring.macAddress || 'C8:2B:96:4A:99:84'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(250, 247, 242, 0.5)' }}>
                  <span>{isEn ? 'Publisher' : 'Société éditrice'}</span>
                  <span style={{ color: '#FAF7F2', fontWeight: 600 }}>Aurel Labs LLC (New Mexico, USA)</span>
                </div>
              </div>

              {/* 6. Moniteur BLE Temporaire (tout ce que la bague envoie / reçoit) */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '18px',
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div
                  onClick={() => {
                    triggerHaptic();
                    setShowBleLogs((v) => !v);
                  }}
                  role="button"
                  tabIndex={0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Terminal size={14} color="#38BDF8" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#FAF7F2' }}>
                      {isEn ? 'Live Ring BLE Monitor (Temp)' : 'Activité Bluetooth de la bague (Temp)'}
                    </span>
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.55)', fontFamily: 'var(--font-mono)' }}>
                    {bleLogs.length} {showBleLogs ? '▾' : '▸'}
                  </span>
                </div>

                {showBleLogs && (
                  <>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          qringBle.querySensorConfigs();
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '9px',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          background: 'rgba(56, 189, 248, 0.14)',
                          color: '#38BDF8',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {isEn ? 'Read Ring Config' : 'Lire config bague'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          triggerHaptic();
                          const text = bleLogs
                            .map((l) => `[${l.time}] ${l.dir} ${l.summary}${l.hex ? ` | ${l.hex}` : ''}`)
                            .join('\n');
                          try {
                            await navigator.clipboard.writeText(text);
                            setCopiedLogs(true);
                            setTimeout(() => setCopiedLogs(false), 1800);
                          } catch (_) {}
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '9px',
                          border: '1px solid rgba(255, 255, 255, 0.14)',
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: '#FAF7F2',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {copiedLogs ? <Check size={12} color="#30D158" /> : <Copy size={12} />}
                        {copiedLogs ? (isEn ? 'Copied!' : 'Copié !') : (isEn ? 'Copy' : 'Copier')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          qringBle.clearBleLogs();
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '9px',
                          border: '1px solid rgba(255, 69, 58, 0.25)',
                          background: 'rgba(255, 69, 58, 0.1)',
                          color: '#FF6961',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Trash2 size={11} />
                        {isEn ? 'Clear' : 'Effacer'}
                      </button>
                    </div>

                    <div
                      style={{
                        maxHeight: '220px',
                        overflowY: 'auto',
                        background: '#050608',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                      }}
                    >
                      {bleLogs.length === 0 ? (
                        <span style={{ color: 'rgba(250, 247, 242, 0.4)' }}>
                          {isEn ? 'No BLE activity recorded yet.' : 'Aucune trame BLE enregistrée pour le moment.'}
                        </span>
                      ) : (
                        bleLogs.map((log) => {
                          const dirColor =
                            log.dir === 'RX' ? '#30D158' : log.dir === 'TX' ? '#FBBF24' : '#38BDF8';
                          return (
                            <div
                              key={log.id}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1px',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                paddingBottom: '4px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: 'rgba(250, 247, 242, 0.4)' }}>{log.time}</span>
                                <span style={{ color: dirColor, fontWeight: 700 }}>{log.dir}</span>
                                <span style={{ color: '#FAF7F2', wordBreak: 'break-word' }}>{log.summary}</span>
                              </div>
                              {log.hex && (
                                <span style={{ color: 'rgba(250, 247, 242, 0.35)', fontSize: '9px', paddingLeft: '62px' }}>
                                  {log.hex}
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* ==========================================================
              TAB 2: PROFIL BIOMÉTRIQUE & MORPHOLOGIE
              ========================================================== */}
          {activeTab === 'profile' && (
            <>
              {/* Sexe Biologique Switcher */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={14} color="#A78BFA" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAF7F2' }}>
                      {isEn ? 'Biological Sex' : 'Sexe Biologique'}
                    </span>
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.45)' }}>
                    {isEn ? 'Calibrates metabolic baselines' : 'Calibre le métabolisme'}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    padding: '4px',
                    borderRadius: '13px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      updateProfile({ sex: 'homme' });
                    }}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '10px',
                      background: profile.sex === 'homme' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                      border: profile.sex === 'homme' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
                      color: profile.sex === 'homme' ? '#FAF7F2' : 'rgba(250, 247, 242, 0.5)',
                      fontSize: '12.5px',
                      fontWeight: profile.sex === 'homme' ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {profile.sex === 'homme' && <Check size={13} strokeWidth={2.4} />}
                    <span>{t('settings.male')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      updateProfile({ sex: 'femme' });
                    }}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '10px',
                      background: profile.sex === 'femme' ? 'rgba(232, 121, 249, 0.16)' : 'transparent',
                      border: profile.sex === 'femme' ? '1px solid rgba(232, 121, 249, 0.4)' : '1px solid transparent',
                      color: profile.sex === 'femme' ? '#E879F9' : 'rgba(250, 247, 242, 0.5)',
                      fontSize: '12.5px',
                      fontWeight: profile.sex === 'femme' ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {profile.sex === 'femme' && <Check size={13} strokeWidth={2.4} />}
                    <span>{t('settings.female')}</span>
                  </button>
                </div>

                {profile.sex === 'femme' && (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '10px',
                      background: 'rgba(232, 121, 249, 0.08)',
                      border: '1px solid rgba(232, 121, 249, 0.2)',
                      fontSize: '10.5px',
                      color: '#E879F9',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Sparkles size={12} />
                    <span>
                      {isEn
                        ? 'Female Cycle tracking and basal temperature tracking unlocked.'
                        : 'Suivi du cycle féminin et analyse thermique basale activés.'}
                    </span>
                  </div>
                )}
              </div>

              {/* 2x2 Bento Grid: Prénom, Âge, Taille, Poids */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {/* Prénom */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.035)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.5)', textTransform: 'uppercase' }}>
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
                    background: 'rgba(255, 255, 255, 0.035)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.5)', textTransform: 'uppercase' }}>
                      {t('settings.age')}
                    </span>
                    <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.4)' }}>{isEn ? 'yrs' : 'ans'}</span>
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
                    background: 'rgba(255, 255, 255, 0.035)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.5)', textTransform: 'uppercase' }}>
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
                    background: 'rgba(255, 255, 255, 0.035)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.5)', textTransform: 'uppercase' }}>
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

              {/* Dynamic BMI Card */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.5)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {isEn ? 'Body Mass Index (BMI)' : 'Indice de Masse Corporelle (IMC)'}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: bmiCat.color }}>
                    {bmiCat.label}
                  </span>
                </div>

                <div
                  style={{
                    padding: '6px 12px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#FAF7F2',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {bmiNum}
                </div>
              </div>

              {/* Ring Size Stepper */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#FAF7F2' }}>
                    {isEn ? 'Aurel Ring Size (US)' : 'Taille de bague Aurel (US)'}
                  </span>
                  <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.45)' }}>
                    {isEn ? 'Index or middle finger recommended' : 'Ajustement index ou majeur recommandé'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      updateRing({ ringSize: Math.max(6, ring.ringSize - 1) });
                    }}
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '9px',
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
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#FAF7F2',
                      fontFamily: 'var(--font-mono)',
                      minWidth: '24px',
                      textAlign: 'center',
                    }}
                  >
                    {ring.ringSize}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      updateRing({ ringSize: Math.min(14, ring.ringSize + 1) });
                    }}
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '9px',
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
            </>
          )}

          {/* ==========================================================
              TAB 3: CAPTEURS BIOMÉTRIQUES & AUTONOMIE
              ========================================================== */}
          {activeTab === 'sensors' && (
            <>
              {/* Presets d'autonomie Card */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '22px',
                  background: 'linear-gradient(180deg, #131317 0%, #0E0E12 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={14} color="#30D158" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAF7F2' }}>
                      {isEn ? 'Sampling Frequency & Battery' : 'Fréquence de Mesure & Autonomie'}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#30D158',
                      background: 'rgba(48, 209, 88, 0.14)',
                      padding: '3px 8px',
                      borderRadius: '999px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    ~{estimatedDays} {isEn ? 'days autonomy' : 'jours d’autonomie'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {[
                    {
                      id: '1h',
                      title: isEn ? 'Balanced' : 'Équilibré',
                      sub: '1h · ~8j',
                      isActive: sensorIntervals?.heartRate === '1h',
                      action: () => {
                        triggerHaptic();
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
                        qringBle.setAllSensorIntervals(60);
                      },
                    },
                    {
                      id: '30min',
                      title: isEn ? 'Precision' : 'Précision',
                      sub: '30m · ~5j',
                      isActive: (sensorIntervals?.heartRate || '30min') === '30min',
                      action: () => {
                        triggerHaptic();
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
                        qringBle.setAllSensorIntervals(30);
                      },
                    },
                    {
                      id: 'pause',
                      title: isEn ? 'Standby' : 'Veille',
                      sub: '0 LED',
                      isActive: (sensorIntervals?.heartRate as string) === 'pause',
                      action: () => {
                        triggerHaptic();
                        updateSensorIntervals({
                          heartRate: 'pause' as any,
                          hrv: 'pause' as any,
                          spo2: 'pause' as any,
                          temperature: 'pause' as any,
                          stress: 'pause' as any,
                          bloodPressure: 'pause' as any,
                          glucose: 'pause' as any,
                          respiratory: 'pause' as any,
                        });
                        qringBle.setAllSensorIntervals(0);
                      },
                    },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={preset.action}
                      style={{
                        padding: '10px 6px',
                        borderRadius: '12px',
                        background: preset.isActive ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                        border: preset.isActive ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid rgba(255, 255, 255, 0.06)',
                        color: preset.isActive ? '#FAF7F2' : 'rgba(250, 247, 242, 0.6)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '3px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: preset.isActive ? 700 : 500 }}>
                        {preset.title}
                      </span>
                      <span style={{ fontSize: '9.5px', color: preset.isActive ? '#30D158' : 'rgba(250, 247, 242, 0.45)', fontFamily: 'var(--font-mono)' }}>
                        {preset.sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Les 8 Capteurs Actifs List */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(250, 247, 242, 0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {isEn ? 'Active Biometric Sensors (8)' : 'Les 8 Capteurs Biométriques Actifs'}
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {SENSORS_LIST.map((s) => (
                    <div
                      key={s.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '12px',
                        background: 'rgba(255, 255, 255, 0.025)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: s.color,
                            boxShadow: `0 0 6px ${s.color}`,
                          }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#FAF7F2' }}>
                            {isEn ? s.nameEn : s.nameFr}
                          </span>
                          <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.45)' }}>
                            {isEn ? s.descEn : s.descFr}
                          </span>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '10px',
                          color: '#FAF7F2',
                          fontFamily: 'var(--font-mono)',
                          background: 'rgba(255, 255, 255, 0.06)',
                          padding: '2px 6px',
                          borderRadius: '6px',
                        }}
                      >
                        {sensorIntervals?.[s.key] || '30min'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ==========================================================
              TAB 4: SYSTÈME, ÉCOSYSTÈME & PRÉFÉRENCES
              ========================================================== */}
          {activeTab === 'system' && (
            <>
              {/* Écosystème Connecté (HealthKit & APNs) */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(250, 247, 242, 0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {isEn ? 'Connected Ecosystem' : 'Écosystème & Passerelles'}
                </span>

                {/* Apple Santé / HealthKit */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    onClose();
                    openModal('healthkit');
                  }}
                  style={{
                    width: '100%',
                    padding: '11px 12px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.035)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '9px',
                        background: 'rgba(255, 45, 85, 0.15)',
                        border: '1px solid rgba(255, 45, 85, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Heart size={15} color="#FF2D55" fill="#FF2D55" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#FAF7F2' }}>
                        {isEn ? 'Apple Health (HealthKit)' : 'Pont Apple Santé & Forme'}
                      </span>
                      <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.5)' }}>
                        {isEn ? 'Bidirectional sync active' : 'Synchronisation temps réel'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={15} color="rgba(250, 247, 242, 0.4)" />
                </button>

                {/* Notifications & Push Alerts */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    onClose();
                    openModal('notifications');
                  }}
                  style={{
                    width: '100%',
                    padding: '11px 12px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.035)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '9px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Bell size={15} color="#38BDF8" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#FAF7F2' }}>
                        {isEn ? 'Biometric Notifications' : 'Alertes & Notifications'}
                      </span>
                      <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.5)' }}>
                        {isEn ? 'HRV, Temp & Battery alerts' : 'Seuils VRC, Température & Batterie'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={15} color="rgba(250, 247, 242, 0.4)" />
                </button>
              </div>

              {/* App Visual Style & Language */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                {/* Glow Theme Mode */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.6)' }}>
                    {isEn ? 'Biometric Cards Visual Style' : 'Style Visuel des Constantes'}
                  </span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      padding: '4px',
                      borderRadius: '13px',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setCardThemeMode('colored');
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: cardThemeMode === 'colored' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                        border: cardThemeMode === 'colored' ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid transparent',
                        color: cardThemeMode === 'colored' ? '#FAF7F2' : 'rgba(250, 247, 242, 0.5)',
                        fontSize: '11.5px',
                        fontWeight: cardThemeMode === 'colored' ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isEn ? 'Colored Glow ✨' : 'Coloré ✨'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setCardThemeMode('monochrome');
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: cardThemeMode === 'monochrome' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                        border: cardThemeMode === 'monochrome' ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid transparent',
                        color: cardThemeMode === 'monochrome' ? '#FAF7F2' : 'rgba(250, 247, 242, 0.5)',
                        fontSize: '11.5px',
                        fontWeight: cardThemeMode === 'monochrome' ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isEn ? 'Monochrome' : 'Noir & Blanc'}
                    </button>
                  </div>
                </div>

                {/* App Language */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.6)' }}>
                    {isEn ? 'Language' : 'Langue de l’application'}
                  </span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      padding: '4px',
                      borderRadius: '13px',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setLanguage('fr');
                      }}
                      style={{
                        padding: '9px 12px',
                        borderRadius: '10px',
                        background: language === 'fr' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                        border: language === 'fr' ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid transparent',
                        color: language === 'fr' ? '#FAF7F2' : 'rgba(250, 247, 242, 0.5)',
                        fontSize: '12px',
                        fontWeight: language === 'fr' ? 700 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>🇫🇷</span>
                      <span>Français</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setLanguage('en');
                      }}
                      style={{
                        padding: '9px 12px',
                        borderRadius: '10px',
                        background: language === 'en' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                        border: language === 'en' ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid transparent',
                        color: language === 'en' ? '#FAF7F2' : 'rgba(250, 247, 242, 0.5)',
                        fontSize: '12px',
                        fontWeight: language === 'en' ? 700 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>🇬🇧</span>
                      <span>English</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Maintenance & Reset */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '20px',
                  background: 'rgba(255, 69, 58, 0.05)',
                  border: '1px solid rgba(255, 69, 58, 0.18)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <RotateCcw size={14} color="#FF453A" />
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#FF453A' }}>
                    {isEn ? 'Device & App Reset' : 'Maintenance & Réinitialisation'}
                  </span>
                </div>

                <p style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)', lineHeight: 1.4, margin: 0 }}>
                  {isEn
                    ? 'Clears on-device biometric cache and resets app settings to pristine factory state.'
                    : 'Efface le cache local et remet l’application à zéro comme au premier déballage.'}
                </p>

                {showResetConfirm ? (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      style={{
                        flex: 1,
                        padding: '9px',
                        borderRadius: '11px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#FAF7F2',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {isEn ? 'Cancel' : 'Annuler'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        resetToFactory();
                      }}
                      style={{
                        flex: 1,
                        padding: '9px',
                        borderRadius: '11px',
                        background: '#FF453A',
                        border: 'none',
                        color: '#FFFFFF',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {isEn ? 'Confirm Reset' : 'Confirmer'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setShowResetConfirm(true);
                    }}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '11px',
                      background: 'rgba(255, 69, 58, 0.14)',
                      border: '1px solid rgba(255, 69, 58, 0.3)',
                      color: '#FF453A',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      marginTop: '4px',
                    }}
                  >
                    <RotateCcw size={12} />
                    <span>{isEn ? 'Factory Reset' : 'Remise à Zéro de l’Application'}</span>
                  </button>
                )}
              </div>

              {/* Local Security Vault Footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '10.5px',
                  color: 'rgba(250, 247, 242, 0.4)',
                  padding: '8px 0',
                }}
              >
                <Lock size={12} color="rgba(250, 247, 242, 0.5)" />
                <span>
                  {isEn
                    ? 'Aurel Labs LLC (New Mexico, USA) · Zero Subscription'
                    : 'Aurel Labs LLC (New Mexico, USA) · Modèle Zéro Abonnement'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
