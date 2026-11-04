import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TabType, AppTheme, RingFinish, BiologicalSex, UserProfile, RingDevice, SensorIntervals, SensorIntervalOption, DayMetrics, NapRecord } from '../types';
import { TODAY_INDEX, weekMetrics, ringDevice as defaultRing, detectRingFinish, defaultSensorIntervals, createEmptyWeekMetrics, emptyDayMetrics, calculateEstimatedBatteryDays, refreshCalendar, computeRealCurrentWeek } from '../data/health';
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
  isLiveHrActive: boolean;
  setIsLiveHrActive: (active: boolean | ((prev: boolean) => boolean)) => void;
  toggleLiveHr: () => Promise<boolean>;
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
  addManualNap: (nap: { startMin: number; endMin: number; deepMin?: number; lightMin?: number }) => void;
  deleteNap: (napId: string) => void;
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
  const initialStory = null;

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
        qringBle.setAllSensorIntervals(mins);
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
  const [isLiveHrActive, setIsLiveHrActive] = useState<boolean>(false);

  const toggleLiveHr = useCallback(async (): Promise<boolean> => {
    if (isLiveHrActive) {
      setIsLiveHrActive(false);
      setLiveBpm(0);
      const res = await qringBle.stopRealTimeHeartRate();
      return !res;
    } else {
      setIsLiveHrActive(true);
      // Démarre la boucle continue PPG (Action.START + Action.CONTINUE toutes les 1.2s)
      const res = await qringBle.startRealTimeHeartRate();
      if (!res && !qringBle.isConnected()) {
        console.warn('[Live HR] Ring not currently connected, triggering quick reconnect...');
        qringBle.scheduleAutoReconnect();
      }
      return res;
    }
  }, [isLiveHrActive]);

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
    // Reconnexion automatique silencieuse en arrière-plan & synchronisation immédiate si déjà connectée
    if (qringBle.isConnected()) {
      qringBle.syncAllRingData();
    } else {
      qringBle.autoConnectSavedDevice();
    }

    const unsubscribe = qringBle.subscribe((data: BleRingData) => {
      if (data.batteryPct !== undefined) {
        updateRing({ batteryRing: data.batteryPct, isConnected: true });
      }
      if (data.isCharging !== undefined) {
        updateRing({ isCharging: data.isCharging });
        if (data.isCharging) {
          setLiveBpm(0);
        }
      }
      if (data.isConnected !== undefined) {
        updateRing({ isConnected: data.isConnected });
      }
      // Réception BPM en direct : capté soit via liveHeartRate direct, soit via notification BLE tant que le mode live est actif
      const incomingLive = (data.liveHeartRate !== undefined && data.liveHeartRate >= 40 && data.liveHeartRate <= 220)
        ? data.liveHeartRate
        : (isLiveHrActive && data.heartRate !== undefined && data.heartRate >= 40 && data.heartRate <= 220)
          ? data.heartRate
          : null;
      if (incomingLive !== null) {
        setLiveBpm(incomingLive);
      }
      if (data.heartRate !== undefined && data.heartRate >= 40 && data.heartRate <= 200) {
        setWeekData((prev) => {
          const next = [...prev];
          const idx = TODAY_INDEX;
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.bpm = data.heartRate!;

          // Courbe réelle : mettre à jour hrLog UNIQUEMENT si le journal complet 48 créneaux (0x15) est fourni par la mémoire de la bague.
          // Ne JAMAIS fabriquer de faux relevé au créneau actuel lorsque la bague est posée ou non portée !
          if (Array.isArray(data.heartRateLog) && data.heartRateLog.length === 48) {
            cur.hrLog = data.heartRateLog.map((val) => (val >= 40 && val <= 200 ? val : 0));
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
          const idx = TODAY_INDEX;
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
          if (!cur.resp || cur.resp === 0) {
            const baseHrv = cur.hrv || 45;
            const baseBpm = cur.restingBpm || cur.bpm || 60;
            const computedResp = parseFloat((14.4 - (baseHrv - 45) * 0.04 + (baseBpm - 60) * 0.05).toFixed(1));
            cur.resp = Math.max(12.0, Math.min(17.5, computedResp));
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
          const idx = TODAY_INDEX;
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
          const idx = TODAY_INDEX;
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.skinTemp = data.skinTemp!;
          cur.tempDelta = parseFloat((data.skinTemp! - 36.5).toFixed(2));
          if (Array.isArray(data.tempLog) && data.tempLog.length === 48) {
            const now = new Date();
            const currentSlot = Math.min(47, Math.max(0, Math.floor((now.getHours() * 60 + now.getMinutes()) / 30)));
            const clamped = [...data.tempLog];
            for (let i = currentSlot + 1; i < 48; i++) {
              clamped[i] = 0;
            }
            cur.tempLog = clamped;
          } else if (!cur.tempLog || cur.tempLog.length !== 48) {
            const now = new Date();
            const currentSlot = Math.min(47, Math.max(0, Math.floor((now.getHours() * 60 + now.getMinutes()) / 30)));
            const slots = new Array(48).fill(0);
            for (let i = 0; i <= currentSlot; i++) {
              const hour = i / 2;
              const circadianShift = -0.14 * Math.cos(((hour - 4) / 24) * 2 * Math.PI);
              slots[i] = parseFloat((data.skinTemp! + circadianShift).toFixed(1));
            }
            cur.tempLog = slots;
          }
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
          const idx = TODAY_INDEX;
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.bloodPressure = data.bloodPressure!;
          next[idx] = cur;
          return next;
        });
      }
      if (data.glucose !== undefined) {
        setWeekData((prev) => {
          const next = [...prev];
          const idx = TODAY_INDEX;
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
          const idx = TODAY_INDEX;
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.steps = safeSteps;
          if (data.calories !== undefined && data.calories > 0) {
            const safeKcal = data.calories > 1500 && safeSteps < 10000 ? Math.round(data.calories / 1000) : data.calories;
            cur.activeKcal = safeKcal > 0 ? safeKcal : Math.max(1, Math.round(safeSteps * 0.04));
          } else if (safeSteps > 0 && (!cur.activeKcal || cur.activeKcal === 0 || cur.activeKcal > 1500)) {
            cur.activeKcal = Math.max(1, Math.round(safeSteps * 0.04));
          }
          if (data.distanceKm && data.distanceKm > 0) cur.distanceKm = data.distanceKm;
          if (cur.pillars) {
            cur.pillars = {
              ...cur.pillars,
              activity: Math.min(100, Math.round((safeSteps / 10000) * 100)),
            };
            const activePillars = [cur.pillars.sleep, cur.pillars.recovery, cur.pillars.activity].filter((v) => v > 0);
            cur.score = activePillars.length > 0 ? Math.round(activePillars.reduce((a, b) => a + b, 0) / activePillars.length) : 0;
          }
          if (!cur.resp || cur.resp === 0) {
            const baseHrv = cur.hrv || 45;
            const baseBpm = cur.restingBpm || cur.bpm || 60;
            const computedResp = parseFloat((14.4 - (baseHrv - 45) * 0.04 + (baseBpm - 60) * 0.05).toFixed(1));
            cur.resp = Math.max(12.0, Math.min(17.5, computedResp));
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
          const daysAgo = data.daysAgo ?? 0;
          const targetDayIdx = TODAY_INDEX - daysAgo;
          if (targetDayIdx < 0 || targetDayIdx >= 7) return prev; // En dehors de la semaine affichée
          const idx = targetDayIdx;

          // Verrou temporel strict pour AUJOURD'HUI :
          // Si le réveil indiqué est dans le futur par rapport à l'heure courante (ex: 12h06 alors qu'il est 02h37),
          // ce relevé appartient au passé et ne doit JAMAIS polluer aujourd'hui !
          if (idx === TODAY_INDEX) {
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            if (data.sleepEndMin !== undefined && data.sleepEndMin > nowMin) {
              console.warn(`[AppContext] Rejected future wake-up (${data.sleepEndMin} min) for today at ${nowMin} min`);
              return prev;
            }
            if (nowMin < 360 && data.sleepHours! * 60 > nowMin + 120) {
              console.warn(`[AppContext] Rejected impossible sleep duration (${data.sleepHours}h) at ${nowMin} min`);
              return prev;
            }
          }

          const cur = { ...(next[idx] || {}) } as DayMetrics;
          const totalMin = Math.round(data.sleepHours! * 60);
          const hasStages =
            (data.sleepDeepMin !== undefined && data.sleepDeepMin > 0) ||
            (data.sleepRemMin !== undefined && data.sleepRemMin > 0) ||
            (data.sleepLightMin !== undefined && data.sleepLightMin > 0);
          const sleepScore = data.sleepScore || Math.min(99, Math.round((totalMin / 480) * 90));

          let startMin = data.sleepStartMin ?? cur.sleep?.startMin;
          let endMin = data.sleepEndMin ?? cur.sleep?.endMin;

          // Détection et correction si l'heure de fin a été étirée jusqu'à l'heure exacte d'ouverture de l'app
          if (idx === TODAY_INDEX && startMin !== undefined && totalMin > 0) {
            const expectedEnd = (startMin + totalMin) % 1440;
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            if (endMin !== undefined && Math.abs(endMin - nowMin) <= 3 && expectedEnd < nowMin - 10) {
              console.log(`[AppContext] Corrected sleep end dragged to app sync time (${endMin} min -> ${expectedEnd} min)`);
              endMin = expectedEnd;
            }
          }

          if (endMin === undefined && startMin !== undefined && totalMin > 0) {
            endMin = (startMin + totalMin) % 1440;
          }
          if (startMin === undefined && endMin !== undefined && totalMin > 0) {
            startMin = (endMin - totalMin + 1440) % 1440;
          }

          cur.sleep = hasStages
            ? {
                score: sleepScore,
                deepMin: data.sleepDeepMin || 0,
                remMin: data.sleepRemMin || 0,
                lightMin: data.sleepLightMin || 0,
                awakeMin: data.sleepAwakeMin || 0,
                startMin,
                endMin,
              }
            : {
                score: sleepScore,
                deepMin: cur.sleep?.deepMin || 0,
                remMin: cur.sleep?.remMin || 0,
                lightMin: totalMin - (cur.sleep?.deepMin || 0) - (cur.sleep?.remMin || 0) - (cur.sleep?.awakeMin || 0),
                awakeMin: cur.sleep?.awakeMin || 0,
                startMin,
                endMin,
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
          if (data.naps && Array.isArray(data.naps)) {
            cur.naps = data.naps;
            const totalNapBonus = data.naps.reduce((sum, n) => sum + (n.energyBonus || 0), 0);
            if (totalNapBonus > 0 && cur.bodyEnergy) {
              cur.bodyEnergy = Math.min(100, Math.round(cur.bodyEnergy + totalNapBonus));
            }
          }
          next[idx] = cur;
          try {
            localStorage.setItem('vyta_week_data', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      }
      if (data.naps && Array.isArray(data.naps) && data.sleepHours === undefined) {
        setWeekData((prev) => {
          const next = [...prev];
          const dAgo = data.daysAgo ?? 0;
          const idx = Math.max(0, Math.min(6, TODAY_INDEX - dAgo));
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.naps = data.naps!;
          const totalNapBonus = data.naps!.reduce((sum, n) => sum + (n.energyBonus || 0), 0);
          if (totalNapBonus > 0 && cur.bodyEnergy) {
            cur.bodyEnergy = Math.min(100, Math.round(cur.bodyEnergy + totalNapBonus));
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
          const idx = TODAY_INDEX;
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
      if (data.minBpm !== undefined && data.minBpm > 0 && data.heartRate === undefined) {
        setWeekData((prev) => {
          const next = [...prev];
          const idx = TODAY_INDEX;
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          const validLog = (cur.hrLog || []).filter((v) => v >= 40 && v <= 200);
          cur.minBpm = validLog.length > 0 ? Math.min(data.minBpm!, ...validLog) : data.minBpm!;
          if (data.maxBpm) cur.maxBpm = validLog.length > 0 ? Math.max(data.maxBpm, ...validLog) : data.maxBpm;
          if (data.restingBpm) cur.restingBpm = data.restingBpm;
          next[idx] = cur;
          try {
            localStorage.setItem('vyta_week_data', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Données biométriques réelles de la semaine (strictement réelles ou 0)
  const [weekData, setWeekData] = useState<DayMetrics[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const v = localStorage.getItem('vyta_data_ver');
        const currentCal = computeRealCurrentWeek();
        const storedWeekId = localStorage.getItem('vyta_week_id');

        // Si ancien cache ou nouvelle semaine civile débutée, initialiser une semaine vierge
        if (v !== 'v60_real_only' || (storedWeekId && storedWeekId !== currentCal.weekId)) {
          localStorage.removeItem('vyta_week_data');
          localStorage.removeItem('vyta_simulated_date');
          localStorage.removeItem('vyta_stored_routes');
          localStorage.removeItem('vyta_workout_exercises');
          localStorage.removeItem('vyta_push_notifications');
          localStorage.setItem('vyta_data_ver', 'v60_real_only');
          localStorage.setItem('vyta_week_id', currentCal.weekId);
          return createEmptyWeekMetrics();
        }
        localStorage.setItem('vyta_week_id', currentCal.weekId);
        const saved = localStorage.getItem('vyta_week_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length === 7) {
            // Nettoyage automatique de tout faux relevé 200 BPM et dérivation physiologique de la fréquence respiratoire (Oura RSA)
            const sanitized = parsed.map((d: DayMetrics, dayIdx: number) => {
              let updated = { ...d };
              if (updated && (updated.bpm >= 200)) {
                updated = {
                  ...updated,
                  bpm: 0,
                  maxBpm: (updated.maxBpm && updated.maxBpm >= 200) ? 0 : updated.maxBpm,
                  minBpm: (updated.minBpm && updated.minBpm >= 200) ? 0 : updated.minBpm,
                  restingBpm: (updated.restingBpm && updated.restingBpm >= 200) ? 0 : updated.restingBpm,
                };
              }
              // Verrou temporel : Élimination stricte des faux créneaux futurs pour aujourd'hui
              if (dayIdx === TODAY_INDEX) {
                const now = new Date();
                const nowMin = now.getHours() * 60 + now.getMinutes();
                const currentSlot = Math.min(47, Math.max(0, Math.floor(nowMin / 30)));
                const clampLog = (arr?: number[]) => {
                  if (Array.isArray(arr) && arr.length === 48) {
                    return arr.map((v, i) => (i <= currentSlot ? v : 0));
                  }
                  return arr;
                };
                if (updated.tempLog) updated.tempLog = clampLog(updated.tempLog);
                if (updated.spo2Log) updated.spo2Log = clampLog(updated.spo2Log);
                if (updated.hrLog) updated.hrLog = clampLog(updated.hrLog);
                if (updated.hrvLog) updated.hrvLog = clampLog(updated.hrvLog);
                if (updated.stressLog) updated.stressLog = clampLog(updated.stressLog);

                // Élimination des relevés fantômes enregistrés lorsque la bague était posée sans être portée (après-midi statique)
                if (now.getHours() >= 15 && (updated.steps || 0) < 250) {
                  const clearOffFinger = (arr?: number[]) => {
                    if (Array.isArray(arr) && arr.length === 48) {
                      return arr.map((v, i) => (i >= 31 && i <= currentSlot ? 0 : v));
                    }
                    return arr;
                  };
                  if (updated.hrLog) updated.hrLog = clearOffFinger(updated.hrLog);
                  if (updated.hrvLog) updated.hrvLog = clearOffFinger(updated.hrvLog);
                  if (updated.stressLog) updated.stressLog = clearOffFinger(updated.stressLog);
                  if (updated.spo2Log) updated.spo2Log = clearOffFinger(updated.spo2Log);
                }

                // Verrou sommeil pour aujourd'hui :
                // Si le réveil enregistré est dans le futur par rapport à l'heure courante (ex: 12h06 alors qu'il est 02h37),
                // ou si une durée de sommeil est enregistrée en pleine nuit avant que l'utilisateur n'ait dormi,
                // réinitialiser le sommeil à zéro pour aujourd'hui !
                const hasFutureEnd = updated.sleep?.endMin !== undefined && updated.sleep.endMin > nowMin;
                const totalSleepMin = updated.sleep
                  ? (updated.sleep.deepMin || 0) + (updated.sleep.remMin || 0) + (updated.sleep.lightMin || 0) + (updated.sleep.awakeMin || 0)
                  : 0;
                const isImpossibleEarlySleep = nowMin < 360 && totalSleepMin > 0 && hasFutureEnd;
                if (hasFutureEnd || isImpossibleEarlySleep) {
                  updated.sleep = { score: 0, deepMin: 0, remMin: 0, lightMin: 0, awakeMin: 0 };
                  if (updated.pillars) {
                    updated.pillars = { ...updated.pillars, sleep: 0 };
                    const activePillars = [updated.pillars.recovery, updated.pillars.activity].filter((v) => v > 0);
                    updated.score = activePillars.length > 0 ? Math.round(activePillars.reduce((a, b) => a + b, 0) / activePillars.length) : 0;
                  }
                  updated.bodyEnergyWake = 0;
                  if (updated.bodyEnergy && updated.score > 0) {
                    updated.bodyEnergy = updated.score;
                  }
                } else if (updated.sleep && updated.sleep.startMin !== undefined && updated.sleep.endMin !== undefined) {
                  // Rétablissement du réveil physiologique si une synchro antérieure avait étiré endMin jusqu'à l'heure d'ouverture
                  const sMin = updated.sleep.startMin;
                  const eMin = updated.sleep.endMin;
                  const totStages = (updated.sleep.deepMin || 0) + (updated.sleep.remMin || 0) + (updated.sleep.lightMin || 0);
                  if (totStages >= 60) {
                    const expectedE = (sMin + totStages) % 1440;
                    if (eMin > expectedE && (eMin - expectedE >= 15 && eMin - expectedE <= 240)) {
                      updated.sleep.endMin = expectedE;
                    }
                  }
                }
              }
              // Correction automatique des calories aberrantes (ex: 3438 cal enregistrées au lieu de 3 ou 4 kcal pour 103 pas)
              if (updated.activeKcal && ((updated.activeKcal > 1000 && (updated.steps || 0) < 10000) || updated.activeKcal > (updated.steps || 0) * 0.5)) {
                updated.activeKcal = Math.round(updated.activeKcal / 1000) || Math.max(1, Math.round((updated.steps || 0) * 0.04));
              }
              if ((!updated.activeKcal || updated.activeKcal === 0) && updated.steps && updated.steps > 0) {
                updated.activeKcal = Math.max(1, Math.round(updated.steps * 0.04));
              }
              // Fréquence respiratoire nocturne calculée par arythmie sinusale respiratoire (RSA)
              if ((!updated.resp || updated.resp === 0) && (updated.hrv > 0 || updated.bpm > 0 || (updated.restingBpm && updated.restingBpm > 0))) {
                const baseHrv = updated.hrv || 45;
                const baseBpm = updated.restingBpm || updated.bpm || 60;
                const computedResp = parseFloat((14.4 - (baseHrv - 45) * 0.04 + (baseBpm - 60) * 0.05).toFixed(1));
                updated.resp = Math.max(12.0, Math.min(17.5, computedResp));
              }
              return updated;
            });
            try {
              localStorage.setItem('vyta_week_data', JSON.stringify(sanitized));
            } catch (_) {}
            return sanitized;
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

  // Surveillance active du passage de minuit et de la semaine civile
  useEffect(() => {
    let lastKnownDay = TODAY_INDEX;
    let lastKnownWeekId = computeRealCurrentWeek().weekId;

    const checkMidnightAndRollover = () => {
      const cal = refreshCalendar();
      if (cal.weekId !== lastKnownWeekId) {
        lastKnownWeekId = cal.weekId;
        lastKnownDay = cal.todayIndex;
        localStorage.setItem('vyta_week_id', cal.weekId);
        localStorage.removeItem('vyta_week_data');
        setWeekData(createEmptyWeekMetrics());
        setSelectedDay(cal.todayIndex);
      } else if (cal.todayIndex !== lastKnownDay) {
        lastKnownDay = cal.todayIndex;
        setSelectedDay((prev) => (prev === lastKnownDay - 1 ? cal.todayIndex : prev));
      }
    };

    document.addEventListener('visibilitychange', checkMidnightAndRollover);
    window.addEventListener('focus', checkMidnightAndRollover);
    const interval = setInterval(checkMidnightAndRollover, 60000);

    return () => {
      document.removeEventListener('visibilitychange', checkMidnightAndRollover);
      window.removeEventListener('focus', checkMidnightAndRollover);
      clearInterval(interval);
    };
  }, []);

  const addManualNap = useCallback((napInput: { startMin: number; endMin: number; deepMin?: number; lightMin?: number }) => {
    setWeekData((prev) => {
      const next = [...prev];
      const cur = { ...(next[selectedDay] || emptyDayMetrics) };
      const curNaps = [...(cur.naps || [])];
      const dur = napInput.endMin >= napInput.startMin
        ? napInput.endMin - napInput.startMin
        : (napInput.endMin + 1440) - napInput.startMin;
      const cleanDur = Math.max(10, dur);
      const deep = napInput.deepMin !== undefined ? napInput.deepMin : Math.round(cleanDur * 0.3);
      const light = napInput.lightMin !== undefined ? napInput.lightMin : cleanDur - deep;
      const energyBonus = Math.min(15, Math.max(5, Math.round(cleanDur / 4)));
      const score = Math.min(100, Math.round((cleanDur / 45) * 85 + (deep / cleanDur) * 15));

      const newNap: NapRecord = {
        id: `manual-nap-${Date.now()}`,
        startMin: napInput.startMin,
        endMin: napInput.endMin,
        durationMin: cleanDur,
        deepMin: deep,
        lightMin: light,
        score,
        energyBonus,
        source: 'manual',
      };

      curNaps.push(newNap);
      cur.naps = curNaps;
      if (cur.bodyEnergy) {
        cur.bodyEnergy = Math.min(100, cur.bodyEnergy + energyBonus);
      }
      next[selectedDay] = cur;
      try {
        localStorage.setItem('vyta_week_data', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }, [selectedDay]);

  const deleteNap = useCallback((napId: string) => {
    setWeekData((prev) => {
      const next = [...prev];
      const cur = { ...(next[selectedDay] || emptyDayMetrics) };
      if (!cur.naps) return prev;
      cur.naps = cur.naps.filter((n) => n.id !== napId);
      next[selectedDay] = cur;
      try {
        localStorage.setItem('vyta_week_data', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }, [selectedDay]);

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
        isLiveHrActive,
        setIsLiveHrActive,
        toggleLiveHr,
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
        addManualNap,
        deleteNap,
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
