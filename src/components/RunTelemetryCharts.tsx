import React, { useState, useMemo } from 'react';
import { Navigation, Gauge, Heart } from 'lucide-react';
import { fmtClockSec } from '../lib/format';
import { useApp } from '../context/AppContext';

export interface TelemetryPoint {
  timeSec: number;
  distanceKm: number;
  speedKmh: number;
  hrBpm: number;
}

export interface RunTelemetryChartsProps {
  runState: 'idle' | 'running' | 'paused' | 'finished';
  runDurationSec: number;
  runDistanceKm: number;
  liveSpeedKmh: number;
  liveHr: number;
  telemetryHistory: TelemetryPoint[];
}

export type MetricType = 'distance' | 'speed' | 'bpm';

// Interpolation d'un chemin lisse Catmull-Rom vers Bezier
function getSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function getSmoothArea(points: { x: number; y: number }[], bottomY: number): string {
  if (points.length < 2) return '';
  const path = getSmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${path} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
}

export const RunTelemetryCharts: React.FC<RunTelemetryChartsProps> = ({
  runState,
  runDurationSec,
  runDistanceKm,
  liveSpeedKmh,
  liveHr,
  telemetryHistory,
}) => {
  const { isLiveHrActive, toggleLiveHr } = useApp();
  const [activeMetric, setActiveMetric] = useState<MetricType>('distance');
  const [scrubRatio, setScrubRatio] = useState<number | null>(null);

  const isIdle = runState === 'idle';
  const isLive = runState === 'running' || runState === 'paused';

  // Dimensions graphiques SVG
  const svgWidth = 330;
  const svgHeight = 145;
  const paddingLeft = 38;
  const paddingRight = 14;
  const paddingTop = 16;
  const paddingBottom = 26;

  const chartX = paddingLeft;
  const chartY = paddingTop;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;
  const bottomY = chartY + chartHeight;

  // Calcul du domaine temporel X (horizontal) : démarre à 00:00
  const maxTimeSec = useMemo(() => {
    if (runDurationSec <= 0) return 600; // 10 min de base à l'arrêt
    if (runDurationSec < 300) return 300; // 5 min
    if (runDurationSec < 600) return 600; // 10 min
    if (runDurationSec < 1200) return 1200; // 20 min
    if (runDurationSec < 1800) return 1800; // 30 min
    if (runDurationSec < 2512) return 2512; // 42 min
    return Math.ceil(runDurationSec / 300) * 300;
  }, [runDurationSec]);

  const getX = (tSec: number) => {
    const ratio = Math.max(0, Math.min(1, tSec / maxTimeSec));
    return chartX + ratio * chartWidth;
  };

  // 1. DOMAINE DISTANCE (en km)
  const maxDistanceKm = useMemo(() => {
    if (runDistanceKm <= 0) return 5.0; // Échelle de base 5 km à l'arrêt
    if (runDistanceKm <= 1.0) return 1.0;
    if (runDistanceKm <= 3.0) return 3.0;
    if (runDistanceKm <= 5.0) return 5.0;
    if (runDistanceKm <= 8.5) return 8.5;
    return Math.ceil(runDistanceKm * 1.15);
  }, [runDistanceKm]);

  const getYDistance = (dist: number) => {
    const clamped = Math.max(0, Math.min(maxDistanceKm, dist));
    return chartY + chartHeight - (clamped / maxDistanceKm) * chartHeight;
  };

  // 2. DOMAINE VITESSE (en km/h)
  const maxSpeedKmh = 20; // 0 à 20 km/h
  const getYVitesse = (spd: number) => {
    const clamped = Math.max(0, Math.min(maxSpeedKmh, spd));
    return chartY + chartHeight - (clamped / maxSpeedKmh) * chartHeight;
  };

  // 3. DOMAINE BPM (Cardio)
  const minBpm = 60;
  const maxBpm = 190;
  const bpmRange = maxBpm - minBpm;
  const getYBpm = (bpm: number) => {
    if (bpm <= 0) return bottomY;
    const clamped = Math.max(minBpm, Math.min(maxBpm, bpm));
    return chartY + chartHeight - ((clamped - minBpm) / bpmRange) * chartHeight;
  };

  // Points télémetriques projetés
  // À l'arrêt (idle) avec 0 sec : aucune donnée factice (tableau vide)
  const pointsDistance = useMemo(() => {
    if (isIdle || telemetryHistory.length === 0) return [];
    return telemetryHistory.map((pt) => ({
      x: getX(pt.timeSec),
      y: getYDistance(pt.distanceKm),
      raw: pt,
    }));
  }, [isIdle, telemetryHistory, chartWidth, chartHeight, maxTimeSec, maxDistanceKm]);

  const pointsVitesse = useMemo(() => {
    if (isIdle || telemetryHistory.length === 0) return [];

    // Filtre passe-bas gaussien/triangulaire [0.15, 0.7, 0.15]
    // Élimine les micro-variations de quantification GPS pour une courbe fluide de type Apple Fitness
    const smoothedSpeeds = telemetryHistory.map((pt, i, arr) => {
      if (arr.length < 3 || i === 0 || i === arr.length - 1) return pt.speedKmh;
      const prev = arr[i - 1].speedKmh;
      const curr = pt.speedKmh;
      const next = arr[i + 1].speedKmh;
      if (curr === 0 && prev === 0) return 0;
      return Math.round((prev * 0.15 + curr * 0.7 + next * 0.15) * 10) / 10;
    });

    return telemetryHistory.map((pt, idx) => ({
      x: getX(pt.timeSec),
      y: getYVitesse(smoothedSpeeds[idx]),
      raw: pt,
    }));
  }, [isIdle, telemetryHistory, chartWidth, chartHeight, maxTimeSec]);

  const pointsBpm = useMemo(() => {
    if (isIdle || telemetryHistory.length === 0) return [];

    const smoothedHr = telemetryHistory.map((pt, i, arr) => {
      if (arr.length < 3 || i === 0 || i === arr.length - 1 || pt.hrBpm <= 0) return pt.hrBpm;
      const prev = arr[i - 1].hrBpm > 0 ? arr[i - 1].hrBpm : pt.hrBpm;
      const curr = pt.hrBpm;
      const next = arr[i + 1].hrBpm > 0 ? arr[i + 1].hrBpm : pt.hrBpm;
      return Math.round(prev * 0.2 + curr * 0.6 + next * 0.2);
    });

    return telemetryHistory.map((pt, idx) => ({
      x: getX(pt.timeSec),
      y: getYBpm(smoothedHr[idx]),
      raw: pt,
    }));
  }, [isIdle, telemetryHistory, chartWidth, chartHeight, maxTimeSec]);

  // Tracés SVG
  const pathDistance = useMemo(() => getSmoothPath(pointsDistance), [pointsDistance]);
  const areaDistance = useMemo(() => getSmoothArea(pointsDistance, bottomY), [pointsDistance, bottomY]);

  const pathVitesse = useMemo(() => getSmoothPath(pointsVitesse), [pointsVitesse]);
  const areaVitesse = useMemo(() => getSmoothArea(pointsVitesse, bottomY), [pointsVitesse, bottomY]);

  const pathBpm = useMemo(() => getSmoothPath(pointsBpm), [pointsBpm]);
  const areaBpm = useMemo(() => getSmoothArea(pointsBpm, bottomY), [pointsBpm, bottomY]);

  // Tête active de chaque courbe
  const headDist = pointsDistance.length > 0 ? pointsDistance[pointsDistance.length - 1] : null;
  const headSpd = pointsVitesse.length > 0 ? pointsVitesse[pointsVitesse.length - 1] : null;
  const headBpm = pointsBpm.length > 0 ? pointsBpm[pointsBpm.length - 1] : null;

  // Graduations Axe horizontal du Temps (X)
  const timeTicks = useMemo(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const sec = Math.round((i / steps) * maxTimeSec);
      return { sec, label: fmtClockSec(sec) };
    });
  }, [maxTimeSec]);

  // Graduations Axe vertical (Y) selon métrique active
  const distanceTicks = [
    { val: maxDistanceKm, label: `${maxDistanceKm.toFixed(1)}k` },
    { val: maxDistanceKm * 0.66, label: `${(maxDistanceKm * 0.66).toFixed(1)}k` },
    { val: maxDistanceKm * 0.33, label: `${(maxDistanceKm * 0.33).toFixed(1)}k` },
    { val: 0, label: '0 km' },
  ];

  const speedTicks = [
    { val: 20, label: '20' },
    { val: 15, label: '15' },
    { val: 10, label: '10' },
    { val: 5, label: '5' },
    { val: 0, label: '0' },
  ];

  const bpmTicks = [
    { val: 180, label: '180' },
    { val: 150, label: '150' },
    { val: 120, label: '120' },
    { val: 90, label: '90' },
    { val: 60, label: '60' },
  ];

  // Moyennes télémetriques pour le trait moyen
  const avgSpeed = useMemo(() => {
    if (telemetryHistory.length === 0) return liveSpeedKmh > 0 ? liveSpeedKmh : 0;
    const movingPoints = telemetryHistory.filter((p) => p.speedKmh >= 0.8);
    if (movingPoints.length === 0) return liveSpeedKmh > 0 ? liveSpeedKmh : 0;
    const sum = movingPoints.reduce((s, p) => s + p.speedKmh, 0);
    return Math.round((sum / movingPoints.length) * 10) / 10;
  }, [telemetryHistory, liveSpeedKmh]);

  const avgBpm = useMemo(() => {
    if (telemetryHistory.length === 0) return liveHr > 0 ? liveHr : 0;
    const validHrPoints = telemetryHistory.filter((p) => p.hrBpm > 40);
    if (validHrPoints.length === 0) return liveHr > 0 ? liveHr : 0;
    return Math.round(validHrPoints.reduce((s, p) => s + p.hrBpm, 0) / validHrPoints.length);
  }, [telemetryHistory, liveHr]);

  // Scrub tactile interactif (100% fluide, ne bloque jamais le défilement vertical mobile)
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (telemetryHistory.length === 0) return;
    if (e.pointerType === 'touch') return; // Préserve le scroll vertical natif iOS
    const rect = e.currentTarget.getBoundingClientRect();
    const touchX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (touchX - paddingLeft) / chartWidth));
    setScrubRatio(ratio);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (telemetryHistory.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touchX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (touchX - paddingLeft) / chartWidth));
    setScrubRatio(ratio);
  };

  const handlePointerLeave = () => {
    setScrubRatio(null);
  };

  // Données de scrub actuel
  const scrubSample = useMemo(() => {
    if (scrubRatio === null || telemetryHistory.length === 0) return null;
    const targetSec = scrubRatio * maxTimeSec;
    // Trouve l'échantillon le plus proche
    let closest = telemetryHistory[0];
    let minDiff = Infinity;
    telemetryHistory.forEach((pt) => {
      const diff = Math.abs(pt.timeSec - targetSec);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pt;
      }
    });
    return closest;
  }, [scrubRatio, telemetryHistory, maxTimeSec]);

  return (
    <div
      id="cardio-curve-section"
      className="glass-panel"
      style={{
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        borderRadius: '18px',
        background: 'rgba(20, 20, 24, 0.76)',
        border: '1px solid var(--border-subtle)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Halo d'ambiance selon la métrique active */}
      <div
        style={{
          position: 'absolute',
          top: '-35px',
          right: '-25px',
          width: '180px',
          height: '160px',
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, rgba(0, 0, 0, 0) 70%)',
          pointerEvents: 'none',
          borderRadius: '50%',
          transition: 'all 300ms ease',
        }}
      />

      {/* En-tête : Titre & Sélecteur des 3 courbes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>
              {activeMetric === 'distance' && 'Distance parcourue'}
              {activeMetric === 'speed' && 'Vitesse (km/h)'}
              {activeMetric === 'bpm' && 'Fréquence Cardiaque (BPM)'}
            </span>
          </div>

          {/* Badge valeur temps réel */}
          <div style={{ textAlign: 'right' }}>
            {activeMetric === 'distance' && (
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {isIdle ? '0.00' : runDistanceKm.toFixed(2)}{' '}
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>km</span>
              </span>
            )}
            {activeMetric === 'speed' && (
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {isIdle ? '0.0' : liveSpeedKmh.toFixed(1)}{' '}
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>km/h</span>
              </span>
            )}
            {activeMetric === 'bpm' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={toggleLiveHr}
                  style={{
                    background: isLiveHrActive ? 'rgba(255, 59, 48, 0.22)' : 'rgba(255, 255, 255, 0.08)',
                    border: isLiveHrActive ? '1px solid rgba(255, 59, 48, 0.6)' : '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    padding: '3px 8px',
                    color: isLiveHrActive ? '#FF453A' : '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 200ms ease',
                  }}
                  title={isLiveHrActive ? "Désactiver la mesure continue" : "Activer la mesure continue du rythme cardiaque"}
                >
                  <Heart size={11} fill={isLiveHrActive ? '#FF453A' : 'none'} color={isLiveHrActive ? '#FF453A' : '#FFF'} />
                  <span>{isLiveHrActive ? 'Actif' : 'Activer'}</span>
                </button>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {isIdle ? '0' : (liveHr > 40 ? liveHr : '--')}{' '}
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>bpm</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Sélecteur segmented 3 courbes */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '4px',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveMetric('distance')}
            style={{
              padding: '6px 4px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '7px',
              border: 'none',
              background: activeMetric === 'distance' ? '#FFFFFF' : 'transparent',
              color: activeMetric === 'distance' ? '#000000' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 160ms ease',
            }}
          >
            <Navigation size={11} />
            <span>Distance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMetric('speed')}
            style={{
              padding: '6px 4px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '7px',
              border: 'none',
              background: activeMetric === 'speed' ? '#FFFFFF' : 'transparent',
              color: activeMetric === 'speed' ? '#000000' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 160ms ease',
            }}
          >
            <Gauge size={11} />
            <span>Vitesse</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMetric('bpm')}
            style={{
              padding: '6px 4px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '7px',
              border: 'none',
              background: activeMetric === 'bpm' ? '#FFFFFF' : 'transparent',
              color: activeMetric === 'bpm' ? '#000000' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 160ms ease',
            }}
          >
            <Heart size={11} />
            <span>BPM</span>
          </button>
        </div>
      </div>

      {/* Graphique SVG dynamique avec Axe horizontal Temps & Axe vertical Distance/Vitesse/BPM */}
      <div style={{ width: '100%', position: 'relative', touchAction: 'pan-y' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            overflow: 'visible',
            touchAction: 'pan-y',
          }}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            {/* Dégradés Remplissages Monochrome */}
            <linearGradient id="distFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="spdFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#D1D1D6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#D1D1D6" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="bpmFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FF453A" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#FF453A" stopOpacity="0.0" />
            </linearGradient>

            {/* Filtre Lueur */}
            <filter id="telemetryGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Vertical Y-Axis Unit Header */}
          <text
            x={chartX - 6}
            y={chartY - 6}
            textAnchor="end"
            fill="rgba(255, 255, 255, 0.7)"
            fontSize="9"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            letterSpacing="0.04em"
          >
            {activeMetric === 'distance' ? 'KM' : activeMetric === 'speed' ? 'KM/H' : 'BPM'}
          </text>

          {/* Lignes de repère horizontales (Y) */}
          {(activeMetric === 'distance' ? distanceTicks : activeMetric === 'speed' ? speedTicks : bpmTicks).map(
            (tick) => {
              const y =
                activeMetric === 'distance'
                  ? getYDistance(tick.val)
                  : activeMetric === 'speed'
                  ? getYVitesse(tick.val)
                  : getYBpm(tick.val);
              return (
                <g key={tick.label}>
                  <line
                    x1={chartX}
                    y1={y}
                    x2={chartX + chartWidth}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeDasharray="3 4"
                    strokeWidth="1"
                  />
                  <text
                    x={chartX - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill="rgba(255, 255, 255, 0.45)"
                    fontSize="9.5"
                    fontFamily="var(--font-mono)"
                    fontWeight="500"
                  >
                    {tick.label}
                  </text>
                </g>
              );
            }
          )}

          {/* Trait Moyen (Vitesse ou BPM moyen : ligne grise en pointillés sans texte) */}
          {activeMetric === 'speed' && avgSpeed > 0 && (
            <line
              x1={chartX}
              y1={getYVitesse(avgSpeed)}
              x2={chartX + chartWidth}
              y2={getYVitesse(avgSpeed)}
              stroke="rgba(255, 255, 255, 0.32)"
              strokeDasharray="4 3"
              strokeWidth="1.2"
            />
          )}

          {activeMetric === 'bpm' && avgBpm > 0 && (
            <line
              x1={chartX}
              y1={getYBpm(avgBpm)}
              x2={chartX + chartWidth}
              y2={getYBpm(avgBpm)}
              stroke="rgba(255, 255, 255, 0.32)"
              strokeDasharray="4 3"
              strokeWidth="1.2"
            />
          )}

          {/* Lignes de repère verticales du temps (X horizontal) : démarre à 00:00 */}
          {timeTicks.map((tick) => {
            const x = getX(tick.sec);
            return (
              <g key={tick.sec}>
                <line
                  x1={x}
                  y1={chartY}
                  x2={x}
                  y2={bottomY}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeDasharray="2 4"
                  strokeWidth="0.8"
                />
                <text
                  x={x}
                  y={bottomY + 16}
                  textAnchor={tick.sec === 0 ? 'start' : tick.sec === maxTimeSec ? 'end' : 'middle'}
                  fill="rgba(255, 255, 255, 0.55)"
                  fontSize="9.5"
                  fontFamily="var(--font-mono)"
                  fontWeight="500"
                >
                  {tick.label}
                </text>
              </g>
            );
          })}

          {/* Axe horizontal de base à 0 */}
          <line
            x1={chartX}
            y1={bottomY}
            x2={chartX + chartWidth}
            y2={bottomY}
            stroke="rgba(255, 255, 255, 0.16)"
            strokeWidth="1"
          />

          {/* ================= 1. COURBE DE DISTANCE ================= */}
          {activeMetric === 'distance' && pathDistance && (
            <g>
              {areaDistance && <path d={areaDistance} fill="url(#distFill)" />}
              <path
                d={pathDistance}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#telemetryGlow)"
              />
              {headDist && (
                <circle cx={headDist.x} cy={headDist.y} r="3.8" fill="#000000" stroke="#FFFFFF" strokeWidth="2" />
              )}
            </g>
          )}

          {/* ================= 2. COURBE DE VITESSE ================= */}
          {activeMetric === 'speed' && pathVitesse && (
            <g>
              {areaVitesse && <path d={areaVitesse} fill="url(#spdFill)" />}
              <path
                d={pathVitesse}
                fill="none"
                stroke="#D1D1D6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#telemetryGlow)"
              />
              {headSpd && (
                <circle cx={headSpd.x} cy={headSpd.y} r="3.8" fill="#000000" stroke="#D1D1D6" strokeWidth="2" />
              )}
            </g>
          )}

          {/* ================= 3. COURBE CARDIAQUE (BPM) ================= */}
          {activeMetric === 'bpm' && pathBpm && (
            <g>
              {areaBpm && <path d={areaBpm} fill="url(#bpmFill)" />}
              <path
                d={pathBpm}
                fill="none"
                stroke="#FF453A"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#telemetryGlow)"
              />
              {headBpm && (
                <circle cx={headBpm.x} cy={headBpm.y} r="3.8" fill="#000000" stroke="#FF453A" strokeWidth="2" />
              )}
            </g>
          )}

          {/* Bouton d'action central si le cardio n'est pas encore actif */}
          {activeMetric === 'bpm' && !isLiveHrActive && (!telemetryHistory || telemetryHistory.every((p) => p.hrBpm <= 40)) && (
            <g
              onClick={toggleLiveHr}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={chartX + chartWidth / 2 - 95}
                y={chartY + chartHeight / 2 - 16}
                width={190}
                height={32}
                rx={16}
                fill="rgba(24, 24, 27, 0.88)"
                stroke="rgba(255, 59, 48, 0.55)"
                strokeWidth={1.2}
              />
              <text
                x={chartX + chartWidth / 2}
                y={chartY + chartHeight / 2 + 5}
                textAnchor="middle"
                fill="#FF453A"
                fontSize="11.5"
                fontWeight="700"
              >
                ❤️ Activer le cardio live
              </text>
            </g>
          )}

          {/* Scrub interactif au toucher / survol */}
          {scrubSample && (
            <g>
              <line
                x1={getX(scrubSample.timeSec)}
                y1={chartY}
                x2={getX(scrubSample.timeSec)}
                y2={bottomY}
                stroke="#FFFFFF"
                strokeWidth="1.2"
                strokeDasharray="2 2"
              />
              {activeMetric === 'distance' && (
                <circle
                  cx={getX(scrubSample.timeSec)}
                  cy={getYDistance(scrubSample.distanceKm)}
                  r="4.5"
                  fill="#000000"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
              )}
              {activeMetric === 'speed' && (
                <circle
                  cx={getX(scrubSample.timeSec)}
                  cy={getYVitesse(scrubSample.speedKmh)}
                  r="4.5"
                  fill="#000000"
                  stroke="#D1D1D6"
                  strokeWidth="2"
                />
              )}
              {activeMetric === 'bpm' && (
                <circle
                  cx={getX(scrubSample.timeSec)}
                  cy={getYBpm(scrubSample.hrBpm)}
                  r="4.5"
                  fill="#000000"
                  stroke="#8E8E93"
                  strokeWidth="2"
                />
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Légende horizontale & Axe explicatif */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          paddingTop: '6px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          fontSize: '11px',
        }}
      >
        {scrubSample ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              ⏱ {fmtClockSec(scrubSample.timeSec)}
            </span>
            {activeMetric === 'distance' && (
              <span style={{ fontWeight: 700, color: '#FFFFFF' }}>
                Distance : {scrubSample.distanceKm.toFixed(2)} km
              </span>
            )}
            {activeMetric === 'speed' && (
              <span style={{ fontWeight: 700, color: '#D1D1D6' }}>
                Vitesse : {scrubSample.speedKmh.toFixed(1)} km/h
              </span>
            )}
            {activeMetric === 'bpm' && (
              <span style={{ fontWeight: 700, color: '#8E8E93' }}>
                Cardio : {scrubSample.hrBpm} bpm
              </span>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#FFFFFF',
                  }}
                />
                <span style={{ color: activeMetric === 'distance' ? '#fff' : 'var(--text-secondary)' }}>
                  Distance (km)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#D1D1D6',
                  }}
                />
                <span style={{ color: activeMetric === 'speed' ? '#fff' : 'var(--text-secondary)' }}>
                  Vitesse (km/h)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#8E8E93',
                  }}
                />
                <span style={{ color: activeMetric === 'bpm' ? '#fff' : 'var(--text-secondary)' }}>
                  BPM
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
