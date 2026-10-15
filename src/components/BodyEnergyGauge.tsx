import React from 'react';
import { BatteryCharging, Zap } from 'lucide-react';

interface BodyEnergyGaugeProps {
  energy: number;
  wake: number;
  bedtime: number;
}

export const BodyEnergyGauge: React.FC<BodyEnergyGaugeProps> = ({ energy, wake, bedtime }) => {
  // Semicircle arc calculation: radius = 45, cx = 55, cy = 55
  // Perimeter of semicircle = Math.PI * 45 ≈ 141.37
  const r = 45;
  const strokeLen = Math.PI * r;
  const fillLen = (energy / 100) * strokeLen;

  return (
    <div className="body-energy-card">
      <div className="body-energy-top">
        <div className="body-energy-title-group">
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Batterie Corporelle
          </span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
            Body Energy
          </span>
        </div>

        <div className="body-energy-pill">
          <span>{energy >= 70 ? 'Rechargé' : 'Modéré'}</span>
        </div>
      </div>

      <div className="body-energy-main">
        {/* Semicircle SVG Gauge */}
        <div className="body-energy-dial">
          <svg width="110" height="60" viewBox="0 0 110 60">
            {/* Background Arc */}
            <path
              d="M 10 55 A 45 45 0 0 1 100 55"
              fill="none"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            {/* Dynamic Fill Arc */}
            <path
              d="M 10 55 A 45 45 0 0 1 100 55"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="8"
              strokeDasharray={`${strokeLen}`}
              strokeDashoffset={`${strokeLen - fillLen}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
          </svg>
          <span className="body-energy-percent">{energy}%</span>
        </div>

        {/* Energy breakdown stats */}
        <div className="body-energy-stats">
          <div className="energy-stat-row">
            <span className="stat-label">Au réveil (07:00)</span>
            <span className="stat-val">{wake}%</span>
          </div>
          <div className="energy-stat-row">
            <span className="stat-label">Disponible actuellement</span>
            <span className="stat-val" style={{ color: '#FFFFFF' }}>{energy}%</span>
          </div>
          <div className="energy-stat-row">
            <span className="stat-label">Prévu au coucher</span>
            <span className="stat-val" style={{ color: 'var(--text-secondary)' }}>{bedtime}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
