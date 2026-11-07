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
  Layers,
  Check,
  Flame,
} from 'lucide-react';

export const SleepScreen: React.FC = () => {
  const { selectedDay, language, openMetricDetail, weekData, isFirstLaunch, addManualNap, deleteNap } = useApp();
  const dayData = (weekData && weekData[selectedDay]) || (isFirstLaunch ? emptyDayMetrics : (weekMetrics[selectedDay] || weekMetrics[TODAY_INDEX]));
  const sleep = dayData.sleep;
  const naps = dayData.naps || [];
  const totalNapMin = naps.reduce((sum, n) => sum + n.durationMin, 0);

  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [hoverBlockIndex, setHoverBlockIndex] = useState<number | null>(null);
  const [showClinicalRatioModal, setShowClinicalRatioModal] = useState<boolean>(false);

  // Modal Sieste Avancée
  const [isAddNapModalOpen, setIsAddNapModalOpen] = useState<boolean>(false);
  const [napPreset, setNapPreset] = useState<'power' | 'restful' | 'cycle' | 'custom'>('power');
  const [napDurationMin, setNapDurationMin] = useState<number>(20);
  const [napTimingMode, setNapTimingMode] = useState<'now' | '30m_ago' | '1h_ago' | 'custom'>('now');
  const [customStartStr, setCustomStartStr] = useState<string>('14:00');
  const [customEndStr, setCustomEndStr] = useState<string>('14:35');

  const isEn = language === 'en';

  const totalMin = (sleep.deepMin || 0) + (sleep.remMin || 0) + (sleep.lightMin || 0) + (sleep.awakeMin || 0);
  const effectiveMin = Math.max(0, totalMin - (sleep.awakeMin || 0));

  // Vrai enregistrement nocturne : il faut qu'au moins 45 minutes de sommeil et un score soient enregistrés
  const hasSlept = !isFirstLaunch && totalMin >= 45 && (sleep.score || 0) > 0;
  const isZeroState = !hasSlept;

  const deepPct = hasSlept && totalMin > 0 ? Math.round((sleep.deepMin / totalMin) * 100) : 0;
  const remPct = hasSlept && totalMin > 0 ? Math.round((sleep.remMin / totalMin) * 100) : 0;
  const lightPct = hasSlept && totalMin > 0 ? Math.round((sleep.lightMin / totalMin) * 100) : 0;
  const awakePct = hasSlept && totalMin > 0 ? Math.max(1, 100 - (deepPct + remPct + lightPct)) : 0;

  const efficiency = hasSlept && totalMin > 0 ? Math.round((effectiveMin / totalMin) * 100) : 0;

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

  const hypnogramTimeLabels = (() => {
    if (!hasSlept || sleep.startMin === undefined || sleep.endMin === undefined) {
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
      target: '20 – 25%',
      targetRange: [20, 25],
      minutes: sleep.deepMin,
      pct: deepPct,
      color: '#818CF8',
      tag: isEn ? 'Physical Repair' : 'Régénération physique',
      desc: isEn
        ? 'Physical repair, muscle growth, cellular rejuvenation, and human growth hormone (HGH) release. Essential for physiological restoration.'
        : 'Réparation physique, régénération musculaire et sécrétion d’hormone de croissance. C’est la phase la plus réparatrice pour le corps.',
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
      tag: isEn ? 'Cognitive & Memory' : 'Mémoire & Plasticité',
      desc: isEn
        ? 'Memory consolidation, creative synthesis, cognitive processing, and dream states. Crucial for mental sharpness and emotional resilience.'
        : 'Consolidation de la mémoire, créativité, régulation des émotions et rêves. Fondamental pour la clarté mentale et l’apprentissage.',
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
      tag: isEn ? 'Nervous Transition' : 'Détente & Transition',
      desc: isEn
        ? 'Neuromuscular transition and core body temperature reduction. Stabilizes sleep cycles and allows gentle autonomic nervous recovery.'
        : 'Transition neuromusculaire et détente du système nerveux. Stabilise l’architecture du sommeil et abaisse le rythme cardiaque.',
      status: !hasSlept ? (isEn ? 'Pending' : 'En attente') : (isEn ? 'Balanced' : 'Équilibré'),
    },
    {
      id: 'awake',
      label: isEn ? 'Awake & Micro-arousals' : 'Éveil & Micro-réveils',
      target: '< 10%',
      targetRange: [0, 10],
      minutes: sleep.awakeMin,
      pct: awakePct,
      color: 'rgba(255, 255, 255, 0.45)',
      tag: isEn ? 'Cycle Switches' : 'Micro-transitions',
      desc: isEn
        ? 'Natural and imperceptible micro-arousals occurring during ultradian cycle transitions. Normal when under 10% of total sleep time.'
        : 'Micro-éveils physiologiques imperceptibles lors des transitions de cycle de 90 min. Tout à fait normal tant qu’il reste sous les 10%.',
      status: !hasSlept ? (isEn ? 'Pending' : 'En attente') : (awakePct <= 10 ? (isEn ? 'Calm' : 'Calme') : (isEn ? 'Restless' : 'Agité')),
    },
  ];

  // Hypnogramme uniquement calculé si du sommeil nocturne réel existe
  const hypnogram = hasSlept ? buildHypnogram(sleep) : [];

  // Biomarqueurs strictement nocturnes : n'afficher AUCUNE fausse valeur diurne si la nuit n'est pas encore enregistrée !
  const nocturnalBpmVal = hasSlept && dayData.minBpm && dayData.minBpm >= 40 ? dayData.minBpm : (hasSlept && dayData.restingBpm ? dayData.restingBpm : null);
  const nocturnalHrvVal = hasSlept && dayData.hrv && dayData.hrv > 0 ? dayData.hrv : null;
  const nocturnalSpo2Val = hasSlept && dayData.spo2 && dayData.spo2 >= 70 ? Math.round(dayData.spo2) : null;
  const nocturnalTempDeltaVal = hasSlept && dayData.tempDelta !== undefined && dayData.tempDelta !== 0
    ? (dayData.tempDelta > 0 ? `+${dayData.tempDelta}` : `${dayData.tempDelta}`)
    : (hasSlept && dayData.skinTemp ? `${(dayData.skinTemp - 36.5).toFixed(1)}` : null);

  // Helper pour ouvrir le modal sieste avec un preset direct
  const openNapWithPreset = (preset: 'power' | 'restful' | 'cycle') => {
    setNapPreset(preset);
    if (preset === 'power') setNapDurationMin(20);
    else if (preset === 'restful') setNapDurationMin(35);
    else if (preset === 'cycle') setNapDurationMin(90);
    setNapTimingMode('now');
    setIsAddNapModalOpen(true);
  };

  // Helper pour enregistrer la sieste
  const handleSaveNap = () => {
    let startMin = 840; // 14:00
    let endMin = 875;   // 14:35
    const now = new Date();
    const curNowMin = now.getHours() * 60 + now.getMinutes();

    if (napTimingMode === 'now') {
      endMin = curNowMin;
      startMin = ((endMin - napDurationMin) % 1440 + 1440) % 1440;
    } else if (napTimingMode === '30m_ago') {
      endMin = ((curNowMin - 30) % 1440 + 1440) % 1440;
      startMin = ((endMin - napDurationMin) % 1440 + 1440) % 1440;
    } else if (napTimingMode === '1h_ago') {
      endMin = ((curNowMin - 60) % 1440 + 1440) % 1440;
      startMin = ((endMin - napDurationMin) % 1440 + 1440) % 1440;
    } else {
      const [sH, sM] = customStartStr.split(':').map((v) => parseInt(v, 10));
      const [eH, eM] = customEndStr.split(':').map((v) => parseInt(v, 10));
      startMin = (isNaN(sH) ? 14 : sH) * 60 + (isNaN(sM) ? 0 : sM);
      endMin = (isNaN(eH) ? 14 : eH) * 60 + (isNaN(eM) ? 35 : eM);
    }

    addManualNap({
      startMin,
      endMin,
      napType: napPreset,
      deepMin: napPreset === 'power' ? 0 : (napPreset === 'restful' ? Math.round(napDurationMin * 0.3) : Math.round(napDurationMin * 0.25)),
      lightMin: napPreset === 'power' ? napDurationMin : (napPreset === 'restful' ? Math.round(napDurationMin * 0.7) : Math.round(napDurationMin * 0.55)),
      remMin: napPreset === 'cycle' ? Math.round(napDurationMin * 0.2) : 0,
    });
    setIsAddNapModalOpen(false);
  };

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
            {!hasSlept
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
                {!hasSlept ? '--' : sleep.score}
              </span>
              {hasSlept && (
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
              {!hasSlept ? '--' : fmtDuration(effectiveMin)}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'rgba(250, 247, 242, 0.65)',
                marginTop: '4px',
                display: 'block',
              }}
            >
              {hasSlept && totalMin > 0
                ? `${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, '0')} ${isEn ? 'in bed' : 'au lit'}`
                : (isEn ? 'No night recorded' : 'Aucune nuit enregistrée')}
            </span>
          </div>
        </div>

        {/* Circadian Schedule Pill Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            paddingTop: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {isEn ? 'Bedtime' : 'Coucher'}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
              {bedtimeStr}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
            <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {isEn ? 'Wake-Up' : 'Réveil'}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
              {wakeStr}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
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
            {!hasSlept ? (isEn ? '0 Cycle' : '0 Cycle') : `${cycleCount} ${isEn ? 'Cycles' : 'Cycles'}`}
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
                  fontWeight="600"
                  fontFamily="var(--font-mono)"
                >
                  {lvl.label}
                </text>
              </g>
            ))}

            {/* Hypnogram Blocks rendering */}
            {hasSlept && hypnogram.map((block, idx) => {
              const xStart = 48 + (block.startMin / totalMin) * (315 - 48);
              const blockWidth = Math.max(2, (block.durationMin / totalMin) * (315 - 48));
              const yMap: Record<string, { y: number; h: number; color: string }> = {
                awake: { y: 11, h: 8, color: 'rgba(255,255,255,0.45)' },
                rem: { y: 34, h: 8, color: '#C084FC' },
                light: { y: 56, h: 8, color: '#67E8F9' },
                deep: { y: 78, h: 8, color: '#818CF8' },
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
                  rx="3"
                  fill={meta.color}
                  style={{
                    opacity: hoverBlockIndex === null ? 0.9 : isHovered ? 1 : 0.4,
                    filter:
                      isHovered || block.stage === 'deep' || block.stage === 'rem'
                        ? `drop-shadow(0 0 6px ${meta.color})`
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

      {/* 4. ARCHITECTURE & RÉPARTITION DES 4 PHASES (REFONTE CLINIQUE COMPLETE) */}
      <div
        style={{
          background: 'rgba(18, 18, 22, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          borderRadius: '24px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'rgba(129, 140, 248, 0.15)',
                border: '1px solid rgba(129, 140, 248, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={13} color="#818CF8" />
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#FAF7F2' }}>
              {isEn ? 'Sleep Stages Architecture' : 'Architecture des 4 Phases'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowClinicalRatioModal(!showClinicalRatioModal)}
            style={{
              background: 'rgba(167, 139, 250, 0.12)',
              border: '1px solid rgba(167, 139, 250, 0.35)',
              borderRadius: '12px',
              padding: '3px 8px',
              color: '#A78BFA',
              fontSize: '10.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Info size={11} />
            <span>{isEn ? 'Clinical Ratio' : 'Ratio clinique'}</span>
          </button>
        </div>

        {/* Clinical Ratio Info Panel (Toggleable) */}
        {showClinicalRatioModal && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '14px',
              background: 'rgba(167, 139, 250, 0.08)',
              border: '1px solid rgba(167, 139, 250, 0.25)',
              fontSize: '11px',
              color: 'rgba(250, 247, 242, 0.8)',
              lineHeight: 1.45,
            }}
          >
            <strong style={{ color: '#A78BFA' }}>{isEn ? 'Standard Biological Architecture:' : 'Architecture biologique optimale :'}</strong>{' '}
            {isEn
              ? 'Deep (20-25%) for muscle recovery, REM (20-25%) for memory consolidation, Light (45-55%) for neural transition, Awake (<10%) for micro-arousals.'
              : 'Profond (20-25%) pour la régénération musculaire, Paradoxal (20-25%) pour la mémoire et la créativité, Léger (45-55%) pour la détente, Éveil (<10%) pour les micro-transitions.'}
          </div>
        )}

        {/* Visual Progress Architecture Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div
            style={{
              width: '100%',
              height: '14px',
              borderRadius: '7px',
              background: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              overflow: 'hidden',
              gap: '2px',
              padding: '2px',
            }}
          >
            {hasSlept ? (
              <>
                {deepPct > 0 && (
                  <div
                    style={{
                      width: `${deepPct}%`,
                      height: '100%',
                      background: '#818CF8',
                      borderRadius: '5px',
                      boxShadow: '0 0 8px #818CF8',
                      transition: 'width 0.4s ease',
                    }}
                    title={`Sommeil Profond: ${deepPct}%`}
                  />
                )}
                {remPct > 0 && (
                  <div
                    style={{
                      width: `${remPct}%`,
                      height: '100%',
                      background: '#C084FC',
                      borderRadius: '5px',
                      boxShadow: '0 0 8px #C084FC',
                      transition: 'width 0.4s ease',
                    }}
                    title={`Sommeil Paradoxal: ${remPct}%`}
                  />
                )}
                {lightPct > 0 && (
                  <div
                    style={{
                      width: `${lightPct}%`,
                      height: '100%',
                      background: '#67E8F9',
                      borderRadius: '5px',
                      boxShadow: '0 0 8px #67E8F9',
                      transition: 'width 0.4s ease',
                    }}
                    title={`Sommeil Léger: ${lightPct}%`}
                  />
                )}
                {awakePct > 0 && (
                  <div
                    style={{
                      width: `${awakePct}%`,
                      height: '100%',
                      background: 'rgba(255, 255, 255, 0.45)',
                      borderRadius: '5px',
                      transition: 'width 0.4s ease',
                    }}
                    title={`Éveil: ${awakePct}%`}
                  />
                )}
              </>
            ) : (
              // Guide cible translucent quand aucune nuit n'est encore enregistrée
              <>
                <div style={{ width: '22%', height: '100%', background: 'rgba(129, 140, 248, 0.25)', borderRadius: '5px' }} />
                <div style={{ width: '22%', height: '100%', background: 'rgba(192, 132, 252, 0.25)', borderRadius: '5px' }} />
                <div style={{ width: '48%', height: '100%', background: 'rgba(103, 232, 249, 0.25)', borderRadius: '5px' }} />
                <div style={{ width: '8%', height: '100%', background: 'rgba(255, 255, 255, 0.15)', borderRadius: '5px' }} />
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(250, 247, 242, 0.55)' }}>
            <span>
              {hasSlept
                ? `${isEn ? 'Restorative Sleep (Deep + REM):' : 'Sommeil réparateur (Profond + REM) :'} ${deepPct + remPct}%`
                : (isEn ? 'Waiting for first sleep cycle tonight' : 'En attente du premier cycle nocturne')}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {hasSlept ? `${isEn ? 'Target:' : 'Cible :'} 40–50%` : (isEn ? 'Reference targets ready' : 'Cibles cliniques prêtes')}
            </span>
          </div>
        </div>

        {/* 4 Cards Grid Layout (2x2 Clean, No Squishing!) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {stages.map((st) => {
            const isSelected = activeStageId === st.id;
            return (
              <div
                key={st.id}
                onClick={() => setActiveStageId(isSelected ? null : st.id)}
                style={{
                  background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.035)',
                  border: isSelected ? `1px solid ${st.color}` : '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '16px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? `0 0 16px ${st.color}33` : 'none',
                }}
              >
                {/* Header: Dot + Label + Target Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: st.color,
                        boxShadow: `0 0 8px ${st.color}`,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#FAF7F2' }}>
                      {st.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '9px',
                      color: st.color,
                      fontWeight: 600,
                      background: `${st.color}15`,
                      padding: '1.5px 5px',
                      borderRadius: '6px',
                    }}
                  >
                    {st.target}
                  </span>
                </div>

                {/* Duration & Pct Row */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
                    {hasSlept ? fmtDuration(st.minutes) : '--'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: hasSlept ? st.color : 'rgba(250, 247, 242, 0.4)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {hasSlept ? `${st.pct}%` : '--'}
                    </span>
                    <span
                      style={{
                        fontSize: '8.5px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: hasSlept && (st.status === 'Optimal' || st.status === 'Idéal' || st.status === 'Calme') ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                        color: hasSlept && (st.status === 'Optimal' || st.status === 'Idéal' || st.status === 'Calme') ? '#30D158' : 'rgba(250, 247, 242, 0.6)',
                      }}
                    >
                      {st.status}
                    </span>
                  </div>
                </div>

                {/* Role Caption */}
                <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)', lineHeight: 1.3 }}>
                  {st.tag}
                </span>
              </div>
            );
          })}
        </div>

        {/* Selected Stage Detail Description Box */}
        {activeStageId && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${stages.find((s) => s.id === activeStageId)?.color || 'rgba(255,255,255,0.1)'}`,
              animation: 'fadeIn 180ms ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#FAF7F2' }}>
                {stages.find((s) => s.id === activeStageId)?.label}
              </span>
              <span style={{ fontSize: '10px', color: stages.find((s) => s.id === activeStageId)?.color, fontWeight: 700 }}>
                {isEn ? 'Target:' : 'Cible physiologique :'} {stages.find((s) => s.id === activeStageId)?.target}
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.75)', lineHeight: 1.45, margin: 0 }}>
              {stages.find((s) => s.id === activeStageId)?.desc}
            </p>
          </div>
        )}
      </div>

      {/* 5. NOCTURNAL BIOMARKERS DURING SLEEP (ZÉRO VALEUR FANTÔME QUAND PAS ENCORE ENDORMI) */}
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
                  {nocturnalBpmVal !== null ? nocturnalBpmVal : '--'}
                </span>
                <span style={{ fontSize: '11px', color: '#FF453A', fontWeight: 600 }}>BPM</span>
              </div>
              <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)' }}>
                {nocturnalBpmVal !== null
                  ? (isEn ? 'Lowest recorded BPM' : 'Minimum mesuré')
                  : (isEn ? 'Awaiting night sleep' : 'En attente de nuit')}
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
                  {nocturnalHrvVal !== null ? nocturnalHrvVal : '--'}
                </span>
                <span style={{ fontSize: '11px', color: '#D9F970', fontWeight: 600 }}>ms</span>
              </div>
              <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)' }}>
                {nocturnalHrvVal !== null
                  ? (isEn ? 'Parasympathetic high' : 'Récupération nerveuse')
                  : (isEn ? 'Awaiting night sleep' : 'En attente de nuit')}
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
                  {nocturnalSpo2Val !== null ? nocturnalSpo2Val : '--'}
                </span>
                <span style={{ fontSize: '11px', color: '#E879F9', fontWeight: 600 }}>%</span>
              </div>
              <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)' }}>
                {nocturnalSpo2Val !== null
                  ? (isEn ? '0 apnea events' : '0 apnée détectée')
                  : (isEn ? 'Awaiting night sleep' : 'En attente de nuit')}
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
                  {nocturnalTempDeltaVal !== null ? nocturnalTempDeltaVal : '--'}
                </span>
                <span style={{ fontSize: '11px', color: '#FB923C', fontWeight: 600 }}>°C</span>
              </div>
              <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.55)' }}>
                {nocturnalTempDeltaVal !== null
                  ? (isEn ? 'Optimal circadian drop' : 'Baisse circadienne saine')
                  : (isEn ? 'Awaiting night sleep' : 'En attente de nuit')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. SIESTES & RÉCUPÉRATION DIURNE (POSITION NATURELLE APRES LA NUIT) */}
      <div
        style={{
          background: 'radial-gradient(ellipse at top left, rgba(251, 146, 60, 0.14) 0%, rgba(18, 18, 22, 0.9) 70%), #0D0D12',
          border: '1px solid rgba(251, 146, 60, 0.32)',
          borderRadius: '24px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(251, 146, 60, 0.08)',
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
                border: '1px solid rgba(251, 146, 60, 0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sun size={14} color="#FB923C" />
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#FAF7F2' }}>
              {isEn ? 'Restful Naps & Daytime Recovery' : 'Siestes & Récupération Diurne'}
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
            onClick={() => {
              setNapPreset('power');
              setNapDurationMin(20);
              setNapTimingMode('now');
              setIsAddNapModalOpen(true);
            }}
            style={{
              background: 'rgba(251, 146, 60, 0.16)',
              border: '1px solid rgba(251, 146, 60, 0.4)',
              borderRadius: '14px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#FB923C',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
            }}
          >
            <Plus size={12} color="#FB923C" />
            <span>{isEn ? 'Log Nap' : 'Ajouter'}</span>
          </button>
        </div>

        {naps.length === 0 ? (
          /* Empty State avec les 3 Presets Directs 1-Tap */
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px dashed rgba(251, 146, 60, 0.25)',
              borderRadius: '18px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#FAF7F2', display: 'block', marginBottom: '2px' }}>
                {isEn ? 'Recharge your Body Energy with a Nap' : 'Rechargez votre Body Energy'}
              </span>
              <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.65)', lineHeight: 1.4 }}>
                {isEn
                  ? 'A 20-30 min nap clears adenosine, reduces cortisol and sharpens focus without disrupting night sleep.'
                  : 'Une sieste de 20 à 30 min réduit le cortisol, élimine la fatigue et restaure vos réflexes sans perturber votre nuit.'}
              </span>
            </div>

            {/* 3 Quick 1-Tap Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button
                type="button"
                onClick={() => openNapWithPreset('power')}
                style={{
                  background: 'rgba(251, 146, 60, 0.1)',
                  border: '1px solid rgba(251, 146, 60, 0.3)',
                  borderRadius: '12px',
                  padding: '8px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Zap size={12} color="#FB923C" />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#FAF7F2' }}>Power Nap</span>
                </div>
                <span style={{ fontSize: '9.5px', color: '#FB923C', fontWeight: 600 }}>20 min • +6%</span>
              </button>

              <button
                type="button"
                onClick={() => openNapWithPreset('restful')}
                style={{
                  background: 'rgba(251, 146, 60, 0.1)',
                  border: '1px solid rgba(251, 146, 60, 0.3)',
                  borderRadius: '12px',
                  padding: '8px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Sun size={12} color="#FB923C" />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#FAF7F2' }}>Récup</span>
                </div>
                <span style={{ fontSize: '9.5px', color: '#FB923C', fontWeight: 600 }}>35 min • +10%</span>
              </button>

              <button
                type="button"
                onClick={() => openNapWithPreset('cycle')}
                style={{
                  background: 'rgba(251, 146, 60, 0.1)',
                  border: '1px solid rgba(251, 146, 60, 0.3)',
                  borderRadius: '12px',
                  padding: '8px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Moon size={12} color="#FB923C" />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#FAF7F2' }}>Cycle 90m</span>
                </div>
                <span style={{ fontSize: '9.5px', color: '#FB923C', fontWeight: 600 }}>Complet • +16%</span>
              </button>
            </div>
          </div>
        ) : (
          /* Liste des Siestes Enregistrées */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {naps.map((nap) => {
              const startStr = fmtClockMin(nap.startMin);
              const endStr = fmtClockMin(nap.endMin);
              const isPower = nap.napType === 'power' || nap.durationMin <= 25;
              const isCycle = nap.napType === 'cycle' || nap.durationMin >= 80;

              return (
                <div
                  key={nap.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.09)',
                    borderRadius: '18px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '8px',
                          background: isPower ? 'rgba(251, 146, 60, 0.2)' : isCycle ? 'rgba(167, 139, 250, 0.2)' : 'rgba(48, 209, 88, 0.18)',
                          color: isPower ? '#FB923C' : isCycle ? '#A78BFA' : '#30D158',
                        }}
                      >
                        {isPower ? '⚡ Power Nap' : isCycle ? '🧬 Cycle Complet' : '🌿 Sieste Réparatrice'}
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'rgba(250, 247, 242, 0.65)' }}>
                        ({startStr} – {endStr})
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                        {nap.source === 'ring' ? (isEn ? 'Stoic Ring' : 'Bague Stoic') : (isEn ? 'Manual' : 'Manuel')}
                      </span>

                      <button
                        type="button"
                        onClick={() => deleteNap(nap.id)}
                        style={{
                          background: 'rgba(255, 59, 48, 0.12)',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#FF453A',
                          cursor: 'pointer',
                          padding: '5px 7px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title={isEn ? 'Delete this nap' : 'Supprimer cette sieste'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Main Metric Row: Duration & Energy Bonus */}
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '22px', fontWeight: 800, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
                        {fmtDuration(nap.durationMin)}
                      </span>
                      <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)' }}>{isEn ? 'rest duration' : 'de repos'}</span>
                    </div>

                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#FB923C',
                        background: 'rgba(251, 146, 60, 0.16)',
                        padding: '3px 8px',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Zap size={11} fill="#FB923C" />
                      +{nap.energyBonus}% Energy
                    </span>
                  </div>

                  {/* Stage Distribution Breakdown */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.7)' }}>
                    <span>{isEn ? 'Deep:' : 'Profond :'} <strong style={{ color: '#818CF8' }}>{nap.deepMin}m</strong></span>
                    <span>•</span>
                    <span>{isEn ? 'Light:' : 'Léger :'} <strong style={{ color: '#67E8F9' }}>{nap.lightMin}m</strong></span>
                    {nap.remMin !== undefined && nap.remMin > 0 && (
                      <>
                        <span>•</span>
                        <span>{isEn ? 'REM:' : 'Paradoxal :'} <strong style={{ color: '#C084FC' }}>{nap.remMin}m</strong></span>
                      </>
                    )}
                    <span style={{ marginLeft: 'auto', color: 'rgba(250, 247, 242, 0.5)', fontSize: '9.5px' }}>
                      {nap.durationMin <= 25 ? (isEn ? 'Zero sleep inertia' : 'Zéro inertie de sommeil') : (isEn ? 'Deep restoration' : 'Récupération profonde')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. SLEEP COACH & CHRONOTYPE INSIGHTS */}
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
          {!hasSlept
            ? (isEn
                ? 'No sleep session recorded yet. Wear your Stoic Ring One tonight to analyze your sleep architecture, resting nadir and circadian rhythm.'
                : 'Aucune session de sommeil enregistrée pour le moment. Portez votre bague Stoic Ring One cette nuit pour analyser votre architecture de sommeil, vos creux cardiaques et votre rythme circadien.')
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
            <ShieldCheck size={14} color={!hasSlept ? '#A78BFA' : '#30D158'} style={{ marginTop: '2px', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.8)', lineHeight: 1.4 }}>
              <strong>{isEn ? 'Regularity' : 'Régularité'} :</strong>{' '}
              {!hasSlept
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
              {!hasSlept
                ? (isEn ? 'Wear your ring snugly on your finger before going to sleep to activate continuous optical tracking.' : 'Gardez votre bague ajustée au doigt avant de vous coucher pour activer le suivi continu.')
                : (isEn
                    ? 'Dim overhead lights 45 min before sleep to sustain this high deep sleep proportion.'
                    : 'Tamisez la lumière 45 minutes avant le coucher pour préserver ce taux élevé de sommeil profond.')}
            </span>
          </div>
        </div>
      </div>
      </div>

      {/* MODAL AJOUTER UNE SIESTE AVANCÉE */}
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
              borderTop: '1px solid rgba(251, 146, 60, 0.45)',
              borderRadius: '28px 28px 0 0',
              padding: '22px 20px 36px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.85)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: 'rgba(251, 146, 60, 0.22)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sun size={17} color="#FB923C" />
                </span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#FAF7F2' }}>
                  {isEn ? 'Log a Restful Nap' : 'Enregistrer une Sieste'}
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

            {/* Presets Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: '#8E8E93', fontWeight: 600 }}>
                {isEn ? 'Choose Nap Type:' : 'Type de sieste réparatrice :'}
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <div
                  onClick={() => {
                    setNapPreset('power');
                    setNapDurationMin(20);
                  }}
                  style={{
                    background: napPreset === 'power' ? 'rgba(251, 146, 60, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                    border: napPreset === 'power' ? '1.5px solid #FB923C' : '1px solid rgba(255, 255, 255, 0.09)',
                    borderRadius: '14px',
                    padding: '10px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Zap size={15} color="#FB923C" />
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#FFF' }}>Power Nap</span>
                  <span style={{ fontSize: '10px', color: '#FB923C', fontWeight: 700 }}>20 min</span>
                  <span style={{ fontSize: '8.5px', color: 'rgba(250,247,242,0.6)' }}>Zéro inertie</span>
                </div>

                <div
                  onClick={() => {
                    setNapPreset('restful');
                    setNapDurationMin(35);
                  }}
                  style={{
                    background: napPreset === 'restful' ? 'rgba(251, 146, 60, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                    border: napPreset === 'restful' ? '1.5px solid #FB923C' : '1px solid rgba(255, 255, 255, 0.09)',
                    borderRadius: '14px',
                    padding: '10px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Sun size={15} color="#FB923C" />
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#FFF' }}>Récup</span>
                  <span style={{ fontSize: '10px', color: '#FB923C', fontWeight: 700 }}>35 min</span>
                  <span style={{ fontSize: '8.5px', color: 'rgba(250,247,242,0.6)' }}>Régénération</span>
                </div>

                <div
                  onClick={() => {
                    setNapPreset('cycle');
                    setNapDurationMin(90);
                  }}
                  style={{
                    background: napPreset === 'cycle' ? 'rgba(251, 146, 60, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                    border: napPreset === 'cycle' ? '1.5px solid #FB923C' : '1px solid rgba(255, 255, 255, 0.09)',
                    borderRadius: '14px',
                    padding: '10px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Moon size={15} color="#FB923C" />
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#FFF' }}>Cycle 90m</span>
                  <span style={{ fontSize: '10px', color: '#FB923C', fontWeight: 700 }}>90 min</span>
                  <span style={{ fontSize: '8.5px', color: 'rgba(250,247,242,0.6)' }}>Cycle REM</span>
                </div>
              </div>
            </div>

            {/* Timing Selector Chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: '#8E8E93', fontWeight: 600 }}>
                {isEn ? 'When did the nap end?' : 'Quand s’est-elle terminée ?'}
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[
                  { id: 'now', label: isEn ? 'Just now' : 'À l’instant' },
                  { id: '30m_ago', label: isEn ? '-30 min' : 'Il y a 30m' },
                  { id: '1h_ago', label: isEn ? '-1 hour' : 'Il y a 1h' },
                  { id: 'custom', label: isEn ? 'Custom' : 'Précis' },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setNapTimingMode(chip.id as any)}
                    style={{
                      background: napTimingMode === chip.id ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.05)',
                      border: napTimingMode === chip.id ? '1px solid #FFF' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      padding: '7px 4px',
                      fontSize: '10px',
                      fontWeight: 600,
                      color: napTimingMode === chip.id ? '#FFF' : '#8E8E93',
                      cursor: 'pointer',
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Inputs if selected */}
            {napTimingMode === 'custom' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', animation: 'fadeIn 160ms ease' }}>
                <div>
                  <label style={{ fontSize: '10.5px', color: '#8E8E93', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    {isEn ? 'Start Time' : 'Heure Début'}
                  </label>
                  <input
                    type="time"
                    value={customStartStr}
                    onChange={(e) => setCustomStartStr(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      color: '#FFF',
                      fontSize: '15px',
                      fontWeight: 700,
                      padding: '8px',
                      outline: 'none',
                      textAlign: 'center',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', color: '#8E8E93', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    {isEn ? 'End Time' : 'Heure Fin'}
                  </label>
                  <input
                    type="time"
                    value={customEndStr}
                    onChange={(e) => setCustomEndStr(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      color: '#FFF',
                      fontSize: '15px',
                      fontWeight: 700,
                      padding: '8px',
                      outline: 'none',
                      textAlign: 'center',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Real-time Impact Summary Badge */}
            <div
              style={{
                background: 'rgba(251, 146, 60, 0.12)',
                border: '1px solid rgba(251, 146, 60, 0.3)',
                borderRadius: '14px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.7)', display: 'block' }}>
                  {isEn ? 'Recharge Impact' : 'Bénéfice Récupération'}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#FB923C' }}>
                  +{Math.min(18, Math.max(5, Math.round(napDurationMin / 4.5)))}% Body Energy
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#30D158', fontWeight: 700 }}>
                {napDurationMin <= 25 ? (isEn ? 'No Grogginess' : 'Zéro inertie') : (isEn ? 'Deep Recovery' : 'Régénération')}
              </span>
            </div>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSaveNap}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '16px',
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
                boxShadow: '0 4px 20px rgba(251, 146, 60, 0.45)',
                marginTop: '4px',
              }}
            >
              <Sun size={17} color="#FFF" />
              <span>{isEn ? 'Save Restful Nap' : 'Enregistrer la sieste'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
