// Calculateur de distance Haversine en mètres pour le suivi GPS réel
function calculateGpsDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { qringBle } from '../lib/qringBleService';
import { run, zones, routeRaw, fitRoute, toPath, feedSeed, FeedPost } from '../data/fit';
import { fmtClockSec, fmtMMSS, fmtNum } from '../lib/format';
import { StoryData, DEFAULT_ROUTE_PATH_D, convertGpsPointsToSvgPath } from '../lib/story';
import { AppleWorkoutMap } from './AppleWorkoutMap';
import { LiveRunningView } from './LiveRunningView';
import { ExerciseSettingsModal } from './ExerciseSettingsModal';
import { TelemetryPoint } from './RunTelemetryCharts';
import { 
  Zap,
  Flame, 
  MapPin, 
  Trophy, 
  Timer, 
  Play, 
  Pause, 
  RotateCcw, 
  Check, 
  Plus, 
  Minus,
  Trash2,
  Edit3,
  X,
  Heart, 
  Share2, 
  Sparkles, 
  TrendingUp, 
  Dumbbell, 
  Compass, 
  Award,
  Square,
  Navigation,
  Sliders,
  Settings2,
  Route,
  Bookmark
} from 'lucide-react';

export interface StoredRoute {
  id: string;
  title: string;
  location: string;
  distanceKm: number;
  durationSec: number;
  elevationM: number;
  avgHr: number;
  dateStr: string;
  pointsSvgPath: string;
  realGpsPoints?: [number, number][];
  progress?: number;
}

const initialStoredRoutes: StoredRoute[] = [];

export interface GymSet {
  id: string;
  weightKg: number;
  reps: number;
  done: boolean;
}

export interface GymExercise {
  id: string;
  name: string;
  sets: GymSet[];
}

const initialWorkoutExercises: GymExercise[] = [];


export function getRouteThumbnailSvg(route: StoredRoute): {
  pathD: string;
  viewBox: string;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  isSinglePoint: boolean;
} {
  // 1. Session stationnaire / Aucun déplacement (distance < 50m ex: 0.00 km, ou moins de 2 points GPS réels)
  const isStationary = !route.distanceKm || route.distanceKm < 0.05 || (!route.realGpsPoints || route.realGpsPoints.length < 2);
  if (isStationary) {
    return {
      pathD: '',
      viewBox: '0 0 100 100',
      startPoint: { x: 50, y: 50 },
      endPoint: { x: 50, y: 50 },
      isSinglePoint: true,
    };
  }

  // 2. Trajet réel avec au moins 2 coordonnées GPS
  if (route.realGpsPoints && route.realGpsPoints.length >= 2) {
    const converted = convertGpsPointsToSvgPath(route.realGpsPoints, 100, 100, 14);
    return {
      pathD: converted.pathD,
      viewBox: '0 0 100 100',
      startPoint: converted.startPoint,
      endPoint: converted.endPoint,
      isSinglePoint: false,
    };
  }

  // 3. Trajet créé manuellement avec tracé SVG valide (distance >= 50m)
  const rawPath = (route.pointsSvgPath || '').trim();
  const numbers = (rawPath.match(/[-+]?\d*\.?\d+/g) || []).map(Number);
  if (rawPath && numbers.length >= 4 && route.distanceKm >= 0.05) {
    return {
      pathD: rawPath,
      viewBox: '0 0 100 100',
      startPoint: { x: numbers[0], y: numbers[1] },
      endPoint: { x: numbers[numbers.length - 2], y: numbers[numbers.length - 1] },
      isSinglePoint: false,
    };
  }

  // 4. Par défaut : point stationnaire
  return {
    pathD: '',
    viewBox: '0 0 100 100',
    startPoint: { x: 50, y: 50 },
    endPoint: { x: 50, y: 50 },
    isSinglePoint: true,
  };
}

export function formatRouteDateStr(route: StoredRoute): string {
  let ts = 0;
  if (route.id && route.id.startsWith('route-')) {
    const parsedTs = parseInt(route.id.replace('route-', ''), 10);
    if (!isNaN(parsedTs) && parsedTs > 1600000000000) {
      ts = parsedTs;
    }
  }

  if (ts > 0) {
    const routeDate = new Date(ts);
    const now = new Date();
    const isToday = routeDate.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = routeDate.toDateString() === yesterday.toDateString();

    const timeStr = routeDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Aujourd'hui · ${timeStr}`;
    if (isYesterday) return `Hier · ${timeStr}`;
    return `${routeDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${timeStr}`;
  }

  if (route.dateStr && route.dateStr.includes("Aujourd'hui") && route.title) {
    const titleMatch = route.title.match(/·\s*(.+)$/);
    if (titleMatch && !route.title.toLowerCase().includes("aujourd'hui")) {
      const timePart = route.dateStr.split('·')[1]?.trim() || '';
      return `${titleMatch[1].trim()}${timePart ? ' · ' + timePart : ''}`;
    }
  }

  return route.dateStr || 'Récent';
}

