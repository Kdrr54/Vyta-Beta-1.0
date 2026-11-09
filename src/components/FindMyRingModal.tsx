import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { finishes } from '../data/health';
import { initAppleMapKit, cleanMapAttributions } from '../lib/appleMapKit';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  X,
  Navigation,
  Volume2,
  Radio,
  Layers,
  LocateFixed,
  Battery,
  ChevronLeft,
  Sparkles,
  MapPin,
  Disc,
} from 'lucide-react';

interface FindMyRingModalProps {
  onClose: () => void;
  onBack?: () => void;
}

// Position par défaut de référence (Paris)
const DEFAULT_COORDS: [number, number] = [48.8566, 2.3522];

const TILES_DARK = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILES_DARK_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
const TILES_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const FindMyRingModal: React.FC<FindMyRingModalProps> = ({ onClose, onBack }) => {
  const { ring, finish, language } = useApp();
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const isEn = language === 'en';
  const currentFinish = finishes.find((f) => f.id === finish) || finishes[1];

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const appleMapInstanceRef = useRef<any>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const appleMarkerRef = useRef<any>(null);
  const leafletMarkerRef = useRef<L.Marker | null>(null);

  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [coords, setCoords] = useState<[number, number]>(DEFAULT_COORDS);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [showProximityRadar, setShowProximityRadar] = useState<boolean>(false);
  const [locationAddress, setLocationAddress] = useState<string>('Paris, France');
  const [isAppleMapKitActive, setIsAppleMapKitActive] = useState<boolean>(false);

  // 1. Détection de la position réelle (HTML5 Geolocation) pour la dernière position connue
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoords([lat, lng]);

          // Reverse geocoding via OpenStreetMap Nominatim pour afficher la rue / ville
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
            .then((r) => r.json())
            .then((data) => {
              if (data && data.display_name) {
                const parts = data.display_name.split(',');
                const shortAddr = parts.slice(0, 3).join(',').trim();
                setLocationAddress(shortAddr);
              } else {
                setLocationAddress(`${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`);
              }
            })
            .catch(() => {
              setLocationAddress(`${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`);
            });
        },
        (err) => {
          console.log('Find My GPS fallback note:', err.message);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
      );
    }
  }, []);

  // 2. Initialisation de la Carte Apple MapKit JS (Dark Mode) avec fallback Leaflet
  useEffect(() => {
    let isCancelled = false;

    const setupMap = async () => {
      if (!mapContainerRef.current) return;

      const mapkit = (window as any).mapkit;
      if (mapkit) {
        const ok = await initAppleMapKit();
        if (ok && !isCancelled && mapContainerRef.current) {
          try {
            const map = new mapkit.Map(mapContainerRef.current, {
              colorScheme: mapkit.Map.ColorSchemes.Dark,
              showsCompass: mapkit.FeatureVisibility.Hidden,
              showsScale: mapkit.FeatureVisibility.Hidden,
              showsZoomControl: false,
              showsMapTypeControl: false,
              showsPointsOfInterest: true,
              region: new mapkit.CoordinateRegion(
                new mapkit.Coordinate(coords[0], coords[1]),
                new mapkit.CoordinateSpan(0.003, 0.004)
              ),
            });

            // Point Marqueur Apple Find My
            const ringCoord = new mapkit.Coordinate(coords[0], coords[1]);
            const ringAnnotation = new mapkit.MarkerAnnotation(ringCoord, {
              color: '#30D158',
              glyphText: '💍',
              title: isEn ? 'Stoic Ring One' : 'Bague Stoic Ring One',
              subtitle: isEn ? 'Last known position (4m ago)' : 'Dernière position connue (il y a 4 min)',
              selected: true,
            });
            map.addAnnotation(ringAnnotation);
            appleMarkerRef.current = ringAnnotation;

            // Halo radar de précision Apple
            const beaconCircle = new mapkit.CircleOverlay(ringCoord, 16, {
              style: new mapkit.Style({
                strokeColor: '#30D158',
                strokeOpacity: 0.8,
                lineWidth: 1.5,
                fillColor: 'rgba(48, 209, 88, 0.12)',
              }),
            });
            map.addOverlay(beaconCircle);

            appleMapInstanceRef.current = map;
            setIsAppleMapKitActive(true);
            return;
          } catch (err) {
            console.warn('MapKit JS Find My init fallback to Leaflet:', err);
          }
        }
      }

      // Fallback Haute Fidélité Leaflet (ArcGIS Dark Map)
      if (isCancelled || !mapContainerRef.current || leafletMapRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: coords,
        zoom: 17,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer(TILES_DARK, { maxZoom: 19 }).addTo(map);
      L.tileLayer(TILES_DARK_LABELS, { maxZoom: 19, opacity: 0.85 }).addTo(map);

      // Icône Find My avec halo radar pulsant
      const findMyIcon = L.divIcon({
        className: 'apple-findmy-pin',
        html: `
          <div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;inset:0;border-radius:50%;background:rgba(48,209,88,0.22);animation:findMyPulse 2s infinite ease-out;"></div>
            <div style="position:absolute;inset:7px;border-radius:50%;background:rgba(48,209,88,0.35);border:1.5px solid rgba(48,209,88,0.8);"></div>
            <div style="position:relative;width:30px;height:30px;border-radius:50%;background:#0A0A0C;border:2px solid #30D158;display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px rgba(48,209,88,0.95);">
              <span style="font-size:15px;line-height:1;">💍</span>
            </div>
          </div>
        `,
        iconSize: [52, 52],
        iconAnchor: [26, 26],
      });

      const marker = L.marker(coords, { icon: findMyIcon }).addTo(map);
      leafletMarkerRef.current = marker;
      leafletMapRef.current = map;
    };

    setupMap();

    const cleanupAttributions = cleanMapAttributions(mapContainerRef.current);

    return () => {
      isCancelled = true;
      cleanupAttributions();
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

  // Mise à jour de la caméra lors de la détection GPS
  useEffect(() => {
    if (appleMapInstanceRef.current && (window as any).mapkit) {
      const mapkit = (window as any).mapkit;
      const coord = new mapkit.Coordinate(coords[0], coords[1]);
      appleMapInstanceRef.current.setCenterAnimated(coord);
      if (appleMarkerRef.current) {
        appleMarkerRef.current.coordinate = coord;
      }
    } else if (leafletMapRef.current) {
      leafletMapRef.current.panTo(coords);
      if (leafletMarkerRef.current) {
        leafletMarkerRef.current.setLatLng(coords);
      }
    }
  }, [coords]);

  // Recenter sur la bague
  const handleRecenter = () => {
    if (appleMapInstanceRef.current && (window as any).mapkit) {
      const mapkit = (window as any).mapkit;
      appleMapInstanceRef.current.setCenterAnimated(new mapkit.Coordinate(coords[0], coords[1]), true);
    } else if (leafletMapRef.current) {
      leafletMapRef.current.flyTo(coords, 17, { duration: 0.8 });
    }
  };

  // Basculer Plan / Satellite
  const handleToggleMapType = () => {
    const next = mapType === 'standard' ? 'satellite' : 'standard';
    setMapType(next);
    if (appleMapInstanceRef.current && (window as any).mapkit) {
      const mapkit = (window as any).mapkit;
      appleMapInstanceRef.current.mapType =
        next === 'satellite' ? mapkit.Map.MapTypes.Satellite : mapkit.Map.MapTypes.Standard;
    } else if (leafletMapRef.current) {
      leafletMapRef.current.eachLayer((layer) => {
        leafletMapRef.current?.removeLayer(layer);
      });
      if (next === 'satellite') {
        L.tileLayer(TILES_SATELLITE, { maxZoom: 19 }).addTo(leafletMapRef.current);
        L.tileLayer(TILES_DARK_LABELS, { maxZoom: 19, opacity: 0.85 }).addTo(leafletMapRef.current);
      } else {
        L.tileLayer(TILES_DARK, { maxZoom: 19 }).addTo(leafletMapRef.current);
        L.tileLayer(TILES_DARK_LABELS, { maxZoom: 19, opacity: 0.85 }).addTo(leafletMapRef.current);
      }
      if (leafletMarkerRef.current) {
        leafletMarkerRef.current.addTo(leafletMapRef.current);
      }
    }
  };

  // Déclencher le flash lumineux & vibration de la bague
  const handleFlashLeds = () => {
    setIsFlashing(true);
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 400]);
      } catch (_) {}
    }
    setTimeout(() => {
      setIsFlashing(false);
    }, 4500);
  };

  // Ouvrir l'itinéraire à pied dans Apple Plans
  const handleOpenAppleMapsDirections = () => {
    const [lat, lng] = coords;
    window.open(`https://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`, '_blank');
  };

  const handleBackToPrevious = () => {
    if (onBack) {
      onBack();
    } else {
      handleClose();
    }
  };

  return (
    <div
      className={`modal-backdrop ${isClosing ? 'is-closing' : ''}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      style={{ zIndex: 1200 }}
    >
      <style>{`
        @keyframes findMyPulse {
          0% {
            transform: scale(0.65);
            opacity: 0.95;
          }
          100% {
            transform: scale(2.3);
            opacity: 0;
          }
        }
        .apple-findmy-pin {
          background: transparent !important;
          border: none !important;
        }
      `}</style>

      <div
        className={`modal-sheet ${isClosing ? 'is-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '430px',
          height: '92dvh',
          maxHeight: '840px',
          borderRadius: '34px 34px 0 0',
          background: '#08080B',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -20px 50px rgba(0, 0, 0, 0.95)',
        }}
      >
        {/* 1. En-tête Translucide Apple Find My */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '56px',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(10, 10, 14, 0.75)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={handleBackToPrevious}
            style={{
              background: 'none',
              border: 'none',
              color: '#FAF7F2',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '4px 0',
            }}
          >
            <ChevronLeft size={20} />
            <span>{isEn ? 'Settings' : 'Réglages'}</span>
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#FAF7F2', letterSpacing: '-0.2px' }}>
              {isEn ? 'Find My Ring' : 'Localiser la bague'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#30D158', boxShadow: '0 0 6px #30D158' }} />
              <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.65)' }}>
                {isEn ? 'Connected · BLE Active' : 'Connectée · Bluetooth actif'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
              }}
            >
              <Battery size={13} color="#D9F970" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
                {ring.isConnected && (ring.batteryRing || 0) > 0 ? `${ring.batteryRing}%` : '--'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleClose}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FAF7F2',
                cursor: 'pointer',
              }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* 2. Conteneur Carte Apple Plein Écran */}
        <div
          ref={mapContainerRef}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            inset: 0,
            background: '#08080C',
          }}
        />

        {/* 3. Contrôles Flottants de la Carte (Haut Droit) */}
        <div
          style={{
            position: 'absolute',
            top: '68px',
            right: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 10,
          }}
        >
          {/* Basculer Type de Carte */}
          <button
            type="button"
            onClick={handleToggleMapType}
            title={isEn ? 'Toggle Map / Satellite' : 'Basculer Plan / Satellite'}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'rgba(20, 20, 26, 0.85)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#FAF7F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.6)',
              transition: 'transform 0.15s ease',
            }}
          >
            <Layers size={17} />
          </button>

          {/* Recentrer sur la Bague */}
          <button
            type="button"
            onClick={handleRecenter}
            title={isEn ? 'Center on Ring' : 'Centrer sur la bague'}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'rgba(20, 20, 26, 0.85)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#30D158',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.6)',
              transition: 'transform 0.15s ease',
            }}
          >
            <LocateFixed size={18} />
          </button>
        </div>

        {/* 4. Carte Flottante Inférieure Apple Find My */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px 18px 24px 18px',
            borderRadius: '26px 26px 0 0',
            background: 'rgba(14, 14, 18, 0.88)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.16)',
            boxShadow: '0 -16px 40px rgba(0, 0, 0, 0.85)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 10,
          }}
        >
          {/* Poignée de feuille */}
          <div
            style={{
              width: '36px',
              height: '4px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.25)',
              alignSelf: 'center',
              marginBottom: '2px',
            }}
          />

          {/* Profil Bague & Statut Dernière Position */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Miniature Bague Vyta */}
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <img
                  src="/assets/ring/ring-iso-transparent.png"
                  alt="Stoic Ring One Smart Ring"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    transform: 'scale(1.15)',
                    filter: `${currentFinish.imgFilter} contrast(1.1) drop-shadow(0 2px 8px rgba(0,0,0,0.8))`,
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#FAF7F2', letterSpacing: '-0.3px' }}>
                  Stoic Ring One
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 600,
                      color: '#30D158',
                      background: 'rgba(48, 209, 88, 0.14)',
                      padding: '1px 6px',
                      borderRadius: '6px',
                      border: '1px solid rgba(48, 209, 88, 0.3)',
                    }}
                  >
                    {isEn ? 'Last known location' : 'Dernière position connue'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.5)' }}>
                    {isEn ? '4m ago' : 'Il y a 4 min'}
                  </span>
                </div>
              </div>
            </div>

            {/* Distance estimée */}
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAF7F2' }}>
                {isEn ? 'Near you' : 'Près de vous'}
              </span>
              <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.55)', display: 'block', marginTop: '1px' }}>
                ~1,2 m
              </span>
            </div>
          </div>

          {/* Adresse géolocalisée */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 10px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <MapPin size={13} color="#30D158" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.75)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {locationAddress}
            </span>
          </div>

          {/* Radar de Proximité UWB / BLE */}
          {showProximityRadar && (
            <div
              style={{
                padding: '12px',
                borderRadius: '14px',
                background: 'rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(48, 209, 88, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                animation: 'fadeIn 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#30D158' }}>
                  {isEn ? 'UWB / BLE Precision Radar' : 'Radar de précision UWB / BLE'}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
                  -42 dBm · 0,8 m
                </span>
              </div>
              <div
                style={{
                  position: 'relative',
                  height: '70px',
                  borderRadius: '10px',
                  background: 'rgba(48, 209, 88, 0.05)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ position: 'absolute', width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(48,209,88,0.5)', animation: 'findMyPulse 1.8s infinite ease-out' }} />
                <div style={{ position: 'absolute', width: '20px', height: '20px', borderRadius: '50%', border: '1px solid rgba(48,209,88,0.7)', animation: 'findMyPulse 1.8s infinite ease-out 0.4s' }} />
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#30D158', boxShadow: '0 0 12px #30D158' }} />
              </div>
            </div>
          )}

          {/* Boutons d'Action Rapide */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '8px', marginTop: '2px' }}>
            {/* Faire Clignoter la Bague */}
            <button
              type="button"
              onClick={handleFlashLeds}
              style={{
                padding: '11px 8px',
                borderRadius: '14px',
                background: isFlashing ? '#30D158' : 'rgba(255, 255, 255, 0.08)',
                border: isFlashing ? '1px solid #30D158' : '1px solid rgba(255, 255, 255, 0.16)',
                color: isFlashing ? '#0A0A0C' : '#FAF7F2',
                fontSize: '11.5px',
                fontWeight: 600,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <Volume2 size={16} />
              <span>{isFlashing ? (isEn ? 'Flashing...' : 'Clignotement...') : (isEn ? 'Flash LEDs' : 'Faire clignoter')}</span>
            </button>

            {/* Itinéraire Apple Plans */}
            <button
              type="button"
              onClick={handleOpenAppleMapsDirections}
              style={{
                padding: '11px 8px',
                borderRadius: '14px',
                background: 'rgba(0, 122, 255, 0.16)',
                border: '1px solid rgba(0, 122, 255, 0.4)',
                color: '#38BDF8',
                fontSize: '11.5px',
                fontWeight: 600,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <Navigation size={16} />
              <span>{isEn ? 'Directions' : 'Itinéraire Plans'}</span>
            </button>

            {/* Radar */}
            <button
              type="button"
              onClick={() => setShowProximityRadar(!showProximityRadar)}
              style={{
                padding: '11px 8px',
                borderRadius: '14px',
                background: showProximityRadar ? 'rgba(48, 209, 88, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                border: showProximityRadar ? '1px solid rgba(48, 209, 88, 0.5)' : '1px solid rgba(255, 255, 255, 0.16)',
                color: showProximityRadar ? '#30D158' : '#FAF7F2',
                fontSize: '11.5px',
                fontWeight: 600,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <Radio size={16} />
              <span>{isEn ? 'Radar' : 'Radar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
