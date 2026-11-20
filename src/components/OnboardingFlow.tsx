import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { BiologicalSex } from '../types';
import { qringBle, DiscoveredBleDevice, formatRingDisplayName } from '../lib/qringBleService';
import { checkWarrantyForEmail, setAccountEmail } from '../lib/warrantyService';
import { requestBrowserNotificationPermission } from '../lib/apnsService';
import { setHealthKitAuthorization, syncWithHealthKit } from '../lib/appleHealthKit';
import { computeRecommendedDailyTargets, saveDailyTargets } from '../lib/calAiService';
import {
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ShieldCheck,
  Activity,
  Bluetooth,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  Radio,
  Disc,
  Info,
  Heart,
  Bell,
  MapPin,
  Minus,
  Plus,
  Check,
  Scale,
  Ruler,
  Calendar,
} from 'lucide-react';

interface OnboardingFlowProps {
  onComplete: () => void;
}

type OnboardingStep =
  | 'welcome'
  | 'sex'
  | 'age'
  | 'height'
  | 'weight'
  | 'permissions'
  | 'healthkit'
  | 'account'
  | 'dock'
  | 'no-ring';

const SETUP_FLOW: OnboardingStep[] = [
  'sex',
  'age',
  'height',
  'weight',
  'permissions',
  'healthkit',
  'account',
  'dock',
];

const SLIDE_VARIANTS = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? 28 : -28,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? -24 : 24,
  }),
};

const SLIDE_TRANSITION = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 32,
  mass: 0.85,
};

type PermissionStatus = 'idle' | 'granted' | 'denied' | 'pending';

interface NumericStepConfig {
  step: 'age' | 'height' | 'weight';
  eyebrow: string;
  title: string;
  subtitle: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  presets: number[];
  badgeLabel: string;
  icon: React.ReactNode;
  onChange: (next: number) => void;
  onContinue: () => void;
}

