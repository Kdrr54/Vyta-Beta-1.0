import React from 'react';
import { useApp } from '../context/AppContext';
import { weekMetrics, WEEK, statusFor } from '../data/health';
import { WeekSelector } from './WeekSelector';
import { RingImage } from './RingImage';
import { BodyEnergyGauge } from './BodyEnergyGauge';
import { ImmunityRadar } from './ImmunityRadar';
import { CycleModule } from './CycleModule';
import { SleepPhases } from './SleepPhases';
import { CardioAge } from './CardioAge';
import { Heart, Activity, Thermometer, Droplets, Footprints, Route, Flame, Sparkles, ChevronRight } from 'lucide-react';
import { fmtNum, signed } from '../lib/format';

export const HealthScreen: React.FC = () => {
  const { selectedDay, liveBpm, profile, openModal, openMetricDetail } = useApp();

  const dayData = weekMetrics[selectedDay] || weekMetrics[3];
  const dayInfo = WEEK[selectedDay] || WEEK[3];
  const isFemale = profile.sex === 'femme';

  return (
    <div className="screen-content">
      {/* Screen Title & Subtitle */}
      <div style={{ paddingTop: '10px' }}>
        <span className="header-subtitle">
          {dayInfo.long.toUpperCase()} {dayInfo.date} OCTOBRE
        </span>
        <h1 className="header-title">
          {selectedDay === 3 ? "Aujourd'hui" : selectedDay === 2 ? 'Hier' : dayInfo.long}
        </h1>
      </div>

      {/* 1. Horizontal Week Selector (7 Days L M M J V S D) */}
      <WeekSelector />

      {/* 2. Hero Vitality Score Card (91/100) with Technical Ring Render */}
      <div className="vitality-hero-card">
        <div className="vitality-hero-top">
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Score de Vitalité
            </span>
            <div className="vitality-score-large">
              <span className="score-number">{dayData.score}</span>
              <span className="score-total">/ 100</span>
            </div>
          </div>

          <div className="apple-status-badge">
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FFFFFF' }} />
            <span>{statusFor(dayData.score)}</span>
          </div>
        </div>

        {/* Technical Internal Sensor View of Vyta One */}
        <div
          className="hero-ring-stage"
          onClick={() => openModal('settings')}
          title="Modifier la finition ou voir les capteurs"
        >
          <RingImage size={160} />
        </div>

        {/* 3 Contributing Pillars */}
        <div className="vitality-pillars">
          <div className="pillar-item">
            <div className="pillar-top">
              <span className="pillar-label">Sommeil</span>
              <span className="pillar-val">{dayData.pillars.sleep}%</span>
            </div>
            <div className="pillar-bar">
              <div className="pillar-fill" style={{ width: `${dayData.pillars.sleep}%`, background: '#FFFFFF' }} />
            </div>
          </div>

          <div className="pillar-item">
            <div className="pillar-top">
              <span className="pillar-label">Récup. VRC</span>
              <span className="pillar-val">{dayData.pillars.recovery}%</span>
            </div>
            <div className="pillar-bar">
              <div className="pillar-fill" style={{ width: `${dayData.pillars.recovery}%`, background: '#D1D1D6' }} />
            </div>
          </div>

          <div className="pillar-item">
            <div className="pillar-top">
              <span className="pillar-label">Activité</span>
              <span className="pillar-val">{dayData.pillars.activity}%</span>
            </div>
            <div className="pillar-bar">
              <div className="pillar-fill" style={{ width: `${dayData.pillars.activity}%`, background: '#8E8E93' }} />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Raw Activity Counters (Pas 8 420, Distance 6,2 km, Calories actives 480 kcal) */}
      <div className="activity-raw-card">
        <div className="activity-raw-item">
          <span className="activity-raw-label">
            <Footprints size={12} />
            <span>Pas</span>
          </span>
          <div>
            <span className="activity-raw-val">{fmtNum(dayData.steps)}</span>
          </div>
        </div>

        <div className="activity-raw-item">
          <span className="activity-raw-label">
            <Route size={12} />
            <span>Distance</span>
          </span>
          <div>
            <span className="activity-raw-val">{fmtNum(dayData.distanceKm, 1)}</span>
            <span className="activity-raw-unit">km</span>
          </div>
        </div>

        <div className="activity-raw-item">
          <span className="activity-raw-label">
            <Flame size={12} />
            <span>Calories</span>
          </span>
          <div>
            <span className="activity-raw-val">{dayData.activeKcal}</span>
            <span className="activity-raw-unit">kcal</span>
          </div>
        </div>
      </div>

      {/* 4. Body Energy Gauge (between scores and sensors) */}
      <BodyEnergyGauge
        energy={dayData.bodyEnergy}
        wake={dayData.bodyEnergyWake}
        bedtime={dayData.bodyEnergyBedtime}
      />

      {/* 5. Four Biometric Sensor Cards (BPM, VRC, Température, SpO2) */}
      <div className="metrics-grid-2">
        {/* Heart Rate */}
        <div
          className="metric-card clickable"
          onClick={() => openMetricDetail('bpm')}
          role="button"
          tabIndex={0}
          title="Ouvrir le suivi détaillé 24h de la Fréquence Cardiaque"
        >
          <div className="metric-card-header">
            <div className="metric-icon-wrap">
              <Heart size={15} color="#FF3B30" fill="#FF3B30" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="metric-tag">Direct</span>
              <ChevronRight size={13} className="metric-card-chevron" />
            </div>
          </div>

          <div className="metric-data">
            <div className="metric-number-unit">
              <span className="metric-large">{liveBpm}</span>
              <span className="metric-unit">BPM</span>
            </div>
            <span className="metric-title">Fréquence Cardiaque</span>
            <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
              Repos : {dayData.restingBpm} bpm · 24h
            </span>
          </div>
        </div>

        {/* HRV Card */}
        <div
          className="metric-card clickable"
          onClick={() => openMetricDetail('hrv')}
          role="button"
          tabIndex={0}
          title="Ouvrir le suivi détaillé 24h de la VRC"
        >
          <div className="metric-card-header">
            <div className="metric-icon-wrap">
              <Activity size={15} color="#30D158" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="metric-tag">+8 ms</span>
              <ChevronRight size={13} className="metric-card-chevron" />
            </div>
          </div>

          <div className="metric-data">
            <div className="metric-number-unit">
              <span className="metric-large">{dayData.hrv}</span>
              <span className="metric-unit">ms</span>
            </div>
            <span className="metric-title">VRC (RMSSD)</span>
            <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
              Base : {dayData.hrvBaseline} ms · 24h
            </span>
          </div>
        </div>

        {/* Skin Temperature Card */}
        <div
          className="metric-card clickable"
          onClick={() => openMetricDetail('temp')}
          role="button"
          tabIndex={0}
          title="Ouvrir le suivi détaillé 24h de la Température Cutanée"
        >
          <div className="metric-card-header">
            <div className="metric-icon-wrap">
              <Thermometer size={15} color="#FF9F0A" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="metric-tag">Stable</span>
              <ChevronRight size={13} className="metric-card-chevron" />
            </div>
          </div>

          <div className="metric-data">
            <div className="metric-number-unit">
              <span className="metric-large">{signed(dayData.tempDelta, 2)}</span>
              <span className="metric-unit">°C</span>
            </div>
            <span className="metric-title">Température Cutanée</span>
            <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
              Écart basal · 24h
            </span>
          </div>
        </div>

        {/* SpO2 Card */}
        <div
          className="metric-card clickable"
          onClick={() => openMetricDetail('spo2')}
          role="button"
          tabIndex={0}
          title="Ouvrir le suivi détaillé 24h de l'Oxygénation SpO2"
        >
          <div className="metric-card-header">
            <div className="metric-icon-wrap">
              <Droplets size={15} color="#0A84FF" fill="#0A84FF" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="metric-tag">Normal</span>
              <ChevronRight size={13} className="metric-card-chevron" />
            </div>
          </div>

          <div className="metric-data">
            <div className="metric-number-unit">
              <span className="metric-large">{dayData.spo2}</span>
              <span className="metric-unit">%</span>
            </div>
            <span className="metric-title">Oxygénation SpO2</span>
            <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
              Capteurs R21 · 24h
            </span>
          </div>
        </div>
      </div>

      {/* 6. Immunity Radar (Hook Card) */}
      <ImmunityRadar anomaly={dayData.anomaly} />

      {/* 7. Female Cycle & Basal Temp Module (Shown ONLY if profile.sex === 'femme') */}
      {isFemale && <CycleModule />}

      {/* 8. Advanced Health Modules: Sleep Phases & Cardio Age */}
      <SleepPhases sleep={dayData.sleep} />

      <CardioAge score={dayData.score} />
    </div>
  );
};
