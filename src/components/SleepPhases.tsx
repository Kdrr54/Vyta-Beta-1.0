import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { SleepSummary } from '../types';
import { fmtDuration } from '../lib/format';
import { Moon, Sparkles } from 'lucide-react';

interface SleepPhasesProps {
  sleep: SleepSummary;
}

interface SleepStageInfo {
  id: 'deep' | 'rem' | 'light' | 'awake';
  name: string;
  minutes: number;
  pct: number;
  color: string;
  benchmark: string;
  benchmarkStatus: string;
  minPct: number;
  maxPct: number;
}

const CYCLE_TEMPLATE: Array<{ stage: 'deep' | 'rem' | 'light' | 'awake'; weight: number }> = [
  { stage: 'awake', weight: 0.60 },
  { stage: 'light', weight: 0.12 },
  { stage: 'deep',  weight: 0.45 },
  { stage: 'light', weight: 0.10 },
  { stage: 'rem',   weight: 0.15 },

  { stage: 'light', weight: 0.12 },
  { stage: 'deep',  weight: 0.35 },
  { stage: 'light', weight: 0.10 },
  { stage: 'rem',   weight: 0.25 },
  { stage: 'awake', weight: 0.15 },

  { stage: 'light', weight: 0.18 },
  { stage: 'deep',  weight: 0.20 },
  { stage: 'light', weight: 0.14 },
  { stage: 'rem',   weight: 0.32 },

  { stage: 'light', weight: 0.14 },
  { stage: 'rem',   weight: 0.28 },
  { stage: 'light', weight: 0.10 },
  { stage: 'awake', weight: 0.25 },
];

