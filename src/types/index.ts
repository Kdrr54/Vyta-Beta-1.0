export type TabType = 'health' | 'fit' | 'covyta';
export type RingFinish = 'champagne' | 'gunmetal' | 'silver' | 'rose';
export type BiologicalSex = 'femme' | 'homme';
export type SleepStage = 'awake' | 'rem' | 'light' | 'deep';

export interface Pt {
  x: number;
  y: number;
}

export interface UserProfile {
  firstName: string;
  age: number;
  heightCm: number;
  weightKg: number;
  sex: BiologicalSex;
}

export interface HypnogramBlock {
  stage: SleepStage;
  startMin: number;
  durationMin: number;
}

export interface SleepSummary {
  score: number;
  deepMin: number;
  remMin: number;
  lightMin: number;
  awakeMin: number;
}

export interface DayMetrics {
  score: number;
  pillars: { sleep: number; recovery: number; activity: number };
  steps: number;
  distanceKm: number;
  activeKcal: number;
  bodyEnergy: number;
  bodyEnergyWake: number;
  bodyEnergyBedtime: number;
  bpm: number;
  restingBpm: number;
  hrv: number;
  hrvBaseline: number;
  tempDelta: number;
  spo2: number;
  anomaly: { tempDelta: number; hrvDelta: number } | null;
  sleep: SleepSummary;
}

export interface FinishOption {
  id: RingFinish;
  label: string;
  swatch: string;
  tint: string | null;
  imgFilter: string;
}

export interface RingDevice {
  batteryRing: number;
  batteryCase: number;
  bluetooth: string;
  firmware: string;
  serial: string;
  ringSize: number;
}
