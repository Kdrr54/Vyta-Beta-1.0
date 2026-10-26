export interface MetricDataPoint {
  label: string; // e.g. "02h", "Mar", "J-5"
  value: number;
  info?: string; // Short context e.g. "Sommeil profond", "Effort"
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
  pointIndex: number; // Index to highlight on 24h chart
}

export interface ZoneDistribution {
  name: string;
  percent: number;
  duration: string;
}

export interface MetricDetailItem {
  id: 'bpm' | 'hrv' | 'temp' | 'spo2' | 'resp';
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

export const METRIC_DETAILS: Record<'bpm' | 'hrv' | 'temp' | 'spo2' | 'resp', MetricDetailItem> = {
  bpm: {
    id: 'bpm',
    title: 'Fréquence Cardiaque',
    titleEn: 'Heart Rate',
    unit: 'BPM',
    currentValue: '59',
    badge: 'Repos optimal',
    badgeEn: 'Optimal Resting',
    periodText: "Aujourd'hui",
    periodTextEn: 'Today',
    summary: 'Rythme cardiaque régulier et repos nocturne idéal.',
    summaryEn: 'Steady heart rhythm and optimal nightly recovery.',
    advice: "Excellente réserve cardiaque. Votre corps est prêt pour un effort soutenu aujourd'hui.",
    adviceEn: 'Excellent cardiac reserve. Your body is ready for sustained performance today.',
    accentColor: '#FF3B30',
    iconName: 'heart',
    minVal: 45,
    maxVal: 170,
    points24h: [
      { label: '00h', value: 52, info: 'Sommeil' },
      { label: '01h', value: 50, info: 'Sommeil profond' },
      { label: '02h', value: 48, info: 'Creux nocturne' },
      { label: '03h', value: 49, info: 'Sommeil' },
      { label: '04h', value: 50, info: 'Sommeil profond' },
      { label: '05h', value: 53, info: 'Fin de nuit' },
      { label: '06h', value: 56, info: 'Transition' },
      { label: '07h', value: 65, info: 'Réveil' },
      { label: '08h', value: 72, info: 'Matinée' },
      { label: '09h', value: 66, info: 'Activité calme' },
      { label: '10h', value: 64, info: 'Repos' },
      { label: '11h', value: 68, info: 'Calme' },
      { label: '12h', value: 76, info: 'Déjeuner' },
      { label: '13h', value: 71, info: 'Digestion' },
      { label: '14h', value: 65, info: 'Travail' },
      { label: '15h', value: 63, info: 'Calme' },
      { label: '16h', value: 69, info: 'Marche' },
      { label: '17h', value: 66, info: 'Fin de journée' },
      { label: '18h', value: 142, info: 'Course' },
      { label: '19h', value: 164, info: 'Pic effort' },
      { label: '20h', value: 85, info: 'Récupération' },
      { label: '21h', value: 66, info: 'Dîner' },
      { label: '22h', value: 60, info: 'Repos du soir' },
      { label: '23h', value: 54, info: 'Endormissement' },
    ],
    points7d: [
      { label: 'Lun', value: 62, info: 'Moyenne 62 bpm' },
      { label: 'Mar', value: 60, info: 'Moyenne 60 bpm' },
      { label: 'Mer', value: 65, info: 'Moyenne 65 bpm' },
      { label: 'Jeu', value: 59, info: 'Moyenne 59 bpm' },
      { label: 'Ven', value: 61, info: 'Moyenne 61 bpm' },
      { label: 'Sam', value: 64, info: 'Moyenne 64 bpm' },
      { label: 'Dim', value: 58, info: 'Moyenne 58 bpm' },
    ],
    points30d: [
      { label: '1', value: 63 }, { label: '3', value: 62 }, { label: '5', value: 60 },
      { label: '7', value: 61 }, { label: '9', value: 64 }, { label: '11', value: 62 },
      { label: '13', value: 59 }, { label: '15', value: 60 }, { label: '17', value: 58 },
      { label: '19', value: 62 }, { label: '21', value: 61 }, { label: '23', value: 59 },
      { label: '25', value: 60 }, { label: '27', value: 58 }, { label: '30', value: 59 },
    ],
    stats: [
      { label: 'Minimum', value: '48 bpm', sub: 'à 02:15 (Nuit)' },
      { label: 'Moyenne', value: '68 bpm', sub: 'Normale : 60-80' },
      { label: 'Maximum', value: '164 bpm', sub: 'à 18:42 (Course)' },
    ],
    statsEn: [
      { label: 'Minimum', value: '48 bpm', sub: 'at 02:15 (Night)' },
      { label: 'Average', value: '68 bpm', sub: 'Normal: 60-80' },
      { label: 'Maximum', value: '164 bpm', sub: 'at 18:42 (Running)' },
    ],
    moments: [
      { time: '02:15', title: 'Repos profond', value: '48 bpm', tag: 'Nuit', pointIndex: 2 },
      { time: '18:42', title: 'Course à pied', value: '164 bpm', tag: 'Effort', pointIndex: 19 },
      { time: '20:30', title: 'Retour au calme', value: '62 bpm', tag: 'Récup', pointIndex: 20 },
    ],
    momentsEn: [
      { time: '02:15', title: 'Deep Rest', value: '48 bpm', tag: 'Night', pointIndex: 2 },
      { time: '18:42', title: 'Running Session', value: '164 bpm', tag: 'Workout', pointIndex: 19 },
      { time: '20:30', title: 'Heart Recovery', value: '62 bpm', tag: 'Cooldown', pointIndex: 20 },
    ],
    distribution: [
      { name: 'Repos & Sommeil', percent: 79, duration: '19h' },
      { name: 'Activité modérée', percent: 16, duration: '4h' },
      { name: 'Effort cardio', percent: 5, duration: '1h' },
    ],
    distributionEn: [
      { name: 'Rest & Sleep', percent: 79, duration: '19h' },
      { name: 'Moderate Activity', percent: 16, duration: '4h' },
      { name: 'Cardio Effort', percent: 5, duration: '1h' },
    ],
  },

  hrv: {
    id: 'hrv',
    title: 'Équilibre Nerveux & VRC',
    titleEn: 'HRV (RMSSD)',
    unit: 'ms',
    currentValue: '74',
    badge: '+8 ms vs Base',
    badgeEn: '+8 ms vs Base',
    periodText: "Aujourd'hui",
    periodTextEn: 'Today',
    summary: "Système nerveux équilibré et excellente capacité d'adaptation.",
    summaryEn: 'Autonomic nervous balance and high stress resilience.',
    advice: 'Votre organisme est pleinement régénéré. Niveau de fatigue minimale.',
    adviceEn: 'Your body is fully recovered. Low physiological strain.',
    accentColor: '#D9F970',
    iconName: 'activity',
    minVal: 30,
    maxVal: 95,
    points24h: [
      { label: '00h', value: 64, info: 'Nuit' },
      { label: '01h', value: 72, info: 'Sommeil' },
      { label: '02h', value: 79, info: 'Régénération' },
      { label: '03h', value: 85, info: 'Pic VRC' },
      { label: '04h', value: 88, info: 'Pic nuit' },
      { label: '05h', value: 81, info: 'Sommeil' },
      { label: '06h', value: 74, info: 'Éveil' },
      { label: '07h', value: 68, info: 'Matin' },
      { label: '08h', value: 58, info: 'Déplacement' },
      { label: '09h', value: 65, info: 'Calme' },
      { label: '10h', value: 67, info: 'Focus' },
      { label: '11h', value: 61, info: 'Activité' },
      { label: '12h', value: 56, info: 'Repas' },
      { label: '13h', value: 53, info: 'Digestion' },
      { label: '14h', value: 62, info: 'Reprise' },
      { label: '15h', value: 66, info: 'Stabilité' },
      { label: '16h', value: 63, info: 'Normal' },
      { label: '17h', value: 65, info: 'Détente' },
      { label: '18h', value: 41, info: 'Effort running' },
      { label: '19h', value: 38, info: 'Effort max' },
      { label: '20h', value: 52, info: 'Récupération' },
      { label: '21h', value: 68, info: 'Soirée' },
      { label: '22h', value: 74, info: 'Détente' },
      { label: '23h', value: 71, info: 'Coucher' },
    ],
    points7d: [
      { label: 'Lun', value: 68, info: 'Moyenne 68 ms' },
      { label: 'Mar', value: 71, info: 'Moyenne 71 ms' },
      { label: 'Mer', value: 66, info: 'Moyenne 66 ms' },
      { label: 'Jeu', value: 73, info: 'Moyenne 73 ms' },
      { label: 'Ven', value: 70, info: 'Moyenne 70 ms' },
      { label: 'Sam', value: 75, info: 'Moyenne 75 ms' },
      { label: 'Dim', value: 74, info: 'Moyenne 74 ms' },
    ],
    points30d: [
      { label: '1', value: 66 }, { label: '3', value: 68 }, { label: '5', value: 70 },
      { label: '7', value: 69 }, { label: '9', value: 67 }, { label: '11', value: 71 },
      { label: '13', value: 73 }, { label: '15', value: 72 }, { label: '17', value: 70 },
      { label: '19', value: 74 }, { label: '21', value: 72 }, { label: '23', value: 75 },
      { label: '25', value: 73 }, { label: '27', value: 74 }, { label: '30', value: 74 },
    ],
    stats: [
      { label: 'Minimum', value: '38 ms', sub: 'à 18:50 (Effort)' },
      { label: 'Moyenne', value: '74 ms', sub: 'Baseline : 66 ms' },
      { label: 'Pic Nuit', value: '88 ms', sub: 'à 04:10 (Sommeil)' },
    ],
    statsEn: [
      { label: 'Minimum', value: '38 ms', sub: 'at 18:50 (Workout)' },
      { label: 'Average', value: '74 ms', sub: 'Baseline: 66 ms' },
      { label: 'Night Peak', value: '88 ms', sub: 'at 04:10 (Deep Sleep)' },
    ],
    moments: [
      { time: '04:10', title: 'Régénération maximale', value: '88 ms', tag: 'Sommeil', pointIndex: 4 },
      { time: '13:20', title: 'Pause médiane', value: '53 ms', tag: 'Digestion', pointIndex: 13 },
      { time: '22:15', title: 'Retour au calme', value: '74 ms', tag: 'Détente', pointIndex: 22 },
    ],
    momentsEn: [
      { time: '04:10', title: 'Peak Regeneration', value: '88 ms', tag: 'Sleep', pointIndex: 4 },
      { time: '13:20', title: 'Midday Dip', value: '53 ms', tag: 'Digestion', pointIndex: 13 },
      { time: '22:15', title: 'Parasympathetic Recovery', value: '74 ms', tag: 'Rest', pointIndex: 22 },
    ],
    distribution: [
      { name: 'Système apaisé', percent: 78, duration: '18h 40' },
      { name: 'Activité normale', percent: 18, duration: '4h 15' },
      { name: 'Effort intense', percent: 4, duration: '1h 05' },
    ],
    distributionEn: [
      { name: 'Parasympathetic (Rest)', percent: 78, duration: '18h 40' },
      { name: 'Daily Activity', percent: 18, duration: '4h 15' },
      { name: 'Intense Effort', percent: 4, duration: '1h 05' },
    ],
  },

  temp: {
    id: 'temp',
    title: 'Température Cutanée',
    titleEn: 'Skin Temperature',
    unit: '°C',
    currentValue: '-0,08',
    badge: 'Parfaitement stable',
    badgeEn: 'Optimal Stability',
    periodText: "Aujourd'hui",
    periodTextEn: 'Today',
    summary: 'Thermorégulation optimale et aucun signe inflammatoire.',
    summaryEn: 'Optimal thermoregulation and no inflammatory indicators.',
    advice: 'Chute thermique nocturne idéale. Aucun symptôme de fièvre ou de fatigue.',
    adviceEn: 'Ideal circadian nocturnal drop. No signs of fever or strain.',
    accentColor: '#FB923C',
    iconName: 'thermometer',
    minVal: -0.35,
    maxVal: 0.45,
    points24h: [
      { label: '00h', value: -0.10, info: 'Nuit' },
      { label: '01h', value: -0.16, info: 'Sommeil' },
      { label: '02h', value: -0.22, info: 'Nadir' },
      { label: '03h', value: -0.26, info: 'Creux thermique' },
      { label: '04h', value: -0.19, info: 'Sommeil profond' },
      { label: '05h', value: -0.12, info: 'Fin de nuit' },
      { label: '06h', value: -0.04, info: 'Réveil' },
      { label: '07h', value: 0.05, info: 'Lever' },
      { label: '08h', value: 0.08, info: 'Matin' },
      { label: '09h', value: 0.02, info: 'Stable' },
      { label: '10h', value: -0.01, info: 'Stable' },
      { label: '11h', value: 0.04, info: 'Normal' },
      { label: '12h', value: 0.09, info: 'Repas' },
      { label: '13h', value: 0.12, info: 'Digestion' },
      { label: '14h', value: 0.05, info: 'Stable' },
      { label: '15h', value: 0.02, info: 'Normal' },
      { label: '16h', value: 0.06, info: 'Activité' },
      { label: '17h', value: 0.03, info: 'Normal' },
      { label: '18h', value: 0.32, info: 'Effort course' },
      { label: '19h', value: 0.22, info: 'Fin sport' },
      { label: '20h', value: 0.04, info: 'Retour base' },
      { label: '21h', value: -0.02, info: 'Soir' },
      { label: '22h', value: -0.06, info: 'Détente' },
      { label: '23h', value: -0.08, info: 'Coucher' },
    ],
    points7d: [
      { label: 'Lun', value: -0.05, info: 'Écart -0.05°C' },
      { label: 'Mar', value: -0.08, info: 'Écart -0.08°C' },
      { label: 'Mer', value: -0.02, info: 'Écart -0.02°C' },
      { label: 'Jeu', value: -0.11, info: 'Écart -0.11°C' },
      { label: 'Ven', value: -0.06, info: 'Écart -0.06°C' },
      { label: 'Sam', value: 0.02, info: 'Écart +0.02°C' },
      { label: 'Dim', value: -0.08, info: 'Écart -0.08°C' },
    ],
    points30d: [
      { label: '1', value: -0.04 }, { label: '3', value: -0.06 }, { label: '5', value: -0.08 },
      { label: '7', value: -0.05 }, { label: '9', value: -0.02 }, { label: '11', value: -0.09 },
      { label: '13', value: -0.07 }, { label: '15', value: -0.05 }, { label: '17', value: -0.03 },
      { label: '19', value: -0.10 }, { label: '21', value: -0.08 }, { label: '23', value: -0.06 },
      { label: '25', value: -0.04 }, { label: '27', value: -0.07 }, { label: '30', value: -0.08 },
    ],
    stats: [
      { label: 'Creux Nuit', value: '-0,26 °C', sub: 'à 03:12 (Idéal)' },
      { label: 'Écart Moyen', value: '-0,08 °C', sub: 'Normal : ± 0,3°C' },
      { label: "Pic d'Effort", value: '+0,32 °C', sub: 'à 18:35 (Course)' },
    ],
    statsEn: [
      { label: 'Night Nadir', value: '-0.26 °C', sub: 'at 03:12 (Optimal)' },
      { label: 'Average Delta', value: '-0.08 °C', sub: 'Normal: ± 0.3°C' },
      { label: 'Workout Peak', value: '+0.32 °C', sub: 'at 18:35 (Run)' },
    ],
    moments: [
      { time: '03:12', title: 'Creux réparateur', value: '-0,26 °C', tag: 'Sommeil', pointIndex: 3 },
      { time: '13:30', title: 'Digestion déjeuner', value: '+0,12 °C', tag: 'Midi', pointIndex: 13 },
      { time: '18:35', title: 'Séance course', value: '+0,32 °C', tag: 'Effort', pointIndex: 18 },
    ],
    momentsEn: [
      { time: '03:12', title: 'Deep Circadian Nadir', value: '-0.26 °C', tag: 'Sleep', pointIndex: 3 },
      { time: '13:30', title: 'Digestive Thermogenesis', value: '+0.12 °C', tag: 'Midday', pointIndex: 13 },
      { time: '18:35', title: 'Muscular Workout Heat', value: '+0.32 °C', tag: 'Run', pointIndex: 18 },
    ],
    distribution: [
      { name: 'Fraîcheur nocturne', percent: 70, duration: '7h 45' },
      { name: 'Stabilité diurne', percent: 26, duration: '15h 25' },
      { name: 'Élévation sportive', percent: 4, duration: '50 min' },
    ],
    distributionEn: [
      { name: 'Nocturnal Cool', percent: 70, duration: '7h 45' },
      { name: 'Daytime Baseline', percent: 26, duration: '15h 25' },
      { name: 'Workout Heat', percent: 4, duration: '50 min' },
    ],
  },

  spo2: {
    id: 'spo2',
    title: 'Oxygénation SpO2',
    titleEn: 'Oxygenation SpO2',
    unit: '%',
    currentValue: '98.6',
    badge: 'Optimal',
    badgeEn: 'Optimal',
    periodText: "Aujourd'hui",
    periodTextEn: 'Today',
    summary: 'Excellente saturation en oxygène et respiration continue sans interruption.',
    summaryEn: 'Excellent blood oxygen saturation with smooth, uninterrupted breathing.',
    advice: "Oxygénation parfaite jour et nuit. Zéro épisode de désaturation ou d'apnée.",
    adviceEn: 'Flawless oxygenation day and night. Zero desaturation or apnea events.',
    accentColor: '#E879F9',
    iconName: 'droplets',
    minVal: 95.0,
    maxVal: 100.0,
    points24h: [
      { label: '00h', value: 98.4, info: 'Nuit' },
      { label: '01h', value: 98.2, info: 'Régulier' },
      { label: '02h', value: 98.6, info: 'Sommeil' },
      { label: '03h', value: 98.8, info: 'Optimal' },
      { label: '04h', value: 98.5, info: 'Calme' },
      { label: '05h', value: 98.7, info: 'Régulier' },
      { label: '06h', value: 98.9, info: 'Réveil' },
      { label: '07h', value: 99.1, info: 'Lever' },
      { label: '08h', value: 98.8, info: 'Matin' },
      { label: '09h', value: 98.7, info: 'Travail' },
      { label: '10h', value: 98.9, info: 'Optimal' },
      { label: '11h', value: 98.6, info: 'Calme' },
      { label: '12h', value: 98.5, info: 'Repas' },
      { label: '13h', value: 98.7, info: 'Après-midi' },
      { label: '14h', value: 98.8, info: 'Optimal' },
      { label: '15h', value: 99.0, info: 'Air frais' },
      { label: '16h', value: 98.6, info: 'Stable' },
      { label: '17h', value: 98.7, info: 'Calme' },
      { label: '18h', value: 97.9, info: 'Effort running' },
      { label: '19h', value: 98.8, info: 'Récupération' },
      { label: '20h', value: 98.6, info: 'Dîner' },
      { label: '21h', value: 98.9, info: 'Détente' },
      { label: '22h', value: 98.7, info: 'Calme' },
      { label: '23h', value: 98.6, info: 'Nuit' },
    ],
    points7d: [
      { label: 'Lun', value: 98.5, info: 'Moyenne 98.5%' },
      { label: 'Mar', value: 98.8, info: 'Moyenne 98.8%' },
      { label: 'Mer', value: 98.4, info: 'Moyenne 98.4%' },
      { label: 'Jeu', value: 98.7, info: 'Moyenne 98.7%' },
      { label: 'Ven', value: 98.6, info: 'Moyenne 98.6%' },
      { label: 'Sam', value: 98.9, info: 'Moyenne 98.9%' },
      { label: 'Dim', value: 98.6, info: 'Moyenne 98.6%' },
    ],
    points30d: [
      { label: '1', value: 98.4 }, { label: '3', value: 98.6 }, { label: '5', value: 98.5 },
      { label: '7', value: 98.7 }, { label: '9', value: 98.6 }, { label: '11', value: 98.8 },
      { label: '13', value: 98.5 }, { label: '15', value: 98.7 }, { label: '17', value: 98.6 },
      { label: '19', value: 98.8 }, { label: '21', value: 98.7 }, { label: '23', value: 98.9 },
      { label: '25', value: 98.6 }, { label: '27', value: 98.7 }, { label: '30', value: 98.6 },
    ],
    stats: [
      { label: 'Minimum', value: '97,2 %', sub: 'Seuil sécurité > 95%' },
      { label: 'Moyenne', value: '98,6 %', sub: 'Saturation optimale' },
      { label: 'Apnées', value: '0 événement', sub: 'Respiration fluide' },
    ],
    statsEn: [
      { label: 'Minimum', value: '97.2 %', sub: 'Safety threshold > 95%' },
      { label: 'Average', value: '98.6 %', sub: 'Optimal saturation' },
      { label: 'Apneas', value: '0 events', sub: 'Continuous airflow' },
    ],
    moments: [
      { time: '02:40', title: 'Nuit sans apnée', value: '98.6 %', tag: 'Sommeil', pointIndex: 2 },
      { time: '07:15', title: 'Oxygénation matinale', value: '99.1 %', tag: 'Réveil', pointIndex: 7 },
      { time: '18:40', title: 'Maintien sous effort', value: '97.9 %', tag: 'Course', pointIndex: 18 },
    ],
    momentsEn: [
      { time: '02:40', title: 'Clear Night Airflow', value: '98.6 %', tag: 'Sleep', pointIndex: 2 },
      { time: '07:15', title: 'Wake Oxygen Intake', value: '99.1 %', tag: 'Morning', pointIndex: 7 },
      { time: '18:40', title: 'Endurance Saturation', value: '97.9 %', tag: 'Run', pointIndex: 18 },
    ],
    distribution: [
      { name: 'Optimal (98 - 100%)', percent: 92, duration: '22h' },
      { name: 'Normal (96 - 97%)', percent: 8, duration: '2h' },
      { name: 'Basse (< 95%)', percent: 0, duration: '0 min' },
    ],
    distributionEn: [
      { name: 'Optimal (98 - 100%)', percent: 92, duration: '22h' },
      { name: 'Normal (96 - 97%)', percent: 8, duration: '2h' },
      { name: 'Low (< 95%)', percent: 0, duration: '0 min' },
    ],
  },

  resp: {
    id: 'resp',
    title: 'Fréquence Respiratoire',
    titleEn: 'Respiratory Rate',
    unit: 'rpm',
    currentValue: '14.2',
    badge: 'Optimale',
    badgeEn: 'Optimal',
    periodText: "Aujourd'hui",
    periodTextEn: 'Today',
    summary: 'Rythme respiratoire régulier et apaisé pendant la phase de repos.',
    summaryEn: 'Smooth, steady respiratory rate throughout resting and recovery periods.',
    advice: 'Fréquence optimale entre 12 et 16 rpm. Zéro signe d’hyperventilation nocturne.',
    adviceEn: 'Optimal rate between 12 and 16 rpm. Zero signs of nocturnal hyperventilation.',
    accentColor: '#38BDF8',
    iconName: 'wind',
    minVal: 11.0,
    maxVal: 18.0,
    points24h: [
      { label: '00h', value: 13.8, info: 'Nuit calme' },
      { label: '01h', value: 13.5, info: 'Sommeil lent' },
      { label: '02h', value: 13.2, info: 'Profond' },
      { label: '03h', value: 12.9, info: 'Nadir' },
      { label: '04h', value: 13.1, info: 'Profond' },
      { label: '05h', value: 13.6, info: 'REM' },
      { label: '06h', value: 14.1, info: 'Réveil' },
      { label: '07h', value: 14.8, info: 'Lever' },
      { label: '08h', value: 14.4, info: 'Matin' },
      { label: '09h', value: 14.2, info: 'Focus travail' },
      { label: '10h', value: 14.0, info: 'Calme' },
      { label: '11h', value: 14.3, info: 'Stable' },
      { label: '12h', value: 14.5, info: 'Repas' },
      { label: '13h', value: 14.2, info: 'Pause' },
      { label: '14h', value: 13.9, info: 'Calme' },
      { label: '15h', value: 14.2, info: 'Focus' },
      { label: '16h', value: 14.4, info: 'Stable' },
      { label: '17h', value: 14.7, info: 'Fin journée' },
      { label: '18h', value: 16.8, info: 'Effort running' },
      { label: '19h', value: 14.9, info: 'Récupération' },
      { label: '20h', value: 14.4, info: 'Dîner' },
      { label: '21h', value: 14.1, info: 'Détente' },
      { label: '22h', value: 13.8, info: 'Coucher' },
      { label: '23h', value: 13.6, info: 'Endormissement' },
    ],
    points7d: [
      { label: 'Lun', value: 14.1, info: 'Moyenne 14.1 rpm' },
      { label: 'Mar', value: 14.3, info: 'Moyenne 14.3 rpm' },
      { label: 'Mer', value: 13.9, info: 'Moyenne 13.9 rpm' },
      { label: 'Jeu', value: 14.2, info: 'Moyenne 14.2 rpm' },
      { label: 'Ven', value: 14.0, info: 'Moyenne 14.0 rpm' },
      { label: 'Sam', value: 13.8, info: 'Moyenne 13.8 rpm' },
      { label: 'Dim', value: 14.1, info: 'Moyenne 14.1 rpm' },
    ],
    points30d: [
      { label: '1', value: 14.0 }, { label: '3', value: 14.2 }, { label: '5', value: 13.9 },
      { label: '7', value: 14.1 }, { label: '9', value: 14.3 }, { label: '11', value: 14.0 },
      { label: '13', value: 14.2 }, { label: '15', value: 13.8 }, { label: '17', value: 14.1 },
      { label: '19', value: 14.4 }, { label: '21', value: 14.2 }, { label: '23', value: 14.0 },
      { label: '25', value: 14.3 }, { label: '27', value: 14.1 }, { label: '30', value: 14.2 },
    ],
    stats: [
      { label: 'Creux Sommeil', value: '12,9 rpm', sub: 'à 03:20 (Idéal)' },
      { label: 'Moyenne Repos', value: '14,2 rpm', sub: 'Norme : 12-16 rpm' },
      { label: 'Stabilité RSA', value: '98 %', sub: 'Rythme sinusal sain' },
    ],
    statsEn: [
      { label: 'Sleep Nadir', value: '12.9 rpm', sub: 'at 03:20 (Optimal)' },
      { label: 'Resting Average', value: '14.2 rpm', sub: 'Normal: 12-16 rpm' },
      { label: 'RSA Stability', value: '98 %', sub: 'Healthy sinus rhythm' },
    ],
    moments: [
      { time: '03:20', title: 'Apaisement profond', value: '12.9 rpm', tag: 'Sommeil', pointIndex: 3 },
      { time: '08:00', title: 'Rythme matinal calme', value: '14.4 rpm', tag: 'Matin', pointIndex: 8 },
      { time: '18:30', title: 'Ventilation running', value: '16.8 rpm', tag: 'Effort', pointIndex: 18 },
    ],
    momentsEn: [
      { time: '03:20', title: 'Deep Respiration Nadir', value: '12.9 rpm', tag: 'Sleep', pointIndex: 3 },
      { time: '08:00', title: 'Calm Wake Flow', value: '14.4 rpm', tag: 'Morning', pointIndex: 8 },
      { time: '18:30', title: 'Aerobic Ventilation', value: '16.8 rpm', tag: 'Run', pointIndex: 18 },
    ],
    distribution: [
      { name: 'Optimal (12 - 16 rpm)', percent: 94, duration: '22h 30' },
      { name: 'Modéré (16 - 18 rpm)', percent: 6, duration: '1h 30' },
      { name: 'Élevé (> 18 rpm)', percent: 0, duration: '0 min' },
    ],
    distributionEn: [
      { name: 'Optimal (12 - 16 rpm)', percent: 94, duration: '22h 30' },
      { name: 'Moderate (16 - 18 rpm)', percent: 6, duration: '1h 30' },
      { name: 'Elevated (> 18 rpm)', percent: 0, duration: '0 min' },
    ],
  },
};
