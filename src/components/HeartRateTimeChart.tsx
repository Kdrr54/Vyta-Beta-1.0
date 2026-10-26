import React, { useState, useMemo } from 'react';
import { Heart, Activity } from 'lucide-react';
import { fmtClockSec } from '../lib/format';

export interface HeartRateTimeChartProps {
  runState: 'idle' | 'running' | 'paused' | 'finished';
  runDurationSec: number;
  liveHr: number;
  avgHr?: number;
  maxHr?: number;
}

// Données télémetriques de référence sur les 2512 secondes (~41m52s) de la course
const HR_REFERENCE_SAMPLES: { timeSec: number; hr: number }[] = [
  { timeSec: 0, hr: 114 },
  { timeSec: 120, hr: 118 },
  { timeSec: 240, hr: 126 },
  { timeSec: 380, hr: 133 },
  { timeSec: 520, hr: 139 },
  { timeSec: 600, hr: 142 }, // 10 min
  { timeSec: 780, hr: 145 },
  { timeSec: 960, hr: 149 },
  { timeSec: 1120, hr: 152 },
  { timeSec: 1200, hr: 154 }, // 20 min
  { timeSec: 1360, hr: 156 },
  { timeSec: 1500, hr: 153 }, // descente
  { timeSec: 1680, hr: 158 },
  { timeSec: 1800, hr: 163 }, // 30 min (montée)
  { timeSec: 1960, hr: 167 },
  { timeSec: 2120, hr: 165 },
  { timeSec: 2260, hr: 172 }, // accélération km 7
  { timeSec: 2380, hr: 178 }, // sprint km 8 - PR
  { timeSec: 2460, hr: 174 },
  { timeSec: 2512, hr: 165 }, // fin
];

const TOTAL_RUN_DURATION = 2512; // 41:52

// Calcul de zone selon le BPM
function getZoneLabel(bpm: number): { zone: string; name: string; color: string } {
  if (bpm < 114) return { zone: 'Z1', name: 'Récupération', color: '#8E8E93' };
  if (bpm < 133) return { zone: 'Z2', name: 'Endurance', color: '#30D158' };
  if (bpm < 152) return { zone: 'Z3', name: 'Tempo', color: '#FFD60A' };
  if (bpm < 171) return { zone: 'Z4', name: 'Seuil', color: '#FF9F0A' };
  return { zone: 'Z5', name: 'Maximal', color: '#FF453A' };
}

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

