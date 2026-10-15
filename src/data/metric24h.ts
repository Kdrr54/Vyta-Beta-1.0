export interface HourlyMetricPoint {
  hour: string; // e.g. "00h", "01h", ... "23h"
  value: number;
  label?: string;
  isSleep?: boolean;
  isWorkout?: boolean;
}

export interface MetricStatItem {
  label: string;
  value: string;
  sub: string;
  status?: 'good' | 'optimal' | 'warning';
}

export interface MetricMomentItem {
  time: string;
  title: string;
  value: string;
  tag: string;
  desc: string;
}

export interface MetricBreakdownItem {
  label: string;
  timeStr: string;
  percentage: number;
  color: string;
  detail: string;
}

export interface Metric24hDetail {
  id: 'bpm' | 'hrv' | 'temp' | 'spo2';
  title: string;
  subtitle: string;
  iconName: 'heart' | 'activity' | 'thermometer' | 'droplets';
  accentColor: string;
  unit: string;
  currentValue: string;
  badge: string;
  periodText: string;
  minVal: number;
  maxVal: number;
  hourly: HourlyMetricPoint[];
  stats: MetricStatItem[];
  breakdownTitle: string;
  breakdownItems: MetricBreakdownItem[];
  moments: MetricMomentItem[];
  aiInsight: {
    title: string;
    summary: string;
    recommendation: string;
  };
}

