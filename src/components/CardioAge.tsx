import React from 'react';
import { useApp } from '../context/AppContext';
import { HeartHandshake } from 'lucide-react';

interface CardioAgeProps {
  score: number;
}

export const CardioAge: React.FC<CardioAgeProps> = ({ score }) => {
  const { profile } = useApp();

  // Cardio age estimation based on vitality score
  // High vitality (91) -> ~ 4 years younger
  const delta = score >= 90 ? -4 : score >= 80 ? -2 : 0;
  const estimatedAge = Math.max(18, profile.age + delta);

  return (
    <div className="cardio-age-card">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Santé Artérielle
        </span>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
          Âge Cardiovasculaire
        </h3>
        <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
          Basé sur la rigidité artérielle optique & la VFC
        </p>
      </div>

      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <div className="cardio-age-num-group">
          <span className="cardio-age-num">{estimatedAge}</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>ans</span>
        </div>
      </div>
    </div>
  );
};
