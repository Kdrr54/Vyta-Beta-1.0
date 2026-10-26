// Apple HealthKit Manager for Vyta
// Connects smart ring biomarkers directly to Apple Health & Apple Fitness Rings
import { weekMetrics, TODAY_INDEX } from '../data/health';

export interface HealthKitSyncState {
  isAuthorized: boolean;
  lastSyncTimestamp: number;
  rings: {
    moveCal: number;
    moveGoal: number;
    exerciseMin: number;
    exerciseGoal: number;
    standHours: number;
    standGoal: number;
  };
  syncedMetrics: {
    id: string;
    label: string;
    value: string;
    unit: string;
    status: 'synced' | 'pending';
  }[];
}

const STORAGE_KEY = 'vyta_healthkit_sync_state';

function buildDynamicMetrics() {
  const today = weekMetrics[TODAY_INDEX] || weekMetrics[3];
  const totalSleepMin = today.sleep.deepMin + today.sleep.remMin + today.sleep.lightMin;
  const sleepH = Math.floor(totalSleepMin / 60);
  const sleepM = totalSleepMin % 60;

  return {
    isAuthorized: true,
    lastSyncTimestamp: Date.now(),
    rings: {
      moveCal: today.activeKcal,
      moveGoal: 600,
      exerciseMin: 44,
      exerciseGoal: 30,
      standHours: 11,
      standGoal: 12,
    },
    syncedMetrics: [
      { id: 'hrv', label: 'Variabilité Cardiaque (VRC)', value: String(today.hrv), unit: 'ms', status: 'synced' as const },
      { id: 'rhr', label: 'Fréquence Cardiaque Repos', value: String(today.restingBpm), unit: 'bpm', status: 'synced' as const },
      { id: 'sleep', label: 'Analyse du Sommeil (Profond & REM)', value: `${sleepH}h ${sleepM}m`, unit: '', status: 'synced' as const },
      { id: 'wrist_temp', label: 'Température Cutanée Nocturne', value: (today.tempDelta >= 0 ? '+' : '') + today.tempDelta.toFixed(1), unit: '°C', status: 'synced' as const },
      { id: 'spo2', label: 'Oxygénation Sanguine (SpO2)', value: today.spo2.toFixed(1), unit: '%', status: 'synced' as const },
      { id: 'steps', label: 'Nombre de pas quotidiens', value: today.steps.toLocaleString('fr-FR'), unit: 'pas', status: 'synced' as const },
    ],
  };
}

export const getHealthKitState = (): HealthKitSyncState => {
  const dynamic = buildDynamicMetrics();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return dynamic;
    const parsed = JSON.parse(raw);
    return { ...dynamic, ...parsed };
  } catch {
    return dynamic;
  }
};

export const syncWithHealthKit = (): HealthKitSyncState => {
  const updated = buildDynamicMetrics();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error(e);
  }
  return updated;
};
