import { DayMetrics, FinishOption, HypnogramBlock, RingDevice, RingFinish, SensorIntervals } from '../types';
export type { DayMetrics };

export const RING_IMAGE = '/assets/ring/ring-front.png';

/** Semaine du lundi 12 au dimanche 18 octobre 2026 — « aujourd'hui » = jeudi 15. */
export const TODAY_INDEX = 3;
export const MONTH = 'octobre';
export const WEEK = [
  { short: 'L', long: 'Lundi', date: 12 },
  { short: 'M', long: 'Mardi', date: 13 },
  { short: 'M', long: 'Mercredi', date: 14 },
  { short: 'J', long: 'Jeudi', date: 15 },
  { short: 'V', long: 'Vendredi', date: 16 },
  { short: 'S', long: 'Samedi', date: 17 },
  { short: 'D', long: 'Dimanche', date: 18 },
];

export const GOALS = { steps: 10000, distanceKm: 8, activeKcal: 600 };

export const defaultSensorIntervals: SensorIntervals = {
  heartRate: '1h',
  hrv: '1h',
  spo2: '1h',
  temperature: '1h',
  stress: '1h',
  bloodPressure: '1h',
  glucose: '1h',
  respiratory: '1h',
};

/**
 * Calcule l'autonomie estimée de la bague (en jours) selon les fréquences d'échantillonnage des capteurs (30 min ou 1h)
 */
export function calculateEstimatedBatteryDays(intervals: SensorIntervals): number {
  let days = 8.0;
  const weights: Record<string, number> = {
    '15min': 0.45,
    '30min': 0.35,
    '1h': 0.0,
    '2h': 0.0,
  };

  const keys: (keyof SensorIntervals)[] = [
    'heartRate',
    'hrv',
    'spo2',
    'temperature',
    'stress',
    'bloodPressure',
    'glucose',
    'respiratory',
  ];

  for (const k of keys) {
    const val = intervals?.[k] || '1h';
    days -= weights[val] ?? 0.1;
  }

  return Math.max(4, Math.min(8, Math.round(days)));
}

/**
 * Calcule et formate le temps d'autonomie restant synchronisé avec le pourcentage réel de la batterie
 * et les intervalles d'échantillonnage des capteurs.
 * Exemple : à 2% de batterie -> "~3 heures restantes" (et non plusieurs jours).
 */
export function formatRemainingBatteryTime(
  batteryPct: number,
  intervals: SensorIntervals,
  isEn = false
): string {
  const safePct = Math.max(0, Math.min(100, Math.round(batteryPct)));
  if (safePct <= 0) {
    return isEn ? 'Battery depleted · Charge required' : 'Batterie épuisée · Recharge requise';
  }

  // Autonomie totale à 100% selon les capteurs (3 à 8 jours)
  const fullDays = calculateEstimatedBatteryDays(intervals);
  const totalHours = fullDays * 24;

  // Heures restantes réelles selon le pourcentage actuel
  const remainingHours = (safePct / 100) * totalHours;

  if (remainingHours >= 36) {
    const days = Math.round(remainingHours / 24);
    return isEn ? `~${days} days left` : `~${days} jours restants`;
  }

  if (remainingHours >= 24) {
    return isEn ? '~1 day left' : '~1 jour restant';
  }

  if (remainingHours >= 1.5) {
    const hours = Math.round(remainingHours);
    return isEn ? `~${hours} hours left` : `~${hours} heures restantes`;
  }

  if (remainingHours >= 0.8) {
    return isEn ? '~1 hour left' : '~1 heure restante';
  }

  return isEn ? '< 1 hour left · Low battery' : '< 1 heure restante · Batterie faible';
}

export const ringDevice: RingDevice = {
  batteryRing: 0,
  batteryCase: 0,
  bluetooth: '5.4',
  firmware: 'v3.4.12',
  serial: 'VYTA-ONE-GM-99841',
  macAddress: 'C8:2B:96:4A:99:84',
  ringSize: 10,
  isConnected: false,
  vytaCareActive: true,
  vytaCareExpires: 'Octobre 2028',
  sensorIntervals: defaultSensorIntervals,
  wearCalibrationScore: 0,
  wearCalibrationDate: 'En attente d\'appairage',
};




/**
 * Détecte automatiquement la finition matérielle de la bague (champagne, gunmetal, silver, rose)
 * à partir de l'adresse MAC Bluetooth ou du numéro de série / identifiant matériel.
 */
export function detectRingFinish(mac?: string, serial?: string, name?: string): RingFinish {
  const combined = `${mac || ''} ${serial || ''} ${name || ''}`.toUpperCase();

  // 1. Détection explicite par code de série ou nom BLE
  if (combined.includes('-GM') || combined.includes('GUNMETAL') || combined.includes('TITANIUM') || combined.includes('BLACK') || combined.includes('DARK')) {
    return 'gunmetal';
  }
  if (combined.includes('-CH') || combined.includes('CHAMPAGNE') || combined.includes('GOLD') || combined.includes('DORE')) {
    return 'champagne';
  }
  if (combined.includes('-SL') || combined.includes('SILVER') || combined.includes('ARGENT') || combined.includes('STEEL')) {
    return 'silver';
  }
  if (combined.includes('-RG') || combined.includes('ROSE') || combined.includes('PINK')) {
    return 'rose';
  }

  // 2. Détection déterministe basée sur l'adresse MAC (2 derniers octets matériels)
  if (mac) {
    const cleanMac = mac.replace(/[^A-F0-9]/gi, '');
    if (cleanMac.length >= 2) {
      const lastByte = parseInt(cleanMac.slice(-2), 16);
      if (!isNaN(lastByte)) {
        const finishList: RingFinish[] = ['gunmetal', 'silver', 'champagne', 'rose'];
        return finishList[lastByte % 4];
      }
    }
  }

  // 3. Hachage déterministe sur le numéro de série
  if (serial) {
    let hash = 0;
    for (let i = 0; i < serial.length; i++) {
      hash = (hash << 5) - hash + serial.charCodeAt(i);
      hash |= 0;
    }
    const finishList: RingFinish[] = ['gunmetal', 'silver', 'champagne', 'rose'];
    return finishList[Math.abs(hash) % 4];
  }

  return 'gunmetal';
}

