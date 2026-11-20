import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TabType, AppTheme, RingFinish, BiologicalSex, UserProfile, RingDevice, SensorIntervals, SensorIntervalOption, DayMetrics, NapRecord } from '../types';
import { TODAY_INDEX, weekMetrics, ringDevice as defaultRing, detectRingFinish, defaultSensorIntervals, createEmptyWeekMetrics, emptyDayMetrics, calculateEstimatedBatteryDays, refreshCalendar, computeRealCurrentWeek, toLocalDateKey } from '../data/health';
import { checkWarrantyForEmail } from '../lib/warrantyService';
import { dispatchApplePush, requestBrowserNotificationPermission } from '../lib/apnsService';
import { Language, TranslationKey, getTranslation, detectDefaultLanguage } from '../lib/i18n';
import { qringBle, BleRingData } from '../lib/qringBleService';
import { buildSleepSummary } from '../lib/sleepAlgorithm';
import { computeImmunityAnomaly } from '../lib/immunityRadar';

/**
 * Synchronise de façon cohérente l'Énergie Corporelle (au réveil, actuelle, prévue au coucher)
 * à partir des vraies données de la bague (sommeil, VFC, stress, activité, siestes).
 */
function syncBodyEnergy(cur: DayMetrics, isToday: boolean): void {
  const sleepScore = cur.pillars?.sleep || cur.sleep?.score || 0;
  const recoveryScore = cur.pillars?.recovery || 0;
  const stressVal = cur.stressAvg || cur.stress || 0;
  const stressRecovery = stressVal > 0 ? Math.max(10, Math.min(100, 100 - stressVal + 14)) : 0;

  const hasAnySignal =
    sleepScore > 0 ||
    recoveryScore > 0 ||
    stressRecovery > 0 ||
    (cur.steps || 0) > 0 ||
    (cur.naps?.length || 0) > 0;

  if (!hasAnySignal) {
    cur.bodyEnergy = 0;
    cur.bodyEnergyWake = 0;
    cur.bodyEnergyBedtime = 0;
    return;
  }

  const effectiveRecovery = recoveryScore > 0 ? recoveryScore : stressRecovery;
  let wake = 0;
  if (sleepScore > 0 && effectiveRecovery > 0) {
    wake = Math.round(sleepScore * 0.65 + effectiveRecovery * 0.35);
  } else if (sleepScore > 0) {
    wake = sleepScore;
  } else if (effectiveRecovery > 0) {
    wake = effectiveRecovery;
  } else {
    wake = cur.score > 0 ? cur.score : 50;
  }
  wake = Math.max(10, Math.min(100, wake));
  cur.bodyEnergyWake = wake;

  const activityDrain = Math.min(
    45,
    Math.round((cur.activeKcal || 0) / 30 + (cur.steps || 0) / 1000)
  );
  const stressDrain = stressVal > 45 ? Math.min(18, Math.round((stressVal - 45) * 0.45)) : 0;
  const napBonus = (cur.naps || []).reduce((sum, n) => sum + (n.energyBonus || 0), 0);

  const currentEnergy = Math.max(5, Math.min(100, wake - activityDrain - stressDrain + napBonus));
  cur.bodyEnergy = currentEnergy;

  if (isToday) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const bedtimeMin = 23 * 60;
    const remainingHours = Math.max(0, (bedtimeMin - nowMin) / 60);
    const hourlyBurn = stressVal > 50 ? 2.7 : 2.1;
    const projectedDrain = Math.round(remainingHours * hourlyBurn);
    cur.bodyEnergyBedtime = Math.max(5, Math.min(currentEnergy, currentEnergy - projectedDrain));
  } else {
    cur.bodyEnergyBedtime = Math.max(5, Math.min(currentEnergy, currentEnergy - 6));
  }
}

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
  modal: 'settings' | 'healthkit' | 'notifications' | 'pairing' | 'general_state' | 'find_my' | 'prism' | 'nap' | 'calai' | null;
  openModal: (modal: 'settings' | 'healthkit' | 'notifications' | 'pairing' | 'general_state' | 'find_my' | 'prism' | 'nap' | 'calai', extraPreset?: 'power' | 'restful' | 'cycle') => void;
  closeModal: () => void;
  initialNapPreset: 'power' | 'restful' | 'cycle';
  metricDetail: 'bpm' | 'hrv' | 'temp' | 'spo2' | 'resp' | 'stress' | 'bp' | 'glucose' | null;
  openMetricDetail: (metric: 'bpm' | 'hrv' | 'temp' | 'spo2' | 'resp' | 'stress' | 'bp' | 'glucose') => void;
  closeMetricDetail: () => void;
  storyData: any | null;
  openStory: (data: any) => void;
  closeStory: () => void;
  selectedDay: number;
  setSelectedDay: (day: number) => void;
  selectedDateKey: string;
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
  addManualNap: (nap: { startMin: number; endMin: number; deepMin?: number; lightMin?: number; remMin?: number; napType?: 'power' | 'restful' | 'cycle' | 'custom' }) => void;
  deleteNap: (napId: string) => void;
  updateSleepSession: (dayIndex: number, startMin: number, endMin: number) => void;
  weekData: DayMetrics[];
  setWeekData: React.Dispatch<React.SetStateAction<DayMetrics[]>>;
  weekOffset: number;
  setWeekOffset: React.Dispatch<React.SetStateAction<number>>;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToCurrentWeek: () => void;
  weekDays: { short: string; long: string; date: number; month: string; dateKey: string }[];
  weekRangeLabel: string;
  todayIndex: number;
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
  const initialCovyta = params?.get('covyta') === '0' ? false : true;
  const initialSex = (params?.get('sex') as BiologicalSex) || (typeof window !== 'undefined' && localStorage.getItem('vyta_sex') === 'homme' ? 'homme' : 'femme');
  const initialModal = (params?.get('modal') as 'settings' | 'healthkit' | 'notifications' | 'pairing' | 'general_state' | null) || null;
  const initialMetric = (params?.get('metric') as 'bpm' | 'hrv' | 'temp' | 'spo2' | 'resp' | null) || null;
  const initialStory = null;

  const initialDay = params?.get('day') ? parseInt(params.get('day')!, 10) : TODAY_INDEX;

  const [tab, setTab] = useState<TabType>(initialTab);
  const [covytaActive, setCovytaActive] = useState<boolean>(initialCovyta);
  const [selectedDay, setSelectedDay] = useState<number>(initialDay);
  const [finish, setFinishState] = useState<RingFinish>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vyta_ring_finish') as RingFinish | null;
        if (saved === 'champagne' || saved === 'gunmetal' || saved === 'silver' || saved === 'rose') {
          return saved;
        }
      } catch (_) {}
    }
    return detectRingFinish(defaultRing.macAddress, defaultRing.serial);
  });
  const setFinish = useCallback((nextFinish: RingFinish) => {
    setFinishState(nextFinish);
    try {
      localStorage.setItem('vyta_ring_finish', nextFinish);
    } catch (_) {}
  }, []);
  const [modal, setModal] = useState<'settings' | 'healthkit' | 'notifications' | 'pairing' | 'general_state' | 'find_my' | 'prism' | 'nap' | 'calai' | null>(initialModal as any);
  const [initialNapPreset, setInitialNapPreset] = useState<'power' | 'restful' | 'cycle'>('power');
  const [metricDetail, setMetricDetail] = useState<'bpm' | 'hrv' | 'temp' | 'spo2' | 'resp' | 'stress' | 'bp' | 'glucose' | null>(initialMetric);
  const [storyData, setStoryData] = useState<any | null>(initialStory);
  const [ring, setRing] = useState<RingDevice>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vyta_ring_device');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...defaultRing,
            ...parsed,
            // Toujours initialiser déconnectée à chaque ouverture tant que le BLE n'est pas actif
            isConnected: false,
            aurelCareActive: false,
            aurelCareExpires: '',
          };
        }
      } catch (e) {}
    }
    return defaultRing;
  });

  // Vérification réelle de la garantie Aurel Care selon l'e-mail du compte
  useEffect(() => {
    let active = true;
    checkWarrantyForEmail().then((w) => {
      if (!active) return;
      updateRing({
        aurelCareActive: w.active,
        aurelCareExpires: w.expiresAt || '',
      });
    });
    return () => {
      active = false;
    };
  }, []);

  // Auto-adapt ring finish from hardware IDs only if user has not manually chosen a finish
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vyta_ring_finish');
      if (saved === 'champagne' || saved === 'gunmetal' || saved === 'silver' || saved === 'rose') {
        return;
      }
    } catch (_) {}
    const autoFinish = detectRingFinish(ring.macAddress, ring.serial);
    setFinishState(autoFinish);
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
            if (val === '15min' || val === '30min' || val === '1h' || val === '2h' || val === 'pause') return val;
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
      const hr = partial.heartRate || next.heartRate;
      const mins = hr === '30min' ? 30 : hr === '1h' ? 60 : hr === 'pause' ? 0 : 60;
      qringBle.setAllSensorIntervals(mins, true);
      try {
        localStorage.setItem('vyta_sensor_intervals', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  useEffect(() => {
    const mins = sensorIntervals?.heartRate === '30min' ? 30 : sensorIntervals?.heartRate === '1h' ? 60 : sensorIntervals?.heartRate === 'pause' ? 0 : 60;
    qringBle.setAllSensorIntervals(mins, false);
  }, []);


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
  const lastLiveBpmAtRef = useRef<number>(0);
  const [isLiveHrActive, setIsLiveHrActive] = useState<boolean>(false);
  const isLiveHrActiveRef = useRef<boolean>(false);
  useEffect(() => {
    isLiveHrActiveRef.current = isLiveHrActive;
  }, [isLiveHrActive]);

  // Expirer un liveBpm figé si aucun nouveau paquet BLE n'arrive (évite un BPM bloqué pendant plusieurs minutes)
  useEffect(() => {
    if (liveBpm <= 0) return;
    const watchdog = setInterval(() => {
      const staleMs = Date.now() - lastLiveBpmAtRef.current;
      const streamActive = isLiveHrActiveRef.current || qringBle.isRealTimeHeartRateActive();
      if (!qringBle.isConnected() || (!streamActive && staleMs > 12000) || (streamActive && staleMs > 22000)) {
        setLiveBpm(0);
      }
    }, 3000);
    return () => clearInterval(watchdog);
  }, [liveBpm]);

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
      updateRing({ isConnected: true });
      qringBle.syncAllRingData();
    } else {
      updateRing({ isConnected: false });
      qringBle.autoConnectSavedDevice();
    }

    const unsubscribe = qringBle.subscribe((data: BleRingData) => {
      if (data.batteryPct !== undefined) {
        updateRing({ batteryRing: data.batteryPct, isConnected: true });
      }
      if (data.serialNumber || data.firmwareVersion || data.macAddress) {
        updateRing({
          ...(data.serialNumber ? { serial: data.serialNumber } : {}),
          ...(data.firmwareVersion ? { firmware: data.firmwareVersion } : {}),
          ...(data.macAddress ? { macAddress: data.macAddress } : {}),
        });
      }
      if (data.isCharging !== undefined) {
        updateRing({ isCharging: data.isCharging });
        if (data.isCharging) {
          setLiveBpm(0);
        }
      }
      if (data.isConnected !== undefined) {
        updateRing({ isConnected: data.isConnected });
        if (!data.isConnected) {
          setLiveBpm(0);
        }
      }
      // Réception BPM en direct : capté soit via liveHeartRate direct, soit dès que le mode live est actif sur la bague ou dans l'app
      const isLiveActive = isLiveHrActiveRef.current || qringBle.isRealTimeHeartRateActive();
      const incomingLive = (data.liveHeartRate !== undefined && data.liveHeartRate >= 40 && data.liveHeartRate <= 220)
        ? data.liveHeartRate
        : (isLiveActive && data.heartRate !== undefined && data.heartRate >= 40 && data.heartRate <= 220)
          ? data.heartRate
          : null;
      if (incomingLive !== null) {
        lastLiveBpmAtRef.current = Date.now();
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
          } else {
            const now = new Date();
            const rawSlot = Math.min(47, Math.max(0, Math.floor((now.getHours() * 60 + now.getMinutes()) / 30)));
            const isHourlyPref = qringBle.getConfiguredIntervalMinutes() >= 60;
            const currentSlot = isHourlyPref ? Math.floor(rawSlot / 2) * 2 : rawSlot;
            const log = Array.isArray(cur.hrvLog) && cur.hrvLog.length === 48 ? [...cur.hrvLog] : new Array(48).fill(0);
            log[currentSlot] = data.hrv!;
            cur.hrvLog = log;
          }
          if (cur.pillars) {
            const recScore = Math.min(100, Math.max(20, Math.round(50 + (data.hrv! - 30) * 0.9)));
            cur.pillars = { ...cur.pillars, recovery: recScore };
            const activePillars = [cur.pillars.sleep, cur.pillars.recovery, cur.pillars.activity].filter((v) => v > 0);
            cur.score = activePillars.length > 0 ? Math.round(activePillars.reduce((a, b) => a + b, 0) / activePillars.length) : 0;
          }
          const sleptMin = (cur.sleep?.deepMin || 0) + (cur.sleep?.remMin || 0) + (cur.sleep?.lightMin || 0);
          if (sleptMin >= 60 && (!cur.resp || cur.resp === 0)) {
            const baseHrv = cur.hrv || 45;
            const baseBpm = cur.restingBpm || cur.bpm || 60;
            const computedResp = parseFloat((14.4 - (baseHrv - 45) * 0.04 + (baseBpm - 60) * 0.05).toFixed(1));
            cur.resp = Math.max(12.0, Math.min(17.5, computedResp));
          }
          syncBodyEnergy(cur, true);
          next[idx] = cur;
          cur.anomaly = computeImmunityAnomaly(cur, next, idx);
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
          }
          syncBodyEnergy(cur, true);
          next[idx] = cur;
          cur.anomaly = computeImmunityAnomaly(cur, next, idx);
          try {
            localStorage.setItem('vyta_week_data', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      }
      if (data.skinTemp !== undefined && data.skinTemp >= 30 && data.skinTemp <= 43) {
        setWeekData((prev) => {
          const next = [...prev];
          const daysAgo = data.daysAgo ?? 0;
          const idx = Math.max(0, Math.min(6, TODAY_INDEX - daysAgo));
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          cur.skinTemp = data.skinTemp!;
          cur.tempDelta = parseFloat((data.skinTemp! - 36.5).toFixed(2));
          if (Array.isArray(data.tempLog) && data.tempLog.length === 48) {
            const now = new Date();
            const currentSlot = daysAgo === 0
              ? Math.min(47, Math.max(0, Math.floor((now.getHours() * 60 + now.getMinutes()) / 30)))
              : 47;
            const clamped = [...data.tempLog];
            for (let i = currentSlot + 1; i < 48; i++) {
              clamped[i] = 0;
            }
            cur.tempLog = clamped;
          } else {
            const now = new Date();
            const rawSlot = daysAgo === 0
              ? Math.min(47, Math.max(0, Math.floor((now.getHours() * 60 + now.getMinutes()) / 30)))
              : 46;
            const isHourlyPref = qringBle.getConfiguredIntervalMinutes() >= 60;
            const currentSlot = isHourlyPref ? Math.floor(rawSlot / 2) * 2 : rawSlot;
            const slots = Array.isArray(cur.tempLog) && cur.tempLog.length === 48 ? [...cur.tempLog] : new Array(48).fill(0);
            slots[currentSlot] = parseFloat(data.skinTemp!.toFixed(1));
            cur.tempLog = slots;
          }
          cur.anomaly = computeImmunityAnomaly(cur, next, idx);
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
      if (
        (data.steps !== undefined && data.steps >= 0 && (data.steps > 0 || data.stepsAuthoritative)) ||
        (Array.isArray(data.stepsHourly) && data.stepsHourly.some((v) => v > 0))
      ) {
        // Guard & auto-repair if a 24-bit Little-Endian step value (> 120000) ever arrives
        const rawSteps = data.steps ?? 0;
        const safeSteps = rawSteps > 120000
          ? (((rawSteps & 0xFF) << 16) | (rawSteps & 0xFF00) | ((rawSteps >> 16) & 0xFF))
          : rawSteps;
        const daysAgo = data.daysAgo ?? 0;
        setWeekData((prev) => {
          const next = [...prev];
          const idx = TODAY_INDEX - daysAgo;
          if (idx < 0 || idx >= 7) return prev;
          const cur = { ...(next[idx] || {}) } as DayMetrics;
          const prevSteps = cur.steps || 0;
          const nextSteps = data.stepsAuthoritative
            ? safeSteps
            : safeSteps > 0
            ? (prevSteps > 0 ? Math.max(prevSteps, safeSteps) : safeSteps)
            : prevSteps;
          cur.steps = nextSteps;

          if (Array.isArray(data.stepsHourly) && data.stepsHourly.length === 24 && data.stepsHourly.some((v) => v > 0)) {
            cur.stepsHourly = data.stepsHourly;
          } else if (data.stepsAuthoritative && nextSteps === 0) {
            cur.stepsHourly = new Array(24).fill(0);
          } else if (data.stepsAuthoritative && nextSteps < prevSteps) {
            const hourlySum = Array.isArray(cur.stepsHourly)
              ? cur.stepsHourly.reduce((s, v) => s + (v || 0), 0)
              : 0;
            if (hourlySum > nextSteps + 100) {
              const resetHourly = new Array(24).fill(0);
              if (daysAgo === 0 && nextSteps > 0) {
                resetHourly[new Date().getHours()] = nextSteps;
              }
              cur.stepsHourly = resetHourly;
            }
          } else if (daysAgo === 0 && prevSteps > 0 && nextSteps > prevSteps && nextSteps - prevSteps <= 2000) {
            const curHour = new Date().getHours();
            const hourly = Array.isArray(cur.stepsHourly) && cur.stepsHourly.length === 24
              ? [...cur.stepsHourly]
              : new Array(24).fill(0);
            hourly[curHour] = (hourly[curHour] || 0) + (nextSteps - prevSteps);
            cur.stepsHourly = hourly;
          }

          if (data.calories !== undefined && (data.calories > 0 || (data.stepsAuthoritative && nextSteps === 0))) {
            const safeKcal = data.calories > 1500 && nextSteps < 10000 ? Math.round(data.calories / 1000) : data.calories;
            cur.activeKcal = nextSteps === 0 ? 0 : safeKcal > 0 ? safeKcal : Math.max(1, Math.round(nextSteps * 0.04));
          } else if (nextSteps > 0 && (!cur.activeKcal || cur.activeKcal === 0 || cur.activeKcal > 1500 || (data.stepsAuthoritative && nextSteps < prevSteps))) {
            cur.activeKcal = Math.max(1, Math.round(nextSteps * 0.04));
          } else if (data.stepsAuthoritative && nextSteps === 0) {
            cur.activeKcal = 0;
          }
          if (data.distanceKm && data.distanceKm > 0) {
            cur.distanceKm = data.distanceKm;
          } else if (data.stepsAuthoritative && nextSteps < prevSteps) {
            cur.distanceKm = nextSteps === 0 ? 0 : parseFloat(((nextSteps * 0.72) / 1000).toFixed(2));
          }
          if (cur.pillars) {
            cur.pillars = {
              ...cur.pillars,
              activity: Math.min(100, Math.round((nextSteps / 10000) * 100)),
            };
            const activePillars = [cur.pillars.sleep, cur.pillars.recovery, cur.pillars.activity].filter((v) => v > 0);
            cur.score = activePillars.length > 0 ? Math.round(activePillars.reduce((a, b) => a + b, 0) / activePillars.length) : 0;
          }
          const sleptMin = (cur.sleep?.deepMin || 0) + (cur.sleep?.remMin || 0) + (cur.sleep?.lightMin || 0);
          if (sleptMin >= 60 && (!cur.resp || cur.resp === 0)) {
            const baseHrv = cur.hrv || 45;
            const baseBpm = cur.restingBpm || cur.bpm || 60;
            const computedResp = parseFloat((14.4 - (baseHrv - 45) * 0.04 + (baseBpm - 60) * 0.05).toFixed(1));
            cur.resp = Math.max(12.0, Math.min(17.5, computedResp));
          }
          syncBodyEnergy(cur, true);
          next[idx] = cur;
          cur.anomaly = computeImmunityAnomaly(cur, next, idx);
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
          // 1) En pleine nuit avant 6h du matin (nowMin < 360), l'utilisateur est éveillé et la nuit n'est pas terminée.
          //    Aucun relevé nocturne ne doit être validé ou attribué à aujourd'hui !
          // 2) Si le réveil indiqué est dans le futur par rapport à l'heure courante, rejet immédiat.
          if (idx === TODAY_INDEX) {
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            if (nowMin < 360) {
              console.warn(`[AppContext] Rejected premature sleep during the night (< 6h00) at ${nowMin} min`);
              return prev;
            }
            if (data.sleepEndMin !== undefined && data.sleepEndMin > nowMin) {
              console.warn(`[AppContext] Rejected future wake-up (${data.sleepEndMin} min) for today at ${nowMin} min`);
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
          }
          if (data.naps && Array.isArray(data.naps)) {
            cur.naps = data.naps;
          }
          syncBodyEnergy(cur, idx === TODAY_INDEX);
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
          syncBodyEnergy(cur, idx === TODAY_INDEX);
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
          } else {
            const now = new Date();
            const rawSlot = Math.min(47, Math.max(0, Math.floor((now.getHours() * 60 + now.getMinutes()) / 30)));
            const isHourlyPref = qringBle.getConfiguredIntervalMinutes() >= 60;
            const currentSlot = isHourlyPref ? Math.floor(rawSlot / 2) * 2 : rawSlot;
            const log = Array.isArray(cur.spo2Log) && cur.spo2Log.length === 48 ? [...cur.spo2Log] : new Array(48).fill(0);
            log[currentSlot] = data.spo2!;
            cur.spo2Log = log;
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

  // Gestion de l'historique multi-semaines
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [calendarEpoch, setCalendarEpoch] = useState<number>(0);

  const currentBaseDate = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset, calendarEpoch]);

  const currentWeekCalendar = React.useMemo(() => {
    return computeRealCurrentWeek(currentBaseDate);
  }, [currentBaseDate]);

  const todayIndex = weekOffset === 0 ? currentWeekCalendar.todayIndex : -1;
  const weekDays = currentWeekCalendar.week;
  const selectedDateKey = React.useMemo(() => {
    const clampedIdx = Math.max(0, Math.min(6, selectedDay));
    return weekDays[clampedIdx]?.dateKey || toLocalDateKey();
  }, [weekDays, selectedDay]);

  const weekRangeLabel = React.useMemo(() => {
    const d = new Date(currentBaseDate);
    const dayIdx = (d.getDay() + 6) % 7;
    const mon = new Date(d);
    mon.setDate(d.getDate() - dayIdx);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);

    const isEn = language === 'en';
    const mD = mon.getDate();
    const mM = mon.toLocaleDateString(isEn ? 'en-US' : 'fr-FR', { month: 'short' });
    const sD = sun.getDate();
    const sM = sun.toLocaleDateString(isEn ? 'en-US' : 'fr-FR', { month: 'short' });
    const rangeStr = mM === sM ? `${mD} – ${sD} ${mM}` : `${mD} ${mM} – ${sD} ${sM}`;

    if (weekOffset === 0) {
      return isEn ? `This week • ${rangeStr}` : `Cette semaine • ${rangeStr}`;
    }
    if (weekOffset === -1) {
      return isEn ? `Last week • ${rangeStr}` : `Semaine passée • ${rangeStr}`;
    }
    return isEn ? `Week of ${mM} ${mD} • ${rangeStr}` : `Semaine du ${mD} ${mM} • ${rangeStr}`;
  }, [currentBaseDate, weekOffset, language]);

  const goToPreviousWeek = useCallback(() => {
    setWeekOffset((prev) => prev - 1);
  }, []);

  const goToNextWeek = useCallback(() => {
    setWeekOffset((prev) => Math.min(0, prev + 1));
  }, []);

  const goToCurrentWeek = useCallback(() => {
    setWeekOffset(0);
    setSelectedDay(TODAY_INDEX);
  }, []);

  // Données biométriques réelles de la semaine (strictement réelles ou 0)
  const [weekData, setWeekData] = useState<DayMetrics[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const v = localStorage.getItem('vyta_data_ver');
        const currentCal = computeRealCurrentWeek();
        const storedWeekId = localStorage.getItem('vyta_week_id');

        // Si nouvelle semaine civile débutée, archiver la semaine précédente
        if (storedWeekId && storedWeekId !== currentCal.weekId) {
          const prevData = localStorage.getItem('vyta_week_data');
          if (prevData) {
            localStorage.setItem(`vyta_week_${storedWeekId}`, prevData);
          }
          localStorage.removeItem('vyta_week_data');
          localStorage.setItem('vyta_week_id', currentCal.weekId);
        }
        if (v !== 'v60_real_only') {
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

                // Verrou sommeil strict pour AUJOURD'HUI :
                // 1) En pleine nuit avant 6h du matin (nowMin < 360), l'utilisateur n'a pas dormi / nuit non terminée :
                //    toute session nocturne antérieurement persistée dans localStorage (ex: 00:00 -> 03:00 ou 00:00 -> 03:30) est immédiatement purgée à 0 !
                // 2) Si le réveil enregistré est dans le futur par rapport à l'heure courante (endMin > nowMin), purge immédiate.
                const hasFutureEnd = updated.sleep?.endMin !== undefined && updated.sleep.endMin > nowMin;
                const hasPhantomNocturnalSleep = nowMin < 360 && ((updated.sleep?.score || 0) > 0 || (updated.sleep?.startMin === 0 && (updated.sleep?.endMin || 0) > 0));

                if (hasFutureEnd || hasPhantomNocturnalSleep) {
                  updated.sleep = { score: 0, deepMin: 0, remMin: 0, lightMin: 0, awakeMin: 0 };
                  if (updated.pillars) {
                    updated.pillars = { ...updated.pillars, sleep: 0 };
                    const activePillars = [updated.pillars.recovery, updated.pillars.activity].filter((v) => v > 0);
                    updated.score = activePillars.length > 0 ? Math.round(activePillars.reduce((a, b) => a + b, 0) / activePillars.length) : 0;
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
              syncBodyEnergy(updated, dayIdx === TODAY_INDEX);
              return updated;
            });
            sanitized.forEach((d, dayIdx) => {
              d.anomaly = computeImmunityAnomaly(d, sanitized, dayIdx);
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

  const loadedWeekIdRef = useRef<string>(currentWeekCalendar.weekId);
  const skipNextSaveRef = useRef<boolean>(false);

  // Met à jour le calendrier global dans health.ts et charge la semaine correspondante lors d'un changement de semaine
  useEffect(() => {
    refreshCalendar(currentBaseDate, weekOffset < 0);
    const targetWeekId = currentWeekCalendar.weekId;
    if (loadedWeekIdRef.current === targetWeekId) return;

    const weekKey = `vyta_week_${targetWeekId}`;
    let nextData: DayMetrics[] | null = null;
    try {
      const saved = localStorage.getItem(weekKey);
      if (saved) {
        nextData = JSON.parse(saved);
      } else if (weekOffset === 0) {
        const legacy = localStorage.getItem('vyta_week_data');
        if (legacy) {
          nextData = JSON.parse(legacy);
        }
      }
    } catch (_) {}

    loadedWeekIdRef.current = targetWeekId;
    skipNextSaveRef.current = true;
    setWeekData(nextData || createEmptyWeekMetrics());
  }, [weekOffset, currentWeekCalendar.weekId, currentBaseDate]);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (loadedWeekIdRef.current !== currentWeekCalendar.weekId) return;
    if (typeof window !== 'undefined') {
      try {
        const weekKey = `vyta_week_${currentWeekCalendar.weekId}`;
        localStorage.setItem(weekKey, JSON.stringify(weekData));
        if (weekOffset === 0) {
          localStorage.setItem('vyta_week_data', JSON.stringify(weekData));
        }
      } catch (_) {}
    }
  }, [weekData, currentWeekCalendar.weekId, weekOffset]);

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
    setWeekOffset(0);
    setSelectedDay(TODAY_INDEX);
    try {
      localStorage.setItem('vyta_first_launch', 'true');
      localStorage.setItem('vyta_ring_paired_final', 'false');
      localStorage.setItem('vyta_week_data', JSON.stringify(empty));
      localStorage.setItem('vyta_sensor_intervals', JSON.stringify(defaultSensorIntervals));
    } catch (e) {}
  };

  const openModal = useCallback((
    m: 'settings' | 'healthkit' | 'notifications' | 'pairing' | 'general_state' | 'find_my' | 'prism' | 'nap' | 'calai',
    extraPreset?: 'power' | 'restful' | 'cycle'
  ) => {
    if (extraPreset) setInitialNapPreset(extraPreset);
    setModal(m);
  }, []);
  const closeModal = useCallback(() => setModal(null), []);
  const openMetricDetail = useCallback((m: 'bpm' | 'hrv' | 'temp' | 'spo2' | 'resp' | 'stress' | 'bp' | 'glucose') => setMetricDetail(m), []);
  const closeMetricDetail = useCallback(() => setMetricDetail(null), []);
  const openStory = useCallback((data: any) => setStoryData(data), []);
  const closeStory = useCallback(() => setStoryData(null), []);

  // Surveillance active du passage de minuit, retour au premier plan et semaine civile
  const lastForegroundSyncRef = useRef<number>(0);
  useEffect(() => {
    let lastKnownDay = TODAY_INDEX;
    let lastKnownWeekId = computeRealCurrentWeek().weekId;

    const refreshRingOnForeground = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (!qringBle.isConnected() || qringBle.isSyncingNow() || qringBle.isRealTimeHeartRateActive()) return;
      const now = Date.now();
      if (now - lastForegroundSyncRef.current < 45000) return;
      lastForegroundSyncRef.current = now;
      qringBle
        .refreshMeasureActivity()
        .then(() => {
          if (qringBle.isConnected() && !qringBle.isSyncingNow() && !qringBle.isRealTimeHeartRateActive()) {
            return qringBle.requestStepsData(0);
          }
          return false;
        })
        .catch(() => {});
    };

    const checkMidnightAndRollover = () => {
      const cal = refreshCalendar();
      if (cal.weekId !== lastKnownWeekId) {
        const oldWeekId = lastKnownWeekId;
        lastKnownWeekId = cal.weekId;
        lastKnownDay = cal.todayIndex;
        try {
          const prevData = localStorage.getItem('vyta_week_data');
          if (prevData && oldWeekId) {
            localStorage.setItem(`vyta_week_${oldWeekId}`, prevData);
          }
          localStorage.setItem('vyta_week_id', cal.weekId);
          localStorage.removeItem('vyta_week_data');
        } catch (_) {}
        setCalendarEpoch((c) => c + 1);
        setWeekData(createEmptyWeekMetrics());
        setSelectedDay(cal.todayIndex);
      } else if (cal.todayIndex !== lastKnownDay) {
        const oldDay = lastKnownDay;
        lastKnownDay = cal.todayIndex;
        setCalendarEpoch((c) => c + 1);
        setSelectedDay((prev) => (prev === oldDay ? cal.todayIndex : prev));
      }
      refreshRingOnForeground();
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

  // Demander l'autorisation de notifications natives dès l'appairage actif
  useEffect(() => {
    if (!isPaired) return;
    void requestBrowserNotificationPermission();
  }, [isPaired]);

  // Moteur d'alertes batterie (<= 20% faible, 100% charge complète)
  const prevBatteryRef = useRef<number>(ring.batteryRing || 0);
  useEffect(() => {
    if (!isPaired || !ring.isConnected) {
      if (ring.batteryRing > 0) prevBatteryRef.current = ring.batteryRing;
      return;
    }
    const pct = ring.batteryRing;
    const prevPct = prevBatteryRef.current;
    prevBatteryRef.current = pct;
    if (pct <= 0) return;

    const isEn = language === 'en';
    try {
      // Hysteresis reset
      if (pct >= 25) localStorage.removeItem('vyta_notif_low_batt_sent');
      if (pct <= 95) localStorage.removeItem('vyta_notif_full_batt_sent');

      // Alerte batterie faible (<= 20%, hors charge)
      if (pct <= 20 && !ring.isCharging && localStorage.getItem('vyta_notif_low_batt_sent') !== '1') {
        localStorage.setItem('vyta_notif_low_batt_sent', '1');
        dispatchApplePush(
          isEn ? `Low Battery · ${pct}%` : `Batterie faible · ${pct}%`,
          isEn
            ? `Your Aurel Ring One is down to ${pct}%. Place it on its dock soon.`
            : `Votre Aurel Ring One est à ${pct}%. Pensez à la recharger prochainement.`,
          'battery'
        );
      }

      // Alerte batterie chargée à 100%
      if (
        pct === 100 &&
        (ring.isCharging || (prevPct > 0 && prevPct < 100)) &&
        localStorage.getItem('vyta_notif_full_batt_sent') !== '1'
      ) {
        localStorage.setItem('vyta_notif_full_batt_sent', '1');
        dispatchApplePush(
          isEn ? 'Battery Charged · 100%' : 'Batterie chargée à 100%',
          isEn
            ? 'Your Aurel Ring One is fully charged and ready to wear.'
            : 'Votre Aurel Ring One est rechargée à 100% et prête à être portée.',
          'battery'
        );
      }
    } catch (_) {}
  }, [isPaired, ring.isConnected, ring.batteryRing, ring.isCharging, language]);

  // Moteur d'alertes d'anomalie biométrique (température/VRC, SpO2 bas, FC inhabituelle)
  useEffect(() => {
    if (!isPaired || weekOffset !== 0) return;
    const cur = weekData?.[TODAY_INDEX];
    if (!cur) return;

    const isEn = language === 'en';
    let anomalyKind: string | null = null;
    let bodyText = '';

    if (cur.anomaly) {
      anomalyKind = `immunity_${cur.anomaly.tempDelta.toFixed(1)}_${cur.anomaly.hrvDelta}`;
      bodyText = isEn
        ? `Biometric shift detected (Temp ${cur.anomaly.tempDelta >= 0 ? '+' : ''}${cur.anomaly.tempDelta.toFixed(1)}°C, HRV ${cur.anomaly.hrvDelta} ms). Take it easy and prioritize recovery.`
        : `Variation physiologique détectée (Température ${cur.anomaly.tempDelta >= 0 ? '+' : ''}${cur.anomaly.tempDelta.toFixed(1)}°C, VRC ${cur.anomaly.hrvDelta} ms). Privilégiez le repos.`;
    } else if (cur.spo2 > 0 && cur.spo2 < 90) {
      anomalyKind = `spo2_${cur.spo2}`;
      bodyText = isEn
        ? `Low blood oxygen reading detected (${cur.spo2}%). Check ring fit or rest for a new reading.`
        : `Saturation en oxygène basse détectée (${cur.spo2}%). Vérifiez l'ajustement de la bague ou refaites une mesure au calme.`;
    } else if (cur.restingBpm >= 115 || (cur.bpm > 0 && cur.bpm < 42)) {
      anomalyKind = `hr_${cur.restingBpm || cur.bpm}`;
      const val = cur.bpm > 0 && cur.bpm < 42 ? cur.bpm : cur.restingBpm;
      bodyText = isEn
        ? `Unusual heart rate detected (${val} bpm). Rest and verify sensor placement.`
        : `Fréquence cardiaque inhabituelle détectée (${val} bpm). Restez au calme et vérifiez le port de la bague.`;
    }

    if (!anomalyKind) return;

    try {
      const todayKey = toLocalDateKey(new Date());
      const raw = localStorage.getItem('vyta_notif_last_anomaly');
      if (raw) {
        const prev = JSON.parse(raw) as { dayKey?: string; kind?: string; ts?: number };
        const fourHours = 4 * 60 * 60 * 1000;
        if (prev.dayKey === todayKey && prev.kind === anomalyKind && prev.ts && Date.now() - prev.ts < fourHours) {
          return;
        }
      }
      localStorage.setItem('vyta_notif_last_anomaly', JSON.stringify({ dayKey: todayKey, kind: anomalyKind, ts: Date.now() }));
      dispatchApplePush(
        isEn ? 'Biometric Anomaly Detected' : 'Anomalie détectée',
        bodyText,
        'anomaly'
      );
    } catch (_) {}
  }, [isPaired, weekOffset, weekData, language]);

  const addManualNap = useCallback((napInput: {
    startMin: number;
    endMin: number;
    deepMin?: number;
    lightMin?: number;
    remMin?: number;
    napType?: 'power' | 'restful' | 'cycle' | 'custom';
  }) => {
    setWeekData((prev) => {
      const next = [...prev];
      const cur = { ...(next[selectedDay] || emptyDayMetrics) };
      const curNaps = [...(cur.naps || [])];
      const dur = napInput.endMin >= napInput.startMin
        ? napInput.endMin - napInput.startMin
        : (napInput.endMin + 1440) - napInput.startMin;
      const cleanDur = Math.max(10, dur);
      const deep = napInput.deepMin !== undefined
        ? napInput.deepMin
        : (napInput.napType === 'power' ? 0 : Math.round(cleanDur * 0.3));
      const rem = napInput.remMin !== undefined
        ? napInput.remMin
        : (napInput.napType === 'cycle' ? Math.round(cleanDur * 0.2) : 0);
      const light = napInput.lightMin !== undefined
        ? napInput.lightMin
        : Math.max(0, cleanDur - deep - rem);
      const energyBonus = Math.min(18, Math.max(5, Math.round(cleanDur / 4.5)));
      const score = Math.min(100, Math.round((cleanDur / 45) * 85 + (deep / cleanDur) * 15));

      const newNap: NapRecord = {
        id: `manual-nap-${Date.now()}`,
        startMin: napInput.startMin,
        endMin: napInput.endMin,
        durationMin: cleanDur,
        deepMin: deep,
        lightMin: light,
        remMin: rem,
        score,
        energyBonus,
        source: 'manual',
        napType: napInput.napType || (cleanDur <= 25 ? 'power' : cleanDur <= 50 ? 'restful' : 'cycle'),
      };

      curNaps.push(newNap);
      cur.naps = curNaps;
      syncBodyEnergy(cur, selectedDay === TODAY_INDEX);
      next[selectedDay] = cur;
      return next;
    });
  }, [selectedDay]);

  const deleteNap = useCallback((napId: string) => {
    setWeekData((prev) => {
      const next = [...prev];
      const cur = { ...(next[selectedDay] || emptyDayMetrics) };
      if (!cur.naps) return prev;
      cur.naps = cur.naps.filter((n) => n.id !== napId);
      syncBodyEnergy(cur, selectedDay === TODAY_INDEX);
      next[selectedDay] = cur;
      return next;
    });
  }, [selectedDay]);

  const updateSleepSession = useCallback((dayIndex: number, startMin: number, endMin: number) => {
    setWeekData((prev) => {
      const next = [...prev];
      const idx = Math.max(0, Math.min(6, dayIndex));
      const cur = { ...(next[idx] || emptyDayMetrics) };
      const computed = buildSleepSummary(startMin, endMin, cur.restingBpm || cur.bpm || 65);
      cur.sleep = computed;
      if (cur.pillars) {
        cur.pillars = {
          ...cur.pillars,
          sleep: computed.score,
        };
        const activePillars = [cur.pillars.sleep, cur.pillars.recovery, cur.pillars.activity].filter((v) => v > 0);
        cur.score = activePillars.length > 0 ? Math.round(activePillars.reduce((a, b) => a + b, 0) / activePillars.length) : 0;
      }
      syncBodyEnergy(cur, idx === TODAY_INDEX);
      next[idx] = cur;
      return next;
    });
  }, []);

  const contextValue = useMemo(
    () => ({
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
      initialNapPreset,
      metricDetail,
      openMetricDetail,
      closeMetricDetail,
      storyData,
      openStory,
      closeStory,
      selectedDay,
      setSelectedDay,
      selectedDateKey,
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
      updateSleepSession,
      weekData,
      setWeekData,
      weekOffset,
      setWeekOffset,
      goToPreviousWeek,
      goToNextWeek,
      goToCurrentWeek,
      weekDays,
      weekRangeLabel,
      todayIndex,
    }),
    [
      tab,
      language,
      t,
      covytaActive,
      profile,
      updateProfile,
      finish,
      modal,
      openModal,
      closeModal,
      initialNapPreset,
      metricDetail,
      openMetricDetail,
      closeMetricDetail,
      storyData,
      openStory,
      closeStory,
      selectedDay,
      selectedDateKey,
      liveBpm,
      isLiveHrActive,
      toggleLiveHr,
      ring,
      updateRing,
      theme,
      cardThemeMode,
      simulatedDate,
      resetSimulatedDate,
      isDateModalOpen,
      sensorIntervals,
      updateSensorIntervals,
      isSimulating,
      toggleSimulation,
      simulationHoursElapsed,
      isFirstLaunch,
      isPaired,
      isLiveRunningViewOpen,
      resetToFactory,
      addManualNap,
      deleteNap,
      updateSleepSession,
      weekData,
      weekOffset,
      goToPreviousWeek,
      goToNextWeek,
      goToCurrentWeek,
      weekDays,
      weekRangeLabel,
      todayIndex,
    ]
  );

  return (
    <AppContext.Provider value={contextValue}>
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
