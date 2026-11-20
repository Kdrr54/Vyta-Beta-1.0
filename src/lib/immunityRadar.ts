import { DayMetrics } from '../types';

export const IMMUNITY_MIN_DAY_SAMPLES = 4;

export interface DailyImmunityEval {
  status: 'waiting' | 'collecting' | 'optimal' | 'anomaly';
  tempCount: number;
  hrvCount: number;
  sampleCount: number;
  avgTemp: number | null;
  avgHrv: number | null;
  tempBaseline: number;
  hrvBaseline: number | null;
  hasPersonalHrvBaseline: boolean;
  tempDelta: number;
  hrvDelta: number;
  anomaly: { tempDelta: number; hrvDelta: number; detectedAtTs?: number } | null;
}

function getValidTempsForDay(day?: DayMetrics | null): number[] {
  if (!day) return [];
  if (Array.isArray(day.tempLog) && day.tempLog.length > 0) {
    const valid = day.tempLog.filter((v) => typeof v === 'number' && v >= 30 && v <= 42);
    if (valid.length > 0) return valid;
  }
  if (typeof day.skinTemp === 'number' && day.skinTemp >= 30 && day.skinTemp <= 42) {
    return [day.skinTemp];
  }
  return [];
}

function getValidHrvsForDay(day?: DayMetrics | null): number[] {
  if (!day) return [];
  if (Array.isArray(day.hrvLog) && day.hrvLog.length > 0) {
    const valid = day.hrvLog.filter((v) => typeof v === 'number' && v >= 5 && v < 250);
    if (valid.length > 0) return valid;
  }
  if (typeof day.hrv === 'number' && day.hrv >= 5 && day.hrv < 250) {
    return [day.hrv];
  }
  return [];
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Évalue le Radar d'Immunité sur l'ensemble de la journée (moyenne & tendance durable)
 * plutôt que sur un seul point isolé, afin d'éviter les fausses alertes (ex: main chaude à 02h30).
 */
export function evaluateDailyImmunity(
  cur: DayMetrics | null | undefined,
  week?: DayMetrics[] | null,
  dayIdx?: number
): DailyImmunityEval {
  if (!cur) {
    return {
      status: 'waiting',
      tempCount: 0,
      hrvCount: 0,
      sampleCount: 0,
      avgTemp: null,
      avgHrv: null,
      tempBaseline: 36.55,
      hrvBaseline: null,
      hasPersonalHrvBaseline: false,
      tempDelta: 0,
      hrvDelta: 0,
      anomaly: null,
    };
  }

  const tempValues = getValidTempsForDay(cur);
  const hrvValues = getValidHrvsForDay(cur);
  const tempCount = tempValues.length;
  const hrvCount = hrvValues.length;
  const sampleCount = Math.max(tempCount, hrvCount);

  if (sampleCount === 0) {
    return {
      status: 'waiting',
      tempCount: 0,
      hrvCount: 0,
      sampleCount: 0,
      avgTemp: null,
      avgHrv: null,
      tempBaseline: 36.55,
      hrvBaseline: null,
      hasPersonalHrvBaseline: false,
      tempDelta: 0,
      hrvDelta: 0,
      anomaly: null,
    };
  }

  const avgTemp = mean(tempValues);
  const avgHrv = mean(hrvValues);

  // Baselines personnelles calculées à partir des autres jours réels de la semaine
  const otherTempMeans: number[] = [];
  const otherHrvMeans: number[] = [];
  if (Array.isArray(week)) {
    week.forEach((d, i) => {
      if (dayIdx !== undefined && i === dayIdx) return;
      const t = mean(getValidTempsForDay(d));
      if (t !== null) otherTempMeans.push(t);
      const h = mean(getValidHrvsForDay(d));
      if (h !== null) otherHrvMeans.push(h);
    });
  }

  const tempBaseline = otherTempMeans.length > 0 ? mean(otherTempMeans)! : 36.55;
  const explicitBaseline = typeof cur.hrvBaseline === 'number' && cur.hrvBaseline > 0 ? cur.hrvBaseline : null;
  const computedHrvBaseline = otherHrvMeans.length > 0 ? mean(otherHrvMeans) : null;
  const hrvBaseline = explicitBaseline ?? computedHrvBaseline;
  const hasPersonalHrvBaseline = hrvBaseline !== null && hrvBaseline > 0;

  const tempDelta =
    avgTemp !== null
      ? parseFloat((avgTemp - tempBaseline).toFixed(2))
      : cur.tempDelta && cur.tempDelta !== 0
      ? parseFloat(cur.tempDelta.toFixed(2))
      : 0;
  const hrvDelta = avgHrv !== null && hrvBaseline !== null ? Math.round(avgHrv - hrvBaseline) : 0;

  // Confirmation requise sur toute la journée (>= 4 créneaux réels ou >= 3 avec doubles capteurs)
  const hasEnoughDayData =
    tempCount >= IMMUNITY_MIN_DAY_SAMPLES ||
    hrvCount >= IMMUNITY_MIN_DAY_SAMPLES ||
    (tempCount >= 3 && hrvCount >= 3);

  if (!hasEnoughDayData) {
    return {
      status: 'collecting',
      tempCount,
      hrvCount,
      sampleCount,
      avgTemp: avgTemp !== null ? parseFloat(avgTemp.toFixed(1)) : null,
      avgHrv: avgHrv !== null ? Math.round(avgHrv) : null,
      tempBaseline: parseFloat(tempBaseline.toFixed(2)),
      hrvBaseline: hrvBaseline !== null ? Math.round(hrvBaseline) : null,
      hasPersonalHrvBaseline,
      tempDelta: parseFloat(tempDelta.toFixed(1)),
      hrvDelta,
      anomaly: null,
    };
  }

  const isTempAnomaly = tempCount >= IMMUNITY_MIN_DAY_SAMPLES && tempDelta >= 0.55;
  const isHrvAnomaly =
    hasPersonalHrvBaseline &&
    hrvCount >= IMMUNITY_MIN_DAY_SAMPLES &&
    hrvDelta <= -14 &&
    (tempCount === 0 || tempDelta >= 0.15);
  const isCombinedAnomaly =
    hasPersonalHrvBaseline &&
    tempCount >= 3 &&
    hrvCount >= 3 &&
    tempDelta >= 0.35 &&
    hrvDelta <= -8;

  const anomaly =
    isTempAnomaly || isHrvAnomaly || isCombinedAnomaly
      ? {
          tempDelta: tempDelta > 0 ? parseFloat(tempDelta.toFixed(1)) : 0,
          hrvDelta,
          detectedAtTs: cur.anomaly?.detectedAtTs || Date.now(),
        }
      : null;

  return {
    status: anomaly ? 'anomaly' : 'optimal',
    tempCount,
    hrvCount,
    sampleCount,
    avgTemp: avgTemp !== null ? parseFloat(avgTemp.toFixed(1)) : null,
    avgHrv: avgHrv !== null ? Math.round(avgHrv) : null,
    tempBaseline: parseFloat(tempBaseline.toFixed(2)),
    hrvBaseline: hrvBaseline !== null ? Math.round(hrvBaseline) : null,
    hasPersonalHrvBaseline,
    tempDelta: parseFloat(tempDelta.toFixed(1)),
    hrvDelta,
    anomaly,
  };
}

export function computeImmunityAnomaly(
  cur: DayMetrics,
  week?: DayMetrics[],
  dayIdx?: number
): { tempDelta: number; hrvDelta: number; detectedAtTs?: number } | null {
  return evaluateDailyImmunity(cur, week, dayIdx).anomaly;
}
