import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronDown, Settings, Compass, Layers, Navigation, Maximize2, Pause, Play, Square, Zap, X, Heart, Share2, Flame, TrendingUp } from 'lucide-react';
import { initAppleMapKit, cleanMapAttributions } from '../lib/appleMapKit';
import { RunTelemetryCharts, TelemetryPoint } from './RunTelemetryCharts';
import { fmtClockSec, fmtMMSS } from '../lib/format';
import { useApp } from '../context/AppContext';

interface LiveRunningViewProps {
  runState: 'idle' | 'running' | 'paused' | 'finished';
  runDurationSec: number;
  runDistanceKm: number;
  liveSpeedKmh?: number;
  liveHr?: number;
  liveElevation?: number;
  liveCalories?: number;
  livePaceSec?: number;
  telemetryHistory?: TelemetryPoint[];
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onClose: () => void;
  onOpenStory?: () => void;
  realGpsPoints?: [number, number][];
  userPosition?: [number, number] | null;
}

const DEFAULT_LOCATION_CENTER: [number, number] = [48.8566, 2.3522];

const TILES_DARK = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILES_DARK_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
const TILES_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const LiveRunningView: React.FC<LiveRunningViewProps> = ({
  runState,
  runDurationSec,
  runDistanceKm,
  liveSpeedKmh,
  liveHr = 0,
  liveElevation = 0,
  liveCalories = 0,
  livePaceSec = 0,
  telemetryHistory = [],
  onPause,
  onResume,
  onStop,
  onClose,
  onOpenStory,
  realGpsPoints: propRealGpsPoints,
  userPosition: propUserPosition,
}) => {
  const { isLiveHrActive, toggleLiveHr } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSheetExpanded, setIsSheetExpanded] = useState<boolean>(false);
  const [realGpsPoints, setRealGpsPoints] = useState<[number, number][]>(() => propRealGpsPoints || []);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(() => {
    if (propUserPosition) return propUserPosition;
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vyta_last_user_location');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });
  const [mapType, setMapType] = useState<'dark' | 'satellite'>('dark');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Apple MapKit refs
  const [isAppleMapKitActive, setIsAppleMapKitActive] = useState<boolean>(false);
  const appleMapInstanceRef = useRef<any>(null);
  const applePolylineRef = useRef<any>(null);
  const appleRunnerAnnotationRef = useRef<any>(null);

  // Leaflet refs
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletTileRef = useRef<L.TileLayer | null>(null);
  const leafletLabelsRef = useRef<L.TileLayer | null>(null);
  const leafletPolylineRef = useRef<L.Polyline | null>(null);
  const leafletGlowPolyRef = useRef<L.Polyline | null>(null);
  const leafletOuterGlowRef = useRef<L.Polyline | null>(null);
  const leafletRunnerRef = useRef<L.Marker | null>(null);

  // Progress computation
  const currentProg = Math.max(0, Math.min(1, runDistanceKm / 10));

  // Sync with props
  useEffect(() => {
    if (propUserPosition) {
      setUserPosition(propUserPosition);
      if (leafletRunnerRef.current) {
        leafletRunnerRef.current.setLatLng(propUserPosition);
      }
      if (leafletMapRef.current && runState === 'running') {
        leafletMapRef.current.panTo(propUserPosition, { animate: true, duration: 0.5 });
      }
    }
  }, [propUserPosition, runState]);

  useEffect(() => {
    if (propRealGpsPoints && propRealGpsPoints.length > 0) {
      setRealGpsPoints(propRealGpsPoints);
      if (leafletPolylineRef.current && leafletGlowPolyRef.current && leafletOuterGlowRef.current) {
        leafletOuterGlowRef.current.setLatLngs(propRealGpsPoints);
        leafletGlowPolyRef.current.setLatLngs(propRealGpsPoints);
        leafletPolylineRef.current.setLatLngs(propRealGpsPoints);
      }
    }
  }, [propRealGpsPoints]);

  // Compute live runner location (ALWAYS real GPS location)
  const getRunnerLatLng = (_prog?: number): [number, number] => {
    if (propRealGpsPoints && propRealGpsPoints.length > 0) {
      return propRealGpsPoints[propRealGpsPoints.length - 1];
    }
    if (realGpsPoints.length > 0) return realGpsPoints[realGpsPoints.length - 1];
    if (propUserPosition) return propUserPosition;
    if (userPosition) return userPosition;
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vyta_last_user_location');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return DEFAULT_LOCATION_CENTER;
  };

  // Compute active trail points (ALWAYS strictly real GPS trail)
  const getActiveTrailPoints = (): [number, number][] => {
    if (propRealGpsPoints && propRealGpsPoints.length > 0) return propRealGpsPoints;
    return realGpsPoints;
  };

  // Real GPS Geolocation Watcher outdoors & Immediate User Location Fix
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    // Immediate fix to center on user
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const coords: [number, number] = [latitude, longitude];
        setUserPosition(coords);

        if (appleMapInstanceRef.current && (window as any).mapkit) {
          const mapkit = (window as any).mapkit;
          appleMapInstanceRef.current.region = new mapkit.CoordinateRegion(
            new mapkit.Coordinate(latitude, longitude),
            new mapkit.CoordinateSpan(0.0035, 0.0055)
          );
          if (appleRunnerAnnotationRef.current) {
            appleRunnerAnnotationRef.current.coordinate = new mapkit.Coordinate(latitude, longitude);
          }
        }

        if (leafletMapRef.current) {
          leafletMapRef.current.setView(coords, 17, { animate: true });
          if (leafletRunnerRef.current) {
            leafletRunnerRef.current.setLatLng(coords);
          }
        }
      },
      (err) => console.log('Immediate location fix note:', err.message),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 5000 }
    );

    // Continuous watch
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const coords: [number, number] = [latitude, longitude];
        setUserPosition(coords);
        if (accuracy <= 30 && runState === 'running') {
          setRealGpsPoints(prev => [...prev, coords]);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [runState]);

  // Mount Map (Apple MapKit JS or Leaflet)
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const stopCleaner = cleanMapAttributions(containerRef.current);

    const setupMap = async () => {
      let initialCenter: [number, number] = userPosition || [48.8566, 2.3522];
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('vyta_last_user_location');
          if (saved) initialCenter = JSON.parse(saved);
        } catch (e) {}
      }
      const mapkit = (window as any).mapkit;
      if (mapkit) {
        const ok = await initAppleMapKit();
        if (ok && !cancelled && containerRef.current) {
          try {
            const map = new mapkit.Map(containerRef.current, {
              colorScheme: mapkit.Map.ColorSchemes.Dark,
              showsCompass: mapkit.FeatureVisibility.Hidden,
              showsScale: mapkit.FeatureVisibility.Hidden,
              showsZoomControl: false,
              showsMapTypeControl: false,
              showsPointsOfInterest: true,
              region: new mapkit.CoordinateRegion(
                new mapkit.Coordinate(initialCenter[0], initialCenter[1]),
                new mapkit.CoordinateSpan(0.0035, 0.0055)
              ),
            });

            // Live runner marker with Apple blue dot
            const runnerAnnotation = new mapkit.MarkerAnnotation(
              new mapkit.Coordinate(initialCenter[0], initialCenter[1]),
              {
                color: '#007AFF',
                glyphText: '',
              }
            );
            map.addAnnotation(runnerAnnotation);
            appleRunnerAnnotationRef.current = runnerAnnotation;

            appleMapInstanceRef.current = map;
            setIsAppleMapKitActive(true);
            return;
          } catch (err) {
            console.warn('MapKit JS init fallback to Leaflet:', err);
          }
        }
      }

      // Leaflet Fallback
      if (cancelled || !containerRef.current || leafletMapRef.current) return;

      const map = L.map(containerRef.current, {
        center: initialCenter,
        zoom: 17,
        zoomControl: false,
        attributionControl: false,
        minZoom: 3,
        maxZoom: 19,
      });

      const tileLayer = L.tileLayer(TILES_DARK, { maxZoom: 19 }).addTo(map);
      leafletTileRef.current = tileLayer;

      const labelsLayer = L.tileLayer(TILES_DARK_LABELS, { maxZoom: 19, opacity: 0.85 }).addTo(map);
      leafletLabelsRef.current = labelsLayer;

      // 1. Neon Outer Glow Polyline (Deep purple/blue)
      const outerGlowPoly = L.polyline([], {
        color: '#6E00FF',
        weight: 16,
        opacity: 0.45,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      leafletOuterGlowRef.current = outerGlowPoly;

      // 2. Main Glow Polyline (Electric Blue)
      const glowPoly = L.polyline([], {
        color: '#007AFF',
        weight: 9,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      leafletGlowPolyRef.current = glowPoly;

      // 3. Core Polyline (Cyan Bright Highlight)
      const mainPoly = L.polyline([], {
        color: '#00E5FF',
        weight: 4,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      leafletPolylineRef.current = mainPoly;

      // Iconic iOS Blue Dot with Directional Flashlight Beam Cone
      const runnerIcon = L.divIcon({
        className: 'apple-gps-live-puck',
        html: `
          <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
            <!-- Directional Flashlight Beam Cone -->
            <div style="
              position:absolute;
              bottom:12px;
              left:50%;
              transform:translateX(-50%);
              width:70px;
              height:60px;
              background:radial-gradient(circle at 50% 100%, rgba(0,122,255,0.6) 0%, rgba(0,122,255,0.18) 55%, transparent 80%);
              clip-path:polygon(50% 100%, 0% 0%, 100% 0%);
              pointer-events:none;
            "></div>
            <!-- Blue iOS Location Circle -->
            <div style="
              width:20px;
              height:20px;
              background:#007AFF;
              border:3px solid #FFFFFF;
              border-radius:50%;
              box-shadow:0 0 14px rgba(0,122,255,0.9), 0 2px 8px rgba(0,0,0,0.5);
              position:relative;
              z-index:2;
            "></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const runnerMarker = L.marker(initialCenter, {
        icon: runnerIcon,
        zIndexOffset: 1000,
      }).addTo(map);
      leafletRunnerRef.current = runnerMarker;

      leafletMapRef.current = map;
    };

    setupMap();

    return () => {
      cancelled = true;
      stopCleaner();
      if (appleMapInstanceRef.current) {
        appleMapInstanceRef.current.destroy();
        appleMapInstanceRef.current = null;
      }
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Live dynamic route tracing and continuous camera follow
  useEffect(() => {
    const runnerPos = getRunnerLatLng();
    const trailPoints = getActiveTrailPoints();

    // 1. Update Apple MapKit
    if (appleMapInstanceRef.current && (window as any).mapkit) {
      const mapkit = (window as any).mapkit;
      const map = appleMapInstanceRef.current;

      if (appleRunnerAnnotationRef.current) {
        appleRunnerAnnotationRef.current.coordinate = new mapkit.Coordinate(runnerPos[0], runnerPos[1]);
        if (runState === 'running') {
          map.setCenterAnimated(new mapkit.Coordinate(runnerPos[0], runnerPos[1]));
        }
      }

      if (trailPoints.length >= 2) {
        const coords = trailPoints.map(p => new mapkit.Coordinate(p[0], p[1]));
        if (applePolylineRef.current) {
          map.removeOverlay(applePolylineRef.current);
        }
        const poly = new mapkit.PolylineOverlay(coords, {
          style: new mapkit.Style({
            strokeColor: '#007AFF',
            lineWidth: 6,
            lineJoin: 'round',
            lineCap: 'round',
          }),
        });
        map.addOverlay(poly);
        applePolylineRef.current = poly;
      }
    }

    // 2. Update Leaflet
    if (leafletMapRef.current) {
      const map = leafletMapRef.current;

      if (leafletRunnerRef.current) {
        leafletRunnerRef.current.setLatLng(runnerPos);
        if (runState === 'running') {
          map.panTo(runnerPos, { animate: true, duration: 0.5 });
        }
      }

      if (leafletPolylineRef.current && leafletGlowPolyRef.current && leafletOuterGlowRef.current) {
        leafletOuterGlowRef.current.setLatLngs(trailPoints);
        leafletGlowPolyRef.current.setLatLngs(trailPoints);
        leafletPolylineRef.current.setLatLngs(trailPoints);
      }
    }
  }, [currentProg, runState, realGpsPoints]);

  // Center on Runner (Always user's real location)
  const handleCenterOnRunner = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setUserPosition(coords);
          try {
            localStorage.setItem('vyta_last_user_location', JSON.stringify(coords));
          } catch (e) {}
          if (leafletMapRef.current) {
            leafletMapRef.current.flyTo(coords, 17, { duration: 0.8 });
          }
          if (appleMapInstanceRef.current && (window as any).mapkit) {
            const mapkit = (window as any).mapkit;
            appleMapInstanceRef.current.setCenterAnimated(new mapkit.Coordinate(coords[0], coords[1]));
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
    const runnerPos = getRunnerLatLng();
    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo(runnerPos, 17, { duration: 0.8 });
    }
  };

  // Toggle Map Type
  const toggleMapType = () => {
    const nextType = mapType === 'dark' ? 'satellite' : 'dark';
    setMapType(nextType);

    if (appleMapInstanceRef.current && (window as any).mapkit) {
      const mapkit = (window as any).mapkit;
      appleMapInstanceRef.current.mapType = nextType === 'satellite' ? mapkit.Map.MapTypes.Satellite : mapkit.Map.MapTypes.Standard;
    }
    if (leafletTileRef.current) {
      leafletTileRef.current.setUrl(nextType === 'dark' ? TILES_DARK : TILES_SATELLITE);
      if (leafletLabelsRef.current) {
        leafletLabelsRef.current.setOpacity(nextType === 'dark' ? 0.85 : 0);
      }
    }
  };

  // Format Duration MM:SS or HH:MM:SS
  const formatTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Calculate live speed in km/h (Strict 0,0 when paused, idle, or standing still)
  const formatSpeed = () => {
    if (runState !== 'running') {
      return '0,0';
    }
    if (typeof liveSpeedKmh === 'number' && liveSpeedKmh >= 0.8) {
      return liveSpeedKmh.toFixed(1).replace('.', ',');
    }
    return '0,0';
  };

  // Vitesse moyenne globale de la course en km/h
  const avgSpeedKmh =
    runDistanceKm > 0.01 && runDurationSec > 0
      ? (runDistanceKm / (runDurationSec / 3600)).toFixed(1).replace('.', ',')
      : '0,0';

  const content = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        width: '100vw',
        maxWidth: '430px',
        height: '100dvh',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#0B0B0D',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        touchAction: 'none',
        overscrollBehavior: 'none',
        userSelect: 'none',
      }}
    >
      {/* Map Container */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#121214' }} />
      </div>

      {/* TOP FLOATING CONTROLS */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(max(20px, env(safe-area-inset-top)) + 12px)',
          left: '16px',
          right: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 500,
          pointerEvents: 'none',
        }}
      >
        {/* Top-Left: Minimize / Collapse Chevron Down */}
        <button
          type="button"
          onClick={onClose}
          style={{
            pointerEvents: 'auto',
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'rgba(24, 24, 27, 0.78)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
          }}
          title="Réduire l'affichage (la course continue)"
        >
          <ChevronDown size={22} />
        </button>

        {/* Top-Right: Settings, Live Cardio & Heading Compass */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
          {/* Quick Toggle Live Cardio (Heart) */}
          <button
            type="button"
            onClick={toggleLiveHr}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: isLiveHrActive ? 'rgba(255, 59, 48, 0.28)' : 'rgba(24, 24, 27, 0.78)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: isLiveHrActive ? '1.5px solid #FF3B30' : '1px solid rgba(255, 255, 255, 0.12)',
              color: isLiveHrActive ? '#FF3B30' : '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isLiveHrActive ? '0 0 16px rgba(255, 59, 48, 0.45)' : '0 4px 14px rgba(0,0,0,0.5)',
              transition: 'all 200ms ease',
            }}
            title={isLiveHrActive ? "Désactiver le cardio en direct (Bague)" : "Activer le cardio en direct (Bague)"}
          >
            <Heart
              size={18}
              fill={isLiveHrActive ? "#FF3B30" : "none"}
              color={isLiveHrActive ? "#FF3B30" : "#FFFFFF"}
            />
          </button>

          {/* Settings button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'rgba(24, 24, 27, 0.78)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            }}
            title="Paramètres de course"
          >
            <Settings size={19} />
          </button>

          {/* Compass / Orientation */}
          <button
            type="button"
            onClick={handleCenterOnRunner}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'rgba(24, 24, 27, 0.78)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
              position: 'relative',
            }}
            title="Boussole / Orientation Nord"
          >
            <div style={{ width: '4px', height: '4px', background: '#FF453A', borderRadius: '50%', marginBottom: '1px' }} />
            <Compass size={17} color="#FFF" />
            <span style={{ fontSize: '9px', fontWeight: 800, color: '#FFF', position: 'absolute', bottom: '3px' }}>N</span>
          </button>
        </div>
      </div>

      {/* RIGHT SIDE FLOATING BUTTONS (Layers, 3D, Center) */}
      <div
        style={{
          position: 'absolute',
          right: '16px',
          top: '180px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 500,
        }}
      >
        {/* Layer style toggle */}
        <button
          type="button"
          onClick={toggleMapType}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'rgba(24, 24, 27, 0.82)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            position: 'relative',
          }}
          title="Bascule Plan / Satellite"
        >
          <Layers size={19} />
          <span
            style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              background: '#007AFF',
              color: '#FFF',
              fontSize: '10px',
              fontWeight: 800,
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px solid #000',
            }}
          >
            {mapType === 'satellite' ? 'S' : '4'}
          </span>
        </button>

        {/* Locate / Center on user */}
        <button
          type="button"
          onClick={handleCenterOnRunner}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'rgba(24, 24, 27, 0.82)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
          }}
          title="Recentrer sur ma position"
        >
          <Navigation size={19} />
        </button>
      </div>

      {/* FLOATING TELEMETRY CARD (Course à pied • Temps • Vitesse • Distance) - Visible when collapsed */}
      {!isSheetExpanded && (
        <div
          onClick={() => setIsSheetExpanded(true)}
          style={{
            position: 'absolute',
            bottom: 'calc(max(20px, env(safe-area-inset-bottom)) + 92px)',
            left: '16px',
            right: '16px',
            background: 'rgba(22, 22, 24, 0.94)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '18px',
            padding: '14px 16px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
            zIndex: 500,
            cursor: 'pointer',
            transition: 'transform 160ms ease, opacity 160ms ease',
          }}
        >
          {/* Header: Title "Course à pied" + Maximize button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              marginBottom: '12px',
            }}
          >
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.2px' }}>
              Course à pied
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsSheetExpanded(true);
              }}
              style={{
                position: 'absolute',
                right: 0,
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '8px',
                padding: '4px 6px',
                color: '#8E8E93',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
              }}
              title="Ouvrir les graphiques et détails"
            >
              <span>Graphiques</span>
              <Maximize2 size={13} />
            </button>
          </div>

          {/* 3 Metric Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', alignItems: 'center', textAlign: 'center' }}>
            {/* 1. Temps */}
            <div style={{ textAlign: 'left' }}>
              <div
                style={{
                  fontSize: '26px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.5px',
                  lineHeight: 1.1,
                }}
              >
                {formatTime(runDurationSec)}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#8E8E93', marginTop: '4px' }}>
                Temps
              </div>
            </div>

            {/* 2. Vitesse en km/h */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  fontSize: '26px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.5px',
                  lineHeight: 1.1,
                }}
              >
                {formatSpeed()}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#8E8E93',
                  marginTop: '4px',
                  lineHeight: 1.2,
                }}
              >
                Vitesse (km/h)
              </div>
            </div>

            {/* 3. Distance */}
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: '26px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.5px',
                  lineHeight: 1.1,
                }}
              >
                {runDistanceKm.toFixed(2).replace('.', ',')}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#8E8E93', marginTop: '4px' }}>
                Distance (km)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM ACTION DRAWER (EXPANDABLE SHEET) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: isSheetExpanded ? 'rgba(16, 16, 20, 0.98)' : '#0D0D0F',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          padding: isSheetExpanded
            ? '12px 16px calc(max(24px, env(safe-area-inset-bottom)) + 12px) 16px'
            : '8px 16px calc(max(20px, env(safe-area-inset-bottom)) + 12px) 16px',
          zIndex: 600,
          maxHeight: isSheetExpanded ? 'calc(100dvh - 110px)' : '100px',
          overflowY: isSheetExpanded ? 'auto' : 'hidden',
          transition: 'max-height 320ms cubic-bezier(0.16, 1, 0.3, 1), background 200ms ease',
          boxShadow: '0 -8px 30px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Drawer Drag Pill Handle - Interactive Button */}
        <div
          onClick={() => setIsSheetExpanded(!isSheetExpanded)}
          style={{
            cursor: 'pointer',
            padding: '4px 0 10px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
          }}
          title={isSheetExpanded ? 'Réduire' : 'Déplier les métriques et graphiques'}
        >
          <div
            style={{
              width: '42px',
              height: '5px',
              borderRadius: '2.5px',
              background: '#4E4E52',
            }}
          />
          <span style={{ fontSize: '10.5px', color: '#8E8E93', fontWeight: 600 }}>
            {isSheetExpanded ? 'Glisser ou toucher pour réduire ▼' : 'Toucher pour voir les graphiques ▲'}
          </span>
        </div>

        {/* EXPANDED CONTENT: Metrics Grid + Telemetry Charts + Share Button */}
        {isSheetExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
            {/* Secondary 4-Card Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {/* Vitesse Moyenne & Dénivelé */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#8E8E93', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <TrendingUp size={12} color="#007AFF" />
                  <span>Vitesse & Dénivelé</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#FFF' }}>
                    {avgSpeedKmh}
                  </span>
                  <span style={{ fontSize: '11px', color: '#8E8E93' }}>km/h</span>
                  <span style={{ fontSize: '11px', color: '#30D158', marginLeft: 'auto', fontWeight: 700 }}>
                    +{liveElevation} m
                  </span>
                </div>
              </div>

              {/* Cardio & Calories (Clickable to toggle real-time PPG on the ring) */}
              <div
                onClick={toggleLiveHr}
                style={{
                  background: isLiveHrActive ? 'rgba(255, 59, 48, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                  border: isLiveHrActive ? '1px solid rgba(255, 59, 48, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                }}
                title={isLiveHrActive ? "Cardio en direct actif (Toucher pour arrêter)" : "Toucher pour activer la mesure cardio en direct"}
              >
                <div style={{ fontSize: '11px', color: '#8E8E93', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Heart size={12} color="#FF453A" fill={isLiveHrActive ? "#FF453A" : "none"} />
                    <span>Cardio & Énergie</span>
                  </div>
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '8px',
                      background: isLiveHrActive ? 'rgba(255, 59, 48, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                      color: isLiveHrActive ? '#FF453A' : '#8E8E93',
                      letterSpacing: '0.3px',
                    }}
                  >
                    {isLiveHrActive ? 'LIVE' : 'ACTIVER'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#FFF' }}>
                    {liveHr > 40 ? liveHr : '--'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#8E8E93' }}>bpm</span>
                  <span style={{ fontSize: '11px', color: '#FF9F0A', marginLeft: 'auto', fontWeight: 700 }}>
                    {liveCalories} kcal
                  </span>
                </div>
              </div>
            </div>

            {/* Complete Interactive Telemetry Charts (Distance, Vitesse, BPM) */}
            <RunTelemetryCharts
              runState={runState}
              runDurationSec={runDurationSec}
              runDistanceKm={runDistanceKm}
              liveSpeedKmh={liveSpeedKmh || 0}
              liveHr={liveHr || 0}
              telemetryHistory={telemetryHistory}
            />

            {/* Partager Ma Course CTA */}
            {onOpenStory && (
              <button
                type="button"
                onClick={onOpenStory}
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '24px',
                  background: '#FFFFFF',
                  border: 'none',
                  color: '#000000',
                  fontSize: '15px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(255, 255, 255, 0.18)',
                }}
              >
                <Share2 size={16} />
                <span>Partager Ma Course</span>
              </button>
            )}
          </div>
        )}

        {/* RUNNING STATE: Full-Width Bright Orange "❚❚ Pause" Button */}
        {runState === 'running' && (
          <button
            type="button"
            onClick={onPause}
            style={{
              width: '100%',
              height: '54px',
              borderRadius: '27px',
              background: '#FC5200', // Iconic Strava / Apple Fitness orange
              border: 'none',
              color: '#FFFFFF',
              fontSize: '18px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(252, 82, 0, 0.45)',
              transition: 'transform 120ms ease, filter 120ms ease',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <Pause size={20} fill="#FFFFFF" strokeWidth={0} />
            <span>Pause</span>
          </button>
        )}

        {/* PAUSED STATE: "Reprendre" (Orange) + "Terminer" (Dark/Red) */}
        {runState === 'paused' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              type="button"
              onClick={onResume}
              style={{
                height: '54px',
                borderRadius: '27px',
                background: '#FC5200',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(252, 82, 0, 0.4)',
              }}
            >
              <Play size={18} fill="#FFFFFF" />
              <span>Reprendre</span>
            </button>

            <button
              type="button"
              onClick={onStop}
              style={{
                height: '54px',
                borderRadius: '27px',
                background: '#242426',
                border: '1px solid rgba(255, 69, 58, 0.35)',
                color: '#FF453A',
                fontSize: '16px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <Square size={16} fill="currentColor" />
              <span>Terminer</span>
            </button>
          </div>
        )}

        {/* FINISHED STATE */}
        {runState === 'finished' && (
          <button
            type="button"
            onClick={onStop}
            style={{
              width: '100%',
              height: '54px',
              borderRadius: '27px',
              background: '#30D158',
              border: 'none',
              color: '#000000',
              fontSize: '17px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <span>Voir le récapitulatif</span>
          </button>
        )}
      </div>

      {/* SETTINGS MODAL DIALOG */}
      {isSettingsOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 900,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            animation: 'fadeIn 200ms ease',
          }}
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#161618',
              borderTop: '1px solid rgba(255, 255, 255, 0.12)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '20px 20px calc(max(24px, env(safe-area-inset-bottom)) + 16px) 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#FFF', margin: 0 }}>Réglages Course GPS</h3>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Cardio Live Bague */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFF' }}>Cardio Live (Bague)</span>
                <span style={{ fontSize: '11px', color: '#8E8E93' }}>Capteur optique en continu</span>
              </div>
              <button
                type="button"
                onClick={toggleLiveHr}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  background: isLiveHrActive ? '#FF3B30' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#FFF',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isLiveHrActive ? 'Actif ❤️' : 'Activer'}
              </button>
            </div>

            {/* Toggle Map Satellite / Dark */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFF' }}>Vue Satellite</span>
              <button
                type="button"
                onClick={toggleMapType}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  background: mapType === 'satellite' ? '#007AFF' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#FFF',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {mapType === 'satellite' ? 'Activée (Satellite)' : 'Plan Sombre'}
              </button>
            </div>

            {/* Recentrer GPS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFF' }}>Position Coureur</span>
              <button
                type="button"
                onClick={() => {
                  handleCenterOnRunner();
                  setIsSettingsOpen(false);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#FFF',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Recentrer 🎯
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};
