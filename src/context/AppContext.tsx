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
  loadDemoData: () => void;
  weekData: DayMetrics[];
  setWeekData: React.Dispatch<React.SetStateAction<DayMetrics[]>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Version de build de production avec réinitialisation usine garantie
  const PROD_RELEASE_KEY = 'vyta_zero_state_v1_0';
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
    return new Date(2026, 9, 17, 15, 47); // Default: Samedi 17 octobre 2026
  });

  const setSimulatedDate = (d: Date) => {
    setSimulatedDateState(d);
    try {
      localStorage.setItem('vyta_simulated_date', d.toISOString());
    } catch (e) {}
  };

  const resetSimulatedDate = () => {
    const d = new Date(2026, 9, 17, 15, 47);
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
        const mins = partial.heartRate === '15min' ? 15 : partial.heartRate === '30min' ? 30 : partial.heartRate === '2h' ? 120 : 60;
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


  // État premier lancement (usine, toutes les valeurs à 0)
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vyta_first_launch');
      if (saved !== null) return saved === 'true';
    }
    return true; // Valeurs à 0 par défaut
  });

  // État appairage de la bague (Faux par défaut si premier lancement pour démarrer l'onboarding)
  const [isPaired, setIsPairedState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vyta_ring_paired_final');
      if (saved !== null) {
        return saved === 'true';
      }
      return false; // Premier lancement : non appairé -> lance le flux onboarding !
    }
    return false;
  });

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
      if (data.heartRate !== undefined && data.heartRate > 0) {
        setLiveBpm(data.heartRate);
        setWeekData((prev) => {
          const next = [...prev];
          const idx = Math.min(6, Math.max(0, selectedDay));
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.bpm = data.heartRate!;
          if (!cur.minBpm || cur.minBpm === 0 || data.heartRate! < cur.minBpm) {
            cur.minBpm = data.heartRate!;
          }
          if (!cur.maxBpm || data.heartRate! > cur.maxBpm) {
            cur.maxBpm = data.heartRate!;
          }
          if (!cur.restingBpm || cur.restingBpm === 0) {
            cur.restingBpm = data.heartRate!;
          }
          next[idx] = cur;
          try {
            localStorage.setItem('vyta_week_data', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      }
      if (data.stress !== undefined) {
        setWeekData((prev) => {
          const next = [...prev];
          const idx = Math.min(6, Math.max(0, selectedDay));
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.stress = data.stress!;
          cur.stressLevel = data.stress! < 30 ? 'Bas' : data.stress! < 60 ? 'Modéré' : 'Élevé';
          next[idx] = cur;
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
          cur.glucose = { valueMmol: data.glucose!, stabilityScore: 92 };
          next[idx] = cur;
          return next;
        });
      }
      if (data.wearCalibrationScore !== undefined) {
        updateRing({ wearCalibrationScore: data.wearCalibrationScore, wearCalibrationDate: "Aujourd'hui" });
      }
      if (data.steps !== undefined && data.steps > 0) {
        setWeekData((prev) => {
          const next = [...prev];
          const idx = Math.min(6, Math.max(0, selectedDay));
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.steps = data.steps!;
          if (data.calories && data.calories > 0) cur.activeKcal = data.calories;
          if (data.distanceKm && data.distanceKm > 0) cur.distanceKm = data.distanceKm;
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
          const deepMin = Math.round(totalMin * 0.22);
          const remMin = Math.round(totalMin * 0.20);
          const lightMin = Math.round(totalMin * 0.50);
          const awakeMin = Math.max(0, totalMin - (deepMin + remMin + lightMin));
          const score = Math.min(100, Math.round(data.sleepHours! * 12.5));
          cur.sleep = {
            score,
            deepMin,
            remMin,
            lightMin,
            awakeMin,
          };
          if (cur.pillars) {
            cur.pillars = { ...cur.pillars, sleep: score };
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

  // Données de la semaine dynamiques (Toutes les valeurs à 0 par défaut)
  const [weekData, setWeekData] = useState<DayMetrics[]>(() => {
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
    const startCleanDate = new Date(2026, 9, 15, 8, 0); // Jeudi 15 Octobre 08:00
    setSimulatedDate(startCleanDate);
    setSelectedDay(3);
    try {
      localStorage.setItem('vyta_first_launch', 'true');
      localStorage.setItem('vyta_ring_paired_final', 'false');
      localStorage.setItem('vyta_week_data', JSON.stringify(empty));
      localStorage.setItem('vyta_sensor_intervals', JSON.stringify(defaultSensorIntervals));
    } catch (e) {}
  };

  // Recharger les données de démonstration complètes
  const loadDemoData = () => {
    setIsSimulating(false);
    setSimulationHoursElapsed(0);
    setIsFirstLaunch(false);
    setIsPaired(true);
    setWeekData(weekMetrics);
    updateRing({
      isConnected: true,
      batteryRing: 87,
      sensorIntervals: defaultSensorIntervals,
    });
    setLiveBpm(62);
    const defaultDate = new Date(2026, 9, 15, 15, 47);
    setSimulatedDate(defaultDate);
    setSelectedDay(3);
    try {
      localStorage.removeItem('vyta_first_launch');
      localStorage.setItem('vyta_ring_paired_final', 'true');
      localStorage.setItem('vyta_week_data', JSON.stringify(weekMetrics));
    } catch (e) {}
  };

  // Effet d'horloge de simulation accélérée : 1 seconde = 1 heure
  useEffect(() => {
    if (!isSimulating) return;

    const timer = setInterval(() => {
      setSimulationHoursElapsed(prev => prev + 1);

      // 1. Avancer la date simulée de 1 heure
      setSimulatedDateState(prevDate => {
        const nextDate = new Date(prevDate.getTime() + 60 * 60 * 1000);
        try {
          localStorage.setItem('vyta_simulated_date', nextDate.toISOString());
        } catch (e) {}
        return nextDate;
      });

      // 2. Décharge de la batterie selon les fréquences d'échantillonnage réelles
      const fullDays = calculateEstimatedBatteryDays(sensorIntervals);
      const totalHours = fullDays * 24;
      const hourlyDrain = 100 / totalHours;

      setRing(prevRing => {
        const curBattery = prevRing.batteryRing ?? 87;
        const newBattery = Math.max(0, curBattery - hourlyDrain);
        const rounded = Math.round(newBattery * 10) / 10;
        const updated = {
          ...prevRing,
          isConnected: rounded > 0,
          batteryRing: rounded,
        };
        try {
          localStorage.setItem('vyta_ring_device', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      // 3. Accumuler l'activité biométrique sur le jour en cours
      setWeekData(prevData => {
        const next = [...prevData];
        const dayIdx = Math.min(6, Math.max(0, selectedDay));
        const cur = { ...(next[dayIdx] || weekMetrics[dayIdx]) };

        const curDate = new Date();
        const curHour = curDate.getHours();
        const isDaytime = curHour >= 7 && curHour < 22;

        if (isDaytime) {
          const stepDelta = Math.floor(250 + Math.random() * 350);
          cur.steps = (cur.steps || 0) + stepDelta;
          cur.activeKcal = (cur.activeKcal || 0) + Math.round(stepDelta * 0.045);
          cur.distanceKm = Math.round(((cur.distanceKm || 0) + (stepDelta * 0.00075)) * 10) / 10;
          cur.bpm = Math.floor(66 + Math.random() * 20);
          cur.restingBpm = cur.restingBpm || 51;
          cur.hrv = Math.floor(58 + Math.random() * 16);
          cur.spo2 = Number((98 + Math.random() * 1.5).toFixed(1));
          cur.score = Math.min(96, Math.max(45, Math.round((cur.steps / 10000) * 45 + 45)));
          cur.pillars = {
            activity: Math.min(100, Math.round((cur.steps / 10000) * 100)),
            recovery: Math.min(95, Math.max(60, cur.hrv + 15)),
            sleep: cur.sleep?.score || 80,
          };
          setLiveBpm(cur.bpm);
        } else {
          cur.bpm = Math.floor(48 + Math.random() * 6);
          cur.hrv = Math.floor(68 + Math.random() * 14);
          const deepAdd = Math.floor(8 + Math.random() * 6);
          const remAdd = Math.floor(7 + Math.random() * 6);
          const lightAdd = Math.floor(15 + Math.random() * 10);
          const prevSleep = cur.sleep || { score: 0, deepMin: 0, remMin: 0, lightMin: 0, awakeMin: 0 };
          cur.sleep = {
            deepMin: prevSleep.deepMin + deepAdd,
            remMin: prevSleep.remMin + remAdd,
            lightMin: prevSleep.lightMin + lightAdd,
            awakeMin: prevSleep.awakeMin + 2,
            score: Math.min(95, Math.max(40, Math.round(((prevSleep.deepMin + deepAdd + prevSleep.remMin + remAdd) / 180) * 100))),
          };
          cur.pillars = {
            ...cur.pillars,
            sleep: cur.sleep.score,
            recovery: Math.min(98, cur.hrv + 18),
          };
          setLiveBpm(cur.bpm);
        }

        next[dayIdx] = cur;
        try {
          localStorage.setItem('vyta_week_data', JSON.stringify(next));
        } catch (e) {}
        return next;
      });

    }, 1000);

    return () => clearInterval(timer);
  }, [isSimulating, sensorIntervals, selectedDay]);

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
        loadDemoData,
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
