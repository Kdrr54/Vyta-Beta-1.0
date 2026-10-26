import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SleepSummary } from '../types';
import { fmtDuration } from '../lib/format';
import { Moon } from 'lucide-react';

interface SleepPhasesProps {
  sleep: SleepSummary;
}

interface SleepStageInfo {
  id: 'deep' | 'rem' | 'light' | 'awake';
  labelKey: 'sleep.deep' | 'sleep.rem' | 'sleep.light' | 'sleep.awake';
  minutes: number;
  pct: number;
  color: string;
}

export const SleepPhases: React.FC<SleepPhasesProps> = ({ sleep }) => {
  const { t, theme } = useApp();
  const isCeramic = theme === 'ceramic';
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const totalMin = sleep.deepMin + sleep.remMin + sleep.lightMin + sleep.awakeMin;
  const effectiveMin = totalMin - sleep.awakeMin;

  const deepPct = totalMin > 0 ? Math.round((sleep.deepMin / totalMin) * 100) : 0;
  const remPct = totalMin > 0 ? Math.round((sleep.remMin / totalMin) * 100) : 0;
  const lightPct = totalMin > 0 ? Math.round((sleep.lightMin / totalMin) * 100) : 0;
  const awakePct = totalMin > 0 ? Math.max(1, 100 - (deepPct + remPct + lightPct)) : 0;

  const stages: SleepStageInfo[] = [
    { id: 'deep', labelKey: 'sleep.deep', minutes: sleep.deepMin, pct: deepPct, color: '#818CF8' },
    { id: 'rem', labelKey: 'sleep.rem', minutes: sleep.remMin, pct: remPct, color: '#C084FC' },
    { id: 'light', labelKey: 'sleep.light', minutes: sleep.lightMin, pct: lightPct, color: '#67E8F9' },
    { id: 'awake', labelKey: 'sleep.awake', minutes: sleep.awakeMin, pct: awakePct, color: 'rgba(255, 255, 255, 0.3)' },
  ];

  const activeStage = stages.find((s) => s.id === selectedId) || null;

  // SVG Donut calculation
  const size = 160;
  const strokeWidth = 13;
  const radius = (size - strokeWidth) / 2 - 4;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const gap = 4;
  const totalGaps = gap * stages.length;
  const availableLength = circumference - totalGaps;

  let currentOffset = 0;
  const segments = stages.map((st) => {
    const arcLength = totalMin > 0 ? (st.minutes / totalMin) * availableLength : 0;
    const dashArray = `${arcLength.toFixed(2)} ${(circumference - arcLength).toFixed(2)}`;
    const dashOffset = -currentOffset;
    currentOffset += arcLength + gap;
    return {
      ...st,
      dashArray,
      dashOffset,
    };
  });

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        padding: '16px 18px',
        borderRadius: '26px',
        overflow: 'hidden',
        background:
          'radial-gradient(ellipse at 50% 115%, rgba(167, 139, 250, 0.28) 0%, rgba(129, 140, 248, 0.08) 42%, rgba(10, 10, 12, 0.95) 78%), rgba(10, 10, 12, 0.86)',
        backdropFilter: 'blur(26px)',
        WebkitBackdropFilter: 'blur(26px)',
        borderTop: '1px solid rgba(255, 248, 240, 0.16)',
        borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
        borderRight: '1px solid rgba(255, 248, 240, 0.12)',
        borderBottom: '1.5px solid rgba(167, 139, 250, 0.65)',
        boxShadow: '0 14px 32px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(167, 139, 250, 0.14)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 400, color: 'rgba(250, 247, 242, 0.9)' }}>
            {t('sleep.title')}
          </span>
          <span
            style={{
              fontSize: '9.5px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '999px',
              color: '#C084FC',
              background: 'rgba(192, 132, 252, 0.12)',
              border: '1px solid rgba(192, 132, 252, 0.3)',
            }}
          >
            {sleep.score > 0 ? `${t('sleep.score')} ${sleep.score} / 100` : t('sleep.title')}
          </span>
        </div>

        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Moon size={14} color="#C084FC" strokeWidth={1.8} />
        </div>
      </div>

      {/* Circular Donut Ring with Hours in Center */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4px 0', zIndex: 2 }}>
        <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
          >
            {/* Background Track */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={strokeWidth}
            />

            {/* 4 Stage Arcs */}
            {segments.map((seg) => {
              const isSelected = activeStage?.id === seg.id;
              const isDimmed = activeStage !== null && !isSelected;
              return (
                <circle
                  key={seg.id}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={isSelected ? strokeWidth + 2.5 : strokeWidth}
                  strokeDasharray={seg.dashArray}
                  strokeDashoffset={seg.dashOffset}
                  transform={`rotate(-90 ${center} ${center})`}
                  style={{
                    opacity: isDimmed ? 0.35 : 1,
                    transition: 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)',
                    cursor: 'pointer',
                    filter: `drop-shadow(0 0 6px ${seg.color}99)`,
                  }}
                  onClick={() => setSelectedId(selectedId === seg.id ? null : seg.id)}
                />
              );
            })}
          </svg>

          {/* Center Content: Hours & Label */}
          <div
            onClick={() => setSelectedId(null)}
            title="Reset"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 3,
            }}
          >
            <span style={{ fontSize: '30px', fontWeight: 300, color: '#FAF7F2', lineHeight: 1, letterSpacing: '-0.8px' }}>
              {activeStage ? fmtDuration(activeStage.minutes) : fmtDuration(effectiveMin)}
            </span>
            <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.65)', marginTop: '4px' }}>
              {activeStage ? `${t(activeStage.labelKey)} (${activeStage.pct}%)` : t('sleep.total')}
            </span>
          </div>
        </div>
      </div>

      {/* 4 Stages Legend Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', zIndex: 2 }}>
        {stages.map((st) => {
          const isSelected = activeStage?.id === st.id;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => setSelectedId(selectedId === st.id ? null : st.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '9px 12px',
                borderRadius: '14px',
                background: isSelected ? 'rgba(192, 132, 252, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                border: isSelected ? '1px solid rgba(192, 132, 252, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: st.color,
                    boxShadow: `0 0 6px ${st.color}`,
                  }}
                />
                <span style={{ fontSize: '11.5px', color: 'rgba(250, 247, 242, 0.78)', fontWeight: 400 }}>
                  {t(st.labelKey)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '14px', fontWeight: 400, color: '#FAF7F2' }}>
                  {fmtDuration(st.minutes)}
                </span>
                <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)', fontFamily: 'var(--font-mono)' }}>
                  {st.pct}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
