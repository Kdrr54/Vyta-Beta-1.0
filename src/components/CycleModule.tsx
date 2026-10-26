import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Calendar, Check, Flower2, ChevronRight } from 'lucide-react';

export const CycleModule: React.FC = () => {
  const { language, setTab } = useApp();
  const isEn = language === 'en';

  const currentCycleDay = 12;
  const cycleLength = 28;

  // Interactive symptoms log
  const [symptoms, setSymptoms] = useState<string[]>(['energy', 'calm']);

  const toggleSymptom = (id: string) => {
    setSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const symptomList = [
    { id: 'energy', labelFr: 'Énergie haute', labelEn: 'High Energy' },
    { id: 'calm', labelFr: 'Humeur sereine', labelEn: 'Calm Mood' },
    { id: 'sleep', labelFr: 'Sommeil profond', labelEn: 'Deep Sleep' },
    { id: 'cramp', labelFr: 'Crampes légères', labelEn: 'Mild Cramps' },
  ];

  // Generate 28 days basal body temperature data
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
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
            {isEn ? 'Female Cycle & Basal Temperature' : 'Cycle & Température Basale'}
          </h3>
        </div>

        <span className="cycle-phase-badge">
          {isEn ? `Follicular Phase · D${currentCycleDay}` : `Phase Folliculaire · J${currentCycleDay}`}
        </span>
      </div>

      {/* 4 Phases Indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginTop: '2px' }}>
        <div style={{ textAlign: 'center', padding: '4px 2px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', fontSize: '10px', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'block', fontWeight: 600 }}>{isEn ? 'Menstruation' : 'Règles'}</span>
          <span style={{ fontSize: '9px', opacity: 0.7 }}>J1-5</span>
        </div>
        <div style={{ textAlign: 'center', padding: '4px 2px', borderRadius: '6px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.25)', fontSize: '10px', color: '#FFFFFF' }}>
          <span style={{ display: 'block', fontWeight: 700 }}>{isEn ? 'Follicular' : 'Folliculaire'}</span>
          <span style={{ fontSize: '9px', opacity: 0.9 }}>J6-13</span>
        </div>
        <div style={{ textAlign: 'center', padding: '4px 2px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', fontSize: '10px', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'block', fontWeight: 600 }}>{isEn ? 'Ovulation' : 'Ovulation'}</span>
          <span style={{ fontSize: '9px', opacity: 0.7 }}>J14</span>
        </div>
        <div style={{ textAlign: 'center', padding: '4px 2px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', fontSize: '10px', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'block', fontWeight: 600 }}>{isEn ? 'Luteal' : 'Lutéale'}</span>
          <span style={{ fontSize: '9px', opacity: 0.7 }}>J15-28</span>
        </div>
      </div>

      {/* 28-day Basal Temperature Curve SVG */}
      <div className="cycle-chart-wrap" style={{ marginTop: '4px' }}>
        <svg width="100%" height="80" viewBox="0 0 320 80" preserveAspectRatio="none">
          <defs>
            <linearGradient id="fertileWindow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.18)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0.02)" />
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
            stroke="rgba(255, 255, 255, 0.85)"
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
          <circle cx={ovulationPt.x} cy={ovulationPt.y} r="4" fill="#FFFFFF" />

          {/* Current day pulsing indicator */}
          <circle cx={currentPt.x} cy={currentPt.y} r="7" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6" />
          <circle cx={currentPt.x} cy={currentPt.y} r="4" fill="#FFFFFF" />
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          <span>{isEn ? 'D1 (Period)' : 'J1 (Règles)'}</span>
          <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{isEn ? 'D14 (Predicted Ovulation)' : 'J14 (Ovulation prévue)'}</span>
          <span>{isEn ? 'D28' : 'J28'}</span>
        </div>
      </div>

      {/* Meta predictions */}
      <div className="cycle-meta-grid">
        <div className="cycle-meta-item">
          <span className="cycle-meta-label">{isEn ? 'Ovulation Prediction' : "Prédiction d'Ovulation"}</span>
          <span className="cycle-meta-val" style={{ color: '#FFFFFF' }}>
            {isEn ? 'In 2 days (Sat 17)' : 'Dans 2 jours (Sam. 17)'}
          </span>
        </div>

        <div className="cycle-meta-item">
          <span className="cycle-meta-label">{isEn ? 'Current Basal Temp' : 'Température Basale Actuelle'}</span>
          <span className="cycle-meta-val">
            36,36 °C ({isEn ? 'Normal baseline' : 'Plage stable'})
          </span>
        </div>
      </div>

      {/* Symptoms Log Carnet */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {isEn ? 'Daily Symptoms Log' : 'Carnet de Symptômes du Jour'}
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {symptomList.map((sym) => {
            const isSelected = symptoms.includes(sym.id);
            return (
              <button
                key={sym.id}
                type="button"
                onClick={() => toggleSymptom(sym.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: isSelected ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.04)',
                  border: isSelected ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                  borderRadius: '999px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: isSelected ? 600 : 500,
                  transition: 'all 160ms ease',
                }}
              >
                {isSelected && <Check size={11} />}
                <span>{isEn ? sym.labelEn : sym.labelFr}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Button to open dedicated Cycle Screen */}
      <button
        type="button"
        onClick={() => setTab('cycle')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '8px 12px',
          color: '#FFFFFF',
          fontSize: '11.5px',
          fontWeight: 600,
          cursor: 'pointer',
          marginTop: '2px',
          transition: 'all 160ms ease',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Flower2 size={14} color="#FF6482" />
          <span>{isEn ? 'Open Full Cycle & Hormones Tab' : 'Ouvrir l’onglet Cycle & Hormones'}</span>
        </span>
        <ChevronRight size={14} color="var(--text-secondary)" />
      </button>
    </div>
  );
};