export const HeartRateTimeChart: React.FC<HeartRateTimeChartProps> = ({
  runState,
  runDurationSec,
  liveHr,
  avgHr = 156,
  maxHr = 178,
}) => {
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  // Dimensions graphiques SVG
  const svgWidth = 330;
  const svgHeight = 140;
  const paddingLeft = 32;
  const paddingRight = 14;
  const paddingTop = 18;
  const paddingBottom = 26;

  const chartX = paddingLeft;
  const chartY = paddingTop;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;
  const bottomY = chartY + chartHeight;

  // Domaine FC en BPM : 100 à 190 bpm
  const minBpm = 100;
  const maxBpm = 190;
  const bpmRange = maxBpm - minBpm;

  const getY = (bpm: number) => {
    const clamped = Math.max(minBpm, Math.min(maxBpm, bpm));
    return chartY + chartHeight - ((clamped - minBpm) / bpmRange) * chartHeight;
  };

  const getX = (timeSec: number) => {
    const ratio = Math.max(0, Math.min(1, timeSec / TOTAL_RUN_DURATION));
    return chartX + ratio * chartWidth;
  };

  // Échantillons actifs selon l'état de la course
  const isIdle = runState === 'idle';
  const isFinished = runState === 'finished';
  const isLive = runState === 'running' || runState === 'paused';

  // Points à afficher
  const activeSamples = useMemo(() => {
    if (isIdle || isFinished) {
      return HR_REFERENCE_SAMPLES;
    }
    // Mode course en direct : progression progressive selon runDurationSec
    const currentDur = Math.max(1, runDurationSec);
    const filtered = HR_REFERENCE_SAMPLES.filter((s) => s.timeSec <= currentDur);
    // Ajoute le point actuel exact
    const lastSampleTime = filtered.length > 0 ? filtered[filtered.length - 1].timeSec : 0;
    if (currentDur > lastSampleTime) {
      filtered.push({ timeSec: currentDur, hr: liveHr });
    }
    // Si la course démarre tout juste (< 1 point)
    if (filtered.length === 0) {
      filtered.push({ timeSec: 0, hr: liveHr });
    }
    return filtered;
  }, [isIdle, isFinished, runDurationSec, liveHr]);

  // Points cartésiens projetés
  const points = useMemo(() => {
    return activeSamples.map((s) => ({
      x: getX(s.timeSec),
      y: getY(s.hr),
      timeSec: s.timeSec,
      hr: s.hr,
    }));
  }, [activeSamples, chartWidth, chartHeight]);

  // Chemin projeté fantôme (pour voir le profil complet de l'entraînement en direct)
  const ghostPoints = useMemo(() => {
    if (!isLive) return [];
    return HR_REFERENCE_SAMPLES.map((s) => ({
      x: getX(s.timeSec),
      y: getY(s.hr),
    }));
  }, [isLive, chartWidth, chartHeight]);

  const activePathD = useMemo(() => getSmoothPath(points), [points]);
  const activeAreaD = useMemo(() => getSmoothArea(points, bottomY), [points, bottomY]);
  const ghostPathD = useMemo(() => (ghostPoints.length > 0 ? getSmoothPath(ghostPoints) : ''), [ghostPoints]);

  // Dernier point actif (tête de courbe)
  const currentHeadPoint = points[points.length - 1];

  // Gestion du survol / scrub tactile
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const touchX = e.clientX - rect.left;
    const svgTouchX = (touchX / rect.width) * svgWidth;

    // Trouve le point le plus proche
    let closestIdx = 0;
    let minDist = Infinity;
    points.forEach((p, idx) => {
      const dist = Math.abs(p.x - svgTouchX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });
    setScrubIndex(closestIdx);
  };

  const handlePointerLeave = () => {
    setScrubIndex(null);
  };

  // Données de scrub actuel
  const activeHoverPoint = scrubIndex !== null && points[scrubIndex] ? points[scrubIndex] : null;
  const currentZone = activeHoverPoint
    ? getZoneLabel(activeHoverPoint.hr)
    : isLive
    ? getZoneLabel(liveHr)
    : getZoneLabel(avgHr);

  // Marqueurs d'axe horizontal (temps en minutes)
  const timeMarkers = [
    { sec: 0, label: '00:00' },
    { sec: 600, label: '10:00' },
    { sec: 1200, label: '20:00' },
    { sec: 1800, label: '30:00' },
    { sec: 2512, label: '41:52' },
  ];

  // Niveaux de référence FC Y (bpm)
  const yGuides = [
    { bpm: 180, label: '180' },
    { bpm: 150, label: '150' },
    { bpm: 120, label: '120' },
  ];

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
        background: 'rgba(20, 20, 24, 0.72)',
        border: '1px solid var(--border-subtle)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Halo d'ambiance Bordeaux en arrière-plan */}
      <div
        style={{
          position: 'absolute',
          top: '-30px',
          right: '-20px',
          width: '160px',
          height: '140px',
          background: 'radial-gradient(circle, rgba(163, 31, 68, 0.16) 0%, rgba(77, 11, 32, 0) 70%)',
          pointerEvents: 'none',
          borderRadius: '50%',
        }}
      />

      {/* En-tête de la carte */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '8px',
              background: 'rgba(77, 11, 32, 0.35)',
              border: '1px solid rgba(163, 31, 68, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Activity size={14} color="var(--bordeaux-light)" />
          </div>
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'block',
              }}
            >
              Intensité Cardiaque
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>
              Courbe Télémetrique
            </span>
          </div>
        </div>

        {/* Badge statistiques en direct ou synthèse */}
        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isLive ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 9px',
                borderRadius: '12px',
                background: 'rgba(163, 31, 68, 0.22)',
                border: '1px solid rgba(163, 31, 68, 0.5)',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#30D158',
                  boxShadow: '0 0 8px #30D158',
                  animation: 'pulse 1.8s infinite',
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                {liveHr} <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>bpm</span>
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                FC Max {maxHr} <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>bpm</span>
              </span>
              <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                Moy. {avgHr} bpm
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Graphique SVG : Courbe Cardiaque avec Temps Horizontal */}
      <div style={{ width: '100%', position: 'relative' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            overflow: 'visible',
            touchAction: 'none',
          }}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            {/* Dégradé de remplissage sous la courbe (Bordeaux vers transparent) */}
            <linearGradient id="hrFillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#A31F44" stopOpacity="0.38" />
              <stop offset="55%" stopColor="#4D0B20" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#4D0B20" stopOpacity="0.0" />
            </linearGradient>

            {/* Dégradé du tracé : Rose soyeux -> Bordeaux rubis -> Accent sprint */}
            <linearGradient id="hrStrokeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EFA0B4" />
              <stop offset="50%" stopColor="#A31F44" />
              <stop offset="88%" stopColor="#FF453A" />
              <stop offset="100%" stopColor="#EFA0B4" />
            </linearGradient>

            {/* Lueur lumineuse sur la courbe */}
            <filter id="hrGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
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
            fill="#A31F44"
            fontSize="9"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            letterSpacing="0.04em"
          >
            BPM
          </text>

          {/* Lignes de repère horizontales (FC 120, 150, 180 bpm) */}
          {yGuides.map((guide) => {
            const y = getY(guide.bpm);
            return (
              <g key={guide.bpm}>
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
                  {guide.label}
                </text>
              </g>
            );
          })}

          {/* Trait Moyen (FC Moyenne de la session : ligne grise en pointillés sans texte) */}
          {avgHr && (
            <line
              x1={chartX}
              y1={getY(avgHr)}
              x2={chartX + chartWidth}
              y2={getY(avgHr)}
              stroke="rgba(255, 255, 255, 0.32)"
              strokeDasharray="4 3"
              strokeWidth="1.2"
            />
          )}

          {/* Lignes de repère verticales du temps (00:00, 10:00, 20:00, 30:00, 41:52) */}
          {timeMarkers.map((marker) => {
            const x = getX(marker.sec);
            return (
              <g key={marker.sec}>
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
                  textAnchor={marker.sec === 0 ? 'start' : marker.sec === TOTAL_RUN_DURATION ? 'end' : 'middle'}
                  fill="rgba(255, 255, 255, 0.55)"
                  fontSize="9.5"
                  fontFamily="var(--font-mono)"
                  fontWeight="500"
                >
                  {marker.label}
                </text>
              </g>
            );
          })}

          {/* Axe horizontal de base */}
          <line
            x1={chartX}
            y1={bottomY}
            x2={chartX + chartWidth}
            y2={bottomY}
            stroke="rgba(255, 255, 255, 0.14)"
            strokeWidth="1"
          />

          {/* Profil fantôme en direct (tracé complet en pointillé fin) */}
          {isLive && ghostPathD && (
            <path
              d={ghostPathD}
              fill="none"
              stroke="rgba(255, 255, 255, 0.16)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Remplissage fluide dégradé sous la courbe active */}
          {activeAreaD && <path d={activeAreaD} fill="url(#hrFillGradient)" />}

          {/* Ligne principale de la courbe avec halo lumineux */}
          {activePathD && (
            <path
              d={activePathD}
              fill="none"
              stroke="url(#hrStrokeGradient)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#hrGlow)"
            />
          )}

          {/* Point actif en tête de course (Live Head beacon) */}
          {isLive && currentHeadPoint && (
            <g transform={`translate(${currentHeadPoint.x}, ${currentHeadPoint.y})`}>
              {/* Onde pulsante */}
              <circle r="7" fill="rgba(163, 31, 68, 0.45)">
                <animate
                  attributeName="r"
                  values="4;10;4"
                  dur="2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.8;0;0.8"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Point solide */}
              <circle r="3.8" fill="#FFFFFF" stroke="#A31F44" strokeWidth="2" />
            </g>
          )}

          {/* Curseur de survol interactif (Scrubbing / Touch) */}
          {activeHoverPoint && (
            <g>
              {/* Ligne verticale guide */}
              <line
                x1={activeHoverPoint.x}
                y1={chartY}
                x2={activeHoverPoint.x}
                y2={bottomY}
                stroke="#EFA0B4"
                strokeWidth="1.2"
                strokeDasharray="2 2"
              />
              {/* Point cible au croisement */}
              <circle
                cx={activeHoverPoint.x}
                cy={activeHoverPoint.y}
                r="4.5"
                fill="#FFFFFF"
                stroke="#A31F44"
                strokeWidth="2"
              />
              {/* Badge info flottant */}
              <g
                transform={`translate(${Math.min(
                  svgWidth - 65,
                  Math.max(45, activeHoverPoint.x)
                )}, ${Math.max(chartY + 12, activeHoverPoint.y - 12)})`}
              >
                <rect
                  x="-38"
                  y="-16"
                  width="76"
                  height="20"
                  rx="6"
                  fill="#18181C"
                  stroke="rgba(163, 31, 68, 0.6)"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="-3"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="9.5"
                  fontWeight="700"
                  fontFamily="var(--font-mono)"
                >
                  {activeHoverPoint.hr} bpm
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>

      {/* Barre d'état & Légende des zones horizontales sous la courbe */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          paddingTop: '6px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        {activeHoverPoint ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              ⏱ {fmtClockSec(activeHoverPoint.timeSec)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: currentZone.color,
                }}
              />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF' }}>
                {activeHoverPoint.hr} bpm ({currentZone.zone} · {currentZone.name})
              </span>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10.5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8E8E93' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Z1</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#30D158' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Z2</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FFD60A' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Z3</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF9F0A' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Z4</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF453A' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Z5</span>
              </div>
            </div>

            <span
              style={{
                fontSize: '10px',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Axe horizontal : Temps écoulé
            </span>
          </>
        )}
      </div>
    </div>
  );
};
