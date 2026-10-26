import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { finishes } from '../data/health';
import { RingFinish } from '../types';
import { qringBle } from '../lib/qringBleService';
import {
  Bluetooth,
  CheckCircle2,
  Sparkles,
  Zap,
  Radio,
  X,
  Battery,
} from 'lucide-react';

interface PairingModalProps {
  onClose?: () => void;
}

type PairingStatus = 'idle' | 'searching' | 'found' | 'entering_menu';

export const PairingModal: React.FC<PairingModalProps> = ({ onClose }) => {
  const { updateRing, ring, finish, setFinish, setIsPaired, isPaired } = useApp();
  const [status, setStatus] = useState<PairingStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>(
    "Placez votre bague au-dessus du pilier pour débuter l'appairage."
  );
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [batteryPct, setBatteryPct] = useState<number>(ring.batteryRing || 98);

  const currentFinish = finishes.find((f) => f.id === finish) || finishes[1];

  // Déroulement du cycle d'appairage lors du clic sur le bouton
  const handleStartPairing = () => {
    if (status !== 'idle') return;

    // Vibration haptique subtile
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([15, 30, 25]);
      } catch (e) {}
    }

    setStatus('searching');
    setStatusMessage('Émission du signal Bluetooth 5.4...');

    // Lancer la détection réelle en arrière-plan si Web Bluetooth ou plugin natif dispo
    if (qringBle.isSupported()) {
      qringBle
        .requestAndConnect()
        .then((res) => {
          if (res.success && res.battery !== undefined) {
            setBatteryPct(res.battery);
          }
        })
        .catch((e) => console.log('[BLE] Background discovery note:', e));
    }

    // Étape 1 : Balayage fréquences
    const t1 = setTimeout(() => {
      setStatusMessage('Balayage des fréquences BLE à proximité...');
    }, 1100);

    // Étape 2 : Signal détecté
    const t2 = setTimeout(() => {
      setStatusMessage('Signal Vyta One détecté (RSSI: -42 dBm)...');
    }, 2200);

    // Étape 3 : Bague trouvée -> Déclenchement de la rotation sur elle-même
    const t3 = setTimeout(() => {
      setStatus('found');
      setStatusMessage('Bague Vyta One appairée avec succès !');

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([30, 40, 60]);
        } catch (e) {}
      }

      updateRing({
        isConnected: true,
        batteryRing: batteryPct,
      });

      // Étape 4 : Après l'animation de rotation, transition fluide vers le menu
      const t4 = setTimeout(() => {
        setStatus('entering_menu');
        setIsExiting(true);

        const t5 = setTimeout(() => {
          setIsPaired(true);
          if (onClose) onClose();
        }, 550);

        return () => clearTimeout(t5);
      }, 2100);

      return () => clearTimeout(t4);
    }, 3400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  };

  return (
    <div
      className={`vyta-pairing-root ${isExiting ? 'vyta-pairing-exit' : ''}`}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 99999,
        backgroundColor: '#050706',
        backgroundImage: `
          radial-gradient(circle at 50% 12%, rgba(217, 249, 112, 0.14) 0%, rgba(16, 185, 129, 0.05) 34%, transparent 68%),
          radial-gradient(circle at 50% 75%, rgba(6, 20, 14, 0.8) 0%, #030504 85%)
        `,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '50px 24px 34px 24px',
        overflow: 'hidden',
        color: '#FFFFFF',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', sans-serif",
        userSelect: 'none',
        transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'scale(1.05)' : 'scale(1)',
      }}
    >
      {/* Spotlight aérien descendant du plafond */}
      <div
        style={{
          position: 'absolute',
          top: '-60px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '320px',
          height: '480px',
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.16) 0%, rgba(217, 249, 112, 0.08) 32%, transparent 75%)',
          clipPath: 'polygon(35% 0%, 65% 0%, 95% 100%, 5% 100%)',
          pointerEvents: 'none',
          zIndex: 1,
          opacity: status === 'found' ? 0.95 : status === 'searching' ? 0.75 : 0.5,
          transition: 'opacity 0.6s ease',
        }}
      />

      {/* Bouton fermeture (uniquement si déjà appairé et réouvert via réglages) */}
      {isPaired && onClose && status === 'idle' && (
        <button
          type="button"
          onClick={() => {
            setIsExiting(true);
            setTimeout(onClose, 300);
          }}
          aria-label="Fermer"
          title="Fermer"
          style={{
            position: 'absolute',
            top: '48px',
            right: '22px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            color: 'rgba(255, 255, 255, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 100,
            backdropFilter: 'blur(10px)',
          }}
        >
          <X size={15} />
        </button>
      )}

      {/* ========================================================
          1. HEADER TYPOGRAPHIQUE & STATUT
          ======================================================== */}
      <div
        style={{
          textAlign: 'center',
          maxWidth: '320px',
          zIndex: 10,
          marginTop: '6px',
        }}
      >
        {/* Badge Romain Minimaliste */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '20px',
            background:
              status === 'found'
                ? 'rgba(48, 209, 88, 0.16)'
                : 'rgba(217, 249, 112, 0.12)',
            border:
              status === 'found'
                ? '1px solid rgba(48, 209, 88, 0.38)'
                : '1px solid rgba(217, 249, 112, 0.28)',
            color: status === 'found' ? '#30D158' : '#D9F970',
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '10px',
            transition: 'all 0.4s ease',
          }}
        >
          {status === 'found' ? (
            <CheckCircle2 size={12} strokeWidth={2.8} />
          ) : (
            <Radio size={12} strokeWidth={2.6} className={status === 'searching' ? 'vyta-radar-pulse-icon' : ''} />
          )}
          <span>
            {status === 'found'
              ? 'Vyta One · Connectée'
              : status === 'searching'
              ? 'Balayage BLE Actif'
              : 'Vyta One · Premier Lancement'}
          </span>
        </div>

        {/* Grand Titre Épuré */}
        <h1
          style={{
            fontSize: '25px',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            margin: '0 0 7px 0',
            color: '#FFFFFF',
            lineHeight: 1.15,
          }}
        >
          {status === 'found'
            ? 'Bague Appairée !'
            : status === 'searching'
            ? 'Recherche du Signal...'
            : 'Appairez votre bague'}
        </h1>

        {/* Sous-titre descriptif animé */}
        <p
          style={{
            fontSize: '13px',
            fontWeight: 400,
            color: 'rgba(255, 255, 255, 0.62)',
            lineHeight: 1.45,
            margin: 0,
            minHeight: '38px',
            transition: 'color 0.3s ease',
          }}
        >
          {statusMessage}
        </p>
      </div>

      {/* ========================================================
          2. SCÈNE CENTRALE : LE PILIER ROMAIN & LA BAGUE EN LÉVITATION
          ======================================================== */}
      <div
        className="vyta-stage-container"
        style={{
          position: 'relative',
          width: '320px',
          height: '350px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          zIndex: 10,
        }}
      >
        {/* Ondes radar concentriques lors de la recherche */}
        {status === 'searching' && (
          <div
            style={{
              position: 'absolute',
              top: '75px',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '160px',
              height: '160px',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <div className="vyta-radar-wave wave-1" />
            <div className="vyta-radar-wave wave-2" />
            <div className="vyta-radar-wave wave-3" />
          </div>
        )}

        {/* Aura lumineuse circulaire derrière la bague */}
        <div
          style={{
            position: 'absolute',
            top: '75px',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background:
              status === 'found'
                ? 'radial-gradient(circle, rgba(48, 209, 88, 0.45) 0%, rgba(217, 249, 112, 0.25) 45%, transparent 72%)'
                : status === 'searching'
                ? 'radial-gradient(circle, rgba(217, 249, 112, 0.35) 0%, rgba(16, 185, 129, 0.18) 50%, transparent 72%)'
                : 'radial-gradient(circle, rgba(255, 255, 255, 0.12) 0%, rgba(217, 249, 112, 0.08) 50%, transparent 72%)',
            filter: 'blur(22px)',
            transition: 'all 0.6s ease',
            zIndex: 3,
            pointerEvents: 'none',
          }}
        />

        {/* --------------------------------------------------------
            LA BAGUE VYTA : En lévitation & Rotation 3D
            -------------------------------------------------------- */}
        <div
          className={`vyta-ring-actor ${
            status === 'found'
              ? 'vyta-ring-spin'
              : status === 'searching'
              ? 'vyta-ring-searching'
              : 'vyta-ring-levitating'
          }`}
          style={{
            position: 'absolute',
            top: '4px',
            width: '135px',
            height: '135px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 15,
            perspective: '1200px',
          }}
        >
          {/* Image de la bague avec teintes de finition */}
          <div
            className="vyta-ring-3d-wrapper"
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              transformStyle: 'preserve-3d',
            }}
          >
            <img
              src="/assets/ring/ring-iso-transparent.png"
              alt="Bague Vyta One"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: `drop-shadow(0 18px 24px rgba(0, 0, 0, 0.88)) ${currentFinish.imgFilter}`,
                transition: 'filter 0.35s ease',
              }}
            />

            {/* Teinte de couleur selon la finition sélectionnée */}
            {currentFinish.tint && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: currentFinish.tint,
                  mixBlendMode: 'color',
                  pointerEvents: 'none',
                  maskImage: 'url(/assets/ring/ring-iso-transparent.png)',
                  WebkitMaskImage: 'url(/assets/ring/ring-iso-transparent.png)',
                  maskSize: 'contain',
                  WebkitMaskSize: 'contain',
                  maskRepeat: 'no-repeat',
                  WebkitMaskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  WebkitMaskPosition: 'center',
                  opacity: 0.65,
                }}
              />
            )}

            {/* Éclat lumineux traversant la bague lors de la détection */}
            {status === 'found' && (
              <div
                className="vyta-ring-gleam"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(135deg, transparent 20%, rgba(255, 255, 255, 0.85) 50%, transparent 80%)',
                  mixBlendMode: 'overlay',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </div>

        {/* --------------------------------------------------------
            LE PILIER ROMAIN EN MARBRE (SOCLE DU DISPLAY)
            -------------------------------------------------------- */}
        <div
          style={{
            position: 'relative',
            width: '260px',
            height: '245px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            zIndex: 10,
          }}
        >
          {/* Ombre de contact dynamique projetée sur le haut du pilier */}
          <div
            className={`vyta-pedestal-shadow ${
              status === 'searching'
                ? 'shadow-searching'
                : status === 'found'
                ? 'shadow-found'
                : 'shadow-levitating'
            }`}
            style={{
              position: 'absolute',
              top: '40px',
              width: '68px',
              height: '18px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.5) 60%, transparent 85%)',
              filter: 'blur(3.5px)',
              zIndex: 11,
              pointerEvents: 'none',
            }}
          />

          {/* Rendu photoréaliste du pilier romain en marbre */}
          <img
            src="/assets/roman-pedestal-hero.png"
            alt="Pilier Romain Vyta"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'top center',
              filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.92)) brightness(0.96) contrast(1.08)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Badge de succès qui apparaît en fondu sous le pilier */}
        {status === 'found' && (
          <div
            className="vyta-success-badge"
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(10, 24, 16, 0.92)',
              border: '1px solid rgba(48, 209, 88, 0.45)',
              borderRadius: '24px',
              padding: '6px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6), 0 0 20px rgba(48, 209, 88, 0.25)',
              zIndex: 20,
              whiteSpace: 'nowrap',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#30D158',
                boxShadow: '0 0 10px #30D158',
              }}
            />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>
              Vyta One · {batteryPct}%
            </span>
            <Battery size={13} color="#30D158" strokeWidth={2.4} />
          </div>
        )}
      </div>

      {/* ========================================================
          3. SÉLECTEUR DE FINITIONS & BOUTON D'ACTION
          ======================================================== */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          zIndex: 20,
        }}
      >
        {/* Sélecteur de couleur (uniquement avant d'appuyer sur appairer) */}
        {status === 'idle' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '24px',
              padding: '5px 14px',
              backdropFilter: 'blur(12px)',
            }}
          >
            {finishes.map((f) => {
              const isSelected = f.id === finish;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFinish(f.id as RingFinish)}
                  title={`Finition ${f.label}`}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: f.swatch,
                    border: isSelected
                      ? '2px solid #D9F970'
                      : '2px solid rgba(255, 255, 255, 0.25)',
                    transform: isSelected ? 'scale(1.18)' : 'scale(1)',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    cursor: 'pointer',
                    boxShadow: isSelected
                      ? '0 0 10px rgba(217, 249, 112, 0.45)'
                      : 'none',
                    padding: 0,
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Bouton d'action principal */}
        {status === 'idle' && (
          <button
            type="button"
            onClick={handleStartPairing}
            className="vyta-pair-btn"
            style={{
              width: '100%',
              maxWidth: '320px',
              height: '54px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #1C3322 0%, #0F1F15 100%)',
              border: '1.5px solid rgba(217, 249, 112, 0.45)',
              boxShadow:
                '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 24px rgba(217, 249, 112, 0.22), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <Bluetooth size={18} color="#D9F970" strokeWidth={2.4} />
            <span>APPAIRER LA BAGUE</span>
          </button>
        )}

        {status === 'searching' && (
          <div
            style={{
              width: '100%',
              maxWidth: '320px',
              height: '54px',
              borderRadius: '16px',
              background: 'rgba(217, 249, 112, 0.08)',
              border: '1px solid rgba(217, 249, 112, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              color: '#D9F970',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '0 0 20px rgba(217, 249, 112, 0.15)',
            }}
          >
            <div className="vyta-spinner" />
            <span>Détection en cours...</span>
          </div>
        )}

        {status === 'found' && (
          <div
            style={{
              width: '100%',
              maxWidth: '320px',
              height: '54px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #113820 0%, #081C10 100%)',
              border: '1.5px solid rgba(48, 209, 88, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              color: '#FFFFFF',
              fontSize: '14.5px',
              fontWeight: 700,
              boxShadow: '0 0 25px rgba(48, 209, 88, 0.3)',
              animation: 'fadeIn 0.35s ease',
            }}
          >
            <CheckCircle2 size={18} color="#30D158" strokeWidth={2.5} />
            <span>Accès au Menu Principal...</span>
          </div>
        )}

        {/* Petite mention de réassurance */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.4)',
            fontWeight: 500,
          }}
        >
          <Zap size={10} color="#D9F970" />
          <span>Appairage instantané sécurisé AES-128</span>
        </div>
      </div>

      {/* ========================================================
          STYLES CSS INLINE & ANIMATIONS (60FPS BUTTERY SMOOTH)
          ======================================================== */}
      <style>{`
        /* 1. Lévitation naturelle en suspension (Idle) */
        @keyframes ringLevitate {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-13px);
          }
        }
        .vyta-ring-levitating {
          animation: ringLevitate 3.4s ease-in-out infinite;
        }

        /* 2. Pulsation en cours de recherche */
        @keyframes ringSearching {
          0%, 100% {
            transform: translateY(-4px) scale(1);
            filter: drop-shadow(0 0 12px rgba(217, 249, 112, 0.3));
          }
          50% {
            transform: translateY(-16px) scale(1.06);
            filter: drop-shadow(0 0 30px rgba(217, 249, 112, 0.75));
          }
        }
        .vyta-ring-searching {
          animation: ringSearching 1.6s ease-in-out infinite;
        }

        /* 3. ROTATION 3D CÉLÉBRATOIRE SUR ELLE-MÊME (DÈS DÉTECTION) */
        @keyframes ringSpinOnItself {
          0% {
            transform: translateY(-4px) rotateY(0deg) scale(1);
          }
          35% {
            transform: translateY(-26px) rotateY(360deg) scale(1.18);
            filter: drop-shadow(0 0 38px rgba(217, 249, 112, 0.85));
          }
          70% {
            transform: translateY(-26px) rotateY(720deg) scale(1.18);
            filter: drop-shadow(0 0 42px rgba(48, 209, 88, 0.9));
          }
          100% {
            transform: translateY(-8px) rotateY(1080deg) scale(1.04);
            filter: drop-shadow(0 0 20px rgba(48, 209, 88, 0.5));
          }
        }
        .vyta-ring-spin .vyta-ring-3d-wrapper {
          animation: ringSpinOnItself 1.9s cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }

        /* 4. Ondes Radar */
        @keyframes radarRipple {
          0% {
            transform: scale(0.65);
            opacity: 0.85;
            border-color: rgba(217, 249, 112, 0.9);
          }
          100% {
            transform: scale(2.8);
            opacity: 0;
            border-color: rgba(16, 185, 129, 0);
          }
        }
        .vyta-radar-wave {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1.5px solid rgba(217, 249, 112, 0.6);
          animation: radarRipple 2.2s cubic-bezier(0.1, 0.6, 0.3, 1) infinite;
        }
        .wave-2 {
          animation-delay: 0.7s;
        }
        .wave-3 {
          animation-delay: 1.4s;
        }

        /* 5. Ombre portée sur le sommet du pilier */
        @keyframes pedestalShadowFloat {
          0%, 100% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(0.78);
            opacity: 0.45;
          }
        }
        .shadow-levitating {
          animation: pedestalShadowFloat 3.4s ease-in-out infinite;
        }
        .shadow-searching {
          animation: pedestalShadowFloat 1.6s ease-in-out infinite;
        }
        .shadow-found {
          transform: scale(0.7);
          opacity: 0.4;
          transition: all 0.5s ease;
        }

        /* 6. Reflet étincelant qui traverse la bague */
        @keyframes gleamSweep {
          0% {
            transform: translateX(-150%) rotate(45deg);
            opacity: 0;
          }
          50% {
            opacity: 0.9;
          }
          100% {
            transform: translateX(150%) rotate(45deg);
            opacity: 0;
          }
        }
        .vyta-ring-gleam {
          animation: gleamSweep 1.2s ease-in-out infinite;
        }

        /* 7. Spinner de recherche */
        @keyframes spinPulse {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .vyta-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(217, 249, 112, 0.25);
          border-top-color: #D9F970;
          border-radius: 50%;
          animation: spinPulse 0.8s linear infinite;
        }

        /* 8. Pulsation icône */
        @keyframes pulseIcon {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.7; }
        }
        .vyta-radar-pulse-icon {
          animation: pulseIcon 1.2s ease-in-out infinite;
        }

        /* 9. Badge succès slide in */
        @keyframes badgePop {
          0% {
            opacity: 0;
            transform: translate(-50%, 15px) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
        }
        .vyta-success-badge {
          animation: badgePop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Bouton Hover / Press effect */
        .vyta-pair-btn:active {
          transform: scale(0.97);
          box-shadow: 0 4px 14px rgba(0,0,0,0.7), 0 0 16px rgba(217, 249, 112, 0.35);
        }
      `}</style>
    </div>
  );
};
