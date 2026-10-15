import React from 'react';
import { Sparkles, Calendar, HelpCircle } from 'lucide-react';

export const CycleModule: React.FC = () => {
  // Generate 28 days basal body temperature data
  // Phase 1 (Days 1-13): Follicular phase, lower temp (~36.3°C - 36.4°C)
  // Day 14: Dip before ovulation (~36.2°C)
  // Phase 2 (Days 15-28): Luteal phase, progesterone rise (+0.3°C - 0.5°C => ~36.7°C - 36.8°C)
  const currentCycleDay = 12;
  const cycleLength = 28;

  // Chart width 320, height 70
  // Day coordinates x from 10 to 310
  const points = Array.from({ length: 28 }, (_, i) => {
    const day = i + 1;
    const x = 10 + (i / 27) * 300;
    let temp = 36.35;
    if (day < 14) {
      temp = 36.32 + Math.sin(day * 0.8) * 0.06;
    } else if (day === 14) {
      temp = 36.22; // Ovulation dip
    } else {
      temp = 36.72 + Math.sin(day * 0.5) * 0.08; // Luteal plateau
    }
    // Map temp 36.1 - 36.9 to y: 60 (low) to 10 (high)
    const y = 60 - ((temp - 36.1) / 0.8) * 50;
    return { x, y, day, temp };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const currentPt = points[currentCycleDay - 1];
  const ovulationPt = points[13]; // Day 14

  return (
    <div className="cycle-card">
      <div className="cycle-top">
        <div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Santé Hormonale
          </span>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: '2px 0 0 0' }}>
            Cycle & Température Basale
          </h3>
        </div>

        <span className="cycle-phase-badge">
          Phase Folliculaire · J{currentCycleDay}
        </span>
      </div>

      {/* 28-day Basal Temperature Curve SVG */}
      <div className="cycle-chart-wrap">
        <svg width="100%" height="80" viewBox="0 0 320 80" preserveAspectRatio="none">
          <defs>
            <linearGradient id="fertileWindow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 140, 180, 0.25)" />
              <stop offset="100%" stopColor="rgba(255, 140, 180, 0.02)" />
            </linearGradient>
          </defs>

          {/* Fertile window zone highlight (Days 11 to 16) */}
          <rect
            x={10 + (10 / 27) * 300}
            y="5"
            width={(5 / 27) * 300}
            height="65"
            fill="url(#fertileWindow)"
            rx="6"
          />

          {/* Baseline reference dashed lines */}
          <line x1="10" y1="45" x2="310" y2="45" stroke="rgba(255, 255, 255, 0.07)" strokeDasharray="3 3" />

          {/* Smooth path */}
          <path
            d={pathD}
            fill="none"
            stroke="rgba(255, 180, 205, 0.85)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Future days ghost trail */}
          <path
            d={points.slice(currentCycleDay - 1).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth="1.5"
            strokeDasharray="2 3"
          />

          {/* Ovulation marker */}
          <circle cx={ovulationPt.x} cy={ovulationPt.y} r="4" fill="#FF8CB4" />

          {/* Current day pulsing indicator */}
          <circle cx={currentPt.x} cy={currentPt.y} r="7" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6" />
          <circle cx={currentPt.x} cy={currentPt.y} r="4" fill="#FFFFFF" />
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          <span>J1 (Règles)</span>
          <span style={{ color: '#FFB0C8', fontWeight: 600 }}>J14 (Ovulation prévue)</span>
          <span>J28</span>
        </div>
      </div>

      {/* Meta predictions */}
      <div className="cycle-meta-grid">
        <div className="cycle-meta-item">
          <span className="cycle-meta-label">Prédiction d'Ovulation</span>
          <span className="cycle-meta-val" style={{ color: '#FFB0C8' }}>
            Dans 2 jours (Sam. 17)
          </span>
        </div>

        <div className="cycle-meta-item">
          <span className="cycle-meta-label">Température Basale Actuelle</span>
          <span className="cycle-meta-val">
            36,36 °C (Plage stable)
          </span>
        </div>
      </div>
    </div>
  );
};
