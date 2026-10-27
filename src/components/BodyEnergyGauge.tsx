import React from 'react';
import { useApp } from '../context/AppContext';
import { Zap } from 'lucide-react';

interface BodyEnergyGaugeProps {
  energy: number;
  wake: number;
  bedtime: number;
}

export const BodyEnergyGauge: React.FC<BodyEnergyGaugeProps> = ({ energy, wake, bedtime }) => {
  const { t, isFirstLaunch, cardThemeMode } = useApp();
  const isMono = cardThemeMode === 'monochrome';
  const isZeroState = isFirstLaunch || energy === 0;

  const r = 44;
  const strokeLen = Math.PI * r;
  const fillLen = (energy / 100) * strokeLen;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        padding: '16px 18px',
        borderRadius: '26px',
        overflow: 'hidden',
        background: isMono
          ? 'radial-gradient(ellipse at 50% 115%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 48%, rgba(10, 10, 12, 0.96) 80%), #0A0A0C'
          : 'radial-gradient(ellipse at 50% 115%, rgba(56, 189, 248, 0.28) 0%, rgba(14, 165, 233, 0.08) 42%, rgba(10, 10, 12, 0.95) 78%), rgba(10, 10, 12, 0.86)',
        backdropFilter: 'blur(26px)',
        WebkitBackdropFilter: 'blur(26px)',
        borderTop: '1px solid rgba(255, 248, 240, 0.16)',
        borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
        borderRight: '1px solid rgba(255, 248, 240, 0.12)',
        borderBottom: isMono ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(56, 189, 248, 0.65)',
        boxShadow: isMono
          ? '0 14px 32px rgba(0, 0, 0, 0.55), 0 4px 18px rgba(255, 255, 255, 0.06)'
          : '0 14px 32px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(56, 189, 248, 0.14)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        userSelect: 'none',
      }}
    >
      {/* Top Row: Title + Circular Frosted Glass Zap Orb + Status Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 400, color: 'rgba(250, 247, 242, 0.9)' }}>
            {t('energy.title')}
          </span>
          <span
            style={{
              fontSize: '9.5px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '999px',
              color: isMono ? '#FAF7F2' : '#38BDF8',
              background: isMono ? 'rgba(255, 255, 255, 0.1)' : 'rgba(56, 189, 248, 0.12)',
              border: isMono ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            {isZeroState ? 'En attente de nuit' : (energy >= 70 ? t('energy.recharged') : t('energy.moderate'))}
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
          <Zap size={14} color={isMono ? "#FAF7F2" : "#38BDF8"} strokeWidth={1.8} />
        </div>
      </div>

      {/* Main Content: Semicircle Arch + Large Numeral + Breakdown */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', zIndex: 2 }}>
        {/* Left: Semicircle Gauge with Large 300-weight value */}
        <div style={{ position: 'relative', width: '110px', height: '60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <svg width="110" height="60" viewBox="0 0 110 60" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
            <path
              d="M 10 54 A 45 45 0 0 1 100 54"
              fill="none"
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M 10 54 A 45 45 0 0 1 100 54"
              fill="none"
              stroke={isMono ? '#FAF7F2' : '#38BDF8'}
              strokeWidth="7"
              strokeDasharray={`${strokeLen}`}
              strokeDashoffset={`${strokeLen - fillLen}`}
              strokeLinecap="round"
              style={{
                filter: isMono ? 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.75))' : 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.85))',
                transition: 'stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </svg>
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '2px', zIndex: 2 }}>
            <span style={{ fontSize: '32px', fontWeight: 300, color: '#FAF7F2', lineHeight: 1, letterSpacing: '-0.8px' }}>
              {isZeroState ? '--' : energy}
            </span>
            <span style={{ fontSize: '15px', fontWeight: 300, color: 'rgba(250, 247, 242, 0.75)', marginLeft: '1px' }}>
              %
            </span>
          </div>
        </div>

        {/* Right: 3 Key Metrics Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.65)', whiteSpace: 'nowrap' }}>{t('energy.wake')}</span>
            <span style={{ fontSize: '12px', fontWeight: 400, color: '#FAF7F2', whiteSpace: 'nowrap' }}>{isZeroState ? '--' : `${wake}%`}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.65)', whiteSpace: 'nowrap' }}>{t('energy.current')}</span>
            <span style={{ fontSize: '12.5px', fontWeight: 500, color: isMono ? '#FAF7F2' : '#38BDF8', whiteSpace: 'nowrap' }}>{energy}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.65)', whiteSpace: 'nowrap' }}>{t('energy.bedtime')}</span>
            <span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(250, 247, 242, 0.65)', whiteSpace: 'nowrap' }}>{isZeroState ? '--' : `${bedtime}%`}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