export const FitScreen: React.FC = () => {
  const { openStory, isLiveRunningViewOpen, setIsLiveRunningViewOpen, liveBpm, isLiveHrActive, setIsLiveHrActive } = useApp();
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialSubTab = (params?.get('fit') as 'run' | 'trajets' | 'gym' | 'feed') || 'run';
  const [subTab, setSubTab] = useState<'run' | 'trajets' | 'gym' | 'feed'>(initialSubTab);

  const [storedRoutes, setStoredRoutes] = useState<StoredRoute[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vyta_stored_routes');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            // Nettoyage immédiat des faux tracés sur les sessions stationnaires (0.00 km)
            return parsed.map((r: StoredRoute) => {
              const isStationary = !r.distanceKm || r.distanceKm < 0.05 || (!r.realGpsPoints || r.realGpsPoints.length < 2);
              if (isStationary) {
                return {
                  ...r,
                  pointsSvgPath: '',
                  realGpsPoints: r.realGpsPoints && r.realGpsPoints.length === 1 ? r.realGpsPoints : undefined,
                  location: (!r.distanceKm || r.distanceKm < 0.05) ? 'Session statique' : r.location,
                };
              }
              return r;
            });
          }
        }
      } catch (e) {}
    }
    return initialStoredRoutes;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('vyta_stored_routes', JSON.stringify(storedRoutes));
      } catch (e) {}
    }
  }, [storedRoutes]);

  const [showNewRouteModal, setShowNewRouteModal] = useState<boolean>(false);
  const [newRouteTitle, setNewRouteTitle] = useState<string>('');
  const [newRouteDist, setNewRouteDist] = useState<string>('5.0');
  const [newRouteLoc, setNewRouteLoc] = useState<string>('Paris');
  const [viewingRouteForMap, setViewingRouteForMap] = useState<StoredRoute | null>(null);

  // ------------------ COURSE & CARDIO (SESSION GPS VYTA LIVE) ------------------
  const initialRunState = (params?.get('run_state') as 'idle' | 'running' | 'paused' | 'finished') || 'idle';
  const initialRunDur = params?.get('run_dur') ? parseInt(params.get('run_dur')!, 10) : 0;
  const initialRunDist = params?.get('run_dist') ? parseFloat(params.get('run_dist')!) : 0;

  const [runState, setRunState] = useState<'idle' | 'running' | 'paused' | 'finished'>(initialRunState);
  const [runDurationSec, setRunDurationSec] = useState<number>(initialRunDur);
  const [runDistanceKm, setRunDistanceKm] = useState<number>(initialRunDist);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vyta_last_user_location');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });
  const [realGpsPoints, setRealGpsPoints] = useState<[number, number][]>([]);
  const [instantSpeedKmh, setInstantSpeedKmh] = useState<number>(0);
  const lastGpsFixRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const lastDistanceFixRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const recentGpsSamplesRef = useRef<{ lat: number; lng: number; time: number }[]>([]);
  const lastValidGpsTimestampRef = useRef<number>(0);
  const currentSmoothedSpeedRef = useRef<number>(0);
  const runDistanceKmRef = useRef<number>(0);
  const runStartTimeRef = useRef<number>(0);
  const accumulatedDurRef = useRef<number>(initialRunDur);

  useEffect(() => {
    runDistanceKmRef.current = runDistanceKm;
  }, [runDistanceKm]);
  // isLiveRunningViewOpen hoisted to AppContext

  const notifyNativeWorkout = (
    action: 'start' | 'pause' | 'resume' | 'stop' | 'sync' | 'update',
    extra?: {
      elapsedTime?: number;
      distanceKm?: number;
      paceText?: string;
      currentHeartRate?: number;
      workoutTitle?: string;
      isPaused?: boolean;
    }
  ) => {
    try {
      const webkit = (window as any).webkit;
      if (webkit && webkit.messageHandlers && webkit.messageHandlers.vytaWorkoutTracker) {
        webkit.messageHandlers.vytaWorkoutTracker.postMessage({ action, ...extra });
      }
    } catch (err) {
      console.log('[Vyta Native Bridge] Workout message error:', err);
    }
  };

  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>([]);
  const lastLiveBpmUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    if (liveBpm > 0) {
      lastLiveBpmUpdateRef.current = Date.now();
    }
  }, [liveBpm]);

  // Empêcher l'extinction de l'écran pendant la course active (Screen WakeLock API)
  useEffect(() => {
    let sentinel: any = null;
    if (runState === 'running' && typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      (navigator as any).wakeLock.request('screen').then((lock: any) => {
        sentinel = lock;
      }).catch(() => {});
    }
    return () => {
      if (sentinel) {
        sentinel.release().catch(() => {});
      }
    };
  }, [runState]);

  // Minuteur d'entraînement & télémétrie réelle (cadence 1 seconde fluide, sans interruption)
  useEffect(() => {
    if (runState !== 'running') return;

    const interval = setInterval(() => {
      if (runStartTimeRef.current > 0) {
        const elapsed = Math.floor((Date.now() - runStartTimeRef.current) / 1000);
        setRunDurationSec(elapsed);

        // Décroissance douce si perte prolongée du signal GPS (> 6s sans fix)
        const timeSinceGps = lastValidGpsTimestampRef.current > 0 
          ? (Date.now() - lastValidGpsTimestampRef.current) / 1000 
          : 0;
        let curSpeed = currentSmoothedSpeedRef.current;
        if (timeSinceGps > 6.0 && curSpeed > 0) {
          curSpeed = Math.max(0, Math.round((curSpeed * 0.7) * 10) / 10);
          currentSmoothedSpeedRef.current = curSpeed;
          setInstantSpeedKmh(curSpeed);
        }

        // BPM en direct avec contrôle de fraîcheur (< 18s pour éviter les lignes plates si perte de contact optique)
        const isBpmFresh = (Date.now() - lastLiveBpmUpdateRef.current) < 18000;
        const curHr = (liveBpm > 0 && isBpmFresh) ? liveBpm : 0;
        const currentDist = runDistanceKmRef.current;

        setTelemetryHistory((prevHistory) => {
          if (prevHistory.length > 0 && prevHistory[prevHistory.length - 1].timeSec === elapsed) {
            return prevHistory;
          }
          return [
            ...prevHistory,
            {
              timeSec: elapsed,
              distanceKm: currentDist,
              speedKmh: Math.round(curSpeed * 10) / 10,
              hrBpm: curHr,
            },
          ];
        });

        // Mise à jour de l'Activité en direct (Dynamic Island / Écran verrouillé iOS)
        const curAvgSpeed = currentDist > 0.01 && elapsed > 0
          ? (currentDist / (elapsed / 3600)).toFixed(1).replace('.', ',')
          : '0,0';
        const curSpeedText = `${curAvgSpeed} km/h`;
        notifyNativeWorkout('update', {
          elapsedTime: elapsed,
          distanceKm: Math.round(currentDist * 100) / 100,
          paceText: curSpeedText,
          currentHeartRate: curHr,
          isPaused: false,
        });
      }
    }, 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && runStartTimeRef.current > 0) {
        const elapsed = Math.floor((Date.now() - runStartTimeRef.current) / 1000);
        setRunDurationSec(elapsed);
        notifyNativeWorkout('sync');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [runState, liveBpm]);

  // Traitement universel des coordonnées GPS (Foreground + Native Background iOS CoreLocation)
  const processGpsFix = (latitude: number, longitude: number, speed: number | null, accuracy: number, timestamp?: number) => {
    // 1. Filtrer les coordonnées aberrantes ou de trop faible précision (> 35m)
    if (accuracy > 35 || accuracy < 0) return;
    const coords: [number, number] = [latitude, longitude];
    const now = timestamp && timestamp > 0 ? timestamp : Date.now();

    setUserPosition(coords);
    try {
      localStorage.setItem('vyta_last_user_location', JSON.stringify(coords));
    } catch (e) {}

    // Resynchronisation du temps écoulé au cas où iOS a mis le timer en veille
    if (runStartTimeRef.current > 0) {
      const elapsed = Math.floor((Date.now() - runStartTimeRef.current) / 1000);
      setRunDurationSec(elapsed);
    }

    // Premier point GPS enregistré
    if (!lastGpsFixRef.current) {
      lastGpsFixRef.current = { lat: latitude, lng: longitude, time: now };
      lastDistanceFixRef.current = { lat: latitude, lng: longitude, time: now };
      recentGpsSamplesRef.current = [{ lat: latitude, lng: longitude, time: now }];
      lastValidGpsTimestampRef.current = now;
      setRealGpsPoints([coords]);
      return;
    }

    // 2. Fenêtre glissante temporelle des 5 dernières secondes
    recentGpsSamplesRef.current.push({ lat: latitude, lng: longitude, time: now });
    recentGpsSamplesRef.current = recentGpsSamplesRef.current.filter((p) => now - p.time <= 5000);
    lastValidGpsTimestampRef.current = now;

    // 3. Calcul de la vitesse
    const hasHardwareSpeed = speed !== null && typeof speed === 'number' && !isNaN(speed) && speed >= 0;

    // Vitesse calculée sur la fenêtre glissante (3-5 secondes)
    let windowSpeedKmh = 0;
    const samples = recentGpsSamplesRef.current;
    if (samples.length >= 2) {
      const firstSample = samples[0];
      const lastSample = samples[samples.length - 1];
      const windowDtSec = Math.max(0.5, (lastSample.time - firstSample.time) / 1000);
      const windowDistMeters = calculateGpsDistanceMeters(
        firstSample.lat,
        firstSample.lng,
        lastSample.lat,
        lastSample.lng
      );
      if (windowDtSec >= 1.5) {
        windowSpeedKmh = (windowDistMeters / windowDtSec) * 3.6;
      }
    }

    // Vitesse delta directe entre les deux dernières positions
    const dtSec = Math.max(0.5, (now - lastGpsFixRef.current.time) / 1000);
    const directDistMeters = calculateGpsDistanceMeters(
      lastGpsFixRef.current.lat,
      lastGpsFixRef.current.lng,
      latitude,
      longitude
    );
    const directSpeedKmh = (directDistMeters / dtSec) * 3.6;

    // Sélection de la vitesse brute :
    // On privilégie la vitesse Doppler si disponible et cohérente (> 0.4 m/s)
    let rawSpeedKmh = 0;
    if (hasHardwareSpeed && speed > 0.4) {
      rawSpeedKmh = speed * 3.6;
    } else if (windowSpeedKmh > 0) {
      rawSpeedKmh = windowSpeedKmh;
    } else {
      rawSpeedKmh = directSpeedKmh;
    }

    // Détection arrêt stationnaire vs mouvement actif
    const isStationary = 
      (hasHardwareSpeed && speed < 0.25) || 
      (samples.length >= 2 && windowSpeedKmh < 0.8 && directDistMeters < 1.5);

    let targetSpeedKmh = 0;
    if (isStationary) {
      targetSpeedKmh = 0;
    } else {
      if (rawSpeedKmh > 35.0) {
        // Ignorer les sauts GPS aberrants
        targetSpeedKmh = currentSmoothedSpeedRef.current;
      } else if (rawSpeedKmh < 1.0) {
        targetSpeedKmh = 0;
      } else {
        targetSpeedKmh = rawSpeedKmh;
      }
    }

    // 4. Filtre de lissage continu exponentiel (EMA)
    // Empêche la courbe en dents de scie : la vitesse reste stable et fidèle à l'allure réelle
    let nextSmoothedSpeed = 0;
    if (targetSpeedKmh <= 0) {
      nextSmoothedSpeed = currentSmoothedSpeedRef.current > 0.5 
        ? Math.max(0, Math.round((currentSmoothedSpeedRef.current * 0.5) * 10) / 10) 
        : 0;
    } else {
      if (currentSmoothedSpeedRef.current <= 0.5) {
        // Démarrage franc
        nextSmoothedSpeed = Math.round(targetSpeedKmh * 10) / 10;
      } else {
        // En marche continue : EMA 75% historique / 25% nouveau point
        const ema = currentSmoothedSpeedRef.current * 0.75 + targetSpeedKmh * 0.25;
        nextSmoothedSpeed = Math.round(ema * 10) / 10;
      }
    }

    currentSmoothedSpeedRef.current = nextSmoothedSpeed;
    setInstantSpeedKmh(nextSmoothedSpeed);
    lastGpsFixRef.current = { lat: latitude, lng: longitude, time: now };

    // 5. Accumulation propre de la distance (anti-drift à l'arrêt)
    if (!lastDistanceFixRef.current) {
      lastDistanceFixRef.current = { lat: latitude, lng: longitude, time: now };
    }
    const distSinceAccum = calculateGpsDistanceMeters(
      lastDistanceFixRef.current.lat,
      lastDistanceFixRef.current.lng,
      latitude,
      longitude
    );

    if (nextSmoothedSpeed >= 1.0 && distSinceAccum >= 2.5 && distSinceAccum < 150) {
      const deltaKm = distSinceAccum / 1000;
      setRunDistanceKm((prev) => {
        const updated = Math.round((prev + deltaKm) * 1000) / 1000;
        runDistanceKmRef.current = updated;
        return updated;
      });
      lastDistanceFixRef.current = { lat: latitude, lng: longitude, time: now };
      setRealGpsPoints((prev) => [...prev, coords]);
    }
  };

  // Surveillance GPS temps réel haute précision (Hybride Web + Native iOS Background)
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    // Localisation initiale pour centrer immédiatement
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPosition(coords);
        try {
          localStorage.setItem('vyta_last_user_location', JSON.stringify(coords));
        } catch (e) {}
      },
      (err) => console.log('Init GPS error:', err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );

    if (runState !== 'running') {
      setInstantSpeedKmh(0);
      if (runState === 'idle') {
        lastGpsFixRef.current = null;
      }
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        processGpsFix(pos.coords.latitude, pos.coords.longitude, pos.coords.speed, pos.coords.accuracy);
      },
      (err) => console.log('GPS watch error:', err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    );

    // Écoute des points GPS natifs iOS en arrière-plan (quand l'écran est éteint)
    const handleNativeGps = (e: any) => {
      const { latitude, longitude, speed, accuracy, time } = e.detail || {};
      if (typeof latitude === 'number' && typeof longitude === 'number') {
        processGpsFix(latitude, longitude, speed, accuracy, time);
      }
    };

    const handleNativeBatch = (e: any) => {
      const points = e.detail;
      if (Array.isArray(points)) {
        points.forEach((pt: any) => {
          processGpsFix(pt.latitude, pt.longitude, pt.speed, pt.accuracy, pt.time);
        });
      }
    };

    window.addEventListener('nativeGpsUpdate', handleNativeGps);
    window.addEventListener('nativeGpsBatchSync', handleNativeBatch);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.removeEventListener('nativeGpsUpdate', handleNativeGps);
      window.removeEventListener('nativeGpsBatchSync', handleNativeBatch);
    };
  }, [runState]);

  // Support du scroll direct vers la section cardio/télémétrie
  useEffect(() => {
    if (params?.get('scroll') === 'cardio' || params?.get('scroll') === 'hr') {
      const scrollNow = () => {
        const el = document.getElementById('cardio-curve-section');
        const container = document.querySelector('.app-scroll-container');
        if (el && container) {
          try {
            container.scrollTo({ top: el.offsetTop - 70, behavior: 'instant' as ScrollBehavior });
          } catch {
            container.scrollTop = el.offsetTop - 70;
          }
        }
      };
      scrollNow();
      setTimeout(scrollNow, 50);
      setTimeout(scrollNow, 200);
    }
  }, [params]);

  const startRun = () => {
    if (runState === 'idle' || runState === 'finished') {
      setRunDurationSec(0);
      setRunDistanceKm(0);
      runDistanceKmRef.current = 0;
      setInstantSpeedKmh(0);
      currentSmoothedSpeedRef.current = 0;
      recentGpsSamplesRef.current = [];
      const initPoints: [number, number][] = userPosition ? [userPosition] : [];
      setRealGpsPoints(initPoints);
      lastGpsFixRef.current = userPosition ? { lat: userPosition[0], lng: userPosition[1], time: Date.now() } : null;
      lastDistanceFixRef.current = userPosition ? { lat: userPosition[0], lng: userPosition[1], time: Date.now() } : null;
      lastValidGpsTimestampRef.current = Date.now();
      setTelemetryHistory([{ timeSec: 0, distanceKm: 0, speedKmh: 0, hrBpm: 0 }]);
      accumulatedDurRef.current = 0;
      runStartTimeRef.current = Date.now();
    } else {
      runStartTimeRef.current = Date.now() - accumulatedDurRef.current * 1000;
    }
    setRunState('running');
    setIsLiveHrActive(true);
    qringBle.startRealTimeHeartRate().catch(() => {});
    notifyNativeWorkout('start', {
      workoutTitle: 'Course à pied',
      elapsedTime: 0,
      distanceKm: 0,
      paceText: '--:--',
      currentHeartRate: liveBpm > 0 ? liveBpm : 0,
      isPaused: false,
    });
    setIsLiveRunningViewOpen(true);
  };

  const pauseRun = () => {
    setRunState('paused');
    accumulatedDurRef.current = runDurationSec;
    setInstantSpeedKmh(0);
    currentSmoothedSpeedRef.current = 0;
    recentGpsSamplesRef.current = [];
    const curAvgSpeed = runDistanceKm > 0.01 && runDurationSec > 0
      ? (runDistanceKm / (runDurationSec / 3600)).toFixed(1).replace('.', ',')
      : '0,0';
    notifyNativeWorkout('pause', {
      elapsedTime: runDurationSec,
      distanceKm: Math.round(runDistanceKm * 100) / 100,
      paceText: `${curAvgSpeed} km/h`,
      currentHeartRate: liveBpm > 0 ? liveBpm : 0,
      isPaused: true,
    });
  };

  const resumeRun = () => {
    runStartTimeRef.current = Date.now() - accumulatedDurRef.current * 1000;
    setRunState('running');
    setIsLiveHrActive(true);
    qringBle.startRealTimeHeartRate().catch(() => {});
    currentSmoothedSpeedRef.current = 0;
    recentGpsSamplesRef.current = [];
    lastDistanceFixRef.current = null;
    lastValidGpsTimestampRef.current = Date.now();
    const curAvgSpeed = runDistanceKm > 0.01 && accumulatedDurRef.current > 0
      ? (runDistanceKm / (accumulatedDurRef.current / 3600)).toFixed(1).replace('.', ',')
      : '0,0';
    notifyNativeWorkout('resume', {
      elapsedTime: accumulatedDurRef.current,
      distanceKm: Math.round(runDistanceKm * 100) / 100,
      paceText: `${curAvgSpeed} km/h`,
      currentHeartRate: liveBpm > 0 ? liveBpm : 0,
      isPaused: false,
    });
    setIsLiveRunningViewOpen(true);
  };

  const stopRun = () => {
    notifyNativeWorkout('stop');
    if (isLiveHrActive) {
      setIsLiveHrActive(false);
      qringBle.stopRealTimeHeartRate().catch(() => {});
    }
    saveCurrentRunToTrajets();
    openRunStory();
    setIsLiveRunningViewOpen(false);
    resetRun();
  };

  const resetRun = () => {
    setRunState('idle');
    notifyNativeWorkout('stop');
    if (isLiveHrActive) {
      setIsLiveHrActive(false);
      qringBle.stopRealTimeHeartRate().catch(() => {});
    }
    setRunDurationSec(0);
    setRunDistanceKm(0);
    runDistanceKmRef.current = 0;
    setInstantSpeedKmh(0);
    currentSmoothedSpeedRef.current = 0;
    recentGpsSamplesRef.current = [];
    setRealGpsPoints([]);
    lastGpsFixRef.current = null;
    lastDistanceFixRef.current = null;
    lastValidGpsTimestampRef.current = 0;
    setTelemetryHistory([]);
    accumulatedDurRef.current = 0;
    runStartTimeRef.current = 0;
  };

  const saveCurrentRunToTrajets = () => {
    const finalDist = Math.round(runDistanceKm * 100) / 100;
    const finalDur = runDurationSec;
    const finalHr = liveHr > 40 ? liveHr : 0;
    const hasGps = realGpsPoints && realGpsPoints.length >= 2 && finalDist >= 0.05;
    const pathInfo = hasGps ? convertGpsPointsToSvgPath(realGpsPoints) : null;
    const now = new Date();

    const newRoute: StoredRoute = {
      id: `route-${Date.now()}`,
      title: `Course Stoic · ${now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`,
      location: finalDist >= 0.05 ? 'Course extérieure' : 'Session statique',
      distanceKm: finalDist,
      durationSec: finalDur,
      elevationM: finalDist >= 0.05 ? Math.round(finalDist * 8) : 0,
      avgHr: finalHr,
      dateStr: `Aujourd'hui · ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      pointsSvgPath: pathInfo ? pathInfo.pathD : '',
      realGpsPoints: hasGps ? realGpsPoints : (realGpsPoints.length === 1 ? [realGpsPoints[0]] : (userPosition ? [userPosition] : undefined)),
      progress: 1,
    };
    setStoredRoutes((prev) => [newRoute, ...prev]);
    setSubTab('trajets');
  };

  const handleCreateRoute = () => {
    const cleanTitle = newRouteTitle.trim() || 'Mon Nouveau Parcours';
    const distNum = parseFloat(newRouteDist) || 5.0;
    const now = new Date();

    const newRoute: StoredRoute = {
      id: `route-${Date.now()}`,
      title: cleanTitle,
      location: newRouteLoc.trim() || 'Parcours personnalisé',
      distanceKm: distNum,
      durationSec: 0,
      elevationM: 0,
      avgHr: 0,
      dateStr: `Aujourd'hui · ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      pointsSvgPath: distNum >= 0.05 ? 'M 14 74 Q 31 70, 44 52 T 72 39 T 88 26' : '',
      progress: 0,
    };

    setStoredRoutes((prev) => [newRoute, ...prev]);
    setShowNewRouteModal(false);
    setNewRouteTitle('');
    setNewRouteDist('5.0');
    setNewRouteLoc('Paris');
  };

  const deleteRoute = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setStoredRoutes((prev) => prev.filter((r) => r.id !== id));
  };

  const loadAndStartRoute = (route: StoredRoute) => {
    resetRun();
    setSubTab('run');
  };

  const getRouteEffectivePoints = (route: StoredRoute): [number, number][] => {
    // Session stationnaire (0.00 km ou moins de 50m) : un seul point (ou vide), JAMAIS de fausse boucle circulaire !
    if (!route.distanceKm || route.distanceKm < 0.05) {
      if (route.realGpsPoints && route.realGpsPoints.length > 0) {
        return [route.realGpsPoints[0]];
      }
      if (userPosition) return [userPosition];
      return [];
    }

    if (route.realGpsPoints && route.realGpsPoints.length >= 2) {
      return route.realGpsPoints;
    }

    if (route.realGpsPoints && route.realGpsPoints.length === 1) {
      return [route.realGpsPoints[0]];
    }

    const baseLat = userPosition ? userPosition[0] : 48.8566;
    const baseLng = userPosition ? userPosition[1] : 2.3522;
    return [[baseLat, baseLng]];
  };

  const openInNativeAppleMaps = (route: StoredRoute, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let url = 'https://maps.apple.com/';
    const pts = getRouteEffectivePoints(route);
    if (pts.length >= 2) {
      const start = pts[0];
      const end = pts[pts.length - 1];
      url = `https://maps.apple.com/?saddr=${start[0]},${start[1]}&daddr=${end[0]},${end[1]}&dirflg=w`;
    } else if (pts.length === 1) {
      const pt = pts[0];
      url = `https://maps.apple.com/?q=${pt[0]},${pt[1]}`;
    } else if (route.location) {
      url = `https://maps.apple.com/?q=${encodeURIComponent(route.location)}`;
    } else {
      url = `https://maps.apple.com/?q=${encodeURIComponent(route.title)}`;
    }
    try {
      window.open(url, '_system');
    } catch (_) {
      window.location.href = url;
    }
  };

  const shareStoredRoute = (route: StoredRoute, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const speedVal = route.distanceKm > 0 && route.durationSec > 0
      ? (route.distanceKm / (route.durationSec / 3600)).toFixed(1).replace('.', ',')
      : '--';
    openStory({
      mode: 'run',
      title: route.title,
      dateStr: route.dateStr,
      stats: [
        { label: 'Distance', value: route.distanceKm.toFixed(2), unit: 'km' },
        { label: 'Vitesse Moyenne', value: speedVal, unit: 'km/h' },
        { label: 'Temps', value: fmtClockSec(route.durationSec) },
        { label: 'FC Moyenne', value: route.avgHr > 0 ? `${route.avgHr}` : '--', unit: 'bpm' },
      ],
      routeProgress: route.progress ?? 1,
      realGpsPoints: route.realGpsPoints,
    });
  };

  // Live computed metrics (strictement 0 à l'arrêt)
  const isIdle = runState === 'idle';
  const liveProgress = runState === 'finished' ? 1 : Math.min(1, runDistanceKm / 10);
  const livePaceSec =
    runDistanceKm > 0.01
      ? Math.round(runDurationSec / runDistanceKm)
      : 0;
  const liveSpeedKmh =
    runState === 'running'
      ? (instantSpeedKmh >= 0.8 ? instantSpeedKmh.toFixed(1) : '0.0')
      : '0.0';
  const liveHr = isIdle ? 0 : (liveBpm > 0 ? liveBpm : 0);
  // Dépense énergétique : calcul combiné distance + temps écoulé + rythme cardiaque
  const liveCalories = isIdle
    ? 0
    : Math.max(
        Math.round(runDistanceKm * 65),
        runDurationSec > 5 ? Math.round((runDurationSec / 60) * (liveHr > 120 ? 11 : liveHr > 90 ? 8.5 : 7)) : 0
      );
  const liveElevation = 0;

  // ------------------ MUSCULATION (SÉANCE PERSONNALISÉE) ------------------
  const [sessionTitle, setSessionTitle] = useState<string>('Séance Pectoraux & Bras');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [exercises, setExercises] = useState<GymExercise[]>(initialWorkoutExercises);

  // Modals state
  const initialAddModal = params?.get('modal') === 'add_ex' || params?.get('add_ex') === '1';
  const [showAddModal, setShowAddModal] = useState<boolean>(initialAddModal);
  const [newExName, setNewExName] = useState<string>('');
  const [newExSetsCount, setNewExSetsCount] = useState<number>(3);
  const [newExWeight, setNewExWeight] = useState<number>(60);
  const [newExReps, setNewExReps] = useState<number>(10);

  const [showNewSessionModal, setShowNewSessionModal] = useState<boolean>(false);
  const [newSessionTitleInput, setNewSessionTitleInput] = useState<string>('');
  const initialManagingEx = params?.get('ex_manage') || null;
  const [managingExId, setManagingExId] = useState<string | null>(initialManagingEx);

  // Rest timer state with configurable duration
  const restPresets = [
    { label: '30s', sec: 30 },
    { label: '45s', sec: 45 },
    { label: '1 min', sec: 60 },
    { label: '1m30', sec: 90 },
    { label: '2 min', sec: 120 },
    { label: '3 min', sec: 180 },
  ];
  const [targetRestSeconds, setTargetRestSeconds] = useState<number>(90);
  const [restSeconds, setRestSeconds] = useState<number>(90);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setRestSeconds((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return targetRestSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, targetRestSeconds]);

  const setChosenRest = (sec: number) => {
    setTargetRestSeconds(sec);
    setRestSeconds(sec);
  };

  const adjustRestBy = (delta: number) => {
    setRestSeconds((prev) => Math.max(5, prev + delta));
  };

  const toggleSetDone = (exId: string, setId: string) => {
    let markedDone = false;
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => {
            if (s.id !== setId) return s;
            const nextDone = !s.done;
            if (nextDone) markedDone = true;
            return { ...s, done: nextDone };
          }),
        };
      })
    );

    // Auto-trigger configurable rest timer if marked done
    if (markedDone) {
      setRestSeconds(targetRestSeconds);
      setTimerRunning(true);
    }
  };

  const adjustWeight = (exId: string, setId: string, delta: number) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => {
            if (s.id !== setId) return s;
            const nextWeight = Math.max(0, Math.round((s.weightKg + delta) * 10) / 10);
            return { ...s, weightKg: nextWeight };
          }),
        };
      })
    );
  };

  const adjustReps = (exId: string, setId: string, delta: number) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => {
            if (s.id !== setId) return s;
            const nextReps = Math.max(1, s.reps + delta);
            return { ...s, reps: nextReps };
          }),
        };
      })
    );
  };

  const addSetToExercise = (exId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        const newSet: GymSet = {
          id: `${ex.id}-s${Date.now()}-${ex.sets.length + 1}`,
          weightKg: lastSet ? lastSet.weightKg : 50,
          reps: lastSet ? lastSet.reps : 10,
          done: false,
        };
        return { ...ex, sets: [...ex.sets, newSet] };
      })
    );
  };

  const deleteSet = (exId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        if (ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.filter((s) => s.id !== setId) };
      })
    );
  };

  const deleteExercise = (exId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exId));
  };

  const renameExercise = (exId: string, newName: string) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === exId ? { ...ex, name: newName } : ex))
    );
  };

  const applyWeightDeltaAll = (exId: string, deltaKg: number) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => ({
            ...s,
            weightKg: Math.max(0, Math.round((s.weightKg + deltaKg) * 10) / 10),
          })),
        };
      })
    );
  };

  const handleAddExercise = (name: string, count: number, weight: number, reps: number) => {
    const cleanName = name.trim() || 'Exercice sans titre';
    const exId = `ex-${Date.now()}`;
    const sets: GymSet[] = Array.from({ length: Math.max(1, count) }, (_, i) => ({
      id: `${exId}-s${i + 1}`,
      weightKg: weight,
      reps: reps,
      done: false,
    }));

    setExercises((prev) => [...prev, { id: exId, name: cleanName, sets }]);
    setShowAddModal(false);
    setNewExName('');
  };

  const handleCreateNewSession = (title: string) => {
    const cleanTitle = title.trim() || 'Nouvelle Séance';
    setSessionTitle(cleanTitle);

    let presetEx: GymExercise[] = [];
    const lower = cleanTitle.toLowerCase();
    if (lower.includes('dos') || lower.includes('pull') || lower.includes('biceps')) {
      presetEx = [
        {
          id: `ex-${Date.now()}-1`,
          name: 'Tractions lestées',
          sets: [
            { id: 's1', weightKg: 10, reps: 8, done: false },
            { id: 's2', weightKg: 10, reps: 8, done: false },
            { id: 's3', weightKg: 10, reps: 6, done: false },
          ],
        },
        {
          id: `ex-${Date.now()}-2`,
          name: 'Rowing barre buste penché',
          sets: [
            { id: 's1', weightKg: 70, reps: 10, done: false },
            { id: 's2', weightKg: 70, reps: 10, done: false },
            { id: 's3', weightKg: 70, reps: 9, done: false },
          ],
        },
        {
          id: `ex-${Date.now()}-3`,
          name: 'Curl biceps barre EZ',
          sets: [
            { id: 's1', weightKg: 35, reps: 10, done: false },
            { id: 's2', weightKg: 35, reps: 10, done: false },
            { id: 's3', weightKg: 30, reps: 12, done: false },
          ],
        },
      ];
    } else if (lower.includes('jambe') || lower.includes('legs') || lower.includes('squat')) {
      presetEx = [
        {
          id: `ex-${Date.now()}-1`,
          name: 'Squat arrière barre olympique',
          sets: [
            { id: 's1', weightKg: 100, reps: 8, done: false },
            { id: 's2', weightKg: 100, reps: 8, done: false },
            { id: 's3', weightKg: 105, reps: 6, done: false },
          ],
        },
        {
          id: `ex-${Date.now()}-2`,
          name: 'Presse à cuisses 45°',
          sets: [
            { id: 's1', weightKg: 180, reps: 12, done: false },
            { id: 's2', weightKg: 180, reps: 12, done: false },
            { id: 's3', weightKg: 190, reps: 10, done: false },
          ],
        },
        {
          id: `ex-${Date.now()}-3`,
          name: 'Soulevé de terre roumain',
          sets: [
            { id: 's1', weightKg: 90, reps: 10, done: false },
            { id: 's2', weightKg: 90, reps: 10, done: false },
            { id: 's3', weightKg: 90, reps: 9, done: false },
          ],
        },
      ];
    } else {
      presetEx = [
        {
          id: `ex-${Date.now()}-1`,
          name: 'Développé couché (barre)',
          sets: [
            { id: 's1', weightKg: 75, reps: 10, done: false },
            { id: 's2', weightKg: 75, reps: 10, done: false },
            { id: 's3', weightKg: 80, reps: 8, done: false },
          ],
        },
      ];
    }

    setExercises(presetEx);
    setRestSeconds(targetRestSeconds);
    setTimerRunning(false);
    setShowNewSessionModal(false);
    setNewSessionTitleInput('');
  };

  // Live tonnage calculation
  const totalTonnageKg = exercises.reduce((acc, ex) => {
    return (
      acc +
      ex.sets.reduce((exAcc, s) => {
        return exAcc + (s.done ? s.weightKg * s.reps : 0);
      }, 0)
    );
  }, 0);

  const totalSetsCount = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const doneSetsCount = exercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.done).length, 0);

  // ------------------ CERCLE VYTA (SOCIAL FEED) ------------------
  const [posts, setPosts] = useState<FeedPost[]>(feedSeed);
  const [boostedPosts, setBoostedPosts] = useState<Record<number, boolean>>({});

  const handleBoost = (id: number) => {
    setBoostedPosts((prev) => {
      const isBoosted = !!prev[id];
      const nextBoosted = !isBoosted;

      setPosts((currentPosts) =>
        currentPosts.map((p) =>
          p.id === id ? { ...p, boosts: p.boosts + (nextBoosted ? 1 : -1) } : p
        )
      );

      return { ...prev, [id]: nextBoosted };
    });
  };

  // Handlers for Story Generator
  const openRunStory = () => {
    const finalDist = parseFloat(runDistanceKm.toFixed(2));
    const finalDur = runDurationSec;
    const finalAvgSpeed = finalDist > 0 && finalDur > 0
      ? (finalDist / (finalDur / 3600)).toFixed(1).replace('.', ',')
      : '0,0';
    const finalHr = liveHr > 40 ? liveHr : 0;

    openStory({
      mode: 'run',
      title: 'Course GPS Stoic',
      dateStr: new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
      accentText: 'Séance GPS Enregistrée',
      stats: [
        { label: 'Distance', value: finalDist > 0 ? `${finalDist.toFixed(2)}` : '0.00', unit: 'km' },
        { label: 'Vitesse Moyenne', value: finalAvgSpeed, unit: 'km/h' },
        { label: 'Temps', value: fmtClockSec(finalDur) },
        { label: 'FC Moyenne', value: finalHr > 0 ? `${finalHr}` : '--', unit: 'bpm' },
      ],
      realGpsPoints: realGpsPoints && realGpsPoints.length >= 2 ? realGpsPoints : undefined,
    });
  };

  const openGymStory = () => {
    const completionPct = totalSetsCount > 0 ? Math.round((doneSetsCount / totalSetsCount) * 100) : 0;
    openStory({
      mode: 'gym',
      title: sessionTitle,
      dateStr: new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
      tonnageKg: totalTonnageKg,
      accentText: 'Séance Personnalisée Validée',
      stats: [
        {
          label: 'Charge Totale',
          value: totalTonnageKg >= 1000 ? (totalTonnageKg / 1000).toFixed(1) : `${totalTonnageKg}`,
          unit: totalTonnageKg >= 1000 ? 't' : 'kg',
        },
        { label: 'Séries Validées', value: `${doneSetsCount} / ${totalSetsCount}` },
        { label: 'Temps Repos', value: `${targetRestSeconds}`, unit: 's' },
        { label: 'Complétion', value: `${completionPct}`, unit: '%' },
      ],
    });
  };

  return (
    <>
      <div className="screen-content" style={isLiveRunningViewOpen ? { display: 'none' } : undefined}>
      {/* Title */}
      <div style={{ paddingTop: '10px' }}>
        <span className="header-subtitle">Performance & Effort</span>
        <h1 className="header-title">Fit</h1>
      </div>

      {/* 4-Section Segmented Control (Course, Trajets, Musculation, Cercle) */}
      <div className="segmented-control" role="tablist">
        <button
          type="button"
          className={`segmented-btn ${subTab === 'run' ? 'active' : ''}`}
          onClick={() => setSubTab('run')}
        >
          Course
        </button>
        <button
          type="button"
          className={`segmented-btn ${subTab === 'trajets' ? 'active' : ''}`}
          onClick={() => setSubTab('trajets')}
        >
          Trajets
        </button>
        <button
          type="button"
          className={`segmented-btn ${subTab === 'gym' ? 'active' : ''}`}
          onClick={() => setSubTab('gym')}
        >
          Musculation
        </button>
        <button
          type="button"
          className={`segmented-btn ${subTab === 'feed' ? 'active' : ''}`}
          onClick={() => setSubTab('feed')}
        >
          Cercle
        </button>
      </div>

      {/* ==================== 1. MODE COURSE & CARDIO ==================== */}
      <div key={subTab} className="subtab-view">
      {subTab === 'run' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Running in progress banner if minimized */}
          {!isLiveRunningViewOpen && (runState === 'running' || runState === 'paused') && (
            <div
              onClick={() => setIsLiveRunningViewOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'linear-gradient(135deg, rgba(252, 82, 0, 0.22), rgba(0, 122, 255, 0.22))',
                border: '1.5px solid #FC5200',
                borderRadius: '16px',
                cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(252, 82, 0, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FC5200', boxShadow: '0 0 10px #FC5200' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>Course à pied active (Live)</div>
                  <div style={{ fontSize: '11px', color: '#8E8E93', fontFamily: 'monospace' }}>
                    {fmtClockSec(runDurationSec)} • {runDistanceKm.toFixed(2)} km
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#FC5200', display: 'flex', alignItems: 'center', gap: '4px' }}>
                AFFICHER ↗
              </span>
            </div>
          )}
          {/* Bandeau de Contrôle de la Course GPS Vyta */}
          <div className="run-control-card">
            <div className="run-control-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  className={`gps-beacon-tag ${
                    runState === 'running'
                      ? ''
                      : runState === 'paused'
                      ? 'paused'
                      : 'idle'
                  }`}
                >
                  <span className="gps-pulse-dot" />
                  <span>
                    {runState === 'running'
                      ? 'GPS Stoic Actif (Live)'
                      : runState === 'paused'
                      ? 'GPS en pause'
                      : 'GPS Stoic Prêt'}
                  </span>
                </span>
              </div>
            </div>

            {/* Run Action Buttons */}
            {(runState === 'idle' || runState === 'finished') && (
              <button type="button" className="start-run-btn-main" onClick={startRun}>
                <Play size={16} fill="#000000" />
                <span>Démarrer la course</span>
              </button>
            )}

            {runState === 'running' && (
              <div className="run-action-btns-row">
                <button type="button" className="pause-run-btn" onClick={pauseRun}>
                  <Pause size={15} />
                  <span>Pause</span>
                </button>
                <button type="button" className="stop-run-btn" onClick={stopRun}>
                  <Square size={14} fill="currentColor" />
                  <span>Terminer</span>
                </button>
              </div>
            )}

            {runState === 'paused' && (
              <div className="run-action-btns-row">
                <button type="button" className="resume-run-btn" onClick={resumeRun}>
                  <Play size={15} fill="currentColor" />
                  <span>Reprendre</span>
                </button>
                <button type="button" className="stop-run-btn" onClick={stopRun}>
                  <Square size={14} fill="currentColor" />
                  <span>Terminer</span>
                </button>
              </div>
            )}
          </div>

          {/* Authentic Apple Maps Dark Mode Workout Map */}
          <AppleWorkoutMap
            onOpenStory={openRunStory}
            progress={liveProgress}
            runState={runState}
            distanceKm={runDistanceKm}
            realGpsPoints={realGpsPoints}
            userPosition={userPosition}
          />
        </div>
      )}

      {/* ==================== 2. MODE MES TRAJETS ENREGISTRÉS ==================== */}
      {subTab === 'trajets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* En-tête Trajets */}
          <div className="session-header-card">
            <div className="session-title-row">
              <div>
                <span className="session-title-text" style={{ fontSize: '17px' }}>
                  Mes Trajets
                </span>
              </div>

              <button
                type="button"
                className="add-exercise-btn-main"
                style={{ flex: '0 0 auto', padding: '8px 13px', background: '#FFFFFF', color: '#000000' }}
                onClick={() => setShowNewRouteModal(true)}
              >
                <Plus size={14} />
                <span>Nouveau trajet</span>
              </button>
            </div>
          </div>

          {/* Résumé global des trajets */}
          <div className="activity-raw-card">
            <div className="activity-raw-item">
              <span className="activity-raw-label">
                <Route size={11} />
                <span>Parcours</span>
              </span>
              <div>
                <span className="activity-raw-val">{storedRoutes.length}</span>
              </div>
            </div>

            <div className="activity-raw-item">
              <span className="activity-raw-label">
                <Navigation size={11} />
                <span>Distance cumulée</span>
              </span>
              <div>
                <span className="activity-raw-val">
                  {storedRoutes.reduce((acc, r) => acc + r.distanceKm, 0).toFixed(1)}
                </span>
                <span className="activity-raw-unit">km</span>
              </div>
            </div>

            <div className="activity-raw-item">
              <span className="activity-raw-label">
                <TrendingUp size={11} />
                <span>Dénivelé total</span>
              </span>
              <div>
                <span className="activity-raw-val">
                  +{storedRoutes.reduce((acc, r) => acc + r.elevationM, 0)}
                </span>
                <span className="activity-raw-unit">m</span>
              </div>
            </div>
          </div>

          {/* Liste de tous les trajets stockés */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {storedRoutes.map((route) => (
              <div
                key={route.id}
                className="session-card"
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderRadius: '18px',
                  background: 'rgba(20, 20, 24, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {/* Mini SVG Trajectory Preview (Toucher pour ouvrir sur Apple Maps) */}
                  {(() => {
                    const visual = getRouteThumbnailSvg(route);
                    return (
                      <div
                        onClick={() => {
                          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                            try { navigator.vibrate(25); } catch (_) {}
                          }
                          setViewingRouteForMap(route);
                        }}
                        role="button"
                        tabIndex={0}
                        title="Toucher pour voir le trajet sur Apple Maps"
                        style={{
                          width: '68px',
                          height: '68px',
                          borderRadius: '16px',
                          background: 'radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, 0.06) 0%, rgba(12, 12, 16, 0.98) 100%)',
                          border: '1px solid rgba(255, 255, 255, 0.16)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          position: 'relative',
                          overflow: 'hidden',
                          boxShadow: 'inset 0 0 14px rgba(0,0,0,0.8), 0 4px 14px rgba(0,0,0,0.4)',
                          cursor: 'pointer',
                          transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      >
                        <svg viewBox={visual.viewBox} style={{ width: '54px', height: '54px', overflow: 'visible' }}>
                          {/* Faint Tactical Radar Crosshair Grid */}
                          <line x1="12" y1="50" x2="88" y2="50" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="2 3" strokeWidth="0.8" />
                          <line x1="50" y1="12" x2="50" y2="88" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="2 3" strokeWidth="0.8" />

                          {visual.isSinglePoint ? (
                            <>
                              <circle cx="50" cy="50" r="22" fill="none" stroke="rgba(48, 209, 88, 0.16)" strokeWidth="1" strokeDasharray="3 3" />
                              <circle cx="50" cy="50" r="13" fill="rgba(48, 209, 88, 0.12)" stroke="rgba(48, 209, 88, 0.4)" strokeWidth="1" />
                              <circle cx="50" cy="50" r="4.5" fill="#30D158" stroke="#000000" strokeWidth="1.5" />
                              <text x="50" y="80" textAnchor="middle" fill="rgba(250, 247, 242, 0.55)" fontSize="8.5" fontWeight="700" fontFamily="var(--font-mono)" letterSpacing="0.06em">
                                FIXE
                              </text>
                            </>
                          ) : (
                            <>
                              {/* Ambient Glowing Under-Trace */}
                              <path
                                d={visual.pathD}
                                fill="none"
                                stroke="rgba(255, 255, 255, 0.3)"
                                strokeWidth="5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.6))' }}
                              />
                              {/* Crisp Core Route Line */}
                              <path
                                d={visual.pathD}
                                fill="none"
                                stroke="#FAF7F2"
                                strokeWidth="2.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              {/* Start Pin: Green Dot */}
                              <circle
                                cx={visual.startPoint.x}
                                cy={visual.startPoint.y}
                                r="3.5"
                                fill="#30D158"
                                stroke="#0A0A0C"
                                strokeWidth="1.5"
                              />
                              {/* Finish Pin: High-Contrast White Pin */}
                              <circle
                                cx={visual.endPoint.x}
                                cy={visual.endPoint.y}
                                r="3.5"
                                fill="#FFFFFF"
                                stroke="#0A0A0C"
                                strokeWidth="1.5"
                              />
                            </>
                          )}
                        </svg>

                        {/* Mini Apple Maps indicator pill */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '3px',
                            right: '3px',
                            width: '18px',
                            height: '18px',
                            borderRadius: '6px',
                            background: 'rgba(10, 10, 14, 0.88)',
                            border: '1px solid rgba(255, 255, 255, 0.22)',
                            backdropFilter: 'blur(6px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                          }}
                        >
                          <MapPin size={10} color="#30D158" />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {route.title}
                    </span>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {route.location} · {formatRouteDateStr(route)}
                    </div>

                    {/* Specs row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                        {route.distanceKm.toFixed(2)} km
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        ⏱ {fmtClockSec(route.durationSec)}
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        ⚡ {route.distanceKm > 0 && route.durationSec > 0 ? `${(route.distanceKm / (route.durationSec / 3600)).toFixed(1).replace('.', ',')} km/h` : '-- km/h'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions: Lancer, Partager, Supprimer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <button
                    type="button"
                    onClick={() => loadAndStartRoute(route)}
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: '10px',
                      background: '#FFFFFF',
                      color: '#000000',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <Play size={13} fill="#000000" />
                    <span>Lancer ce trajet</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => shareStoredRoute(route, e)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#FFFFFF',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    title="Partager ce trajet"
                  >
                    <Share2 size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => deleteRoute(route.id, e)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: 'var(--text-secondary)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    title="Supprimer ce trajet"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Nouveau Trajet Manuel */}
      {showNewRouteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowNewRouteModal(false)}
        >
          <div
            style={{
              background: '#151518',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '20px',
              padding: '22px',
              width: '100%',
              maxWidth: '380px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '17px', fontWeight: 700, color: '#FFFFFF' }}>Nouveau Trajet</span>
              <button
                type="button"
                onClick={() => setShowNewRouteModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Nom du parcours</label>
              <input
                type="text"
                value={newRouteTitle}
                onChange={(e) => setNewRouteTitle(e.target.value)}
                placeholder="ex: Tour du Canal Saint-Martin"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Lieu / Départ</label>
              <input
                type="text"
                value={newRouteLoc}
                onChange={(e) => setNewRouteLoc(e.target.value)}
                placeholder="ex: Paris 10e · Quai de Valmy"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Distance estimée (km)</label>
              <input
                type="number"
                step="0.1"
                value={newRouteDist}
                onChange={(e) => setNewRouteDist(e.target.value)}
                placeholder="5.0"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setShowNewRouteModal(false)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateRoute}
                style={{
                  flex: 1.5,
                  padding: '11px',
                  borderRadius: '12px',
                  background: '#FFFFFF',
                  border: 'none',
                  color: '#000000',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 3. MODE MUSCULATION (GYM LOGGER) ==================== */}
      {subTab === 'gym' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Header de la Séance Personnalisée */}
          <div className="session-header-card">
            <div className="session-title-row">
              {isEditingTitle ? (
                <div className="session-title-edit">
                  <input
                    type="text"
                    className="settings-input"
                    style={{ padding: '6px 10px', fontSize: '14px', height: '34px', flex: 1 }}
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setIsEditingTitle(false);
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="gear-btn"
                    style={{ width: '34px', height: '34px' }}
                    onClick={() => setIsEditingTitle(false)}
                    title="Valider le titre"
                  >
                    <Check size={14} color="var(--gold)" />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span className="session-title-text">{sessionTitle}</span>
                  <button
                    type="button"
                    className="gear-btn"
                    style={{ width: '26px', height: '26px', border: 'none', background: 'transparent' }}
                    onClick={() => setIsEditingTitle(true)}
                    title="Modifier le titre"
                  >
                    <Edit3 size={13} color="var(--text-secondary)" />
                  </button>
                </div>
              )}
              <span
                className="health-badge"
                style={{
                  background: 'rgba(184, 35, 72, 0.12)',
                  color: 'var(--gold)',
                  border: '1px solid var(--gold-border)',
                  flexShrink: 0,
                  fontSize: '10.5px',
                  padding: '3px 8px',
                }}
              >
                En cours
              </span>
            </div>

            <div className="session-actions-row">
              <button
                type="button"
                className="add-exercise-btn-main"
                onClick={() => setShowAddModal(true)}
              >
                <Plus size={14} />
                <span>Ajouter un exercice</span>
              </button>

              <button
                type="button"
                className="new-session-btn"
                onClick={() => setShowNewSessionModal(true)}
              >
                <RotateCcw size={13} />
                <span>Nouvelle séance</span>
              </button>
            </div>
          </div>

          {/* Tonnage Total Counter Header */}
          <div className="activity-raw-card" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="activity-raw-item">
              <span className="activity-raw-label">
                <Dumbbell size={12} />
                <span>Tonnage Soulevé</span>
              </span>
              <div>
                <span className="activity-raw-val">
                  {totalTonnageKg >= 1000
                    ? `${(totalTonnageKg / 1000).toFixed(1)} t`
                    : `${totalTonnageKg} kg`}
                </span>
              </div>
            </div>

            <div className="activity-raw-item">
              <span className="activity-raw-label">
                <Award size={12} />
                <span>Séries Validées</span>
              </span>
              <div>
                <span className="activity-raw-val">
                  {doneSetsCount} / {totalSetsCount}
                </span>
              </div>
            </div>
          </div>

          {/* Chronomètre de repos configurable avec presets */}
          <div className="rest-timer-card">
            <div className="rest-timer-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <Timer size={18} color="var(--gold)" />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                      Chronomètre de repos
                    </span>
                    <span
                      style={{
                        fontSize: '9.5px',
                        background: 'rgba(184, 35, 72, 0.15)',
                        color: 'var(--gold)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      {fmtMMSS(targetRestSeconds)}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: timerRunning ? 'var(--gold-light)' : '#FFFFFF',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '-0.02em',
                      display: 'block',
                      marginTop: '1px',
                    }}
                  >
                    {fmtMMSS(restSeconds)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <button
                  type="button"
                  className="rest-adjust-btn"
                  onClick={() => adjustRestBy(-15)}
                  title="Retirer 15 secondes"
                >
                  -15s
                </button>
                <button
                  type="button"
                  className="rest-adjust-btn"
                  onClick={() => adjustRestBy(15)}
                  title="Ajouter 15 secondes"
                >
                  +15s
                </button>

                <button
                  type="button"
                  className="gear-btn"
                  style={{ width: '32px', height: '32px' }}
                  onClick={() => setTimerRunning(!timerRunning)}
                  title={timerRunning ? 'Pause' : 'Démarrer'}
                >
                  {timerRunning ? <Pause size={13} /> : <Play size={13} fill="#fff" />}
                </button>

                <button
                  type="button"
                  className="gear-btn"
                  style={{ width: '32px', height: '32px' }}
                  onClick={() => {
                    setTimerRunning(false);
                    setRestSeconds(targetRestSeconds);
                  }}
                  title={`Réinitialiser à ${fmtMMSS(targetRestSeconds)}`}
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>

            {/* Rangée de presets rapides (30s, 45s, 1m, 1m30, 2m, 3m) */}
            <div className="rest-preset-pills">
              {restPresets.map((p) => {
                const isSelected = targetRestSeconds === p.sec;
                return (
                  <button
                    key={p.sec}
                    type="button"
                    className={`rest-preset-pill ${isSelected ? 'active' : ''}`}
                    onClick={() => setChosenRest(p.sec)}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exercise Log Sets */}
          {exercises.map((ex) => (
            <div key={ex.id} className="gym-exercise-card">
              <div className="gym-exercise-header">
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>
                    {ex.name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                    {ex.sets.length} {ex.sets.length > 1 ? 'séries' : 'série'}
                  </span>
                </div>
                <button
                  type="button"
                  className="exercise-manage-pill-btn"
                  onClick={() => setManagingExId(ex.id)}
                  title="Paramètres de l'exercice (poids, séries, suppression)"
                >
                  <Sliders size={12} color="var(--gold)" />
                  <span>Gérer</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ex.sets.map((s, setIdx) => (
                  <div key={s.id} className="gym-set-row">
                    <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      S{setIdx + 1}
                    </span>

                    {/* Stepper kg */}
                    <div className="set-mini-control">
                      <button
                        type="button"
                        className="mini-step-btn"
                        onClick={() => adjustWeight(ex.id, s.id, -2.5)}
                        title="-2.5 kg"
                      >
                        -
                      </button>
                      <span className="mini-step-val">{s.weightKg} kg</span>
                      <button
                        type="button"
                        className="mini-step-btn"
                        onClick={() => adjustWeight(ex.id, s.id, 2.5)}
                        title="+2.5 kg"
                      >
                        +
                      </button>
                    </div>

                    {/* Stepper reps */}
                    <div className="set-mini-control">
                      <button
                        type="button"
                        className="mini-step-btn"
                        onClick={() => adjustReps(ex.id, s.id, -1)}
                        title="-1 rép"
                      >
                        -
                      </button>
                      <span className="mini-step-val">{s.reps} réps</span>
                      <button
                        type="button"
                        className="mini-step-btn"
                        onClick={() => adjustReps(ex.id, s.id, 1)}
                        title="+1 rép"
                      >
                        +
                      </button>
                    </div>

                    {/* Checkmark button */}
                    <button
                      type="button"
                      className={`set-check-btn ${s.done ? 'done' : ''}`}
                      onClick={() => toggleSetDone(ex.id, s.id)}
                      title={s.done ? 'Série validée' : 'Valider la série'}
                    >
                      {s.done ? <Check size={14} /> : <Plus size={13} />}
                    </button>
                  </div>
                ))}
              </div>

              {/* + Ajouter une série */}
              <button
                type="button"
                className="add-set-link-btn"
                onClick={() => addSetToExercise(ex.id)}
              >
                <Plus size={13} />
                <span>Ajouter une série</span>
              </button>
            </div>
          ))}

          {/* Partager Ma Séance CTA (uniquement si des séries ont été effectuées) */}
          {doneSetsCount > 0 && (
            <button
              type="button"
              className="apple-pay-btn"
              style={{
                background: '#FFFFFF',
                color: '#000000',
                fontWeight: 700,
                boxShadow: '0 8px 24px rgba(255, 255, 255, 0.16)',
                marginTop: '4px',
              }}
              onClick={openGymStory}
            >
              <Share2 size={16} />
              <span>Partager Ma Séance</span>
            </button>
          )}
        </div>
      )}

      {/* ==================== 3. CERCLE VYTA (SOCIAL FEED) ==================== */}
      {subTab === 'feed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {posts.map((post) => {
            const isBoosted = !!boostedPosts[post.id];
            return (
              <div key={post.id} className="feed-post-card">
                <div className="post-header">
                  <div className="post-author">
                    <div className="author-avatar">{post.initials}</div>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', display: 'block' }}>
                        {post.name}
                      </span>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                        {post.kind} • {post.when}
                      </span>
                    </div>
                  </div>

                  {/* Kudos / Stoic Boost button */}
                  <button
                    type="button"
                    className={`boost-btn ${isBoosted ? 'boosted' : ''}`}
                    onClick={() => handleBoost(post.id)}
                    title="Envoyer un Stoic Boost"
                  >
                    <Flame size={13} color={isBoosted ? 'var(--gold)' : '#FFFFFF'} />
                    <span>{post.boosts} Boosts</span>
                  </button>
                </div>

                <p style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
                  {post.title}
                </p>

                {/* Stats pill list */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {post.stats.map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        fontSize: '11px',
                      }}
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>{s.label} : </span>
                      <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* ==================== MODAL AJOUTER UN EXERCICE ==================== */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Séance en cours
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  Ajouter un Exercice
                </h2>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAddModal(false)}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Titre de l'exercice */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Titre de l'exercice
              </label>
              <input
                type="text"
                className="settings-input"
                placeholder="Ex: Tractions pronation, Dips..."
                value={newExName}
                onChange={(e) => setNewExName(e.target.value)}
              />
              {/* Suggestions rapides */}
              <div className="exercise-quick-chips">
                {[
                  'Développé couché',
                  'Squat barre',
                  'Soulevé de terre',
                  'Développé militaire',
                  'Tractions',
                  'Rowing barre',
                  'Curl haltères',
                  'Élévations latérales',
                  'Dips',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className={`ex-chip ${newExName === chip ? 'active' : ''}`}
                    onClick={() => setNewExName(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Configurations des séries, poids et répétitions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {/* Séries */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '10px',
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  Séries
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    className="mini-step-btn"
                    style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '6px' }}
                    onClick={() => setNewExSetsCount((prev) => Math.max(1, prev - 1))}
                  >
                    <Minus size={12} />
                  </button>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff', minWidth: '24px' }}>
                    {newExSetsCount}
                  </span>
                  <button
                    type="button"
                    className="mini-step-btn"
                    style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '6px' }}
                    onClick={() => setNewExSetsCount((prev) => Math.min(10, prev + 1))}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {/* Poids */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '10px',
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  Charge (kg)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    className="mini-step-btn"
                    style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '6px' }}
                    onClick={() => setNewExWeight((prev) => Math.max(0, Math.round((prev - 2.5) * 10) / 10))}
                  >
                    <Minus size={12} />
                  </button>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff', minWidth: '38px' }}>
                    {newExWeight}
                  </span>
                  <button
                    type="button"
                    className="mini-step-btn"
                    style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '6px' }}
                    onClick={() => setNewExWeight((prev) => Math.round((prev + 2.5) * 10) / 10)}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {/* Répétitions */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '10px',
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  Répétitions
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    className="mini-step-btn"
                    style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '6px' }}
                    onClick={() => setNewExReps((prev) => Math.max(1, prev - 1))}
                  >
                    <Minus size={12} />
                  </button>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff', minWidth: '24px' }}>
                    {newExReps}
                  </span>
                  <button
                    type="button"
                    className="mini-step-btn"
                    style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '6px' }}
                    onClick={() => setNewExReps((prev) => Math.min(50, prev + 1))}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="add-exercise-btn-main"
              style={{ padding: '12px', marginTop: '6px' }}
              onClick={() => handleAddExercise(newExName, newExSetsCount, newExWeight, newExReps)}
            >
              <Plus size={15} />
              <span>Valider et Ajouter à la Séance</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================== MODAL NOUVELLE SÉANCE ==================== */}
      {showNewSessionModal && (
        <div className="modal-backdrop" onClick={() => setShowNewSessionModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Planification Fit
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  Nouvelle Séance
                </h2>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowNewSessionModal(false)}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Titre de la nouvelle séance
              </label>
              <input
                type="text"
                className="settings-input"
                placeholder="Ex: Séance Pectoraux & Bras, Dos & Biceps..."
                value={newSessionTitleInput}
                onChange={(e) => setNewSessionTitleInput(e.target.value)}
              />
              <div className="exercise-quick-chips">
                {[
                  'Séance Pectoraux & Bras',
                  'Séance Dos & Biceps',
                  'Séance Jambes & Fessiers',
                  'Séance Épaules & Abdos',
                  'Full Body Performance',
                  'Force Maximale (5x5)',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`ex-chip ${newSessionTitleInput === preset ? 'active' : ''}`}
                    onClick={() => setNewSessionTitleInput(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="add-exercise-btn-main"
              style={{ padding: '12px', marginTop: '8px' }}
              onClick={() => handleCreateNewSession(newSessionTitleInput || 'Nouvelle Séance')}
            >
              <Check size={15} />
              <span>Démarrer cette séance</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Paramètres de l'exercice */}
      {managingExId && (
        (() => {
          const curEx = exercises.find((e) => e.id === managingExId);
          if (!curEx) return null;
          return (
            <ExerciseSettingsModal
              exercise={curEx}
              onClose={() => setManagingExId(null)}
              onRename={(newName) => renameExercise(curEx.id, newName)}
              onApplyWeightDeltaAll={(delta) => applyWeightDeltaAll(curEx.id, delta)}
              onAdjustWeight={(setId, delta) => adjustWeight(curEx.id, setId, delta)}
              onAdjustReps={(setId, delta) => adjustReps(curEx.id, setId, delta)}
              onDeleteSet={(setId) => deleteSet(curEx.id, setId)}
              onAddSet={() => addSetToExercise(curEx.id)}
              onDeleteExercise={() => {
                deleteExercise(curEx.id);
                setManagingExId(null);
              }}
            />
          );
        })()
      )}

      {/* Modal Dédiée : Visualisation du trajet sur Apple Maps */}
      {viewingRouteForMap && (
        <div
          className="modal-backdrop"
          onClick={() => setViewingRouteForMap(null)}
          style={{
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-end',
            padding: 0,
            background: 'rgba(0, 0, 0, 0.76)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '520px',
              margin: '0 auto',
              background: 'rgba(18, 18, 22, 0.98)',
              borderTopLeftRadius: '28px',
              borderTopRightRadius: '28px',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderBottom: 'none',
              padding: '16px 18px calc(24px + env(safe-area-inset-bottom, 0px)) 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.85)',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            {/* Grabber Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-4px' }}>
              <div style={{ width: '40px', height: '4px', borderRadius: '999px', background: 'rgba(255, 255, 255, 0.25)' }} />
            </div>

            {/* Header: Title, Location & Close */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} color="#30D158" />
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#30D158' }}>
                    Trajet Apple Maps
                  </span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FAF7F2', margin: '4px 0 2px 0', letterSpacing: '-0.3px' }}>
                  {viewingRouteForMap.title}
                </h3>
                <span style={{ fontSize: '12px', color: 'rgba(250, 247, 242, 0.65)' }}>
                  {viewingRouteForMap.location || (viewingRouteForMap.distanceKm < 0.05 ? 'Session statique' : 'Course extérieure')} · {formatRouteDateStr(viewingRouteForMap)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setViewingRouteForMap(null)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FAF7F2',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Interactive Apple Workout Map */}
            <div
              style={{
                width: '100%',
                height: '310px',
                borderRadius: '20px',
                overflow: 'hidden',
                position: 'relative',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              }}
            >
              <AppleWorkoutMap
                runState="finished"
                realGpsPoints={getRouteEffectivePoints(viewingRouteForMap)}
                distanceKm={viewingRouteForMap.distanceKm}
              />
            </div>

            {/* Telemetry Strip: 4 Key Metrics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '12px 6px',
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.5)', fontWeight: 600 }}>Distance</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#FAF7F2', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {viewingRouteForMap.distanceKm.toFixed(2)} <span style={{ fontSize: '10.5px', fontWeight: 400 }}>km</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.5)', fontWeight: 600 }}>Temps</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#FAF7F2', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {fmtClockSec(viewingRouteForMap.durationSec)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.5)', fontWeight: 600 }}>Vitesse Moy.</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#FAF7F2', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {viewingRouteForMap.distanceKm > 0 && viewingRouteForMap.durationSec > 0
                    ? `${(viewingRouteForMap.distanceKm / (viewingRouteForMap.durationSec / 3600)).toFixed(1).replace('.', ',')} `
                    : '-- '}
                  <span style={{ fontSize: '10.5px', fontWeight: 400 }}>km/h</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.5)', fontWeight: 600 }}>Dénivelé</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#30D158', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  +{viewingRouteForMap.elevationM || Math.round(viewingRouteForMap.distanceKm * 8)}m
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => openInNativeAppleMaps(viewingRouteForMap)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '13px 14px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                  color: '#FAF7F2',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <Compass size={16} color="#30D158" />
                <span>Ouvrir dans Plans</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const r = viewingRouteForMap;
                  setViewingRouteForMap(null);
                  loadAndStartRoute(r);
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '13px 14px',
                  borderRadius: '14px',
                  background: '#FFFFFF',
                  border: 'none',
                  color: '#000000',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(255, 255, 255, 0.25)',
                }}
              >
                <Play size={14} fill="#000000" />
                <span>Lancer ce trajet</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Live Running Screen (Strava / Apple Fitness Native Experience) */}
      {isLiveRunningViewOpen && (runState === 'running' || runState === 'paused' || runState === 'finished') && (
        <LiveRunningView
          runState={runState}
          runDurationSec={runDurationSec}
          runDistanceKm={runDistanceKm}
          liveSpeedKmh={parseFloat(liveSpeedKmh)}
          liveHr={liveHr}
          liveElevation={liveElevation}
          liveCalories={liveCalories}
          livePaceSec={livePaceSec}
          telemetryHistory={telemetryHistory}
          onPause={pauseRun}
          onResume={resumeRun}
          onStop={stopRun}
          onClose={() => setIsLiveRunningViewOpen(false)}
          onOpenStory={openRunStory}
          realGpsPoints={realGpsPoints}
          userPosition={userPosition}
        />
      )}
    </>
  );
};
