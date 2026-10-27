import { Pt } from '../types';

/* ---------- Course GPS ---------- */

/** Tracé de course généré de façon déterministe (coordonnées normalisées, ajustées ensuite au cadre). */
export const routeRaw: Pt[] = Array.from({ length: 140 }, (_, i) => {
  const a = (i / 139) * Math.PI * 1.9;
  return {
    x: Math.cos(a) + 0.18 * Math.sin(3 * a) + 0.05 * Math.sin(7 * a),
    y: 0.62 * Math.sin(a) + 0.1 * Math.cos(2 * a) + 0.04 * Math.sin(5 * a),
  };
});

/** Met à l'échelle un tracé dans un cadre w×h avec marge `pad`, en conservant les proportions. */
export function fitRoute(points: Pt[], w: number, h: number, pad: number): Pt[] {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const s = Math.min((w - 2 * pad) / (maxX - minX), (h - 2 * pad) / (maxY - minY));
  const ox = (w - (maxX - minX) * s) / 2 - minX * s;
  const oy = (h - (maxY - minY) * s) / 2 - minY * s;
  return points.map((p) => ({ x: p.x * s + ox, y: p.y * s + oy }));
}

export const toPath = (pts: Pt[]): string =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

export const run = {
  date: 'Jeu. 15 octobre · 07 h 10',
  distanceKm: 8.12,
  durationSec: 2512,
  elevationM: 64,
  avgHr: 156,
  calories: 612,
  /** Temps des 8 kilomètres complets (le reste de la distance = 0,12 km). */
  splitsSec: [319, 321, 314, 318, 310, 305, 300, 288],
  /** Temps passé en zones Z1…Z5 (somme = durationSec). */
  zonesSec: [130, 570, 1100, 650, 62],
  previousBestKmSec: 295,
  previousBest5kSec: 1558,
};

export const zones = [
  { z: 'Z1', name: 'Récupération', range: '< 114 bpm' },
  { z: 'Z2', name: 'Endurance', range: '114–133' },
  { z: 'Z3', name: 'Tempo', range: '133–152' },
  { z: 'Z4', name: 'Seuil', range: '152–171' },
  { z: 'Z5', name: 'Maximal', range: '> 171' },
];

/* ---------- Musculation ---------- */

export type Split = 'push' | 'pull' | 'legs';

export const splitLabels: Record<Split, string> = { push: 'Push', pull: 'Pull', legs: 'Legs' };

/** [kg, reps] par série */
export const gymPresets: Record<Split, { name: string; sets: [number, number][] }[]> = {
  push: [
    { name: 'Développé couché (barre)', sets: [[80, 8], [80, 8], [82.5, 6]] },
    { name: 'Développé incliné haltères', sets: [[28, 10], [28, 10], [28, 9]] },
    { name: 'Développé militaire', sets: [[50, 8], [50, 7], [47.5, 8]] },
    { name: 'Élévations latérales', sets: [[10, 15], [10, 14], [10, 12]] },
    { name: 'Extension triceps poulie', sets: [[30, 12], [30, 12], [27.5, 12]] },
  ],
  pull: [
    { name: 'Tractions lestées', sets: [[10, 8], [10, 8], [10, 6]] },
    { name: 'Rowing barre', sets: [[70, 10], [70, 10], [70, 9]] },
    { name: 'Tirage poitrine', sets: [[65, 10], [65, 10], [60, 12]] },
    { name: 'Curl biceps haltères', sets: [[14, 12], [14, 11], [14, 10]] },
    { name: 'Face pull', sets: [[25, 15], [25, 15], [25, 14]] },
  ],
  legs: [
    { name: 'Squat (barre)', sets: [[100, 8], [100, 8], [105, 6]] },
    { name: 'Presse à cuisses', sets: [[180, 12], [180, 12], [190, 10]] },
    { name: 'Soulevé de terre roumain', sets: [[90, 10], [90, 10], [90, 9]] },
    { name: 'Leg curl assis', sets: [[45, 12], [45, 12], [45, 10]] },
    { name: 'Mollets debout', sets: [[80, 15], [80, 15], [80, 14]] },
  ],
};

/* ---------- Cercle Vyta (feed social) ---------- */

export interface FeedPost {
  id: number;
  name: string;
  initials: string;
  kind: string;
  title: string;
  stats: { label: string; value: string }[];
  when: string;
  boosts: number;
}

export const feedSeed: FeedPost[] = [
  {
    id: 1, name: 'Léa Marchand', initials: 'LM', kind: 'Course',
    title: 'Sortie longue au bord du canal',
    stats: [{ label: 'Distance', value: '12,4 km' }, { label: 'Allure', value: '5:31 /km' }, { label: 'FC moy', value: '152 bpm' }],
    when: 'Il y a 22 min', boosts: 8,
  },
  {
    id: 2, name: 'Karim Benali', initials: 'KB', kind: 'Musculation',
    title: 'Push day — nouveau record au développé',
    stats: [{ label: 'Tonnage', value: '6,4 t' }, { label: 'Séries', value: '19' }, { label: 'Durée', value: '1 h 12' }],
    when: 'Il y a 1 h', boosts: 14,
  },
  {
    id: 3, name: 'Sofia Rinaldi', initials: 'SR', kind: 'Cardio',
    title: 'Vélo d’appartement — intervalles 30/30',
    stats: [{ label: 'Durée', value: '38 min' }, { label: 'FC max', value: '184 bpm' }, { label: 'Calories', value: '421 kcal' }],
    when: 'Il y a 3 h', boosts: 5,
  },
  {
    id: 4, name: 'Thomas Girard', initials: 'TG', kind: 'Course',
    title: '5 km — record personnel battu',
    stats: [{ label: 'Distance', value: '5,0 km' }, { label: 'Temps', value: '23:48' }, { label: 'Allure', value: '4:46 /km' }],
    when: 'Hier', boosts: 31,
  },
  {
    id: 5, name: 'Inès Haddad', initials: 'IH', kind: 'Musculation',
    title: 'Legs day — focus ischios',
    stats: [{ label: 'Tonnage', value: '9,1 t' }, { label: 'Séries', value: '22' }, { label: 'Durée', value: '1 h 20' }],
    when: 'Hier', boosts: 19,
  },
];
