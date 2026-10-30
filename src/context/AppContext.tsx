import React, { createContext, useContext, useState, useEffect } from 'react';
import { TabType, AppTheme, RingFinish, BiologicalSex, UserProfile, RingDevice, SensorIntervals, SensorIntervalOption } from '../types';
import { TODAY_INDEX, weekMetrics, ringDevice as defaultRing, detectRingFinish, defaultSensorIntervals, createEmptyWeekMetrics, calculateEstimatedBatteryDays } from '../data/health';
import { DayMetrics } from '../types';
import { Language, TranslationKey, getTranslation, detectDefaultLanguage } from '../lib/i18n';
import { qringBle, BleRingData } from '../lib/qringBleService';

interface AppContextType {
  tab: TabType;
  setTab: (tab: TabType) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  covytaActive: boolean;
  setCovytaActive: (active: boolean) => void;
  profile: UserProfile;
  updateProfile: (partial: Partial<UserProfile>) => void;
  finish: RingFinish;
  setFinish: (finish: RingFinish) => void;
  modal: 'settings' | 'subscribe' | 'healthkit' | 'notifications' | 'pairing' | 'general_state' | 'find_my' | 'prism' | null;
  openModal: (modal: 'settings' | 'subscribe' | 'healthkit' | 'notifications' | 'pairing' | 'general_state' | 'find_my' | 'prism') => void;
  closeModal: () => void;
  metricDetail: 'bpm' | 'hrv' | 'temp' | 'spo2' | 'resp' | 'stress' | 'bp' | 'glucose' | null;
  openMetricDetail: (metric: 'bpm' | 'hrv' | 'temp' | 'spo2' | 'resp' | 'stress' | 'bp' | 'glucose') => void;
  closeMetricDetail: () => void;
  storyData: any | null;
  openStory: (data: any) => void;
  closeStory: () => void;
  selectedDay: number;
  setSelectedDay: (day: number) => void;
  liveBpm: number;
  setLiveBpm: (bpm: number | ((prev: number) => number)) => void;
  ring: RingDevice;
  updateRing: (partial: Partial<RingDevice>) => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  cardThemeMode: 'monochrome' | 'colored';
  setCardThemeMode: (mode: 'monochrome' | 'colored') => void;
  simulatedDate: Date;
  setSimulatedDate: (d: Date) => void;
  resetSimulatedDate: () => void;
  isDateModalOpen: boolean;
  setIsDateModalOpen: (open: boolean) => void;
  sensorIntervals: SensorIntervals;
  updateSensorIntervals: (partial: Partial<SensorIntervals>) => void;
  isSimulating: boolean;
  toggleSimulation: () => void;
  simulationHoursElapsed: number;
  isFirstLaunch: boolean;
  isPaired: boolean;
  setIsPaired: (paired: boolean) => void;
  isLiveRunningViewOpen: boolean;
  setIsLiveRunningViewOpen: (open: boolean) => void;
  resetToFactory: () => void;
  weekData: DayMetrics[];
  setWeekData: React.Dispatch<React.SetStateAction<DayMetrics[]>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Version de build de production avec réinitialisation usine garantie
  const PROD_RELEASE_KEY = 'vyta_zero_state_v42';
  if (typeof window !== 'undefined') {
    try {
      const currentVersion = localStorage.getItem('vyta_app_version');
      if (currentVersion !== PROD_RELEASE_KEY) {
        // Nettoyage usine complet des anciennes données de test
        localStorage.clear();
        localStorage.setItem('vyta_app_version', PROD_RELEASE_KEY);
        localStorage.setItem('vyta_ring_paired_final', 'false');
        localStorage.setItem('vyta_first_launch', 'true');
      }
    } catch (_) {}
  }

