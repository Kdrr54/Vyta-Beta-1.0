import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { run } from '../data/fit';
import { fmtMMSS } from '../lib/format';
import { initAppleMapKit, cleanMapAttributions } from '../lib/appleMapKit';
import { Layers, LocateFixed } from 'lucide-react';

interface AppleWorkoutMapProps {
  onOpenStory?: () => void;
  progress?: number;
  runState?: 'idle' | 'running' | 'paused' | 'finished';
  distanceKm?: number;
}

interface RouteWaypoint {
  lat: number;
  lng: number;
  km?: number;
  pace?: string;
  isPR?: boolean;
}

const MONCEAU_CENTER: [number, number] = [48.8796, 2.3089];

const REAL_ROUTE_POINTS: RouteWaypoint[] = [
  { lat: 48.88092, lng: 2.30895, km: 0, pace: '5:19' },      // Départ
  { lat: 48.88055, lng: 2.30735, km: 1, pace: '5:19' },      // Km 1
  { lat: 48.87985, lng: 2.30615, km: 2, pace: '5:21' },      // Km 2
  { lat: 48.87900, lng: 2.30620, km: 3, pace: '5:14' },      // Km 3
  { lat: 48.87825, lng: 2.30730, km: 4, pace: '5:18' },      // Km 4
  { lat: 48.87805, lng: 2.30895, km: 5, pace: '5:10' },      // Km 5
  { lat: 48.87830, lng: 2.31065, km: 6, pace: '5:05' },      // Km 6
  { lat: 48.87925, lng: 2.31175, km: 7, pace: '5:00' },      // Km 7
  { lat: 48.88020, lng: 2.31140, km: 8, pace: '4:48', isPR: true }, // Km 8 (Sprint PR ★)
  { lat: 48.88075, lng: 2.31015 },
  { lat: 48.88092, lng: 2.30895, pace: '4:48' },             // Arrivée
];

