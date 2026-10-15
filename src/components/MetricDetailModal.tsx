import React, { useState } from 'react';
import { METRIC_DETAILS_24H, Metric24hDetail, HourlyMetricPoint } from '../data/metric24h';
import {
  ChevronLeft,
  X,
  Heart,
  Activity,
  Thermometer,
  Droplets,
  Sparkles,
  Clock,
  Moon,
  Sun,
  Zap,
  TrendingDown,
  TrendingUp,
  Info,
} from 'lucide-react';

interface MetricDetailModalProps {
  metricId: 'bpm' | 'hrv' | 'temp' | 'spo2';
  onClose: () => void;
}

export const MetricDetailModal: React.FC<MetricDetailModalProps> = ({ metricId, onClose }) => {
  const detail: Metric24hDetail = METRIC_DETAILS_24H[metricId];
  const [period, setPeriod] = useState<'24h' | '7j' | '30j'>('24h');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Default active point is the latest / current (or hovered)
  const activePoint: HourlyMetricPoint =
    hoverIndex !== null ? detail.hourly[hoverIndex] : detail.hourly[detail.hourly.length - 2]; // 22h / current

  // Chart coordinate calculations
  const chartHeight = 150;
  const chartWidth = 330;
  const paddingX = 15;
  const paddingY = 22;

  const yMin = detail.minVal;
  const yMax = detail.maxVal;
  const yRange = yMax - yMin || 1;

  const getX = (index: number) => {
    return paddingX + (index / (detail.hourly.length - 1)) * (chartWidth - paddingX * 2);
  };

  const getY = (val: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, val));
    const ratio = (clamped - yMin) / yRange;
    return chartHeight - paddingY - ratio * (chartHeight - paddingY * 2);
  };

  // Build SVG path
  const points = detail.hourly.map((pt, i) => `${getX(i)},${getY(pt.value)}`);
  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${getX(detail.hourly.length - 1)},${chartHeight - 8} L ${getX(0)},${chartHeight - 8} Z`;

  const getIcon = () => {
    switch (detail.iconName) {
      case 'heart':
        return <Heart size={16} color={detail.accentColor} fill={detail.accentColor} />;
      case 'activity':
        return <Activity size={16} color={detail.accentColor} />;
      case 'thermometer':
        return <Thermometer size={16} color={detail.accentColor} />;
      case 'droplets':
        return <Droplets size={16} color={detail.accentColor} fill={detail.accentColor} />;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="metric-detail-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Grabber bar */}
        <div className="metric-sheet-grabber" />

        {/* Header with Back button and close */}
        <div className="metric-detail-header">
          <button
            type="button"
            className="metric-back-btn"
            onClick={onClose}
            aria-label="Retour"
          >
            <ChevronLeft size={18} />
            <span>Santé</span>
          </button>

          <div className="metric-header-title-wrap">
            <span className="metric-header-sub">{detail.subtitle}</span>
            <h2 className="metric-header-title">{detail.title}</h2>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Time period switcher */}
        <div className="metric-period-tabs">
          <button
            type="button"
            className={`metric-period-pill ${period === '24h' ? 'active' : ''}`}
            onClick={() => setPeriod('24h')}
          >
            24 Heures
          </button>
          <button
            type="button"
            className={`metric-period-pill ${period === '7j' ? 'active' : ''}`}
            onClick={() => setPeriod('7j')}
          >
            7 Jours
          </button>
          <button
            type="button"
            className={`metric-period-pill ${period === '30j' ? 'active' : ''}`}
            onClick={() => setPeriod('30j')}
          >
            30 Jours
          </button>
        </div>

        {/* Hero Value Banner */}
        <div className="metric-hero-banner">
          <div className="metric-hero-top">
            <div className="metric-hero-badge">
              <span className="metric-hero-icon-chip">{getIcon()}</span>
              <span className="metric-hero-badge-tag">{detail.badge}</span>
            </div>
            <span className="metric-hero-period-label">{detail.periodText}</span>
          </div>

          <div className="metric-hero-val-row">
            <span className="metric-hero-val">
              {hoverIndex !== null
                ? activePoint.value > 0 && metricId === 'temp'
                  ? `+${activePoint.value}`
                  : activePoint.value
                : detail.currentValue}
            </span>
            <span className="metric-hero-unit">{detail.unit}</span>
            {hoverIndex !== null && (
              <span className="metric-hero-time-indicator">
                à {activePoint.hour} • {activePoint.label || 'Mesure enregistrée'}
              </span>
            )}
          </div>
        </div>

        {/* 24-HOUR INTERACTIVE CHART */}
        <div className="metric-chart-card">
          <div className="metric-chart-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={13} color="var(--text-secondary)" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>
                Évolution continue sur 24 heures
              </span>
            </div>
            <span style={{ fontSize: '10.5px', color: 'var(--gold)', fontWeight: 600 }}>
              Glisser pour explorer
            </span>
          </div>

          {/* Shaded Sleep & Workout Legends */}
          <div className="metric-chart-zones-legend">
            <div className="chart-zone-chip sleep">
              <Moon size={11} color="#64D2FF" />
              <span>00h-07h Sommeil / Nuit</span>
            </div>
            <div className="chart-zone-chip workout">
              <Zap size={11} color="#FF9F0A" />
              <span>18h-19h Séance Sport</span>
            </div>
          </div>

          {/* SVG Canvas with Scrub Interaction */}
          <div
            className="metric-svg-wrapper"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const idx = Math.min(
                detail.hourly.length - 1,
                Math.max(0, Math.round(relX * (detail.hourly.length - 1)))
              );
              setHoverIndex(idx);
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
              const idx = Math.min(
                detail.hourly.length - 1,
                Math.max(0, Math.round(relX * (detail.hourly.length - 1)))
              );
              setHoverIndex(idx);
            }}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <svg
              width="100%"
              height={chartHeight}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="none"
              className="metric-svg-chart"
            >
              <defs>
                <linearGradient id={`grad-${detail.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={detail.accentColor} stopOpacity="0.38" />
                  <stop offset="85%" stopColor={detail.accentColor} stopOpacity="0.03" />
                  <stop offset="100%" stopColor={detail.accentColor} stopOpacity="0" />
                </linearGradient>

                <linearGradient id="sleepZoneGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0A84FF" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#0A84FF" stopOpacity="0.02" />
                </linearGradient>

                <linearGradient id="workoutZoneGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FF9F0A" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#FF9F0A" stopOpacity="0.03" />
                </linearGradient>
              </defs>

              {/* Shaded Night zone background (00h to 07h -> index 0 to 7) */}
              <rect
                x={getX(0)}
                y={paddingY - 8}
                width={getX(7) - getX(0)}
                height={chartHeight - paddingY * 2 + 16}
                fill="url(#sleepZoneGrad)"
                rx="6"
              />

              {/* Shaded Workout zone background (18h to 19h -> index 18 to 20) */}
              <rect
                x={getX(18)}
                y={paddingY - 8}
                width={getX(20) - getX(18)}
                height={chartHeight - paddingY * 2 + 16}
                fill="url(#workoutZoneGrad)"
                rx="6"
              />

              {/* Gridlines */}
              <line
                x1={paddingX}
                y1={paddingY}
                x2={chartWidth - paddingX}
                y2={paddingY}
                stroke="rgba(255, 255, 255, 0.07)"
                strokeDasharray="3 3"
              />
              <line
                x1={paddingX}
                y1={chartHeight / 2}
                x2={chartWidth - paddingX}
                y2={chartHeight / 2}
                stroke="rgba(255, 255, 255, 0.07)"
                strokeDasharray="3 3"
              />
              <line
                x1={paddingX}
                y1={chartHeight - paddingY}
                x2={chartWidth - paddingX}
                y2={chartHeight - paddingY}
                stroke="rgba(255, 255, 255, 0.07)"
                strokeDasharray="3 3"
              />

              {/* Gradient Area */}
              <path d={areaPath} fill={`url(#grad-${detail.id})`} />

              {/* Smooth Stroke Line */}
              <path
                d={linePath}
                fill="none"
                stroke={detail.accentColor}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Highlight active/hovered point */}
              {hoverIndex !== null && (
                <>
                  {/* Vertical cursor guide */}
                  <line
                    x1={getX(hoverIndex)}
                    y1={paddingY - 8}
                    x2={getX(hoverIndex)}
                    y2={chartHeight - 10}
                    stroke="rgba(255, 255, 255, 0.45)"
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                  />
                  {/* Outer glow ring */}
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getY(activePoint.value)}
                    r="6.5"
                    fill={detail.accentColor}
                    fillOpacity="0.3"
                  />
                  {/* Solid center dot */}
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getY(activePoint.value)}
                    r="3.5"
                    fill="#FFFFFF"
                    stroke={detail.accentColor}
                    strokeWidth="2"
                  />
                </>
              )}
            </svg>

            {/* Time labels across the bottom */}
            <div className="metric-time-labels">
              <span>00:00</span>
              <span>04:00</span>
              <span>08:00</span>
              <span>12:00</span>
              <span>16:00</span>
              <span>20:00</span>
              <span>23:59</span>
            </div>
          </div>
        </div>

        {/* 4 KEY 24-HOUR STATS */}
        <div className="metric-stats-grid">
          {detail.stats.map((st, i) => (
            <div key={i} className="metric-stat-box">
              <span className="metric-stat-label">{st.label}</span>
              <div className="metric-stat-val-group">
                <span className="metric-stat-val">{st.value}</span>
                {st.status === 'optimal' && <span className="stat-status-dot optimal" title="Optimal" />}
              </div>
              <span className="metric-stat-sub">{st.sub}</span>
            </div>
          ))}
        </div>

        {/* CHRONOBIOLOGICAL BREAKDOWN SECTION */}
        <div className="metric-breakdown-card">
          <div className="metric-card-section-title">
            <span>{detail.breakdownTitle}</span>
          </div>

          <div className="metric-breakdown-list">
            {detail.breakdownItems.map((item, idx) => (
              <div key={idx} className="metric-breakdown-row">
                <div className="breakdown-row-top">
                  <div className="breakdown-label-group">
                    <span className="breakdown-dot" style={{ backgroundColor: item.color }} />
                    <span className="breakdown-label">{item.label}</span>
                  </div>
                  <span className="breakdown-time">{item.timeStr}</span>
                </div>

                <div className="breakdown-bar-track">
                  <div
                    className="breakdown-bar-fill"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                      boxShadow: `0 0 8px ${item.color}55`,
                    }}
                  />
                </div>

                <span className="breakdown-detail-txt">{item.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 24-HOUR KEY MOMENTS TIMELINE */}
        <div className="metric-moments-card">
          <div className="metric-card-section-title">
            <span>Moments Clés de la Journée</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Journal continu</span>
          </div>

          <div className="metric-moments-list">
            {detail.moments.map((m, i) => (
              <div key={i} className="metric-moment-item">
                <div className="moment-left-time">
                  <span className="moment-clock">{m.time}</span>
                  <div className="moment-line-dot" />
                </div>

                <div className="moment-content">
                  <div className="moment-title-row">
                    <span className="moment-title">{m.title}</span>
                    <span className="moment-val-chip">{m.value}</span>
                  </div>
                  <span className="moment-tag">{m.tag}</span>
                  <p className="moment-desc">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COVYTA IA MEDICAL & COACHING INSIGHT */}
        <div className="metric-covyta-insight-card">
          <div className="covyta-insight-header">
            <div className="covyta-sparkle-icon">
              <Sparkles size={16} color="var(--gold)" />
            </div>
            <div>
              <span className="covyta-insight-tag">Analyse CoVyta IA 24h</span>
              <h4 className="covyta-insight-title">{detail.aiInsight.title}</h4>
            </div>
          </div>

          <p className="covyta-insight-p">{detail.aiInsight.summary}</p>

          <div className="covyta-insight-rec-box">
            <span className="rec-box-label">Conseil Personnalisé</span>
            <p className="rec-box-txt">{detail.aiInsight.recommendation}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
