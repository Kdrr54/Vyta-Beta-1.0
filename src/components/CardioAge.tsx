import React from 'react';
import { useApp } from '../context/AppContext';
import { Heart } from 'lucide-react';

interface CardioAgeProps {
  score: number;
}

export const CardioAge: React.FC<CardioAgeProps> = ({ score }) => {
  const { profile, t, isFirstLaunch, cardThemeMode } = useApp();
  const isMono = cardThemeMode === 'monochrome';
  const isZeroState = isFirstLaunch || score === 0;

  const delta = score >= 90 ? -4 : score >= 80 ? -2 : 0;
  const estimatedAge = Math.max(18, profile.age + delta);

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
          : 'radial-gradient(ellipse at 50% 115%, rgba(217, 249, 112, 0.28) 0%, rgba(163, 204, 62, 0.08) 42%, rgba(10, 10, 12, 0.95) 78%), rgba(10, 10, 12, 0.86)',
        backdropFilter: 'blur(26px)',
        WebkitBackdropFilter: 'blur(26px)',
        borderTop: '1px solid rgba(255, 248, 240, 0.16)',
        borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
        borderRight: '1px solid rgba(255, 248, 240, 0.12)',
        borderBottom: isMono ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(217, 249, 112, 0.65)',
        boxShadow: isMono
          ? '0 14px 32px rgba(0, 0, 0, 0.55), 0 4px 18px rgba(255, 255, 255, 0.06)'
          : '0 14px 32px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(217, 249, 112, 0.14)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 400, color: 'rgba(250, 247, 242, 0.9)' }}>
            {t('cardio.title')}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)' }}>
          {isZeroState ? 'En attente de données cardio' : 'Indice basé sur la VRC et le cardio au repos'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontSize: '38px', fontWeight: 300, color: '#FAF7F2', lineHeight: 1, letterSpacing: '-1px' }}>
            {isZeroState ? '--' : estimatedAge}
          </span>
          <span style={{ fontSize: '15px', fontWeight: 300, color: 'rgba(250, 247, 242, 0.75)', marginLeft: '2px' }}>
            {t('cardio.years')}
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
          <Heart size={14} color={isMono ? "#FAF7F2" : "#D9F970"} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
};
