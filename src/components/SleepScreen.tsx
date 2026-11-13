import React, { useState, useMemo } from 'react';
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
  Sun,
  Plus,
  Trash2,
  X,
  Layers,
  Info,
  Wind,
} from 'lucide-react';

export const SleepScreen: React.FC = () => {
  const { selectedDay, language, openMetricDetail, weekData, isFirstLaunch, deleteNap, openModal } = useApp();
  const dayData = (weekData && weekData[selectedDay]) || (isFirstLaunch ? emptyDayMetrics : (weekMetrics[selectedDay] || weekMetrics[TODAY_INDEX]));
  const sleep = dayData.sleep;
  const naps = dayData.naps || [];

  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [hoverBlockIndex, setHoverBlockIndex] = useState<number | null>(null);
  const [showClinicalRatioModal, setShowClinicalRatioModal] = useState<boolean>(false);

  const isEn = language === 'en';

  // Calculs mémoïsés pour garantir 60 FPS constants sans saccades
  const totalMin = useMemo(() => {
    return (sleep.deepMin || 0) + (sleep.remMin || 0) + (sleep.lightMin || 0) + (sleep.awakeMin || 0);
  }, [sleep.deepMin, sleep.remMin, sleep.lightMin, sleep.awakeMin]);

  const effectiveMin = useMemo(() => {
    return Math.max(0, totalMin - (sleep.awakeMin || 0));
  }, [totalMin, sleep.awakeMin]);

  const hasSlept = useMemo(() => {
    return !isFirstLaunch && totalMin >= 45 && (sleep.score || 0) > 0;
  }, [isFirstLaunch, totalMin, sleep.score]);

  const deepPct = useMemo(() => (hasSlept && totalMin > 0 ? Math.round((sleep.deepMin / totalMin) * 100) : 0), [hasSlept, totalMin, sleep.deepMin]);
  const remPct = useMemo(() => (hasSlept && totalMin > 0 ? Math.round((sleep.remMin / totalMin) * 100) : 0), [hasSlept, totalMin, sleep.remMin]);
  const lightPct = useMemo(() => (hasSlept && totalMin > 0 ? Math.round((sleep.lightMin / totalMin) * 100) : 0), [hasSlept, totalMin, sleep.lightMin]);
  const awakePct = useMemo(() => (hasSlept && totalMin > 0 ? Math.max(1, 100 - (deepPct + remPct + lightPct)) : 0), [hasSlept, totalMin, deepPct, remPct, lightPct]);
  const efficiency = useMemo(() => (hasSlept && totalMin > 0 ? Math.round((effectiveMin / totalMin) * 100) : 0), [hasSlept, totalMin, effectiveMin]);

  const fmtClockMin = (min?: number) => {
    if (min === undefined || min === null || isNaN(min)) return '--:--';
    const norm = ((Math.round(min) % 1440) + 1440) % 1440;
    const h = Math.floor(norm / 60);
    const m = norm % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const bedtimeStr = hasSlept && sleep.startMin !== undefined ? fmtClockMin(sleep.startMin) : '--:--';
  const wakeStr = hasSlept && sleep.endMin !== undefined ? fmtClockMin(sleep.endMin) : '--:--';
  const cycleCount = hasSlept && totalMin > 0 ? Math.max(1, Math.round(totalMin / 90)) : 0;

  const hypnogramTimeLabels = useMemo(() => {
    if (!hasSlept || sleep.startMin === undefined || sleep.endMin === undefined) {
      return ['--:--', '--:--', '--:--', '--:--', '--:--'];
    }
    const s = sleep.startMin > sleep.endMin ? sleep.startMin - 1440 : sleep.startMin;
    const e = sleep.endMin;
    return [0, 0.25, 0.5, 0.75, 1].map((t) => fmtClockMin(s + (e - s) * t));
  }, [hasSlept, sleep.startMin, sleep.endMin]);

  const stages = useMemo(() => [
    {
      id: 'deep',
      label: isEn ? 'Deep Sleep' : 'Sommeil Profond',
      target: '20 – 25%',
      targetRange: [20, 25],
      minutes: sleep.deepMin,
      pct: deepPct,
      color: '#818CF8',
      tag: isEn ? 'Physical Repair' : 'Régénération physique',
      desc: isEn
        ? 'Physical repair, muscle growth, cellular rejuvenation and growth hormone release.'
        : 'Réparation physique, régénération musculaire et sécrétion d’hormone de croissance.',
      status: !hasSlept ? (isEn ? 'Pending' : 'En attente') : (deepPct >= 20 ? (isEn ? 'Optimal' : 'Optimal') : (isEn ? 'Low' : 'À améliorer')),
    },
    {
      id: 'rem',
      label: isEn ? 'REM Sleep' : 'Sommeil Paradoxal',
      target: '20 – 25%',
      targetRange: [20, 25],
      minutes: sleep.remMin,
      pct: remPct,
      color: '#C084FC',
      tag: isEn ? 'Memory & Brain' : 'Mémoire & Plasticité',
      desc: isEn
        ? 'Memory consolidation, creative synthesis, emotional regulation, and vivid dreams.'
        : 'Consolidation de la mémoire, régulation des émotions et clarté mentale.',
      status: !hasSlept ? (isEn ? 'Pending' : 'En attente') : (remPct >= 20 ? (isEn ? 'Ideal' : 'Idéal') : (isEn ? 'Low' : 'À améliorer')),
    },
    {
      id: 'light',
      label: isEn ? 'Light Sleep' : 'Sommeil Léger',
      target: '45 – 55%',
      targetRange: [45, 55],
      minutes: sleep.lightMin,
      pct: lightPct,
      color: '#67E8F9',
      tag: isEn ? 'Nervous Rest' : 'Détente nerveuse',
      desc: isEn
        ? 'Neuromuscular transition and core body temperature reduction.'
        : 'Transition neuromusculaire, stabilisation du rythme cardiaque et détente corporelle.',
      status: !hasSlept ? (isEn ? 'Pending' : 'En attente') : (isEn ? 'Balanced' : 'Équilibré'),
    },
    {
      id: 'awake',
      label: isEn ? 'Awake & Arousals' : 'Éveil & Micro-réveils',
      target: '< 10%',
      targetRange: [0, 10],
      minutes: sleep.awakeMin,
      pct: awakePct,
      color: 'rgba(255, 255, 255, 0.45)',
      tag: isEn ? 'Micro-transitions' : 'Micro-transitions',
      desc: isEn
        ? 'Natural physiological micro-arousals during ultradian 90-min cycle transitions.'
        : 'Micro-éveils physiologiques naturels lors des transitions de cycle de 90 min.',
      status: !hasSlept ? (isEn ? 'Pending' : 'En attente') : (awakePct <= 10 ? (isEn ? 'Calm' : 'Calme') : (isEn ? 'Restless' : 'Agité')),
    },
  ], [isEn, sleep.deepMin, sleep.remMin, sleep.lightMin, sleep.awakeMin, deepPct, remPct, lightPct, awakePct, hasSlept]);

  // Hypnogramme uniquement calculé si du sommeil nocturne réel existe
  const hypnogram = useMemo(() => (hasSlept ? buildHypnogram(sleep) : []), [hasSlept, sleep]);

  // Biomarqueurs strictement nocturnes
  const nocturnalBpmVal = hasSlept && dayData.minBpm && dayData.minBpm >= 40 ? dayData.minBpm : (hasSlept && dayData.restingBpm ? dayData.restingBpm : null);
  const nocturnalHrvVal = hasSlept && dayData.hrv && dayData.hrv > 0 ? dayData.hrv : null;
  const nocturnalRespVal = hasSlept && dayData.resp && dayData.resp > 0 ? dayData.resp : null;
  const nocturnalSpo2Val = hasSlept && dayData.spo2 && dayData.spo2 >= 70 ? Math.round(dayData.spo2) : null;
  const nocturnalTempDeltaVal = hasSlept && dayData.tempDelta !== undefined && dayData.tempDelta !== 0
    ? (dayData.tempDelta > 0 ? `+${dayData.tempDelta}` : `${dayData.tempDelta}`)
    : (hasSlept && dayData.skinTemp ? `${(dayData.skinTemp - 36.5).toFixed(1)}` : null);

  return (
    <div
      className="screen-container sleep-screen-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        padding: '0 16px 120px 16px',
        contain: 'content',
      }}
    >
      {/* 1. SÉLECTEUR DE JOUR (SEMAINE) */}
      <WeekSelector />

      <div
        key={selectedDay}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          animation: 'fadeIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* 2. HERO SCORE & SOMMEIL RÉPARATEUR (STYLE ÉPURÉ OURA / APPLE HEALTH) */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            padding: '20px 22px',
            borderRadius: '24px',
            background: 'linear-gradient(180deg, #13141F 0%, #0D0E16 100%)',
            border: '1px solid rgba(167, 139, 250, 0.22)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.55), 0 0 20px rgba(167, 139, 250, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            userSelect: 'none',
          }}
        >
          {/* Top Row: Pill Tag + Status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'rgba(167, 139, 250, 0.16)',
                  border: '1px solid rgba(167, 139, 250, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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
                padding: '3px 9px',
                borderRadius: '999px',
                color: '#A78BFA',
                background: 'rgba(167, 139, 250, 0.12)',
                border: '1px solid rgba(167, 139, 250, 0.35)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {!hasSlept
                ? (isEn ? 'Awaiting night' : 'En attente')
                : (sleep.score >= 85
                    ? (isEn ? 'Restful Sleep' : 'Sommeil Réparateur')
                    : statusFor(sleep.score))}
            </span>
          </div>

          {/* Center Main: Score Ring & Effective Duration */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Circular Gauge Score */}
              <div style={{ position: 'relative', width: '64px', height: '64px' }}>
                <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="32"
                    cy="32"
                    r="27"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="5"
                  />
                  {hasSlept && (
                    <circle
                      cx="32"
                      cy="32"
                      r="27"
                      fill="none"
                      stroke="#A78BFA"
                      strokeWidth="5"
                      strokeDasharray="169.6"
                      strokeDashoffset={169.6 * (1 - (sleep.score || 0) / 100)}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                    />
                  )}
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '20px',
                      fontWeight: 800,
                      color: '#FAF7F2',
                      lineHeight: 1,
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {!hasSlept ? '--' : sleep.score}
                  </span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)', display: 'block' }}>
                  {isEn ? 'Restful Sleep' : 'Sommeil effectif'}
                </span>
                <span
                  style={{
                    fontSize: '26px',
                    fontWeight: 700,
                    color: '#FAF7F2',
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '-0.5px',
                  }}
                >
                  {!hasSlept ? '--' : fmtDuration(effectiveMin)}
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)', display: 'block' }}>
                {isEn ? 'Time in bed' : 'Temps au lit'}
              </span>
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'rgba(250, 247, 242, 0.85)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {hasSlept && totalMin > 0 ? fmtDuration(totalMin) : '--'}
              </span>
            </div>
          </div>

          {/* Bottom Hairline Stats: Coucher • Réveil • Efficacité */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {isEn ? 'Bedtime' : 'Coucher'}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
                {bedtimeStr}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
              <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {isEn ? 'Wake-Up' : 'Réveil'}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
                {wakeStr}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {isEn ? 'Efficiency' : 'Efficacité'}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: !hasSlept ? '#FAF7F2' : efficiency >= 85 ? '#30D158' : efficiency >= 75 ? '#FFD60A' : '#FF453A',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {!hasSlept ? '--' : `${efficiency}%`}
              </span>
            </div>
          </div>
        </div>

        {/* 3. CARTE UNIQUE & COMPACTE : HYPNOGRAMME & 4 PHASES DE SOMMEIL */}
        <div
          style={{
            background: '#11121A',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'rgba(129, 140, 248, 0.15)',
                  border: '1px solid rgba(129, 140, 248, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Layers size={13} color="#818CF8" />
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#FAF7F2' }}>
                {isEn ? 'Sleep Cycles & Hypnogram' : 'Cycles & Phases Nocturnes'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.6)', fontFamily: 'var(--font-mono)' }}>
                {!hasSlept ? (isEn ? '0 Cycle' : '0 Cycle') : `${cycleCount} ${isEn ? 'Cycles (90m)' : 'Cycles (90m)'}`}
              </span>

              <button
                type="button"
                onClick={() => setShowClinicalRatioModal(!showClinicalRatioModal)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: '3px 7px',
                  color: 'rgba(250, 247, 242, 0.8)',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <Info size={11} color="#A78BFA" />
                <span>{isEn ? 'Target' : 'Cible'}</span>
              </button>
            </div>
          </div>

          {/* Clinical Ratio Info Dropdown */}
          {showClinicalRatioModal && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '12px',
                background: 'rgba(167, 139, 250, 0.08)',
                border: '1px solid rgba(167, 139, 250, 0.25)',
                fontSize: '11px',
                color: 'rgba(250, 247, 242, 0.85)',
                lineHeight: 1.45,
              }}
            >
              <strong style={{ color: '#A78BFA' }}>{isEn ? 'Clinical Standards:' : 'Architecture clinique de référence :'}</strong>{' '}
              {isEn
                ? 'Deep (20-25%) for muscle and tissue repair, REM (20-25%) for neural plasticity, Light (45-55%) for nervous rest, Awake (<10%) for micro-transitions.'
                : 'Profond (20-25%) régénération musculaire, Paradoxal (20-25%) plasticité cérébrale, Léger (45-55%) détente nerveuse, Éveil (<10%) micro-transitions normales.'}
            </div>
          )}

          {/* Hypnogram Step Chart */}
          <div style={{ position: 'relative', width: '100%' }}>
            <svg width="100%" height="86" viewBox="0 0 320 86" preserveAspectRatio="none">
              {/* Horizontal level grid lines */}
              {[
                { label: isEn ? 'Awake' : 'Éveil', y: 14, color: 'rgba(255,255,255,0.4)' },
                { label: isEn ? 'REM' : 'REM', y: 36, color: '#C084FC' },
                { label: isEn ? 'Light' : 'Léger', y: 58, color: '#67E8F9' },
                { label: isEn ? 'Deep' : 'Profond', y: 80, color: '#818CF8' },
              ].map((lvl, i) => (
                <g key={i}>
                  <line
                    x1="45"
                    y1={lvl.y}
                    x2="315"
                    y2={lvl.y}
                    stroke="rgba(255, 255, 255, 0.07)"
                    strokeDasharray="2 2"
                  />
                  <text
                    x="40"
                    y={lvl.y + 3}
                    textAnchor="end"
                    fill={lvl.color}
                    fontSize="8.5"
                    fontWeight="600"
                    fontFamily="var(--font-mono)"
                  >
                    {lvl.label}
                  </text>
                </g>
              ))}

              {/* Hypnogram Blocks */}
              {hasSlept && hypnogram.map((block, idx) => {
                const xStart = 48 + (block.startMin / totalMin) * (315 - 48);
                const blockWidth = Math.max(2.5, (block.durationMin / totalMin) * (315 - 48));
                const yMap: Record<string, { y: number; h: number; color: string }> = {
                  awake: { y: 10, h: 8, color: 'rgba(255,255,255,0.5)' },
                  rem: { y: 32, h: 8, color: '#C084FC' },
                  light: { y: 54, h: 8, color: '#67E8F9' },
                  deep: { y: 76, h: 8, color: '#818CF8' },
                };
                const meta = yMap[block.stage];
                const isHovered = hoverBlockIndex === idx;

                return (
                  <rect
                    key={idx}
                    x={xStart}
                    y={meta.y}
                    width={blockWidth}
                    height={meta.h}
                    rx="2.5"
                    fill={meta.color}
                    style={{
                      opacity: hoverBlockIndex === null ? 0.92 : isHovered ? 1 : 0.45,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={() => setHoverBlockIndex(idx)}
                    onMouseLeave={() => setHoverBlockIndex(null)}
                  />
                );
              })}
            </svg>

            {/* Time axis below chart */}
            {!hasSlept ? (
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
                {isEn ? 'No sleep cycle recorded' : 'Aucun cycle enregistré cette nuit'}
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
                {hypnogramTimeLabels.map((lbl, idx) => (
                  <span key={idx}>{lbl}</span>
                ))}
              </div>
            )}
          </div>

          {/* Unified Proportional Segmented Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                width: '100%',
                height: '10px',
                borderRadius: '5px',
                background: 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                overflow: 'hidden',
                gap: '2px',
              }}
            >
              {hasSlept ? (
                <>
                  {deepPct > 0 && <div style={{ width: `${deepPct}%`, height: '100%', background: '#818CF8', borderRadius: '3px' }} />}
                  {remPct > 0 && <div style={{ width: `${remPct}%`, height: '100%', background: '#C084FC', borderRadius: '3px' }} />}
                  {lightPct > 0 && <div style={{ width: `${lightPct}%`, height: '100%', background: '#67E8F9', borderRadius: '3px' }} />}
                  {awakePct > 0 && <div style={{ width: `${awakePct}%`, height: '100%', background: 'rgba(255, 255, 255, 0.4)', borderRadius: '3px' }} />}
                </>
              ) : (
                <>
                  <div style={{ width: '22%', height: '100%', background: 'rgba(129, 140, 248, 0.25)', borderRadius: '3px' }} />
                  <div style={{ width: '22%', height: '100%', background: 'rgba(192, 132, 252, 0.25)', borderRadius: '3px' }} />
                  <div style={{ width: '48%', height: '100%', background: 'rgba(103, 232, 249, 0.25)', borderRadius: '3px' }} />
                  <div style={{ width: '8%', height: '100%', background: 'rgba(255, 255, 255, 0.15)', borderRadius: '3px' }} />
                </>
              )}
            </div>
          </div>

          {/* 4 Clean Stage Tiles (2x2 Grid) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {stages.map((st) => {
              const isSelected = activeStageId === st.id;
              return (
                <div
                  key={st.id}
                  onClick={() => setActiveStageId(isSelected ? null : st.id)}
                  style={{
                    background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                    border: isSelected ? `1px solid ${st.color}` : '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '14px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s ease, background 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: st.color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#FAF7F2' }}>
                        {st.label}
                      </span>
                    </div>
                    <span style={{ fontSize: '9px', color: st.color, fontWeight: 700 }}>
                      {hasSlept ? `${st.pct}%` : '--'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
                      {hasSlept ? fmtDuration(st.minutes) : '--'}
                    </span>
                    <span style={{ fontSize: '9px', color: 'rgba(250, 247, 242, 0.45)' }}>
                      {st.target}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Stage Explanation (Inline & Discreet) */}
          {activeStageId && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${stages.find((s) => s.id === activeStageId)?.color || 'rgba(255,255,255,0.1)'}`,
                animation: 'fadeIn 160ms ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#FAF7F2' }}>
                  {stages.find((s) => s.id === activeStageId)?.label}
                </span>
                <span style={{ fontSize: '9.5px', color: stages.find((s) => s.id === activeStageId)?.color, fontWeight: 700 }}>
                  {stages.find((s) => s.id === activeStageId)?.status}
                </span>
              </div>
              <p style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.75)', lineHeight: 1.4, margin: 0 }}>
                {stages.find((s) => s.id === activeStageId)?.desc}
              </p>
            </div>
          )}
        </div>

        {/* 4. BIOMARQUEURS NOCTURNES (ÉPURÉ, STYLE APPLE HEALTH) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.75)', paddingLeft: '4px' }}>
            {isEn ? 'Nocturnal Biometrics' : 'Biomarqueurs Nocturnes'}
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {/* Creux Cardiaque */}
            <div
              onClick={() => openMetricDetail('bpm')}
              role="button"
              tabIndex={0}
              style={{
                background: '#11121A',
                border: '1px solid rgba(255, 69, 58, 0.18)',
                borderRadius: '16px',
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px',
                transition: 'border-color 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.55)', fontWeight: 600, textTransform: 'uppercase' }}>
                  {isEn ? 'Resting Nadir' : 'Creux Cardiaque'}
                </span>
                <Heart size={13} color="#FF453A" fill="#FF453A" />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                  <span style={{ fontSize: '22px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-display)' }}>
                    {nocturnalBpmVal !== null ? nocturnalBpmVal : '--'}
                  </span>
                  <span style={{ fontSize: '10px', color: '#FF453A', fontWeight: 600 }}>BPM</span>
                </div>
                <span style={{ fontSize: '9px', color: 'rgba(250, 247, 242, 0.45)' }}>
                  {nocturnalBpmVal !== null ? (isEn ? 'Lowest BPM' : 'Minimum au repos') : (isEn ? 'Awaiting night' : 'En attente')}
                </span>
              </div>
            </div>

            {/* VRC Nocturne */}
            <div
              onClick={() => openMetricDetail('hrv')}
              role="button"
              tabIndex={0}
              style={{
                background: '#11121A',
                border: '1px solid rgba(217, 249, 112, 0.18)',
                borderRadius: '16px',
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px',
                transition: 'border-color 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.55)', fontWeight: 600, textTransform: 'uppercase' }}>
                  {isEn ? 'Nightly HRV' : 'VRC Nocturne'}
                </span>
                <Activity size={13} color="#D9F970" />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                  <span style={{ fontSize: '22px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-display)' }}>
                    {nocturnalHrvVal !== null ? nocturnalHrvVal : '--'}
                  </span>
                  <span style={{ fontSize: '10px', color: '#D9F970', fontWeight: 600 }}>ms</span>
                </div>
                <span style={{ fontSize: '9px', color: 'rgba(250, 247, 242, 0.45)' }}>
                  {nocturnalHrvVal !== null ? (isEn ? 'Parasympathetic' : 'Équilibre nerveux') : (isEn ? 'Awaiting night' : 'En attente')}
                </span>
              </div>
            </div>

            {/* Fréquence Respiratoire Nocturne */}
            <div
              onClick={() => openMetricDetail('resp')}
              role="button"
              tabIndex={0}
              style={{
                background: '#11121A',
                border: '1px solid rgba(56, 189, 248, 0.18)',
                borderRadius: '16px',
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px',
                transition: 'border-color 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.55)', fontWeight: 600, textTransform: 'uppercase' }}>
                  {isEn ? 'Respiratory Rate' : 'Fréquence Resp.'}
                </span>
                <Wind size={13} color="#38BDF8" />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                  <span style={{ fontSize: '22px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-display)' }}>
                    {nocturnalRespVal !== null ? nocturnalRespVal : '--'}
                  </span>
                  <span style={{ fontSize: '10px', color: '#38BDF8', fontWeight: 600 }}>RPM</span>
                </div>
                <span style={{ fontSize: '9px', color: 'rgba(250, 247, 242, 0.45)' }}>
                  {nocturnalRespVal !== null ? (isEn ? 'Nocturnal RSA' : 'Ventilation calme') : (isEn ? 'Awaiting night' : 'En attente')}
                </span>
              </div>
            </div>

            {/* SpO2 Nocturne */}
            <div
              onClick={() => openMetricDetail('spo2')}
              role="button"
              tabIndex={0}
              style={{
                background: '#11121A',
                border: '1px solid rgba(232, 121, 249, 0.18)',
                borderRadius: '16px',
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px',
                transition: 'border-color 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.55)', fontWeight: 600, textTransform: 'uppercase' }}>
                  {isEn ? 'Oxygenation' : 'SpO2 Nocturne'}
                </span>
                <Droplets size={13} color="#E879F9" fill="#E879F9" />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                  <span style={{ fontSize: '22px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-display)' }}>
                    {nocturnalSpo2Val !== null ? nocturnalSpo2Val : '--'}
                  </span>
                  <span style={{ fontSize: '10px', color: '#E879F9', fontWeight: 600 }}>%</span>
                </div>
                <span style={{ fontSize: '9px', color: 'rgba(250, 247, 242, 0.45)' }}>
                  {nocturnalSpo2Val !== null ? (isEn ? 'Normal saturation' : 'Oxygénation calme') : (isEn ? 'Awaiting night' : 'En attente')}
                </span>
              </div>
            </div>

            {/* Creux Thermique */}
            <div
              onClick={() => openMetricDetail('temp')}
              role="button"
              tabIndex={0}
              style={{
                gridColumn: 'span 2',
                background: '#11121A',
                border: '1px solid rgba(251, 146, 60, 0.18)',
                borderRadius: '16px',
                padding: '12px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'border-color 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: 'rgba(251, 146, 60, 0.14)',
                    border: '1px solid rgba(251, 146, 60, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Thermometer size={14} color="#FB923C" />
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.55)', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                    {isEn ? 'Nightly Skin Temp' : 'Écart Thermique Cutané'}
                  </span>
                  <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.45)' }}>
                    {nocturnalTempDeltaVal !== null ? (isEn ? 'Circadian dip' : 'Baisse circadienne normale') : (isEn ? 'Awaiting night' : 'En attente')}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                <span style={{ fontSize: '22px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-display)' }}>
                  {nocturnalTempDeltaVal !== null ? nocturnalTempDeltaVal : '--'}
                </span>
                <span style={{ fontSize: '10px', color: '#FB923C', fontWeight: 600 }}>°C</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. SIESTES & RÉCUPÉRATION (DESIGN SOBRE, NOCTURNE AVEC ACCENT AMBRE CHAUD) */}
        <div
          style={{
            background: '#11121A',
            border: '1px solid rgba(245, 158, 11, 0.18)',
            borderRadius: '24px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sun size={13} color="#F59E0B" />
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#FAF7F2' }}>
                {isEn ? 'Naps & Daytime Rest' : 'Siestes & Récupération'}
              </span>
              {naps.length > 0 && (
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#F59E0B',
                  }}
                >
                  {naps.length}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => openModal('nap', 'power')}
              style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '12px',
                padding: '4px 9px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <Plus size={12} color="#F59E0B" />
              <span>{isEn ? 'Log' : 'Ajouter'}</span>
            </button>
          </div>

          {naps.length === 0 ? (
            /* État minimaliste avec les 3 raccourcis */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              <button
                type="button"
                onClick={() => openModal('nap', 'power')}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  padding: '8px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Zap size={11} color="#F59E0B" />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#FAF7F2' }}>Power</span>
                </div>
                <span style={{ fontSize: '9px', color: 'rgba(250, 247, 242, 0.5)' }}>20 min • +6%</span>
              </button>

              <button
                type="button"
                onClick={() => openModal('nap', 'restful')}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  padding: '8px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Sun size={11} color="#F59E0B" />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#FAF7F2' }}>
                    {isEn ? 'Rest' : 'Récup'}
                  </span>
                </div>
                <span style={{ fontSize: '9px', color: 'rgba(250, 247, 242, 0.5)' }}>35 min • +10%</span>
              </button>

              <button
                type="button"
                onClick={() => openModal('nap', 'cycle')}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  padding: '8px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Moon size={11} color="#F59E0B" />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#FAF7F2' }}>Cycle</span>
                </div>
                <span style={{ fontSize: '9px', color: 'rgba(250, 247, 242, 0.5)' }}>90 min • +16%</span>
              </button>
            </div>
          ) : (
            /* Liste épurée des siestes */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {naps.map((nap) => {
                const startStr = fmtClockMin(nap.startMin);
                const endStr = fmtClockMin(nap.endMin);

                return (
                  <div
                    key={nap.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      borderRadius: '14px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
                          {fmtDuration(nap.durationMin)}
                        </span>
                        <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.5)' }}>
                          ({startStr} – {endStr})
                        </span>
                      </div>
                      <span style={{ fontSize: '9.5px', color: '#F59E0B', fontWeight: 600 }}>
                        +{nap.energyBonus}% Body Energy
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteNap(nap.id)}
                      style={{
                        background: 'rgba(255, 59, 48, 0.1)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#FF453A',
                        cursor: 'pointer',
                        padding: '6px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={isEn ? 'Delete' : 'Supprimer'}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 6. CONSEIL CIRCADIEN (ÉPURÉ) */}
        <div
          style={{
            background: '#11121A',
            border: '1px solid rgba(167, 139, 250, 0.16)',
            borderRadius: '20px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <Sparkles size={16} color="#A78BFA" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ fontSize: '11.5px', lineHeight: 1.45, color: 'rgba(250, 247, 242, 0.8)', margin: 0 }}>
            {!hasSlept
              ? (isEn
                  ? 'Wear your Stoic Ring tonight to analyze your sleep architecture, resting nadir and circadian recovery.'
                  : 'Portez votre bague Stoïk cette nuit pour mesurer votre architecture de sommeil, vos creux cardiaques et votre récupération.')
              : (isEn
                  ? `Night session measured with ${deepPct}% deep sleep and ${remPct}% REM sleep (${efficiency}% efficiency). Aim for a consistent bedtime to stabilize circadian rhythm.`
                  : `Nuit mesurée avec ${deepPct}% de sommeil profond et ${remPct}% de paradoxal (${efficiency}% d'efficacité). Gardez une heure de coucher régulière pour ancrer votre rythme biologique.`)}
          </p>
        </div>
      </div>
    </div>
  );
};
