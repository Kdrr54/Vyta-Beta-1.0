export interface MetricDataPoint {
  label: string; // e.g. "02h", "Mar", "J-5"
  value: number;
  info?: string;
  isMeasured?: boolean;
}

export interface EssentialStat {
  label: string;
  value: string;
  sub: string;
}

export interface KeyMoment {
  time: string;
  title: string;
  value: string;
  tag: string;
  pointIndex: number;
}

export interface ZoneDistribution {
  name: string;
  percent: number;
  duration: string;
}

export interface MetricDetailItem {
  id: 'bpm' | 'hrv' | 'temp' | 'spo2' | 'resp' | 'stress' | 'bp' | 'glucose';
  title: string;
  titleEn: string;
  unit: string;
  currentValue: string;
  badge: string;
  badgeEn: string;
  periodText: string;
  periodTextEn: string;
  summary: string;
  summaryEn: string;
  advice: string;
  adviceEn: string;
  accentColor: string;
  iconName: 'heart' | 'activity' | 'thermometer' | 'droplets' | 'wind';
  minVal: number;
  maxVal: number;
  points24h: MetricDataPoint[];
  points7d: MetricDataPoint[];
  points30d: MetricDataPoint[];
  stats: EssentialStat[];
  statsEn: EssentialStat[];
  moments: KeyMoment[];
  momentsEn: KeyMoment[];
  distribution: ZoneDistribution[];
  distributionEn: ZoneDistribution[];
}

