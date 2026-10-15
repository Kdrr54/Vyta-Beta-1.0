import { DayMetrics, FinishOption, HypnogramBlock, RingDevice } from '../types';

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

export const ringDevice: RingDevice = {
  batteryRing: 87,
  batteryCase: 64,
  bluetooth: '5.4',
  firmware: 'v3.4.12',
  serial: 'VYTA-R21-99841',
  ringSize: 10,
};

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
    bpm: 61, restingBpm: 52, hrv: 69, hrvBaseline: 66, tempDelta: -0.05, spo2: 98.2,
    anomaly: null,
    sleep: { score: 84, deepMin: 98, remMin: 95, lightMin: 231, awakeMin: 31 },
  },
  {
    score: 79,
    pillars: { sleep: 74, recovery: 80, activity: 85 },
    steps: 6980, distanceKm: 5.1, activeKcal: 390,
    bodyEnergy: 64, bodyEnergyWake: 80, bodyEnergyBedtime: 31,
    bpm: 64, restingBpm: 54, hrv: 61, hrvBaseline: 66, tempDelta: 0.12, spo2: 97.9,
    anomaly: null,
    sleep: { score: 74, deepMin: 82, remMin: 86, lightMin: 228, awakeMin: 40 },
  },
  {
    score: 88,
    pillars: { sleep: 87, recovery: 91, activity: 82 },
    steps: 9120, distanceKm: 6.7, activeKcal: 505,
    bodyEnergy: 75, bodyEnergyWake: 91, bodyEnergyBedtime: 33,
    bpm: 62, restingBpm: 51, hrv: 71, hrvBaseline: 66, tempDelta: -0.02, spo2: 98.4,
    anomaly: null,
    sleep: { score: 87, deepMin: 106, remMin: 102, lightMin: 224, awakeMin: 27 },
  },
  {
    score: 91,
    pillars: { sleep: 89, recovery: 95, activity: 88 },
    steps: 8420, distanceKm: 6.2, activeKcal: 480,
    bodyEnergy: 78, bodyEnergyWake: 92, bodyEnergyBedtime: 34,
    bpm: 63, restingBpm: 51, hrv: 74, hrvBaseline: 66, tempDelta: -0.08, spo2: 98.6,
    anomaly: { tempDelta: 0.4, hrvDelta: -14 },
    sleep: { score: 89, deepMin: 112, remMin: 108, lightMin: 222, awakeMin: 24 },
  },
  // Jours à venir : aucune donnée (sélection désactivée dans l'interface)
  ...Array.from({ length: 3 }, (): DayMetrics => ({
    score: 0,
    pillars: { sleep: 0, recovery: 0, activity: 0 },
    steps: 0, distanceKm: 0, activeKcal: 0,
    bodyEnergy: 0, bodyEnergyWake: 0, bodyEnergyBedtime: 0,
    bpm: 0, restingBpm: 0, hrv: 0, hrvBaseline: 0, tempDelta: 0, spo2: 0,
    anomaly: null,
    sleep: { score: 0, deepMin: 0, remMin: 0, lightMin: 0, awakeMin: 0 },
  })),
];

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
