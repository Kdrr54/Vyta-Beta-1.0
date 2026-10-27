import React, { useState } from 'react';
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
} from 'lucide-react';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { profile, updateProfile } = useApp();

  // Étape courante : 1 = Bienvenue, 2 = Questionnaire profil, 3 = Appairage piédestal & BLE
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Formulaire profil corporel
  const [firstName, setFirstName] = useState<string>(profile.firstName || '');
  const [sex, setSex] = useState<'homme' | 'femme'>(profile.sex || 'homme');
  const [age, setAge] = useState<number>(profile.age || 28);
  const [heightCm, setHeightCm] = useState<number>(profile.heightCm || 180);
  const [weightKg, setWeightKg] = useState<number>(profile.weightKg || 75);
  const [goal, setGoal] = useState<string>('recovery');

  const handleNextToProfile = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(20);
      } catch (e) {}
    }
    setStep(2);
  };

  const handleNextToPairing = () => {
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

  // Si on est à l'étape 3, afficher le piédestal romain haute précision avec appairage BLE
  if (step === 3) {
    return <PairingModal onClose={onComplete} onBack={() => setStep(2)} />;
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
              Vyta One
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
              alt="Bague Vyta One sur Piédestal"
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
              Étape 1 sur 2 · Profil Biologique
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

          {/* Bouton Continuer vers l'appairage */}
          <div style={{ paddingTop: '8px' }}>
            <button
              type="button"
              onClick={handleNextToPairing}
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
              <span>Continuer vers l’appairage</span>
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
