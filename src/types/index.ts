export type TabType = 'health' | 'sleep' | 'cycle' | 'fit' | 'covyta';
export type AppTheme = 'dark' | 'ceramic' | 'alpine';
export type CoachingPersona = 'analyst' | 'commander' | 'guardian';
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
  minBpm?: number;
  maxBpm?: number;
  hrv: number;
  hrvBaseline: number;
  tempDelta: number;
  spo2: number;
  anomaly: { tempDelta: number; hrvDelta: number } | null;
  sleep: SleepSummary;
  stress?: number;
  stressLevel?: string;
  bloodPressure?: { sbp: number; dbp: number };
  glucose?: { valueMmol: number; stabilityScore: number };
}

export type SensorIntervalOption = '15min' | '30min' | '1h' | '2h';

export interface SensorIntervals {
  heartRate: SensorIntervalOption;
  hrv: SensorIntervalOption;
  spo2: SensorIntervalOption;
  temperature: SensorIntervalOption;
  stress: SensorIntervalOption;
  bloodPressure: SensorIntervalOption;
  glucose: SensorIntervalOption;
  respiratory: SensorIntervalOption;
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
  macAddress?: string;
  ringSize: number;
  isConnected?: boolean;
  vytaCareActive?: boolean;
  vytaCareExpires?: string;
  sensorIntervals?: SensorIntervals;
  wearCalibrationScore?: number;
  wearCalibrationDate?: string;
}