export const finishes: FinishOption[] = [
  {
    id: 'champagne',
    label: 'Champagne Gold',
    swatch: 'linear-gradient(135deg, #F3DDB1, #C9A66B)',
    tint: '#E8C98F',
    imgFilter: 'brightness(1.85) contrast(0.95)',
  },
  {
    id: 'gunmetal',
    label: 'Gunmetal',
    swatch: 'linear-gradient(135deg, #6B7078, #2A2D33)',
    tint: null,
    imgFilter: 'brightness(1.05)',
  },
  {
    id: 'silver',
    label: 'Silver',
    swatch: 'linear-gradient(135deg, #F2F3F5, #A9ADB5)',
    tint: '#D6D9DE',
    imgFilter: 'grayscale(1) brightness(2.2) contrast(0.9)',
  },
  {
    id: 'rose',
    label: 'Rose Gold',
    swatch: 'linear-gradient(135deg, #F4C9BA, #C98C79)',
    tint: '#E9B5A2',
    imgFilter: 'brightness(1.85) contrast(0.95)',
  },
];

export const weekMetrics: DayMetrics[] = Array.from({ length: 7 }, (): DayMetrics => ({
  score: 0,
  pillars: { sleep: 0, recovery: 0, activity: 0 },
  steps: 0,
  distanceKm: 0,
  activeKcal: 0,
  bodyEnergy: 0,
  bodyEnergyWake: 0,
  bodyEnergyBedtime: 0,
  bpm: 0,
  restingBpm: 0,
  minBpm: 0,
  maxBpm: 0,
  hrv: 0,
  hrvBaseline: 0,
  tempDelta: 0,
  spo2: 0,
  anomaly: null,
  sleep: { score: 0, deepMin: 0, remMin: 0, lightMin: 0, awakeMin: 0 },
  stress: 0,
  stressLevel: '--',
  bloodPressure: { sbp: 0, dbp: 0 },
  glucose: { valueMmol: 0, stabilityScore: 0 },
  resp: 0,
}));

export const emptyDayMetrics: DayMetrics = {
  score: 0,
  pillars: { sleep: 0, recovery: 0, activity: 0 },
  steps: 0,
  distanceKm: 0,
  activeKcal: 0,
  bodyEnergy: 0,
  bodyEnergyWake: 0,
  bodyEnergyBedtime: 0,
  bpm: 0,
  restingBpm: 0,
  minBpm: 0,
  maxBpm: 0,
  hrv: 0,
  hrvBaseline: 0,
  tempDelta: 0,
  spo2: 0,
  anomaly: null,
  sleep: { score: 0, deepMin: 0, remMin: 0, lightMin: 0, awakeMin: 0 },
  stress: 0,
  stressLevel: '--',
  bloodPressure: { sbp: 0, dbp: 0 },
  glucose: { valueMmol: 0, stabilityScore: 0 },
};

export const createEmptyWeekMetrics = (): DayMetrics[] => {
  return Array.from({ length: 7 }, () => ({ ...emptyDayMetrics }));
};

export const statusFor = (score: number): string => {
  if (score >= 90) return 'Optimal';
  if (score >= 80) return 'Très bon';
  if (score >= 70) return 'Modéré';
  return 'Récupération';
};

/* ---------- Hypnogramme ---------- */

const distribute = (total: number, weights: number[]): number[] => {
  const sum = weights.reduce((a, b) => a + b, 0);
  let used = 0;
  return weights.map((w, i) => {
    if (i === weights.length - 1) return total - used;
    const v = Math.round((total * w) / sum);
    used += v;
    return v;
  });
};

/** Construit 5 cycles de sommeil dont les durées totales correspondent exactement au résumé de la nuit. */
export function buildHypnogram(s: DayMetrics['sleep']): HypnogramBlock[] {
  const deep = distribute(s.deepMin, [0.4, 0.3, 0.15, 0.1, 0.05]);
  const rem = distribute(s.remMin, [0.1, 0.15, 0.2, 0.25, 0.3]);
  const light = distribute(s.lightMin, Array.from({ length: 10 }, () => 1));
  const awake = distribute(s.awakeMin, [0.4, 0.35, 0.25]);

  const raw: Omit<HypnogramBlock, 'startMin'>[] = [{ stage: 'awake', durationMin: awake[0] }];
  for (let c = 0; c < 5; c++) {
    raw.push(
      { stage: 'light', durationMin: light[c * 2] },
      { stage: 'deep', durationMin: deep[c] },
      { stage: 'light', durationMin: light[c * 2 + 1] },
      { stage: 'rem', durationMin: rem[c] },
    );
    if (c === 1) raw.push({ stage: 'awake', durationMin: awake[1] });
  }
  raw.push({ stage: 'awake', durationMin: awake[2] });

  let t = 0;
  return raw
    .filter((b) => b.durationMin > 0)
    .map((b) => {
      const block: HypnogramBlock = { ...b, startMin: t };
      t += b.durationMin;
      return block;
    });
}
