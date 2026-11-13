import React from 'react';
import { useApp } from '../context/AppContext';
import { weekMetrics, statusFor, finishes, emptyDayMetrics, TODAY_INDEX, WEEK } from '../data/health';
import { WeekSelector } from './WeekSelector';
import { BodyEnergyGauge } from './BodyEnergyGauge';
import { ImmunityRadar } from './ImmunityRadar';
import { CardioAge } from './CardioAge';
import { Brain, Flame, Sparkles, ArrowUpRight, Activity, Droplets, Thermometer, Moon, RefreshCw, Wind, Heart } from 'lucide-react';
import { fmtNum, fmtDuration } from '../lib/format';
import { qringBle } from '../lib/qringBleService';

export const HealthScreen: React.FC = () => {
  const { selectedDay, setSelectedDay, setTab, openModal, openMetricDetail, ring, finish, language, weekData, isFirstLaunch, isSimulating, toggleSimulation, cardThemeMode, setCardThemeMode, liveBpm } = useApp();
  const isMono = cardThemeMode === 'monochrome';
  const handleSetThemeMode = (mode: 'monochrome' | 'colored') => setCardThemeMode(mode);
  const currentFinish = finishes.find((f) => f.id === finish) || finishes[1];

  const [isSyncingRing, setIsSyncingRing] = React.useState(false);
  const [syncFeedback, setSyncFeedback] = React.useState<string | null>(null);

  const handleSyncRing = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!ring.isConnected) {
      openModal('settings');
      return;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([15, 20, 25]); } catch (_) {}
    }
    setIsSyncingRing(true);
    setSyncFeedback(language === 'fr' ? 'Synchronisation de la bague...' : 'Syncing ring data...');
    try {
      await qringBle.syncAllRingData();
      setSyncFeedback(language === 'fr' ? '✓ Données de la bague synchronisées' : '✓ Ring data synchronized');
    } catch (_) {
      setSyncFeedback(language === 'fr' ? 'Échec de synchronisation' : 'Sync failed');
    }
    setTimeout(() => {
      setIsSyncingRing(false);
      setTimeout(() => setSyncFeedback(null), 3000);
    }, 1800);
  };

  // Synchroniser automatiquement à l'affichage ou au retour sur l'onglet Santé
  React.useEffect(() => {
    if (qringBle.isConnected()) {
      qringBle.syncAllRingData();
    }
  }, []);

  React.useEffect(() => {
    if (ring.isConnected && qringBle.isConnected()) {
      qringBle.syncAllRingData();
    }
  }, [ring.isConnected]);

  const dayData = (weekData && weekData[selectedDay]) || (isFirstLaunch ? emptyDayMetrics : (weekMetrics[selectedDay] || weekMetrics[3]));
  const batteryPct = ring.batteryRing || 0;
  const isLowBattery = batteryPct <= 20;
  const batteryAccent = isMono ? '#FAF7F2' : (isLowBattery ? '#FF5A52' : '#D9F970');
  const batteryAccentSoft = isMono ? 'rgba(255, 255, 255, 0.78)' : (isLowBattery ? 'rgba(255, 90, 82, 0.78)' : 'rgba(228, 255, 142, 0.78)');
  const neuralPct = dayData?.pillars?.recovery && dayData.pillars.recovery > 0 ? dayData.pillars.recovery : 0;
  const skinTempAbs =
    dayData?.skinTemp && dayData.skinTemp >= 30
      ? dayData.skinTemp.toFixed(1)
      : dayData?.tempDelta !== undefined && dayData.tempDelta !== 0
      ? (36.5 + dayData.tempDelta).toFixed(1)
      : '--';
  const stepsProgress = Math.min(100, Math.round(((dayData.steps || 0) / 10000) * 100));
  const prevDayData = selectedDay > 0 ? (weekData && weekData[selectedDay - 1]) : null;
  const scoreDiffYesterday =
    prevDayData && prevDayData.score > 0 && prevDayData.sleep?.score > 0 && dayData.score > 0
      ? dayData.score - prevDayData.score
      : 0;

  const isToday = selectedDay === TODAY_INDEX;
  const bpmValue = (isToday && liveBpm > 0)
    ? liveBpm
    : (dayData.bpm && dayData.bpm > 0 ? dayData.bpm : (dayData.restingBpm && dayData.restingBpm > 0 ? dayData.restingBpm : 0));

  // Generate 60 radial tick marks for the circular HUD around the ring
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angleDeg = i * 6;
    const isMajor = i % 5 === 0;
    return { angleDeg, isMajor };
  });

  return (
    <div className="screen-content" style={{ paddingTop: '4px', gap: '14px' }}>
      {/* =====================================================================
          1. HORIZONTAL WEEK SELECTOR (At the top of all tabs)
          ===================================================================== */}
      <WeekSelector />

      {/* =====================================================================
          2. EDITORIAL HERO STAGE: Greek Statue "FOCUS" with Smart Ring as "O"
          ===================================================================== */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1024 / 640',
          maxHeight: '250px',
          borderRadius: '28px',
          overflow: 'hidden',
          cursor: 'default',
          background: '#000000',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
        }}
      >
        {/* Background Photo: Statue with "F  CUS" */}
        <img
          src="/assets/focus-statue-no-o.jpg"
          alt="Focus Statue"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
          }}
        />

        {/* Cinematic Vignette Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 50% 50%, transparent 65%, rgba(0,0,0,0.35) 100%), linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.55) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* 3D Smart Ring embedded as the "O" of FOCUS with Battery inside - Tap to Synchronize */}
        <div
          onClick={handleSyncRing}
          role="button"
          tabIndex={0}
          title={language === 'fr' ? 'Toucher pour synchroniser les données de la bague' : 'Tap to sync ring data'}
          style={{
            position: 'absolute',
            left: '34.38%',
            top: '45.0%',
            transform: isSyncingRing ? 'translate(-50%, -50%) scale(1.08)' : 'translate(-50%, -50%)',
            width: '13.09%',
            height: '20.94%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
            cursor: 'pointer',
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Smart Ring Front Render */}
          <img
            src="/assets/ring/ring-front-tight.png"
            alt="Smart Ring as O"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter:
                'brightness(1.18) contrast(1.12) drop-shadow(0 2px 8px rgba(0,0,0,0.85))',
              transition: 'transform 0.25s ease',
            }}
          />

          {/* Battery readout centered INSIDE the ring opening */}
          <div
            style={{
              position: 'relative',
              zIndex: 4,
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              userSelect: 'none',
              transform: 'translateY(-1px)',
            }}
          >
            {ring.isConnected && batteryPct > 0 ? (
              <>
                <span
                  style={{
                    fontSize: '17px',
                    fontWeight: 300,
                    color: '#FAF7F2',
                    lineHeight: 1,
                    letterSpacing: '-0.5px',
                    fontFamily: 'var(--font-display, -apple-system, sans-serif)',
                  }}
                >
                  {batteryPct}
                </span>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 600,
                    color: isLowBattery ? '#FF5A52' : '#D9F970',
                    marginLeft: '1px',
                    lineHeight: 1,
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  %
                </span>
              </>
            ) : (
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 300,
                  color: 'rgba(250, 247, 242, 0.35)',
                  lineHeight: 1,
                  letterSpacing: '0.5px',
                  fontFamily: 'var(--font-display, -apple-system, sans-serif)',
                }}
              >
                --
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Floating Synchronization Toast Feedback */}
      {syncFeedback && (
        <div
          style={{
            position: 'fixed',
            top: '64px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'rgba(20, 20, 22, 0.94)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(217, 249, 112, 0.35)',
            borderRadius: '24px',
            padding: '8px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#FAF7F2',
            fontSize: '12.5px',
            fontWeight: 500,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#D9F970',
              boxShadow: '0 0 10px #D9F970',
            }}
          />
          {syncFeedback}
        </div>
      )}



      <div key={selectedDay} className="day-view-transition" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* =====================================================================
          2.5. PRISM AI BIOMETRIC INTELLIGENCE BANNER (Apple Intelligence Liquid Glass)
          ===================================================================== */}
      <div
        onClick={() => openModal('prism')}
        role="button"
        tabIndex={0}
        title="Ouvrir Zénon · Intelligence Biologique"
        style={{
          position: 'relative',
          padding: '13px 15px',
          borderRadius: '22px',
          overflow: 'hidden',
          cursor: 'pointer',
          background: isMono
            ? 'radial-gradient(ellipse at 50% 120%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 50%, rgba(10, 10, 12, 0.95) 80%), #0A0A0C'
            : 'linear-gradient(135deg, rgba(56, 189, 248, 0.14) 0%, rgba(192, 132, 252, 0.14) 50%, rgba(48, 209, 88, 0.1) 100%), rgba(10, 10, 14, 0.88)',
          backdropFilter: 'blur(26px)',
          WebkitBackdropFilter: 'blur(26px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.22)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.14)',
          borderRight: '1px solid rgba(255, 255, 255, 0.14)',
          borderBottom: isMono ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(192, 132, 252, 0.65)',
          boxShadow: isMono
            ? '0 12px 28px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(255, 255, 255, 0.05)'
            : '0 12px 28px rgba(0, 0, 0, 0.55), 0 4px 20px rgba(192, 132, 252, 0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          transition: 'transform 0.18s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', flex: 1, minWidth: 0 }}>
          {/* Animated Prism Crystal Icon */}
          <div
            style={{
              position: 'relative',
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.3) 0%, rgba(192, 132, 252, 0.3) 50%, rgba(48, 209, 88, 0.3) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 14px rgba(192, 132, 252, 0.35)',
            }}
          >
            <Sparkles size={18} color="#FAF7F2" style={{ filter: 'drop-shadow(0 0 4px #C084FC)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#FAF7F2', letterSpacing: '-0.2px' }}>
                Zénon
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  padding: '1px 5px',
                  borderRadius: '999px',
                  background: 'rgba(56, 189, 248, 0.18)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38BDF8',
                  letterSpacing: '0.2px',
                }}
              >
                ACTIF
              </span>
            </div>
            <p
              style={{
                margin: '2px 0 0 0',
                fontSize: '11px',
                color: 'rgba(250, 247, 242, 0.72)',
                lineHeight: 1.35,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {language === 'fr' ? 'Intelligence biologique & analyse clinique en direct' : 'Live biological intelligence & clinical insights'}
            </p>
          </div>
        </div>

        {/* Action Button Pill */}
        <div
          style={{
            padding: '5px 10px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#FAF7F2' }}>
            {language === 'fr' ? 'Ouvrir' : 'Open'}
          </span>
          <ArrowUpRight size={12} color="#FAF7F2" />
        </div>
      </div>

      {/* =====================================================================
          3. WIDE "GENERAL STATE" ADVANCED SENSING BANNER CARD
             (Placé en haut à la place de la carte fréquence cardiaque)
          ===================================================================== */}
      <div
        onClick={() => openModal('general_state')}
        role="button"
        tabIndex={0}
        title="État général & dynamique hebdomadaire"
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '132px',
          padding: '16px 18px',
          borderRadius: '26px',
          overflow: 'hidden',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: isMono
            ? 'radial-gradient(ellipse at 35% 100%, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.04) 48%, rgba(10, 10, 12, 0.96) 80%), #0A0A0C'
            : 'radial-gradient(ellipse at 35% 100%, rgba(217, 249, 112, 0.25) 0%, rgba(82, 102, 42, 0.18) 48%, rgba(10, 10, 12, 0.96) 80%), #0A0A0C',
          borderTop: '1px solid rgba(255, 248, 240, 0.16)',
          borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
          borderRight: '1px solid rgba(255, 248, 240, 0.12)',
          borderBottom: isMono ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(217, 249, 112, 0.45)',
          boxShadow: '0 14px 32px rgba(0, 0, 0, 0.55)',
        }}
      >
        {/* Top-Left Sparkle + Titre "État général" + Sous-titre "+3 vs hier" */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', zIndex: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Sparkles size={13} color="#FAF7F2" fill="#FAF7F2" />
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#FAF7F2',
                letterSpacing: '-0.2px',
              }}
            >
              {language === "fr" ? "État général" : "General State"}
            </span>
          </div>
          {selectedDay > 0 && dayData.score > 0 && scoreDiffYesterday !== 0 && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: isMono ? '#FAF7F2' : (scoreDiffYesterday >= 0 ? '#30D158' : '#FF453A'),
                paddingLeft: '20px',
                letterSpacing: '0.01em',
              }}
            >
              {scoreDiffYesterday >= 0 ? `+${scoreDiffYesterday}` : scoreDiffYesterday} {language === 'fr' ? 'vs hier' : 'vs yesterday'}
            </span>
          )}
        </div>

        {/* Bottom-Left: Score + Statut */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', zIndex: 3, marginTop: '8px' }}>
          <span
            style={{
              fontSize: '42px',
              fontWeight: 300,
              color: '#FAF7F2',
              lineHeight: 1,
              letterSpacing: '-1.2px',
            }}
          >
            {dayData.score > 0 ? dayData.score : '--'}
          </span>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 400,
              color: 'rgba(250, 247, 242, 0.78)',
            }}
          >
            {isFirstLaunch || dayData.score === 0 ? (language === "fr" ? "En attente de données" : "Waiting for data") : (language === "fr" ? "Équilibré" : "Equilibrate")}
          </span>
        </div>

        {/* Right Side: Clean 3D Isometric Smart Ring (High-Res Transparent, No Text) */}
        <div
          style={{
            position: 'absolute',
            right: '-15px',
            bottom: '-28px',
            width: '205px',
            height: '165px',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <img
            src="/assets/ring/ring-iso-transparent.png"
            alt="Stoic Ring One Smart Ring Sensors"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              transform: 'scale(1.12)',
              filter: `${currentFinish.imgFilter} contrast(1.08) drop-shadow(0 16px 32px rgba(0, 0, 0, 0.95))`,
            }}
          />
        </div>

        {/* Top-Right Circular Frosted Glass Arrow Button (↗) */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            openModal('general_state');
          }}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 4,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title="Ouvrir la vue détaillée de l'état général"
        >
          <ArrowUpRight size={16} color="#FAF7F2" strokeWidth={1.8} />
        </div>
      </div>

      {/* Bannière visuelle claire si un jour passé est sélectionné, avec bouton de retour instantané à Aujourd'hui */}
      {selectedDay !== TODAY_INDEX && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: '16px',
            background: 'rgba(217, 249, 112, 0.08)',
            border: '1px solid rgba(217, 249, 112, 0.28)',
            marginTop: '4px',
            marginBottom: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px' }}>📅</span>
            <span style={{ fontSize: '12.5px', color: '#FAF7F2', fontWeight: 500 }}>
              {language === 'fr'
                ? `Relevés du ${WEEK[selectedDay]?.long || ''} ${WEEK[selectedDay]?.date || ''} ${WEEK[selectedDay]?.month || ''}`
                : `Records for ${WEEK[selectedDay]?.long || ''} ${WEEK[selectedDay]?.date || ''} ${WEEK[selectedDay]?.month || ''}`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDay(TODAY_INDEX)}
            style={{
              padding: '5px 12px',
              borderRadius: '12px',
              background: '#D9F970',
              border: 'none',
              color: '#0A0A0C',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {language === 'fr' ? "Aujourd'hui" : 'Today'}
          </button>
        </div>
      )}

      {/* =====================================================================
          4. SECTION HEADER: "Mon activité" (Centré)
          ===================================================================== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 0',
          marginTop: '6px',
          marginBottom: '2px',
        }}
      >
        <h2
          style={{
            fontSize: '17px',
            fontWeight: 500,
            color: '#FAF7F2',
            margin: 0,
            letterSpacing: '-0.25px',
            textAlign: 'center',
          }}
        >
          {language === 'fr' ? 'Mon activité' : 'My activity'}
        </h2>
      </div>

      {/* =====================================================================
          5. EIGHT HARMONIZED BIOMETRIC CARDS (2-Column Symmetry, Identical Size & Vibrant Signature Colors)
          ===================================================================== */}
      <div className="metrics-grid-2" style={{ gap: '12px' }}>
        {/* -----------------------------------------------------------------
            CARD 1: "Équilibre nerveux" (96% / VRC) - LIME
            ----------------------------------------------------------------- */}
        <div
          onClick={() => openMetricDetail('hrv')}
          role="button"
          tabIndex={0}
          title="Ouvrir le suivi détaillé 24h de l'équilibre neuronal & VRC"
          style={{
            position: 'relative',
            minHeight: '160px',
            padding: '16px 15px 14px 15px',
            borderRadius: '26px',
            overflow: 'hidden',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: isMono
              ? 'radial-gradient(ellipse at 50% 110%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 48%, rgba(10, 10, 12, 0.96) 80%), #0A0A0C'
              : 'radial-gradient(ellipse at 50% 105%, rgba(217, 249, 112, 0.38) 0%, rgba(163, 204, 62, 0.14) 44%, rgba(10, 10, 12, 0.94) 78%), rgba(10, 10, 12, 0.86)',
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
            borderTop: '1px solid rgba(255, 248, 240, 0.16)',
            borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
            borderRight: '1px solid rgba(255, 248, 240, 0.12)',
            borderBottom: isMono ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(217, 249, 112, 0.75)',
            boxShadow: isMono
              ? '0 14px 30px rgba(0, 0, 0, 0.55), 0 4px 18px rgba(255, 255, 255, 0.06)'
              : '0 14px 30px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(217, 249, 112, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'rgba(250, 247, 242, 0.9)', lineHeight: 1.25 }}>
              {language === 'fr' ? <>Équilibre nerveux<br />optimal</> : <>Optimal neural<br />balance</>}
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: isMono ? 'rgba(255, 255, 255, 0.08)' : 'rgba(217, 249, 112, 0.16)',
                border: isMono ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(217, 249, 112, 0.4)',
                boxShadow: isMono ? 'none' : '0 0 12px rgba(217, 249, 112, 0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Brain size={16} color={isMono ? "#FAF7F2" : "#D9F970"} strokeWidth={1.8} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '4px 0 2px 0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={{ fontSize: '34px', fontWeight: 300, color: '#FAF7F2', lineHeight: 1, letterSpacing: '-1px' }}>
                {dayData.hrv && dayData.hrv > 0 ? dayData.hrv : '--'}
              </span>
              {dayData.hrv && dayData.hrv > 0 ? (
                <span style={{ fontSize: '15px', fontWeight: 400, color: isMono ? 'rgba(250, 247, 242, 0.8)' : '#D9F970', marginLeft: '3px' }}>ms</span>
              ) : null}
            </div>
            <span style={{ fontSize: '10.5px', color: isMono ? '#FAF7F2' : '#D9F970', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
              {dayData.hrv && dayData.hrv > 0 ? (
                <span>{language === 'fr' ? 'VRC · Normal' : 'HRV · Normal'}</span>
              ) : (
                <span>--</span>
              )}
            </span>
          </div>

          <svg width="100%" height="26" viewBox="0 0 150 26" fill="none" style={{ overflow: 'visible', marginTop: '2px' }}>
            <path d={!dayData.hrv || dayData.hrv === 0 ? "M 0 13 L 150 13" : "M 0 13 Q 22 3, 45 13 T 90 13 T 135 13 T 150 9"} stroke={isMono ? "rgba(250, 247, 242, 0.3)" : "rgba(217, 249, 112, 0.25)"} strokeWidth="1.2" fill="none" />
            <path
              d={!dayData.hrv || dayData.hrv === 0 ? "M 0 13 L 150 13" : "M 0 13 Q 22 23, 45 13 T 90 13 T 135 13 T 150 17"}
              stroke={isMono ? '#FAF7F2' : '#D9F970'}
              strokeWidth="1.6"
              fill="none"
              style={{ filter: isMono ? 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.7))' : 'drop-shadow(0 0 7px rgba(217, 249, 112, 0.85))' }}
            />
          </svg>
        </div>

        {/* -----------------------------------------------------------------
            CARD 2: "Pas effectués" (Calories & Activité) - VIBRANT ORANGE
            ----------------------------------------------------------------- */}
        <div
          onClick={() => setTab('fit')}
          role="button"
          tabIndex={0}
          title="Voir le suivi complet de l'activité & des pas"
          style={{
            position: 'relative',
            minHeight: '160px',
            padding: '16px 15px 14px 15px',
            borderRadius: '26px',
            overflow: 'hidden',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: isMono
              ? 'radial-gradient(ellipse at 50% 110%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 48%, rgba(10, 10, 12, 0.96) 80%), #0A0A0C'
              : 'radial-gradient(ellipse at 50% 108%, rgba(251, 146, 60, 0.36) 0%, rgba(234, 88, 12, 0.14) 44%, rgba(10, 10, 12, 0.94) 78%), rgba(10, 10, 12, 0.86)',
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
            borderTop: '1px solid rgba(255, 248, 240, 0.16)',
            borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
            borderRight: '1px solid rgba(255, 248, 240, 0.12)',
            borderBottom: isMono ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(251, 146, 60, 0.75)',
            boxShadow: isMono
              ? '0 14px 30px rgba(0, 0, 0, 0.55), 0 4px 18px rgba(255, 255, 255, 0.06)'
              : '0 14px 30px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(251, 146, 60, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'rgba(250, 247, 242, 0.9)', lineHeight: 1.25 }}>
              {selectedDay === TODAY_INDEX
                ? (language === 'fr' ? <>Pas effectués<br />aujourd'hui</> : <>Steps Taken<br />Today</>)
                : (language === 'fr' ? <>Pas effectués<br />{WEEK[selectedDay]?.long || ''}</> : <>Steps ·<br />{WEEK[selectedDay]?.long || ''}</>)}
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: isMono ? 'rgba(255, 255, 255, 0.08)' : 'rgba(251, 146, 60, 0.18)',
                border: isMono ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(251, 146, 60, 0.4)',
                boxShadow: isMono ? 'none' : '0 0 12px rgba(251, 146, 60, 0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Flame size={16} color={isMono ? "#FAF7F2" : "#FB923C"} fill={isMono ? "transparent" : "rgba(251, 146, 60, 0.25)"} strokeWidth={1.8} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '4px 0 2px 0' }}>
            <span style={{ fontSize: '34px', fontWeight: 300, color: '#FAF7F2', lineHeight: 1, letterSpacing: '-1px' }}>
              {dayData.steps > 0 ? fmtNum(dayData.steps) : '--'}
            </span>
            <span style={{ fontSize: '10.5px', color: isMono ? 'rgba(250, 247, 242, 0.72)' : '#FDBA74', marginTop: '4px', fontWeight: 600 }}>
              {dayData.steps > 0 ? `${dayData.activeKcal} ${language === 'fr' ? 'kcal brûlées' : 'kcal burned'}` : (language === 'fr' ? '0 kcal brûlée' : '0 kcal burned')}
            </span>
          </div>

          <div style={{ position: 'relative', width: '100%', paddingTop: '8px', paddingBottom: '4px' }}>
            <div style={{ width: '100%', height: '3px', background: 'rgba(255, 255, 255, 0.12)', borderRadius: '3px', position: 'relative' }}>
              <div
                style={{
                  width: `${stepsProgress}%`,
                  height: '100%',
                  borderRadius: '3px',
                  background: isMono ? '#FAF7F2' : 'linear-gradient(90deg, #F97316, #FBBF24)',
                  boxShadow: isMono ? '0 0 8px rgba(255, 255, 255, 0.8)' : '0 0 10px rgba(251, 146, 60, 0.9)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: `${stepsProgress}%`,
                  top: '-3px',
                  transform: 'translateX(-50%) rotate(45deg)',
                  width: '8px',
                  height: '8px',
                  borderRadius: '1.5px',
                  background: isMono ? '#FFFFFF' : '#FFF7ED',
                  boxShadow: isMono ? '0 0 8px #FFFFFF' : '0 0 10px #FB923C',
                }}
              />
            </div>
          </div>
        </div>

        {/* -----------------------------------------------------------------
            CARD 3: "Oxygène dans le sang" (SpO2) - LUMINOUS FUCHSIA / ORCHID
            ----------------------------------------------------------------- */}
        <div
          onClick={() => openMetricDetail('spo2')}
          role="button"
          tabIndex={0}
          title="Ouvrir le suivi détaillé 24h de l'Oxygénation SpO2"
          style={{
            position: 'relative',
            minHeight: '160px',
            padding: '16px 15px 14px 15px',
            borderRadius: '26px',
            overflow: 'hidden',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: isMono
              ? 'radial-gradient(ellipse at 50% 110%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 48%, rgba(10, 10, 12, 0.96) 80%), #0A0A0C'
              : 'radial-gradient(ellipse at 60% 108%, rgba(217, 70, 239, 0.38) 0%, rgba(162, 28, 175, 0.14) 45%, rgba(10, 10, 12, 0.94) 78%), rgba(10, 10, 12, 0.86)',
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
            borderTop: '1px solid rgba(255, 248, 240, 0.16)',
            borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
            borderRight: '1px solid rgba(255, 248, 240, 0.12)',
            borderBottom: isMono ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(232, 121, 249, 0.75)',
            boxShadow: isMono
              ? '0 14px 30px rgba(0, 0, 0, 0.55), 0 4px 18px rgba(255, 255, 255, 0.06)'
              : '0 14px 30px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(232, 121, 249, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'rgba(250, 247, 242, 0.9)', lineHeight: 1.25 }}>
              {language === 'fr' ? <>Oxygène dans<br />le sang</> : <>Blood<br />Oxygen</>}
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: isMono ? 'rgba(255, 255, 255, 0.08)' : 'rgba(232, 121, 249, 0.18)',
                border: isMono ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(232, 121, 249, 0.4)',
                boxShadow: isMono ? 'none' : '0 0 12px rgba(232, 121, 249, 0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Droplets size={16} color={isMono ? "#FAF7F2" : "#E879F9"} fill={isMono ? "transparent" : "rgba(232, 121, 249, 0.2)"} strokeWidth={1.8} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '4px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={{ fontSize: '30px', fontWeight: 300, color: '#FAF7F2', lineHeight: 1, letterSpacing: '-0.8px' }}>
                  {isFirstLaunch || !dayData.spo2 ? '--' : Math.round(dayData.spo2)}
                </span>
                {dayData.spo2 && dayData.spo2 > 0 ? <span style={{ fontSize: '14px', fontWeight: 300, color: isMono ? 'rgba(250, 247, 242, 0.8)' : '#E879F9', marginLeft: '1px' }}>%</span> : null}
              </div>
              <span style={{ fontSize: '10.5px', color: isMono ? 'rgba(250, 247, 242, 0.65)' : '#F0ABFC', marginTop: '2px', display: 'block', fontWeight: 600 }}>
                {dayData.spo2 && dayData.spo2 > 0 ? (language === 'fr' ? 'Normal (95-100%)' : 'Optimal (95-100%)') : '--'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '9.5px', color: isMono ? '#FAF7F2' : '#F0ABFC', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                {dayData.spo2 && dayData.spo2 > 0
                  ? dayData.spo2Min && dayData.spo2Max
                    ? `${dayData.spo2Min}-${dayData.spo2Max}%`
                    : `${Math.round(dayData.spo2)}%`
                  : '--'}
              </span>
              <svg width="68" height="36" viewBox="0 0 78 42" style={{ overflow: 'visible' }}>
                <path d="M 10 38 A 29 29 0 0 1 68 38" fill="none" stroke={isMono ? "rgba(255, 255, 255, 0.25)" : "rgba(232, 121, 249, 0.25)"} strokeWidth="1" strokeDasharray="2 2.5" />
                <path
                  d="M 4 38 A 35 35 0 0 1 74 38"
                  fill="none"
                  stroke={isMono ? '#FAF7F2' : '#E879F9'}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  style={{ filter: isMono ? 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.75))' : 'drop-shadow(0 0 7px rgba(232, 121, 249, 0.9))' }}
                />
                <circle cx="56" cy="10" r="3.5" fill="#FAF7F2" stroke={isMono ? '#0A0A0C' : '#E879F9'} strokeWidth="1.8" />
              </svg>
            </div>
          </div>
        </div>

        {/* -----------------------------------------------------------------
            CARD 4: "Température cutanée" - LUMINOUS GOLD / AMBER
            ----------------------------------------------------------------- */}
        <div
          onClick={() => openMetricDetail('temp')}
          role="button"
          tabIndex={0}
          title="Ouvrir le suivi détaillé 24h de la Température Cutanée"
          style={{
            position: 'relative',
            minHeight: '160px',
            padding: '16px 15px 14px 15px',
            borderRadius: '26px',
            overflow: 'hidden',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: isMono
              ? 'radial-gradient(ellipse at 50% 110%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 48%, rgba(10, 10, 12, 0.96) 80%), #0A0A0C'
              : 'radial-gradient(ellipse at 50% 108%, rgba(251, 191, 36, 0.36) 0%, rgba(217, 119, 6, 0.14) 45%, rgba(10, 10, 12, 0.94) 78%), rgba(10, 10, 12, 0.86)',
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
            borderTop: '1px solid rgba(255, 248, 240, 0.16)',
            borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
            borderRight: '1px solid rgba(255, 248, 240, 0.12)',
            borderBottom: isMono ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(251, 191, 36, 0.75)',
            boxShadow: isMono
              ? '0 14px 30px rgba(0, 0, 0, 0.55), 0 4px 18px rgba(255, 255, 255, 0.06)'
              : '0 14px 30px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(251, 191, 36, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'rgba(250, 247, 242, 0.9)', lineHeight: 1.25 }}>
              {language === 'fr' ? <>Température<br />cutanée</> : <>Skin<br />Temperature</>}
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: isMono ? 'rgba(255, 255, 255, 0.08)' : 'rgba(251, 191, 36, 0.18)',
                border: isMono ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(251, 191, 36, 0.4)',
                boxShadow: isMono ? 'none' : '0 0 12px rgba(251, 191, 36, 0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Thermometer size={16} color={isMono ? "#FAF7F2" : "#FBBF24"} strokeWidth={1.8} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', margin: '2px 0' }}>
            <span style={{ fontSize: '30px', fontWeight: 300, color: '#FAF7F2', lineHeight: 1, letterSpacing: '-0.8px' }}>
              {skinTempAbs}
            </span>
            {skinTempAbs !== '--' && <span style={{ fontSize: '15px', fontWeight: 300, color: isMono ? 'rgba(250, 247, 242, 0.8)' : '#FBBF24', marginLeft: '1px' }}>°c</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <svg width="100%" height="20" viewBox="0 0 140 22" style={{ overflow: 'visible' }}>
              <path d={dayData?.tempDelta === undefined && (!dayData?.skinTemp || dayData.skinTemp === 0) ? "M 4 11 L 136 11" : "M 4 16 C 35 16, 55 4, 85 4 C 110 4, 125 10, 136 12"} fill="none" stroke={isMono ? "rgba(255, 255, 255, 0.25)" : "rgba(251, 191, 36, 0.25)"} strokeWidth="1" strokeDasharray="2 2.5" />
              <path
                d={dayData?.tempDelta === undefined && (!dayData?.skinTemp || dayData.skinTemp === 0) ? "M 4 11 L 136 11" : "M 4 18 C 35 18, 52 10, 74 10 C 96 10, 115 16, 136 16"}
                fill="none"
                stroke={isMono ? '#FAF7F2' : '#FBBF24'}
                strokeWidth="1.8"
                style={{ filter: isMono ? 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.7))' : 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.85))' }}
              />
              <circle cx="74" cy="10" r="4.5" fill="#18120E" stroke={isMono ? '#FAF7F2' : '#FBBF24'} strokeWidth="2" />
              <circle cx="74" cy="10" r="1.8" fill="#FFFFFF" />
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: isMono ? 'rgba(250, 247, 242, 0.58)' : '#FCD34D', fontWeight: 600 }}>
              <span>{dayData?.tempDelta !== undefined ? (language === 'fr' ? `Écart ${dayData.tempDelta > 0 ? '+' : ''}${dayData.tempDelta.toFixed(2)}°C` : `Delta ${dayData.tempDelta > 0 ? '+' : ''}${dayData.tempDelta.toFixed(2)}°C`) : (language === 'fr' ? 'Écart --' : 'Delta --')}</span>
              <span>{language === 'fr' ? 'Stable' : 'Stable'}</span>
            </div>
          </div>
        </div>

        {/* -----------------------------------------------------------------
            CARD 5: "Niveau de Stress & Émotion" (SDK QC 0x73) - EMERALD MINT
            ----------------------------------------------------------------- */}
        <div
          onClick={() => openMetricDetail('stress')}
          role="button"
          tabIndex={0}
          title="Ouvrir le suivi détaillé du stress et de l'équilibre émotionnel"
          style={{
            position: 'relative',
            minHeight: '160px',
            padding: '16px 15px 14px 15px',
            borderRadius: '26px',
            overflow: 'hidden',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: isMono
              ? 'radial-gradient(ellipse at 50% 110%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 48%, rgba(10, 10, 12, 0.96) 80%), #0A0A0C'
              : 'radial-gradient(ellipse at 50% 108%, rgba(52, 211, 153, 0.36) 0%, rgba(16, 185, 129, 0.14) 45%, rgba(10, 10, 12, 0.94) 78%), rgba(10, 10, 12, 0.86)',
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
            borderTop: '1px solid rgba(255, 248, 240, 0.16)',
            borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
            borderRight: '1px solid rgba(255, 248, 240, 0.12)',
            borderBottom: isMono ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(52, 211, 153, 0.75)',
            boxShadow: isMono
              ? '0 14px 30px rgba(0, 0, 0, 0.55), 0 4px 18px rgba(255, 255, 255, 0.06)'
              : '0 14px 30px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(52, 211, 153, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'rgba(250, 247, 242, 0.9)', lineHeight: 1.25 }}>
              {language === 'fr' ? <>Niveau de<br />stress</> : <>Nervous<br />Stress</>}
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: isMono ? 'rgba(255, 255, 255, 0.08)' : 'rgba(52, 211, 153, 0.18)',
                border: isMono ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(52, 211, 153, 0.4)',
                boxShadow: isMono ? 'none' : '0 0 12px rgba(52, 211, 153, 0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Activity size={16} color={isMono ? "#FAF7F2" : "#34D399"} strokeWidth={1.8} />
            </div>
          </div>

          {(() => {
            const hasStress = dayData.stress !== undefined && dayData.stress > 0;
            const sVal = hasStress ? dayData.stress : '--';
            const sLevel = hasStress
              ? `${dayData.stressLevel || (language === 'fr' ? 'Normal' : 'Normal')}${
                  dayData.stressAvg ? ` · Moy. ${dayData.stressAvg}` : ''
                }`
              : '--';

            return (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 300, color: '#FAF7F2', lineHeight: 1, letterSpacing: '-0.8px' }}>
                      {sVal}
                    </span>
                    {hasStress ? <span style={{ fontSize: '11px', color: isMono ? 'rgba(250, 247, 242, 0.55)' : '#34D399', fontWeight: 600 }}>/100</span> : null}
                  </div>
                  <span style={{ fontSize: '10.5px', color: isMono ? 'rgba(250, 247, 242, 0.65)' : '#6EE7B7', marginTop: '2px', fontWeight: 600 }}>
                    {sLevel}
                  </span>
                </div>

                <svg width="100%" height="22" viewBox="0 0 140 22" fill="none" style={{ overflow: 'visible' }}>
                  <path d={!hasStress ? "M 0 11 L 140 11" : "M 0 11 Q 20 4, 40 11 T 80 11 T 120 11 T 140 11"} stroke={isMono ? "rgba(250, 247, 242, 0.25)" : "rgba(52, 211, 153, 0.25)"} strokeWidth="1.2" fill="none" />
                  <path
                    d={!hasStress ? "M 0 11 L 140 11" : "M 0 11 Q 20 18, 40 11 T 80 11 T 120 11 T 140 7"}
                    stroke={isMono ? '#FAF7F2' : '#34D399'}
                    strokeWidth="1.8"
                    fill="none"
                    style={{ filter: isMono ? 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.75))' : 'drop-shadow(0 0 7px rgba(52, 211, 153, 0.85))' }}
                  />
                </svg>
              </>
            );
          })()}
        </div>

        {/* -----------------------------------------------------------------
            CARD 6: "Fréquence Cardiaque" (BPM) - CRIMSON / ROSE
            ----------------------------------------------------------------- */}
        <div
          onClick={() => openMetricDetail('bpm')}
          role="button"
          tabIndex={0}
          title="Ouvrir le suivi détaillé 24h de la fréquence cardiaque"
          style={{
            position: 'relative',
            minHeight: '160px',
            padding: '16px 15px 14px 15px',
            borderRadius: '26px',
            overflow: 'hidden',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: isMono
              ? 'radial-gradient(ellipse at 50% 110%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 48%, rgba(10, 10, 12, 0.96) 80%), #0A0A0C'
              : 'radial-gradient(ellipse at 50% 108%, rgba(255, 69, 58, 0.36) 0%, rgba(220, 38, 38, 0.14) 45%, rgba(10, 10, 12, 0.94) 78%), rgba(10, 10, 12, 0.86)',
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
            borderTop: '1px solid rgba(255, 248, 240, 0.16)',
            borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
            borderRight: '1px solid rgba(255, 248, 240, 0.12)',
            borderBottom: isMono ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(255, 69, 58, 0.75)',
            boxShadow: isMono
              ? '0 14px 30px rgba(0, 0, 0, 0.55), 0 4px 18px rgba(255, 255, 255, 0.06)'
              : '0 14px 30px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(255, 69, 58, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'rgba(250, 247, 242, 0.9)', lineHeight: 1.25 }}>
              {language === 'fr' ? <>Fréquence<br />cardiaque</> : <>Heart<br />Rate</>}
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: isMono ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 69, 58, 0.18)',
                border: isMono ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255, 69, 58, 0.4)',
                boxShadow: isMono ? 'none' : '0 0 12px rgba(255, 69, 58, 0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Heart size={16} color={isMono ? "#FAF7F2" : "#FF453A"} fill={isMono ? "transparent" : "rgba(255, 69, 58, 0.25)"} strokeWidth={1.8} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2px 0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
              <span style={{ fontSize: '32px', fontWeight: 300, color: '#FAF7F2', lineHeight: 1, letterSpacing: '-0.8px' }}>
                {bpmValue > 0 ? bpmValue : '--'}
              </span>
              {bpmValue > 0 ? <span style={{ fontSize: '11px', color: isMono ? 'rgba(250, 247, 242, 0.55)' : '#FF453A', fontWeight: 600 }}>bpm</span> : null}
            </div>
            <span style={{ fontSize: '10.5px', color: isMono ? 'rgba(250, 247, 242, 0.65)' : '#FFA29A', marginTop: '2px', fontWeight: 600 }}>
              {bpmValue > 0 ? (dayData.restingBpm ? (language === 'fr' ? `Repos · ${dayData.restingBpm} bpm` : `Resting · ${dayData.restingBpm} bpm`) : (language === 'fr' ? 'Pouls actif' : 'Active pulse')) : '--'}
            </span>
          </div>

          <svg width="100%" height="22" viewBox="0 0 140 22" fill="none" style={{ overflow: 'visible' }}>
            <path
              d={bpmValue === 0 ? "M 0 11 L 140 11" : "M 0 11 L 35 11 L 42 16 L 48 3 L 55 20 L 62 7 L 68 11 L 140 11"}
              stroke={isMono ? '#FAF7F2' : '#FF453A'}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              style={{ filter: isMono ? 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.75))' : 'drop-shadow(0 0 7px rgba(255, 69, 58, 0.85))' }}
            />
          </svg>
        </div>
      </div>

      {/* =====================================================================
          7. COMPLEMENTARY BIOMETRIC MODULES
          ===================================================================== */}
      <BodyEnergyGauge
        energy={dayData.bodyEnergy}
        wake={dayData.bodyEnergyWake}
        bedtime={dayData.bodyEnergyBedtime}
      />

      <ImmunityRadar
        anomaly={dayData.anomaly}
        hasHrv={dayData.hrv > 0}
        hasTemp={(dayData.skinTemp ?? 0) > 0 || dayData.tempDelta !== 0}
      />

      {/* =====================================================================
          COMPACT SLEEP DURATION CARD ("Temps passé à dormir")
          Direct tap-through to the dedicated Sleep tab
          ===================================================================== */}
      {(() => {
        const sleep = dayData.sleep;
        const totalMin = sleep ? (sleep.deepMin + sleep.remMin + sleep.lightMin + sleep.awakeMin) : 0;
        const effectiveMin = totalMin > 0 ? (totalMin - sleep.awakeMin) : 0;
        const efficiencyPct = totalMin > 0 ? Math.round((effectiveMin / totalMin) * 100) : 0;
        const sleepScore = sleep?.score || 0;
        const hasSleepData = totalMin > 0;

        return (
          <div
            onClick={() => setTab('sleep')}
            role="button"
            tabIndex={0}
            title={language === 'fr' ? "Ouvrir l’analyse détaillée du sommeil" : 'Open detailed sleep analysis'}
            style={{
              position: 'relative',
              width: '100%',
              padding: '16px 18px',
              borderRadius: '26px',
              overflow: 'hidden',
              cursor: 'pointer',
              background: isMono
                ? 'radial-gradient(ellipse at 50% 115%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 48%, rgba(10, 10, 12, 0.96) 80%), #0A0A0C'
                : 'radial-gradient(ellipse at 50% 115%, rgba(129, 140, 248, 0.28) 0%, rgba(99, 102, 241, 0.08) 42%, rgba(10, 10, 12, 0.95) 78%), rgba(10, 10, 12, 0.86)',
              backdropFilter: 'blur(26px)',
              WebkitBackdropFilter: 'blur(26px)',
              borderTop: '1px solid rgba(255, 248, 240, 0.16)',
              borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
              borderRight: '1px solid rgba(255, 248, 240, 0.12)',
              borderBottom: isMono ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(129, 140, 248, 0.65)',
              boxShadow: isMono
                ? '0 14px 32px rgba(0, 0, 0, 0.55), 0 4px 18px rgba(255, 255, 255, 0.06)'
                : '0 14px 32px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(129, 140, 248, 0.16)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              userSelect: 'none',
              transition: 'transform 0.18s ease, box-shadow 0.18s ease',
            }}
          >
            {/* Top row: Title + Moon Chip + Details Pill */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: isMono ? 'rgba(255, 255, 255, 0.08)' : 'rgba(129, 140, 248, 0.18)',
                    border: isMono ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(129, 140, 248, 0.4)',
                    boxShadow: isMono ? 'none' : '0 0 10px rgba(129, 140, 248, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Moon size={16} color={isMono ? '#FAF7F2' : '#818CF8'} strokeWidth={1.8} />
                </div>
                <div>
                  <span style={{ fontSize: '13.5px', fontWeight: 500, color: 'rgba(250, 247, 242, 0.95)' }}>
                    {language === 'fr' ? 'Temps passé à dormir' : 'Time Asleep'}
                  </span>
                  <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)', marginTop: '1px' }}>
                    {hasSleepData
                      ? (language === 'fr' ? 'Nuit de récupération' : 'Restorative night')
                      : (language === 'fr' ? 'En attente de la nuit' : 'Waiting for sleep data')}
                  </div>
                </div>
              </div>

              {/* Top-Right Pill to direct to Sleep tab */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: isMono ? 'rgba(255, 255, 255, 0.08)' : 'rgba(129, 140, 248, 0.15)',
                  border: isMono ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(129, 140, 248, 0.35)',
                  fontSize: '11px',
                  color: isMono ? '#FAF7F2' : '#C7D2FE',
                  fontWeight: 600,
                }}
              >
                <span>{language === 'fr' ? 'Détails' : 'Details'}</span>
                <ArrowUpRight size={13} color={isMono ? '#FAF7F2' : '#818CF8'} />
              </div>
            </div>

            {/* Bottom Row: Big Sleep Duration Number & Complementary Badges */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span
                  style={{
                    fontSize: '32px',
                    fontWeight: 300,
                    letterSpacing: '-1px',
                    color: '#FAF7F2',
                    lineHeight: 1,
                    fontFamily: 'var(--font-display, -apple-system, BlinkMacSystemFont)',
                  }}
                >
                  {hasSleepData ? fmtDuration(totalMin) : '--'}
                </span>
              </div>

              {hasSleepData && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {efficiencyPct > 0 && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: isMono ? '#FAF7F2' : '#A5B4FC',
                        padding: '3px 8px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      {efficiencyPct}% {language === 'fr' ? 'efficace' : 'eff.'}
                    </span>
                  )}
                  {sleepScore > 0 && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: isMono ? '#FAF7F2' : '#818CF8',
                        padding: '3px 8px',
                        borderRadius: '8px',
                        background: isMono ? 'rgba(255, 255, 255, 0.08)' : 'rgba(129, 140, 248, 0.18)',
                        border: isMono ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(129, 140, 248, 0.4)',
                      }}
                    >
                      {sleepScore}/100
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <CardioAge score={dayData.hrv > 0 && dayData.restingBpm > 0 ? dayData.score : 0} />
      </div>
    </div>
  );
};
