import { Pt } from '../types';

/* ---------- Course GPS ---------- */

export const routeRaw: Pt[] = [];

export function fitRoute(points: Pt[], w: number, h: number, pad: number): Pt[] {
  if (!points || points.length === 0) return [];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const s = Math.min((w - 2 * pad) / Math.max(0.0001, maxX - minX), (h - 2 * pad) / Math.max(0.0001, maxY - minY));
  const ox = (w - (maxX - minX) * s) / 2 - minX * s;
  const oy = (h - (maxY - minY) * s) / 2 - minY * s;
  return points.map((p) => ({ x: p.x * s + ox, y: p.y * s + oy }));
}

export const toPath = (pts: Pt[]): string =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

export const run = {
  date: '--',
  distanceKm: 0,
  durationSec: 0,
  elevationM: 0,
  avgHr: 0,
  calories: 0,
  splitsSec: [] as number[],
  zonesSec: [0, 0, 0, 0, 0],
  previousBestKmSec: 0,
  previousBest5kSec: 0,
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

export const gymPresets: Record<Split, { name: string; sets: [number, number][] }[]> = {
  push: [],
  pull: [],
  legs: [],
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

export const feedSeed: FeedPost[] = [];