export const METRIC_DETAILS_24H: Record<'bpm' | 'hrv' | 'temp' | 'spo2', Metric24hDetail> = {
  bpm: {
    id: 'bpm',
    title: 'Fréquence Cardiaque',
    subtitle: 'Capteur PPG Infrarouge & Vert · Bague Vyta One',
    iconName: 'heart',
    accentColor: '#FF3B30',
    unit: 'BPM',
    currentValue: '59',
    badge: 'Direct (Repos)',
    periodText: 'Aujourd\'hui · 24 heures en continu',
    minVal: 48,
    maxVal: 165,
    hourly: [
      { hour: '00h', value: 52, label: 'Sommeil léger', isSleep: true },
      { hour: '01h', value: 50, label: 'Sommeil profond', isSleep: true },
      { hour: '02h', value: 48, label: 'Creux FC nocturne (Nadir)', isSleep: true },
      { hour: '03h', value: 49, label: 'Sommeil paradoxal', isSleep: true },
      { hour: '04h', value: 50, label: 'Sommeil profond', isSleep: true },
      { hour: '05h', value: 53, label: 'Sommeil léger', isSleep: true },
      { hour: '06h', value: 56, label: 'Pré-réveil circadien', isSleep: true },
      { hour: '07h', value: 65, label: 'Réveil & hydratation' },
      { hour: '08h', value: 72, label: 'Déplacement actif' },
      { hour: '09h', value: 66, label: 'Travail au calme' },
      { hour: '10h', value: 64, label: 'Concentration' },
      { hour: '11h', value: 68, label: 'Activité cérébrale' },
      { hour: '12h', value: 76, label: 'Déjeuner' },
      { hour: '13h', value: 71, label: 'Digestion' },
      { hour: '14h', value: 65, label: 'Session de travail' },
      { hour: '15h', value: 63, label: 'Pause détente' },
      { hour: '16h', value: 69, label: 'Marche active' },
      { hour: '17h', value: 66, label: 'Fin de journée' },
      { hour: '18h', value: 142, label: 'Course Parc Monceau (Échauffement)', isWorkout: true },
      { hour: '19h', value: 164, label: 'Pic d\'effort 4:48/km (Allure max)', isWorkout: true },
      { hour: '20h', value: 85, label: 'Récupération post-séance' },
      { hour: '21h', value: 66, label: 'Dîner équilibré' },
      { hour: '22h', value: 60, label: 'Détente du soir' },
      { hour: '23h', value: 54, label: 'Préparation au sommeil', isSleep: true },
    ],
    stats: [
      { label: 'FC Repos (Nuit)', value: '51 bpm', sub: '-3 bpm vs normale', status: 'optimal' },
      { label: 'Minimum 24h', value: '48 bpm', sub: 'à 02h15 (sommeil profond)', status: 'good' },
      { label: 'Moyenne 24h', value: '68 bpm', sub: 'Rythme optimal', status: 'good' },
      { label: 'Pic Max Cardio', value: '164 bpm', sub: 'à 18h42 (Course à pied)', status: 'optimal' },
    ],
    breakdownTitle: 'Répartition des Zones Cardiaques (24h)',
    breakdownItems: [
      { label: 'Zone 1 · Récupération', timeStr: '19 h 12 min', percentage: 80, color: '#30D158', detail: '< 115 bpm (Sommeil & sédentarité)' },
      { label: 'Zone 2 · Endurance Fondamentale', timeStr: '2 h 45 min', percentage: 11, color: '#0A84FF', detail: '115 - 132 bpm (Marche & mobilité)' },
      { label: 'Zone 3 · Aérobie & Tempo', timeStr: '28 min', percentage: 5, color: '#FFD60A', detail: '133 - 152 bpm (Allure de course stable)' },
      { label: 'Zone 4 · Seuil Lactique', timeStr: '18 min', percentage: 3, color: '#FF9F0A', detail: '153 - 162 bpm (Accélération Parc Monceau)' },
      { label: 'Zone 5 · Anaérobie / Puissance', timeStr: '3 min', percentage: 1, color: '#FF453A', detail: '> 162 bpm (Sprint final 1 km)' },
    ],
    moments: [
      { time: '02h15', title: 'Creux FC Nocturne (Nadir)', value: '48 bpm', tag: 'Récupération Profonde', desc: 'Le myocarde ralentit au maximum durant le cycle de sommeil profond N3.' },
      { time: '07h10', title: 'Éveil & Montée Cardiaque', value: '65 bpm', tag: 'Rythme Circadien', desc: 'Montée naturelle du cortisol pour dynamiser le corps dès le lever.' },
      { time: '13h15', title: 'Pic Post-Prandial', value: '76 bpm', tag: 'Digestion', desc: 'Léger surcroît métabolique classique après le déjeuner.' },
      { time: '18h42', title: 'Course à Pied Parc Monceau', value: '164 bpm', tag: 'Effort Maximal', desc: 'Séance aérobie intense de 8,12 km avec maintien d\'une excellente cinétique.' },
      { time: '20h30', title: 'Retour au Calme Végétatif', value: '62 bpm', tag: 'Baisse Rapide', desc: 'Baisse rapide de la FC sous 65 bpm, signe d\'une excellente condition physique.' },
    ],
    aiInsight: {
      title: 'Diagnostic Cardio CoVyta IA',
      summary: 'Votre fréquence cardiaque de repos à 51 bpm témoigne d\'une excellente réserve cardiaque. Votre pic d\'effort à 164 bpm lors de la course a été parfaitement soutenu sans arythmie.',
      recommendation: 'Prévoyez une hydratation riche en électrolytes ce soir pour maintenir la baisse de votre FC avant l\'endormissement.',
    },
  },

  hrv: {
    id: 'hrv',
    title: 'Variabilité de la Fréquence Cardiaque',
    subtitle: 'Métrique RMSSD · Équilibre du Système Nerveux Autonome',
    iconName: 'activity',
    accentColor: '#30D158',
    unit: 'ms',
    currentValue: '74',
    badge: '+8 ms vs Base',
    periodText: 'Aujourd\'hui · Suivi nocturne & diurne',
    minVal: 35,
    maxVal: 92,
    hourly: [
      { hour: '00h', value: 64, label: 'Endormissement', isSleep: true },
      { hour: '01h', value: 72, label: 'Sommeil profond', isSleep: true },
      { hour: '02h', value: 79, label: 'Régénération nerveuse', isSleep: true },
      { hour: '03h', value: 85, label: 'Pic parasympathique', isSleep: true },
      { hour: '04h', value: 88, label: 'Pic VRC nocturne (Nadir FC)', isSleep: true },
      { hour: '05h', value: 81, label: 'Sommeil paradoxal', isSleep: true },
      { hour: '06h', value: 74, label: 'Transition d\'éveil', isSleep: true },
      { hour: '07h', value: 68, label: 'Matinée équilibrée' },
      { hour: '08h', value: 58, label: 'Activation matinale' },
      { hour: '09h', value: 65, label: 'Focus & sérénité' },
      { hour: '10h', value: 67, label: 'Calme nerveux' },
      { hour: '11h', value: 61, label: 'Charge cognitive' },
      { hour: '12h', value: 56, label: 'Pause médiane' },
      { hour: '13h', value: 53, label: 'Sollicitation digestive' },
      { hour: '14h', value: 62, label: 'Reprise progressive' },
      { hour: '15h', value: 66, label: 'Stabilité nerveuse' },
      { hour: '16h', value: 63, label: 'Activité continue' },
      { hour: '17h', value: 65, label: 'Fin de journée zen' },
      { hour: '18h', value: 41, label: 'Effort physique (Sympathique activé)', isWorkout: true },
      { hour: '19h', value: 38, label: 'Pic d\'intensité running', isWorkout: true },
      { hour: '20h', value: 52, label: 'Récupération débutante' },
      { hour: '21h', value: 68, label: 'Relâchement du soir' },
      { hour: '22h', value: 74, label: 'Apaisement parasympathique' },
      { hour: '23h', value: 71, label: 'Entrée en nuit', isSleep: true },
    ],
    stats: [
      { label: 'VRC Moyenne Nuit', value: '74 ms', sub: 'Baseline : 66 ms (+12%)', status: 'optimal' },
      { label: 'Pic de Régénération', value: '88 ms', sub: 'à 04h10 (Sommeil profond)', status: 'optimal' },
      { label: 'Équilibre Nerveux', value: '95 / 100', sub: 'Parasympathique dominant', status: 'optimal' },
      { label: 'Score de Stress 24h', value: '18 / 100', sub: 'Très faible tension', status: 'good' },
    ],
    breakdownTitle: 'Balance Système Nerveux Autonome (SNA)',
    breakdownItems: [
      { label: 'Parasympathique (Régénération & Récupération)', timeStr: '18 h 40 min', percentage: 78, color: '#30D158', detail: 'Prédomine durant le sommeil et les phases de détente' },
      { label: 'Sympathique Modéré (Activité & Éveil)', timeStr: '4 h 15 min', percentage: 18, color: '#0A84FF', detail: 'Gestion des tâches professionnelles et déplacements' },
      { label: 'Sympathique Intense (Effort Sportif & Stress)', timeStr: '1 h 05 min', percentage: 4, color: '#FF9F0A', detail: 'Séance de course à pied et accélération motrice' },
    ],
    moments: [
      { time: '04h10', title: 'Apogée Parasympathique', value: '88 ms', tag: 'Réparation Cellulaire', desc: 'Le tonus vagal est à son maximum, favorisant la réparation musculaire et neuronale.' },
      { time: '09h30', title: 'Sérénité Cognitive', value: '67 ms', tag: 'Focus Zen', desc: 'Indice de relaxation élevé malgré le début de la session de travail intellectuelle.' },
      { time: '13h20', title: 'Creux Digestif Diurne', value: '53 ms', tag: 'Adaptation', desc: 'L\'afflux sanguin vers le tractus digestif diminue temporairement la variabilité.' },
      { time: '18h50', title: 'Suppression Sportive VRC', value: '38 ms', tag: 'Adaptation Cardiaque', desc: 'Baisse physiologique normale sous l\'effet de l\'adrénaline et de la tachycardie d\'effort.' },
      { time: '22h15', title: 'Rétablissement Parasympathique', value: '74 ms', tag: 'Pré-Sommeil Idéal', desc: 'Votre système nerveux est réinitialisé et prêt pour une nouvelle nuit réparatrice.' },
    ],
    aiInsight: {
      title: 'Analyse VRC CoVyta IA',
      summary: 'Votre VRC nocturne de 74 ms est en hausse de +8 ms par rapport à votre base. C\'est le marqueur objectif d\'une excellente faculté d\'adaptation nerveuse et de résilience face au stress.',
      recommendation: 'Profitez de cet état de forme optimal : votre système nerveux est prêt pour des charges d\'entraînement élevées.',
    },
  },

  temp: {
    id: 'temp',
    title: 'Température Cutanée',
    subtitle: 'Capteur Thermique Infrarouge Médical · Précision ±0,02 °C',
    iconName: 'thermometer',
    accentColor: '#FF9F0A',
    unit: '°C',
    currentValue: '-0,08',
    badge: 'Stable (Idéal)',
    periodText: 'Aujourd\'hui · Variations circadiennes 24h',
    minVal: -0.35,
    maxVal: 0.45,
    hourly: [
      { hour: '00h', value: -0.10, label: 'Endormissement régulé', isSleep: true },
      { hour: '01h', value: -0.16, label: 'Chute thermique nocturne', isSleep: true },
      { hour: '02h', value: -0.22, label: 'Baisse métabolique', isSleep: true },
      { hour: '03h', value: -0.26, label: 'Nadir circadien (Creux thermique)', isSleep: true },
      { hour: '04h', value: -0.19, label: 'Sommeil profond continu', isSleep: true },
      { hour: '05h', value: -0.12, label: 'Remontée basale', isSleep: true },
      { hour: '06h', value: -0.04, label: 'Préparation au réveil', isSleep: true },
      { hour: '07h', value: 0.05, label: 'Éveil thermique' },
      { hour: '08h', value: 0.08, label: 'Stabilité active' },
      { hour: '09h', value: 0.02, label: 'Température normale' },
      { hour: '10h', value: -0.01, label: 'Équilibre' },
      { hour: '11h', value: 0.04, label: 'Homéostasie' },
      { hour: '12h', value: 0.09, label: 'Post-déjeuner' },
      { hour: '13h', value: 0.12, label: 'Thermogenèse digestive' },
      { hour: '14h', value: 0.05, label: 'Stabilité' },
      { hour: '15h', value: 0.02, label: 'Homéostasie diurne' },
      { hour: '16h', value: 0.06, label: 'Activité normale' },
      { hour: '17h', value: 0.03, label: 'Fin d\'après-midi' },
      { hour: '18h', value: 0.32, label: 'Thermogenèse d\'effort (Running)', isWorkout: true },
      { hour: '19h', value: 0.22, label: 'Refroidissement post-sport' },
      { hour: '20h', value: 0.04, label: 'Retour à la ligne de base' },
      { hour: '21h', value: -0.02, label: 'Début de baisse vespérale' },
      { hour: '22h', value: -0.06, label: 'Vasodilatation distale' },
      { hour: '23h', value: -0.08, label: 'Baisse pré-nocturne', isSleep: true },
    ],
    stats: [
      { label: 'Écart Moyen Nuit', value: '-0,08 °C', sub: 'Baseline : 36,45 °C', status: 'optimal' },
      { label: 'Nadir Nocturne', value: '-0,26 °C', sub: 'à 03h12 (Baisse réparatrice)', status: 'optimal' },
      { label: 'Stabilité Circadienne', value: '98 %', sub: 'Aucune déviation anormale', status: 'optimal' },
      { label: 'Alerte Fébrile', value: '0 / 5', sub: 'Système immunitaire stable', status: 'good' },
    ],
    breakdownTitle: 'Cycle Circadien & Stabilité Thermique',
    breakdownItems: [
      { label: 'Baisse Nocturne Réparatrice (-0,10°C à -0,26°C)', timeStr: '7 h 45 min', percentage: 70, color: '#0A84FF', detail: 'Permet la synthèse d\'hormone de croissance et l\'endormissement' },
      { label: 'Stabilité Diurne Neutre (± 0,08°C)', timeStr: '15 h 25 min', percentage: 26, color: '#30D158', detail: 'Homéostasie métabolique parfaite tout au long de la journée' },
      { label: 'Thermogenèse d\'Effort (+0,32°C)', timeStr: '50 min', percentage: 4, color: '#FF9F0A', detail: 'Élévation de température attendue lors de la séance de cardio' },
    ],
    moments: [
      { time: '03h12', title: 'Creux Circadien (Nadir)', value: '-0,26 °C', tag: 'Sommeil Profond', desc: 'La température centrale baisse, signal biologique d\'une récupération métabolique optimale.' },
      { time: '07h05', title: 'Signal Thermique de Réveil', value: '+0,05 °C', tag: 'Horloge Biologique', desc: 'La vasodilatation cutanée remonte naturellement pour faciliter l\'alerte matinale.' },
      { time: '13h30', title: 'Thermogenèse Post-Prandiale', value: '+0,12 °C', tag: 'Métabolisme', desc: 'Chaleur produite par la dégradation des nutriments après le déjeuner.' },
      { time: '18h35', title: 'Thermogenèse Musculaire d\'Effort', value: '+0,32 °C', tag: 'Course 8,12 km', desc: 'Production thermique musculaire intense, compensée par la sudation cutanée.' },
      { time: '22h45', title: 'Vasodilatation Périphérique', value: '-0,08 °C', tag: 'Préparation Nuit', desc: 'La bague détecte la dispersion de chaleur annonçant l\'entrée en sommeil.' },
    ],
    aiInsight: {
      title: 'Bilan Thermique CoVyta IA',
      summary: 'Votre variation thermique cutanée de -0,08 °C reflète une thermorégulation saine. Le creux nocturne régulier (-0,26 °C) est la preuve d\'une excellente architecture de sommeil.',
      recommendation: 'Maintenez votre chambre entre 18°C et 19°C pour amplifier cette baisse thermique protectrice.',
    },
  },

  spo2: {
    id: 'spo2',
    title: 'Oxygénation SpO2',
    subtitle: 'Oxymétrie Pulsée Continue · Diodes Rouges & Infrarouges R21',
    iconName: 'droplets',
    accentColor: '#0A84FF',
    unit: '%',
    currentValue: '98.6',
    badge: 'Optimal (98 - 99%)',
    periodText: 'Aujourd\'hui · Saturation continue & respiration',
    minVal: 95.5,
    maxVal: 99.8,
    hourly: [
      { hour: '00h', value: 98.4, label: 'Saturation nocturne', isSleep: true },
      { hour: '01h', value: 98.2, label: 'Respiration régulière', isSleep: true },
      { hour: '02h', value: 98.6, label: 'Sommeil profond', isSleep: true },
      { hour: '03h', value: 98.8, label: 'Excellente hématose', isSleep: true },
      { hour: '04h', value: 98.5, label: 'Respiration calme', isSleep: true },
      { hour: '05h', value: 98.7, label: 'Sommeil continu', isSleep: true },
      { hour: '06h', value: 98.9, label: 'Oxygénation matinale', isSleep: true },
      { hour: '07h', value: 99.1, label: 'Lever & grande inspiration' },
      { hour: '08h', value: 98.8, label: 'Marche matinale' },
      { hour: '09h', value: 98.7, label: 'Travail' },
      { hour: '10h', value: 98.9, label: 'Respiration fluide' },
      { hour: '11h', value: 98.6, label: 'Stabilité' },
      { hour: '12h', value: 98.5, label: 'Déjeuner' },
      { hour: '13h', value: 98.7, label: 'Après-midi' },
      { hour: '14h', value: 98.8, label: 'Saturation optimale' },
      { hour: '15h', value: 99.0, label: 'Air frais' },
      { hour: '16h', value: 98.6, label: 'Stabilité' },
      { hour: '17h', value: 98.7, label: 'Fin de journée' },
      { hour: '18h', value: 97.9, label: 'Forte demande d\'O2 (Running)', isWorkout: true },
      { hour: '19h', value: 98.8, label: 'Récupération respiratoire' },
      { hour: '20h', value: 98.6, label: 'Dîner' },
      { hour: '21h', value: 98.9, label: 'Détente' },
      { hour: '22h', value: 98.7, label: 'Pré-nuit' },
      { hour: '23h', value: 98.6, label: 'Oxygénation nocturne', isSleep: true },
    ],
    stats: [
      { label: 'Saturation Moyenne', value: '98,6 %', sub: 'Norme médicale > 95%', status: 'optimal' },
      { label: 'Minimum 24h', value: '97,2 %', sub: 'Aucun passage sous 95%', status: 'optimal' },
      { label: 'Perturbations Resp.', value: '0 événement', sub: 'Indice IDE < 1 / heure', status: 'optimal' },
      { label: 'Rythme Respiratoire', value: '14,2 rpm', sub: 'Respiration calme et profonde', status: 'good' },
    ],
    breakdownTitle: 'Qualité Respiratoire & Paliers d\'Oxygénation',
    breakdownItems: [
      { label: 'Saturation Optimale (98 % - 100 %)', timeStr: '22 h 10 min', percentage: 92, color: '#0A84FF', detail: 'Hémoglobine saturée à plein rendement pour l\'ensemble des tissus' },
      { label: 'Saturation Normale Haute (96 % - 97 %)', timeStr: '1 h 50 min', percentage: 8, color: '#30D158', detail: 'Légères variations observées pendant l\'effort cardio soutenu' },
      { label: 'Désaturation Légère (< 95 %)', timeStr: '0 min', percentage: 0, color: '#FF453A', detail: 'Aucun épisode hypoxique ou apnéique détecté sur 24h' },
    ],
    moments: [
      { time: '02h40', title: 'Surveillance Apnées Nocturnes', value: '98.6 %', tag: '0 Apnée', desc: 'Le flux d\'air est continu et régulier, sans aucune pause respiratoire obstructive.' },
      { time: '07h15', title: 'Oxygénation de Réveil', value: '99.1 %', tag: 'Capacité Vitale', desc: 'Ample inspiration matinale assurant une ré-oxygénation cérébrale immédiate.' },
      { time: '14h30', title: 'Stabilité Respiratoire Diurne', value: '98.8 %', tag: 'Homéostasie', desc: 'Rythme respiratoire régulier à 14 respirations par minute pendant le travail.' },
      { time: '18h40', title: 'Échange Gazeux en Course', value: '97.9 %', tag: 'Effort Aérobie', desc: 'Excellente capacité de transport d\'oxygène face à la consommation musculaire maximale.' },
      { time: '22h50', title: 'Transition Ventilatoire Nocturne', value: '98.7 %', tag: 'Calme Pré-Sommeil', desc: 'Respiration diaphragmatique lente préparant un sommeil profond sans ronflement.' },
    ],
    aiInsight: {
      title: 'Bilan Respiratoire CoVyta IA',
      summary: 'Votre SpO2 moyenne de 98,6% est irréprochable. La détection optique de la bague confirme l\'absence totale de perturbations respiratoires ou d\'épisodes d\'apnée du sommeil cette nuit.',
      recommendation: 'Votre oxygénation cellulaire est optimale pour une régénération physique et cognitive complète.',
    },
  },
};