  // Read initial query params if present for quick testing (?tab=fit, ?covyta=1, ?sex=femme, ?modal=settings)
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialTab = (params?.get('tab') as TabType) || 'health';
  const initialCovyta = params?.get('covyta') === '1';
  const initialSex = (params?.get('sex') as BiologicalSex) || (typeof window !== 'undefined' && localStorage.getItem('vyta_sex') === 'homme' ? 'homme' : 'femme');
  const initialModal = (params?.get('modal') as 'settings' | 'subscribe' | 'healthkit' | 'notifications' | 'pairing' | 'general_state' | null) || null;
  const initialMetric = (params?.get('metric') as 'bpm' | 'hrv' | 'temp' | 'spo2' | 'resp' | null) || null;
  const initialStory = params?.get('story') === '1' ? {
    mode: 'run',
    title: 'Course Matinale',
    dateStr: 'Jeu. 15 octobre · 07 h 10',
    accentText: 'Nouveau Record 1 km (4:48)',
    stats: [
      { label: 'Distance', value: '8.12', unit: 'km' },
      { label: 'Allure', value: '5:09', unit: '/km' },
      { label: 'Temps', value: '41:52' },
      { label: 'FC Moyenne', value: '156', unit: 'bpm' },
    ],
  } : null;

  const initialDay = params?.get('day') ? parseInt(params.get('day')!, 10) : TODAY_INDEX;

