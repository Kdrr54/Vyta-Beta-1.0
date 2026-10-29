import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { weekMetrics, TODAY_INDEX, buildHypnogram, statusFor, emptyDayMetrics } from '../data/health';
import { WeekSelector } from './WeekSelector';
import { fmtDuration } from '../lib/format';
import {
  Moon,
  Sparkles,
  Heart,
  Droplets,
  Thermometer,
  Activity,
  Clock,
  Zap,
  ShieldCheck,
  ChevronRight,
  Info,
} from 'lucide-react';

export const SleepScreen: React.FC = () => {
  const { selectedDay, language, openMetricDetail, weekData, isFirstLaunch } = useApp();
  const dayData = (weekData && weekData[selectedDay]) || (isFirstLaunch ? emptyDayMetrics : (weekMetrics[selectedDay] || weekMetrics[TODAY_INDEX]));
  const sleep = dayData.sleep;

  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [hoverBlockIndex, setHoverBlockIndex] = useState<number | null>(null);

  const isEn = language === 'en';

  const totalMin = sleep.deepMin + sleep.remMin + sleep.lightMin + sleep.awakeMin;
  const effectiveMin = Math.max(0, totalMin - sleep.awakeMin);

  const deepPct = totalMin > 0 ? Math.round((sleep.deepMin / totalMin) * 100) : 0;
  const remPct = totalMin > 0 ? Math.round((sleep.remMin / totalMin) * 100) : 0;
  const lightPct = totalMin > 0 ? Math.round((sleep.lightMin / totalMin) * 100) : 0;
  const awakePct = totalMin > 0 ? Math.max(1, 100 - (deepPct + remPct + lightPct)) : 0;

  const efficiency = totalMin > 0 ? Math.round((effectiveMin / totalMin) * 100) : 0;
  const isZeroState = totalMin === 0 || (isFirstLaunch && dayData.score === 0);

  const stages = [
    {
      id: 'deep',
      label: isEn ? 'Deep Sleep' : 'Sommeil Profond',
      minutes: sleep.deepMin,
      pct: deepPct,
      color: '#818CF8',
      desc: isEn
        ? 'Physical repair, muscle growth, and cellular rejuvenation.'
        : 'Réparation physique, régénération musculaire et sécrétion hormonale.',
    },
    {
      id: 'rem',
      label: isEn ? 'REM Sleep' : 'Sommeil Paradoxal',
      minutes: sleep.remMin,
      pct: remPct,
      color: '#C084FC',
      desc: isEn
        ? 'Memory consolidation, creative synthesis, and emotional processing.'
        : 'Consolidation de la mémoire, créativité et équilibre émotionnel.',
    },
    {
      id: 'light',
      label: isEn ? 'Light Sleep' : 'Sommeil Léger',
      minutes: sleep.lightMin,
      pct: lightPct,
      color: '#67E8F9',
      desc: isEn
        ? 'Neuromuscular transition and core body temperature reduction.'
        : 'Transition neuromusculaire et détente du système nerveux.',
    },
    {
      id: 'awake',
      label: isEn ? 'Awake Time' : 'Éveil & Micro-réveils',
      minutes: sleep.awakeMin,
      pct: awakePct,
      color: 'rgba(255, 255, 255, 0.4)',
      desc: isEn
        ? 'Natural and imperceptible micro-arousals during cycle switches.'
        : 'Micro-éveils physiologiques naturels et imperceptibles.',
    },
  ];

  // Hypnogram blocks
  const hypnogram = buildHypnogram(sleep);

  // SVG Donut metrics
  const donutSize = 140;
  const strokeW = 12;
  const radius = (donutSize - strokeW) / 2 - 2;
  const center = donutSize / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = 3;
  const availableLength = circumference - gap * stages.length;

  let currentOffset = 0;
  const segments = stages.map((st) => {
    const arcLength = totalMin > 0 ? (st.minutes / totalMin) * availableLength : 0;
    const dashArray = `${arcLength.toFixed(2)} ${(circumference - arcLength).toFixed(2)}`;
    const dashOffset = -currentOffset;
    currentOffset += arcLength + gap;
    return { ...st, dashArray, dashOffset };
  });

  return (
    <div
      className="screen-container sleep-screen-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '0 16px 110px 16px',
        animation: 'fadeIn 250ms ease',
      }}
    >
      {/* 1. WEEK SELECTOR */}
      <WeekSelector />

      <div key={selectedDay} className="day-view-transition" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* 2. HERO SLEEP SCORE BANNER */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          padding: '18px 20px',
          borderRadius: '26px',
          overflow: 'hidden',
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(167, 139, 250, 0.32) 0%, rgba(129, 140, 248, 0.12) 55%, rgba(10, 10, 12, 0.96) 85%), #0A0A0E',
          backdropFilter: 'blur(26px)',
          WebkitBackdropFilter: 'blur(26px)',
          borderTop: '1px solid rgba(255, 248, 240, 0.16)',
          borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
          borderRight: '1px solid rgba(255, 248, 240, 0.12)',
          borderBottom: '1.5px solid rgba(167, 139, 250, 0.65)',
          boxShadow: '0 14px 34px rgba(0, 0, 0, 0.6), 0 4px 20px rgba(167, 139, 250, 0.16)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          userSelect: 'none',
        }}
      >
        {/* Top Tag Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'rgba(167, 139, 250, 0.18)',
                border: '1px solid rgba(167, 139, 250, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 10px rgba(167, 139, 250, 0.35)',
              }}
            >
              <Moon size={14} color="#A78BFA" />
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAF7F2' }}>
              {isEn ? 'Sleep Architecture' : 'Score de Sommeil'}
            </span>
          </div>

          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2.5px 8.5px',
              borderRadius: '999px',
              color: '#A78BFA',
              background: 'rgba(167, 139, 250, 0.14)',
              border: '1px solid rgba(167, 139, 250, 0.4)',
              boxShadow: '0 0 10px rgba(167, 139, 250, 0.25)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {isZeroState || sleep.score === 0
              ? (isEn ? 'Awaiting night sleep' : 'En attente de la nuit')
              : (sleep.score >= 85
                  ? (isEn ? 'Optimal Recovery' : 'Sommeil Réparateur')
                  : statusFor(sleep.score))}
          </span>
        </div>

        {/* Center Big Score & Total Duration */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span
                style={{
                  fontSize: '44px',
                  fontWeight: 300,
                  color: '#FAF7F2',
                  lineHeight: 1,
                  letterSpacing: '-1.5px',
                  textShadow: '0 0 24px rgba(167, 139, 250, 0.45)',
                }}
              >
                {isZeroState || sleep.score === 0 ? '--' : sleep.score}
              </span>
              {(!isZeroState && sleep.score > 0) && (
                <span style={{ fontSize: '16px', color: 'rgba(250, 247, 242, 0.65)', fontWeight: 500 }}>
                  /100
                </span>
              )}
            </div>
            <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.65)', marginTop: '4px', display: 'block' }}>
              {isEn ? 'Total restful sleep' : 'Sommeil effectif total'}
            </span>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                fontSize: '26px',
                fontWeight: 400,
                color: '#FAF7F2',
                lineHeight: 1,
                fontFamily: 'var(--font-display)',
              }}
            >
              {isZeroState || totalMin === 0 ? '--' : fmtDuration(totalMin)}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'rgba(250, 247, 242, 0.65)',
                marginTop: '4px',
                display: 'block',
              }}
            >
              {isEn
                ? isZeroState || totalMin === 0
                  ? 'Awaiting night'
                  : `Effective sleep ${fmtDuration(effectiveMin)}`
                : isZeroState || totalMin === 0
                  ? 'En attente de la nuit'
                  : `Sommeil effectif ${fmtDuration(effectiveMin)}`}
            </span>
          </div>
        </div>

        {/* Circadian Schedule Pill Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '6px',
            paddingTop: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)', display: 'block' }}>
              {isEn ? 'Bedtime' : 'Coucher'}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
              {isZeroState ? '--:--' : '23:18'}
            </span>
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)', display: 'block' }}>
              {isEn ? 'Wake' : 'Réveil'}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
              {isZeroState ? '--:--' : '07:04'}
            </span>
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)', display: 'block' }}>
              {isEn ? 'Efficiency' : 'Efficacité'}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#30D158', fontFamily: 'var(--font-mono)' }}>
              {isZeroState ? '--' : `${efficiency}%`}
            </span>
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)', display: 'block' }}>
              {isEn ? 'Latency' : 'Latence'}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
              {isZeroState ? '--' : '14 min'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. INTERACTIVE HYPNOGRAM TIMELINE (LE TRACÉ DES CYCLES DE NUIT) */}
      <div
        style={{
          background: 'rgba(18, 18, 22, 0.78)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          borderRadius: '24px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={13} color="#A78BFA" />
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#FAF7F2' }}>
              {isEn ? 'Hypnogram & Night Cycles' : 'Hypnogramme & Cycles Nocturnes'}
            </span>
          </div>
          <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.6)' }}>
            {isZeroState ? (isEn ? '0 Cycle' : '0 Cycle') : (isEn ? '5 Full Cycles' : '5 Cycles Complets')}
          </span>
        </div>

        {/* Hypnogram Step Chart */}
        <div style={{ position: 'relative', width: '100%', paddingTop: '4px' }}>
          <svg width="100%" height="90" viewBox="0 0 320 90" preserveAspectRatio="none">
            <defs>
              <linearGradient id="deepGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818CF8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#818CF8" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {/* Horizontal level grid lines */}
            {[
              { label: isEn ? 'Awake' : 'Éveil', y: 15, color: 'rgba(255,255,255,0.3)' },
              { label: isEn ? 'REM' : 'REM', y: 38, color: '#C084FC' },
              { label: isEn ? 'Light' : 'Léger', y: 60, color: '#67E8F9' },
              { label: isEn ? 'Deep' : 'Profond', y: 82, color: '#818CF8' },
            ].map((lvl, i) => (
              <g key={i}>
                <line
                  x1="45"
                  y1={lvl.y}
                  x2="315"
                  y2={lvl.y}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeDasharray="2 2"
                />
                <text
                  x="40"
                  y={lvl.y + 3.5}
                  textAnchor="end"
                  fill={lvl.color}
                  fontSize="8.5"
                  fontFamily="var(--font-mono)"
                  fontWeight="600"
                >
                  {lvl.label}
                </text>
              </g>
            ))}

            {/* Hypnogram Blocks rendering */}
            {hypnogram.map((block, idx) => {
              const totalM = totalMin || 480;
              const startX = 45 + (block.startMin / totalM) * 270;
              const width = Math.max(2.5, (block.durationMin / totalM) * 270);

              const stageY =
                block.stage === 'awake'
                  ? 15
                  : block.stage === 'rem'
                  ? 38
                  : block.stage === 'light'
                  ? 60
                  : 82;

              const stageColor =
                block.stage === 'deep'
                  ? '#818CF8'
                  : block.stage === 'rem'
                  ? '#C084FC'
                  : block.stage === 'light'
                  ? '#67E8F9'
                  : 'rgba(255, 255, 255, 0.45)';

              return (
                <rect
                  key={idx}
                  x={startX}
                  y={stageY - 5}
                  width={width}
                  height="10"
                  rx="3"
                  fill={stageColor}
                  opacity={hoverBlockIndex === idx ? 1 : 0.85}
                  style={{
                    filter:
                      block.stage === 'deep' || block.stage === 'rem'
                        ? `drop-shadow(0 0 4px ${stageColor})`
                        : undefined,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={() => setHoverBlockIndex(idx)}
                  onMouseLeave={() => setHoverBlockIndex(null)}
                />
              );
            })}
          </svg>

          {/* Time axis below chart */}
          {isZeroState ? (
            <div
              style={{
                textAlign: 'center',
                paddingLeft: '45px',
                fontSize: '9.5px',
                color: 'rgba(250, 247, 242, 0.4)',
                fontFamily: 'var(--font-mono)',
                marginTop: '4px',
              }}
            >
              {isEn ? 'No sleep cycle recorded' : 'Aucun cycle enregistré'}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingLeft: '45px',
                fontSize: '9px',
                color: 'rgba(250, 247, 242, 0.45)',
                fontFamily: 'var(--font-mono)',
                marginTop: '4px',
              }}
            >
              <span>23:18</span>
              <span>01:00</span>
              <span>03:00</span>
              <span>05:00</span>
              <span>07:04</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. SLEEP STAGES DONUT & 4 CARDS */}
      <div
        style={{
          background: 'rgba(18, 18, 22, 0.78)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          borderRadius: '24px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#FAF7F2' }}>
            {isEn ? 'Sleep Stages Breakdown' : 'Répartition des 4 Phases'}
          </span>
          <span style={{ fontSize: '11px', color: '#A78BFA', fontWeight: 600 }}>
            {isEn ? 'Clinical Ratio' : 'Ratio clinique optimal'}
          </span>
        </div>

        {/* Donut and Legend row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          {/* Donut Chart */}
          <div style={{ position: 'relative', width: `${donutSize}px`, height: `${donutSize}px`, flexShrink: 0 }}>
            <svg width={donutSize} height={donutSize} style={{ transform: 'rotate(-90deg)' }}>
              {/* Background ring track */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.06)"
                strokeWidth={strokeW}
              />
              {/* Segment arcs */}
              {segments.map((seg, idx) => (
                <circle
                  key={idx}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={activeStageId === seg.id ? strokeW + 3 : strokeW}
                  strokeDasharray={seg.dashArray}
                  strokeDashoffset={seg.dashOffset}
                  strokeLinecap="round"
                  style={{
                    filter: `drop-shadow(0 0 6px ${seg.color})`,
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                  }}
                  onClick={() => setActiveStageId(activeStageId === seg.id ? null : seg.id)}
                />
              ))}
            </svg>

            {/* Center Donut Label */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#FAF7F2',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {isZeroState || totalMin === 0 ? '--' : fmtDuration(totalMin)}
              </span>
              <span style={{ fontSize: '9px', color: 'rgba(250, 247, 242, 0.6)' }}>
                {isEn ? 'Total Sleep' : 'Sommeil total'}
              </span>
            </div>
          </div>

          {/* Quick Legend Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            {stages.map((st) => {
              const isSelected = activeStageId === st.id;
              return (
                <div
                  key={st.id}
                  onClick={() => setActiveStageId(isSelected ? null : st.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 6px',
                    borderRadius: '8px',
                    background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: st.color,
                        boxShadow: `0 0 6px ${st.color}`,
                      }}
                    />
                    <span style={{ fontSize: '11px', color: '#FAF7F2', fontWeight: 500 }}>{st.label}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
                      {isZeroState || st.minutes === 0 ? '--' : fmtDuration(st.minutes)}
                    </span>
                    <span
                      style={{
                        fontSize: '9.5px',
                        color: st.color,
                        fontWeight: 600,
                        minWidth: '28px',
                        textAlign: 'right',
                      }}
                    >
                      {isZeroState || st.minutes === 0 ? '--' : `${st.pct}%`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Stage Detail Description Box */}
        {activeStageId && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              animation: 'fadeIn 180ms ease',
            }}
          >
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#FAF7F2', display: 'block', marginBottom: '2px' }}>
              {stages.find((s) => s.id === activeStageId)?.label}
            </span>
            <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.7)', lineHeight: 1.4 }}>
              {stages.find((s) => s.id === activeStageId)?.desc}
            </span>
          </div>
        )}
      </div>

      {/* 5. NOCTURNAL BIOMARKERS DURING SLEEP */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.85)', paddingLeft: '2px' }}>
          {isEn ? 'Nocturnal Biometrics' : 'Biomarqueurs Nocturnes'}
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {/* Creux Cardiaque (Lowest Resting Heart Rate) */}
          <div
            onClick={() => openMetricDetail('bpm')}
            role="button"
            tabIndex={0}
            style={{
              background: 'rgba(255, 69, 58, 0.08)',
              border: '1px solid rgba(255, 69, 58, 0.22)',
              borderRadius: '18px',
              padding: '12px 14px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '6px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.65)', fontWeight: 600, textTransform: 'uppercase' }}>
                {isEn ? 'Resting Nadir' : 'Creux Cardiaque'}
              </span>
              <Heart size={13} color="#FF453A" fill="#FF453A" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                <span style={{ fontSize: '24px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-display)' }}>
                  {isZeroState || !dayData.minBpm ? 0 : dayData.minBpm}
                </span>
                <span style={{ fontSize: '11px', color: '#FF453A', fontWeight: 600 }}>BPM</span>
              </div>
              <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)' }}>
                {isZeroState || !dayData.minBpm
                  ? (isEn ? 'No deep sleep recorded' : 'En attente de nuit')
                  : (isEn ? 'at 03:15 (Deep sleep)' : 'à 03:15 (Sommeil profond)')}
              </span>
            </div>
          </div>

          {/* VRC Nocturne (HRV) */}
          <div
            onClick={() => openMetricDetail('hrv')}
            role="button"
            tabIndex={0}
            style={{
              background: 'rgba(217, 249, 112, 0.08)',
              border: '1px solid rgba(217, 249, 112, 0.22)',
              borderRadius: '18px',
              padding: '12px 14px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '6px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.65)', fontWeight: 600, textTransform: 'uppercase' }}>
                {isEn ? 'Nightly HRV' : 'VRC Nocturne'}
              </span>
              <Activity size={13} color="#D9F970" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                <span style={{ fontSize: '24px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-display)' }}>
                  {dayData.hrv}
                </span>
                <span style={{ fontSize: '11px', color: '#D9F970', fontWeight: 600 }}>ms</span>
              </div>
              <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)' }}>
                {isZeroState ? (isEn ? 'No sleep recorded' : 'En attente de nuit') : (isEn ? 'Parasympathetic high' : 'Récupération nerveuse')}
              </span>
            </div>
          </div>

          {/* SpO2 Nocturne */}
          <div
            onClick={() => openMetricDetail('spo2')}
            role="button"
            tabIndex={0}
            style={{
              background: 'rgba(232, 121, 249, 0.08)',
              border: '1px solid rgba(232, 121, 249, 0.22)',
              borderRadius: '18px',
              padding: '12px 14px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '6px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.65)', fontWeight: 600, textTransform: 'uppercase' }}>
                {isEn ? 'Oxygenation' : 'SpO2 Nocturne'}
              </span>
              <Droplets size={13} color="#E879F9" fill="#E879F9" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                <span style={{ fontSize: '24px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-display)' }}>
                  {Math.round(dayData.spo2)}
                </span>
                <span style={{ fontSize: '11px', color: '#E879F9', fontWeight: 600 }}>%</span>
              </div>
              <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)' }}>
                {isZeroState ? (isEn ? 'Not measured' : 'Non mesuré') : (isEn ? '0 apnea events' : '0 apnée détectée')}
              </span>
            </div>
          </div>

          {/* Creux Thermique Circadien */}
          <div
            onClick={() => openMetricDetail('temp')}
            role="button"
            tabIndex={0}
            style={{
              background: 'rgba(251, 146, 60, 0.08)',
              border: '1px solid rgba(251, 146, 60, 0.22)',
              borderRadius: '18px',
              padding: '12px 14px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '6px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.65)', fontWeight: 600, textTransform: 'uppercase' }}>
                {isEn ? 'Skin Temp Dip' : 'Creux Thermique'}
              </span>
              <Thermometer size={13} color="#FB923C" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                <span style={{ fontSize: '24px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-display)' }}>
                  {dayData.tempDelta > 0 ? `+${dayData.tempDelta}` : dayData.tempDelta}
                </span>
                <span style={{ fontSize: '11px', color: '#FB923C', fontWeight: 600 }}>°C</span>
              </div>
              <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)' }}>
                {isZeroState ? (isEn ? 'No sleep recorded' : 'En attente de nuit') : (isEn ? 'Optimal circadian drop' : 'Baisse circadienne saine')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. SLEEP COACH & CHRONOTYPE INSIGHTS */}
      <div
        style={{
          background: 'rgba(20, 20, 26, 0.85)',
          border: '1px solid rgba(167, 139, 250, 0.25)',
          borderRadius: '24px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 16px rgba(167, 139, 250, 0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="#A78BFA" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#FAF7F2' }}>
            {isEn ? 'Circadian Coach & Insights' : 'Analyse Circadienne & Recommandations'}
          </span>
        </div>

        <p style={{ fontSize: '12.5px', lineHeight: 1.5, color: '#FAF7F2', margin: 0 }}>
          {isZeroState
            ? (isEn
                ? 'No sleep session recorded yet. Wear your Vyta One ring tonight to analyze your sleep architecture, resting nadir and circadian rhythm.'
                : 'Aucune session de sommeil enregistrée pour le moment. Portez votre bague Vyta One cette nuit pour analyser votre architecture de sommeil, vos creux cardiaques et votre rythme circadien.')
            : (isEn
                ? 'Optimal sleep synchrony. Your bedtime at 23:18 aligned smoothly with your natural melatonin release window, ensuring 24% deep restorative recovery.'
                : "Synchronisation circadienne idéale. Votre endormissement à 23:18 s'est calé avec précision sur votre pic naturel de mélatonine, garantissant un sommeil profond très réparateur (24%).")}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.035)',
            }}
          >
            <ShieldCheck size={14} color={isZeroState ? '#A78BFA' : '#30D158'} style={{ marginTop: '2px', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.8)', lineHeight: 1.4 }}>
              <strong>{isEn ? 'Regularity' : 'Régularité'} :</strong>{' '}
              {isZeroState
                ? (isEn ? 'Waiting for first sleep telemetry.' : 'En attente de vos premières mesures nocturnes.')
                : (isEn
                    ? 'Bedtime variance within ±15 min strengthens your master biological clock.'
                    : 'Variabilité de coucher inférieure à ±15 min, ce qui renforce durablement votre horloge biologique.')}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.035)',
            }}
          >
            <Zap size={14} color="#A78BFA" style={{ marginTop: '2px', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.8)', lineHeight: 1.4 }}>
              <strong>{isEn ? 'Tonight Advice' : 'Conseil pour ce soir'} :</strong>{' '}
              {isZeroState
                ? (isEn ? 'Wear your ring snugly on your finger before going to sleep to activate continuous optical tracking.' : 'Gardez votre bague ajustée au doigt avant de vous coucher pour activer le suivi continu.')
                : (isEn
                    ? 'Dim overhead lights 45 min before sleep to sustain this high deep sleep proportion.'
                    : 'Tamisez la lumière 45 minutes avant le coucher pour préserver ce taux élevé de sommeil profond.')}
            </span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