const TILES_DARK = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILES_DARK_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
const TILES_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const AppleWorkoutMap: React.FC<AppleWorkoutMapProps> = ({
  progress = 0,
  runState = 'idle',
  distanceKm = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Real GPS live tracking points recorded during workout
  const [realGpsPoints, setRealGpsPoints] = useState<[number, number][]>([]);

  // Apple MapKit state & refs
  const [isAppleMapKitActive, setIsAppleMapKitActive] = useState<boolean>(false);
  const appleMapInstanceRef = useRef<any>(null);
  const applePolylineRef = useRef<any>(null);
  const appleRunnerAnnotationRef = useRef<any>(null);
  const appleKmAnnotationsRef = useRef<Map<number, any>>(new Map());
  const appleFinishAnnotationRef = useRef<any>(null);

  // Leaflet refs
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletTileRef = useRef<L.TileLayer | null>(null);
  const leafletLabelsRef = useRef<L.TileLayer | null>(null);
  const leafletPolylineRef = useRef<L.Polyline | null>(null);
  const leafletGlowPolyRef = useRef<L.Polyline | null>(null);
  const leafletRunnerRef = useRef<L.Marker | null>(null);
  const leafletKmMarkersRef = useRef<Map<number, L.Marker>>(new Map());
  const leafletFinishMarkerRef = useRef<L.Marker | null>(null);

  const [mapType, setMapType] = useState<'dark' | 'satellite'>('dark');
  const [activeSplit, setActiveSplit] = useState<number | null>(null);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [isCentering, setIsCentering] = useState<boolean>(false);

  // Progression calculation: 0 when idle, strictly 0 to 1
  const currentProg = runState === 'idle' ? 0 : Math.max(0, Math.min(1, progress));

  // Compute runner position
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

  // Compute active trail points (drawn only as runner advances)
  const getActiveTrailPoints = (): [number, number][] => {
    if (runState === 'idle') {
      return [];
    }
    if (realGpsPoints.length > 1) {
      return realGpsPoints;
    }
    if (currentProg <= 0) {
      return [];
    }
    if (currentProg >= 1 || runState === 'finished') {
      return REAL_ROUTE_POINTS.map(p => [p.lat, p.lng]);
    }

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

  // Real GPS Geolocation Watcher when running outdoors
  useEffect(() => {
    if (runState !== 'running') {
      if (runState === 'idle') setRealGpsPoints([]);
      return;
    }
    if (!('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (accuracy <= 30) {
          setRealGpsPoints(prev => [...prev, [latitude, longitude]]);
        }
      },
      (err) => console.log('GPS tracking notice:', err.message),
      { enableHighAccuracy: true, maximumAge: 1000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [runState]);

  // Immediate auto-geolocation to place map directly on user's real coordinates
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

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
      (err) => console.log('Auto-locate note:', err.message),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 5000 }
    );
  }, []);

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

            // Live runner icon (discrete GPS point)
            const startCoord = new mapkit.Coordinate(initialCenter[0], initialCenter[1]);
            const runnerAnnotation = new mapkit.MarkerAnnotation(startCoord, {
              color: '#007AFF',
              glyphText: '',
            });
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

      // Dynamic trail polyline (empty initially)
      const glowPoly = L.polyline([], {
        color: '#30D158',
        weight: 9,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      leafletGlowPolyRef.current = glowPoly;

      const mainPoly = L.polyline([], {
        color: '#30D158',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      leafletPolylineRef.current = mainPoly;

      // Live runner marker
      const runnerIcon = L.divIcon({
        className: 'apple-map-runner-icon',
        html: `
          <div class="runner-radar-container" style="position:relative;width:26px;height:26px;">
            <div class="runner-radar-wave" style="position:absolute;inset:0;border-radius:50%;background:rgba(48,209,88,0.4);animation:runnerPulse 1.8s infinite ease-out;"></div>
            <div style="position:absolute;top:5px;left:5px;width:16px;height:16px;background:#30D158;border:2.5px solid #FFF;border-radius:50%;box-shadow:0 0 12px rgba(48,209,88,1);"></div>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const runnerMarker = L.marker(initialCenter, { icon: runnerIcon, zIndexOffset: 1000 }).addTo(map);
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

  // DYNAMIC TRACKING UPDATE: Draws route in real-time as runner advances
  useEffect(() => {
    const runnerPos = getRunnerLatLng(currentProg);
    const trailPoints = getActiveTrailPoints();

    // 1. UPDATE APPLE MAPKIT JS
    if (appleMapInstanceRef.current && (window as any).mapkit) {
      const mapkit = (window as any).mapkit;
      const map = appleMapInstanceRef.current;

      // Update runner position
      if (appleRunnerAnnotationRef.current) {
        appleRunnerAnnotationRef.current.coordinate = new mapkit.Coordinate(runnerPos[0], runnerPos[1]);
        if (runState === 'running') {
          map.setCenterAnimated(new mapkit.Coordinate(runnerPos[0], runnerPos[1]));
        }
      }

      // Update or create active polyline
      if (trailPoints.length >= 2) {
        const coords = trailPoints.map(p => new mapkit.Coordinate(p[0], p[1]));
        if (applePolylineRef.current) {
          map.removeOverlay(applePolylineRef.current);
        }
        const poly = new mapkit.PolylineOverlay(coords, {
          style: new mapkit.Style({
            strokeColor: '#30D158',
            lineWidth: 5.5,
            lineJoin: 'round',
            lineCap: 'round',
          }),
        });
        map.addOverlay(poly);
        applePolylineRef.current = poly;
      } else if (trailPoints.length < 2 && applePolylineRef.current) {
        map.removeOverlay(applePolylineRef.current);
        applePolylineRef.current = null;
      }

      // Dynamically drop Milestone Km Markers ONLY when distance reached
      REAL_ROUTE_POINTS.filter(p => p.km && p.km > 0).forEach(p => {
        const hasPassedKm = (runState === 'finished') || (distanceKm >= p.km!);
        const isAlreadyAdded = appleKmAnnotationsRef.current.has(p.km!);

        if (hasPassedKm && !isAlreadyAdded) {
          const marker = new mapkit.MarkerAnnotation(new mapkit.Coordinate(p.lat, p.lng), {
            color: p.isPR ? '#FFD60A' : '#FFFFFF',
            glyphText: String(p.km),
            title: `Km ${p.km}`,
            subtitle: p.isPR ? 'Record ★ (4:48 /km)' : `${p.pace} /km`,
          });
          map.addAnnotation(marker);
          appleKmAnnotationsRef.current.set(p.km!, marker);
        } else if (!hasPassedKm && isAlreadyAdded) {
          map.removeAnnotation(appleKmAnnotationsRef.current.get(p.km!));
          appleKmAnnotationsRef.current.delete(p.km!);
        }
      });

      // Finish marker when complete
      if (runState === 'finished' && !appleFinishAnnotationRef.current) {
        const finishCoord = new mapkit.Coordinate(REAL_ROUTE_POINTS[REAL_ROUTE_POINTS.length - 1].lat, REAL_ROUTE_POINTS[REAL_ROUTE_POINTS.length - 1].lng);
        const finishMarker = new mapkit.MarkerAnnotation(finishCoord, {
          color: '#FF453A',
          glyphText: '🏁',
          title: 'Arrivée de la course',
        });
        map.addAnnotation(finishMarker);
        appleFinishAnnotationRef.current = finishMarker;

        // Auto-fit completed trail in full view
        if (applePolylineRef.current) {
          try {
            map.showItems([applePolylineRef.current], {
              animate: true,
              padding: new mapkit.Padding(25, 25, 25, 25),
            });
          } catch (e) {
            // Ignore if showItems fails
          }
        }
      } else if (runState !== 'finished' && appleFinishAnnotationRef.current) {
        map.removeAnnotation(appleFinishAnnotationRef.current);
        appleFinishAnnotationRef.current = null;
      }
    }

    // 2. UPDATE LEAFLET FALLBACK
    if (leafletMapRef.current) {
      const map = leafletMapRef.current;

      // Update runner marker & follow camera
      if (leafletRunnerRef.current) {
        leafletRunnerRef.current.setLatLng(runnerPos);
        if (runState === 'running') {
          map.panTo(runnerPos, { animate: true, duration: 0.5 });
        }
      }

      // Update dynamic trail
      if (leafletPolylineRef.current && leafletGlowPolyRef.current) {
        leafletPolylineRef.current.setLatLngs(trailPoints);
        leafletGlowPolyRef.current.setLatLngs(trailPoints);
      }

      // Dynamically drop Km badges
      REAL_ROUTE_POINTS.filter(p => p.km && p.km > 0).forEach(p => {
        const hasPassedKm = (runState === 'finished') || (distanceKm >= p.km!);
        const isAlreadyAdded = leafletKmMarkersRef.current.has(p.km!);

        if (hasPassedKm && !isAlreadyAdded) {
          const isPR = p.isPR;
          const kmIcon = L.divIcon({
            className: 'apple-map-km-badge',
            html: `<div style="width:18px;height:18px;background:${isPR ? '#FFD60A' : '#FFF'};color:#000;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border-radius:50%;border:1.5px solid #000;box-shadow:0 2px 6px rgba(0,0,0,0.5);cursor:pointer;font-family:-apple-system,sans-serif;">${p.km}</div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          const marker = L.marker([p.lat, p.lng], { icon: kmIcon }).addTo(map);
          marker.on('click', () => setActiveSplit(p.km!));
          leafletKmMarkersRef.current.set(p.km!, marker);
        } else if (!hasPassedKm && isAlreadyAdded) {
          map.removeLayer(leafletKmMarkersRef.current.get(p.km!)!);
          leafletKmMarkersRef.current.delete(p.km!);
        }
      });

      // Finish pin when complete
      if (runState === 'finished' && !leafletFinishMarkerRef.current) {
        const finishIcon = L.divIcon({
          className: 'apple-map-pin finish-pin',
          html: `<div style="width:14px;height:14px;background:#FF453A;border:2px solid #FFF;border-radius:50%;box-shadow:0 0 10px rgba(255,69,58,0.9);"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const m = L.marker([REAL_ROUTE_POINTS[REAL_ROUTE_POINTS.length - 1].lat, REAL_ROUTE_POINTS[REAL_ROUTE_POINTS.length - 1].lng], { icon: finishIcon }).addTo(map);
        leafletFinishMarkerRef.current = m;

        // Auto-fit bounds on completion
        if (trailPoints.length >= 2) {
          map.fitBounds(L.latLngBounds(trailPoints), { padding: [25, 25], animate: true });
        }
      } else if (runState !== 'finished' && leafletFinishMarkerRef.current) {
        map.removeLayer(leafletFinishMarkerRef.current);
        leafletFinishMarkerRef.current = null;
      }
    }
  }, [currentProg, distanceKm, runState, realGpsPoints]);

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

  // Recentrer la carte sur la position GPS réelle de l'utilisateur
  const handleRecenter = () => {
    setIsCentering(true);
    setTimeout(() => setIsCentering(false), 800);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(20);
      } catch (_) {}
    }

    const currentCoords = getRunnerLatLng(currentProg);

    const applyCenter = (lat: number, lng: number) => {
      setUserPosition([lat, lng]);

      if (appleMapInstanceRef.current && (window as any).mapkit) {
        const mapkit = (window as any).mapkit;
        appleMapInstanceRef.current.setRegionAnimated(
          new mapkit.CoordinateRegion(
            new mapkit.Coordinate(lat, lng),
            new mapkit.CoordinateSpan(0.0035, 0.0055)
          ),
          true
        );
        if (appleRunnerAnnotationRef.current) {
          appleRunnerAnnotationRef.current.coordinate = new mapkit.Coordinate(lat, lng);
        }
      }

      if (leafletMapRef.current) {
        leafletMapRef.current.setView([lat, lng], 17, { animate: true });
        if (leafletRunnerRef.current) {
          leafletRunnerRef.current.setLatLng([lat, lng]);
        }
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          applyCenter(latitude, longitude);
        },
        (err) => {
          console.log('Recenter notice:', err.message);
          applyCenter(currentCoords[0], currentCoords[1]);
        },
        { enableHighAccuracy: true, timeout: 3500, maximumAge: 2000 }
      );
    } else {
      applyCenter(currentCoords[0], currentCoords[1]);
    }
  };

  return (
    <div className="apple-maps-card-wrapper">
      {/* Map Stage Container */}
      <div
        className="apple-maps-stage"
        style={{
          position: 'relative',
          height: '260px',
        }}
      >
        {/* Real Official Apple MapKit JS Canvas */}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            background: '#151518',
          }}
        />

        {/* Floating Split Tooltip */}
        {activeSplit && (
          <div
            className="apple-map-split-tooltip"
            style={{
              position: 'absolute',
              top: '52px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(24, 24, 27, 0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: activeSplit === 8 ? '1px solid rgba(255, 214, 10, 0.6)' : '1px solid rgba(255,255,255,0.18)',
              borderRadius: '12px',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 1000,
              boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>Km {activeSplit}</span>
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: activeSplit === 8 ? '#FFD60A' : '#30D158' }}>
              {run.splitsSec[activeSplit - 1] ? fmtMMSS(run.splitsSec[activeSplit - 1]) : '5:09'} /km
            </span>
            {activeSplit === 8 && (
              <span style={{ fontSize: '10px', background: 'rgba(255, 214, 10, 0.2)', color: '#FFD60A', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                RECORD ★
              </span>
            )}
            <button
              onClick={() => setActiveSplit(null)}
              style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '0 0 0 4px', fontSize: '12px' }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Top Map Options (Recentrer + Satellite/Plan) */}
      <div className="apple-maps-controls-bar" style={{ justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Bouton pour recentrer sur l'utilisateur */}
          <button
            type="button"
            className={`map-control-pill ${isCentering ? 'active' : ''}`}
            onClick={handleRecenter}
            title="Recentrer sur ma position"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease',
            }}
          >
            <LocateFixed
              size={11}
              color={isCentering ? '#007AFF' : '#007AFF'}
              style={{
                filter: 'drop-shadow(0 0 4px rgba(0, 122, 255, 0.6))',
              }}
            />
            <span>Recentrer</span>
          </button>

          {/* Satellite Layer Toggle */}
          <button
            type="button"
            className={`map-control-pill ${mapType === 'satellite' ? 'active' : ''}`}
            onClick={toggleMapType}
            title="Bascule Plan Sombre / Satellite"
          >
            <Layers size={11} />
            <span>{mapType === 'satellite' ? 'Satellite' : 'Plan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