  const [tab, setTab] = useState<TabType>(initialTab);
  const [covytaActive, setCovytaActive] = useState<boolean>(initialCovyta);
  const [selectedDay, setSelectedDay] = useState<number>(initialDay);
  const [finish, setFinish] = useState<RingFinish>(() => detectRingFinish(defaultRing.macAddress, defaultRing.serial));
  const [modal, setModal] = useState<'settings' | 'subscribe' | 'healthkit' | 'notifications' | 'pairing' | 'general_state' | 'find_my' | 'prism' | null>(initialModal as any);
  const [metricDetail, setMetricDetail] = useState<'bpm' | 'hrv' | 'temp' | 'spo2' | 'resp' | 'stress' | 'bp' | 'glucose' | null>(initialMetric);
  const [storyData, setStoryData] = useState<any | null>(initialStory);
  const [ring, setRing] = useState<RingDevice>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vyta_ring_device');
        if (saved) return { ...defaultRing, ...JSON.parse(saved) };
      } catch (e) {}
    }
    return defaultRing;
  });

  // Auto-adapt ring finish based on ring hardware identifiers (MAC Address & Serial)
  useEffect(() => {
    const autoFinish = detectRingFinish(ring.macAddress, ring.serial);
    setFinish(autoFinish);
  }, [ring.macAddress, ring.serial]);


  // Simulated system date (for test mode)
  const [simulatedDate, setSimulatedDateState] = useState<Date>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vyta_simulated_date');
      if (saved) {
        const d = new Date(saved);
        if (!isNaN(d.getTime())) return d;
      }
    }
    return new Date();
  });

  const setSimulatedDate = (d: Date) => {
    setSimulatedDateState(d);
    try {
      localStorage.setItem('vyta_simulated_date', d.toISOString());
    } catch (e) {}
  };

  const resetSimulatedDate = () => {
    const d = new Date();
    setSimulatedDateState(d);
    try {
      localStorage.removeItem('vyta_simulated_date');
    } catch (e) {}
  };

  const [isDateModalOpen, setIsDateModalOpen] = useState<boolean>(false);
  // Biometric sensor sampling intervals (8 biometrics)
  const [sensorIntervals, setSensorIntervals] = useState<SensorIntervals>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vyta_sensor_intervals');
        if (saved) {
          const parsed = JSON.parse(saved);
          const sanitize = (val: any, fallback: SensorIntervalOption): SensorIntervalOption => {
            if (val === '15min' || val === '30min' || val === '1h' || val === '2h') return val;
            if (val === '10min' || val === '20min') return '15min';
            if (val === '60min') return '1h';
            if (val === '120min') return '2h';
            return fallback;
          };
          return {
            heartRate: sanitize(parsed.heartRate, defaultSensorIntervals.heartRate),
            hrv: sanitize(parsed.hrv, defaultSensorIntervals.hrv),
            spo2: sanitize(parsed.spo2, defaultSensorIntervals.spo2),
            temperature: sanitize(parsed.temperature, defaultSensorIntervals.temperature),
            stress: sanitize(parsed.stress, defaultSensorIntervals.stress),
            bloodPressure: sanitize(parsed.bloodPressure, defaultSensorIntervals.bloodPressure),
            glucose: sanitize(parsed.glucose, defaultSensorIntervals.glucose),
            respiratory: sanitize(parsed.respiratory, defaultSensorIntervals.respiratory),
          };
        }
      } catch (e) {}
    }
    return defaultSensorIntervals;
  });

  const updateSensorIntervals = (partial: Partial<SensorIntervals>) => {
    setSensorIntervals(prev => {
      const next = { ...prev, ...partial };
      if (partial.heartRate) {
        const mins = partial.heartRate === '30min' ? 30 : 60;
        qringBle.setHeartRateInterval(mins);
      }
      try {
        localStorage.setItem('vyta_sensor_intervals', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };


  // App Visual Theme ('dark')
  const [theme, setThemeState] = useState<AppTheme>(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('vyta_theme', 'dark');
      } catch (e) {}
    }
    return 'dark';
  });

  const setTheme = (t: AppTheme) => {
    setThemeState(t);
    try {
      localStorage.setItem('vyta_theme', t);
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', t);
      }
    } catch (e) {}
  };

  const [cardThemeMode, setCardThemeModeState] = useState<'monochrome' | 'colored'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('vyta_card_theme_mode') as 'monochrome' | 'colored') || 'colored';
    }
    return 'colored';
  });

  const setCardThemeMode = (mode: 'monochrome' | 'colored') => {
    setCardThemeModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vyta_card_theme_mode', mode);
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  // Language management with localStorage and device auto-detection
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vyta_language');
      if (saved === 'fr' || saved === 'en') return saved;
      return detectDefaultLanguage();
    }
    return 'fr';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('vyta_language', lang);
    } catch (e) {
      console.error(e);
    }
  };

  const t = (key: TranslationKey): string => {
    return getTranslation(language, key);
  };


  // État premier lancement
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean>(false);

  // État appairage (Prêt & actif pour l'expérience design)
  const [isPaired, setIsPairedState] = useState<boolean>(true);

  const setIsPaired = (paired: boolean) => {
    setIsPairedState(paired);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vyta_ring_paired_final', paired ? 'true' : 'false');
    }
  };

  // État affichage plein écran de la carte de course GPS en direct
  const [isLiveRunningViewOpen, setIsLiveRunningViewOpen] = useState<boolean>(false);

  const [profile, setProfile] = useState<UserProfile>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vyta_user_profile');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      firstName: '',
      age: 28,
      heightCm: 180,
      weightKg: 75,
      sex: initialSex,
    };
  });

  // BPM en direct transmis par la bague (strictement 0 tant qu'aucune mesure n'est reçue)
  const [liveBpm, setLiveBpm] = useState<number>(() => 0);

  const updateProfile = (partial: Partial<UserProfile>) => {
    setProfile(prev => {
      const next = { ...prev, ...partial };
      if (partial.sex) {
        try {
          localStorage.setItem('vyta_sex', partial.sex);
        } catch (e) {}
      }
      try {
        localStorage.setItem('vyta_user_profile', JSON.stringify(next));
      } catch (e) {}
      if (next.sex === 'homme' && tab === 'cycle') {
        setTab('health');
      }
      return next;
    });
  };

  const updateRing = (partial: Partial<RingDevice>) => {
    setRing(prev => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem('vyta_ring_device', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // Synchronisation globale télémétrie BLE de la bague physique
  useEffect(() => {
    // Reconnexion automatique silencieuse en arrière-plan
    qringBle.autoConnectSavedDevice();

    const unsubscribe = qringBle.subscribe((data: BleRingData) => {
      if (data.batteryPct !== undefined) {
        updateRing({ batteryRing: data.batteryPct, isConnected: true });
      }
      if (data.isConnected !== undefined) {
        updateRing({ isConnected: data.isConnected });
      }
      if (data.heartRate !== undefined && data.heartRate >= 40 && data.heartRate <= 200) {
        setLiveBpm(data.heartRate);
        setWeekData((prev) => {
          const next = [...prev];
          const idx = Math.min(6, Math.max(0, selectedDay));
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.bpm = data.heartRate!;

          // Courbe réelle : fusionner les 48 relevés de la bague (un par demi-heure) sans écraser les mesures réelles déjà acquises
          const prevLog = Array.isArray(cur.hrLog) && cur.hrLog.length === 48 ? [...cur.hrLog] : new Array(48).fill(0);
          if (Array.isArray(data.heartRateLog) && data.heartRateLog.length === 48) {
            cur.hrLog = data.heartRateLog.map((val, i) =>
              val >= 40 && val <= 200 ? val : prevLog[i] >= 40 && prevLog[i] <= 200 ? prevLog[i] : 0
            );
          } else {
            const now = new Date();
            const curHalf = Math.min(47, Math.max(0, now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0)));
            prevLog[curHalf] = data.heartRate!;
            cur.hrLog = prevLog;
          }

          const validLog = (cur.hrLog || []).filter((v) => v >= 40 && v <= 200);
          if (data.minBpm && data.minBpm >= 40 && data.minBpm <= 200) {
            cur.minBpm = validLog.length > 0 ? Math.min(data.minBpm, ...validLog) : data.minBpm;
          } else if (validLog.length > 0) {
            cur.minBpm = Math.min(...validLog);
          } else if (!cur.minBpm || cur.minBpm === 0 || data.heartRate! < cur.minBpm) {
            cur.minBpm = data.heartRate!;
          }

          if (data.maxBpm && data.maxBpm >= 40 && data.maxBpm <= 200) {
            cur.maxBpm = validLog.length > 0 ? Math.max(data.maxBpm, ...validLog) : data.maxBpm;
          } else if (validLog.length > 0) {
            cur.maxBpm = Math.max(...validLog);
          } else if (!cur.maxBpm || data.heartRate! > cur.maxBpm) {
            cur.maxBpm = data.heartRate!;
          }

          if (data.restingBpm && data.restingBpm >= 40 && data.restingBpm <= 200) {
            cur.restingBpm = data.restingBpm;
          } else if (validLog.length > 0) {
            cur.restingBpm = Math.round(validLog.reduce((a, b) => a + b, 0) / validLog.length);
          } else if (!cur.restingBpm || cur.restingBpm === 0) {
            cur.restingBpm = data.heartRate!;
          }

          next[idx] = cur;
          try {
            localStorage.setItem('vyta_week_data', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      }
      if (data.hrv !== undefined && data.hrv > 0) {
        setWeekData((prev) => {
          const next = [...prev];
          const idx = Math.min(6, Math.max(0, selectedDay));
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.hrv = data.hrv!;
          if (Array.isArray(data.hrvLog) && data.hrvLog.length === 48) {
            cur.hrvLog = data.hrvLog;
          }
          if (cur.pillars) {
            const recScore = Math.min(100, Math.max(20, Math.round(50 + (data.hrv! - 30) * 0.9)));
            cur.pillars = { ...cur.pillars, recovery: recScore };
            const activePillars = [cur.pillars.sleep, cur.pillars.recovery, cur.pillars.activity].filter((v) => v > 0);
            cur.score = activePillars.length > 0 ? Math.round(activePillars.reduce((a, b) => a + b, 0) / activePillars.length) : 0;
          }
          next[idx] = cur;
          try {
            localStorage.setItem('vyta_week_data', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      }
      if (data.stress !== undefined && data.stress > 0) {
        setWeekData((prev) => {
          const next = [...prev];
          const idx = Math.min(6, Math.max(0, selectedDay));
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.stress = data.stress!;
          if (data.stressAvg !== undefined) cur.stressAvg = data.stressAvg;
          if (data.stressMin !== undefined) cur.stressMin = data.stressMin;
          if (data.stressMax !== undefined) cur.stressMax = data.stressMax;
          if (Array.isArray(data.stressLog) && data.stressLog.length === 48) {
            cur.stressLog = data.stressLog;
          }
          cur.stressLevel = data.stress! < 30 ? 'Bas' : data.stress! < 60 ? 'Normal' : 'Stress';
          if (cur.pillars) {
            const recFromStress = Math.max(10, Math.min(100, 100 - (data.stressAvg || data.stress!) + 14));
            if (!cur.pillars.recovery || cur.pillars.recovery === 0) {
              cur.pillars = { ...cur.pillars, recovery: recFromStress };
            }
            const activePillars = [cur.pillars.sleep, cur.pillars.recovery, cur.pillars.activity].filter((v) => v > 0);
            cur.score = activePillars.length > 0 ? Math.round(activePillars.reduce((a, b) => a + b, 0) / activePillars.length) : 0;
            cur.bodyEnergy = recFromStress;
            if (cur.pillars.sleep > 0) cur.bodyEnergyWake = cur.pillars.sleep;
          }
          next[idx] = cur;
          try {
            localStorage.setItem('vyta_week_data', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      }
      if (data.skinTemp !== undefined && data.skinTemp >= 30 && data.skinTemp <= 42) {
        setWeekData((prev) => {
          const next = [...prev];
          const idx = Math.min(6, Math.max(0, selectedDay));
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.skinTemp = data.skinTemp!;
          cur.tempDelta = parseFloat((data.skinTemp! - 36.5).toFixed(2));
          next[idx] = cur;
          try {
            localStorage.setItem('vyta_week_data', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      }
      if (data.bloodPressure !== undefined) {
        setWeekData((prev) => {
          const next = [...prev];
          const idx = Math.min(6, Math.max(0, selectedDay));
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.bloodPressure = data.bloodPressure!;
          next[idx] = cur;
          return next;
        });
      }
      if (data.glucose !== undefined) {
        setWeekData((prev) => {
          const next = [...prev];
          const idx = Math.min(6, Math.max(0, selectedDay));
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.glucose = { valueMmol: data.glucose!, stabilityScore: 0 };
          next[idx] = cur;
          return next;
        });
      }
      if (data.wearCalibrationScore !== undefined) {
        updateRing({ wearCalibrationScore: data.wearCalibrationScore, wearCalibrationDate: "Aujourd'hui" });
      }
      if (data.steps !== undefined && data.steps > 0) {
        // Guard & auto-repair if a 24-bit Little-Endian step value (> 120000) ever arrives
        const safeSteps = data.steps > 120000
          ? (((data.steps & 0xFF) << 16) | (data.steps & 0xFF00) | ((data.steps >> 16) & 0xFF))
          : data.steps;
        setWeekData((prev) => {
          const next = [...prev];
          const idx = Math.min(6, Math.max(0, selectedDay));
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.steps = safeSteps;
          if (data.calories && data.calories > 0) cur.activeKcal = data.calories;
          if (data.distanceKm && data.distanceKm > 0) cur.distanceKm = data.distanceKm;
          if (cur.pillars) {
            cur.pillars = {
              ...cur.pillars,
              activity: Math.min(100, Math.round((safeSteps / 10000) * 100)),
            };
            const activePillars = [cur.pillars.sleep, cur.pillars.recovery, cur.pillars.activity].filter((v) => v > 0);
            cur.score = activePillars.length > 0 ? Math.round(activePillars.reduce((a, b) => a + b, 0) / activePillars.length) : 0;
          }
          next[idx] = cur;
          try {
            localStorage.setItem('vyta_week_data', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      }
      if (data.sleepHours !== undefined && data.sleepHours > 0) {
        setWeekData((prev) => {
          const next = [...prev];
          const idx = Math.min(6, Math.max(0, selectedDay));
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          const totalMin = Math.round(data.sleepHours! * 60);
          const hasStages =
            (data.sleepDeepMin !== undefined && data.sleepDeepMin > 0) ||
            (data.sleepRemMin !== undefined && data.sleepRemMin > 0) ||
            (data.sleepLightMin !== undefined && data.sleepLightMin > 0);
          const sleepScore = data.sleepScore || Math.min(99, Math.round((totalMin / 480) * 90));
          cur.sleep = hasStages
            ? {
                score: sleepScore,
                deepMin: data.sleepDeepMin || 0,
                remMin: data.sleepRemMin || 0,
                lightMin: data.sleepLightMin || 0,
                awakeMin: data.sleepAwakeMin || 0,
              }
            : {
                score: sleepScore,
                deepMin: cur.sleep?.deepMin || 0,
                remMin: cur.sleep?.remMin || 0,
                lightMin: totalMin - (cur.sleep?.deepMin || 0) - (cur.sleep?.remMin || 0) - (cur.sleep?.awakeMin || 0),
                awakeMin: cur.sleep?.awakeMin || 0,
              };
          if (cur.pillars) {
            cur.pillars = {
              ...cur.pillars,
              sleep: sleepScore,
            };
            const activePillars = [cur.pillars.sleep, cur.pillars.recovery, cur.pillars.activity].filter((v) => v > 0);
            cur.score = activePillars.length > 0 ? Math.round(activePillars.reduce((a, b) => a + b, 0) / activePillars.length) : 0;
            cur.bodyEnergyWake = sleepScore;
            if (!cur.bodyEnergy || cur.bodyEnergy === 0) {
              cur.bodyEnergy = cur.score;
            }
          }
          next[idx] = cur;
          try {
            localStorage.setItem('vyta_week_data', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      }
      if (data.spo2 !== undefined && data.spo2 > 0) {
        setWeekData((prev) => {
          const next = [...prev];
          const idx = Math.min(6, Math.max(0, selectedDay));
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.spo2 = data.spo2!;
          if (data.spo2Min !== undefined) cur.spo2Min = data.spo2Min;
          if (data.spo2Max !== undefined) cur.spo2Max = data.spo2Max;
          if (Array.isArray(data.spo2Log) && data.spo2Log.length === 48) {
            cur.spo2Log = data.spo2Log;
          }
          next[idx] = cur;
          try {
            localStorage.setItem('vyta_week_data', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      }
      if (data.minBpm !== undefined && data.minBpm > 0) {
        setWeekData((prev) => {
          const next = [...prev];
          const idx = Math.min(6, Math.max(0, selectedDay));
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.minBpm = data.minBpm!;
          if (data.maxBpm) cur.maxBpm = data.maxBpm!;
          if (data.restingBpm) cur.restingBpm = data.restingBpm!;
          next[idx] = cur;
          try {
            localStorage.setItem('vyta_week_data', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      }
    });
    return () => unsubscribe();
  }, [selectedDay]);

  // Données biométriques réelles de la semaine (strictement réelles ou 0)
  const [weekData, setWeekData] = useState<DayMetrics[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const v = localStorage.getItem('vyta_data_ver');
        // Si ancien cache ou version antérieure contenant de fausses données, purger immédiatement
        if (v !== 'v57_real_only') {
          localStorage.removeItem('vyta_week_data');
          localStorage.removeItem('vyta_simulated_date');
          localStorage.setItem('vyta_data_ver', 'v57_real_only');
          return createEmptyWeekMetrics();
        }
        const saved = localStorage.getItem('vyta_week_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length === 7) {
            // Nettoyage automatique de tout faux relevé 200 BPM résiduel de l'ancien bug de trame 0x16
            return parsed.map((d: DayMetrics) => {
              if (d && (d.bpm >= 200)) {
                return {
                  ...d,
                  bpm: 0,
                  maxBpm: (d.maxBpm && d.maxBpm >= 200) ? 0 : d.maxBpm,
                  minBpm: (d.minBpm && d.minBpm >= 200) ? 0 : d.minBpm,
                  restingBpm: (d.restingBpm && d.restingBpm >= 200) ? 0 : d.restingBpm,
                };
              }
              return d;
            });
          }
        }
      } catch (e) {}
    }
    return createEmptyWeekMetrics();
  });

  // Moteur de simulation accélérée (1 seconde réelle = 1 heure de vie de bague)
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationHoursElapsed, setSimulationHoursElapsed] = useState<number>(0);

  const toggleSimulation = () => {
    setIsSimulating(prev => !prev);
  };

  // Remise à zéro d'usine (état premier lancement : 0 données, bague à appairer)
  const resetToFactory = () => {
    qringBle.disconnect(true);
    setIsSimulating(false);
    setSimulationHoursElapsed(0);
    setIsFirstLaunch(true);
    setIsPaired(false);
    const empty = createEmptyWeekMetrics();
    setWeekData(empty);
    updateRing({
      isConnected: false,
      batteryRing: 0,
      sensorIntervals: defaultSensorIntervals,
      wearCalibrationScore: 0,
      wearCalibrationDate: "En attente d'appairage",
    });
    setLiveBpm(0);
    const startCleanDate = new Date();
    setSimulatedDate(startCleanDate);
    setSelectedDay(TODAY_INDEX);
    try {
      localStorage.setItem('vyta_first_launch', 'true');
      localStorage.setItem('vyta_ring_paired_final', 'false');
      localStorage.setItem('vyta_week_data', JSON.stringify(empty));
      localStorage.setItem('vyta_sensor_intervals', JSON.stringify(defaultSensorIntervals));
    } catch (e) {}
  };

  const openModal = (m: 'settings' | 'subscribe' | 'healthkit' | 'notifications' | 'pairing' | 'general_state' | 'find_my' | 'prism') => setModal(m);
  const closeModal = () => setModal(null);
  const openMetricDetail = (m: 'bpm' | 'hrv' | 'temp' | 'spo2' | 'resp' | 'stress' | 'bp' | 'glucose') => setMetricDetail(m);
  const closeMetricDetail = () => setMetricDetail(null);
  const openStory = (data: any) => setStoryData(data);
  const closeStory = () => setStoryData(null);

  return (
    <AppContext.Provider
      value={{
        tab,
        setTab,
        language,
        setLanguage,
        t,
        covytaActive,
        setCovytaActive,
        profile,
        updateProfile,
        finish,
        setFinish,
        modal,
        openModal,
        closeModal,
        metricDetail,
        openMetricDetail,
        closeMetricDetail,
        storyData,
        openStory,
        closeStory,
        selectedDay,
        setSelectedDay,
        liveBpm,
        setLiveBpm,
        ring,
        updateRing,
        theme,
        setTheme,
        cardThemeMode,
        setCardThemeMode,
        simulatedDate,
        setSimulatedDate,
        resetSimulatedDate,
        isDateModalOpen,
        setIsDateModalOpen,
        sensorIntervals,
        updateSensorIntervals,
        isSimulating,
        toggleSimulation,
        simulationHoursElapsed,
        isFirstLaunch,
        isPaired,
        setIsPaired,
        isLiveRunningViewOpen,
        setIsLiveRunningViewOpen,
        resetToFactory,
        weekData,
        setWeekData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
