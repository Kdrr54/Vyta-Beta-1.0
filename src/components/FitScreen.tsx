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
import { run, zones, routeRaw, fitRoute, toPath, feedSeed, FeedPost } from '../data/fit';
import { fmtClockSec, fmtMMSS, fmtNum } from '../lib/format';
import { StoryData, DEFAULT_ROUTE_PATH_D, convertGpsPointsToSvgPath } from '../lib/story';
import { AppleWorkoutMap } from './AppleWorkoutMap';
import { LiveRunningView } from './LiveRunningView';
import { ExerciseSettingsModal } from './ExerciseSettingsModal';
import { RunTelemetryCharts, TelemetryPoint } from './RunTelemetryCharts';
import { 
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

const initialStoredRoutes: StoredRoute[] = [
  {
    id: 'route-seine',
    title: 'Quais de Seine · Tour Eiffel',
    location: 'Paris 7e · Pont d\'Iéna',
    distanceKm: 5.40,
    durationSec: 1605,
    elevationM: 28,
    avgHr: 162,
    dateStr: '12 oct. 2026 · 18:30',
    pointsSvgPath: 'M 50 180 Q 120 160, 180 115 T 310 50',
    progress: 0.66,
  },
  {
    id: 'route-boulogne',
    title: 'Bois de Boulogne · Tour du Lac',
    location: 'Paris 16e · Lac Inférieur',
    distanceKm: 10.25,
    durationSec: 3198,
    elevationM: 45,
    avgHr: 150,
    dateStr: '8 oct. 2026 · 09:15',
    pointsSvgPath: 'M 180 45 Q 100 65, 75 125 T 140 190 Q 220 195, 285 135 T 240 55 Z',
    progress: 1,
  },
  {
    id: 'route-montmartre',
    title: 'Montmartre · Dénivelé Sacré-Cœur',
    location: 'Paris 18e · Place du Tertre',
    distanceKm: 4.60,
    durationSec: 1630,
    elevationM: 120,
    avgHr: 168,
    dateStr: '3 oct. 2026 · 11:00',
    pointsSvgPath: 'M 70 190 L 130 150 L 110 120 L 200 90 L 250 45',
    progress: 0.57,
  },
];

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

const initialWorkoutExercises: GymExercise[] = [
  {
    id: 'ex-1',
    name: 'Développé couché (barre)',
    sets: [
      { id: 'ex-1-s1', weightKg: 80, reps: 8, done: true },
      { id: 'ex-1-s2', weightKg: 80, reps: 8, done: true },
      { id: 'ex-1-s3', weightKg: 82.5, reps: 6, done: true },
    ],
  },
  {
    id: 'ex-2',
    name: 'Développé incliné haltères',
    sets: [
      { id: 'ex-2-s1', weightKg: 28, reps: 10, done: true },
      { id: 'ex-2-s2', weightKg: 28, reps: 10, done: true },
      { id: 'ex-2-s3', weightKg: 28, reps: 9, done: false },
    ],
  },
  {
    id: 'ex-3',
    name: 'Extension triceps poulie',
    sets: [
      { id: 'ex-3-s1', weightKg: 30, reps: 12, done: false },
      { id: 'ex-3-s2', weightKg: 30, reps: 12, done: false },
      { id: 'ex-3-s3', weightKg: 27.5, reps: 12, done: false },
    ],
  },
];

export const FitScreen: React.FC = () => {
  const { openStory, isLiveRunningViewOpen, setIsLiveRunningViewOpen } = useApp();
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialSubTab = (params?.get('fit') as 'run' | 'trajets' | 'gym' | 'feed') || 'run';
  const [subTab, setSubTab] = useState<'run' | 'trajets' | 'gym' | 'feed'>(initialSubTab);

  const [storedRoutes, setStoredRoutes] = useState<StoredRoute[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vyta_stored_routes');
        if (saved) return JSON.parse(saved);
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

  // ------------------ COURSE & CARDIO (SESSION GPS VYTA LIVE) ------------------
  const initialRunState = (params?.get('run_state') as 'idle' | 'running' | 'paused' | 'finished') || 'idle';
  const initialRunDur = params?.get('run_dur') ? parseInt(params.get('run_dur')!, 10) : 0;
  const initialRunDist = params?.get('run_dist') ? parseFloat(params.get('run_dist')!) : 0;

  const [runState, setRunState] = useState<'idle' | 'running' | 'paused' | 'finished'>(initialRunState);
  const [runDurationSec, setRunDurationSec] = useState<number>(initialRunDur);
  const [runDistanceKm, setRunDistanceKm] = useState<number>(initialRunDist);
  const [isFastDemo, setIsFastDemo] = useState<boolean>(false);
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
  // isLiveRunningViewOpen hoisted to AppContext

  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>(() => {
    if (initialRunDur > 0 && initialRunDist > 0) {
      const pts: TelemetryPoint[] = [];
      const steps = Math.min(40, initialRunDur);
      for (let i = 0; i <= steps; i++) {
        const t = Math.round((i / steps) * initialRunDur);
        const dist = parseFloat(((i / steps) * initialRunDist).toFixed(3));
        const spd = t > 0 ? (dist / t) * 3600 : 0;
        const hr = Math.round(112 + (dist / 8.12) * 52);
        pts.push({ timeSec: t, distanceKm: dist, speedKmh: Math.round(spd * 10) / 10, hrBpm: hr });
      }
      return pts;
    }
    return [];
  });

    // Minuteur d'entraînement & télémétrie réelle (pas de vitesse factice hardcodée)
  useEffect(() => {
    if (runState !== 'running') return;

    const interval = setInterval(() => {
      setRunDurationSec((prevDur) => {
        const nextDur = prevDur + 1;

        if (isFastDemo) {
          // Démo rapide uniquement si activée manuellement
          setRunDistanceKm((prevDist) => Math.round((prevDist + 0.045) * 1000) / 1000);
        }

        const curSpeed = isFastDemo ? 12.4 : instantSpeedKmh;
        const curHr = Math.min(176, Math.round(112 + Math.min(1, runDistanceKm / 6) * 48 + Math.sin(nextDur / 6) * 3));

        setTelemetryHistory((prevHistory) => [
          ...prevHistory,
          {
            timeSec: nextDur,
            distanceKm: runDistanceKm,
            speedKmh: Math.round(curSpeed * 10) / 10,
            hrBpm: curHr,
          },
        ]);

        return nextDur;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [runState, isFastDemo, instantSpeedKmh, runDistanceKm]);

  // Surveillance GPS temps réel haute précision (Distance & Vitesse réelles du coureur)
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
        const { latitude, longitude, speed, accuracy } = pos.coords;
        const coords: [number, number] = [latitude, longitude];
        const now = Date.now();

        setUserPosition(coords);
        try {
          localStorage.setItem('vyta_last_user_location', JSON.stringify(coords));
        } catch (e) {}

        // 1. Filtrage anti-dérive GPS : ignorer les signaux imprécis (> 25m)
        if (accuracy > 25) {
          return;
        }

        if (!lastGpsFixRef.current) {
          lastGpsFixRef.current = { lat: latitude, lng: longitude, time: now };
          setRealGpsPoints([coords]);
          return;
        }

        const dtSec = Math.max(0.5, (now - lastGpsFixRef.current.time) / 1000);
        // Exiger au moins 2 secondes entre les calculs pour éliminer les micro-sauts de position
        if (dtSec < 2.0) {
          return;
        }

        const distMeters = calculateGpsDistanceMeters(
          lastGpsFixRef.current.lat,
          lastGpsFixRef.current.lng,
          latitude,
          longitude
        );

        // 2. Détection de l'immobilité stricte (Doppler CoreLocation ou dérive < 7.5m)
        const hasHardwareSpeed = speed !== null && !isNaN(speed) && speed >= 0;
        const isStationary = hasHardwareSpeed ? speed < 0.8 : distMeters < 7.5;

        if (isStationary) {
          setInstantSpeedKmh(0);
          return;
        }

        // 3. Déplacement humain réel avéré (au moins 7.5 mètres et vitesse < 22 km/h)
        if (distMeters >= 7.5 && distMeters < 80) {
          let instantKmh = 0;
          if (hasHardwareSpeed) {
            instantKmh = speed * 3.6; // Vitesse Doppler réelle CoreLocation
          } else {
            instantKmh = (distMeters / dtSec) * 3.6;
          }

          // Éliminer les artefacts impossibles (> 22 km/h)
          if (instantKmh > 22.0) {
            setInstantSpeedKmh(0);
            return;
          }

          // Seuil d'allure : si inférieur à 2.5 km/h, considérer à l'arrêt
          if (instantKmh < 2.5) {
            instantKmh = 0;
          } else {
            const distKm = distMeters / 1000;
            setRunDistanceKm((prev) => Math.round((prev + distKm) * 1000) / 1000);

            // Lissage exponentiel doux
            setInstantSpeedKmh((prev) => {
              const smoothed = prev > 0 ? (prev * 0.7 + instantKmh * 0.3) : instantKmh;
              return Math.round(smoothed * 10) / 10;
            });

            lastGpsFixRef.current = { lat: latitude, lng: longitude, time: now };
            setRealGpsPoints((prev) => [...prev, coords]);
          }
        } else if (distMeters < 7.5) {
          // Utilisateur à l'arrêt
          setInstantSpeedKmh(0);
        }
      },
      (err) => console.log('GPS watch error:', err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
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
      setInstantSpeedKmh(0);
      const initPoints: [number, number][] = userPosition ? [userPosition] : [];
      setRealGpsPoints(initPoints);
      lastGpsFixRef.current = userPosition ? { lat: userPosition[0], lng: userPosition[1], time: Date.now() } : null;
      setTelemetryHistory([{ timeSec: 0, distanceKm: 0, speedKmh: 0, hrBpm: 0 }]);
    }
    setRunState('running');
    setIsLiveRunningViewOpen(true);
  };

  const pauseRun = () => {
    setRunState('paused');
    setInstantSpeedKmh(0);
  };

  const resumeRun = () => {
    setRunState('running');
    setIsLiveRunningViewOpen(true);
  };

  const stopRun = () => {
    setRunState('finished');
    saveCurrentRunToTrajets();
    openRunStory();
    setIsLiveRunningViewOpen(false);
  };

  const resetRun = () => {
    setRunState('idle');
    setRunDurationSec(0);
    setRunDistanceKm(0);
    setInstantSpeedKmh(0);
    setRealGpsPoints([]);
    lastGpsFixRef.current = null;
    setTelemetryHistory([]);
  };

  const saveCurrentRunToTrajets = () => {
    const finalDist = Math.round(runDistanceKm * 100) / 100;
    const finalDur = runDurationSec;
    const finalHr = liveHr > 40 ? liveHr : 0;
    const hasGps = realGpsPoints && realGpsPoints.length >= 2;
    const pathInfo = hasGps ? convertGpsPointsToSvgPath(realGpsPoints) : null;

    const newRoute: StoredRoute = {
      id: `route-${Date.now()}`,
      title: `Course Vyta · ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`,
      location: 'Course extérieure',
      distanceKm: finalDist,
      durationSec: finalDur,
      elevationM: Math.round(finalDist * 8),
      avgHr: finalHr,
      dateStr: `Aujourd'hui · ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      pointsSvgPath: pathInfo ? pathInfo.pathD : DEFAULT_ROUTE_PATH_D,
      realGpsPoints: hasGps ? realGpsPoints : undefined,
      progress: 1,
    };
    setStoredRoutes((prev) => [newRoute, ...prev]);
    setSubTab('trajets');
  };

  const handleCreateRoute = () => {
    const cleanTitle = newRouteTitle.trim() || 'Mon Nouveau Parcours';
    const distNum = parseFloat(newRouteDist) || 5.0;
    const estSec = Math.round(distNum * 315);

    const newRoute: StoredRoute = {
      id: `route-${Date.now()}`,
      title: cleanTitle,
      location: newRouteLoc.trim() || 'Paris',
      distanceKm: distNum,
      durationSec: estSec,
      elevationM: Math.round(distNum * 8),
      avgHr: 154,
      dateStr: `Aujourd'hui · ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      pointsSvgPath: 'M 10 65 Q 35 50 50 35 T 90 20',
      progress: 1,
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

  const shareStoredRoute = (route: StoredRoute, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const paceVal = route.distanceKm > 0 && route.durationSec > 0
      ? fmtMMSS(Math.round(route.durationSec / route.distanceKm))
      : '--:--';
    openStory({
      mode: 'run',
      title: route.title,
      dateStr: route.dateStr,
      stats: [
        { label: 'Distance', value: route.distanceKm.toFixed(2), unit: 'km' },
        { label: 'Allure', value: paceVal, unit: '/km' },
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
      ? (isFastDemo ? '12.4' : (runDistanceKm > 0.01 && instantSpeedKmh >= 1.0 ? instantSpeedKmh.toFixed(1) : '0.0'))
      : '0.0';
  const liveHr = isIdle
    ? 0
    : Math.min(176, Math.round(112 + liveProgress * 52 + Math.sin(runDurationSec / 6) * 3));
  const liveCalories = isIdle ? 0 : Math.round(runDistanceKm * 75);
  const liveElevation = isIdle ? 0 : Math.round(liveProgress * 64);

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
    const finalPace = finalDist > 0 && finalDur > 0 ? Math.round(finalDur / finalDist) : 0;
    const finalHr = liveHr > 40 ? liveHr : 0;

    openStory({
      mode: 'run',
      title: 'Course GPS Vyta',
      dateStr: new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
      accentText: 'Séance GPS Enregistrée',
      stats: [
        { label: 'Distance', value: finalDist > 0 ? `${finalDist.toFixed(2)}` : '0.00', unit: 'km' },
        { label: 'Allure', value: finalPace > 0 ? fmtMMSS(finalPace) : '--:--', unit: '/km' },
        { label: 'Temps', value: fmtClockSec(finalDur) },
        { label: 'FC Moyenne', value: finalHr > 0 ? `${finalHr}` : '--', unit: 'bpm' },
      ],
      realGpsPoints: realGpsPoints && realGpsPoints.length >= 2 ? realGpsPoints : undefined,
    });
  };

  const openGymStory = () => {
    openStory({
      mode: 'gym',
      title: sessionTitle,
      dateStr: 'Jeu. 15 octobre · 18 h 30',
      tonnageKg: totalTonnageKg > 0 ? totalTonnageKg : 2300,
      accentText: 'Séance Personnalisée Validée',
      stats: [
        {
          label: 'Charge Totale',
          value: totalTonnageKg >= 1000 ? (totalTonnageKg / 1000).toFixed(1) : `${totalTonnageKg}`,
          unit: totalTonnageKg >= 1000 ? 't' : 'kg',
        },
        { label: 'Séries Validées', value: `${doneSetsCount} / ${totalSetsCount}` },
        { label: 'Temps Repos', value: `${targetRestSeconds}`, unit: 's' },
        { label: 'Intensité', value: '89', unit: '%' },
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
          Trajets ({storedRoutes.length})
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
                      : runState === 'finished'
                      ? 'finished'
                      : 'idle'
                  }`}
                >
                  <span className="gps-pulse-dot" />
                  <span>
                    {runState === 'running'
                      ? 'GPS Vyta Actif (Live)'
                      : runState === 'paused'
                      ? 'GPS en pause'
                      : runState === 'finished'
                      ? 'Course Terminée'
                      : 'GPS Vyta Prêt'}
                  </span>
                </span>
              </div>

              {/* Simulation speed toggle */}
              <button
                type="button"
                className={`sim-speed-btn ${isFastDemo ? 'active' : ''}`}
                onClick={() => setIsFastDemo(!isFastDemo)}
                title="Bascule mode simulation accélérée pour test direct"
              >
                <span>{isFastDemo ? '⚡ Démo 15x' : 'Vitesse 1x'}</span>
              </button>
            </div>

            {/* Run Action Buttons */}
            {runState === 'idle' && (
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

            {runState === 'finished' && (
              <div className="run-action-btns-row">
                <button
                  type="button"
                  className="resume-run-btn"
                  onClick={resetRun}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    borderColor: 'rgba(255,255,255,0.15)',
                  }}
                >
                  <RotateCcw size={14} />
                  <span>Recommencer</span>
                </button>
                <button
                  type="button"
                  className="add-exercise-btn-main"
                  onClick={openRunStory}
                  style={{ flex: 1.5, padding: '11px 16px' }}
                >
                  <Share2 size={15} />
                  <span>Partager Ma Course</span>
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

          {/* Key Running Metrics Grid (Live GPS) */}
          <div className="activity-raw-card">
            <div className="activity-raw-item">
              <span className="activity-raw-label">Distance</span>
              <div>
                <span className="activity-raw-val">
                  {isIdle ? '0.00' : runDistanceKm.toFixed(2)}
                </span>
                <span className="activity-raw-unit">km</span>
              </div>
            </div>

            <div className="activity-raw-item">
              <span className="activity-raw-label">Allure Moyenne</span>
              <div>
                <span className="activity-raw-val">
                  {isIdle ? '--:--' : fmtMMSS(livePaceSec)}
                </span>
                <span className="activity-raw-unit">/km</span>
              </div>
            </div>

            <div className="activity-raw-item">
              <span className="activity-raw-label">Temps Total</span>
              <div>
                <span className="activity-raw-val">{fmtClockSec(runDurationSec)}</span>
              </div>
            </div>
          </div>

          {/* Secondary stats row: Vitesse, Dénivelé, FC moyenne, Calories */}
          <div className="metrics-grid-2">
            <div className="metric-card" style={{ minHeight: '90px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Vitesse & Dénivelé</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span className="metric-large">{liveSpeedKmh}</span>
                <span className="metric-unit">km/h</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>+{liveElevation} m</span>
              </div>
            </div>

            <div className="metric-card" style={{ minHeight: '90px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Cardio & Énergie</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span className="metric-large">{liveHr}</span>
                <span className="metric-unit">bpm</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{liveCalories} kcal</span>
              </div>
            </div>
          </div>

          {/* Télémétrie Complète : 1. Distance, 2. Vitesse, 3. BPM avec temps horizontal */}
          <RunTelemetryCharts
            runState={runState}
            runDurationSec={runDurationSec}
            runDistanceKm={runDistanceKm}
            liveSpeedKmh={parseFloat(liveSpeedKmh)}
            liveHr={liveHr}
            telemetryHistory={telemetryHistory}
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
                  Mes Trajets ({storedRoutes.length})
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
                  {/* Mini SVG Trajectory Preview */}
                  <div
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '14px',
                      background: '#151518',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: 'inset 0 0 12px rgba(0,0,0,0.8)',
                    }}
                  >
                    <svg viewBox="0 0 100 100" style={{ width: '56px', height: '56px' }}>
                      <path
                        d={route.pointsSvgPath}
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="drop-shadow(0 0 4px rgba(255,255,255,0.5))"
                      />
                      <circle cx="15" cy="20" r="3" fill="#FFFFFF" stroke="#000000" strokeWidth="1" />
                    </svg>
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {route.title}
                    </span>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {route.location} · {route.dateStr}
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
                        ⚡ {fmtMMSS(Math.round(route.durationSec / route.distanceKm))} /km
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

          {/* Partager Ma Séance CTA */}
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

                  {/* Kudos / Vyta Boost button */}
                  <button
                    type="button"
                    className={`boost-btn ${isBoosted ? 'boosted' : ''}`}
                    onClick={() => handleBoost(post.id)}
                    title="Envoyer un Vyta Boost"
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
          isFastDemo={isFastDemo}
          onToggleFastDemo={() => setIsFastDemo(!isFastDemo)}
          realGpsPoints={realGpsPoints}
          userPosition={userPosition}
        />
      )}
    </>
  );
};
