import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { run, zones, routeRaw, fitRoute, toPath, feedSeed, FeedPost } from '../data/fit';
import { fmtClockSec, fmtMMSS, fmtNum } from '../lib/format';
import { StoryData } from '../lib/story';
import { AppleWorkoutMap } from './AppleWorkoutMap';
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
  Settings2
} from 'lucide-react';

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
  const { openStory } = useApp();
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialSubTab = (params?.get('fit') as 'run' | 'gym' | 'feed') || 'run';
  const [subTab, setSubTab] = useState<'run' | 'gym' | 'feed'>(initialSubTab);

  // ------------------ COURSE & CARDIO (SESSION GPS VYTA LIVE) ------------------
  const initialRunState = (params?.get('run_state') as 'idle' | 'running' | 'paused' | 'finished') || 'idle';
  const initialRunDur = params?.get('run_dur') ? parseInt(params.get('run_dur')!, 10) : 0;
  const initialRunDist = params?.get('run_dist') ? parseFloat(params.get('run_dist')!) : 0;

  const [runState, setRunState] = useState<'idle' | 'running' | 'paused' | 'finished'>(initialRunState);
  const [runDurationSec, setRunDurationSec] = useState<number>(initialRunDur);
  const [runDistanceKm, setRunDistanceKm] = useState<number>(initialRunDist);
  const [isFastDemo, setIsFastDemo] = useState<boolean>(false);

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

  // Auto-ticking GPS workout timer
  useEffect(() => {
    if (runState !== 'running') return;

    const interval = setInterval(() => {
      setRunDurationSec((prevDur) => {
        const nextDur = prevDur + 1;

        setRunDistanceKm((prevDist) => {
          // Vitesse ~11.5 km/h ou démo rapide
          const speedDelta = isFastDemo ? 0.045 : 0.0032;
          const nextDist = Math.min(8.12, Math.round((prevDist + speedDelta) * 1000) / 1000);

          if (nextDist >= 8.12) {
            setRunState('finished');
          }

          // Enregistre les points télémétriques pour les 3 courbes (Distance, Vitesse, BPM)
          const curSpeed = nextDur > 0 ? (nextDist / nextDur) * 3600 : 0;
          const curHr = Math.min(176, Math.round(112 + (nextDist / 8.12) * 52 + Math.sin(nextDur / 6) * 3));

          setTelemetryHistory((prevHistory) => {
            const lastTime = prevHistory.length > 0 ? prevHistory[prevHistory.length - 1].timeSec : -1;
            if (nextDur - lastTime >= 1 || nextDist >= 8.12) {
              return [
                ...prevHistory,
                {
                  timeSec: nextDur,
                  distanceKm: nextDist,
                  speedKmh: Math.round(curSpeed * 10) / 10,
                  hrBpm: curHr,
                },
              ];
            }
            return prevHistory;
          });

          return nextDist;
        });

        return nextDur;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [runState, isFastDemo]);

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
      setTelemetryHistory([{ timeSec: 0, distanceKm: 0, speedKmh: 0, hrBpm: 0 }]);
    }
    setRunState('running');
  };

  const pauseRun = () => {
    setRunState('paused');
  };

  const resumeRun = () => {
    setRunState('running');
  };

  const stopRun = () => {
    setRunState('finished');
  };

  const resetRun = () => {
    setRunState('idle');
    setRunDurationSec(0);
    setRunDistanceKm(0);
    setTelemetryHistory([]);
  };

  // Live computed metrics (strictement 0 à l'arrêt)
  const isIdle = runState === 'idle';
  const liveProgress = runState === 'finished' ? 1 : Math.min(1, runDistanceKm / 8.12);
  const livePaceSec =
    runDistanceKm > 0.01
      ? Math.round(runDurationSec / runDistanceKm)
      : 0;
  const liveSpeedKmh =
    runDurationSec > 0 && runDistanceKm > 0
      ? ((runDistanceKm / runDurationSec) * 3600).toFixed(1)
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
    const finalDist = runDistanceKm > 0 ? parseFloat(runDistanceKm.toFixed(2)) : 8.12;
    const finalDur = runDurationSec > 0 ? runDurationSec : 2512;
    const finalPace = finalDist > 0 ? Math.round(finalDur / finalDist) : 309;
    const finalHr = liveHr > 72 ? liveHr : 156;

    openStory({
      mode: 'run',
      title: 'Course Matinale · Parc Monceau',
      dateStr: run.date,
      accentText: finalDist >= 8 ? 'Nouveau Record 1 km (4:48)' : 'Séance GPS Enregistrée',
      stats: [
        { label: 'Distance', value: `${finalDist}`, unit: 'km' },
        { label: 'Allure', value: fmtMMSS(finalPace), unit: '/km' },
        { label: 'Temps', value: fmtClockSec(finalDur) },
        { label: 'FC Moyenne', value: `${finalHr}`, unit: 'bpm' },
      ],
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
    <div className="screen-content">
      {/* Title */}
      <div style={{ paddingTop: '10px' }}>
        <span className="header-subtitle">Performance & Effort</span>
        <h1 className="header-title">Fit</h1>
      </div>

      {/* 3-Section Segmented Control */}
      <div className="segmented-control" role="tablist">
        <button
          type="button"
          className={`segmented-btn ${subTab === 'run' ? 'active' : ''}`}
          onClick={() => setSubTab('run')}
        >
          Course & Cardio
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
          Cercle Vyta
        </button>
      </div>

      {/* ==================== 1. MODE COURSE & CARDIO ==================== */}
      {subTab === 'run' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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


          {/* Partager Ma Course CTA */}
          <button
            type="button"
            className="apple-pay-btn"
            style={{
              background: 'var(--gold-gradient)',
              color: '#FFFFFF',
              fontWeight: 700,
              boxShadow: '0 8px 24px rgba(184, 35, 72, 0.25)',
            }}
            onClick={openRunStory}
          >
            <Share2 size={16} />
            <span>Partager Ma Course</span>
          </button>
        </div>
      )}

      {/* ==================== 2. MODE MUSCULATION (GYM LOGGER) ==================== */}
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
              background: 'var(--gold-gradient)',
              color: '#FFFFFF',
              fontWeight: 700,
              boxShadow: '0 8px 24px rgba(184, 35, 72, 0.25)',
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
  );
};
