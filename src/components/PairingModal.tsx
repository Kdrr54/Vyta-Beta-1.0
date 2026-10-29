import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { finishes } from '../data/health';
import { qringBle, DiscoveredBleDevice } from '../lib/qringBleService';
import { useEffect } from 'react';
import {
  Bluetooth,
  CheckCircle2,
  Radio,
  X,
  Zap,
  ChevronLeft,
} from 'lucide-react';

interface PairingModalProps {
  onBack?: () => void;
  onClose?: () => void;
}

type PairingStatus = 'idle' | 'searching' | 'found';

export const PairingModal: React.FC<PairingModalProps> = ({ onClose, onBack }) => {
  const { updateRing, ring, finish, setIsPaired, isPaired } = useApp();
  const [status, setStatus] = useState<PairingStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>(
    "Placez votre bague au-dessus du pilier pour débuter l'appairage."
  );
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [batteryPct, setBatteryPct] = useState<number>(ring.batteryRing || 98);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredBleDevice[]>([]);

  useEffect(() => {
    // 1. Découverte instantanée d'une bague déjà connectée aux Réglages Bluetooth iOS
    const detectSystemConnectedRing = async () => {
      try {
        const connectedRings = await qringBle.getSystemConnectedRings();
        if (connectedRings && connectedRings.length > 0) {
          setDiscoveredDevices((prev) => {
            const next = [...prev];
            for (const r of connectedRings) {
              if (!next.some((p) => p.deviceId === r.deviceId)) {
                next.unshift(r);
              }
            }
            return next;
          });
          setStatusMessage(
            `Bague ${connectedRings[0].name} déjà reliée au Bluetooth de l'iPhone. Appuyez sur Connecter.`
          );
        }
      } catch (err) {
        console.warn('[PairingModal] System ring query note:', err);
      }
    };
    detectSystemConnectedRing();

    const unsub = qringBle.onDeviceDiscovered((dev) => {
      setDiscoveredDevices((prev) => {
        if (prev.some((p) => p.deviceId === dev.deviceId)) return prev;
        return [...prev, dev];
      });
    });
    return () => unsub();
  }, []);

  const handleConnectSpecific = async (dev: DiscoveredBleDevice) => {
    setStatus('searching');
    setStatusMessage(`Connexion à ${dev.name}...`);
    try {
      await qringBle.stopScan();
      const res = await qringBle.connectDirectly(dev.deviceId, dev.name);
      if (res.success) {
        setStatus('found');
        setStatusMessage(`Bague ${res.deviceName || dev.name} connectée`);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate(35); } catch (_) {}
        }
        updateRing({
          isConnected: true,
          ...(res.battery && res.battery > 0 ? { batteryRing: res.battery } : {}),
        });
        setIsExiting(true);
        setTimeout(() => {
          setIsPaired(true);
          if (onClose) onClose();
        }, 750);
      } else {
        setStatus('idle');
        setStatusMessage(res.error || 'Échec de connexion à la bague.');
      }
    } catch (_) {
      setStatus('idle');
      setStatusMessage('Erreur de connexion Bluetooth.');
    }
  };

  const currentFinish = finishes.find((f) => f.id === finish) || finishes[1];

  // Déroulement de l'appairage : recherche réelle via Bluetooth LE
  const handleStartPairing = async () => {
    if (status !== 'idle') return;

    // Vibration haptique discrète
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([15, 30, 25]);
      } catch (e) {}
    }

    setStatus('searching');
    setStatusMessage('Recherche et détection Bluetooth de la bague...');

    try {
      const res = await qringBle.requestAndConnect();
      if (res.success) {
        setStatus('found');
        setStatusMessage(`Bague ${res.deviceName || 'Vyta One'} connectée`);

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(35);
          } catch (e) {}
        }

        updateRing({ isConnected: true, ...(res.battery && res.battery > 0 ? { batteryRing: res.battery } : {}) });

        // Lancement immédiat du fondu direct
        setIsExiting(true);

        setTimeout(() => {
          setIsPaired(true);
          if (onClose) onClose();
        }, 750);
      } else {
        setStatus('idle');
        setStatusMessage(
          res.error || "Aucune bague détectée. Assurez-vous que le Bluetooth est activé et que la bague est à proximité."
        );
      }
    } catch (err: any) {
      console.error('[BLE Pairing] Error:', err);
      setStatus('idle');
      setStatusMessage("Erreur de détection Bluetooth. Veuillez réessayer.");
    }
  };

  return (
    <div
      className="vyta-pairing-root"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 99999,
        backgroundColor: '#000000',
        backgroundImage: `
          radial-gradient(circle at 50% 15%, rgba(255, 255, 255, 0.08) 0%, transparent 60%),
          radial-gradient(circle at 50% 100%, rgba(20, 20, 24, 0.8) 0%, #000000 80%)
        `,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        overflow: 'hidden',
        color: '#FFFFFF',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', sans-serif",
        userSelect: 'none',
        // Fondu pur en douceur (opacity only)
        transition: 'opacity 0.65s cubic-bezier(0.25, 1, 0.5, 1)',
        opacity: isExiting ? 0 : 1,
        pointerEvents: isExiting ? 'none' : 'auto',
      }}
    >
      {/* Spotlight aérien descendant du plafond vers le pilier et la bague */}
      <div
        style={{
          position: 'absolute',
          top: '-60px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '380px',
          height: '620px',
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.04) 45%, transparent 75%)',
          clipPath: 'polygon(30% 0%, 70% 0%, 98% 100%, 2% 100%)',
          pointerEvents: 'none',
          zIndex: 1,
          opacity: status === 'found' ? 0.95 : status === 'searching' ? 0.8 : 0.55,
          transition: 'opacity 0.6s ease',
        }}
      />

      {/* Bouton fermeture (uniquement si déjà appairé et réouvert via réglages) */}
      {!isPaired && onBack && status === 'idle' && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour au profil"
          title="Retour au profil"
          style={{
            position: 'absolute',
            top: 'calc(max(20px, env(safe-area-inset-top)) + 12px)',
            left: '20px',
            height: '32px',
            padding: '0 12px',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            color: 'rgba(255, 255, 255, 0.85)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            zIndex: 100,
            backdropFilter: 'blur(10px)',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <ChevronLeft size={15} />
          <span>Profil</span>
        </button>
      )}
      {onClose && status === 'idle' && (
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
            top: 'calc(max(20px, env(safe-area-inset-top)) + 12px)',
            right: '20px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            color: 'rgba(255, 255, 255, 0.8)',
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
          1. HEADER HAUT : STATUT & TITRE (NOIR & BLANC SOMBRE)
          ======================================================== */}
      <div
        style={{
          textAlign: 'center',
          maxWidth: '340px',
          zIndex: 30,
          marginTop: 'calc(max(24px, env(safe-area-inset-top)) + 20px)',
          padding: '0 20px',
        }}
      >
        {/* Badge Minimaliste Monochrome */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 14px',
            borderRadius: '20px',
            background:
              status === 'found'
                ? 'rgba(255, 255, 255, 0.16)'
                : 'rgba(255, 255, 255, 0.08)',
            border:
              status === 'found'
                ? '1px solid rgba(255, 255, 255, 0.35)'
                : '1px solid rgba(255, 255, 255, 0.18)',
            color: '#FFFFFF',
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
            <Radio
              size={12}
              strokeWidth={2.6}
              className={status === 'searching' ? 'vyta-radar-pulse-icon' : ''}
            />
          )}
          <span>
            {status === 'found'
              ? 'Vyta One · Connectée'
              : status === 'searching'
              ? 'Balayage BLE Actif'
              : 'Vyta One · Premier Lancement'}
          </span>
        </div>

        {/* Grand Titre Épuré Blanc */}
        <h1
          style={{
            fontSize: '26px',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            margin: '0 0 6px 0',
            color: '#FFFFFF',
            lineHeight: 1.15,
          }}
        >
          {status === 'found'
            ? 'Bague Connectée'
            : status === 'searching'
            ? 'Recherche du Signal...'
            : 'Appairez votre bague'}
        </h1>

        {/* Sous-titre descriptif */}
        <p
          style={{
            fontSize: '13px',
            fontWeight: 400,
            color: 'rgba(255, 255, 255, 0.65)',
            lineHeight: 1.45,
            margin: 0,
            minHeight: '36px',
            transition: 'color 0.3s ease',
          }}
        >
          {statusMessage}
        </p>
      </div>

      {/* ========================================================
          2. SCÈNE : PILIER ROMAIN (DE TOUT EN BAS JUSQU'AU MILIEU) + BAGUE
          ======================================================== */}
      <div
        className="vyta-stage-container"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 10,
        }}
      >
        {/* Aura lumineuse blanche derrière la bague */}
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(52% - 22px + 125px)',
            left: '50%',
            transform: 'translate(-50%, 50%)',
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            background:
              status === 'found'
                ? 'radial-gradient(circle, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.12) 45%, transparent 72%)'
                : status === 'searching'
                ? 'radial-gradient(circle, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.08) 50%, transparent 72%)'
                : 'radial-gradient(circle, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.04) 50%, transparent 72%)',
            filter: 'blur(28px)',
            transition: 'all 0.6s ease',
            zIndex: 3,
            pointerEvents: 'none',
          }}
        />

        {/* --------------------------------------------------------
            LA BAGUE VYTA : Agrandie (~250px), au milieu de l'écran
            Lévitation sobre et pure (pas de rotation sur elle-même)
            -------------------------------------------------------- */}
        <div
          className={`vyta-ring-actor ${
            status === 'searching'
              ? 'vyta-ring-searching'
              : 'vyta-ring-levitating'
          }`}
          style={{
            position: 'absolute',
            bottom: 'calc(52% - 22px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(250px, 64vw)',
            height: 'min(250px, 64vw)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 18,
          }}
        >
          {/* Ondes radar concentriques monochromes blanches lors de la recherche */}
          {status === 'searching' && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              <div className="vyta-radar-wave wave-1" />
              <div className="vyta-radar-wave wave-2" />
              <div className="vyta-radar-wave wave-3" />
            </div>
          )}

          <div
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
            }}
          >
            <img
              src="/assets/ring/ring-iso-transparent.png"
              alt="Bague Vyta One"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: `drop-shadow(0 20px 28px rgba(0, 0, 0, 0.92)) ${currentFinish.imgFilter}`,
                transition: 'filter 0.35s ease',
              }}
            />

            {/* Teinte de couleur selon la finition */}
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
          </div>
        </div>

        {/* --------------------------------------------------------
            LE PILIER ROMAIN : De tout en bas jusqu'au milieu de l'écran
            Ancré à bottom: 0, hauteur: 52% (atteint le milieu exact)
            -------------------------------------------------------- */}
        <div
          style={{
            position: 'absolute',
            bottom: '0',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(340px, 86vw)',
            height: '52%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            zIndex: 12,
          }}
        >
          {/* Ombre de contact dynamique sur le sommet du marbre */}
          <div
            className={`vyta-pedestal-shadow ${
              status === 'searching'
                ? 'shadow-searching'
                : 'shadow-levitating'
            }`}
            style={{
              position: 'absolute',
              top: '0px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '130px',
              height: '24px',
              borderRadius: '50%',
              background:
                'radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0.98) 0%, rgba(0, 0, 0, 0.55) 60%, transparent 88%)',
              filter: 'blur(5px)',
              zIndex: 13,
              pointerEvents: 'none',
            }}
          />

          {/* Rendu photoréaliste du pilier romain s'étirant de tout en bas jusqu'au milieu */}
          <img
            src="/assets/roman-pedestal-hero.png"
            alt="Pilier Romain Vyta"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'fill',
              objectPosition: 'top center',
              filter:
                'drop-shadow(0 -10px 30px rgba(0,0,0,0.85)) drop-shadow(0 20px 40px rgba(0,0,0,0.95)) brightness(0.97) contrast(1.08)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {/* ========================================================
          3. BAS D'ÉCRAN : BOUTON D'ACTION EN CONTRASTE NOIR & BLANC
          ======================================================== */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          zIndex: 40,
          padding: '0 24px calc(max(24px, env(safe-area-inset-bottom)) + 12px) 24px',
        }}
      >
        {/* Liste des périphériques détectés (y compris déjà connectés dans Réglages iOS) */}
        {status !== 'found' && discoveredDevices.length > 0 && (
          <div
            style={{
              width: '100%',
              maxWidth: '340px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.65)',
                textAlign: 'center',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Appareils détectés à proximité
            </span>
            {discoveredDevices.map((dev) => (
              <button
                key={dev.deviceId}
                type="button"
                onClick={() => handleConnectSpecific(dev)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '16px',
                  background: dev.isRing ? 'rgba(217, 249, 112, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                  border: dev.isRing ? '1.5px solid #D9F970' : '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: dev.isRing ? '0 0 14px rgba(217, 249, 112, 0.25)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>💍</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: dev.isRing ? '#D9F970' : '#FFFFFF' }}>
                    {dev.name}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: dev.isRing ? '#000000' : '#FFFFFF',
                    background: dev.isRing ? '#D9F970' : 'rgba(255,255,255,0.2)',
                    padding: '4px 10px',
                    borderRadius: '999px',
                  }}
                >
                  Connecter
                </span>
              </button>
            ))}
          </div>
        )}
        {status === 'idle' && (
          <button
            type="button"
            onClick={handleStartPairing}
            className="vyta-pair-btn"
            style={{
              width: '100%',
              maxWidth: '340px',
              height: '58px',
              borderRadius: '18px',
              background: '#FFFFFF',
              border: 'none',
              boxShadow:
                '0 8px 28px rgba(255, 255, 255, 0.18), 0 4px 14px rgba(0, 0, 0, 0.6)',
              color: '#000000',
              fontSize: '15px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <Bluetooth size={18} color="#000000" strokeWidth={2.6} />
            <span>APPAIRER LA BAGUE</span>
          </button>
        )}

        {status === 'searching' && (
          <div
            style={{
              width: '100%',
              maxWidth: '340px',
              height: '58px',
              borderRadius: '18px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              color: '#FFFFFF',
              fontSize: '14.5px',
              fontWeight: 600,
              boxShadow: '0 0 22px rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(10px)',
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
              maxWidth: '340px',
              height: '58px',
              borderRadius: '18px',
              background: '#FFFFFF',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              color: '#000000',
              fontSize: '15px',
              fontWeight: 800,
              boxShadow: '0 8px 28px rgba(255, 255, 255, 0.3)',
            }}
          >
            <CheckCircle2 size={19} color="#000000" strokeWidth={2.8} />
            <span>Connectée</span>
          </div>
        )}

        {/* Petite mention de réassurance sobre */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.45)',
            fontWeight: 500,
          }}
        >
          <Zap size={10} color="#FFFFFF" />
          <span>Appairage instantané sécurisé AES-128</span>
        </div>

        {status === 'idle' && (
          <button
            type="button"
            onClick={() => {
              setIsPaired(true);
              if (onClose) onClose();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.45)',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '6px 12px',
              textDecoration: 'underline',
              marginTop: '2px',
            }}
          >
            Continuer sans bague pour l'instant
          </button>
        )}
      </div>

      {/* ========================================================
          STYLES CSS INLINE & ANIMATIONS (60FPS BUTTERY SMOOTH)
          ======================================================== */}
      <style>{`
        /* 1. Lévitation naturelle en suspension (Idle) */
        @keyframes ringLevitate {
          0%, 100% {
            transform: translate(-50%, 0px);
          }
          50% {
            transform: translate(-50%, -12px);
          }
        }
        .vyta-ring-levitating {
          animation: ringLevitate 3.4s ease-in-out infinite;
        }

        /* 2. Pulsation blanche en cours de recherche */
        @keyframes ringSearching {
          0%, 100% {
            transform: translate(-50%, -4px) scale(1);
            filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.25));
          }
          50% {
            transform: translate(-50%, -16px) scale(1.05);
            filter: drop-shadow(0 0 32px rgba(255, 255, 255, 0.7));
          }
        }
        .vyta-ring-searching {
          animation: ringSearching 1.6s ease-in-out infinite;
        }

        /* 3. Ondes Radar Blanches Épurées */
        @keyframes radarRipple {
          0% {
            transform: scale(0.65);
            opacity: 0.85;
            border-color: rgba(255, 255, 255, 0.95);
          }
          100% {
            transform: scale(3.2);
            opacity: 0;
            border-color: rgba(255, 255, 255, 0);
          }
        }
        .vyta-radar-wave {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1.5px solid rgba(255, 255, 255, 0.65);
          animation: radarRipple 2.2s cubic-bezier(0.1, 0.6, 0.3, 1) infinite;
        }
        .wave-2 {
          animation-delay: 0.7s;
        }
        .wave-3 {
          animation-delay: 1.4s;
        }

        /* 4. Ombre portée sur le sommet du pilier */
        @keyframes pedestalShadowFloat {
          0%, 100% {
            transform: translateX(-50%) scale(1);
            opacity: 0.85;
          }
          50% {
            transform: translateX(-50%) scale(0.74);
            opacity: 0.4;
          }
        }
        .shadow-levitating {
          animation: pedestalShadowFloat 3.4s ease-in-out infinite;
        }
        .shadow-searching {
          animation: pedestalShadowFloat 1.6s ease-in-out infinite;
        }

        /* 5. Spinner de recherche blanc */
        @keyframes spinPulse {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .vyta-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.25);
          border-top-color: #FFFFFF;
          border-radius: 50%;
          animation: spinPulse 0.8s linear infinite;
        }

        /* 6. Pulsation icône */
        @keyframes pulseIcon {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.7; }
        }
        .vyta-radar-pulse-icon {
          animation: pulseIcon 1.2s ease-in-out infinite;
        }

        /* Bouton Hover / Press effect */
        .vyta-pair-btn:active {
          transform: scale(0.97);
          box-shadow: 0 4px 14px rgba(255, 255, 255, 0.3), 0 0 16px rgba(0, 0, 0, 0.8);
        }
      `}</style>
    </div>
  );
};