const HEALTHKIT_PREVIEW_ITEMS = [
  { label: 'Variabilité (VRC)', sub: 'Récupération nerveuse' },
  { label: 'FC au repos', sub: 'Santé cardiaque' },
  { label: 'Phases de sommeil', sub: 'Profond, REM, Léger' },
  { label: 'Température cutanée', sub: 'Variations nocturnes' },
  { label: 'Oxygénation SpO2', sub: 'Respiration nocturne' },
  { label: 'Pas & Calories actives', sub: 'Anneaux Apple Fitness' },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { profile, updateProfile, updateRing, setIsPaired } = useApp();

  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [direction, setDirection] = useState<number>(1);

  // Quiz Profil Biométrique
  const [sex, setSex] = useState<BiologicalSex>(profile.sex || 'homme');
  const [age, setAge] = useState<number>(profile.age > 0 ? profile.age : 28);
  const [heightCm, setHeightCm] = useState<number>(profile.heightCm > 0 ? profile.heightCm : 180);
  const [weightKg, setWeightKg] = useState<number>(profile.weightKg > 0 ? profile.weightKg : 75);

  // Étape Autorisations
  const [blePerm, setBlePerm] = useState<PermissionStatus>('idle');
  const [notifPerm, setNotifPerm] = useState<PermissionStatus>('idle');
  const [locPerm, setLocPerm] = useState<PermissionStatus>('idle');
  const [isRequestingPerms, setIsRequestingPerms] = useState<boolean>(false);

  // Étape Apple Santé
  const [isSyncingHealthKit, setIsSyncingHealthKit] = useState<boolean>(false);

  // Étape Compte
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [firstName, setFirstName] = useState<string>(profile.firstName || '');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Étape Dock & Bluetooth
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredBleDevice[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);
  const [bleError, setBleError] = useState<string | null>(null);

  const triggerHaptic = (ms = 20) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch (_) {}
    }
  };

  const navigateTo = (target: OnboardingStep, dir: 1 | -1 = 1) => {
    setDirection(dir);
    setStep(target);
  };

  const goBackFromSetup = () => {
    triggerHaptic();
    const idx = SETUP_FLOW.indexOf(step);
    if (idx <= 0) {
      navigateTo('welcome', -1);
      return;
    }
    navigateTo(SETUP_FLOW[idx - 1], -1);
  };

  const persistBiometricProfileAndTargets = () => {
    updateProfile({
      sex,
      age,
      heightCm,
      weightKg,
    });
    const recommended = computeRecommendedDailyTargets({
      sex,
      age,
      heightCm,
      weightKg,
    });
    saveDailyTargets(recommended);
  };

  const requestBleAccess = async (): Promise<boolean> => {
    setBlePerm('pending');
    const res = await qringBle.requestBluetoothPermission();
    setBlePerm(res.granted ? 'granted' : 'denied');
    return res.granted;
  };

  const requestNotifAccess = async (): Promise<boolean> => {
    setNotifPerm('pending');
    const granted = await requestBrowserNotificationPermission();
    setNotifPerm(granted ? 'granted' : 'denied');
    return granted;
  };

  const requestLocationAccess = (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setLocPerm('denied');
      return Promise.resolve(false);
    }
    setLocPerm('pending');
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          setLocPerm('granted');
          resolve(true);
        },
        () => {
          setLocPerm('denied');
          resolve(false);
        },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
      );
    });
  };

  const handleRequestAllPermissionsAndContinue = async () => {
    if (isRequestingPerms) return;
    triggerHaptic();
    setIsRequestingPerms(true);
    try {
      if (blePerm !== 'granted') await requestBleAccess();
      if (notifPerm !== 'granted') await requestNotifAccess();
      if (locPerm !== 'granted') await requestLocationAccess();
    } finally {
      setIsRequestingPerms(false);
      navigateTo('healthkit', 1);
    }
  };

  const handleEnableHealthKit = () => {
    if (isSyncingHealthKit) return;
    triggerHaptic(30);
    setIsSyncingHealthKit(true);
    setHealthKitAuthorization(true);
    syncWithHealthKit();
    setTimeout(() => {
      setIsSyncingHealthKit(false);
      navigateTo('account', 1);
    }, 500);
  };

  const handleSkipHealthKit = () => {
    triggerHaptic();
    setHealthKitAuthorization(false);
    navigateTo('account', 1);
  };

  // Scan Bluetooth automatique dès l'arrivée sur l'écran Dock de charge
  useEffect(() => {
    if (step !== 'dock') {
      qringBle.stopScan().catch(() => {});
      return;
    }

    let isMounted = true;
    setBleError(null);
    setIsScanning(true);

    const unsub = qringBle.onDeviceDiscovered((dev) => {
      if (!isMounted) return;
      setDiscoveredDevices((prev) => {
        const existingIdx = prev.findIndex((p) => p.deviceId === dev.deviceId);
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = dev;
          return updated;
        }
        return dev.isRing ? [dev, ...prev] : [...prev, dev];
      });
    });

    qringBle.startDiscoveryScan().then((res) => {
      if (!isMounted) return;
      if (!res.success && res.error) {
        setBleError(res.error);
        setIsScanning(false);
      }
    });

    return () => {
      isMounted = false;
      unsub();
      qringBle.stopScan().catch(() => {});
    };
  }, [step]);

  const handleRefreshScan = async () => {
    triggerHaptic();
    setBleError(null);
    setIsScanning(true);
    setDiscoveredDevices([]);
    const res = await qringBle.startDiscoveryScan();
    if (!res.success && res.error) {
      setBleError(res.error);
      setIsScanning(false);
    }
  };

  const handleNativeWebScan = async () => {
    triggerHaptic();
    setBleError(null);
    setIsScanning(true);
    try {
      const res = await qringBle.requestAndConnect();
      if (res.success) {
        setConnectedDeviceName(formatRingDisplayName(res.deviceName, true));
        updateRing({
          isConnected: true,
          ...(res.battery && res.battery > 0 ? { batteryRing: res.battery } : {}),
        });
        setTimeout(() => {
          setIsPaired(true);
          onComplete();
        }, 850);
      } else {
        setIsScanning(false);
        if (res.error) setBleError(res.error);
      }
    } catch (_) {
      setIsScanning(false);
      setBleError('Impossible de lancer la détection Bluetooth.');
    }
  };

  const handleSelectDevice = async (dev: DiscoveredBleDevice) => {
    if (connectingDeviceId || connectedDeviceName) return;
    triggerHaptic();
    setBleError(null);
    setConnectingDeviceId(dev.deviceId);

    try {
      await qringBle.stopScan();
      const res = await qringBle.connectDirectly(dev.deviceId, dev.name);
      if (res.success) {
        setConnectedDeviceName(formatRingDisplayName(res.deviceName || dev.name, true));
        setConnectingDeviceId(null);
        triggerHaptic(35);
        updateRing({
          isConnected: true,
          ...(res.battery && res.battery > 0 ? { batteryRing: res.battery } : {}),
        });
        setTimeout(() => {
          setIsPaired(true);
          onComplete();
        }, 850);
      } else {
        setConnectingDeviceId(null);
        setBleError(res.error || 'Échec de connexion à cette bague.');
      }
    } catch (_) {
      setConnectingDeviceId(null);
      setBleError('Erreur lors de la connexion Bluetooth.');
    }
  };

  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!email.trim() || !email.includes('@')) {
      setAuthError('Veuillez saisir une adresse e-mail valide.');
      return;
    }
    if (password.length < 4) {
      setAuthError('Le mot de passe doit contenir au moins 4 caractères.');
      return;
    }

    triggerHaptic();
    if (authMode === 'signup' && firstName.trim()) {
      updateProfile({ firstName: firstName.trim() });
    } else if (!profile.firstName) {
      const inferredName = email.split('@')[0];
      updateProfile({
        firstName: inferredName.charAt(0).toUpperCase() + inferredName.slice(1),
      });
    }
    setAccountEmail(email);
    checkWarrantyForEmail(email).then((w) => {
      updateRing({
        aurelCareActive: w.active,
        aurelCareExpires: w.expiresAt || '',
      });
    });

    navigateTo('dock', 1);
  };

  const handleSkipAccount = () => {
    triggerHaptic();
    updateRing({ aurelCareActive: false, aurelCareExpires: '' });
    navigateTo('dock', 1);
  };

  const setupIndex = SETUP_FLOW.indexOf(step);
  const progressPct = setupIndex >= 0 ? Math.round(((setupIndex + 1) / SETUP_FLOW.length) * 100) : 0;
  const recommendedTargets = computeRecommendedDailyTargets({ sex, age, heightCm, weightKg });
  const bmi = (weightKg / Math.pow(Math.max(1.2, heightCm / 100), 2)).toFixed(1);

  const renderProgressChrome = (rightAction?: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
      <button
        type="button"
        onClick={goBackFromSetup}
        aria-label="Retour"
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#FAF7F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <ChevronLeft size={18} />
      </button>

      <div
        style={{
          flex: 1,
          height: '5px',
          borderRadius: '999px',
          background: 'rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{
            height: '100%',
            borderRadius: '999px',
            background: 'linear-gradient(90deg, #FAF7F2 0%, #38BDF8 100%)',
          }}
        />
      </div>

      {rightAction ?? (
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'rgba(250, 247, 242, 0.5)',
            fontFamily: 'var(--font-mono)',
            minWidth: '34px',
            textAlign: 'right',
          }}
        >
          {setupIndex + 1}/{SETUP_FLOW.length}
        </span>
      )}
    </div>
  );

  const renderNumericStep = (cfg: NumericStepConfig) => (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding:
          'calc(max(22px, env(safe-area-inset-top)) + 10px) 22px calc(max(24px, env(safe-area-inset-bottom)) + 16px) 22px',
        gap: '18px',
      }}
    >
      <div>
        {renderProgressChrome()}

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 11px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'rgba(250, 247, 242, 0.7)',
            marginBottom: '12px',
          }}
        >
          {cfg.icon}
          <span>{cfg.eyebrow}</span>
        </div>

        <h2
          style={{
            fontSize: '28px',
            fontWeight: 800,
            color: '#FAF7F2',
            letterSpacing: '-0.025em',
            margin: '0 0 8px 0',
            lineHeight: 1.15,
          }}
        >
          {cfg.title}
        </h2>
        <p style={{ fontSize: '13.5px', color: 'rgba(250, 247, 242, 0.58)', margin: 0, lineHeight: 1.45 }}>
          {cfg.subtitle}
        </p>
      </div>

      {/* Sélecteur central façon Cal AI */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.035)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '26px',
          padding: '26px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', width: '100%' }}>
          <button
            type="button"
            aria-label={`Diminuer ${cfg.unit}`}
            onClick={() => {
              triggerHaptic(12);
              cfg.onChange(Math.max(cfg.min, cfg.value - 1));
            }}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#FAF7F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Minus size={18} />
          </button>

          <div style={{ textAlign: 'center', minWidth: '136px' }}>
            <span
              style={{
                fontSize: '54px',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                color: '#FAF7F2',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1,
              }}
            >
              {cfg.value}
            </span>
            <span
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: 'rgba(250, 247, 242, 0.55)',
                marginLeft: '6px',
              }}
            >
              {cfg.unit}
            </span>
          </div>

          <button
            type="button"
            aria-label={`Augmenter ${cfg.unit}`}
            onClick={() => {
              triggerHaptic(12);
              cfg.onChange(Math.min(cfg.max, cfg.value + 1));
            }}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#FAF7F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Plus size={18} />
          </button>
        </div>

        <div style={{ width: '100%', padding: '0 4px' }}>
          <input
            type="range"
            min={cfg.min}
            max={cfg.max}
            value={cfg.value}
            onChange={(e) => cfg.onChange(Number(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#FAF7F2',
              height: '6px',
              cursor: 'pointer',
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10.5px',
              color: 'rgba(250, 247, 242, 0.4)',
              fontFamily: 'var(--font-mono)',
              marginTop: '6px',
            }}
          >
            <span>
              {cfg.min} {cfg.unit}
            </span>
            <span>
              {cfg.max} {cfg.unit}
            </span>
          </div>
        </div>

        {/* Raccourcis rapides */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          {cfg.presets.map((preset) => {
            const active = cfg.value === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  triggerHaptic(12);
                  cfg.onChange(preset);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  background: active ? '#FAF7F2' : 'rgba(255, 255, 255, 0.06)',
                  color: active ? '#0A0A0C' : 'rgba(250, 247, 242, 0.78)',
                  border: active ? '1px solid #FAF7F2' : '1px solid rgba(255, 255, 255, 0.1)',
                  fontSize: '12px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                }}
              >
                {preset} {cfg.unit}
              </button>
            );
          })}
        </div>

        <div
          style={{
            padding: '7px 14px',
            borderRadius: '999px',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            fontSize: '11.5px',
            fontWeight: 600,
            color: '#38BDF8',
          }}
        >
          {cfg.badgeLabel}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          triggerHaptic();
          cfg.onContinue();
        }}
        style={{
          width: '100%',
          height: '56px',
          borderRadius: '28px',
          background: 'linear-gradient(135deg, #FAF7F2 0%, #D8D4CC 100%)',
          color: '#0A0A0C',
          border: 'none',
          fontSize: '15.5px',
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(255, 255, 255, 0.18)',
        }}
      >
        <span>Continuer</span>
        <ArrowRight size={18} />
      </button>
    </div>
  );

  const renderPermissionStatusPill = (status: PermissionStatus) => {
    if (status === 'granted') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '999px',
            background: 'rgba(48, 209, 88, 0.16)',
            border: '1px solid rgba(48, 209, 88, 0.35)',
            color: '#30D158',
            fontSize: '11px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          <Check size={12} />
          <span>Activé</span>
        </span>
      );
    }
    if (status === 'pending') {
      return (
        <span
          style={{
            padding: '4px 10px',
            borderRadius: '999px',
            background: 'rgba(56, 189, 248, 0.14)',
            color: '#38BDF8',
            fontSize: '11px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          Demande...
        </span>
      );
    }
    if (status === 'denied') {
      return (
        <span
          style={{
            padding: '4px 10px',
            borderRadius: '999px',
            background: 'rgba(255, 159, 10, 0.14)',
            color: '#FF9F0A',
            fontSize: '11px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          Réglages
        </span>
      );
    }
    return (
      <span
        style={{
          padding: '4px 10px',
          borderRadius: '999px',
          background: 'rgba(255, 255, 255, 0.1)',
          color: '#FAF7F2',
          fontSize: '11px',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        Autoriser
      </span>
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 99999,
        background: '#040605',
        display: 'flex',
        flexDirection: 'column',
        color: '#FAF7F2',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarWidth: 'none',
      }}
    >
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={SLIDE_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={SLIDE_TRANSITION}
          style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}
        >
          {/* ===================================================================
              ACCUEIL : PAGE D'OUVERTURE AUREL RING ONE
              =================================================================== */}
          {step === 'welcome' && (
            <div
              style={{
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding:
                  'calc(max(28px, env(safe-area-inset-top)) + 16px) 24px calc(max(24px, env(safe-area-inset-bottom)) + 16px) 24px',
                textAlign: 'center',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '10%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '320px',
                  height: '320px',
                  background:
                    'radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, rgba(56, 189, 248, 0.05) 50%, transparent 70%)',
                  filter: 'blur(50px)',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />

              <div style={{ position: 'relative', zIndex: 2 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    borderRadius: '999px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(250, 247, 242, 0.85)',
                    marginBottom: '14px',
                  }}
                >
                  <Sparkles size={13} color="#FAF7F2" />
                  <span>Aurel Labs · Grade 5 Titanium</span>
                </div>

                <h1
                  style={{
                    fontSize: '34px',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.15,
                    color: '#FAF7F2',
                    margin: '0 0 8px 0',
                  }}
                >
                  Aurel Ring One
                </h1>
                <p
                  style={{
                    fontSize: '14px',
                    color: 'rgba(250, 247, 242, 0.6)',
                    lineHeight: 1.45,
                    maxWidth: '300px',
                    margin: '0 auto',
                  }}
                >
                  L’intelligence physiologique et biométrique de pointe, directement à votre doigt.
                </p>
              </div>

              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  width: '100%',
                  maxHeight: '320px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '16px 0',
                }}
              >
                <img
                  src="/assets/v2-orynn-ring-pedestal.png"
                  alt="Bague Aurel Ring One sur Piédestal"
                  style={{
                    maxWidth: '270px',
                    maxHeight: '290px',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 20px 35px rgba(0, 0, 0, 0.95))',
                  }}
                />
              </div>

              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  marginBottom: '18px',
                }}
              >
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.035)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    padding: '10px 12px',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={13} color="#30D158" />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#FAF7F2' }}>Capteurs PPG</span>
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.5)' }}>Flux thermique & VRC</span>
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.035)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    padding: '10px 12px',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={13} color="#38BDF8" />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#FAF7F2' }}>7 jours batterie</span>
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.5)' }}>Étanche 50 mètres</span>
                </div>
              </div>

              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    navigateTo('sex', 1);
                  }}
                  style={{
                    width: '100%',
                    height: '56px',
                    borderRadius: '28px',
                    background: 'linear-gradient(135deg, #FAF7F2 0%, #D8D4CC 100%)',
                    color: '#0A0A0C',
                    border: 'none',
                    fontSize: '16px',
                    fontWeight: 800,
                    letterSpacing: '0.01em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 10px 30px rgba(255, 255, 255, 0.22)',
                  }}
                >
                  <span>Start</span>
                  <ArrowRight size={18} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    navigateTo('no-ring', 1);
                  }}
                  style={{
                    width: '100%',
                    height: '46px',
                    borderRadius: '23px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: 'rgba(250, 247, 242, 0.85)',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <span>Pas encore d’Aurel Ring</span>
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================
              QUIZ 1 : SEXE BIOLOGIQUE
              =================================================================== */}
          {step === 'sex' && (
            <div
              style={{
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding:
                  'calc(max(22px, env(safe-area-inset-top)) + 10px) 22px calc(max(24px, env(safe-area-inset-bottom)) + 16px) 22px',
                gap: '18px',
              }}
            >
              <div>
                {renderProgressChrome()}

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 11px',
                    borderRadius: '999px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'rgba(250, 247, 242, 0.7)',
                    marginBottom: '12px',
                  }}
                >
                  <Sparkles size={12} />
                  <span>Calibrage biométrique</span>
                </div>

                <h2
                  style={{
                    fontSize: '28px',
                    fontWeight: 800,
                    color: '#FAF7F2',
                    letterSpacing: '-0.025em',
                    margin: '0 0 8px 0',
                    lineHeight: 1.15,
                  }}
                >
                  Quel est votre sexe biologique ?
                </h2>
                <p style={{ fontSize: '13.5px', color: 'rgba(250, 247, 242, 0.58)', margin: 0, lineHeight: 1.45 }}>
                  Permet d’ajuster vos dépenses énergétiques, votre récupération nocturne et les onglets santé adaptés.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(
                  [
                    {
                      id: 'femme' as BiologicalSex,
                      title: 'Femme',
                      desc: 'Active également le suivi thermique du cycle et des phases physiologiques.',
                    },
                    {
                      id: 'homme' as BiologicalSex,
                      title: 'Homme',
                      desc: 'Calibre le métabolisme basal et les seuils de récupération cardiaque.',
                    },
                  ] as const
                ).map((item) => {
                  const selected = sex === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic(15);
                        setSex(item.id);
                        updateProfile({ sex: item.id });
                      }}
                      style={{
                        width: '100%',
                        padding: '18px',
                        borderRadius: '22px',
                        background: selected ? 'rgba(250, 247, 242, 0.12)' : 'rgba(255, 255, 255, 0.035)',
                        border: selected
                          ? '1.5px solid #FAF7F2'
                          : '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#FAF7F2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease, border-color 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '17px', fontWeight: 800, marginBottom: '4px' }}>{item.title}</div>
                        <div style={{ fontSize: '12.5px', color: 'rgba(250, 247, 242, 0.6)', lineHeight: 1.4 }}>
                          {item.desc}
                        </div>
                      </div>

                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: selected ? '#FAF7F2' : 'transparent',
                          border: selected ? 'none' : '1.5px solid rgba(255, 255, 255, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {selected && <Check size={14} color="#0A0A0C" strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  updateProfile({ sex });
                  navigateTo('age', 1);
                }}
                style={{
                  width: '100%',
                  height: '56px',
                  borderRadius: '28px',
                  background: 'linear-gradient(135deg, #FAF7F2 0%, #D8D4CC 100%)',
                  color: '#0A0A0C',
                  border: 'none',
                  fontSize: '15.5px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(255, 255, 255, 0.18)',
                }}
              >
                <span>Continuer</span>
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* ===================================================================
              QUIZ 2 : ÂGE
              =================================================================== */}
          {step === 'age' &&
            renderNumericStep({
              step: 'age',
              eyebrow: 'Profil physiologique',
              title: 'Quel âge avez-vous ?',
              subtitle: 'Votre fréquence cardiaque maximale théorique et vos zones de récupération en dépendent.',
              value: age,
              unit: 'ans',
              min: 14,
              max: 95,
              presets: [20, 28, 35, 45],
              badgeLabel: `FC max estimée · ${Math.max(120, 220 - age)} bpm`,
              icon: <Calendar size={12} />,
              onChange: (next) => setAge(next),
              onContinue: () => {
                updateProfile({ age });
                navigateTo('height', 1);
              },
            })}

          {/* ===================================================================
              QUIZ 3 : TAILLE
              =================================================================== */}
          {step === 'height' &&
            renderNumericStep({
              step: 'height',
              eyebrow: 'Biométrie',
              title: 'Quelle est votre taille ?',
              subtitle: 'Sert à calculer précisément votre longueur de foulée, distance parcourue et dépense calorique.',
              value: heightCm,
              unit: 'cm',
              min: 130,
              max: 220,
              presets: [165, 173, 180, 188],
              badgeLabel: `Foulée estimée · ~${Math.round(heightCm * 0.415)} cm`,
              icon: <Ruler size={12} />,
              onChange: (next) => setHeightCm(next),
              onContinue: () => {
                updateProfile({ heightCm });
                navigateTo('weight', 1);
              },
            })}

          {/* ===================================================================
              QUIZ 4 : POIDS
              =================================================================== */}
          {step === 'weight' &&
            renderNumericStep({
              step: 'weight',
              eyebrow: 'Nutrition & Énergie',
              title: 'Quel est votre poids actuel ?',
              subtitle: 'Calibre automatiquement vos besoins caloriques quotidiens et vos objectifs de protéines.',
              value: weightKg,
              unit: 'kg',
              min: 35,
              max: 180,
              presets: [58, 68, 76, 86],
              badgeLabel: `IMC ${bmi} · Base Nutrition ~${recommendedTargets.calories} kcal/j`,
              icon: <Scale size={12} />,
              onChange: (next) => setWeightKg(next),
              onContinue: () => {
                persistBiometricProfileAndTargets();
                navigateTo('permissions', 1);
              },
            })}

          {/* ===================================================================
              ÉTAPE 5 : AUTORISATIONS SYSTÈME
              =================================================================== */}
          {step === 'permissions' && (
            <div
              style={{
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding:
                  'calc(max(22px, env(safe-area-inset-top)) + 10px) 22px calc(max(24px, env(safe-area-inset-bottom)) + 16px) 22px',
                gap: '16px',
              }}
            >
              <div>
                {renderProgressChrome(
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      navigateTo('healthkit', 1);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(250, 247, 242, 0.55)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '4px 0',
                    }}
                  >
                    Passer
                  </button>
                )}

                <h2
                  style={{
                    fontSize: '27px',
                    fontWeight: 800,
                    color: '#FAF7F2',
                    letterSpacing: '-0.025em',
                    margin: '0 0 8px 0',
                    lineHeight: 1.15,
                  }}
                >
                  Autorisations essentielles
                </h2>
                <p style={{ fontSize: '13.5px', color: 'rgba(250, 247, 242, 0.58)', margin: 0, lineHeight: 1.45 }}>
                  Activez les accès nécessaires pour connecter votre bague en continu et recevoir vos bilans santé.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(
                  [
                    {
                      id: 'ble',
                      title: 'Bluetooth',
                      desc: 'Indispensable pour appairer et lire votre Aurel Ring One.',
                      color: '#38BDF8',
                      iconBg: 'rgba(56, 189, 248, 0.15)',
                      grantedBg: 'rgba(56, 189, 248, 0.1)',
                      grantedBorder: 'rgba(56, 189, 248, 0.35)',
                      status: blePerm,
                      icon: <Bluetooth size={18} color="#38BDF8" />,
                      onRequest: requestBleAccess,
                    },
                    {
                      id: 'notif',
                      title: 'Notifications',
                      desc: 'Alertes batterie faible, bilans du matin et anomalies.',
                      color: '#FF9F0A',
                      iconBg: 'rgba(255, 159, 10, 0.15)',
                      grantedBg: 'rgba(255, 159, 10, 0.1)',
                      grantedBorder: 'rgba(255, 159, 10, 0.35)',
                      status: notifPerm,
                      icon: <Bell size={18} color="#FF9F0A" />,
                      onRequest: requestNotifAccess,
                    },
                    {
                      id: 'loc',
                      title: 'Localisation',
                      desc: 'Tracés GPS de course et fonction Localiser ma bague.',
                      color: '#30D158',
                      iconBg: 'rgba(48, 209, 88, 0.15)',
                      grantedBg: 'rgba(48, 209, 88, 0.1)',
                      grantedBorder: 'rgba(48, 209, 88, 0.35)',
                      status: locPerm,
                      icon: <MapPin size={18} color="#30D158" />,
                      onRequest: requestLocationAccess,
                    },
                  ] as const
                ).map((perm) => (
                  <button
                    key={perm.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic(12);
                      perm.onRequest();
                    }}
                    style={{
                      width: '100%',
                      padding: '15px 16px',
                      borderRadius: '20px',
                      background: perm.status === 'granted' ? perm.grantedBg : 'rgba(255, 255, 255, 0.04)',
                      border:
                        perm.status === 'granted'
                          ? `1px solid ${perm.grantedBorder}`
                          : '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#FAF7F2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '13px',
                          background: perm.iconBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {perm.icon}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '14.5px', fontWeight: 700 }}>{perm.title}</div>
                        <div style={{ fontSize: '11.5px', color: 'rgba(250, 247, 242, 0.58)', lineHeight: 1.35 }}>
                          {perm.desc}
                        </div>
                      </div>
                    </div>
                    {renderPermissionStatusPill(perm.status)}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  disabled={isRequestingPerms}
                  onClick={handleRequestAllPermissionsAndContinue}
                  style={{
                    width: '100%',
                    height: '56px',
                    borderRadius: '28px',
                    background: 'linear-gradient(135deg, #FAF7F2 0%, #D8D4CC 100%)',
                    color: '#0A0A0C',
                    border: 'none',
                    fontSize: '15.5px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(255, 255, 255, 0.18)',
                  }}
                >
                  <span>
                    {blePerm === 'granted' && notifPerm === 'granted' && locPerm === 'granted'
                      ? 'Continuer'
                      : isRequestingPerms
                      ? 'Autorisation en cours...'
                      : 'Tout autoriser et continuer'}
                  </span>
                  <ArrowRight size={18} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    navigateTo('healthkit', 1);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(250, 247, 242, 0.45)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  Configurer plus tard
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================
              ÉTAPE 6 : SYNCHRONISATION APPLE SANTÉ
              =================================================================== */}
          {step === 'healthkit' && (
            <div
              style={{
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding:
                  'calc(max(22px, env(safe-area-inset-top)) + 10px) 22px calc(max(24px, env(safe-area-inset-bottom)) + 16px) 22px',
                gap: '16px',
              }}
            >
              <div>
                {renderProgressChrome()}

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #FF2D55 0%, #FF3B30 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 20px rgba(255, 45, 85, 0.35)',
                      flexShrink: 0,
                    }}
                  >
                    <Heart size={24} color="#FFFFFF" fill="#FFFFFF" />
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                        color: '#FF375F',
                      }}
                    >
                      Apple Santé · HealthKit
                    </span>
                    <h2
                      style={{
                        fontSize: '25px',
                        fontWeight: 800,
                        color: '#FAF7F2',
                        letterSpacing: '-0.025em',
                        margin: '2px 0 0 0',
                        lineHeight: 1.15,
                      }}
                    >
                      Synchroniser Apple Santé
                    </h2>
                  </div>
                </div>

                <p style={{ fontSize: '13.5px', color: 'rgba(250, 247, 242, 0.58)', margin: 0, lineHeight: 1.45 }}>
                  Partagez automatiquement les relevés de votre Aurel Ring One avec Apple Santé et vos anneaux Apple Fitness.
                </p>
              </div>

              {/* Aperçu profil calibré + 6 métriques Apple Santé */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '18px',
                    background: 'rgba(48, 209, 88, 0.08)',
                    border: '1px solid rgba(48, 209, 88, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#30D158', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Profil calibré prêt
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#FAF7F2', fontWeight: 600, marginTop: '2px' }}>
                      {sex === 'femme' ? 'Femme' : 'Homme'} · {age} ans · {heightCm} cm · {weightKg} kg
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
                      {recommendedTargets.calories} kcal
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.55)' }}>
                      Cible nutrition/j
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                  }}
                >
                  {HEALTHKIT_PREVIEW_ITEMS.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        padding: '11px 12px',
                        borderRadius: '15px',
                        background: 'rgba(255, 255, 255, 0.035)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <CheckCircle2 size={13} color="#FF375F" />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#FAF7F2' }}>{item.label}</span>
                      </div>
                      <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.5)' }}>{item.sub}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  disabled={isSyncingHealthKit}
                  onClick={handleEnableHealthKit}
                  style={{
                    width: '100%',
                    height: '56px',
                    borderRadius: '28px',
                    background: 'linear-gradient(135deg, #FF2D55 0%, #FF3B30 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '15.5px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 10px 26px rgba(255, 45, 85, 0.35)',
                  }}
                >
                  <Heart size={17} fill="#FFFFFF" />
                  <span>{isSyncingHealthKit ? 'Activation...' : 'Activer Apple Santé'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSkipHealthKit}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(250, 247, 242, 0.45)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  Plus tard
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================
              VUE SECONDAIRE : PAS ENCORE D'AUREL RING
              =================================================================== */}
          {step === 'no-ring' && (
            <div
              style={{
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding:
                  'calc(max(24px, env(safe-area-inset-top)) + 12px) 22px calc(max(24px, env(safe-area-inset-bottom)) + 16px) 22px',
                gap: '20px',
              }}
            >
              <div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    navigateTo('welcome', -1);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(250, 247, 242, 0.7)',
                    fontSize: '13.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    padding: '4px 0',
                    marginBottom: '16px',
                  }}
                >
                  <ChevronLeft size={18} />
                  <span>Retour</span>
                </button>

                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <Disc size={22} color="#FAF7F2" />
                </div>

                <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#FAF7F2', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                  Pas encore d’Aurel Ring ?
                </h2>
                <p style={{ fontSize: '14px', color: 'rgba(250, 247, 242, 0.6)', lineHeight: 1.5, margin: 0 }}>
                  Découvrez l’écosystème Aurel Labs. Vous pouvez explorer l’interface dès maintenant ou configurer votre compte en attendant de recevoir votre bague.
                </p>
              </div>

              <div
                style={{
                  padding: '18px',
                  borderRadius: '22px',
                  background: 'rgba(255, 255, 255, 0.035)',
                  border: '1px solid rgba(255, 255, 255, 0.09)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Info size={16} color="#38BDF8" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#FAF7F2' }}>
                    Mode Découverte disponible
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'rgba(250, 247, 242, 0.55)', lineHeight: 1.45, margin: 0 }}>
                  Vos entraînements GPS, votre scanner nutritionnel et Aurelius restent accessibles même avant l’appairage de votre bague Aurel Ring One.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setIsPaired(true);
                    onComplete();
                  }}
                  style={{
                    width: '100%',
                    height: '54px',
                    borderRadius: '27px',
                    background: '#FAF7F2',
                    color: '#0A0A0C',
                    border: 'none',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Explorer l’application sans bague
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    navigateTo('welcome', -1);
                  }}
                  style={{
                    width: '100%',
                    height: '46px',
                    borderRadius: '23px',
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    color: 'rgba(250, 247, 242, 0.75)',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Revenir à l’accueil
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================
              ÉTAPE 7 : COMPTE UTILISATEUR
              =================================================================== */}
          {step === 'account' && (
            <div
              style={{
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding:
                  'calc(max(24px, env(safe-area-inset-top)) + 12px) 22px calc(max(24px, env(safe-area-inset-bottom)) + 16px) 22px',
                gap: '18px',
              }}
            >
              <div>
                {renderProgressChrome(
                  <button
                    type="button"
                    onClick={handleSkipAccount}
                    style={{
                      padding: '6px 13px',
                      borderRadius: '999px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      color: '#FAF7F2',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span>Skip (Test)</span>
                    <ArrowRight size={13} />
                  </button>
                )}

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(250, 247, 242, 0.5)',
                  }}
                >
                  Compte Aurel & Garantie
                </span>
                <h2
                  style={{
                    fontSize: '27px',
                    fontWeight: 800,
                    color: '#FAF7F2',
                    letterSpacing: '-0.02em',
                    margin: '6px 0 6px 0',
                  }}
                >
                  {authMode === 'signup' ? 'Créer votre compte' : 'Se connecter'}
                </h2>
                <p style={{ fontSize: '13.5px', color: 'rgba(250, 247, 242, 0.55)', margin: 0, lineHeight: 1.45 }}>
                  Sauvegardez vos constantes biométriques et synchronisez votre Aurel Ring One en toute sécurité.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px',
                  padding: '4px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setAuthMode('signup');
                    setAuthError(null);
                  }}
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    background: authMode === 'signup' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                    border: authMode === 'signup' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
                    color: authMode === 'signup' ? '#FAF7F2' : 'rgba(250, 247, 242, 0.5)',
                    fontSize: '13px',
                    fontWeight: authMode === 'signup' ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  Créer un compte
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setAuthMode('login');
                    setAuthError(null);
                  }}
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    background: authMode === 'login' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                    border: authMode === 'login' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
                    color: authMode === 'login' ? '#FAF7F2' : 'rgba(250, 247, 242, 0.5)',
                    fontSize: '13px',
                    fontWeight: authMode === 'login' ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  Connexion
                </button>
              </div>

              <form
                onSubmit={handleAccountSubmit}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  flex: 1,
                }}
              >
                {authMode === 'signup' && (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '16px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <User size={16} color="rgba(250, 247, 242, 0.5)" />
                    <input
                      type="text"
                      placeholder="Prénom"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: '#FAF7F2',
                        fontSize: '15px',
                      }}
                    />
                  </div>
                )}

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <Mail size={16} color="rgba(250, 247, 242, 0.5)" />
                  <input
                    type="email"
                    placeholder="Adresse e-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoCapitalize="none"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#FAF7F2',
                      fontSize: '15px',
                    }}
                  />
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <Lock size={16} color="rgba(250, 247, 242, 0.5)" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#FAF7F2',
                      fontSize: '15px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(250, 247, 242, 0.45)',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {authError && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: 'rgba(255, 69, 58, 0.12)',
                      border: '1px solid rgba(255, 69, 58, 0.3)',
                      color: '#FF453A',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    {authError}
                  </div>
                )}

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '12px' }}>
                  <button
                    type="submit"
                    style={{
                      width: '100%',
                      height: '54px',
                      borderRadius: '27px',
                      background: 'linear-gradient(135deg, #FAF7F2 0%, #D8D4CC 100%)',
                      color: '#0A0A0C',
                      border: 'none',
                      fontSize: '15px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 8px 24px rgba(255, 255, 255, 0.18)',
                    }}
                  >
                    <span>{authMode === 'signup' ? 'Créer mon compte' : 'Se connecter'}</span>
                    <ArrowRight size={17} />
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      color: 'rgba(250, 247, 242, 0.4)',
                    }}
                  >
                    <ShieldCheck size={12} />
                    <span>Données chiffrées localement sur votre appareil</span>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ===================================================================
              ÉTAPE 8 : DOCK DE CHARGE & SÉLECTION DE LA BAGUE BLUETOOTH
              =================================================================== */}
          {step === 'dock' && (
            <div
              style={{
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding:
                  'calc(max(20px, env(safe-area-inset-top)) + 10px) 22px calc(max(20px, env(safe-area-inset-bottom)) + 14px) 22px',
                gap: '14px',
              }}
            >
              <div>
                {renderProgressChrome(
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: isScanning ? 'rgba(56, 189, 248, 0.14)' : 'rgba(255, 255, 255, 0.06)',
                      border: isScanning ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(255, 255, 255, 0.12)',
                      flexShrink: 0,
                    }}
                  >
                    <Bluetooth size={12} color={isScanning ? '#38BDF8' : '#FAF7F2'} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: isScanning ? '#38BDF8' : '#FAF7F2' }}>
                      {connectedDeviceName
                        ? 'Connectée'
                        : isScanning
                        ? 'Scan BLE actif'
                        : 'Bluetooth prêt'}
                    </span>
                  </div>
                )}

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#30D158',
                  }}
                >
                  Étape finale · Activation & Bluetooth
                </span>
                <h2
                  style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    color: '#FAF7F2',
                    letterSpacing: '-0.02em',
                    margin: '4px 0 4px 0',
                  }}
                >
                  Posez la bague sur le dock
                </h2>
                <p style={{ fontSize: '13px', color: 'rgba(250, 247, 242, 0.6)', margin: 0, lineHeight: 1.4 }}>
                  Placez votre Aurel Ring One sur son dock de charge pour l’activer, puis sélectionnez-la ci-dessous.
                </p>
              </div>

              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  borderRadius: '22px',
                  overflow: 'hidden',
                  background: '#08080A',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  maxHeight: '220px',
                }}
              >
                <img
                  src="/assets/ring-charging-dock.jpg"
                  alt="Posez votre Aurel Ring sur le dock de charge"
                  style={{
                    width: '100%',
                    height: '220px',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '12px',
                    right: '12px',
                    padding: '6px 10px',
                    borderRadius: '10px',
                    background: 'rgba(10, 10, 14, 0.78)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'rgba(250, 247, 242, 0.85)',
                  }}
                >
                  <span>Voyant LED allumé = prête pour l’appairage</span>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      boxShadow: '0 0 8px #FFFFFF',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '14px',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  minHeight: '150px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'rgba(250, 247, 242, 0.55)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Bagues détectées ({discoveredDevices.length})
                  </span>

                  <button
                    type="button"
                    onClick={handleRefreshScan}
                    style={{
                      background: 'rgba(255, 255, 255, 0.07)',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      borderRadius: '8px',
                      padding: '4px 9px',
                      color: '#FAF7F2',
                      fontSize: '11px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={11} className={isScanning ? 'spin' : ''} />
                    <span>Actualiser</span>
                  </button>
                </div>

                {connectedDeviceName ? (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '14px',
                      background: 'rgba(48, 209, 88, 0.14)',
                      border: '1px solid rgba(48, 209, 88, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      color: '#30D158',
                      fontSize: '14px',
                      fontWeight: 700,
                      marginTop: '8px',
                    }}
                  >
                    <CheckCircle2 size={18} />
                    <span>{connectedDeviceName} connectée !</span>
                  </div>
                ) : discoveredDevices.length === 0 ? (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '16px 8px',
                      textAlign: 'center',
                    }}
                  >
                    <Radio size={22} color="#38BDF8" style={{ opacity: 0.85 }} />
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#FAF7F2' }}>
                      {isScanning
                        ? 'Recherche de votre bague en cours...'
                        : 'Aucune bague détectée pour le moment'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.45)', maxWidth: '240px' }}>
                      Vérifiez que le Bluetooth est activé et que la bague est bien posée sur son dock.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {discoveredDevices.map((dev) => {
                      const isConnectingThis = connectingDeviceId === dev.deviceId;
                      return (
                        <button
                          key={dev.deviceId}
                          type="button"
                          onClick={() => handleSelectDevice(dev)}
                          disabled={Boolean(connectingDeviceId)}
                          style={{
                            width: '100%',
                            padding: '11px 14px',
                            borderRadius: '14px',
                            background: dev.isRing ? 'rgba(48, 209, 88, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                            border: dev.isRing ? '1px solid rgba(48, 209, 88, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                            color: '#FAF7F2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: connectingDeviceId ? 'default' : 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '10px',
                                background: dev.isRing ? 'rgba(48, 209, 88, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Disc size={16} color={dev.isRing ? '#30D158' : '#FAF7F2'} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#FAF7F2' }}>
                                {formatRingDisplayName(dev.name, dev.isRing)}
                              </span>
                              <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.5)', fontFamily: 'var(--font-mono)' }}>
                                {dev.rssi ? `Signal: ${dev.rssi} dBm` : 'Bluetooth LE'}
                              </span>
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 700,
                              color: dev.isRing ? '#0A0A0C' : '#FAF7F2',
                              background: dev.isRing ? '#30D158' : 'rgba(255, 255, 255, 0.15)',
                              padding: '5px 11px',
                              borderRadius: '999px',
                            }}
                          >
                            {isConnectingThis ? 'Connexion...' : 'Sélectionner'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {bleError && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#FF9F0A',
                      background: 'rgba(255, 159, 10, 0.1)',
                      border: '1px solid rgba(255, 159, 10, 0.25)',
                      padding: '8px 10px',
                      borderRadius: '10px',
                    }}
                  >
                    {bleError}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleNativeWebScan}
                  disabled={Boolean(connectingDeviceId || connectedDeviceName)}
                  style={{
                    width: '100%',
                    height: '52px',
                    borderRadius: '26px',
                    background: '#FAF7F2',
                    border: 'none',
                    color: '#0A0A0C',
                    fontSize: '14.5px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <Bluetooth size={17} />
                  <span>Rechercher et connecter ma bague</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setIsPaired(true);
                    onComplete();
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(250, 247, 242, 0.45)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: '6px',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                  }}
                >
                  Continuer sans bague pour l’instant
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
