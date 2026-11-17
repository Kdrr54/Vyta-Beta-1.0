import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { PairingModal } from './PairingModal';
import {
  Sparkles,
  ArrowRight,
  User,
  Heart,
  Moon,
  Zap,
  Activity,
  ChevronLeft,
  ShieldCheck,
  Flame,
  Bluetooth,
  MapPin,
  Bell,
  Check,
} from 'lucide-react';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { profile, updateProfile } = useApp();

  // Étape courante : 1 = Bienvenue, 2 = Profil, 3 = Permissions Système, 4 = Appairage BLE
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Formulaire profil corporel
  const [firstName, setFirstName] = useState<string>(profile.firstName || '');
  const [sex, setSex] = useState<'homme' | 'femme'>(profile.sex || 'homme');
  const [age, setAge] = useState<number>(profile.age || 28);
  const [heightCm, setHeightCm] = useState<number>(profile.heightCm || 180);
  const [weightKg, setWeightKg] = useState<number>(profile.weightKg || 75);
  const [goal, setGoal] = useState<string>('recovery');

  // Statuts des permissions système (Position, Bluetooth, Notifications)
  const [geoStatus, setGeoStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [notifStatus, setNotifStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [bleStatus, setBleStatus] = useState<'pending' | 'granted'>('pending');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') setNotifStatus('granted');
        else if (Notification.permission === 'denied') setNotifStatus('denied');
      }
      if ('permissions' in navigator && navigator.permissions?.query) {
        navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((p) => {
          if (p.state === 'granted') setGeoStatus('granted');
          else if (p.state === 'denied') setGeoStatus('denied');
        }).catch(() => {});
      }
      if ('bluetooth' in navigator) {
        setBleStatus('granted');
      }
    }
  }, []);

  const requestGeolocation = async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoStatus('granted');
      return true;
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          setGeoStatus('granted');
          resolve(true);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setGeoStatus('denied');
          }
          resolve(false);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    });
  };

  const requestNotifications = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifStatus('granted');
      return true;
    }
    try {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        setNotifStatus('granted');
        return true;
      } else if (res === 'denied') {
        setNotifStatus('denied');
        return false;
      }
    } catch (_) {}
    return false;
  };

  const requestBluetooth = async (): Promise<boolean> => {
    setBleStatus('granted');
    return true;
  };

  const handleNextToProfile = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(20);
      } catch (e) {}
    }
    setStep(2);
  };

  const handleNextToPermissions = () => {
    const trimmed = firstName.trim() || 'Alexandre';
    updateProfile({
      firstName: trimmed,
      sex,
      age: Number(age) || 28,
      heightCm: Number(heightCm) || 180,
      weightKg: Number(weightKg) || 75,
    });

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(25);
      } catch (e) {}
    }
    setStep(3);
  };

  const handleAuthorizeAll = async () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(25); } catch (_) {}
    }
    await requestNotifications();
    await requestGeolocation();
    await requestBluetooth();
    setStep(4);
  };

  // Étape 4 : piédestal romain haute précision avec appairage BLE
  if (step === 4) {
    return <PairingModal onClose={onComplete} onBack={() => setStep(3)} />;
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 99999,
        background: '#040605',
        display: 'flex',
        flexDirection: 'column',
        color: '#FFFFFF',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarWidth: 'none',
      }}
    >
      {/* ===================================================================
          ÉTAPE 1 : BIENVENUE & PRÉSENTATION LUXE VYTA ONE
          =================================================================== */}
      {step === 1 && (
        <div
          style={{
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding:
              'calc(max(28px, env(safe-area-inset-top)) + 16px) 24px calc(max(28px, env(safe-area-inset-bottom)) + 16px) 24px',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          {/* Halo lumineux subtil */}
          <div
            style={{
              position: 'absolute',
              top: '8%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '320px',
              height: '320px',
              background:
                'radial-gradient(circle, rgba(217, 249, 112, 0.12) 0%, rgba(56, 189, 248, 0.08) 50%, transparent 70%)',
              filter: 'blur(50px)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />

          {/* Logo & Header */}
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
              <Sparkles size={13} color="#D9F970" />
              <span>Titane Aérospatial · Grade 5</span>
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
                color: 'rgba(250, 247, 242, 0.65)',
                lineHeight: 1.45,
                maxWidth: '300px',
                margin: '0 auto',
              }}
            >
              L’intelligence physiologique et biométrique de pointe, directement à votre doigt.
            </p>
          </div>

          {/* Rendu Photoréaliste de la Bague sur le Piédestal */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              width: '100%',
              maxHeight: '340px',
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
                maxWidth: '280px',
                maxHeight: '300px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 20px 30px rgba(0, 0, 0, 0.95))',
              }}
            />
          </div>

          {/* Points Clés Technologiques */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
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
                <Activity size={13} color="#D9F970" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#FAF7F2' }}>Capteurs PPG</span>
              </div>
              <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.5)' }}>Flux thermique & VFC</span>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
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

          {/* Bouton Démarrer la Configuration */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <button
              type="button"
              onClick={handleNextToProfile}
              style={{
                width: '100%',
                height: '56px',
                borderRadius: '28px',
                background: 'linear-gradient(135deg, #FAF7F2 0%, #D8D4CC 100%)',
                color: '#0A0A0C',
                border: 'none',
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '-0.2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 10px 30px rgba(255, 255, 255, 0.25)',
              }}
            >
              <span>Commencer la configuration</span>
              <ArrowRight size={17} />
            </button>
            <button
              type="button"
              onClick={onComplete}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(250, 247, 242, 0.55)',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
                padding: '6px 0',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
              }}
            >
              Accéder au tableau de bord
            </button>
            <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.4)' }}>
              Configuration personnalisée en moins de 60 secondes
            </span>
          </div>
        </div>
      )}

      {/* ===================================================================
          ÉTAPE 2 : QUESTIONNAIRE PHYSIOLOGIQUE (PRÉNOM, SEXE, ÂGE, POIDS, TAILLE)
          =================================================================== */}
      {step === 2 && (
        <div
          style={{
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding:
              'calc(max(24px, env(safe-area-inset-top)) + 12px) 20px calc(max(24px, env(safe-area-inset-bottom)) + 12px) 20px',
            gap: '16px',
          }}
        >
          {/* Header de l'étape */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(250, 247, 242, 0.6)',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
              >
                <ChevronLeft size={16} />
                <span>Retour</span>
              </button>
              <button
                type="button"
                onClick={onComplete}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(250, 247, 242, 0.55)',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  padding: '4px 0',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                Passer
              </button>
            </div>

            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#D9F970',
              }}
            >
              Étape 1 sur 3 · Profil Biologique
            </span>
            <h2
              style={{
                fontSize: '26px',
                fontWeight: 800,
                color: '#FAF7F2',
                letterSpacing: '-0.02em',
                margin: '4px 0 6px 0',
              }}
            >
              Vos paramètres corporels
            </h2>
            <p
              style={{
                fontSize: '12.5px',
                color: 'rgba(250, 247, 242, 0.65)',
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              Nécessaires pour calibrer vos seuils de VFC, de sommeil et votre Target Strain.
            </p>
          </div>

          {/* Formulaire des champs */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              flex: 1,
              overflowY: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            {/* 1. Prénom */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.85)' }}>
                Comment vous appelez-vous ?
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: '16px',
                  padding: '12px 14px',
                }}
              >
                <User size={18} color="rgba(250, 247, 242, 0.5)" />
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Votre prénom (ex: Alexandre)"
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    color: '#FAF7F2',
                    fontSize: '15px',
                    fontWeight: 600,
                  }}
                />
              </div>
            </div>

            {/* 2. Sexe biologique */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.85)' }}>
                Sexe biologique
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSex('homme')}
                  style={{
                    padding: '14px',
                    borderRadius: '16px',
                    background:
                      sex === 'homme'
                        ? 'rgba(217, 249, 112, 0.14)'
                        : 'rgba(255, 255, 255, 0.05)',
                    border:
                      sex === 'homme'
                        ? '1.5px solid #D9F970'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                    color: sex === 'homme' ? '#D9F970' : 'rgba(250, 247, 242, 0.75)',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <span>♂ Homme</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSex('femme')}
                  style={{
                    padding: '14px',
                    borderRadius: '16px',
                    background:
                      sex === 'femme'
                        ? 'rgba(232, 121, 249, 0.14)'
                        : 'rgba(255, 255, 255, 0.05)',
                    border:
                      sex === 'femme'
                        ? '1.5px solid #E879F9'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                    color: sex === 'femme' ? '#E879F9' : 'rgba(250, 247, 242, 0.75)',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <span>♀ Femme</span>
                </button>
              </div>
              <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.45)', paddingLeft: '2px' }}>
                {sex === 'femme'
                  ? 'Active l’onglet Suivi de Cycle et adapte les phases hormonales.'
                  : 'Calibre le métabolisme de base et la charge d’effort athlétique.'}
              </span>
            </div>

            {/* 3. Âge, Poids & Taille */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {/* Âge */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '10px 12px',
                }}
              >
                <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)', fontWeight: 600 }}>
                  Âge
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) =>
                      setAge(Math.max(12, Math.min(100, Number(e.target.value) || 28)))
                    }
                    style={{
                      width: '42px',
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      color: '#FAF7F2',
                      fontSize: '18px',
                      fontWeight: 800,
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.5)' }}>ans</span>
                </div>
              </div>

              {/* Taille */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '10px 12px',
                }}
              >
                <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)', fontWeight: 600 }}>
                  Taille
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) =>
                      setHeightCm(Math.max(100, Math.min(230, Number(e.target.value) || 180)))
                    }
                    style={{
                      width: '46px',
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      color: '#FAF7F2',
                      fontSize: '18px',
                      fontWeight: 800,
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.5)' }}>cm</span>
                </div>
              </div>

              {/* Poids */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '10px 12px',
                }}
              >
                <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)', fontWeight: 600 }}>
                  Poids
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                  <input
                    type="number"
                    value={weightKg}
                    onChange={(e) =>
                      setWeightKg(Math.max(30, Math.min(220, Number(e.target.value) || 75)))
                    }
                    style={{
                      width: '42px',
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      color: '#FAF7F2',
                      fontSize: '18px',
                      fontWeight: 800,
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.5)' }}>kg</span>
                </div>
              </div>
            </div>

            {/* 4. Objectif prioritaire */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.85)' }}>
                Votre objectif prioritaire
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { id: 'recovery', label: 'Sommeil & Récupération', icon: Moon, color: '#818CF8' },
                  { id: 'athletic', label: 'Performance Athlétique', icon: Zap, color: '#D9F970' },
                  { id: 'stress', label: 'Gestion du Stress & VFC', icon: Heart, color: '#FB7185' },
                  { id: 'longevity', label: 'Santé & Longévité', icon: Flame, color: '#38BDF8' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = goal === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setGoal(item.id)}
                      style={{
                        padding: '12px 10px',
                        borderRadius: '14px',
                        background: isSelected
                          ? 'rgba(255, 255, 255, 0.12)'
                          : 'rgba(255, 255, 255, 0.04)',
                        border: isSelected
                          ? `1.5px solid ${item.color}`
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'all 0.18s ease',
                      }}
                    >
                      <Icon size={16} color={item.color} />
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: isSelected ? 700 : 500,
                          color: '#FAF7F2',
                          lineHeight: 1.3,
                        }}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bouton Continuer vers les autorisations */}
          <div style={{ paddingTop: '8px' }}>
            <button
              type="button"
              onClick={handleNextToPermissions}
              style={{
                width: '100%',
                height: '54px',
                borderRadius: '27px',
                background: 'linear-gradient(135deg, #FAF7F2 0%, #D8D4CC 100%)',
                color: '#0A0A0C',
                border: 'none',
                fontSize: '15px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(255, 255, 255, 0.25)',
              }}
            >
              <span>Continuer vers les autorisations</span>
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================
          ÉTAPE 3 : AUTORISATIONS SYSTÈME (POSITION, BLUETOOTH, NOTIFICATIONS)
          =================================================================== */}
      {step === 3 && (
        <div
          style={{
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding:
              'calc(max(24px, env(safe-area-inset-top)) + 12px) 20px calc(max(24px, env(safe-area-inset-bottom)) + 12px) 20px',
            gap: '16px',
          }}
        >
          {/* Header */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(250, 247, 242, 0.6)',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
              >
                <ChevronLeft size={16} />
                <span>Retour</span>
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(250, 247, 242, 0.55)',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  padding: '4px 0',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                Passer
              </button>
            </div>

            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#38BDF8',
              }}
            >
              Étape 2 sur 3 · Autorisations Système
            </span>
            <h2
              style={{
                fontSize: '26px',
                fontWeight: 800,
                color: '#FAF7F2',
                letterSpacing: '-0.02em',
                margin: '4px 0 6px 0',
              }}
            >
              Autoriser Aurel Labs
            </h2>
            <p
              style={{
                fontSize: '12.5px',
                color: 'rgba(250, 247, 242, 0.65)',
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              Pour synchroniser votre bague Aurel Ring One et enregistrer vos séances de sport en temps réel, veuillez autoriser ces 3 accès essentiels.
            </p>
          </div>

          {/* 3 Cartes d'autorisation interactives */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              flex: 1,
              justifyContent: 'center',
            }}
          >
            {/* 1. Bluetooth */}
            <div
              onClick={requestBluetooth}
              style={{
                background: bleStatus === 'granted' ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.05)',
                border: bleStatus === 'granted' ? '1.5px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '18px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'rgba(56, 189, 248, 0.16)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Bluetooth size={20} color="#38BDF8" />
                </div>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#FAF7F2', display: 'block' }}>
                    Bluetooth (Bague Aurel Ring One)
                  </span>
                  <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)', lineHeight: 1.35, display: 'block', marginTop: '2px' }}>
                    Connexion sans fil pour synchroniser sommeil, pouls et température cutanée.
                  </span>
                </div>
              </div>

              <div
                style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  background: bleStatus === 'granted' ? 'rgba(48, 209, 88, 0.18)' : 'rgba(56, 189, 248, 0.18)',
                  border: bleStatus === 'granted' ? '1px solid #30D158' : '1px solid #38BDF8',
                  color: bleStatus === 'granted' ? '#30D158' : '#38BDF8',
                  fontSize: '11px',
                  fontWeight: 700,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {bleStatus === 'granted' ? (
                  <>
                    <Check size={12} />
                    <span>Autorisé</span>
                  </>
                ) : (
                  <span>Activer</span>
                )}
              </div>
            </div>

            {/* 2. Position GPS */}
            <div
              onClick={requestGeolocation}
              style={{
                background: geoStatus === 'granted' ? 'rgba(48, 209, 88, 0.08)' : 'rgba(255, 255, 255, 0.05)',
                border: geoStatus === 'granted' ? '1.5px solid rgba(48, 209, 88, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '18px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'rgba(48, 209, 88, 0.16)',
                    border: '1px solid rgba(48, 209, 88, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <MapPin size={20} color="#30D158" />
                </div>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#FAF7F2', display: 'block' }}>
                    Position GPS (Course & Radar)
                  </span>
                  <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)', lineHeight: 1.35, display: 'block', marginTop: '2px' }}>
                    Tracé GPS des séances de course, distance et radar de proximité de la bague.
                  </span>
                </div>
              </div>

              <div
                style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  background: geoStatus === 'granted' ? 'rgba(48, 209, 88, 0.18)' : 'rgba(255, 255, 255, 0.1)',
                  border: geoStatus === 'granted' ? '1px solid #30D158' : '1px solid rgba(255, 255, 255, 0.2)',
                  color: geoStatus === 'granted' ? '#30D158' : '#FAF7F2',
                  fontSize: '11px',
                  fontWeight: 700,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {geoStatus === 'granted' ? (
                  <>
                    <Check size={12} />
                    <span>Autorisé</span>
                  </>
                ) : (
                  <span>Autoriser</span>
                )}
              </div>
            </div>

            {/* 3. Notifications */}
            <div
              onClick={requestNotifications}
              style={{
                background: notifStatus === 'granted' ? 'rgba(192, 132, 252, 0.08)' : 'rgba(255, 255, 255, 0.05)',
                border: notifStatus === 'granted' ? '1.5px solid rgba(192, 132, 252, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '18px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'rgba(192, 132, 252, 0.16)',
                    border: '1px solid rgba(192, 132, 252, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Bell size={20} color="#C084FC" />
                </div>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#FAF7F2', display: 'block' }}>
                    Notifications & Alertes
                  </span>
                  <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)', lineHeight: 1.35, display: 'block', marginTop: '2px' }}>
                    Alertes de batterie faible, fin de sommeil et synthèses personnalisées de Zénon.
                  </span>
                </div>
              </div>

              <div
                style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  background: notifStatus === 'granted' ? 'rgba(48, 209, 88, 0.18)' : 'rgba(255, 255, 255, 0.1)',
                  border: notifStatus === 'granted' ? '1px solid #30D158' : '1px solid rgba(255, 255, 255, 0.2)',
                  color: notifStatus === 'granted' ? '#30D158' : '#FAF7F2',
                  fontSize: '11px',
                  fontWeight: 700,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {notifStatus === 'granted' ? (
                  <>
                    <Check size={12} />
                    <span>Autorisé</span>
                  </>
                ) : (
                  <span>Autoriser</span>
                )}
              </div>
            </div>
          </div>

          {/* Bouton CTA Tout autoriser & Continuer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={handleAuthorizeAll}
              style={{
                width: '100%',
                height: '56px',
                borderRadius: '28px',
                background: 'linear-gradient(135deg, #FAF7F2 0%, #D8D4CC 100%)',
                color: '#0A0A0C',
                border: 'none',
                fontSize: '15px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(255, 255, 255, 0.25)',
              }}
            >
              <span>Tout autoriser & Continuer</span>
              <ArrowRight size={17} />
            </button>
            <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.45)', textAlign: 'center' }}>
              Vos données restent stockées en local sur votre appareil
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