export const METRIC_DETAILS: Record<'bpm' | 'hrv' | 'temp' | 'spo2' | 'resp' | 'stress' | 'bp' | 'glucose', MetricDetailItem> = {
  bpm: {
    id: 'bpm',
    title: 'Fréquence Cardiaque',
    titleEn: 'Heart Rate',
    unit: 'BPM',
    currentValue: '--',
    badge: '--',
    badgeEn: '--',
    periodText: "Aujourd'hui",
    periodTextEn: 'Today',
    summary: 'Rythme cardiaque en direct capté par le capteur optique PPG de la bague.',
    summaryEn: 'Live heart rate captured by the ring optical PPG sensor.',
    advice: 'Portez votre bague pour enregistrer vos variations cardiaques en continu.',
    adviceEn: 'Wear your ring continuously to record your ongoing cardiac trends.',
    accentColor: '#FF3B30',
    iconName: 'heart',
    minVal: 40,
    maxVal: 200,
    points24h: [],
    points7d: [],
    points30d: [],
    stats: [],
    statsEn: [],
    moments: [],
    momentsEn: [],
    distribution: [],
    distributionEn: [],
  },

  hrv: {
    id: 'hrv',
    title: 'Équilibre Nerveux & VRC',
    titleEn: 'HRV (RMSSD)',
    unit: 'ms',
    currentValue: '--',
    badge: '--',
    badgeEn: '--',
    periodText: "Aujourd'hui",
    periodTextEn: 'Today',
    summary: 'Variabilité de la fréquence cardiaque (balance sympathique/parasympathique).',
    summaryEn: 'Heart rate variability reflecting autonomic nervous balance.',
    advice: 'La VFC est calculée principalement durant vos cycles de sommeil profond.',
    adviceEn: 'HRV is calculated primarily during nocturnal deep sleep cycles.',
    accentColor: '#D9F970',
    iconName: 'activity',
    minVal: 20,
    maxVal: 120,
    points24h: [],
    points7d: [],
    points30d: [],
    stats: [],
    statsEn: [],
    moments: [],
    momentsEn: [],
    distribution: [],
    distributionEn: [],
  },

  temp: {
    id: 'temp',
    title: 'Température Cutanée',
    titleEn: 'Skin Temperature',
    unit: '°C',
    currentValue: '--',
    badge: '--',
    badgeEn: '--',
    periodText: "Aujourd'hui",
    periodTextEn: 'Today',
    summary: 'Écart thermique nocturne capté par le capteur thermique infrarouge.',
    summaryEn: 'Nocturnal baseline thermal variation recorded by infrared ring sensor.',
    advice: 'Une variation de ±0.3°C est physiologique et reflète les rythmes circadiens.',
    adviceEn: 'A variation of ±0.3°C is normal circadian biological rhythm.',
    accentColor: '#F59E0B',
    iconName: 'thermometer',
    minVal: -1.0,
    maxVal: 1.0,
    points24h: [],
    points7d: [],
    points30d: [],
    stats: [],
    statsEn: [],
    moments: [],
    momentsEn: [],
    distribution: [],
    distributionEn: [],
  },

  spo2: {
    id: 'spo2',
    title: 'Saturation en Oxygène',
    titleEn: 'Blood Oxygen (SpO2)',
    unit: '%',
    currentValue: '--',
    badge: '--',
    badgeEn: '--',
    periodText: "Aujourd'hui",
    periodTextEn: 'Today',
    summary: 'Saturation pulsée en oxygène mesurée par photopléthysmographie rouge/IR.',
    summaryEn: 'Pulse oxygen saturation measured by red and infrared optical sensors.',
    advice: 'Un taux compris entre 95% et 100% indique une excellente oxygénation.',
    adviceEn: 'Values between 95% and 100% indicate optimal blood oxygenation.',
    accentColor: '#EC4899',
    iconName: 'droplets',
    minVal: 90,
    maxVal: 100,
    points24h: [],
    points7d: [],
    points30d: [],
    stats: [],
    statsEn: [],
    moments: [],
    momentsEn: [],
    distribution: [],
    distributionEn: [],
  },

  resp: {
    id: 'resp',
    title: 'Fréquence Respiratoire',
    titleEn: 'Respiratory Rate',
    unit: 'rpm',
    currentValue: '--',
    badge: '--',
    badgeEn: '--',
    periodText: "Aujourd'hui",
    periodTextEn: 'Today',
    summary: 'Nombre de cycles respiratoires par minute pendant le sommeil.',
    summaryEn: 'Respiratory cycles per minute recorded during sleep.',
    advice: 'Une fréquence stable (12-18 rpm) témoigne d’un système respiratoire équilibré.',
    adviceEn: 'A stable rate (12-18 rpm) indicates healthy respiratory mechanics.',
    accentColor: '#06B6D4',
    iconName: 'wind',
    minVal: 8,
    maxVal: 24,
    points24h: [],
    points7d: [],
    points30d: [],
    stats: [],
    statsEn: [],
    moments: [],
    momentsEn: [],
    distribution: [],
    distributionEn: [],
  },

  stress: {
    id: 'stress',
    title: 'Niveau de Stress',
    titleEn: 'Stress Level',
    unit: '/100',
    currentValue: '--',
    badge: '--',
    badgeEn: '--',
    periodText: "Aujourd'hui",
    periodTextEn: 'Today',
    summary: 'Indice de charge allostatique calculé à partir de la variabilité cardiaque.',
    summaryEn: 'Allostatic load index calculated from autonomic heart rate dynamics.',
    advice: 'Prenez quelques minutes de respiration guidée pour réguler le système nerveux.',
    adviceEn: 'Practice guided cardiac coherence breathing to soothe autonomic tone.',
    accentColor: '#34D399',
    iconName: 'activity',
    minVal: 0,
    maxVal: 100,
    points24h: [],
    points7d: [],
    points30d: [],
    stats: [],
    statsEn: [],
    moments: [],
    momentsEn: [],
    distribution: [],
    distributionEn: [],
  },

  bp: {
    id: 'bp',
    title: 'Tension Artérielle Estimée',
    titleEn: 'Estimated Blood Pressure',
    unit: 'mmHg',
    currentValue: '--/--',
    badge: '--',
    badgeEn: '--',
    periodText: "Aujourd'hui",
    periodTextEn: 'Today',
    summary: 'Estimation de l’onde de pression par temps de transit de l’onde de pouls (PTT).',
    summaryEn: 'Pulse transit time waveform assessment from optical sensor telemetry.',
    advice: 'L’estimation est affinée lors des mesures de repos et de calibration.',
    adviceEn: 'Estimates are tuned during calm resting baseline calibrations.',
    accentColor: '#F43F5E',
    iconName: 'heart',
    minVal: 60,
    maxVal: 180,
    points24h: [],
    points7d: [],
    points30d: [],
    stats: [],
    statsEn: [],
    moments: [],
    momentsEn: [],
    distribution: [],
    distributionEn: [],
  },

  glucose: {
    id: 'glucose',
    title: 'Stabilité Glycémique',
    titleEn: 'Glucose Dynamics',
    unit: 'mmol/L',
    currentValue: '--',
    badge: '--',
    badgeEn: '--',
    periodText: "Aujourd'hui",
    periodTextEn: 'Today',
    summary: 'Index de stabilité métabolique et de réponse post-prandiale.',
    summaryEn: 'Metabolic stability index and postprandial glycemic variance.',
    advice: 'Favorisez des repas équilibrés pour maintenir une courbe métabolique stable.',
    adviceEn: 'Maintain balanced meals to support stable glycemic recovery.',
    accentColor: '#818CF8',
    iconName: 'activity',
    minVal: 3.5,
    maxVal: 10.0,
    points24h: [],
    points7d: [],
    points30d: [],
    stats: [],
    statsEn: [],
    moments: [],
    momentsEn: [],
    distribution: [],
    distributionEn: [],
  },
};
