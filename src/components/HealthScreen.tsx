import React from 'react';
import { useApp } from '../context/AppContext';
import { weekMetrics, statusFor, finishes, emptyDayMetrics } from '../data/health';
import { WeekSelector } from './WeekSelector';
import { BodyEnergyGauge } from './BodyEnergyGauge';
import { ImmunityRadar } from './ImmunityRadar';
import { SleepPhases } from './SleepPhases';
import { CardioAge } from './CardioAge';
import { HeartRateCard } from './HeartRateCard';
import { Brain, Flame, Sparkles, ArrowUpRight } from 'lucide-react';
import { fmtNum } from '../lib/format';

export const HealthScreen: React.FC = () => {
  const { selectedDay, openModal, openMetricDetail, ring, finish, language, weekData, isFirstLaunch, isSimulating, toggleSimulation } = useApp();
  const currentFinish = finishes.find((f) => f.id === finish) || finishes[1];

  const dayData = (weekData && weekData[selectedDay]) || (isFirstLaunch ? emptyDayMetrics : (weekMetrics[selectedDay] || weekMetrics[3]));
  const batteryPct = ring.batteryRing ?? 88;
  const isLowBattery = batteryPct <= 20;
  const batteryAccent = isLowBattery ? '#FF5A52' : '#D9F970';
  const batteryAccentSoft = isLowBattery ? 'rgba(255, 90, 82, 0.78)' : 'rgba(228, 255, 142, 0.78)';
  const neuralPct = !isFirstLaunch && dayData.pillars?.recovery ? Math.min(99, Math.max(82, dayData.pillars.recovery + 1)) : 0;
  const skinTempAbs = isFirstLaunch ? '--' : (36.8 + dayData.tempDelta).toFixed(1);
  const stepsProgress = Math.min(100, Math.round(((dayData.steps || 0) / 10000) * 100));
  const prevDayData = selectedDay > 0 ? ((weekData && weekData[selectedDay - 1]) || (isFirstLaunch ? null : weekMetrics[selectedDay - 1])) : null;
  const scoreDiffYesterday = prevDayData && prevDayData.score > 0 && dayData.score > 0 ? dayData.score - prevDayData.score : 0;

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

        {/* 3D Smart Ring embedded as the "O" of FOCUS with Battery inside */}
        <div
          style={{
            position: 'absolute',
            left: '34.38%',
            top: '45.0%',
            transform: 'translate(-50%, -50%)',
            width: '13.09%',
            height: '20.94%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
            pointerEvents: 'none',
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
          </div>
        </div>
      </div>



      <div key={selectedDay} className="day-view-transition" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* =====================================================================
          3. WIDE RECTANGLE HEART RATE LIVE ECG CARD
          ===================================================================== */}
      <HeartRateCard onClick={() => openMetricDetail('bpm')} />

      {/* =====================================================================
          4. SECTION HEADER: "My activity (8)"
          ===================================================================== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '2px',
          marginBottom: '-2px',
        }}
      >
        <h2
          style={{
            fontSize: '17px',
            fontWeight: 400,
            color: '#FAF7F2',
            margin: 0,
            letterSpacing: '-0.2px',
          }}
        >
          {language === "fr" ? "Mon activité" : "My activity"}
        </h2>
      </div>

      {/* =====================================================================
          5. FOUR SIGNATURE BIOMETRIC CARDS (Exact match to Reference Mockup)
          ===================================================================== */}
      <div className="metrics-grid-2" style={{ gap: '12px' }}>
        {/* -----------------------------------------------------------------
            CARD 1: "Optimal neural balance" (96% / VRC) — Bioluminescent Lime Glow
            ----------------------------------------------------------------- */}
        <div
          onClick={() => openMetricDetail('hrv')}
          role="button"
          tabIndex={0}
          title="Ouvrir le suivi détaillé 24h de l'équilibre neuronal & VRC"
          style={{
            position: 'relative',
            minHeight: '176px',
            padding: '16px 15px 14px 15px',
            borderRadius: '26px',
            overflow: 'hidden',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background:
              'radial-gradient(ellipse at 50% 105%, rgba(217, 249, 112, 0.34) 0%, rgba(163, 204, 62, 0.12) 44%, rgba(10, 10, 12, 0.94) 78%), rgba(10, 10, 12, 0.86)',
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
            borderTop: '1px solid rgba(255, 248, 240, 0.16)',
            borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
            borderRight: '1px solid rgba(255, 248, 240, 0.12)',
            borderBottom: '1.5px solid rgba(228, 255, 142, 0.68)',
            boxShadow: '0 14px 30px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(217, 249, 112, 0.14)',
          }}
        >
          {/* Top Row: Title + Circular Frosted Brain Icon */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span
              style={{
                fontSize: '12.5px',
                fontWeight: 400,
                color: 'rgba(250, 247, 242, 0.86)',
                lineHeight: 1.25,
              }}
            >
              {language === 'fr' ? (
                <>
                  Équilibre nerveux
                  <br />
                  optimal
                </>
              ) : (
                <>
                  Optimal neural
                  <br />
                  balance
                </>
              )}
            </span>

            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Brain size={15} color="#FAF7F2" strokeWidth={1.6} />
            </div>
          </div>

          {/* Center Value: 96% + ▲ 12% increase on this day */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '6px 0 2px 0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span
                style={{
                  fontSize: '36px',
                  fontWeight: 300,
                  color: '#FAF7F2',
                  lineHeight: 1,
                  letterSpacing: '-1px',
                }}
              >
                {neuralPct > 0 ? neuralPct : '--'}
              </span>
              <span
                style={{
                  fontSize: '17px',
                  fontWeight: 300,
                  color: 'rgba(250, 247, 242, 0.8)',
                  marginLeft: '1px',
                }}
              >
                %
              </span>
            </div>

            <span
              style={{
                fontSize: '10px',
                color: 'rgba(250, 247, 242, 0.72)',
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ color: '#D9F970', fontSize: '8px' }}>▲</span>
              <span>+12% ({dayData.hrv} ms VRC)</span>
            </span>
          </div>

          {/* Bottom Intertwined Dual Sine Wave SVG */}
          <svg
            width="100%"
            height="30"
            viewBox="0 0 150 30"
            fill="none"
            style={{ overflow: 'visible', marginTop: '2px' }}
          >
            {/* Secondary wave */}
            <path
              d="M 0 16 Q 22 4, 45 16 T 90 16 T 135 16 T 150 12"
              stroke="rgba(250, 247, 242, 0.32)"
              strokeWidth="1.2"
              fill="none"
            />
            {/* Primary glowing lime wave */}
            <path
              d="M 0 16 Q 22 28, 45 16 T 90 16 T 135 16 T 150 20"
              stroke="#D9F970"
              strokeWidth="1.5"
              fill="none"
              style={{ filter: 'drop-shadow(0 0 6px rgba(217, 249, 112, 0.8))' }}
            />
          </svg>
        </div>

        {/* -----------------------------------------------------------------
            CARD 2: "Steps Taken Today" (6,840 / 420 kcal) — Icy Cyan-Silver Glow
            ----------------------------------------------------------------- */}
        <div
          onClick={() => openMetricDetail('resp')}
          role="button"
          tabIndex={0}
          title="Activité quotidienne & fréquence respiratoire"
          style={{
            position: 'relative',
            minHeight: '176px',
            padding: '16px 15px 14px 15px',
            borderRadius: '26px',
            overflow: 'hidden',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background:
              'radial-gradient(ellipse at 50% 108%, rgba(165, 243, 252, 0.26) 0%, rgba(148, 163, 184, 0.1) 44%, rgba(10, 10, 12, 0.94) 78%), rgba(10, 10, 12, 0.86)',
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
            borderTop: '1px solid rgba(255, 248, 240, 0.16)',
            borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
            borderRight: '1px solid rgba(255, 248, 240, 0.12)',
            borderBottom: '1.5px solid rgba(207, 250, 254, 0.62)',
            boxShadow: '0 14px 30px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(165, 243, 252, 0.12)',
          }}
        >
          {/* Top Row: Title + Circular Frosted Flame Icon */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span
              style={{
                fontSize: '12.5px',
                fontWeight: 400,
                color: 'rgba(250, 247, 242, 0.86)',
                lineHeight: 1.25,
              }}
            >
              {language === 'fr' ? (
                <>
                  Pas effectués
                  <br />
                  aujourd'hui
                </>
              ) : (
                <>
                  Steps Taken
                  <br />
                  Today
                </>
              )}
            </span>

            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Flame size={15} color="#FAF7F2" strokeWidth={1.6} />
            </div>
          </div>

          {/* Center Value: 8,420 + 480 kcal burned */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '6px 0 4px 0' }}>
            <span
              style={{
                fontSize: '34px',
                fontWeight: 300,
                color: '#FAF7F2',
                lineHeight: 1,
                letterSpacing: '-1px',
              }}
            >
              {isFirstLaunch && dayData.steps === 0 ? '--' : fmtNum(dayData.steps)}
            </span>

            <span
              style={{
                fontSize: '10.5px',
                color: 'rgba(250, 247, 242, 0.72)',
                marginTop: '5px',
              }}
            >
              {isFirstLaunch && dayData.steps === 0 ? (language === 'fr' ? '0 kcal brûlée' : '0 kcal burned') : `${dayData.activeKcal} ${language === 'fr' ? 'kcal brûlées' : 'kcal burned'}`}
            </span>
          </div>

          {/* Bottom Progress Track with Diamond Pointer */}
          <div style={{ position: 'relative', width: '100%', paddingTop: '10px', paddingBottom: '4px' }}>
            <div
              style={{
                width: '100%',
                height: '2px',
                background: 'rgba(255, 255, 255, 0.18)',
                borderRadius: '2px',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${stepsProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, rgba(255,255,255,0.4), #E0F2FE)',
                  boxShadow: '0 0 8px rgba(224, 242, 254, 0.8)',
                }}
              />
              {/* Triangle / Diamond Marker */}
              <div
                style={{
                  position: 'absolute',
                  left: `${stepsProgress}%`,
                  top: '-4px',
                  transform: 'translateX(-50%) rotate(45deg)',
                  width: '7px',
                  height: '7px',
                  background: '#FFFFFF',
                  boxShadow: '0 0 8px #FFFFFF',
                }}
              />
            </div>
          </div>
        </div>

        {/* -----------------------------------------------------------------
            CARD 3: "Oxygen in Blood" (98% Normal) — Orchid-Magenta Glow
            ----------------------------------------------------------------- */}
        <div
          onClick={() => openMetricDetail('spo2')}
          role="button"
          tabIndex={0}
          title="Ouvrir le suivi détaillé 24h de l'Oxygénation SpO2"
          style={{
            position: 'relative',
            minHeight: '148px',
            padding: '15px 15px 13px 15px',
            borderRadius: '26px',
            overflow: 'hidden',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background:
              'radial-gradient(ellipse at 60% 108%, rgba(217, 70, 239, 0.36) 0%, rgba(162, 28, 175, 0.14) 45%, rgba(10, 10, 12, 0.94) 78%), rgba(10, 10, 12, 0.86)',
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
            borderTop: '1px solid rgba(255, 248, 240, 0.16)',
            borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
            borderRight: '1px solid rgba(255, 248, 240, 0.12)',
            borderBottom: '1.5px solid rgba(240, 171, 252, 0.65)',
            boxShadow: '0 14px 30px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(217, 70, 239, 0.14)',
          }}
        >
          <span
            style={{
              fontSize: '12.5px',
              fontWeight: 400,
              color: 'rgba(250, 247, 242, 0.86)',
            }}
          >
            {language === "fr" ? "Oxygène dans le sang" : "Oxygen in Blood"}
          </span>

          {/* Bottom Split: Left Value (98% Normal) + Right Arch Gauge */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '8px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span
                  style={{
                    fontSize: '30px',
                    fontWeight: 300,
                    color: '#FAF7F2',
                    lineHeight: 1,
                    letterSpacing: '-0.8px',
                  }}
                >
                  {isFirstLaunch || !dayData.spo2 ? '--' : Math.round(dayData.spo2)}
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 300,
                    color: 'rgba(250, 247, 242, 0.8)',
                    marginLeft: '1px',
                  }}
                >
                  %
                </span>
              </div>
              <span
                style={{
                  fontSize: '10.5px',
                  color: 'rgba(250, 247, 242, 0.65)',
                  marginTop: '3px',
                  display: 'block',
                }}
              >
                Normal
              </span>
            </div>

            {/* Semi-circular Orchid Arch Gauge */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '9.5px',
                  color: '#F0ABFC',
                  marginBottom: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                }}
              >
                <span style={{ fontSize: '7px' }}>▲</span> 0.7%
              </span>

              <svg width="78" height="42" viewBox="0 0 78 42" style={{ overflow: 'visible' }}>
                {/* Inner dashed reference arc */}
                <path
                  d="M 10 38 A 29 29 0 0 1 68 38"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.25)"
                  strokeWidth="1"
                  strokeDasharray="2 2.5"
                />
                {/* Outer glowing orchid arch */}
                <path
                  d="M 4 38 A 35 35 0 0 1 74 38"
                  fill="none"
                  stroke="#E879F9"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(232, 121, 249, 0.85))' }}
                />
                {/* Glowing indicator dot on arch */}
                <circle
                  cx="56"
                  cy="10"
                  r="3.2"
                  fill="#FAF7F2"
                  stroke="#E879F9"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* -----------------------------------------------------------------
            CARD 4: "Skin Temperature" (36.8°c) — Warm Amber-Copper Glow
            ----------------------------------------------------------------- */}
        <div
          onClick={() => openMetricDetail('temp')}
          role="button"
          tabIndex={0}
          title="Ouvrir le suivi détaillé 24h de la Température Cutanée"
          style={{
            position: 'relative',
            minHeight: '148px',
            padding: '15px 15px 13px 15px',
            borderRadius: '26px',
            overflow: 'hidden',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background:
              'radial-gradient(ellipse at 50% 108%, rgba(251, 146, 60, 0.34) 0%, rgba(217, 119, 6, 0.14) 45%, rgba(10, 10, 12, 0.94) 78%), rgba(10, 10, 12, 0.86)',
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
            borderTop: '1px solid rgba(255, 248, 240, 0.16)',
            borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
            borderRight: '1px solid rgba(255, 248, 240, 0.12)',
            borderBottom: '1.5px solid rgba(253, 186, 116, 0.65)',
            boxShadow: '0 14px 30px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(251, 146, 60, 0.14)',
          }}
        >
          <span
            style={{
              fontSize: '12.5px',
              fontWeight: 400,
              color: 'rgba(250, 247, 242, 0.86)',
            }}
          >
            {language === "fr" ? "Température cutanée" : "Skin Temperature"}
          </span>

          {/* Center Value: 36.8°c */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', margin: '4px 0' }}>
            <span
              style={{
                fontSize: '30px',
                fontWeight: 300,
                color: '#FAF7F2',
                lineHeight: 1,
                letterSpacing: '-0.8px',
              }}
            >
              {skinTempAbs}
            </span>
            <span
              style={{
                fontSize: '15px',
                fontWeight: 300,
                color: 'rgba(250, 247, 242, 0.8)',
                marginLeft: '1px',
              }}
            >
              °c
            </span>
          </div>

          {/* Bottom Wave Curve with Amber Node + Low / High */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <svg width="100%" height="22" viewBox="0 0 140 22" style={{ overflow: 'visible' }}>
              {/* Dotted upper wave */}
              <path
                d="M 4 16 C 35 16, 55 4, 85 4 C 110 4, 125 10, 136 12"
                fill="none"
                stroke="rgba(255, 255, 255, 0.25)"
                strokeWidth="1"
                strokeDasharray="2 2.5"
              />
              {/* Smooth Amber Wave */}
              <path
                d="M 4 18 C 35 18, 52 10, 74 10 C 96 10, 115 16, 136 16"
                fill="none"
                stroke="#FB923C"
                strokeWidth="1.6"
                style={{ filter: 'drop-shadow(0 0 5px rgba(251, 146, 60, 0.8))' }}
              />
              {/* Glowing Amber Ring Marker */}
              <circle
                cx="74"
                cy="10"
                r="4.5"
                fill="#18120E"
                stroke="#FB923C"
                strokeWidth="2"
              />
              <circle cx="74" cy="10" r="1.8" fill="#FDBA74" />
            </svg>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '9.5px',
                color: 'rgba(250, 247, 242, 0.58)',
              }}
            >
              <span>{language === "fr" ? "Bas" : "Low"}</span>
              <span>{language === "fr" ? "Élevé" : "High"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          6. WIDE "GENERAL STATE" ADVANCED SENSING BANNER CARD
             Matches bottom-right wide card in reference ("82 Equilibrate")
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
          background:
            'radial-gradient(ellipse at 35% 100%, rgba(217, 249, 112, 0.25) 0%, rgba(82, 102, 42, 0.18) 48%, rgba(10, 10, 12, 0.96) 80%), #0A0A0C',
          borderTop: '1px solid rgba(255, 248, 240, 0.16)',
          borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
          borderRight: '1px solid rgba(255, 248, 240, 0.12)',
          borderBottom: '1.5px solid rgba(217, 249, 112, 0.45)',
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
          {selectedDay > 0 && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: scoreDiffYesterday >= 0 ? '#30D158' : '#FF453A',
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
            alt="Vyta One Smart Ring Sensors"
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

      {/* =====================================================================
          7. COMPLEMENTARY BIOMETRIC MODULES
          ===================================================================== */}
      <BodyEnergyGauge
        energy={dayData.bodyEnergy}
        wake={dayData.bodyEnergyWake}
        bedtime={dayData.bodyEnergyBedtime}
      />

      <ImmunityRadar anomaly={dayData.anomaly} />

      <SleepPhases sleep={dayData.sleep} />

      <CardioAge score={dayData.score} />
      </div>
    </div>
  );
};
