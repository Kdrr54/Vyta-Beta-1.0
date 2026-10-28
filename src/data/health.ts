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

export const weekMetrics: DayMetrics[] = [
  {
    score: 86,
    pillars: { sleep: 84, recovery: 88, activity: 90 },
    steps: 10240, distanceKm: 7.6, activeKcal: 560,
    bodyEnergy: 71, bodyEnergyWake: 88, bodyEnergyBedtime: 29,
    bpm: 61, restingBpm: 52, minBpm: 48, maxBpm: 138, hrv: 69, hrvBaseline: 66, tempDelta: -0.05, spo2: 98.2,
    anomaly: null,
    sleep: { score: 84, deepMin: 98, remMin: 95, lightMin: 231, awakeMin: 31 },
    stress: 32,
    stressLevel: 'Modéré',
    bloodPressure: { sbp: 120, dbp: 78 },
    glucose: { valueMmol: 5.2, stabilityScore: 92 },
    resp: 15,
  },
  {
    score: 79,
    pillars: { sleep: 74, recovery: 80, activity: 85 },
    steps: 6980, distanceKm: 5.1, activeKcal: 390,
    bodyEnergy: 64, bodyEnergyWake: 80, bodyEnergyBedtime: 31,
    bpm: 64, restingBpm: 54, minBpm: 50, maxBpm: 154, hrv: 61, hrvBaseline: 66, tempDelta: 0.12, spo2: 97.9,
    anomaly: null,
    sleep: { score: 74, deepMin: 82, remMin: 86, lightMin: 228, awakeMin: 40 },
    stress: 42,
    stressLevel: 'Actif',
    bloodPressure: { sbp: 122, dbp: 80 },
    glucose: { valueMmol: 5.4, stabilityScore: 88 },
    resp: 16,
  },
  {
    score: 88,
    pillars: { sleep: 87, recovery: 91, activity: 82 },
    steps: 9120, distanceKm: 6.7, activeKcal: 505,
    bodyEnergy: 75, bodyEnergyWake: 91, bodyEnergyBedtime: 33,
    bpm: 62, restingBpm: 51, minBpm: 47, maxBpm: 148, hrv: 71, hrvBaseline: 66, tempDelta: -0.02, spo2: 98.4,
    anomaly: null,
    sleep: { score: 87, deepMin: 106, remMin: 102, lightMin: 224, awakeMin: 27 },
    stress: 28,
    stressLevel: 'Calme',
    bloodPressure: { sbp: 119, dbp: 76 },
    glucose: { valueMmol: 5.0, stabilityScore: 95 },
    resp: 14,
  },
  {
    score: 91,
    pillars: { sleep: 89, recovery: 95, activity: 88 },
    steps: 8420, distanceKm: 6.2, activeKcal: 480,
    bodyEnergy: 78, bodyEnergyWake: 92, bodyEnergyBedtime: 34,
    bpm: 63, restingBpm: 51, minBpm: 48, maxBpm: 164, hrv: 74, hrvBaseline: 66, tempDelta: -0.08, spo2: 98.6,
    anomaly: null,
    sleep: { score: 89, deepMin: 112, remMin: 108, lightMin: 222, awakeMin: 24 },
    stress: 24,
    stressLevel: 'Calme',
    bloodPressure: { sbp: 118, dbp: 76 },
    glucose: { valueMmol: 5.1, stabilityScore: 94 },
    resp: 14,
  },
  {
    score: 87,
    pillars: { sleep: 85, recovery: 90, activity: 86 },
    steps: 8950, distanceKm: 6.5, activeKcal: 510,
    bodyEnergy: 76, bodyEnergyWake: 89, bodyEnergyBedtime: 32,
    bpm: 62, restingBpm: 50, minBpm: 47, maxBpm: 152, hrv: 72, hrvBaseline: 66, tempDelta: -0.06, spo2: 98.5,
    anomaly: null,
    sleep: { score: 85, deepMin: 104, remMin: 100, lightMin: 226, awakeMin: 28 },
    stress: 25,
    stressLevel: 'Calme',
    bloodPressure: { sbp: 120, dbp: 78 },
    glucose: { valueMmol: 5.2, stabilityScore: 93 },
    resp: 14,
  },
  {
    score: 93,
    pillars: { sleep: 92, recovery: 96, activity: 89 },
    steps: 11400, distanceKm: 8.4, activeKcal: 630,
    bodyEnergy: 82, bodyEnergyWake: 94, bodyEnergyBedtime: 35,
    bpm: 60, restingBpm: 49, minBpm: 46, maxBpm: 158, hrv: 76, hrvBaseline: 66, tempDelta: -0.10, spo2: 98.8,
    anomaly: null,
    sleep: { score: 92, deepMin: 120, remMin: 114, lightMin: 220, awakeMin: 20 },
    stress: 18,
    stressLevel: 'Calme',
    bloodPressure: { sbp: 117, dbp: 75 },
    glucose: { valueMmol: 4.9, stabilityScore: 96 },
    resp: 13,
  },
  {
    score: 90,
    pillars: { sleep: 88, recovery: 94, activity: 84 },
    steps: 7600, distanceKm: 5.6, activeKcal: 420,
    bodyEnergy: 79, bodyEnergyWake: 91, bodyEnergyBedtime: 33,
    bpm: 61, restingBpm: 50, minBpm: 47, maxBpm: 145, hrv: 73, hrvBaseline: 66, tempDelta: -0.04, spo2: 98.4,
    anomaly: null,
    sleep: { score: 88, deepMin: 110, remMin: 105, lightMin: 225, awakeMin: 25 },
    stress: 19,
    stressLevel: 'Calme',
    bloodPressure: { sbp: 118, dbp: 76 },
    glucose: { valueMmol: 5.0, stabilityScore: 95 },
    resp: 14,
  },
];

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