export const SleepPhases: React.FC<SleepPhasesProps> = ({ sleep }) => {
  const { t, cardThemeMode, language } = useApp();
  const isMono = cardThemeMode === 'monochrome';
  const isFr = language === 'fr';

  const [selectedId, setSelectedId] = useState<'deep' | 'rem' | 'light' | 'awake' | null>(null);

  const totalMin = sleep.deepMin + sleep.remMin + sleep.lightMin + sleep.awakeMin;
  const effectiveMin = totalMin > 0 ? totalMin - sleep.awakeMin : 0;
  const efficiencyPct = totalMin > 0 ? Math.round((effectiveMin / totalMin) * 100) : 0;

  const deepPct = totalMin > 0 ? Math.round((sleep.deepMin / totalMin) * 100) : 0;
  const remPct = totalMin > 0 ? Math.round((sleep.remMin / totalMin) * 100) : 0;
  const lightPct = totalMin > 0 ? Math.round((sleep.lightMin / totalMin) * 100) : 0;
  const awakePct = totalMin > 0 ? Math.max(0, 100 - (deepPct + remPct + lightPct)) : 0;

  const stageColors = {
    deep: isMono ? '#FFFFFF' : '#818CF8',
    rem: isMono ? '#D4D4D8' : '#C084FC',
    light: isMono ? '#71717A' : '#38BDF8',
    awake: isMono ? 'rgba(255,255,255,0.32)' : '#F59E0B',
  };

  const stages: SleepStageInfo[] = [
    {
      id: 'deep',
      name: isFr ? 'Profond' : 'Deep',
      minutes: sleep.deepMin,
      pct: deepPct,
      color: stageColors.deep,
      benchmark: '15-25%',
      benchmarkStatus: deepPct >= 15 && deepPct <= 25 ? (isFr ? 'Optimal' : 'Optimal') : deepPct > 25 ? (isFr ? 'Élevé' : 'High') : (isFr ? 'À stimuler' : 'Low'),
      minPct: 15,
      maxPct: 25,
    },
    {
      id: 'rem',
      name: isFr ? 'REM / Paradoxal' : 'REM',
      minutes: sleep.remMin,
      pct: remPct,
      color: stageColors.rem,
      benchmark: '20-25%',
      benchmarkStatus: remPct >= 18 && remPct <= 27 ? (isFr ? 'Optimal' : 'Optimal') : (isFr ? 'Normal' : 'Normal'),
      minPct: 20,
      maxPct: 25,
    },
    {
      id: 'light',
      name: isFr ? 'Léger' : 'Light',
      minutes: sleep.lightMin,
      pct: lightPct,
      color: stageColors.light,
      benchmark: '45-55%',
      benchmarkStatus: lightPct >= 40 && lightPct <= 60 ? (isFr ? 'Normal' : 'Normal') : (isFr ? 'Élevé' : 'High'),
      minPct: 45,
      maxPct: 55,
    },
    {
      id: 'awake',
      name: isFr ? 'Éveil' : 'Awake',
      minutes: sleep.awakeMin,
      pct: awakePct,
      color: stageColors.awake,
      benchmark: '< 10%',
      benchmarkStatus: awakePct <= 10 ? (isFr ? 'Excellent' : 'Excellent') : (isFr ? 'Modéré' : 'Moderate'),
      minPct: 0,
      maxPct: 10,
    },
  ];

  const activeStage = stages.find((s) => s.id === selectedId) || null;
  const restorativeMin = sleep.deepMin + sleep.remMin;
  const restorativePct = totalMin > 0 ? Math.round((restorativeMin / totalMin) * 100) : 0;

  const fmtClockMin = (min?: number) => {
    if (min === undefined || min === null || isNaN(min)) return '--:--';
    const norm = ((Math.round(min) % 1440) + 1440) % 1440;
    const h = Math.floor(norm / 60);
    const m = norm % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  const bedtimeStr = totalMin > 0 && sleep.startMin !== undefined ? fmtClockMin(sleep.startMin) : '--:--';
  const wakeStr = totalMin > 0 && sleep.endMin !== undefined ? fmtClockMin(sleep.endMin) : '--:--';
  const hypnogramTicks = (() => {
    if (totalMin <= 0 || sleep.startMin === undefined || sleep.endMin === undefined) {
      return ['--:--', '--:--', '--:--', '--:--', '--:--'];
    }
    const s = sleep.startMin > sleep.endMin ? sleep.startMin - 1440 : sleep.startMin;
    const e = sleep.endMin;
    return [0, 0.25, 0.5, 0.75, 1].map((t) => fmtClockMin(s + (e - s) * t));
  })();

  const hypnogramBlocks = useMemo(() => {
    if (totalMin <= 0) return [];

    let currentMin = 0;
    return CYCLE_TEMPLATE.map((item, idx) => {
      let duration = 0;
      if (item.stage === 'deep') duration = sleep.deepMin * item.weight;
      else if (item.stage === 'rem') duration = sleep.remMin * item.weight;
      else if (item.stage === 'light') duration = sleep.lightMin * item.weight;
      else if (item.stage === 'awake') duration = sleep.awakeMin * item.weight;

      const start = currentMin;
      currentMin += duration;

      return {
        id: `block-${idx}`,
        stage: item.stage,
        startMin: start,
        durationMin: duration,
        color: stageColors[item.stage],
      };
    });
  }, [sleep, stageColors, totalMin]);

  const chartW = 310;
  const chartH = 92;
  const stageY: Record<'awake' | 'rem' | 'light' | 'deep', number> = {
    awake: 10,
    rem: 32,
    light: 54,
    deep: 76,
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        padding: '18px 18px 16px 18px',
        borderRadius: '26px',
        overflow: 'hidden',
        background: isMono
          ? 'radial-gradient(ellipse at 50% 115%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 48%, rgba(10, 10, 12, 0.96) 80%), #0A0A0C'
          : 'radial-gradient(ellipse at 50% 115%, rgba(167, 139, 250, 0.28) 0%, rgba(129, 140, 248, 0.08) 42%, rgba(10, 10, 12, 0.95) 78%), rgba(10, 10, 12, 0.86)',
        backdropFilter: 'blur(26px)',
        WebkitBackdropFilter: 'blur(26px)',
        borderTop: '1px solid rgba(255, 248, 240, 0.16)',
        borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
        borderRight: '1px solid rgba(255, 248, 240, 0.12)',
        borderBottom: isMono ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(167, 139, 250, 0.65)',
        boxShadow: isMono
          ? '0 14px 32px rgba(0, 0, 0, 0.55), 0 4px 18px rgba(255, 255, 255, 0.06)'
          : '0 14px 32px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(167, 139, 250, 0.14)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        userSelect: 'none',
      }}
    >
      {/* 1. Header: Icon, Title & Bedtime Window */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: isMono ? 'rgba(255, 255, 255, 0.08)' : 'rgba(192, 132, 252, 0.16)',
              border: isMono ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(192, 132, 252, 0.4)',
              boxShadow: isMono ? 'none' : '0 0 12px rgba(192, 132, 252, 0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Moon size={15} color={isMono ? "#FAF7F2" : "#C084FC"} strokeWidth={1.8} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#FAF7F2', letterSpacing: '-0.2px' }}>
              {t('sleep.title')}
            </span>
            <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.52)', marginTop: '1px' }}>
              {totalMin > 0 ? `${bedtimeStr} – ${wakeStr} · ${fmtDuration(totalMin)} ${isFr ? 'au lit' : 'in bed'}` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Hero Metric Row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', zIndex: 2 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span
              style={{
                fontSize: '34px',
                fontWeight: 300,
                color: '#FAF7F2',
                lineHeight: 1,
                letterSpacing: '-1px',
                fontFamily: 'var(--font-display, -apple-system, sans-serif)',
              }}
            >
              {totalMin > 0 ? (activeStage ? fmtDuration(activeStage.minutes) : fmtDuration(effectiveMin)) : '--'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.65)', marginTop: '3px' }}>
            {totalMin > 0 ? (activeStage ? `${activeStage.name} (${activeStage.pct}%)` : (isFr ? `Sommeil effectif · ${efficiencyPct}% d'efficacité` : `Effective sleep · ${efficiencyPct}% efficiency`)) : '--'}
          </span>
        </div>

        {/* Restorative sleep stat highlight */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            padding: '5px 10px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={11} color={isMono ? "#FAF7F2" : "#A78BFA"} />
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#FAF7F2' }}>
              {totalMin > 0 ? fmtDuration(restorativeMin) : '--'}
            </span>
            <span style={{ fontSize: '10px', color: isMono ? '#FAF7F2' : '#C084FC', fontFamily: 'var(--font-mono)' }}>
              {totalMin > 0 ? `(${restorativePct}%)` : ''}
            </span>
          </div>
          <span style={{ fontSize: '9.5px', color: 'rgba(250, 247, 242, 0.52)' }}>
            {isFr ? 'Profond + REM' : 'Deep + REM'}
          </span>
        </div>
      </div>

      {/* 3. Main Visualizer: Apple-style Hypnogram */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', zIndex: 2 }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <svg
                width="100%"
                height={chartH}
                viewBox={`0 0 ${chartW} ${chartH}`}
                style={{ overflow: 'visible', display: 'block' }}
              >
                <defs>
                  <pattern id="sleepGrid" width="60" height="92" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="0" y2="92" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  </pattern>
                </defs>

                <rect width={chartW} height={chartH} fill="url(#sleepGrid)" rx="10" />

                {(['awake', 'rem', 'light', 'deep'] as const).map((stageKey) => {
                  const y = stageY[stageKey];
                  const isHighlighted = activeStage?.id === stageKey;
                  return (
                    <g key={stageKey}>
                      <line
                        x1="36"
                        y1={y}
                        x2={chartW}
                        y2={y}
                        stroke={isHighlighted ? stageColors[stageKey] : 'rgba(255, 255, 255, 0.08)'}
                        strokeWidth={isHighlighted ? '1.2' : '1'}
                        strokeDasharray={isHighlighted ? 'none' : '2 3'}
                        style={{ transition: 'all 0.2s ease' }}
                      />
                      <text
                        x="30"
                        y={y + 3}
                        textAnchor="end"
                        fill={isHighlighted ? stageColors[stageKey] : 'rgba(250, 247, 242, 0.42)'}
                        fontSize="8.5"
                        fontWeight={isHighlighted ? '600' : '400'}
                        style={{ transition: 'all 0.2s ease' }}
                      >
                        {stageKey === 'awake'
                          ? (isFr ? 'Éveil' : 'Awake')
                          : stageKey === 'rem'
                          ? 'REM'
                          : stageKey === 'light'
                          ? (isFr ? 'Léger' : 'Light')
                          : (isFr ? 'Prof.' : 'Deep')}
                      </text>
                    </g>
                  );
                })}

                {totalMin > 0 &&
                  hypnogramBlocks.map((blk) => {
                    const blockX = 38 + (blk.startMin / totalMin) * (chartW - 42);
                    const blockW = Math.max(3, (blk.durationMin / totalMin) * (chartW - 42));
                    const blockY = stageY[blk.stage] - 4;
                    const isSelected = activeStage?.id === blk.stage;
                    const isDimmed = activeStage !== null && !isSelected;

                    return (
                      <rect
                        key={blk.id}
                        x={blockX}
                        y={blockY}
                        width={blockW}
                        height={8}
                        rx={4}
                        fill={blk.color}
                        opacity={isDimmed ? 0.22 : isSelected ? 1 : 0.92}
                        onClick={() => setSelectedId(selectedId === blk.stage ? null : blk.stage)}
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          filter: isSelected
                            ? `drop-shadow(0 0 6px ${blk.color})`
                            : 'none',
                        }}
                      />
                    );
                  })}
              </svg>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingLeft: '38px',
                  paddingRight: '4px',
                  marginTop: '4px',
                }}
              >
                {hypnogramTicks.map((lbl, idx) => (
                  <span key={idx} style={{ fontSize: '9px', color: 'rgba(250, 247, 242, 0.45)', fontFamily: 'var(--font-mono)' }}>
                    {lbl}
                  </span>
                ))}
              </div>
            </div>
          </div>
      </div>

      {/* 4. Proportional Segment Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', zIndex: 2 }}>
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '7px',
            borderRadius: '999px',
            overflow: 'hidden',
            background: 'rgba(255, 255, 255, 0.06)',
            gap: '2.5px',
          }}
        >
          {stages.map((st) => {
            const isSelected = activeStage?.id === st.id;
            const isDimmed = activeStage !== null && !isSelected;
            return (
              <div
                key={st.id}
                onClick={() => setSelectedId(selectedId === st.id ? null : st.id)}
                title={`${st.name}: ${fmtDuration(st.minutes)} (${st.pct}%)`}
                style={{
                  flex: st.pct,
                  height: '100%',
                  backgroundColor: st.color,
                  borderRadius: '999px',
                  opacity: isDimmed ? 0.28 : 1,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? `0 0 8px ${st.color}` : 'none',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 5. Integrated Luxury Glass Stage Breakdown */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.035)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          zIndex: 2,
        }}
      >
        {stages.map((st, index) => {
          const isSelected = activeStage?.id === st.id;
          const isLast = index === stages.length - 1;

          return (
            <div
              key={st.id}
              onClick={() => setSelectedId(selectedId === st.id ? null : st.id)}
              role="button"
              tabIndex={0}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9.5px 12px',
                borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                background: isSelected ? 'rgba(192, 132, 252, 0.12)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.16s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '7.5px',
                    height: '7.5px',
                    borderRadius: '50%',
                    backgroundColor: st.color,
                    boxShadow: isSelected || !isMono ? `0 0 6px ${st.color}` : 'none',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: isSelected ? 500 : 400,
                    color: isSelected ? '#FAF7F2' : 'rgba(250, 247, 242, 0.82)',
                  }}
                >
                  {st.name}
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    color: isSelected ? st.color : 'rgba(250, 247, 242, 0.45)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  {st.benchmarkStatus}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 400,
                    color: '#FAF7F2',
                  }}
                >
                  {fmtDuration(st.minutes)}
                </span>
                <span
                  style={{
                    fontSize: '10.5px',
                    color: 'rgba(250, 247, 242, 0.52)',
                    fontFamily: 'var(--font-mono, monospace)',
                    minWidth: '28px',
                    textAlign: 'right',
                  }}
                >
                  {st.pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 6. Subtle Clinical Insight Note at bottom */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '12px',
          background: isMono ? 'rgba(255, 255, 255, 0.03)' : 'rgba(167, 139, 250, 0.06)',
          border: isMono ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(167, 139, 250, 0.15)',
          zIndex: 2,
        }}
      >
        <Sparkles size={12} color={isMono ? "#FAF7F2" : "#C084FC"} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.72)', lineHeight: 1.35 }}>
          {totalMin > 0
            ? (isFr
                ? `Architecture nocturne : ${restorativePct}% de sommeil réparateur (profond + REM) garantissant la régénération musculaire et mnésique.`
                : `Night architecture: ${restorativePct}% restorative sleep (deep + REM) supporting muscular and cognitive recovery.`)
            : (isFr
                ? 'En attente des mesures nocturnes de votre bague.'
                : 'Awaiting nocturnal readings from your ring.')}
        </span>
      </div>
    </div>
  );
};
