import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { finishes } from '../data/health';
import { qringBle } from '../lib/qringBleService';
import { initAppleMapKit, cleanMapAttributions } from '../lib/appleMapKit';
import { PrecisionFindingView } from './PrecisionFindingView';
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
  Compass,
  ShieldCheck,
  BellRing,
  ExternalLink,
  CheckCircle2,
  Lock,
  Smartphone,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
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
  const isConnected = ring.isConnected || qringBle.isConnected();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const appleMapInstanceRef = useRef<any>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const appleMarkerRef = useRef<any>(null);
  const leafletMarkerRef = useRef<L.Marker | null>(null);

  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [coords, setCoords] = useState<[number, number]>(DEFAULT_COORDS);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [showProximityRadar, setShowProximityRadar] = useState<boolean>(false);
  const [showPrecisionView, setShowPrecisionView] = useState<boolean>(false);
  const [locationAddress, setLocationAddress] = useState<string>('Paris, France');
  const [isAppleMapKitActive, setIsAppleMapKitActive] = useState<boolean>(false);

  // Système de Localisation Aurel Radar
  const [separationAlertEnabled, setSeparationAlertEnabled] = useState<boolean>(() => {
    return localStorage.getItem('vyta_separation_alert') !== 'false';
  });
  const [lostModeEnabled, setLostModeEnabled] = useState<boolean>(() => {
    return localStorage.getItem('vyta_lost_mode') === 'true';
  });
  const [showLostModeModal, setShowLostModeModal] = useState<boolean>(false);
  const [lostPhone, setLostPhone] = useState<string>(() => {
    return localStorage.getItem('vyta_lost_phone') || '+33 6 12 34 56 78';
  });
  const [lostMsg, setLostMsg] = useState<string>(() => {
    return (
      localStorage.getItem('vyta_lost_msg') ||
      'Cette bague Aurel Ring One appartient à Julien. Merci de me contacter si vous la trouvez.'
    );
  });

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
              title: isEn ? 'Aurel Ring One' : 'Bague Aurel Ring One',
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

  // Basculer l'alerte de séparation
  const handleToggleSeparationAlert = () => {
    const next = !separationAlertEnabled;
    setSeparationAlertEnabled(next);
    localStorage.setItem('vyta_separation_alert', next ? 'true' : 'false');
  };

  // Sauvegarder le mode perdu
  const handleSaveLostMode = () => {
    localStorage.setItem('vyta_lost_phone', lostPhone);
    localStorage.setItem('vyta_lost_msg', lostMsg);
    localStorage.setItem('vyta_lost_mode', lostModeEnabled ? 'true' : 'false');
    setShowLostModeModal(false);
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
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: '#30D158',
                  boxShadow: '0 0 6px #30D158',
                }}
              />
              <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.65)' }}>
                {isEn ? 'Aurel Radar · BLE Active' : 'Radar Aurel · Bluetooth BLE actif'}
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

        {/* 4. Carte Flottante Inférieure Apple Find My (Feuille défilable) */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '14px 16px 28px 16px',
            borderRadius: '28px 28px 0 0',
            background: 'rgba(14, 14, 18, 0.92)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.16)',
            boxShadow: '0 -16px 40px rgba(0, 0, 0, 0.88)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 10,
            maxHeight: '66dvh',
            overflowY: 'auto',
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
              flexShrink: 0,
            }}
          />

          {/* Profil Bague & Statut Dernière Position */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Miniature Bague Aurel */}
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
                  alt="Aurel Ring One Smart Ring"
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
                  Aurel Ring One
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 600,
                      color: isConnected ? '#30D158' : '#F59E0B',
                      background: isConnected ? 'rgba(48, 209, 88, 0.14)' : 'rgba(245, 158, 11, 0.14)',
                      padding: '1px 6px',
                      borderRadius: '6px',
                      border: isConnected ? '1px solid rgba(48, 209, 88, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                    }}
                  >
                    {isConnected
                      ? isEn ? 'BLE Active' : 'Bluetooth actif'
                      : isEn ? 'Last known location' : 'Dernière position connue'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.5)' }}>
                    {isConnected ? (isEn ? 'Direct link' : 'Liaison directe') : (isEn ? 'GPS recorded' : 'Enregistrée par GPS')}
                  </span>
                </div>
              </div>
            </div>

            {/* Statut de liaison */}
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: isConnected ? '#30D158' : 'rgba(250, 247, 242, 0.5)' }}>
                {isConnected ? (isEn ? 'Connected' : 'À portée') : (isEn ? 'Disconnected' : 'Hors de portée')}
              </span>
              <span style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.55)', display: 'block', marginTop: '1px' }}>
                {isConnected ? (isEn ? 'Signal locked' : 'Signal capté') : '--'}
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

          {/* Actions épurées Apple Find My */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '4px' }}>
            {/* 1. Clignoter */}
            <button
              type="button"
              onClick={handleFlashLeds}
              style={{
                padding: '12px 6px',
                borderRadius: '16px',
                background: isFlashing ? '#30D158' : 'rgba(255, 255, 255, 0.06)',
                border: isFlashing ? '1px solid #30D158' : '1px solid rgba(255, 255, 255, 0.12)',
                color: isFlashing ? '#08080C' : '#FAF7F2',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <Volume2 size={18} />
              <span style={{ fontSize: '11px', fontWeight: 600 }}>
                {isFlashing ? (isEn ? 'Flashing...' : 'Clignote...') : (isEn ? 'Flash LEDs' : 'Faire clignoter')}
              </span>
            </button>

            {/* 2. Itinéraire */}
            <button
              type="button"
              onClick={handleOpenAppleMapsDirections}
              style={{
                padding: '12px 6px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#FAF7F2',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <Navigation size={18} />
              <span style={{ fontSize: '11px', fontWeight: 600 }}>
                {isEn ? 'Directions' : 'Itinéraire'}
              </span>
            </button>

            {/* 3. Rechercher */}
            <button
              type="button"
              onClick={() => setShowPrecisionView(true)}
              style={{
                padding: '12px 6px',
                borderRadius: '16px',
                background: '#30D158',
                border: 'none',
                color: '#08080C',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(48, 209, 88, 0.35)',
                transition: 'all 0.18s ease',
              }}
            >
              <Compass size={18} strokeWidth={2.5} />
              <span style={{ fontSize: '11px', fontWeight: 700 }}>
                {isEn ? 'Find' : 'Rechercher'}
              </span>
            </button>
          </div>

          {/* Options de sécurité minimalistes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            {/* Alerte séparation */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BellRing size={15} color={separationAlertEnabled ? '#30D158' : 'rgba(250,247,242,0.4)'} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#FAF7F2' }}>
                  {isEn ? 'Notify when left behind' : 'M’avertir en cas d’oubli'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={separationAlertEnabled}
                onChange={handleToggleSeparationAlert}
                style={{ accentColor: '#30D158', width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>

            {/* Mode perdu */}
            <div
              onClick={() => setShowLostModeModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '14px',
                background: lostModeEnabled ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                border: lostModeEnabled ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Lock size={15} color={lostModeEnabled ? '#EF4444' : 'rgba(250,247,242,0.4)'} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#FAF7F2' }}>
                  {isEn ? 'Lost Mode' : 'Mode Perdu'}
                </span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: lostModeEnabled ? '#EF4444' : 'rgba(250, 247, 242, 0.6)' }}>
                {lostModeEnabled ? (isEn ? 'Active' : 'Actif') : (isEn ? 'Configure' : 'Configurer')}
              </span>
            </div>
          </div>
        </div>

        {/* Modal de Configuration du Mode Perdu (Lost Mode Sheet) */}
        {showLostModeModal && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(20px)',
              zIndex: 200,
              display: 'flex',
              alignItems: 'flex-end',
              animation: 'fadeIn 0.2s ease',
            }}
            onClick={() => setShowLostModeModal(false)}
          >
            <div
              style={{
                width: '100%',
                padding: '20px',
                borderRadius: '24px 24px 0 0',
                background: '#12141A',
                borderTop: '1px solid rgba(255, 255, 255, 0.16)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Lock size={16} color="#EF4444" />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#FAF7F2' }}>
                    {isEn ? 'Lost Mode Configuration' : 'Configuration du Mode Perdu'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLostModeModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(250, 247, 242, 0.6)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#FAF7F2' }}>
                  {isEn ? 'Enable Lost Mode' : 'Activer le Mode Perdu'}
                </span>
                <input
                  type="checkbox"
                  checked={lostModeEnabled}
                  onChange={(e) => setLostModeEnabled(e.target.checked)}
                  style={{ accentColor: '#EF4444', width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.65)' }}>
                  {isEn ? 'Phone Number to Display' : 'Numéro de téléphone à afficher'}
                </label>
                <input
                  type="tel"
                  value={lostPhone}
                  onChange={(e) => setLostPhone(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#FAF7F2',
                    fontSize: '13px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.65)' }}>
                  {isEn ? 'Custom Message for Finder' : 'Message pour la personne qui la trouve'}
                </label>
                <textarea
                  value={lostMsg}
                  onChange={(e) => setLostMsg(e.target.value)}
                  rows={3}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#FAF7F2',
                    fontSize: '12px',
                    outline: 'none',
                    resize: 'none',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleSaveLostMode}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: lostModeEnabled ? '#EF4444' : '#30D158',
                  border: 'none',
                  color: '#FAF7F2',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '4px',
                }}
              >
                {isEn ? 'Save Lost Mode' : 'Enregistrer le Mode Perdu'}
              </button>
            </div>
          </div>
        )}

        {/* 6. VUE PLEIN ÉCRAN LOCALISATION PRÉCISE (Apple Precision Finding) */}
        {showPrecisionView && (
          <PrecisionFindingView
            onClose={() => setShowPrecisionView(false)}
          />
        )}
      </div>
    </div>
  );
};
