import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { qringBle, DiscoveredBleDevice } from '../lib/qringBleService';
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
} from 'lucide-react';

interface OnboardingFlowProps {
  onComplete: () => void;
}

type OnboardingStep = 'welcome' | 'account' | 'dock' | 'no-ring';

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { profile, updateProfile, updateRing, setIsPaired } = useApp();

  const [step, setStep] = useState<OnboardingStep>('welcome');

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

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(20);
      } catch (_) {}
    }
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
        // Prioriser les bagues reconnues en haut de la liste
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
        setConnectedDeviceName(res.deviceName || 'Aurel Ring One');
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
        setConnectedDeviceName(res.deviceName || dev.name);
        setConnectingDeviceId(null);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(35);
          } catch (_) {}
        }
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
    try {
      localStorage.setItem('aurel_account_email', email.trim());
    } catch (_) {}

    setStep('dock');
  };

  const handleSkipAccount = () => {
    triggerHaptic();
    setStep('dock');
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
      {/* ===================================================================
          ÉTAPE 1 : PAGE D'ACCUEIL / CONNEXION INITIALE (START + PAS ENCORE D'AUREL RING)
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
          {/* Halo lumineux subtil */}
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

          {/* Logo & Titre */}
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

          {/* Visuel Bague sur Piédestal */}
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

          {/* Points Clés */}
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

          {/* Boutons : START & PAS ENCORE D'AUREL RING */}
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
                setStep('account');
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
                setStep('no-ring');
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
                setStep('welcome');
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
              Vos entraînements GPS, votre scanner nutritionnel et Aurelius restent accessibles même avant l’appairage de votre bague Aurel Ring One (AR01).
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
                setStep('welcome');
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
          ÉTAPE 2 : COMPTE UTILISATEUR (AVEC BOUTON SKIP TEMPORAIRE POUR TEST)
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
          {/* Header : Retour & Bouton Skip temporaire */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setStep('welcome');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(250, 247, 242, 0.65)',
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
              >
                <ChevronLeft size={18} />
                <span>Retour</span>
              </button>

              {/* Bouton Skip Temporaire pour les tests */}
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
            </div>

            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(250, 247, 242, 0.5)',
              }}
            >
              Étape 1 sur 2 · Compte Aurel
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

          {/* Sélecteur Créer un compte / Se connecter */}
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

          {/* Formulaire Compte */}
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
          ÉTAPE 3 : DOCK DE CHARGE & SÉLECTION DE LA BAGUE BLUETOOTH
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
          {/* Header */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setStep('account');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(250, 247, 242, 0.65)',
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
              >
                <ChevronLeft size={18} />
                <span>Retour</span>
              </button>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: isScanning ? 'rgba(56, 189, 248, 0.14)' : 'rgba(255, 255, 255, 0.06)',
                  border: isScanning ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(255, 255, 255, 0.12)',
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
            </div>

            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#30D158',
              }}
            >
              Étape 2 sur 2 · Activation & Bluetooth
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

          {/* Image du Dock de Charge */}
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

          {/* Liste des bagues détectées par Bluetooth */}
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
                            {dev.name}
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

          {/* Bouton Scan Manuel / Web Bluetooth & Continuer sans bague */}
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
    </div>
  );
};
