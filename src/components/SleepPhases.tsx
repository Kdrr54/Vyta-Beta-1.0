import React from 'react';
import { SleepSummary } from '../types';
import { fmtDuration } from '../lib/format';
import { Moon } from 'lucide-react';

interface SleepPhasesProps {
  sleep: SleepSummary;
}

export const SleepPhases: React.FC<SleepPhasesProps> = ({ sleep }) => {
  const totalMin = sleep.deepMin + sleep.remMin + sleep.lightMin + sleep.awakeMin;
  const deepPct = Math.round((sleep.deepMin / totalMin) * 100);
  const remPct = Math.round((sleep.remMin / totalMin) * 100);
  const lightPct = Math.round((sleep.lightMin / totalMin) * 100);
  const awakePct = Math.round((sleep.awakeMin / totalMin) * 100);

  return (
    <div className="sleep-phases-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Moon size={15} color="#FFFFFF" />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Architecture Nuit
            </span>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
              4 Phases de Sommeil
            </h3>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-display)' }}>
            {fmtDuration(totalMin - sleep.awakeMin)}
          </span>
          <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-secondary)' }}>
            Score : {sleep.score} / 100
          </span>
        </div>
      </div>

      {/* 4 Stage Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
        {/* Deep Sleep */}
        <div className="sleep-stage-row">
          <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Profond</span>
          <div className="stage-bar-track">
            <div className="stage-bar-fill deep" style={{ width: `${deepPct}%` }} />
          </div>
          <span style={{ textAlign: 'right', color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
            {fmtDuration(sleep.deepMin)} ({deepPct}%)
          </span>
        </div>

        {/* REM Sleep */}
        <div className="sleep-stage-row">
          <span style={{ color: '#AEAEB2', fontWeight: 600 }}>REM / Paradoxal</span>
          <div className="stage-bar-track">
            <div className="stage-bar-fill rem" style={{ width: `${remPct}%` }} />
          </div>
          <span style={{ textAlign: 'right', color: '#AEAEB2', fontFamily: 'var(--font-mono)' }}>
            {fmtDuration(sleep.remMin)} ({remPct}%)
          </span>
        </div>

        {/* Light Sleep */}
        <div className="sleep-stage-row">
          <span style={{ color: '#8E8E93' }}>Léger</span>
          <div className="stage-bar-track">
            <div className="stage-bar-fill light" style={{ width: `${lightPct}%` }} />
          </div>
          <span style={{ textAlign: 'right', color: '#8E8E93', fontFamily: 'var(--font-mono)' }}>
            {fmtDuration(sleep.lightMin)} ({lightPct}%)
          </span>
        </div>

        {/* Awake */}
        <div className="sleep-stage-row">
          <span style={{ color: '#636366' }}>Éveil</span>
          <div className="stage-bar-track">
            <div className="stage-bar-fill awake" style={{ width: `${awakePct}%` }} />
          </div>
          <span style={{ textAlign: 'right', color: '#636366', fontFamily: 'var(--font-mono)' }}>
            {fmtDuration(sleep.awakeMin)} ({awakePct}%)
          </span>
        </div>
      </div>
    </div>
  );
};
