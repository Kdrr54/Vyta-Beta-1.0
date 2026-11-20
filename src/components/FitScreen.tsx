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
import { AnimatePresence, motion } from 'framer-motion';
import { AnimatedSheet, SPRING_SNAPPY } from './ui/AnimatedSheet';
import { useApp } from '../context/AppContext';
import { qringBle } from '../lib/qringBleService';
import { run, zones, routeRaw, fitRoute, toPath } from '../data/fit';
import { fmtClockSec, fmtMMSS, fmtNum } from '../lib/format';
import { StoryData, convertGpsPointsToSvgPath } from '../lib/story';
import { AppleWorkoutMap } from './AppleWorkoutMap';
import { LiveRunningView } from './LiveRunningView';
import { ExerciseSettingsModal } from './ExerciseSettingsModal';
import { RunTelemetryCharts, TelemetryPoint } from './RunTelemetryCharts';
import { StepsTabView } from './StepsTabView';
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
  Bookmark,
  MoreVertical,
  ExternalLink,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Activity,
  BarChart3,
  Target
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
  telemetryHistory?: TelemetryPoint[];
  isIndoor?: boolean;
}

const initialStoredRoutes: StoredRoute[] = [];

export type GymSetType = 'warmup' | 'normal' | 'heavy' | 'drop';

export interface GymSet {
  id: string;
  weightKg: number;
  reps: number;
  done: boolean;
  setType?: GymSetType;
  rpe?: number;
}

export interface GymExercise {
  id: string;
  name: string;
  sets: GymSet[];
  restSec?: number;
  notes?: string;
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

function sanitizeRouteGpsPoints(pts?: [number, number][]): [number, number][] | undefined {
  if (!pts || pts.length < 3) return pts;
  const clean: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = clean[clean.length - 1];
    const curr = pts[i];
    const distM = calculateGpsDistanceMeters(prev[0], prev[1], curr[0], curr[1]);
    // S'il y a un saut brutal de plus de 85m entre deux points consécutifs alors que le tracé est bien avancé,
    // c'est un artefact de resynchronisation / téléportation de fin de course : on coupe la queue corrompue
    if (distM > 85 && clean.length > 10) {
      break;
    }
    clean.push(curr);
  }
  return clean;
}

