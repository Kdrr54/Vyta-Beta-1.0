import React, { useState } from 'react';
import { run } from '../data/fit';
import { fmtMMSS } from '../lib/format';
import { Compass, Layers, Maximize2, Sparkles, Navigation } from 'lucide-react';

interface AppleWorkoutMapProps {
  onOpenStory?: () => void;
  progress?: number;
  runState?: 'idle' | 'running' | 'paused' | 'finished';
  distanceKm?: number;
}

export const AppleWorkoutMap: React.FC<AppleWorkoutMapProps> = ({
  onOpenStory,
  progress,
  runState = 'idle',
  distanceKm = 0,
}) => {
  const [is3D, setIs3D] = useState(false);
  const [activeSplit, setActiveSplit] = useState<number | null>(null);
  const [colorMode, setColorMode] = useState<'pace' | 'gold'>('pace');

  // Parc Monceau perimeter route coordinates (scaled for 360x220 canvas)
  // Accurate to the historical geometry of the park and its main running loop
  const routePoints = [
    { x: 180, y: 44, km: 0, label: 'Départ', pace: '5:19' },      // Rotonde entrance
    { x: 135, y: 55, km: 1, label: 'Km 1', pace: '5:19' },        // North-West path
    { x: 88, y: 72, km: 2, label: 'Km 2', pace: '5:21' },         // Towards Av. Van Dyck gate
    { x: 58, y: 104, km: 3, label: 'Km 3', pace: '5:14' },        // West boundary
    { x: 54, y: 142, km: 4, label: 'Km 4', pace: '5:18' },        // South-West curve
    { x: 82, y: 172, km: 5, label: 'Km 5', pace: '5:10' },        // South lawn (Av. Ruysdaël)
    { x: 140, y: 190, km: 6, label: 'Km 6', pace: '5:05' },       // South-East
    { x: 215, y: 192, km: 7, label: 'Km 7', pace: '5:00' },       // East curve (Rue de Prony)
    { x: 275, y: 165, km: 8, label: 'Km 8 ★', pace: '4:48' },     // North-East sprint (PR!)
    { x: 295, y: 120 },
    { x: 285, y: 78 },
    { x: 240, y: 52 },
    { x: 196, y: 45, label: 'Arrivée', pace: '4:48' },            // Back to Rotonde finish
  ];

  // Calculate live runner position from current progress
  const currentProg = typeof progress === 'number' ? Math.max(0, Math.min(1, progress)) : (runState === 'finished' ? 1 : 0);
  const getRunnerPosition = (prog: number) => {
    if (prog <= 0) return { x: 180, y: 44 };
    if (prog >= 1) return { x: 196, y: 45 };
    const totalSegments = routePoints.length - 1;
    const segmentIndex = prog * totalSegments;
    const i = Math.floor(segmentIndex);
    const t = segmentIndex - i;
    const p1 = routePoints[i];
    const p2 = routePoints[Math.min(i + 1, totalSegments)];
    return {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
    };
  };
  const runnerPos = getRunnerPosition(currentProg);

  // Build SVG path
  const fullPathD = routePoints.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    // Use cubic beziers for ultra-smooth organic curves
    const prev = routePoints[i - 1];
    const mx = (prev.x + p.x) / 2;
    const my = (prev.y + p.y) / 2;
    return `${acc} Q ${prev.x} ${prev.y}, ${mx} ${my} T ${p.x} ${p.y}`;
  }, '');

  return (
    <div className="apple-maps-card-wrapper">
      {/* 3D Perspective Container */}
      <div
        className={`apple-maps-stage ${is3D ? 'is-3d-view' : ''}`}
        style={{
          transform: is3D ? 'perspective(650px) rotateX(28deg) scale(0.96)' : 'none',
          transition: 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <svg
          viewBox="0 0 360 230"
          className="apple-maps-svg"
          preserveAspectRatio="xMidYMid slice"
          aria-label="Carte d'itinéraire Apple Plans"
        >
          <defs>
            {/* Apple Maps Street Glow & Shadows */}
            <filter id="roadShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.4" />
            </filter>

            {/* Apple Fitness Luminous Route Halo */}
            <filter id="routeGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#30D158" floodOpacity="0.5" />
            </filter>

            <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#A31F44" floodOpacity="0.65" />
            </filter>

            {/* Apple Fitness Multi-Pace Linear Gradient */}
            <linearGradient id="applePaceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF9F0A" />    {/* Orange (Démarrage / Allure modérée) */}
              <stop offset="25%" stopColor="#FFD60A" />   {/* Jaune doré (Allure tempo 5:14) */}
              <stop offset="65%" stopColor="#30D158" />   {/* Vert dynamique (Allure 5:05) */}
              <stop offset="100%" stopColor="#20E670" />  {/* Vert fluo Apple (Sprint PR 4:48) */}
            </linearGradient>

            <linearGradient id="noirEtOrGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EFA0B4" />
              <stop offset="50%" stopColor="#A31F44" />
              <stop offset="100%" stopColor="#4D0B20" />
            </linearGradient>

            {/* Parc Monceau Water Shading (La Naumachie) */}
            <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#14283D" />
              <stop offset="100%" stopColor="#0B1826" />
            </linearGradient>

            {/* Lush Park Canopy Fill */}
            <radialGradient id="parkGrass" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#162D1A" />
              <stop offset="85%" stopColor="#112214" />
              <stop offset="100%" stopColor="#0D1A10" />
            </radialGradient>
          </defs>

          {/* 1. Base Urban Fabric (Paris 8e/17e City Blocks in Apple Maps Dark Mode) */}
          <rect width="360" height="220" fill="#151518" />

          {/* Background Building Parcels (Haussmannian building footprints) */}
          <g fill="#1B1B1F" stroke="#121214" strokeWidth="0.8" opacity="0.9">
            {/* North of Boulevard de Courcelles */}
            <rect x="0" y="0" width="60" height="20" />
            <rect x="66" y="0" width="75" height="18" />
            <rect x="148" y="0" width="80" height="19" />
            <rect x="235" y="0" width="70" height="18" />
            <rect x="312" y="0" width="48" height="20" />

            {/* West Blocks (Rue de Courcelles / Av. Van Dyck) */}
            <polygon points="0,38 28,38 22,120 0,115" />
            <polygon points="0,126 20,128 32,200 0,200" />

            {/* South Blocks (Rue Murillo / Av. Ruysdaël) */}
            <rect x="70" y="202" width="60" height="18" />
            <rect x="140" y="205" width="70" height="15" />
            <rect x="220" y="202" width="65" height="18" />

            {/* East Blocks (Rue de Prony / Av. Vélasquez) */}
            <polygon points="325,40 360,40 360,110 332,105" />
            <polygon points="336,118 360,120 360,195 315,195" />
          </g>

          {/* 2. Streets & Boulevards (Apple Maps Slate Roads) */}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Boulevard de Courcelles (Wide primary arterial at top) */}
            <line x1="-10" y1="28" x2="370" y2="28" stroke="#36363E" strokeWidth="15" />
            <line x1="-10" y1="28" x2="370" y2="28" stroke="#25252B" strokeWidth="12" />
            {/* Center dash line */}
            <line x1="-10" y1="28" x2="370" y2="28" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="6 8" />

            {/* Avenue Van Dyck (West gate approach) */}
            <line x1="28" y1="40" x2="52" y2="60" stroke="#25252B" strokeWidth="9" />
            <line x1="28" y1="40" x2="52" y2="60" stroke="#1D1D22" strokeWidth="6" />

            {/* Avenue Ruysdaël (South entrance) */}
            <line x1="125" y1="220" x2="115" y2="185" stroke="#25252B" strokeWidth="9" />
            <line x1="125" y1="220" x2="115" y2="185" stroke="#1D1D22" strokeWidth="6" />

            {/* Avenue Vélasquez (South-East entrance) */}
            <line x1="240" y1="220" x2="230" y2="188" stroke="#25252B" strokeWidth="8" />

            {/* Rue de Prony (East border) */}
            <line x1="335" y1="35" x2="310" y2="210" stroke="#25252B" strokeWidth="9" />
            <line x1="335" y1="35" x2="310" y2="210" stroke="#1D1D22" strokeWidth="6" />

            {/* Rue de Courcelles (West border) */}
            <line x1="22" y1="35" x2="48" y2="210" stroke="#25252B" strokeWidth="9" />
            <line x1="22" y1="35" x2="48" y2="210" stroke="#1D1D22" strokeWidth="6" />
          </g>

          {/* 3. PARC MONCEAU MAIN POLYGON (Authentic Apple Maps Sage/Emerald Green) */}
          <polygon
            points="
              54,38
              170,38
              190,38
              312,38
              325,85
              318,140
              288,185
              215,198
              130,195
              70,180
              46,135
              42,85
            "
            fill="url(#parkGrass)"
            stroke="#1B3821"
            strokeWidth="1.2"
          />

          {/* 4. Internal Pedestrian Paths (Allées de gravier du Parc Monceau) */}
          <g fill="none" stroke="#233B28" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
            {/* Main Outer Promenade Loop */}
            <path d="M 180,44 C 120,48 68,75 58,115 C 48,155 75,178 120,188 C 175,198 250,195 285,160 C 315,130 305,75 240,48 Z" />

            {/* Allée Ferdinand de Lesseps (Transverse path) */}
            <path d="M 58,115 Q 140,125 210,135 Q 260,140 285,160" strokeWidth="3" />

            {/* Path crossing North-South through center */}
            <path d="M 180,44 Q 185,110 180,192" strokeWidth="3" />

            {/* Circular path around Naumachie pool */}
            <ellipse cx="130" cy="100" rx="36" ry="24" strokeWidth="3" />
          </g>

          {/* 5. Water Feature: La Naumachie (Iconic Oval Pool & Colonnade) */}
          <g>
            <ellipse cx="130" cy="100" rx="26" ry="16" fill="url(#waterGrad)" stroke="#1F3D5C" strokeWidth="1.2" />
            {/* Colonnade Arc on pond edge */}
            <path
              d="M 110,92 A 22 14 0 0 1 150,92"
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="2"
              strokeDasharray="2 3"
            />
            {/* Subtle water glint */}
            <ellipse cx="126" cy="98" rx="10" ry="4" fill="rgba(255,255,255,0.06)" />
          </g>

          {/* 6. Iconic Rotonde de Chartres at North Gate */}
          <g transform="translate(180, 36)">
            <circle cx="0" cy="0" r="7" fill="#2E2E35" stroke="#A31F44" strokeWidth="1" />
            <circle cx="0" cy="0" r="3.5" fill="#A31F44" />
          </g>

          {/* 7. Apple Maps Styled Street Names & Labels */}
          <g fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" fontWeight="600">
            {/* Boulevard de Courcelles */}
            <text x="75" y="24" fill="#8E8E93" fontSize="7" letterSpacing="0.4">
              BD DE COURCELLES
            </text>

            {/* Metro Monceau Icon & Label */}
            <g transform="translate(262, 22)">
              <circle cx="0" cy="0" r="4.5" fill="#007AFF" />
              <text x="0" y="2.5" fill="#FFFFFF" fontSize="5.5" fontWeight="800" textAnchor="middle">M</text>
              <text x="8" y="2" fill="#AEAEB2" fontSize="6.5" fontWeight="500">Monceau</text>
            </g>

            {/* Avenue Van Dyck */}
            <text
              x="22"
              y="60"
              fill="#71717A"
              fontSize="6"
              transform="rotate(40 22 60)"
              letterSpacing="0.2"
            >
              Av. Van Dyck
            </text>

            {/* Avenue Ruysdaël */}
            <text x="95" y="212" fill="#71717A" fontSize="6" letterSpacing="0.2">
              Av. Ruysdaël
            </text>

            {/* Rue de Prony */}
            <text
              x="345"
              y="85"
              fill="#71717A"
              fontSize="6"
              transform="rotate(82 345 85)"
              letterSpacing="0.2"
            >
              Rue de Prony
            </text>

            {/* Main Park Title (Apple Maps signature park label with subtle dark glow) */}
            <text
              x="180"
              y="130"
              fill="#E5E5EA"
              fontSize="9.5"
              fontWeight="700"
              letterSpacing="1.2"
              textAnchor="middle"
              filter="url(#roadShadow)"
            >
              PARC MONCEAU
            </text>

            {/* Rotonde POI Label */}
            <text x="180" y="49" fill="#AEAEB2" fontSize="5.5" fontWeight="500" textAnchor="middle">
              Rotonde de Chartres
            </text>

            {/* Naumachie Pool Label */}
            <text x="130" y="102" fill="#64D2FF" fontSize="5.5" fontWeight="500" textAnchor="middle" opacity="0.8">
              Bassin de Naumachie
            </text>
          </g>

          {/* 8. WORKOUT ROUTE OVERLAY (Apple Fitness Iconic Multi-Color Pace Line) */}
          <g>
            {/* Base Planned Route Outline (subtle dashed line when not fully finished) */}
            {currentProg < 1 && (
              <path
                d={fullPathD}
                fill="none"
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth="2.5"
                strokeDasharray="4 3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Active Live Running Track (Draws dynamically from 0% to 100%) */}
            {currentProg > 0 && (
              <>
                {/* Luminous ambient glow line */}
                <path
                  d={fullPathD}
                  pathLength={100}
                  strokeDasharray={100}
                  strokeDashoffset={100 * (1 - Math.max(0.001, Math.min(1, currentProg)))}
                  fill="none"
                  stroke={colorMode === 'pace' ? 'url(#applePaceGradient)' : 'url(#noirEtOrGradient)'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.4"
                  filter={colorMode === 'pace' ? 'url(#routeGlow)' : 'url(#goldGlow)'}
                  style={{ transition: 'stroke-dashoffset 300ms ease-out' }}
                />

                {/* Crisp white hairline border under route for contrast */}
                <path
                  d={fullPathD}
                  pathLength={100}
                  strokeDasharray={100}
                  strokeDashoffset={100 * (1 - Math.max(0.001, Math.min(1, currentProg)))}
                  fill="none"
                  stroke="rgba(0,0,0,0.6)"
                  strokeWidth="4.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transition: 'stroke-dashoffset 300ms ease-out' }}
                />

                {/* Sharp vibrant workout route */}
                <path
                  d={fullPathD}
                  pathLength={100}
                  strokeDasharray={100}
                  strokeDashoffset={100 * (1 - Math.max(0.001, Math.min(1, currentProg)))}
                  fill="none"
                  stroke={colorMode === 'pace' ? 'url(#applePaceGradient)' : 'url(#noirEtOrGradient)'}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transition: 'stroke-dashoffset 300ms ease-out' }}
                />
              </>
            )}

            {/* Live Runner Position Beacon (Apple Fitness Pulsing Radar) */}
            {(runState === 'running' || runState === 'paused' || runState === 'idle') && (
              <g
                transform={`translate(${runnerPos.x}, ${runnerPos.y})`}
                style={{ transition: 'transform 300ms linear' }}
              >
                <circle
                  cx="0"
                  cy="0"
                  r={runState === 'running' ? '13' : '7'}
                  fill={runState === 'paused' ? 'rgba(255, 159, 10, 0.28)' : 'rgba(48, 209, 88, 0.28)'}
                  className={runState === 'running' ? 'pulse-radar' : undefined}
                />
                <circle
                  cx="0"
                  cy="0"
                  r="5.5"
                  fill={runState === 'paused' ? '#FF9F0A' : '#30D158'}
                  stroke="#FFFFFF"
                  strokeWidth="1.8"
                />
                <circle cx="0" cy="0" r="2" fill="#FFFFFF" />
              </g>
            )}

            {/* Milestone km pins (Apple Fitness numbered pins) — appear as you cross them */}
            {routePoints.filter((p) => p.km && p.km > 0).map((p) => {
              if (distanceKm < p.km! && runState !== 'finished') return null;

              const isSelected = activeSplit === p.km;
              const isPR = p.km === 8;

              return (
                <g
                  key={p.km}
                  transform={`translate(${p.x}, ${p.y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setActiveSplit(activeSplit === p.km ? null : p.km!)}
                >
                  {/* Pin circle */}
                  <circle
                    cx="0"
                    cy="0"
                    r={isSelected ? '6.5' : '4.5'}
                    fill={isPR ? 'var(--gold)' : '#FFFFFF'}
                    stroke="#000000"
                    strokeWidth="1.2"
                    style={{ transition: 'all 200ms ease' }}
                  />
                  <text
                    x="0"
                    y="2.5"
                    fill="#000000"
                    fontSize="5"
                    fontWeight="800"
                    textAnchor="middle"
                    fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
                  >
                    {p.km}
                  </text>
                </g>
              );
            })}

            {/* Start Marker (Apple Fitness Green Pin with "Départ") */}
            <g transform="translate(180, 44)">
              <circle cx="0" cy="0" r="5" fill="#30D158" stroke="#FFFFFF" strokeWidth="1.5" />
              <circle cx="0" cy="0" r="2" fill="#FFFFFF" />
            </g>

            {/* Finish Marker (Apple Fitness Red / Checkered Pin) */}
            {(currentProg >= 0.95 || runState === 'finished') && (
              <g transform="translate(196, 45)">
                <circle cx="0" cy="0" r="5" fill="#FF453A" stroke="#FFFFFF" strokeWidth="1.5" />
                <circle cx="0" cy="0" r="2" fill="#FFFFFF" />
              </g>
            )}
          </g>

          {/* 9. Watermark: Authentic Apple Maps Logo in bottom-right */}
          <g transform="translate(305, 206)">
            {/* Apple Logo SVG */}
            <path
              d="M 5.8 4.2 C 5.5 4.6 5.1 4.9 4.6 5.3 C 4.2 5.8 3.9 6.2 3.6 6.4 C 3.2 6.7 2.8 6.9 2.4 6.9 C 2.1 6.9 1.7 6.8 1.3 6.6 C 0.9 6.4 0.5 6.4 0.1 6.4 C -0.3 6.4 -0.7 6.5 -1.1 6.6 C -1.5 6.8 -1.9 6.9 -2.2 6.9 C -2.6 6.9 -3.0 6.7 -3.4 6.4 C -3.7 6.1 -4.0 5.7 -4.4 5.2 C -4.9 4.5 -5.3 3.6 -5.6 2.6 C -5.9 1.6 -6.0 0.7 -6.0 -0.2 C -6.0 -1.4 -5.7 -2.4 -5.1 -3.2 C -4.5 -4.0 -3.8 -4.4 -2.8 -4.4 C -2.3 -4.4 -1.8 -4.3 -1.3 -4.0 C -0.8 -3.8 -0.4 -3.6 -0.3 -3.6 C -0.1 -3.6 0.3 -3.8 0.8 -4.0 C 1.3 -4.3 1.8 -4.4 2.3 -4.4 C 3.3 -4.3 4.1 -3.9 4.7 -3.2 C 4.1 -2.8 3.7 -2.3 3.6 -1.6 C 3.5 -0.9 3.7 -0.3 4.1 0.3 C 4.5 0.9 5.0 1.3 5.7 1.5 C 5.5 2.1 5.3 2.6 5.0 3.1 Z M 3.3 -4.9 C 3.3 -5.5 3.5 -6.1 3.9 -6.6 C 4.3 -7.1 4.9 -7.4 5.5 -7.5 C 5.5 -7.4 5.5 -7.3 5.5 -7.2 C 5.5 -6.6 5.3 -6.0 4.9 -5.5 C 4.5 -5.0 3.9 -4.7 3.3 -4.6 Z"
              fill="rgba(255, 255, 255, 0.45)"
              transform="scale(0.85)"
            />
            <text
              x="8"
              y="2"
              fill="rgba(255, 255, 255, 0.55)"
              fontSize="7.5"
              fontWeight="600"
              fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
            >
              Plans
            </text>
          </g>
        </svg>

        {/* Floating Interactive Tooltip if user clicks a Km marker */}
        {activeSplit && (
          <div
            className="apple-map-split-tooltip"
            style={{
              position: 'absolute',
              top: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(24, 24, 27, 0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: activeSplit === 8 ? '1px solid var(--gold-border)' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: '12px',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 30,
              boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>
              Km {activeSplit}
            </span>
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: activeSplit === 8 ? 'var(--gold-light)' : '#30D158' }}>
              {run.splitsSec[activeSplit - 1] ? fmtMMSS(run.splitsSec[activeSplit - 1]) : '5:09'} /km
            </span>
            {activeSplit === 8 && (
              <span style={{ fontSize: '10px', background: 'var(--gold-soft)', color: 'var(--gold-light)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                RECORD ★
              </span>
            )}
          </div>
        )}
      </div>

      {/* Apple Maps UI Overlay Bar (Top & Bottom Controls) */}
      <div className="apple-maps-controls-bar">
        {/* Top-Left: Workout Tag */}
        <div className="map-workout-badge">
          <Navigation size={11} color={runState === 'running' ? 'var(--accent-green)' : runState === 'paused' ? '#FF9F0A' : 'var(--text-secondary)'} />
          <span>
            {runState === 'idle'
              ? 'GPS Vyta One · Prêt à partir'
              : runState === 'running'
              ? `GPS Live · ${distanceKm.toFixed(2)} km`
              : runState === 'paused'
              ? `En pause · ${distanceKm.toFixed(2)} km`
              : `Course terminée · ${distanceKm.toFixed(2)} km`}
          </span>
        </div>

        {/* Top-Right: Apple Maps 2D/3D & Color Mode Switchers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <button
            type="button"
            className={`map-control-pill ${is3D ? 'active' : ''}`}
            onClick={() => setIs3D(!is3D)}
            title="Bascule vue 2D / 3D inclinée"
          >
            <span>{is3D ? '2D' : '3D'}</span>
          </button>

          <button
            type="button"
            className={`map-control-pill ${colorMode === 'gold' ? 'active gold' : ''}`}
            onClick={() => setColorMode(colorMode === 'pace' ? 'gold' : 'pace')}
            title="Bascule Allure / Signature Or"
          >
            <Sparkles size={11} />
            <span>{colorMode === 'pace' ? 'Allure' : 'Vyta Or'}</span>
          </button>
        </div>
      </div>

      {/* Bottom Pace Legend Bar (Apple Fitness Iconic Legend) */}
      <div className="apple-fitness-pace-legend">
        <span className="legend-text">Plus lent</span>
        <div className="legend-gradient-bar" />
        <span className="legend-text">Plus rapide (4:48 /km)</span>
      </div>
    </div>
  );
};
