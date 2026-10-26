import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronDown, Settings, Compass, Layers, Navigation, Maximize2, Pause, Play, Square, Zap, X } from 'lucide-react';
import { initAppleMapKit, cleanMapAttributions } from '../lib/appleMapKit';

interface LiveRunningViewProps {
  runState: 'idle' | 'running' | 'paused' | 'finished';
  runDurationSec: number;
  runDistanceKm: number;
  liveSpeedKmh?: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onClose: () => void;
  isFastDemo?: boolean;
  onToggleFastDemo?: () => void;
}

const MONCEAU_CENTER: [number, number] = [48.8796, 2.3089];

const REAL_ROUTE_POINTS: { lat: number; lng: number; km?: number; pace?: string }[] = [
  { lat: 48.88092, lng: 2.30895, km: 0, pace: '5:19' },      // Départ
  { lat: 48.88055, lng: 2.30735, km: 1, pace: '5:19' },      // Km 1
  { lat: 48.87985, lng: 2.30615, km: 2, pace: '5:21' },      // Km 2
  { lat: 48.87900, lng: 2.30620, km: 3, pace: '5:14' },      // Km 3
  { lat: 48.87825, lng: 2.30730, km: 4, pace: '5:18' },      // Km 4
  { lat: 48.87805, lng: 2.30895, km: 5, pace: '5:10' },      // Km 5
  { lat: 48.87830, lng: 2.31065, km: 6, pace: '5:05' },      // Km 6
  { lat: 48.87925, lng: 2.31175, km: 7, pace: '5:00' },      // Km 7
  { lat: 48.88020, lng: 2.31140, km: 8, pace: '4:48' },      // Km 8
  { lat: 48.88075, lng: 2.31015 },
  { lat: 48.88092, lng: 2.30895, pace: '4:48' },             // Arrivée
];

const TILES_DARK = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILES_DARK_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
const TILES_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const LiveRunningView: React.FC<LiveRunningViewProps> = ({
  runState,
  runDurationSec,
  runDistanceKm,
  liveSpeedKmh,
  onPause,
  onResume,
  onStop,
  onClose,
  isFastDemo = false,
  onToggleFastDemo,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [realGpsPoints, setRealGpsPoints] = useState<[number, number][]>([]);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
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

  // Progress computation (total 8.12 km loop or dynamic)
  const currentProg = Math.max(0, Math.min(1, runDistanceKm / 8.12));

  // Compute live runner location
  const getRunnerLatLng = (prog: number): [number, number] => {
    if (realGpsPoints.length > 0) {
      return realGpsPoints[realGpsPoints.length - 1];
    }
    if (userPosition && (prog <= 0 || runState === 'idle')) {
      return userPosition;
    }
    if (prog <= 0) return userPosition || [REAL_ROUTE_POINTS[0].lat, REAL_ROUTE_POINTS[0].lng];
    if (prog >= 1) {
      const last = REAL_ROUTE_POINTS[REAL_ROUTE_POINTS.length - 1];
      return [last.lat, last.lng];
    }
    const totalSegments = REAL_ROUTE_POINTS.length - 1;
    const segmentIndex = prog * totalSegments;
    const i = Math.floor(segmentIndex);
    const t = segmentIndex - i;
    const p1 = REAL_ROUTE_POINTS[i];
    const p2 = REAL_ROUTE_POINTS[Math.min(i + 1, totalSegments)];
    return [
      p1.lat + (p2.lat - p1.lat) * t,
      p1.lng + (p2.lng - p1.lng) * t,
    ];
  };

  // Compute active trail points
  const getActiveTrailPoints = (): [number, number][] => {
    if (realGpsPoints.length > 1) {
      return realGpsPoints;
    }
    if (currentProg <= 0) return [];
    if (currentProg >= 1) return REAL_ROUTE_POINTS.map(p => [p.lat, p.lng]);

    const totalSegments = REAL_ROUTE_POINTS.length - 1;
    const segmentIndex = currentProg * totalSegments;
    const i = Math.floor(segmentIndex);
    const t = segmentIndex - i;

    const trail: [number, number][] = [];
    for (let idx = 0; idx <= i; idx++) {
      trail.push([REAL_ROUTE_POINTS[idx].lat, REAL_ROUTE_POINTS[idx].lng]);
    }
    if (t > 0 && i < totalSegments) {
      const p1 = REAL_ROUTE_POINTS[i];
      const p2 = REAL_ROUTE_POINTS[i + 1];
      trail.push([
        p1.lat + (p2.lat - p1.lat) * t,
        p1.lng + (p2.lng - p1.lng) * t,
      ]);
    }
    return trail;
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
      const initialCenter: [number, number] = userPosition || MONCEAU_CENTER;
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
    const runnerPos = getRunnerLatLng(currentProg);
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

  // Center on Runner
  const handleCenterOnRunner = () => {
    const runnerPos = getRunnerLatLng(currentProg);
    if (appleMapInstanceRef.current && (window as any).mapkit) {
      const mapkit = (window as any).mapkit;
      appleMapInstanceRef.current.setCenterAnimated(new mapkit.Coordinate(runnerPos[0], runnerPos[1]));
    }
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

  // Calculate live speed in km/h
  const formatSpeed = () => {
    if (typeof liveSpeedKmh === 'number' && liveSpeedKmh > 0) {
      return liveSpeedKmh.toFixed(1).replace('.', ',');
    }
    if (runDistanceKm < 0.005 || runDurationSec < 1) return '0,0';
    const spd = (runDistanceKm / runDurationSec) * 3600;
    return spd.toFixed(1).replace('.', ',');
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 9999,
        background: '#0B0B0D',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
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
          top: '54px',
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

        {/* Top-Right: Settings & Heading Compass */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
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

      {/* SPEED DEMO TOGGLE PILL (Discreet upper right under compass) */}
      {onToggleFastDemo && (
        <button
          type="button"
          onClick={onToggleFastDemo}
          style={{
            position: 'absolute',
            top: '110px',
            right: '16px',
            zIndex: 500,
            background: isFastDemo ? 'rgba(252, 82, 0, 0.35)' : 'rgba(24, 24, 27, 0.75)',
            backdropFilter: 'blur(14px)',
            border: isFastDemo ? '1px solid #FC5200' : '1px solid rgba(255,255,255,0.1)',
            color: isFastDemo ? '#FC5200' : '#8E8E93',
            fontSize: '10px',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
          }}
        >
          <Zap size={11} fill={isFastDemo ? '#FC5200' : 'none'} />
          <span>{isFastDemo ? 'Démo 15x' : '1x'}</span>
        </button>
      )}

      {/* FLOATING TELEMETRY CARD (Course à pied • Temps • Allure • Distance) */}
      <div
        style={{
          position: 'absolute',
          bottom: '108px',
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
        }}
      >
        {/* Header: Title "Course à pied" + Maximize icon */}
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
          <div style={{ position: 'absolute', right: 0, color: '#8E8E93' }}>
            <Maximize2 size={15} />
          </div>
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

      {/* BOTTOM ACTION DRAWER WITH VIBRANT ORANGE PAUSE BUTTON */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#0D0D0F',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          borderTopLeftRadius: '22px',
          borderTopRightRadius: '22px',
          padding: '8px 16px 24px 16px',
          zIndex: 600,
        }}
      >
        {/* Drawer Drag Pill Handle */}
        <div
          style={{
            width: '38px',
            height: '4px',
            borderRadius: '2px',
            background: '#3A3A3C',
            margin: '0 auto 12px auto',
          }}
        />

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
            onClick={onClose}
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
    </div>
  );
};
