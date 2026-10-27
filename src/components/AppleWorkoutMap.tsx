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
  realGpsPoints?: [number, number][];
  userPosition?: [number, number] | null;
}

const DEFAULT_MAP_CENTER: [number, number] = [48.8566, 2.3522];

const TILES_DARK = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILES_DARK_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
const TILES_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const AppleWorkoutMap: React.FC<AppleWorkoutMapProps> = ({
  progress = 0,
  runState = 'idle',
  distanceKm = 0,
  realGpsPoints: propRealGpsPoints,
  userPosition: propUserPosition,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Real GPS live tracking points recorded during workout
  const [internalGpsPoints, setInternalGpsPoints] = useState<[number, number][]>([]);

  // Apple MapKit state & refs
  const [isAppleMapKitActive, setIsAppleMapKitActive] = useState<boolean>(false);
  const appleMapInstanceRef = useRef<any>(null);
  const applePolylineRef = useRef<any>(null);
  const appleRunnerAnnotationRef = useRef<any>(null);
  const appleStartAnnotationRef = useRef<any>(null);
  const appleFinishAnnotationRef = useRef<any>(null);

  // Leaflet refs
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletTileRef = useRef<L.TileLayer | null>(null);
  const leafletLabelsRef = useRef<L.TileLayer | null>(null);
  const leafletPolylineRef = useRef<L.Polyline | null>(null);
  const leafletGlowPolyRef = useRef<L.Polyline | null>(null);
  const leafletRunnerRef = useRef<L.Marker | null>(null);
  const leafletStartMarkerRef = useRef<L.Marker | null>(null);
  const leafletFinishMarkerRef = useRef<L.Marker | null>(null);

  const [mapType, setMapType] = useState<'dark' | 'satellite'>('dark');
  const [activeSplit, setActiveSplit] = useState<number | null>(null);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(() => propUserPosition || null);
  const [isCentering, setIsCentering] = useState<boolean>(false);

  // Sync prop userPosition
  useEffect(() => {
    if (propUserPosition) {
      setUserPosition(propUserPosition);
    }
  }, [propUserPosition]);

  // Compute active trail points: STRICTLY the user's recorded GPS points
  const getActiveTrailPoints = (): [number, number][] => {
    if (runState === 'idle') {
      return [];
    }
    const points = propRealGpsPoints && propRealGpsPoints.length > 0
      ? propRealGpsPoints
      : internalGpsPoints;
    return points;
  };

  // Compute runner position
  const getRunnerLatLng = (): [number, number] => {
    const trail = getActiveTrailPoints();
    if (trail.length > 0) {
      return trail[trail.length - 1];
    }
    if (propUserPosition) return propUserPosition;
    if (userPosition) return userPosition;
    return DEFAULT_MAP_CENTER;
  };

  // Fallback GPS watcher if parent didn't supply points
  useEffect(() => {
    if (runState !== 'running') {
      if (runState === 'idle') setInternalGpsPoints([]);
      return;
    }
    if (propRealGpsPoints && propRealGpsPoints.length > 0) return;
    if (!('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (accuracy <= 70) {
          setInternalGpsPoints((prev) => [...prev, [latitude, longitude]]);
        }
      },
      (err) => console.log('GPS tracking notice:', err.message),
      { enableHighAccuracy: true, maximumAge: 1000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [runState, propRealGpsPoints]);

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
      const initialCenter: [number, number] = userPosition || DEFAULT_MAP_CENTER;
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
          } catch (e) {
            console.warn('MapKit JS init fallback to Leaflet:', e);
          }
        }
      }

      // Fallback: Leaflet Dark Slate
      if (cancelled || !containerRef.current) return;
      try {
        const map = L.map(containerRef.current, {
          center: initialCenter,
          zoom: 17,
          zoomControl: false,
          attributionControl: false,
        });

        const tileLayer = L.tileLayer(TILES_DARK, {
          maxZoom: 19,
          subdomains: ['server', 'services'],
        }).addTo(map);
        leafletTileRef.current = tileLayer;

        const labelLayer = L.tileLayer(TILES_DARK_LABELS, {
          maxZoom: 19,
          opacity: 0.85,
        }).addTo(map);
        leafletLabelsRef.current = labelLayer;

        // Dynamic polyline (halo + core)
        const glowPoly = L.polyline([], {
          color: '#30D158',
          weight: 12,
          opacity: 0.25,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
        leafletGlowPolyRef.current = glowPoly;

        const poly = L.polyline([], {
          color: '#30D158',
          weight: 4.5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
        leafletPolylineRef.current = poly;

        // Runner location pulsing dot
        const runnerIcon = L.divIcon({
          className: 'apple-map-runner-icon',
          html: `
            <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
              <div style="position:absolute;width:22px;height:22px;background:rgba(0,122,255,0.35);border-radius:50%;animation:pulseGlow 2s infinite ease-out;"></div>
              <div style="width:14px;height:14px;background:#007AFF;border:2.5px solid #FFFFFF;border-radius:50%;box-shadow:0 0 8px rgba(0,122,255,0.9);position:relative;z-index:2;"></div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const runnerMarker = L.marker(initialCenter, { icon: runnerIcon }).addTo(map);
        leafletRunnerRef.current = runnerMarker;

        leafletMapRef.current = map;
      } catch (err) {
        console.warn('Leaflet map init warning:', err);
      }
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

  // DYNAMIC TRACKING UPDATE: Strictly draws user's actual GPS trajectory
  useEffect(() => {
    const runnerPos = getRunnerLatLng();
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

      // Start Marker
      if (trailPoints.length >= 2 && !appleStartAnnotationRef.current) {
        const startCoord = new mapkit.Coordinate(trailPoints[0][0], trailPoints[0][1]);
        const startMarker = new mapkit.MarkerAnnotation(startCoord, {
          color: '#FFFFFF',
          glyphText: 'A',
          title: 'Départ',
        });
        map.addAnnotation(startMarker);
        appleStartAnnotationRef.current = startMarker;
      } else if (trailPoints.length < 2 && appleStartAnnotationRef.current) {
        map.removeAnnotation(appleStartAnnotationRef.current);
        appleStartAnnotationRef.current = null;
      }

      // Update or create active polyline
      if (trailPoints.length >= 2) {
        const coords = trailPoints.map((p) => new mapkit.Coordinate(p[0], p[1]));
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

      // Finish marker when complete
      if (runState === 'finished' && trailPoints.length >= 2 && !appleFinishAnnotationRef.current) {
        const lastPt = trailPoints[trailPoints.length - 1];
        const finishCoord = new mapkit.Coordinate(lastPt[0], lastPt[1]);
        const finishMarker = new mapkit.MarkerAnnotation(finishCoord, {
          color: '#FF453A',
          glyphText: 'B',
          title: 'Arrivée',
        });
        map.addAnnotation(finishMarker);
        appleFinishAnnotationRef.current = finishMarker;

        // Auto-fit completed trail in full view
        if (applePolylineRef.current) {
          try {
            map.showItems([applePolylineRef.current], {
              animate: true,
              padding: new mapkit.Padding(30, 30, 30, 30),
            });
          } catch (e) {}
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

      // Start pin
      if (trailPoints.length >= 2 && !leafletStartMarkerRef.current) {
        const startIcon = L.divIcon({
          className: 'apple-map-pin start-pin',
          html: `<div style="width:12px;height:12px;background:#FFF;border:2.5px solid #000;border-radius:50%;box-shadow:0 0 8px rgba(255,255,255,0.8);"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        const m = L.marker(trailPoints[0], { icon: startIcon }).addTo(map);
        leafletStartMarkerRef.current = m;
      } else if (trailPoints.length < 2 && leafletStartMarkerRef.current) {
        map.removeLayer(leafletStartMarkerRef.current);
        leafletStartMarkerRef.current = null;
      }

      // Update dynamic trail
      if (leafletPolylineRef.current && leafletGlowPolyRef.current) {
        leafletPolylineRef.current.setLatLngs(trailPoints);
        leafletGlowPolyRef.current.setLatLngs(trailPoints);
      }

      // Finish pin when complete
      if (runState === 'finished' && trailPoints.length >= 2 && !leafletFinishMarkerRef.current) {
        const lastPt = trailPoints[trailPoints.length - 1];
        const finishIcon = L.divIcon({
          className: 'apple-map-pin finish-pin',
          html: `<div style="width:14px;height:14px;background:#FF453A;border:2px solid #FFF;border-radius:50%;box-shadow:0 0 10px rgba(255,69,58,0.9);"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const m = L.marker(lastPt, { icon: finishIcon }).addTo(map);
        leafletFinishMarkerRef.current = m;

        // Auto-fit bounds on completion
        map.fitBounds(L.latLngBounds(trailPoints), { padding: [30, 30], animate: true });
      } else if (runState !== 'finished' && leafletFinishMarkerRef.current) {
        map.removeLayer(leafletFinishMarkerRef.current);
        leafletFinishMarkerRef.current = null;
      }
    }
  }, [distanceKm, runState, propRealGpsPoints, internalGpsPoints, userPosition]);

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

    const currentCoords = getRunnerLatLng();

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
              border: '1px solid rgba(255,255,255,0.18)',
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
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#30D158' }}>
              {run.splitsSec[activeSplit - 1] ? fmtMMSS(run.splitsSec[activeSplit - 1]) : '5:09'} /km
            </span>
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