export const FitScreen: React.FC = () => {
  const { language, openStory, isLiveRunningViewOpen, setIsLiveRunningViewOpen, liveBpm, isLiveHrActive, setIsLiveHrActive, selectedDateKey, weekData, profile } = useApp();
  const isEn = language === 'en';
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const resolveInitialFitSubTab = (): 'steps' | 'run' | 'trajets' | 'gym' => {
    if (typeof window !== 'undefined') {
      try {
        const pending = sessionStorage.getItem('vyta_pending_fit_subtab');
        if (pending === 'steps' || pending === 'run' || pending === 'trajets' || pending === 'gym') {
          sessionStorage.removeItem('vyta_pending_fit_subtab');
          return pending;
        }
      } catch (_) {}
    }
    const q = params?.get('fit');
    if (q === 'steps' || q === 'run' || q === 'trajets' || q === 'gym') return q;
    return 'steps';
  };
  const [subTab, setSubTab] = useState<'steps' | 'run' | 'trajets' | 'gym'>(resolveInitialFitSubTab);

  useEffect(() => {
    const onOpenSubTab = (e: Event) => {
      const target = (e as CustomEvent<string>)?.detail;
      if (target === 'steps' || target === 'run' || target === 'trajets' || target === 'gym') {
        setSubTab(target);
        try { sessionStorage.removeItem('vyta_pending_fit_subtab'); } catch (_) {}
      }
    };
    window.addEventListener('vyta:open-fit-subtab', onOpenSubTab);
    return () => window.removeEventListener('vyta:open-fit-subtab', onOpenSubTab);
  }, []);

  const [storedRoutes, setStoredRoutes] = useState<StoredRoute[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vyta_stored_routes');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            // Nettoyage immédiat des faux tracés sur les sessions stationnaires (hors tapis)
            return parsed.map((r: StoredRoute) => {
              if (r.isIndoor) {
                return {
                  ...r,
                  pointsSvgPath: '',
                  realGpsPoints: undefined,
                };
              }
              const isStationary = !r.distanceKm || r.distanceKm < 0.05 || (!r.realGpsPoints || r.realGpsPoints.length < 2);
              if (isStationary) {
                return {
                  ...r,
                  pointsSvgPath: '',
                  realGpsPoints: r.realGpsPoints && r.realGpsPoints.length === 1 ? r.realGpsPoints : undefined,
                  location: (!r.distanceKm || r.distanceKm < 0.05) ? 'Session statique' : r.location,
                };
              }

              // Nettoyer les artefacts de téléportation en fin de parcours
              if (r.realGpsPoints && r.realGpsPoints.length > 10) {
                const cleanedPoints = sanitizeRouteGpsPoints(r.realGpsPoints);
                if (cleanedPoints && cleanedPoints.length < r.realGpsPoints.length) {
                  const pathInfo = convertGpsPointsToSvgPath(cleanedPoints);
                  const trimmedFraction = cleanedPoints.length / r.realGpsPoints.length;
                  return {
                    ...r,
                    realGpsPoints: cleanedPoints,
                    pointsSvgPath: pathInfo.pathD,
                    durationSec: Math.round(r.durationSec * trimmedFraction),
                    distanceKm: Math.round(r.distanceKm * trimmedFraction * 100) / 100,
                  };
                }
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
  const [routeFilter, setRouteFilter] = useState<'all' | 'outdoor' | 'treadmill'>('all');
  const [newRouteTitle, setNewRouteTitle] = useState<string>('');
  const [newRouteDist, setNewRouteDist] = useState<string>('5.0');
  const [newRouteLoc, setNewRouteLoc] = useState<string>('Paris');
  const [viewingRouteForMap, setViewingRouteForMap] = useState<StoredRoute | null>(null);
  const lastViewingRouteRef = useRef<StoredRoute | null>(null);
  if (viewingRouteForMap) lastViewingRouteRef.current = viewingRouteForMap;
  const activeViewingRoute = viewingRouteForMap || lastViewingRouteRef.current;

  const [routeModalTab, setRouteModalTab] = useState<'map' | 'charts'>('map');
  const [managingRoute, setManagingRoute] = useState<StoredRoute | null>(null);
  const lastManagingRouteRef = useRef<StoredRoute | null>(null);
  if (managingRoute) lastManagingRouteRef.current = managingRoute;
  const activeManagingRoute = managingRoute || lastManagingRouteRef.current;
  const [editingRouteTitle, setEditingRouteTitle] = useState<string>('');
  const [showRouteDeleteConfirm, setShowRouteDeleteConfirm] = useState<boolean>(false);
  const [isSimulatingRoute, setIsSimulatingRoute] = useState<boolean>(false);
  const [simProgress, setSimProgress] = useState<number>(0);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const simAnimRef = useRef<number | null>(null);
  const simLastTimeRef = useRef<number | null>(null);

  // Verrouillage du scroll d'arrière-plan lorsque la modale de carte est active
  useEffect(() => {
    if (viewingRouteForMap) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [viewingRouteForMap]);

  // ------------------ COURSE & CARDIO (SESSION GPS VYTA LIVE) ------------------
  const initialRunState = (params?.get('run_state') as 'idle' | 'running' | 'paused' | 'finished') || 'idle';
  const initialRunDur = params?.get('run_dur') ? parseInt(params.get('run_dur')!, 10) : 0;
  const initialRunDist = params?.get('run_dist') ? parseFloat(params.get('run_dist')!) : 0;

  const [runState, setRunState] = useState<'idle' | 'running' | 'paused' | 'finished'>(initialRunState);
  const [runMode, setRunMode] = useState<'outdoor' | 'treadmill'>('outdoor');
  const [treadmillSpeedKmh, setTreadmillSpeedKmh] = useState<number>(0);
  const treadmillSpeedRef = useRef<number>(0);
  const treadmillStartStepsRef = useRef<number | null>(null);
  const treadmillLastStepsRef = useRef<number>(0);
  const [treadmillSteps, setTreadmillSteps] = useState<number>(0);
  const runModeRef = useRef<'outdoor' | 'treadmill'>('outdoor');
  useEffect(() => {
    treadmillSpeedRef.current = treadmillSpeedKmh;
  }, [treadmillSpeedKmh]);
  useEffect(() => {
    runModeRef.current = runMode;
  }, [runMode]);

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
  const liveBpmRef = useRef<number>(liveBpm);
  liveBpmRef.current = liveBpm;

  useEffect(() => {
    if (liveBpm > 0) {
      lastLiveBpmUpdateRef.current = Date.now();
    }
  }, [liveBpm]);

  // Suivre CHAQUE paquet BPM réel entrant (même si 2 battements consécutifs ont la même valeur)
  useEffect(() => {
    const unsub = qringBle.subscribe((data) => {
      if (
        (data.liveHeartRate !== undefined && data.liveHeartRate >= 40 && data.liveHeartRate <= 220) ||
        (qringBle.isRealTimeHeartRateActive() && data.heartRate !== undefined && data.heartRate >= 40 && data.heartRate <= 220)
      ) {
        lastLiveBpmUpdateRef.current = Date.now();
      }
    });
    return unsub;
  }, []);

  // Suivi des pas matériels de la bague en mode Course sur tapis
  const todayRingSteps = weekData?.[weekData.length - 1]?.steps || 0;
  useEffect(() => {
    if (runMode !== 'treadmill' || runState !== 'running') return;
    if (treadmillStartStepsRef.current === null) {
      treadmillStartStepsRef.current = todayRingSteps;
      treadmillLastStepsRef.current = todayRingSteps;
      return;
    }
    const totalDelta = Math.max(0, todayRingSteps - treadmillStartStepsRef.current);
    setTreadmillSteps(totalDelta);

    // Si la vitesse manuelle du tapis n'est pas fixée, avancer la distance à partir des pas réels de la bague
    if (treadmillSpeedRef.current <= 0 && todayRingSteps > treadmillLastStepsRef.current) {
      const incSteps = todayRingSteps - treadmillLastStepsRef.current;
      treadmillLastStepsRef.current = todayRingSteps;
      const strideKm = ((profile?.heightCm || 175) * 0.45) / 100000;
      const incKm = incSteps * strideKm;
      setRunDistanceKm((prev) => {
        const updated = Math.round((prev + incKm) * 1000) / 1000;
        runDistanceKmRef.current = updated;
        return updated;
      });
    } else {
      treadmillLastStepsRef.current = todayRingSteps;
    }
  }, [todayRingSteps, runMode, runState, profile?.heightCm]);

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

        let curSpeed = currentSmoothedSpeedRef.current;
        if (runModeRef.current === 'treadmill') {
          if (treadmillSpeedRef.current > 0) {
            curSpeed = treadmillSpeedRef.current;
            currentSmoothedSpeedRef.current = curSpeed;
            setInstantSpeedKmh(curSpeed);
            const incKm = curSpeed / 3600;
            setRunDistanceKm((prev) => {
              const updated = prev + incKm;
              runDistanceKmRef.current = updated;
              return updated;
            });
          } else {
            // Mode auto-bague sur tapis : lire les pas réels (0x07 léger) toutes les 15s sans couper le stream HR
            if (elapsed > 0 && elapsed % 15 === 0 && qringBle.isConnected() && !qringBle.isSyncingNow()) {
              qringBle.requestLiveStepsOnly().catch(() => {});
            }
            const distNow = runDistanceKmRef.current;
            curSpeed = elapsed >= 5 && distNow > 0.005 ? Math.min(25, distNow / (elapsed / 3600)) : 0;
            currentSmoothedSpeedRef.current = curSpeed;
            setInstantSpeedKmh(Math.round(curSpeed * 10) / 10);
          }
        } else {
          // Décroissance douce si perte prolongée du signal GPS (> 6s sans fix)
          const timeSinceGps = lastValidGpsTimestampRef.current > 0
            ? (Date.now() - lastValidGpsTimestampRef.current) / 1000
            : 0;
          if (timeSinceGps > 6.0 && curSpeed > 0) {
            curSpeed = Math.max(0, Math.round((curSpeed * 0.7) * 10) / 10);
            currentSmoothedSpeedRef.current = curSpeed;
            setInstantSpeedKmh(curSpeed);
          }
        }

        // BPM en direct avec contrôle de fraîcheur (< 20s pour éviter les lignes plates si perte de contact optique)
        const isBpmFresh = (Date.now() - lastLiveBpmUpdateRef.current) < 20000;
        const activeLiveBpm = liveBpmRef.current;
        const curHr = (activeLiveBpm > 0 && isBpmFresh) ? activeLiveBpm : 0;
        const currentDist = Math.round(runDistanceKmRef.current * 1000) / 1000;

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
        notifyNativeWorkout('update', {
          elapsedTime: elapsed,
          distanceKm: Math.round(currentDist * 100) / 100,
          paceText: curAvgSpeed,
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
  }, [runState, runMode]);

  // Traitement universel des coordonnées GPS (Foreground + Native Background iOS CoreLocation)
  const processGpsFix = (latitude: number, longitude: number, speed: number | null, accuracy: number, timestamp?: number) => {
    // 0. N'enregistrer QUE si la course est activement en cours d'enregistrement
    if (runState !== 'running') return;

    // 1. Filtrer les coordonnées aberrantes ou de trop faible précision (> 35m)
    if (accuracy > 35 || accuracy < 0) return;
    const coords: [number, number] = [latitude, longitude];
    const now = timestamp && timestamp > 0 ? timestamp : Date.now();

    // 1b. DÉDUPLICATION CHRONOLOGIQUE STRICTE : Rejeter tout point déjà traité ou antérieur
    if (timestamp && lastValidGpsTimestampRef.current > 0 && timestamp <= lastValidGpsTimestampRef.current) {
      return;
    }

    // 1c. ANTI-TÉLÉPORTATION : Rejeter les sauts de position anormaux (> 85m en moins de 5s)
    if (lastGpsFixRef.current) {
      const jumpMeters = calculateGpsDistanceMeters(lastGpsFixRef.current.lat, lastGpsFixRef.current.lng, latitude, longitude);
      const dtSec = Math.max(0.2, (now - lastGpsFixRef.current.time) / 1000);
      const impliedSpeedKmh = (jumpMeters / dtSec) * 3.6;
      if (jumpMeters > 85 && impliedSpeedKmh > 35) {
        console.warn('GPS teleportation jump ignored:', jumpMeters, 'm at', impliedSpeedKmh, 'km/h');
        return;
      }
    }

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

  // Surveillance GPS temps réel haute précision (Extérieur uniquement - désactivée sur tapis)
  useEffect(() => {
    if (runMode === 'treadmill' || !('geolocation' in navigator)) return;

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
      if (runState !== 'running') return;
      const { latitude, longitude, speed, accuracy, time } = e.detail || {};
      if (typeof latitude === 'number' && typeof longitude === 'number') {
        processGpsFix(latitude, longitude, speed, accuracy, time);
      }
    };

    const handleNativeBatch = (e: any) => {
      if (runState !== 'running') return;
      const points = e.detail;
      if (Array.isArray(points)) {
        const sorted = [...points].sort((a, b) => (a.time || 0) - (b.time || 0));
        sorted.forEach((pt: any) => {
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
  }, [runState, runMode]);

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
      setInstantSpeedKmh(runMode === 'treadmill' ? treadmillSpeedKmh : 0);
      currentSmoothedSpeedRef.current = runMode === 'treadmill' ? treadmillSpeedKmh : 0;
      recentGpsSamplesRef.current = [];
      treadmillStartStepsRef.current = todayRingSteps;
      treadmillLastStepsRef.current = todayRingSteps;
      setTreadmillSteps(0);
      const initPoints: [number, number][] = runMode === 'outdoor' && userPosition ? [userPosition] : [];
      setRealGpsPoints(initPoints);
      lastGpsFixRef.current = runMode === 'outdoor' && userPosition ? { lat: userPosition[0], lng: userPosition[1], time: Date.now() } : null;
      lastDistanceFixRef.current = runMode === 'outdoor' && userPosition ? { lat: userPosition[0], lng: userPosition[1], time: Date.now() } : null;
      lastValidGpsTimestampRef.current = Date.now();
      setTelemetryHistory([{ timeSec: 0, distanceKm: 0, speedKmh: runMode === 'treadmill' ? treadmillSpeedKmh : 0, hrBpm: 0 }]);
      accumulatedDurRef.current = 0;
      runStartTimeRef.current = Date.now();
    } else {
      runStartTimeRef.current = Date.now() - accumulatedDurRef.current * 1000;
    }
    setRunState('running');
    setIsLiveHrActive(true);
    qringBle.startRealTimeHeartRate().catch(() => {});
    notifyNativeWorkout('start', {
      workoutTitle: runMode === 'treadmill' ? 'Course sur tapis' : 'Course à pied',
      elapsedTime: 0,
      distanceKm: 0,
      paceText: '0,0',
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
      paceText: curAvgSpeed,
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
      paceText: curAvgSpeed,
      currentHeartRate: liveBpm > 0 ? liveBpm : 0,
      isPaused: false,
    });
    setIsLiveRunningViewOpen(true);
  };

  const stopRun = () => {
    setRunState('finished');
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
    const isTreadmill = runMode === 'treadmill';
    const cleanedGps = !isTreadmill ? sanitizeRouteGpsPoints(realGpsPoints) : [];
    const effectivePoints = !isTreadmill && cleanedGps && cleanedGps.length >= 2 ? cleanedGps : realGpsPoints;
    const hasGps = !isTreadmill && effectivePoints && effectivePoints.length >= 2 && finalDist >= 0.05;
    const pathInfo = hasGps ? convertGpsPointsToSvgPath(effectivePoints) : null;
    const now = new Date();

    const newRoute: StoredRoute = {
      id: `route-${Date.now()}`,
      title: isTreadmill
        ? `${isEn ? 'Treadmill Run' : 'Course sur tapis'} · ${now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
        : `Course Aurel · ${now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`,
      location: isTreadmill
        ? (isEn ? 'Indoor Treadmill' : 'Tapis de course')
        : (finalDist >= 0.05 ? 'Course extérieure' : 'Session statique'),
      distanceKm: finalDist,
      durationSec: finalDur,
      elevationM: 0,
      avgHr: finalHr,
      dateStr: `Aujourd'hui · ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      pointsSvgPath: pathInfo ? pathInfo.pathD : '',
      realGpsPoints: isTreadmill ? undefined : (hasGps ? effectivePoints : (effectivePoints.length === 1 ? [effectivePoints[0]] : (userPosition ? [userPosition] : undefined))),
      progress: 1,
      telemetryHistory: telemetryHistory.length > 0 ? [...telemetryHistory] : undefined,
      isIndoor: isTreadmill,
    };
    setStoredRoutes((prev) => [newRoute, ...prev]);
    setSubTab('trajets');
  };

  const getRouteTelemetry = (r: StoredRoute): TelemetryPoint[] => {
    if (r.telemetryHistory && r.telemetryHistory.length > 0) {
      return r.telemetryHistory;
    }
    return [];
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

  const saveRouteTitle = (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setStoredRoutes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, title: trimmed } : r))
    );
    if (managingRoute && managingRoute.id === id) {
      setManagingRoute((prev) => (prev ? { ...prev, title: trimmed } : null));
    }
  };

  const startRouteSimulation = (route: StoredRoute, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setViewingRouteForMap(route);
    setSimProgress(0);
    setIsSimulatingRoute(true);
  };

  // Moteur d'animation de la simulation du parcours sur Apple Maps
  useEffect(() => {
    if (!isSimulatingRoute || !viewingRouteForMap) {
      if (simAnimRef.current) {
        cancelAnimationFrame(simAnimRef.current);
        simAnimRef.current = null;
      }
      simLastTimeRef.current = null;
      return;
    }

    // Durée totale de la simulation à vitesse 1x : ~20 secondes
    const BASE_DURATION_MS = 20000;

    const step = (now: number) => {
      if (!simLastTimeRef.current) simLastTimeRef.current = now;
      const delta = now - simLastTimeRef.current;
      simLastTimeRef.current = now;

      setSimProgress((prev) => {
        const next = prev + (delta / (BASE_DURATION_MS / simSpeed));
        if (next >= 1) {
          setIsSimulatingRoute(false);
          return 1;
        }
        return next;
      });

      simAnimRef.current = requestAnimationFrame(step);
    };

    simAnimRef.current = requestAnimationFrame(step);

    return () => {
      if (simAnimRef.current) {
        cancelAnimationFrame(simAnimRef.current);
        simAnimRef.current = null;
      }
      simLastTimeRef.current = null;
    };
  }, [isSimulatingRoute, simSpeed, viewingRouteForMap]);

  const loadAndStartRoute = (route: StoredRoute) => {
    startRouteSimulation(route);
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
      isIndoor: !!route.isIndoor,
      routeProgress: 1,
      realGpsPoints: !route.isIndoor && route.distanceKm >= 0.05 && route.realGpsPoints && route.realGpsPoints.length >= 2 ? route.realGpsPoints : undefined,
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
  const [isWorkoutActive, setIsWorkoutActive] = useState<boolean>(false);
  const [sessionTitle, setSessionTitle] = useState<string>(isEn ? 'Custom Workout' : 'Séance libre');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [exercises, setExercises] = useState<GymExercise[]>(initialWorkoutExercises);
  const loadedGymDateRef = useRef<string | null>(null);
  const skipNextGymSaveRef = useRef<boolean>(false);

  // Sauvegarde et chargement jour par jour des séances de musculation
  useEffect(() => {
    if (!selectedDateKey) return;
    loadedGymDateRef.current = selectedDateKey;
    skipNextGymSaveRef.current = true;
    try {
      const saved = localStorage.getItem(`vyta_gym_day_${selectedDateKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSessionTitle(parsed.sessionTitle || (isEn ? 'Custom Workout' : 'Séance libre'));
        setExercises(Array.isArray(parsed.exercises) ? parsed.exercises : []);
      } else {
        setSessionTitle(isEn ? 'Custom Workout' : 'Séance libre');
        setExercises([]);
      }
    } catch {
      setExercises([]);
    }
  }, [selectedDateKey, isEn]);

  useEffect(() => {
    if (skipNextGymSaveRef.current) {
      skipNextGymSaveRef.current = false;
      return;
    }
    if (!selectedDateKey || loadedGymDateRef.current !== selectedDateKey) return;
    try {
      const key = `vyta_gym_day_${selectedDateKey}`;
      if (exercises.length === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify({ sessionTitle, exercises }));
      }
    } catch (_) {}
  }, [exercises, sessionTitle, selectedDateKey]);

  // Modals state
  const initialAddModal = params?.get('modal') === 'add_ex' || params?.get('add_ex') === '1';
  const [showAddModal, setShowAddModal] = useState<boolean>(initialAddModal);
  const [newExName, setNewExName] = useState<string>('');
  const [newExSetsCount, setNewExSetsCount] = useState<number>(3);
  const [newExWeight, setNewExWeight] = useState<number>(60);
  const [newExReps, setNewExReps] = useState<number>(10);
  const [newExRestSec, setNewExRestSec] = useState<number>(90);
  const [newExNotes, setNewExNotes] = useState<string>('');
  const [newExDraftSets, setNewExDraftSets] = useState<{ weightKg: number; reps: number; setType: GymSetType; rpe?: number }[]>([
    { weightKg: 60, reps: 10, setType: 'normal' },
    { weightKg: 60, reps: 10, setType: 'normal' },
    { weightKg: 60, reps: 10, setType: 'normal' },
  ]);

  const syncDraftSetsCount = (nextCount: number) => {
    const clamped = Math.max(1, Math.min(12, nextCount));
    setNewExSetsCount(clamped);
    setNewExDraftSets((prev) => {
      if (prev.length === clamped) return prev;
      if (prev.length > clamped) return prev.slice(0, clamped);
      const last = prev[prev.length - 1] || { weightKg: newExWeight, reps: newExReps, setType: 'normal' as GymSetType };
      const added = Array.from({ length: clamped - prev.length }, () => ({ ...last }));
      return [...prev, ...added];
    });
  };

  const applyDefaultToDraftSets = (patch: { weightKg?: number; reps?: number }) => {
    setNewExDraftSets((prev) =>
      prev.map((s) => ({
        ...s,
        ...(patch.weightKg !== undefined ? { weightKg: patch.weightKg } : {}),
        ...(patch.reps !== undefined ? { reps: patch.reps } : {}),
      }))
    );
  };

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
    let exerciseRestSec = targetRestSeconds;
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        if (ex.restSec && ex.restSec > 0) exerciseRestSec = ex.restSec;
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

    // Auto-trigger configurable rest timer (per-exercise if configured)
    if (markedDone) {
      setTargetRestSeconds(exerciseRestSec);
      setRestSeconds(exerciseRestSec);
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
          setType: lastSet?.setType || 'normal',
          rpe: lastSet?.rpe,
          done: false,
        };
        return { ...ex, sets: [...ex.sets, newSet] };
      })
    );
  };

  const updateSetMeta = (
    exId: string,
    setId: string,
    patch: { setType?: GymSetType; rpe?: number; weightKg?: number; reps?: number }
  ) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
        };
      })
    );
  };

  const duplicateSetInExercise = (exId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        const idx = ex.sets.findIndex((s) => s.id === setId);
        if (idx === -1) return ex;
        const src = ex.sets[idx];
        const copy: GymSet = {
          ...src,
          id: `${ex.id}-s${Date.now()}-dup`,
          done: false,
        };
        const nextSets = [...ex.sets];
        nextSets.splice(idx + 1, 0, copy);
        return { ...ex, sets: nextSets };
      })
    );
  };

  const updateExerciseMeta = (exId: string, patch: { restSec?: number; notes?: string }) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === exId ? { ...ex, ...patch } : ex))
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

  const handleAddExercise = (name: string) => {
    const cleanName = name.trim() || (isEn ? 'Untitled Exercise' : 'Exercice sans titre');
    const exId = `ex-${Date.now()}`;
    const sets: GymSet[] = (newExDraftSets.length > 0
      ? newExDraftSets
      : [{ weightKg: newExWeight, reps: newExReps, setType: 'normal' as GymSetType }]
    ).map((s, i) => ({
      id: `${exId}-s${i + 1}`,
      weightKg: s.weightKg,
      reps: s.reps,
      setType: s.setType,
      ...(s.rpe ? { rpe: s.rpe } : {}),
      done: false,
    }));

    setExercises((prev) => [
      ...prev,
      {
        id: exId,
        name: cleanName,
        sets,
        restSec: newExRestSec,
        ...(newExNotes.trim() ? { notes: newExNotes.trim() } : {}),
      },
    ]);
    setShowAddModal(false);
    setNewExName('');
    setNewExNotes('');
  };

  const handleCreateNewSession = (title: string) => {
    const cleanTitle = title.trim() || (isEn ? 'New Workout' : 'Nouvelle Séance');
    setSessionTitle(cleanTitle);
    setExercises([]);
    setRestSeconds(targetRestSeconds);
    setTimerRunning(false);
    setShowNewSessionModal(false);
    setNewSessionTitleInput('');
    setIsWorkoutActive(true);
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
      title: runMode === 'treadmill' ? (isEn ? 'Treadmill Run' : 'Course sur tapis') : 'Course GPS Aurel',
      dateStr: new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
      accentText: runMode === 'treadmill'
        ? (isEn ? 'Indoor Treadmill Session' : 'Séance Tapis Enregistrée')
        : 'Séance GPS Enregistrée',
      stats: [
        { label: 'Distance', value: finalDist > 0 ? `${finalDist.toFixed(2)}` : '0.00', unit: 'km' },
        { label: 'Vitesse Moyenne', value: finalAvgSpeed, unit: 'km/h' },
        { label: 'Temps', value: fmtClockSec(finalDur) },
        { label: 'FC Moyenne', value: finalHr > 0 ? `${finalHr}` : '--', unit: 'bpm' },
      ],
      isIndoor: runMode === 'treadmill',
      realGpsPoints: runMode === 'outdoor' && realGpsPoints && realGpsPoints.length >= 2 ? realGpsPoints : undefined,
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

      {/* 4-Section Segmented Control (Pas, Course, Trajets, Musculation) */}
      <div className="segmented-control" role="tablist">
        <button
          type="button"
          className={`segmented-btn ${subTab === 'steps' ? 'active' : ''}`}
          onClick={() => setSubTab('steps')}
        >
          {isEn ? 'Steps' : 'Pas'}
        </button>
        <button
          type="button"
          className={`segmented-btn ${subTab === 'run' ? 'active' : ''}`}
          onClick={() => setSubTab('run')}
        >
          {isEn ? 'Running' : 'Course'}
        </button>
        <button
          type="button"
          className={`segmented-btn ${subTab === 'trajets' ? 'active' : ''}`}
          onClick={() => setSubTab('trajets')}
        >
          {isEn ? 'Routes' : 'Trajets'}
        </button>
        <button
          type="button"
          className={`segmented-btn ${subTab === 'gym' ? 'active' : ''}`}
          onClick={() => setSubTab('gym')}
        >
          {isEn ? 'Strength' : 'Musculation'}
        </button>
      </div>

      {/* ==================== 0. ONGLET PAS DE LA JOURNÉE ==================== */}
      <div key={subTab} className="subtab-view">
      {subTab === 'steps' && <StepsTabView />}
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
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>
                    {isEn ? 'Active Running (Live)' : 'Course à pied active (Live)'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8E8E93', fontFamily: 'monospace' }}>
                    {fmtClockSec(runDurationSec)} • {runDistanceKm.toFixed(2)} km
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#FC5200', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {isEn ? 'VIEW ↗' : 'AFFICHER ↗'}
              </span>
            </div>
          )}
          {/* Bandeau de Contrôle Course (Extérieure GPS ou Tapis de course) */}
          <div className="run-control-card">
            {/* Sélecteur Course Normale (Extérieur GPS) vs Course sur Tapis */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px',
                padding: '4px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                marginBottom: '10px',
                opacity: runState === 'running' || runState === 'paused' ? 0.6 : 1,
                pointerEvents: runState === 'running' || runState === 'paused' ? 'none' : 'auto',
              }}
            >
              <button
                type="button"
                onClick={() => setRunMode('outdoor')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  padding: '9px 10px',
                  borderRadius: '10px',
                  background: runMode === 'outdoor' ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
                  border: runMode === 'outdoor' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
                  color: runMode === 'outdoor' ? '#FFFFFF' : 'rgba(250, 247, 242, 0.58)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.16s ease',
                }}
              >
                <Navigation size={14} color={runMode === 'outdoor' ? '#30D158' : 'currentColor'} />
                <span>{isEn ? 'Outdoor Run' : 'Course normale'}</span>
              </button>
              <button
                type="button"
                onClick={() => setRunMode('treadmill')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  padding: '9px 10px',
                  borderRadius: '10px',
                  background: runMode === 'treadmill' ? 'rgba(252, 82, 0, 0.2)' : 'transparent',
                  border: runMode === 'treadmill' ? '1px solid rgba(252, 82, 0, 0.55)' : '1px solid transparent',
                  color: runMode === 'treadmill' ? '#FFFFFF' : 'rgba(250, 247, 242, 0.58)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.16s ease',
                }}
              >
                <Activity size={14} color={runMode === 'treadmill' ? '#FC5200' : 'currentColor'} />
                <span>{isEn ? 'Treadmill' : 'Course sur tapis'}</span>
              </button>
            </div>

            {(runState === 'running' || runState === 'paused') && (
              <div className="run-control-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    className={`gps-beacon-tag ${
                      runState === 'running' ? '' : 'paused'
                    }`}
                  >
                    <span className="gps-pulse-dot" />
                    <span>
                      {runMode === 'treadmill'
                        ? runState === 'running'
                          ? (isEn ? 'Treadmill Active (Live)' : 'Tapis Actif (Live)')
                          : (isEn ? 'Treadmill Paused' : 'Tapis en pause')
                        : runState === 'running'
                          ? (isEn ? 'Aurel GPS Active (Live)' : 'GPS Aurel Actif (Live)')
                          : (isEn ? 'GPS Paused' : 'GPS en pause')}
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* Run Action Buttons */}
            {(runState === 'idle' || runState === 'finished') && (
              <button type="button" className="start-run-btn-main" onClick={startRun}>
                <Play size={16} fill="#000000" />
                <span>
                  {runMode === 'treadmill'
                    ? (isEn ? 'Start Treadmill Run' : 'Démarrer sur tapis')
                    : (isEn ? 'Start Outdoor Run' : 'Démarrer la course')}
                </span>
              </button>
            )}

            {runState === 'running' && (
              <div className="run-action-btns-row">
                <button type="button" className="pause-run-btn" onClick={pauseRun}>
                  <Pause size={15} />
                  <span>{isEn ? 'Pause' : 'Pause'}</span>
                </button>
                <button type="button" className="stop-run-btn" onClick={stopRun}>
                  <Square size={14} fill="currentColor" />
                  <span>{isEn ? 'Finish' : 'Terminer'}</span>
                </button>
              </div>
            )}

            {runState === 'paused' && (
              <div className="run-action-btns-row">
                <button type="button" className="resume-run-btn" onClick={resumeRun}>
                  <Play size={15} fill="currentColor" />
                  <span>{isEn ? 'Resume' : 'Reprendre'}</span>
                </button>
                <button type="button" className="stop-run-btn" onClick={stopRun}>
                  <Square size={14} fill="currentColor" />
                  <span>{isEn ? 'Finish' : 'Terminer'}</span>
                </button>
              </div>
            )}
          </div>

          {runMode === 'outdoor' ? (
            <AppleWorkoutMap
              onOpenStory={openRunStory}
              progress={liveProgress}
              runState={runState}
              distanceKm={runDistanceKm}
              realGpsPoints={realGpsPoints}
              userPosition={userPosition}
            />
          ) : (
            <div
              style={{
                borderRadius: '24px',
                padding: '20px 18px',
                background: 'radial-gradient(ellipse at 50% 0%, rgba(252, 82, 0, 0.16) 0%, rgba(16, 16, 20, 0.96) 65%), #0A0A0C',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 14px 32px rgba(0, 0, 0, 0.45)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#FC5200', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {isEn ? 'Indoor Studio · Ring Telemetry' : 'Mode Tapis · Sans GPS'}
                </span>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.65)', fontFamily: 'var(--font-mono)' }}>
                  {treadmillSpeedKmh > 0 ? `${treadmillSpeedKmh.toFixed(1).replace('.', ',')} km/h` : (isEn ? 'Auto Ring Steps' : 'Auto pas bague')}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', textAlign: 'center' }}>
                <div style={{ padding: '12px 8px', borderRadius: '14px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.55)', fontWeight: 600 }}>{isEn ? 'Duration' : 'Durée'}</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#FAF7F2', fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>
                    {fmtClockSec(runDurationSec)}
                  </div>
                </div>
                <div style={{ padding: '12px 8px', borderRadius: '14px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.55)', fontWeight: 600 }}>Distance</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#FAF7F2', fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>
                    {runDistanceKm.toFixed(2)} <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.5)' }}>km</span>
                  </div>
                </div>
                <div style={{ padding: '12px 8px', borderRadius: '14px', background: 'rgba(255, 69, 58, 0.08)', border: '1px solid rgba(255, 69, 58, 0.25)' }}>
                  <div style={{ fontSize: '10.5px', color: '#FFA29A', fontWeight: 600 }}>Cardio</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#FF5A52', fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>
                    {liveHr > 0 ? liveHr : '--'} <span style={{ fontSize: '11px' }}>bpm</span>
                  </div>
                </div>
              </div>

              {/* Réglage optionnel vitesse du tapis (0 = auto via les pas de la bague) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', color: 'rgba(250, 247, 242, 0.72)', fontWeight: 600 }}>
                    {isEn ? 'Belt Speed (optional)' : 'Vitesse tapis (optionnel)'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.45)' }}>
                    {treadmillSpeedKmh === 0 ? (isEn ? 'Measured via ring steps' : 'Calculée via pas bague') : `${treadmillSpeedKmh.toFixed(1).replace('.', ',')} km/h`}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[0, 6, 8, 10, 12].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setTreadmillSpeedKmh(spd)}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        borderRadius: '10px',
                        background: treadmillSpeedKmh === spd ? 'rgba(252, 82, 0, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                        border: treadmillSpeedKmh === spd ? '1px solid #FC5200' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#FAF7F2',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {spd === 0 ? 'Auto' : `${spd} km/h`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== 2. MODE MES TRAJETS ENREGISTRÉS ==================== */}
      {subTab === 'trajets' && (() => {
        const filteredRoutes = storedRoutes.filter((r) => {
          if (routeFilter === 'treadmill') return !!r.isIndoor;
          if (routeFilter === 'outdoor') return !r.isIndoor && (r.distanceKm >= 0.05 || (r.realGpsPoints && r.realGpsPoints.length >= 2));
          return true;
        });
        const totalKm = storedRoutes.reduce((acc, r) => acc + r.distanceKm, 0);
        const totalElev = storedRoutes.reduce((acc, r) => acc + r.elevationM, 0);

        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* En-tête Trajets + Filtres */}
          <div className="session-header-card" style={{ gap: '10px' }}>
            <div className="session-title-row">
              <div>
                <span className="session-title-text" style={{ fontSize: '17px' }}>
                  {isEn ? 'My Routes' : 'Mes Trajets'}
                </span>
                <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)', marginTop: '2px' }}>
                  {storedRoutes.length} {isEn ? 'sessions' : 'séances'} · {totalKm.toFixed(1)} km · +{totalElev} m
                </div>
              </div>

              <button
                type="button"
                className="add-exercise-btn-main"
                style={{ flex: '0 0 auto', padding: '7px 12px', fontSize: '12px', background: '#FFFFFF', color: '#000000' }}
                onClick={() => setShowNewRouteModal(true)}
              >
                <Plus size={13} />
                <span>{isEn ? 'New Route' : 'Nouveau trajet'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'all' as const, label: isEn ? `All (${storedRoutes.length})` : `Tous (${storedRoutes.length})` },
                { id: 'outdoor' as const, label: isEn ? 'Outdoor GPS' : 'Extérieur' },
                { id: 'treadmill' as const, label: isEn ? 'Treadmill' : 'Tapis' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setRouteFilter(f.id)}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: '10px',
                    background: routeFilter === f.id ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.04)',
                    border: routeFilter === f.id ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: routeFilter === f.id ? '#FFFFFF' : 'rgba(250, 247, 242, 0.6)',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Liste compacte et lisible des trajets */}
          {filteredRoutes.length === 0 ? (
            <div
              key={`empty-${routeFilter}`}
              className="apple-panel-enter"
              style={{
                padding: '28px 18px',
                borderRadius: '18px',
                background: 'rgba(18, 18, 22, 0.78)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                textAlign: 'center',
                color: 'rgba(250, 247, 242, 0.58)',
                fontSize: '13px',
              }}
            >
              {isEn ? 'No sessions in this filter yet.' : 'Aucune séance enregistrée dans ce filtre.'}
            </div>
          ) : (
          <div key={`list-${routeFilter}`} style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {filteredRoutes.map((route, idx) => {
              const visual = getRouteThumbnailSvg(route);
              const avgSpeedStr =
                route.distanceKm > 0 && route.durationSec > 0
                  ? `${(route.distanceKm / (route.durationSec / 3600)).toFixed(1).replace('.', ',')} km/h`
                  : null;
              const isRealTrack = !visual.isSinglePoint && !route.isIndoor;

              return (
              <div
                key={route.id}
                className="apple-list-item apple-press-card"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    try { navigator.vibrate(20); } catch (_) {}
                  }
                  setRouteModalTab(route.isIndoor || !isRealTrack ? 'charts' : 'map');
                  setViewingRouteForMap(route);
                }}
                style={{
                  ['--stagger-i' as string]: idx,
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderRadius: '18px',
                  background: 'rgba(18, 18, 22, 0.86)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer',
                }}
              >
                {/* Miniature compacte 56x56 */}
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: 'radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, 0.05) 0%, rgba(12, 12, 16, 0.98) 100%)',
                    border: route.isIndoor ? '1px solid rgba(252, 82, 0, 0.35)' : '1px solid rgba(255, 255, 255, 0.14)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <svg viewBox={visual.viewBox} style={{ width: '44px', height: '44px', overflow: 'visible' }}>
                    {route.isIndoor ? (
                      <>
                        <circle cx="50" cy="46" r="21" fill="none" stroke="rgba(252, 82, 0, 0.22)" strokeWidth="1.2" strokeDasharray="4 3" />
                        <path d="M 28 54 L 72 54" stroke="#FC5200" strokeWidth="3.2" strokeLinecap="round" />
                        <path d="M 34 44 L 44 36 L 52 44 L 62 34" fill="none" stroke="#FAF7F2" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        <text x="50" y="79" textAnchor="middle" fill="#FC5200" fontSize="8.5" fontWeight="800" fontFamily="var(--font-mono)">
                          TAPIS
                        </text>
                      </>
                    ) : visual.isSinglePoint ? (
                      <>
                        <circle cx="50" cy="50" r="20" fill="none" stroke="rgba(48, 209, 88, 0.18)" strokeWidth="1" strokeDasharray="3 3" />
                        <circle cx="50" cy="50" r="5" fill="#30D158" />
                        <text x="50" y="80" textAnchor="middle" fill="rgba(250, 247, 242, 0.55)" fontSize="8.5" fontWeight="700" fontFamily="var(--font-mono)">
                          FIXE
                        </text>
                      </>
                    ) : (
                      <>
                        <path
                          d={visual.pathD}
                          fill="none"
                          stroke="#FAF7F2"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx={visual.startPoint.x} cy={visual.startPoint.y} r="3.5" fill="#30D158" stroke="#0A0A0C" strokeWidth="1.5" />
                        <circle cx={visual.endPoint.x} cy={visual.endPoint.y} r="3.5" fill="#FFFFFF" stroke="#0A0A0C" strokeWidth="1.5" />
                      </>
                    )}
                  </svg>
                </div>

                {/* Infos principales sur 2 lignes propres */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {route.title}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {route.location} · {formatRouteDateStr(route)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
                      {route.distanceKm.toFixed(2)} km
                    </span>
                    <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.65)', fontFamily: 'var(--font-mono)' }}>
                      {fmtClockSec(route.durationSec)}
                    </span>
                    {avgSpeedStr && (
                      <span style={{ fontSize: '11px', color: '#38BDF8', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {avgSpeedStr}
                      </span>
                    )}
                    {route.avgHr > 40 && (
                      <span style={{ fontSize: '11px', color: '#FF5A52', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        ♥ {route.avgHr}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions compactes à droite */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  {isRealTrack && (
                    <button
                      type="button"
                      onClick={() => loadAndStartRoute(route)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        background: '#FFFFFF',
                        color: '#000000',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      title={isEn ? 'Start this route' : 'Lancer ce trajet'}
                    >
                      <Play size={13} fill="#000000" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRouteModalTab('charts');
                      setViewingRouteForMap(route);
                    }}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      background: 'rgba(56, 189, 248, 0.14)',
                      border: '1px solid rgba(56, 189, 248, 0.28)',
                      color: '#38BDF8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    title="Diagrammes"
                  >
                    <BarChart3 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => shareStoredRoute(route, e)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#FAF7F2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    title={isEn ? 'Share' : 'Partager'}
                  >
                    <Share2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManagingRoute(route);
                      setEditingRouteTitle(route.title);
                      setShowRouteDeleteConfirm(false);
                    }}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#FAF7F2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    title={isEn ? 'Manage' : 'Gérer'}
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
          )}
        </div>
        );
      })()}

      {/* Modal Nouveau Trajet Manuel (AnimatedSheet) */}
      <AnimatedSheet
        isOpen={showNewRouteModal}
        onClose={() => setShowNewRouteModal(false)}
        sheetStyle={{
          background: '#141418',
          borderTop: '1px solid rgba(255, 255, 255, 0.15)',
          gap: '14px',
        }}
      >
        <div data-sheet-drag-handle="true" style={{ display: 'flex', justifyContent: 'center', marginTop: '-4px' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '999px', background: 'rgba(255, 255, 255, 0.25)' }} />
        </div>
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
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {isEn ? 'Location / Starting point' : 'Lieu / Départ'}
              </label>
              <input
                type="text"
                value={newRouteLoc}
                onChange={(e) => setNewRouteLoc(e.target.value)}
                placeholder={isEn ? 'e.g.: Central Park Loop' : 'ex: Paris 10e · Quai de Valmy'}
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
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {isEn ? 'Estimated Distance (km)' : 'Distance estimée (km)'}
              </label>
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
                {isEn ? 'Cancel' : 'Annuler'}
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
                {isEn ? 'Create & Save' : 'Créer et Enregistrer'}
              </button>
            </div>
      </AnimatedSheet>

      {/* ==================== 3. MODE MUSCULATION (GYM LOGGER) ==================== */}
      {subTab === 'gym' && (
        !isWorkoutActive ? (
          /* ==================== VUE 1 : SÉANCE PERSONNALISÉE (SANS DOUBLON) ==================== */
          <div key="gym-home" className="apple-panel-enter" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {exercises.length > 0 ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 18px',
                    borderRadius: '22px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>
                      {isEn ? 'Strength Training' : 'Musculation'}
                    </h2>
                    <span style={{ fontSize: '12px', color: 'rgba(250, 247, 242, 0.65)', marginTop: '2px', display: 'block' }}>
                      {isEn ? 'Resume or start a new session' : 'Reprenez ou démarrez une nouvelle séance'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="add-exercise-btn-main"
                    style={{ padding: '8px 12px', fontSize: '11.5px' }}
                    onClick={() => setShowNewSessionModal(true)}
                  >
                    <Plus size={13} />
                    <span>{isEn ? 'New Workout' : 'Nouvelle séance'}</span>
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '18px',
                    background: 'linear-gradient(135deg, rgba(184, 35, 72, 0.22), rgba(255, 255, 255, 0.05))',
                    border: '1.5px solid var(--gold)',
                    boxShadow: '0 4px 20px rgba(184, 35, 72, 0.25)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 10px var(--gold)' }} />
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#FFFFFF' }}>
                        {sessionTitle}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.65)' }}>
                        {exercises.length} {isEn ? 'exercises' : 'exercices'} • {doneSetsCount} {isEn ? 'sets completed' : 'séries faites'} • {totalTonnageKg} kg
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="add-exercise-btn-main"
                    style={{ padding: '7px 14px', fontSize: '11.5px' }}
                    onClick={() => setIsWorkoutActive(true)}
                  >
                    <span>{isEn ? 'Open' : 'Ouvrir'}</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </>
            ) : (
              <div
                style={{
                  padding: '28px 20px',
                  borderRadius: '22px',
                  background: 'rgba(18, 18, 22, 0.88)',
                  border: '1px solid rgba(255, 255, 255, 0.09)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <Dumbbell size={28} color="rgba(250, 247, 242, 0.5)" />
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#FAF7F2', margin: 0 }}>
                  {isEn ? 'No workout started today' : 'Aucune séance démarrée aujourd’hui'}
                </h2>
                <span style={{ fontSize: '12px', color: 'rgba(250, 247, 242, 0.58)', maxWidth: '250px' }}>
                  {isEn ? 'Create your session and configure each exercise & each set' : 'Créez votre séance libre et paramétrez chaque exercice et chaque série'}
                </span>
                <button
                  type="button"
                  className="add-exercise-btn-main"
                  style={{ padding: '11px 18px', fontSize: '13px', marginTop: '6px' }}
                  onClick={() => setShowNewSessionModal(true)}
                >
                  <Plus size={14} />
                  <span>{isEn ? 'Create Workout' : 'Nouvelle séance'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ==================== VUE 2 : EXERCICES & SÉANCES ACTIVES ==================== */
          <div key="gym-active" className="apple-panel-enter" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Header de la Séance Personnalisée */}
            <div className="session-header-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <button
                  type="button"
                  onClick={() => setIsWorkoutActive(false)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(250, 247, 242, 0.75)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '4px 0',
                  }}
                >
                  <ArrowLeft size={13} />
                  <span>{isEn ? 'Workouts' : 'Séances'}</span>
                </button>
                <span
                  className="health-badge"
                  style={{
                    background: 'rgba(184, 35, 72, 0.12)',
                    color: 'var(--gold)',
                    border: '1px solid var(--gold-border)',
                    flexShrink: 0,
                    fontSize: '10px',
                    padding: '2px 8px',
                  }}
                >
                  {isEn ? 'In progress' : 'En cours'}
                </span>
              </div>

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
              </div>

              <div className="session-actions-row">
                <button
                  type="button"
                  className="add-exercise-btn-main"
                  style={{ flex: 1 }}
                  onClick={() => setShowAddModal(true)}
                >
                  <Plus size={14} />
                  <span>{isEn ? 'Add exercise' : 'Ajouter un exercice'}</span>
                </button>
              </div>
            </div>

            {/* Tonnage Total Counter Header */}
            <div className="activity-raw-card" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="activity-raw-item">
                <span className="activity-raw-label">
                  <Dumbbell size={12} />
                  <span>{isEn ? 'Volume Lifted' : 'Tonnage Soulevé'}</span>
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
                  <span>{isEn ? 'Completed Sets' : 'Séries Validées'}</span>
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
                        {isEn ? 'Rest Timer' : 'Chronomètre de repos'}
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
                    title={isEn ? 'Subtract 15 seconds' : 'Retirer 15 secondes'}
                  >
                    -15s
                  </button>
                  <button
                    type="button"
                    className="rest-adjust-btn"
                    onClick={() => adjustRestBy(15)}
                    title={isEn ? 'Add 15 seconds' : 'Ajouter 15 secondes'}
                  >
                    +15s
                  </button>

                  <button
                    type="button"
                    className="gear-btn"
                    style={{ width: '32px', height: '32px' }}
                    onClick={() => setTimerRunning(!timerRunning)}
                    title={isEn ? (timerRunning ? 'Pause' : 'Start') : (timerRunning ? 'Pause' : 'Démarrer')}
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
            {exercises.length === 0 && (
              <div
                style={{
                  padding: '24px 16px',
                  borderRadius: '18px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px dashed rgba(255, 255, 255, 0.14)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '13px', color: 'rgba(250, 247, 242, 0.7)' }}>
                  {isEn ? 'No exercises added yet' : 'Aucun exercice dans cette séance'}
                </span>
                <button
                  type="button"
                  className="add-exercise-btn-main"
                  onClick={() => setShowAddModal(true)}
                >
                  <Plus size={14} />
                  <span>{isEn ? 'Add exercise' : 'Ajouter un exercice'}</span>
                </button>
              </div>
            )}
            {exercises.map((ex) => (
              <div key={ex.id} className="gym-exercise-card">
                <div className="gym-exercise-header">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>
                        {ex.name}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {ex.sets.length} {ex.sets.length > 1 ? (isEn ? 'sets' : 'séries') : (isEn ? 'set' : 'série')}
                      </span>
                      {ex.restSec && (
                        <span style={{ fontSize: '10px', color: '#38BDF8', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          ⏱ {ex.restSec}s
                        </span>
                      )}
                    </div>
                    {ex.notes && (
                      <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.52)', marginTop: '2px' }}>
                        {ex.notes}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="exercise-manage-pill-btn"
                    onClick={() => setManagingExId(ex.id)}
                    title={isEn ? 'Exercise settings (weight, sets, rest, RPE)' : "Paramètres complets de l'exercice et de chaque série"}
                  >
                    <Sliders size={12} color="var(--gold)" />
                    <span>{isEn ? 'Manage' : 'Gérer'}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {ex.sets.map((s, setIdx) => {
                    const typeTag =
                      s.setType === 'warmup' ? 'E' : s.setType === 'heavy' ? 'L' : s.setType === 'drop' ? 'D' : '';
                    const typeColor =
                      s.setType === 'warmup' ? '#38BDF8' : s.setType === 'heavy' ? '#FF9F0A' : s.setType === 'drop' ? '#FF453A' : 'var(--text-tertiary)';
                    return (
                    <div key={s.id} className="gym-set-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: '34px' }}>
                        <span style={{ color: typeColor, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '12px' }}>
                          {typeTag ? `${typeTag}${setIdx + 1}` : `S${setIdx + 1}`}
                        </span>
                        {s.rpe && (
                          <span style={{ fontSize: '9px', color: '#C4B5FD', fontWeight: 700 }}>
                            @{s.rpe}
                          </span>
                        )}
                      </div>

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
                          title="-1 rep"
                        >
                          -
                        </button>
                        <span className="mini-step-val">{s.reps} {isEn ? 'reps' : 'réps'}</span>
                        <button
                          type="button"
                          className="mini-step-btn"
                          onClick={() => adjustReps(ex.id, s.id, 1)}
                          title="+1 rep"
                        >
                          +
                        </button>
                      </div>

                      {/* Checkmark button */}
                      <button
                        type="button"
                        className={`set-check-btn ${s.done ? 'done' : ''}`}
                        onClick={() => toggleSetDone(ex.id, s.id)}
                        title={s.done ? (isEn ? 'Set completed' : 'Série validée') : (isEn ? 'Complete set' : 'Valider la série')}
                      >
                        {s.done ? <Check size={14} /> : <Plus size={13} />}
                      </button>
                    </div>
                    );
                  })}
                </div>

                {/* + Ajouter une série */}
                <button
                  type="button"
                  className="add-set-link-btn"
                  onClick={() => addSetToExercise(ex.id)}
                >
                  <Plus size={13} />
                  <span>{isEn ? 'Add set' : 'Ajouter une série'}</span>
                </button>
              </div>
            ))}

            {/* Bottom Actions Row (Share uniquement si séries validées, sans bouton Changer doublon) */}
            {doneSetsCount > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="apple-pay-btn"
                  style={{
                    flex: 1,
                    background: '#FFFFFF',
                    color: '#000000',
                    fontWeight: 700,
                    boxShadow: '0 8px 24px rgba(255, 255, 255, 0.16)',
                    borderRadius: '14px',
                  }}
                  onClick={openGymStory}
                >
                  <Share2 size={15} />
                  <span>{isEn ? 'Finish & Share' : 'Terminer & Partager'}</span>
                </button>
              </div>
            )}
          </div>
        )
      )}
      </div>

      {/* ==================== MODAL AJOUTER UN EXERCICE (AnimatedSheet) ==================== */}
      <AnimatedSheet
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        sheetClassName="modal-sheet-styled"
        sheetStyle={{
          background: '#141418',
          gap: '14px',
        }}
      >
        <div data-sheet-drag-handle="true" style={{ display: 'flex', justifyContent: 'center', marginTop: '-4px' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '999px', background: 'rgba(255, 255, 255, 0.25)' }} />
        </div>
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
                  {isEn ? 'Active Workout' : 'Séance en cours'}
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  {isEn ? 'Add Exercise' : 'Ajouter un Exercice'}
                </h2>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAddModal(false)}
                aria-label={isEn ? 'Close' : 'Fermer'}
              >
                <X size={16} />
              </button>
            </div>

            {/* Titre de l'exercice */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {isEn ? 'Exercise Title' : "Titre de l'exercice"}
              </label>
              <input
                type="text"
                className="settings-input"
                placeholder={isEn ? 'Exercise name...' : 'Nom de l’exercice...'}
                value={newExName}
                onChange={(e) => setNewExName(e.target.value)}
              />
            </div>

            {/* Base rapide + repos spécifique */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '9px',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                  {isEn ? 'Sets' : 'Séries'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    className="mini-step-btn"
                    style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '6px' }}
                    onClick={() => syncDraftSetsCount(newExSetsCount - 1)}
                  >
                    <Minus size={12} />
                  </button>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff', minWidth: '22px' }}>
                    {newExSetsCount}
                  </span>
                  <button
                    type="button"
                    className="mini-step-btn"
                    style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '6px' }}
                    onClick={() => syncDraftSetsCount(newExSetsCount + 1)}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '9px',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                  {isEn ? 'Base kg' : 'Base (kg)'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                  <button
                    type="button"
                    className="mini-step-btn"
                    style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '6px' }}
                    onClick={() => {
                      const nextW = Math.max(0, Math.round((newExWeight - 2.5) * 10) / 10);
                      setNewExWeight(nextW);
                      applyDefaultToDraftSets({ weightKg: nextW });
                    }}
                  >
                    <Minus size={12} />
                  </button>
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff', minWidth: '32px' }}>
                    {newExWeight}
                  </span>
                  <button
                    type="button"
                    className="mini-step-btn"
                    style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '6px' }}
                    onClick={() => {
                      const nextW = Math.round((newExWeight + 2.5) * 10) / 10;
                      setNewExWeight(nextW);
                      applyDefaultToDraftSets({ weightKg: nextW });
                    }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '9px',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                  {isEn ? 'Base reps' : 'Base réps'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    className="mini-step-btn"
                    style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '6px' }}
                    onClick={() => {
                      const nextR = Math.max(1, newExReps - 1);
                      setNewExReps(nextR);
                      applyDefaultToDraftSets({ reps: nextR });
                    }}
                  >
                    <Minus size={12} />
                  </button>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff', minWidth: '22px' }}>
                    {newExReps}
                  </span>
                  <button
                    type="button"
                    className="mini-step-btn"
                    style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '6px' }}
                    onClick={() => {
                      const nextR = Math.min(50, newExReps + 1);
                      setNewExReps(nextR);
                      applyDefaultToDraftSets({ reps: nextR });
                    }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>

            {/* Repos dédié à cet exercice */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {isEn ? 'Rest timer for this exercise' : 'Temps de repos de l’exercice'}
                </span>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>
                  {newExRestSec}s
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[45, 60, 90, 120, 180].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setNewExRestSec(sec)}
                    style={{
                      flex: 1,
                      padding: '6px 4px',
                      borderRadius: '9px',
                      background: newExRestSec === sec ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                      border: newExRestSec === sec ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#FAF7F2',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {sec >= 60 ? `${sec / 60}m${sec % 60 ? sec % 60 : ''}` : `${sec}s`}
                  </button>
                ))}
              </div>
            </div>

            {/* Détail série par série (Poids, Réps, Type) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {isEn ? 'Customize each set' : 'Paramétrer chaque série'}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '190px', overflowY: 'auto', overscrollBehaviorY: 'contain' }}>
                {newExDraftSets.map((s, idx) => {
                  const typeOrder: GymSetType[] = ['normal', 'warmup', 'heavy', 'drop'];
                  const nextType = typeOrder[(typeOrder.indexOf(s.setType) + 1) % typeOrder.length];
                  const badgeLabel =
                    s.setType === 'warmup'
                      ? (isEn ? 'W' : 'Échauff.')
                      : s.setType === 'heavy'
                      ? (isEn ? 'H' : 'Lourde')
                      : s.setType === 'drop'
                      ? 'Drop'
                      : (isEn ? 'N' : 'Norm.');
                  const badgeColor =
                    s.setType === 'warmup' ? '#38BDF8' : s.setType === 'heavy' ? '#FF9F0A' : s.setType === 'drop' ? '#FF453A' : 'rgba(250, 247, 242, 0.72)';

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 9px',
                        borderRadius: '11px',
                        background: 'rgba(255, 255, 255, 0.035)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', minWidth: '22px' }}>
                        S{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setNewExDraftSets((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, setType: nextType } : row))
                          )
                        }
                        style={{
                          padding: '4px 7px',
                          borderRadius: '7px',
                          background: 'rgba(255, 255, 255, 0.07)',
                          border: `1px solid ${badgeColor}55`,
                          color: badgeColor,
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          minWidth: '50px',
                        }}
                      >
                        {badgeLabel}
                      </button>
                      <div className="set-mini-control" style={{ flex: 1 }}>
                        <button
                          type="button"
                          className="mini-step-btn"
                          onClick={() =>
                            setNewExDraftSets((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, weightKg: Math.max(0, Math.round((row.weightKg - 2.5) * 10) / 10) } : row
                              )
                            )
                          }
                        >
                          -
                        </button>
                        <span className="mini-step-val" style={{ fontSize: '11.5px' }}>{s.weightKg}kg</span>
                        <button
                          type="button"
                          className="mini-step-btn"
                          onClick={() =>
                            setNewExDraftSets((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, weightKg: Math.round((row.weightKg + 2.5) * 10) / 10 } : row
                              )
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                      <div className="set-mini-control" style={{ flex: 0.9 }}>
                        <button
                          type="button"
                          className="mini-step-btn"
                          onClick={() =>
                            setNewExDraftSets((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, reps: Math.max(1, row.reps - 1) } : row))
                            )
                          }
                        >
                          -
                        </button>
                        <span className="mini-step-val" style={{ fontSize: '11.5px' }}>{s.reps}r</span>
                        <button
                          type="button"
                          className="mini-step-btn"
                          onClick={() =>
                            setNewExDraftSets((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, reps: Math.min(50, row.reps + 1) } : row))
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Consigne optionnelle */}
            <input
              type="text"
              className="settings-input"
              placeholder={isEn ? 'Optional note (tempo, grip, incline...)' : 'Note optionnelle (tempo, prise, inclinaison...)'}
              value={newExNotes}
              onChange={(e) => setNewExNotes(e.target.value)}
            />

            <button
              type="button"
              className="add-exercise-btn-main"
              style={{ padding: '12px', marginTop: '2px' }}
              onClick={() => handleAddExercise(newExName)}
            >
              <Plus size={15} />
              <span>{isEn ? 'Confirm & Add to Workout' : 'Valider et Ajouter à la Séance'}</span>
            </button>
      </AnimatedSheet>

      {/* ==================== MODAL NOUVELLE SÉANCE (AnimatedSheet) ==================== */}
      <AnimatedSheet
        isOpen={showNewSessionModal}
        onClose={() => setShowNewSessionModal(false)}
        sheetClassName="modal-sheet-styled"
        sheetStyle={{
          background: '#141418',
          gap: '14px',
        }}
      >
        <div data-sheet-drag-handle="true" style={{ display: 'flex', justifyContent: 'center', marginTop: '-4px' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '999px', background: 'rgba(255, 255, 255, 0.25)' }} />
        </div>
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
                  {isEn ? 'Workout Planning' : 'Planification Fit'}
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  {isEn ? 'New Workout' : 'Nouvelle Séance'}
                </h2>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowNewSessionModal(false)}
                aria-label={isEn ? 'Close' : 'Fermer'}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {isEn ? 'Workout title' : 'Titre de la nouvelle séance'}
              </label>
              <input
                type="text"
                className="settings-input"
                placeholder={isEn ? 'Workout title...' : 'Titre de la séance...'}
                value={newSessionTitleInput}
                onChange={(e) => setNewSessionTitleInput(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="add-exercise-btn-main"
              style={{ padding: '12px', marginTop: '8px' }}
              onClick={() => handleCreateNewSession(newSessionTitleInput || (isEn ? 'New Workout' : 'Nouvelle Séance'))}
            >
              <Check size={15} />
              <span>{isEn ? 'Start this workout' : 'Démarrer cette séance'}</span>
            </button>
      </AnimatedSheet>

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
              onUpdateSetMeta={(setId, patch) => updateSetMeta(curEx.id, setId, patch)}
              onDuplicateSet={(setId) => duplicateSetInExercise(curEx.id, setId)}
              onUpdateExerciseMeta={(patch) => updateExerciseMeta(curEx.id, patch)}
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

      {/* Modal Dédiée : Visualisation du trajet sur Apple Maps & Simulation */}
      <AnimatedSheet
        isOpen={Boolean(viewingRouteForMap)}
        onClose={() => {
          setIsSimulatingRoute(false);
          setSimProgress(0);
          setViewingRouteForMap(null);
        }}
        backdropStyle={{
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          touchAction: 'none',
          overscrollBehavior: 'none',
        }}
        sheetStyle={{
          height: 'calc(100dvh - env(safe-area-inset-top, 24px) - 20px)',
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 24px) - 20px)',
          background: '#0D0E12',
          padding: '14px 16px calc(14px + env(safe-area-inset-bottom, 10px)) 16px',
          gap: '10px',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.95)',
          overflow: routeModalTab === 'charts' ? 'auto' : 'hidden',
          touchAction: routeModalTab === 'charts' ? 'pan-y' : 'none',
          overscrollBehavior: 'none',
        }}
      >
        {activeViewingRoute && ((viewingRouteForMap) => (
          <>
            {/* Grabber Handle */}
            <div data-sheet-drag-handle="true" style={{ display: 'flex', justifyContent: 'center', marginTop: '-2px', marginBottom: '2px', flexShrink: 0, padding: '4px 0', cursor: 'grab' }}>
              <div style={{ width: '40px', height: '4px', borderRadius: '999px', background: 'rgba(255, 255, 255, 0.28)' }} />
            </div>

            {/* Header: Title, Location & Close */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexShrink: 0 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={13} color="#30D158" />
                  <span style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#30D158' }}>
                    Trajet Apple Maps
                  </span>
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#FAF7F2', margin: '3px 0 2px 0', letterSpacing: '-0.3px' }}>
                  {viewingRouteForMap.title}
                </h3>
                <span style={{ fontSize: '11.5px', color: 'rgba(250, 247, 242, 0.65)' }}>
                  {viewingRouteForMap.location || (viewingRouteForMap.distanceKm < 0.05 ? 'Session statique' : 'Course extérieure')} · {formatRouteDateStr(viewingRouteForMap)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsSimulatingRoute(false);
                  setSimProgress(0);
                  setViewingRouteForMap(null);
                }}
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

            {/* Segmented Switcher: Carte & Replay vs Diagrammes Télémétrie (masqué pour séance tapis) */}
            {viewingRouteForMap.isIndoor ? (
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  background: 'rgba(252, 82, 0, 0.12)',
                  border: '1px solid rgba(252, 82, 0, 0.3)',
                  color: '#FDBA74',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                <Activity size={13} color="#FC5200" />
                <span>{isEn ? 'Indoor Treadmill Session · No GPS Route' : 'Course sur tapis · Intérieur sans GPS'}</span>
              </div>
            ) : (
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '3px',
                gap: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => setRouteModalTab('map')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '9px',
                  background: routeModalTab === 'map' ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
                  border: routeModalTab === 'map' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
                  color: routeModalTab === 'map' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <MapPin size={13} color={routeModalTab === 'map' ? '#30D158' : 'currentColor'} />
                <span>{isEn ? 'Map & Replay' : 'Carte & Replay'}</span>
              </button>
              <button
                type="button"
                onClick={() => setRouteModalTab('charts')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '9px',
                  background: routeModalTab === 'charts' ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
                  border: routeModalTab === 'charts' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
                  color: routeModalTab === 'charts' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Activity size={13} color={routeModalTab === 'charts' ? '#38BDF8' : 'currentColor'} />
                <span>{isEn ? 'Telemetry Charts' : 'Diagrammes de course'}</span>
              </button>
            </div>
            )}

            {routeModalTab === 'charts' ? (
              <div
                key="route-charts-pane"
                className="apple-panel-enter"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '4px 0 14px 0',
                }}
              >
                {/* Complete Interactive Telemetry Charts (Distance, Vitesse, BPM) */}
                <div
                  style={{
                    background: 'rgba(20, 22, 28, 0.9)',
                    borderRadius: '20px',
                    padding: '12px 6px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  <RunTelemetryCharts
                    runState="finished"
                    runDurationSec={viewingRouteForMap.durationSec}
                    runDistanceKm={viewingRouteForMap.distanceKm}
                    liveSpeedKmh={
                      viewingRouteForMap.distanceKm > 0 && viewingRouteForMap.durationSec > 0
                        ? viewingRouteForMap.distanceKm / (viewingRouteForMap.durationSec / 3600)
                        : 0
                    }
                    liveHr={viewingRouteForMap.avgHr || 0}
                    telemetryHistory={getRouteTelemetry(viewingRouteForMap)}
                  />
                </div>

                {/* Synthèse télémétrique détaillée */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.5)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Allure Moyenne
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#38BDF8', marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                      {viewingRouteForMap.distanceKm > 0 && viewingRouteForMap.durationSec > 0
                        ? `${Math.floor(viewingRouteForMap.durationSec / 60 / viewingRouteForMap.distanceKm)}'${Math.round(
                            ((viewingRouteForMap.durationSec / 60 / viewingRouteForMap.distanceKm) % 1) * 60
                          )
                            .toString()
                            .padStart(2, '0')}" /km`
                        : '--'}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.5)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Cardio Moyen
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#FF453A', marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                      {viewingRouteForMap.avgHr > 0 ? `${viewingRouteForMap.avgHr} bpm` : '--'}
                    </div>
                  </div>
                </div>

                {/* Strip des 4 métriques */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    padding: '10px 6px',
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.5)', fontWeight: 600 }}>Distance</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#FAF7F2', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                      {viewingRouteForMap.distanceKm.toFixed(2)} km
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.5)', fontWeight: 600 }}>Temps</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#FAF7F2', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                      {fmtClockSec(viewingRouteForMap.durationSec)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.5)', fontWeight: 600 }}>Vitesse Moy.</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#FAF7F2', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                      {viewingRouteForMap.distanceKm > 0 && viewingRouteForMap.durationSec > 0
                        ? `${(viewingRouteForMap.distanceKm / (viewingRouteForMap.durationSec / 3600)).toFixed(1).replace('.', ',')} `
                        : '-- '}
                      <span style={{ fontSize: '10px', fontWeight: 400 }}>km/h</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.5)', fontWeight: 600 }}>Dénivelé</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#30D158', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                      +{viewingRouteForMap.elevationM || 0}m
                    </div>
                  </div>
                </div>

                {/* Bouton retour vers la carte */}
                <button
                  type="button"
                  onClick={() => setRouteModalTab('map')}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#FAF7F2',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <MapPin size={15} color="#30D158" />
                  <span>{isEn ? 'View Route Map & Replay' : 'Voir le tracé sur la carte'}</span>
                </button>
              </div>
            ) : (
              <>
                {/* Interactive Apple Workout Map - Fills all available vertical space */}
                <div
                  style={{
                    flex: 1,
                    minHeight: '200px',
                    width: '100%',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    position: 'relative',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  <AppleWorkoutMap
                    height="100%"
                    style={{ height: '100%', borderRadius: '20px', border: 'none' }}
                    runState="finished"
                    realGpsPoints={getRouteEffectivePoints(viewingRouteForMap)}
                    distanceKm={viewingRouteForMap.distanceKm}
                    progress={simProgress}
                    isSimulating={isSimulatingRoute}
                  />

                  {/* Simulation Status Badge Overlay (Top-Left of map) */}
                  {isSimulatingRoute && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        background: 'rgba(0, 0, 0, 0.72)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(48, 209, 88, 0.35)',
                        borderRadius: '20px',
                        padding: '5px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        zIndex: 500,
                      }}
                    >
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#30D158',
                          boxShadow: '0 0 8px #30D158',
                        }}
                      />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#30D158', letterSpacing: '0.04em' }}>
                        {isEn ? 'REPLAY' : 'REPLAY'}
                      </span>
                      <span style={{ fontSize: '10.5px', color: 'rgba(255, 255, 255, 0.7)', fontFamily: 'var(--font-mono)' }}>
                        {simSpeed}x
                      </span>
                    </div>
                  )}
                </div>

                {/* Simulation Timeline & Speed Controls */}
                <div
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    padding: '8px 12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(250, 247, 242, 0.85)' }}>
                      <span style={{ fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                        {fmtClockSec(Math.round(viewingRouteForMap.durationSec * (simProgress || 0)))}
                      </span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>/</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'rgba(250, 247, 242, 0.6)' }}>
                        {fmtClockSec(viewingRouteForMap.durationSec)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#30D158', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {Math.round(simProgress * 100)}%
                      </span>
                      {/* Speed toggle pills: 1x, 2x, 4x */}
                      <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '2px', gap: '2px' }}>
                        {[1, 2, 4].map((spd) => (
                          <button
                            key={spd}
                            type="button"
                            onClick={() => setSimSpeed(spd)}
                            style={{
                              background: simSpeed === spd ? '#FFFFFF' : 'transparent',
                              color: simSpeed === spd ? '#000000' : 'rgba(255, 255, 255, 0.65)',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '2px 7px',
                              fontSize: '10px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Slider Track */}
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.005"
                    value={simProgress}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setSimProgress(val);
                    }}
                    style={{
                      width: '100%',
                      accentColor: '#30D158',
                      cursor: 'pointer',
                      height: '4px',
                    }}
                  />
                </div>

                {/* Telemetry Strip: 4 Key Metrics */}
                <div
                  style={{
                    flexShrink: 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    padding: '10px 6px',
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.5)', fontWeight: 600 }}>Distance</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#FAF7F2', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                      {((isSimulatingRoute || (simProgress > 0 && simProgress < 1)) ? (viewingRouteForMap.distanceKm * simProgress) : viewingRouteForMap.distanceKm).toFixed(2)}{' '}
                      <span style={{ fontSize: '10px', fontWeight: 400 }}>km</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.5)', fontWeight: 600 }}>Temps</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#FAF7F2', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                      {fmtClockSec((isSimulatingRoute || (simProgress > 0 && simProgress < 1)) ? Math.round(viewingRouteForMap.durationSec * simProgress) : viewingRouteForMap.durationSec)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.5)', fontWeight: 600 }}>Vitesse Moy.</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#FAF7F2', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                      {viewingRouteForMap.distanceKm > 0 && viewingRouteForMap.durationSec > 0
                        ? `${(viewingRouteForMap.distanceKm / (viewingRouteForMap.durationSec / 3600)).toFixed(1).replace('.', ',')} `
                        : '-- '}
                      <span style={{ fontSize: '10px', fontWeight: 400 }}>km/h</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: 'rgba(250, 247, 242, 0.5)', fontWeight: 600 }}>Dénivelé</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#30D158', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                      +{Math.round(((isSimulatingRoute || (simProgress > 0 && simProgress < 1)) ? (viewingRouteForMap.elevationM || 0) * simProgress : (viewingRouteForMap.elevationM || 0)))}m
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ flexShrink: 0, display: 'flex', gap: '10px', marginTop: '2px' }}>
                  <button
                    type="button"
                    onClick={() => openInNativeAppleMaps(viewingRouteForMap)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px 14px',
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
                    <span>{isEn ? 'Open in Maps' : 'Ouvrir dans Plans'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isSimulatingRoute) {
                        setIsSimulatingRoute(false);
                      } else {
                        if (simProgress >= 1) {
                          setSimProgress(0);
                        }
                        setIsSimulatingRoute(true);
                      }
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px 14px',
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
                    {isSimulatingRoute ? (
                      <>
                        <Pause size={14} fill="#000000" />
                        <span>{isEn ? 'Pause' : 'Pause'}</span>
                      </>
                    ) : simProgress >= 1 ? (
                      <>
                        <RotateCcw size={14} />
                        <span>{isEn ? 'Replay run' : 'Rejouer la course'}</span>
                      </>
                    ) : simProgress > 0 ? (
                      <>
                        <Play size={14} fill="#000000" />
                        <span>{isEn ? 'Resume' : 'Reprendre'}</span>
                      </>
                    ) : (
                      <>
                        <Play size={14} fill="#000000" />
                        <span>{isEn ? 'Simulate route' : 'Lancer ce trajet'}</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </>
        ))(activeViewingRoute)}
      </AnimatedSheet>

      {/* Modal / Bottom Sheet: Gestionnaire de Trajet (3 petits points) */}
      <AnimatedSheet
        isOpen={Boolean(managingRoute)}
        onClose={() => {
          setManagingRoute(null);
          setShowRouteDeleteConfirm(false);
        }}
        sheetStyle={{
          background: 'rgba(18, 18, 22, 0.98)',
          gap: '16px',
          padding: '16px 18px calc(24px + env(safe-area-inset-bottom, 0px)) 18px',
        }}
      >
        {activeManagingRoute && ((managingRoute) => (
          <>
            {/* Grabber Handle */}
            <div data-sheet-drag-handle="true" style={{ display: 'flex', justifyContent: 'center', marginTop: '-4px', padding: '4px 0', cursor: 'grab' }}>
              <div style={{ width: '40px', height: '4px', borderRadius: '999px', background: 'rgba(255, 255, 255, 0.25)' }} />
            </div>

            {/* Header: Title & Close */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.3px' }}>
                  {isEn ? 'Manage Route' : 'Gérer le trajet'}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {managingRoute.distanceKm.toFixed(2)} km · {managingRoute.location || (isEn ? 'Outdoor run' : 'Course extérieure')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setManagingRoute(null);
                  setShowRouteDeleteConfirm(false);
                }}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Renommer le trajet */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {isEn ? 'Route name' : 'Nom du parcours'}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={editingRouteTitle}
                  onChange={(e) => setEditingRouteTitle(e.target.value)}
                  placeholder={isEn ? 'Route title...' : 'Titre du parcours...'}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (editingRouteTitle.trim()) {
                      saveRouteTitle(managingRoute.id, editingRouteTitle.trim());
                    }
                  }}
                  disabled={!editingRouteTitle.trim() || editingRouteTitle.trim() === managingRoute.title}
                  style={{
                    padding: '0 16px',
                    borderRadius: '12px',
                    background: (!editingRouteTitle.trim() || editingRouteTitle.trim() === managingRoute.title)
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#FFFFFF',
                    color: (!editingRouteTitle.trim() || editingRouteTitle.trim() === managingRoute.title)
                      ? 'rgba(255, 255, 255, 0.3)'
                      : '#000000',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: (!editingRouteTitle.trim() || editingRouteTitle.trim() === managingRoute.title)
                      ? 'default'
                      : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Check size={14} />
                  <span>{isEn ? 'Save' : 'Enregistrer'}</span>
                </button>
              </div>
            </div>

            {/* Actions rapides */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Lancer ce parcours */}
              <button
                type="button"
                onClick={() => {
                  const target = managingRoute;
                  setManagingRoute(null);
                  loadAndStartRoute(target);
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    flexShrink: 0,
                  }}
                >
                  <Play size={18} fill="#FFFFFF" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                    {isEn ? 'Replay route' : 'Rejouer ce parcours'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    {isEn ? 'Replay run trajectory on Apple Maps' : 'Visualiser l’animation du tracé sur Apple Maps'}
                  </div>
                </div>
              </button>

              {/* Voir sur la carte */}
              <button
                type="button"
                onClick={() => {
                  const target = managingRoute;
                  setManagingRoute(null);
                  setViewingRouteForMap(target);
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    flexShrink: 0,
                  }}
                >
                  <MapPin size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                    {isEn ? 'View route details & map' : 'Voir le tracé GPS & carte'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    {isEn ? 'Altitude profile, full map & elevation' : 'Profil d\'altitude, carte interactive et dénivelé'}
                  </div>
                </div>
              </button>

              {/* Ouvrir dans Apple Maps */}
              <button
                type="button"
                onClick={(e) => {
                  openInNativeAppleMaps(managingRoute, e);
                  setManagingRoute(null);
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    flexShrink: 0,
                  }}
                >
                  <Navigation size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                    {isEn ? 'Open in Apple Maps' : 'Ouvrir dans Plans (Apple Maps)'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    {isEn ? 'Export navigation to Apple Maps' : 'Lancer l\'itinéraire GPS dans Apple Maps'}
                  </div>
                </div>
                <ExternalLink size={14} style={{ color: 'var(--text-secondary)' }} />
              </button>

              {/* Partager la Story */}
              <button
                type="button"
                onClick={(e) => {
                  const target = managingRoute;
                  setManagingRoute(null);
                  shareStoredRoute(target, e);
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    flexShrink: 0,
                  }}
                >
                  <Share2 size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                    {isEn ? 'Share route' : 'Partager ce trajet'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    {isEn ? 'Export as Aurel Story or image' : 'Exporter sous forme de Story Aurel'}
                  </div>
                </div>
              </button>
            </div>

            {/* Zone de suppression */}
            <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <AnimatePresence mode="wait">
                {!showRouteDeleteConfirm ? (
                  <motion.button
                    key="delete-trigger"
                    type="button"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={SPRING_SNAPPY}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowRouteDeleteConfirm(true)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '12px',
                      background: 'rgba(255, 69, 58, 0.1)',
                      border: '1px solid rgba(255, 69, 58, 0.25)',
                      color: '#FF453A',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <Trash2 size={15} />
                    <span>{isEn ? 'Delete this route' : 'Supprimer ce trajet'}</span>
                  </motion.button>
                ) : (
                  <motion.div
                    key="delete-confirm"
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={SPRING_SNAPPY}
                    style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255, 69, 58, 0.08)', border: '1px solid rgba(255, 69, 58, 0.3)', borderRadius: '12px', padding: '12px' }}
                  >
                    <div style={{ fontSize: '12.5px', color: '#FFFFFF', textAlign: 'center', fontWeight: 500 }}>
                      {isEn ? 'Are you sure you want to delete this route?' : 'Voulez-vous vraiment supprimer ce trajet ?'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setShowRouteDeleteConfirm(false)}
                        style={{
                          flex: 1,
                          padding: '9px',
                          borderRadius: '8px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {isEn ? 'Cancel' : 'Annuler'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const idToDelete = managingRoute.id;
                          deleteRoute(idToDelete);
                          setManagingRoute(null);
                          setShowRouteDeleteConfirm(false);
                        }}
                        style={{
                          flex: 1,
                          padding: '9px',
                          borderRadius: '8px',
                          background: '#FF453A',
                          border: 'none',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {isEn ? 'Confirm Delete' : 'Confirmer'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ))(activeManagingRoute)}
      </AnimatedSheet>
      </div>

      {/* Live Running Screen (Strava / Apple Fitness Native Experience) */}
      {isLiveRunningViewOpen && (runState === 'running' || runState === 'paused' || runState === 'finished') && (
        <LiveRunningView
          runState={runState}
          runMode={runMode}
          treadmillSpeedKmh={treadmillSpeedKmh}
          onSetTreadmillSpeed={(spd) => {
            setTreadmillSpeedKmh(spd);
            treadmillSpeedRef.current = spd;
            if (spd > 0) {
              currentSmoothedSpeedRef.current = spd;
              setInstantSpeedKmh(spd);
            }
          }}
          treadmillSteps={treadmillSteps}
          onAdjustDistanceKm={(delta) => {
            setRunDistanceKm((prev) => {
              const updated = Math.max(0, Math.round((prev + delta) * 100) / 100);
              runDistanceKmRef.current = updated;
              return updated;
            });
          }}
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
