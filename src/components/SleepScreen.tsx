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
  Sun,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

export const SleepScreen: React.FC = () => {
  const { selectedDay, language, openMetricDetail, weekData, isFirstLaunch, addManualNap, deleteNap } = useApp();
  const dayData = (weekData && weekData[selectedDay]) || (isFirstLaunch ? emptyDayMetrics : (weekMetrics[selectedDay] || weekMetrics[TODAY_INDEX]));
  const sleep = dayData.sleep;
  const naps = dayData.naps || [];
  const totalNapMin = naps.reduce((sum, n) => sum + n.durationMin, 0);

  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [hoverBlockIndex, setHoverBlockIndex] = useState<number | null>(null);
  const [isAddNapModalOpen, setIsAddNapModalOpen] = useState<boolean>(false);
  const [napStartStr, setNapStartStr] = useState<string>('14:00');
  const [napEndStr, setNapEndStr] = useState<string>('14:35');

  const isEn = language === 'en';

  const totalMin = sleep.deepMin + sleep.remMin + sleep.lightMin + sleep.awakeMin;
  const effectiveMin = Math.max(0, totalMin - sleep.awakeMin);

  const deepPct = totalMin > 0 ? Math.round((sleep.deepMin / totalMin) * 100) : 0;
  const remPct = totalMin > 0 ? Math.round((sleep.remMin / totalMin) * 100) : 0;
  const lightPct = totalMin > 0 ? Math.round((sleep.lightMin / totalMin) * 100) : 0;
  const awakePct = totalMin > 0 ? Math.max(1, 100 - (deepPct + remPct + lightPct)) : 0;

  const efficiency = totalMin > 0 ? Math.round((effectiveMin / totalMin) * 100) : 0;
  const isZeroState = totalMin === 0 || (isFirstLaunch && dayData.score === 0);

  const fmtClockMin = (min?: number) => {
    if (min === undefined || min === null || isNaN(min)) return '--:--';
    const norm = ((Math.round(min) % 1440) + 1440) % 1440;
    const h = Math.floor(norm / 60);
    const m = norm % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const bedtimeStr = !isZeroState && sleep.startMin !== undefined ? fmtClockMin(sleep.startMin) : '--:--';
  const wakeStr = !isZeroState && sleep.endMin !== undefined ? fmtClockMin(sleep.endMin) : '--:--';
  const cycleCount = totalMin > 0 ? Math.max(1, Math.round(totalMin / 90)) : 0;

  const hypnogramTimeLabels = (() => {
    if (isZeroState || sleep.startMin === undefined || sleep.endMin === undefined) {
      return ['--:--', '--:--', '--:--', '--:--', '--:--'];
    }
    const s = sleep.startMin > sleep.endMin ? sleep.startMin - 1440 : sleep.startMin;
    const e = sleep.endMin;
    return [0, 0.25, 0.5, 0.75, 1].map((t) => fmtClockMin(s + (e - s) * t));
  })();

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
              {bedtimeStr}
            </span>
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)', display: 'block' }}>
              {isEn ? 'Wake' : 'Réveil'}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
              {wakeStr}
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
              {isEn ? 'Awake' : 'Éveil'}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
              {isZeroState ? '--' : `${sleep.awakeMin} min`}
            </span>
          </div>
        </div>
      </div>

      {/* 3. SIESTES & RÉCUPÉRATION DIURNE (NAPS) */}
      {naps.length > 0 ? (
        <div
          style={{
            background: 'radial-gradient(ellipse at top left, rgba(251, 146, 60, 0.14) 0%, rgba(18, 18, 22, 0.88) 70%), #0D0D12',
            border: '1px solid rgba(251, 146, 60, 0.32)',
            borderRadius: '24px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 16px rgba(251, 146, 60, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'rgba(251, 146, 60, 0.22)',
                  border: '1px solid rgba(251, 146, 60, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sun size={13} color="#FB923C" />
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#FAF7F2' }}>
                {isEn ? 'Restful Naps' : 'Siestes & Récupération'}
              </span>
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '12px',
                  background: 'rgba(251, 146, 60, 0.2)',
                  color: '#FB923C',
                  border: '1px solid rgba(251, 146, 60, 0.35)',
                }}
              >
                {naps.length} {naps.length > 1 ? (isEn ? 'naps' : 'siestes') : (isEn ? 'sieste' : 'sieste')}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsAddNapModalOpen(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '14px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#FAF7F2',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <Plus size={12} color="#FAF7F2" />
              <span>{isEn ? 'Add' : 'Ajouter'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {naps.map((nap) => {
              const startStr = fmtClockMin(nap.startMin);
              const endStr = fmtClockMin(nap.endMin);
              return (
                <div
                  key={nap.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#FAF7F2' }}>
                        {fmtDuration(nap.durationMin)}
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'rgba(250, 247, 242, 0.65)' }}>
                        ({startStr} – {endStr})
                      </span>
                      <span
                        style={{
                          fontSize: '9px',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          background: nap.source === 'ring' ? 'rgba(48, 209, 88, 0.18)' : 'rgba(255, 255, 255, 0.1)',
                          color: nap.source === 'ring' ? '#30D158' : '#8E8E93',
                          fontWeight: 700,
                        }}
                      >
                        {nap.source === 'ring' ? (isEn ? 'Ring' : 'Bague') : (isEn ? 'Manual' : 'Manuel')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '11px', color: 'rgba(250, 247, 242, 0.7)' }}>
                      <span>{isEn ? 'Deep:' : 'Profond:'} <strong style={{ color: '#818CF8' }}>{nap.deepMin}m</strong></span>
                      <span>•</span>
                      <span>{isEn ? 'Light:' : 'Léger:'} <strong style={{ color: '#67E8F9' }}>{nap.lightMin}m</strong></span>
                      <span>•</span>
                      <span style={{ color: '#FB923C', fontWeight: 700 }}>+{nap.energyBonus}% Energy</span>
                    </div>
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
                    title={isEn ? 'Delete this nap' : 'Supprimer cette sieste'}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          style={{
            background: 'rgba(18, 18, 22, 0.6)',
            border: '1px dashed rgba(251, 146, 60, 0.28)',
            borderRadius: '20px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'background 150ms ease',
          }}
          onClick={() => setIsAddNapModalOpen(true)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'rgba(251, 146, 60, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sun size={13} color="#FB923C" />
            </span>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#FAF7F2', display: 'block' }}>
                {isEn ? 'Log a Restful Nap' : 'Ajouter une sieste réparatrice'}
              </span>
              <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.55)' }}>
                {isEn ? '20-30 min nap recharges your Body Energy' : 'Une pause de 20-30 min recharge votre Body Energy'}
              </span>
            </div>
          </div>
          <Plus size={15} color="#FB923C" />
        </div>
      )}

      {/* 4. INTERACTIVE HYPNOGRAM TIMELINE (LE TRACÉ DES CYCLES DE NUIT) */}
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
            {isZeroState ? (isEn ? '0 Cycle' : '0 Cycle') : `${cycleCount} ${isEn ? 'Cycles' : 'Cycles'}`}
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
              {hypnogramTimeLabels.map((lbl, idx) => (
                <span key={idx}>{lbl}</span>
              ))}
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
                  : (isEn ? 'Lowest recorded BPM' : 'Minimum mesuré')}
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
                ? `Night session recorded (${bedtimeStr} – ${wakeStr}) with ${deepPct}% deep sleep and ${remPct}% REM sleep (${efficiency}% efficiency).`
                : `Session nocturne mesurée par la bague (${bedtimeStr} – ${wakeStr}) avec ${deepPct}% de sommeil profond et ${remPct}% de sommeil paradoxal (${efficiency}% d'efficacité).`)}
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

      {/* MODAL AJOUTER UNE SIESTE MANUELLE */}
      {isAddNapModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setIsAddNapModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 1200,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '430px',
              background: '#14141A',
              borderTop: '1px solid rgba(251, 146, 60, 0.4)',
              borderRadius: '28px 28px 0 0',
              padding: '22px 20px 36px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sun size={18} color="#FB923C" />
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#FAF7F2' }}>
                  {isEn ? 'Log a Restful Nap' : 'Enregistrer une sieste'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddNapModalOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FAF7F2',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'rgba(250, 247, 242, 0.65)', margin: 0, lineHeight: 1.4 }}>
              {isEn
                ? 'Indicate when you rested. This will calibrate your daytime recovery and boost your Body Energy score.'
                : 'Indiquez votre créneau de repos. La sieste sera intégrée à votre score de récupération et rechargera votre Body Energy.'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#8E8E93', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  {isEn ? 'Start Time' : 'Début'}
                </label>
                <input
                  type="time"
                  value={napStartStr}
                  onChange={(e) => setNapStartStr(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    color: '#FFF',
                    fontSize: '16px',
                    fontWeight: 700,
                    padding: '10px',
                    outline: 'none',
                    textAlign: 'center',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#8E8E93', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  {isEn ? 'End Time' : 'Fin'}
                </label>
                <input
                  type="time"
                  value={napEndStr}
                  onChange={(e) => setNapEndStr(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    color: '#FFF',
                    fontSize: '16px',
                    fontWeight: 700,
                    padding: '10px',
                    outline: 'none',
                    textAlign: 'center',
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const [sH, sM] = napStartStr.split(':').map((v) => parseInt(v, 10));
                const [eH, eM] = napEndStr.split(':').map((v) => parseInt(v, 10));
                const startMin = (isNaN(sH) ? 14 : sH) * 60 + (isNaN(sM) ? 0 : sM);
                const endMin = (isNaN(eH) ? 14 : eH) * 60 + (isNaN(eM) ? 35 : eM);
                addManualNap({ startMin, endMin });
                setIsAddNapModalOpen(false);
              }}
              style={{
                width: '100%',
                height: '46px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #FB923C 0%, #EA580C 100%)',
                border: 'none',
                color: '#FFF',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(251, 146, 60, 0.4)',
                marginTop: '6px',
              }}
            >
              <Sun size={16} color="#FFF" />
              <span>{isEn ? 'Save Restful Nap' : 'Enregistrer la sieste'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
