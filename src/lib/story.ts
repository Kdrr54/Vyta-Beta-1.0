import { Pt } from '../types';

export interface StoryData {
  mode: 'run' | 'gym';
  title: string;
  dateStr: string;
  stats: { label: string; value: string; unit?: string }[];
  accentText?: string;
  tonnageKg?: number;
  /** Progression réelle du parcours entre 0 et 1 */
  routeProgress?: number;
  /** Points GPS réels de la course pour tracer l'itinéraire exact (ligne droite, virages, etc.) */
  realGpsPoints?: [number, number][];
}

export const DEFAULT_ROUTE_PATH_D =
  'M 40 170 Q 110 160, 160 120 T 260 90 T 320 60';

/**
 * Convertit un tableau de coordonnées GPS réelles [latitude, longitude]
 * en un tracé SVG vectoriel proportionnel parfaitement centré dans le cadre viewBox.
 */
export function convertGpsPointsToSvgPath(
  points: [number, number][],
  viewWidth = 360,
  viewHeight = 230,
  padding = 32
): { pathD: string; startPoint: Pt; endPoint: Pt } {
  if (!points || points.length < 2) {
    return {
      pathD: DEFAULT_ROUTE_PATH_D,
      startPoint: { x: 40, y: 170 },
      endPoint: { x: 320, y: 60 },
    };
  }

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  for (const [lat, lng] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  const midLat = (minLat + maxLat) / 2;
  const latToMeters = 111320;
  const lngToMeters = 111320 * Math.cos((midLat * Math.PI) / 180);

  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;
  const spanX = (maxLng - minLng) * lngToMeters;
  const spanY = (maxLat - minLat) * latToMeters;

  const scale = Math.min(
    (viewWidth - padding * 2) / Math.max(25, spanX),
    (viewHeight - padding * 2) / Math.max(25, spanY)
  );

  const svgCoords: Pt[] = points.map(([lat, lng]) => ({
    x: Math.round((viewWidth / 2 + (lng - centerLng) * lngToMeters * scale) * 10) / 10,
    y: Math.round((viewHeight / 2 - (lat - centerLat) * latToMeters * scale) * 10) / 10,
  }));

  const pathD = svgCoords.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');

  return {
    pathD,
    startPoint: svgCoords[0],
    endPoint: svgCoords[svgCoords.length - 1],
  };
}

export type StoryTemplateVariant = 'transparent' | 'satellite' | 'dark_gold' | 'telemetry';

/**
 * Coordonnées de tracé épuré par défaut
 */
export const WORKOUT_ROUTE_WAYPOINTS: Pt[] = [
  { x: 40, y: 170 },
  { x: 90, y: 155 },
  { x: 140, y: 135 },
  { x: 185, y: 115 },
  { x: 235, y: 95 },
  { x: 280, y: 75 },
  { x: 320, y: 60 },
];

/**
 * Échantillonne de façon lisse (Catmull-Rom) la trajectoire réelle de la course
 * du départ jusqu'à `progress` (entre 0 et 1).
 */
export function getSampledRunTrajectory(progress = 1, totalSamples = 160): Pt[] {
  const effectiveProg =
    typeof progress === 'number' && progress > 0.03 ? Math.min(1, progress) : 1;

  const pts = WORKOUT_ROUTE_WAYPOINTS;
  const n = pts.length - 1;
  const maxFloatIndex = effectiveProg * n;
  const sampleCount = Math.max(12, Math.round(totalSamples * effectiveProg));

  const result: Pt[] = [];
  for (let s = 0; s <= sampleCount; s++) {
    const pos = (s / sampleCount) * maxFloatIndex;
    const idx = Math.min(n - 1, Math.floor(pos));
    const t = pos - idx;

    const p0 = pts[Math.max(0, idx - 1)];
    const p1 = pts[idx];
    const p2 = pts[Math.min(n, idx + 1)];
    const p3 = pts[Math.min(n, idx + 2)];

    const t2 = t * t;
    const t3 = t2 * t;

    const x =
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

    const y =
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

    result.push({ x, y });
  }
  return result;
}

/**
 * Calcule la position en pixels (viewBox 0 0 360 230) du coureur
 * en fonction de la progression de course (entre 0 et 1).
 */
export function getRunnerPosition(prog = 1): Pt {
  const p = Math.max(0, Math.min(1, prog));
  if (p <= 0 || p >= 0.999) return { x: 180, y: 44 };
  const totalSegments = WORKOUT_ROUTE_WAYPOINTS.length - 1;
  const segmentIndex = p * totalSegments;
  const i = Math.floor(segmentIndex);
  const t = segmentIndex - i;
  const p1 = WORKOUT_ROUTE_WAYPOINTS[i];
  const p2 = WORKOUT_ROUTE_WAYPOINTS[Math.min(i + 1, totalSegments)];
  return {
    x: Math.round((p1.x + (p2.x - p1.x) * t) * 10) / 10,
    y: Math.round((p1.y + (p2.y - p1.y) * t) * 10) / 10,
  };
}

/**
 * Redimensionne et centre les points de la trajectoire dans une boîte (width x height)
 * en conservant les proportions exactes du parcours.
 */
export function fitTrajectoryToBox(
  rawPoints: Pt[],
  width: number,
  height: number,
  padding: number,
  boundsPoints: Pt[] = WORKOUT_ROUTE_WAYPOINTS
): Pt[] {
  if (rawPoints.length === 0) return [];
  // On dimensionne par rapport au parcours global pour ne pas déformer une portion partielle
  const xs = boundsPoints.map((p) => p.x);
  const ys = boundsPoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const spanX = Math.max(10, maxX - minX);
  const spanY = Math.max(10, maxY - minY);

  const availW = Math.max(10, width - padding * 2);
  const availH = Math.max(10, height - padding * 2);
  const scale = Math.min(availW / spanX, availH / spanY);

  const offsetX = (width - spanX * scale) / 2 - minX * scale;
  const offsetY = (height - spanY * scale) / 2 - minY * scale;

  return rawPoints.map((p) => ({
    x: p.x * scale + offsetX,
    y: p.y * scale + offsetY,
  }));
}

/**
 * Génère le chemin SVG (`d`) de la trajectoire réelle de la course pour l'aperçu dans StoryModal.
 */
export function getRunTrajectorySvgPath(
  width: number,
  height: number,
  padding: number,
  progress = 1
): string {
  const raw = getSampledRunTrajectory(progress);
  const fitted = fitTrajectoryToBox(raw, width, height, padding);
  if (fitted.length === 0) return '';
  return fitted
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
}

/**
 * Génère l'image PNG haute définition (1080x1920) en thème Noir & Blanc.
 */
export function generateStoryDataUrl(
  data: StoryData,
  variant: StoryTemplateVariant = 'transparent'
): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve('');
      return;
    }

    const distStat = data.stats[0] || { label: 'Distance', value: '8.12', unit: 'km' };
    const paceStat = data.stats[1] || { label: 'Allure', value: '5:09', unit: '/km' };
    const timeStat = data.stats[2] || { label: 'Temps', value: '41m 52s', unit: '' };
    const hrStat = data.stats[3] || { label: 'FC Moyenne', value: '156', unit: 'bpm' };

    const drawRunTrajectoryOnCanvas = (
      boxX: number,
      boxY: number,
      boxW: number,
      boxH: number,
      strokeColor: string,
      lineWidth: number,
      glowColor?: string
    ) => {
      let fitted: Pt[] = [];
      let startPt: Pt | undefined;
      let endPt: Pt | undefined;

      if (data.realGpsPoints && data.realGpsPoints.length >= 2) {
        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;
        for (const [lat, lng] of data.realGpsPoints) {
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        }
        const midLat = (minLat + maxLat) / 2;
        const latToM = 111320;
        const lngToM = 111320 * Math.cos((midLat * Math.PI) / 180);
        const centerLng = (minLng + maxLng) / 2;
        const centerLat = (minLat + maxLat) / 2;
        const spanX = (maxLng - minLng) * lngToM;
        const spanY = (maxLat - minLat) * latToM;
        const pad = 48;
        const scale = Math.min(
          (boxW - pad * 2) / Math.max(25, spanX),
          (boxH - pad * 2) / Math.max(25, spanY)
        );
        fitted = data.realGpsPoints.map(([lat, lng]) => ({
          x: boxW / 2 + (lng - centerLng) * lngToM * scale,
          y: boxH / 2 - (lat - centerLat) * latToM * scale,
        }));
        startPt = fitted[0];
        endPt = fitted[fitted.length - 1];
      } else {
        // Tracé fluide par défaut (aucun circuit prédéfini)
        const defaultCurve: Pt[] = [
          { x: boxW * 0.15, y: boxH * 0.72 },
          { x: boxW * 0.35, y: boxH * 0.62 },
          { x: boxW * 0.55, y: boxH * 0.44 },
          { x: boxW * 0.72, y: boxH * 0.34 },
          { x: boxW * 0.85, y: boxH * 0.22 },
        ];
        fitted = defaultCurve;
        startPt = fitted[0];
        endPt = fitted[fitted.length - 1];
      }

      if (fitted.length < 2) return;

      ctx.save();
      ctx.translate(boxX, boxY);

      if (glowColor) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 24;
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      fitted.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      if (startPt) {
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.arc(startPt.x, startPt.y, lineWidth * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }

      if (endPt) {
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.arc(endPt.x, endPt.y, lineWidth * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    // ==================== VARIANT 1: TRANSPARENT STICKER (NOIR & BLANC) ====================
    if (variant === 'transparent') {
      ctx.clearRect(0, 0, 1080, 1920);
      ctx.textAlign = 'center';

      // 1. Distance
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '600 38px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
      ctx.fillText(distStat.label, 540, 460);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 104px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
      ctx.fillText(
        `${distStat.value}${distStat.unit ? ' ' + distStat.unit : ''}`,
        540,
        568
      );

      // 2. Allure / Pace
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '600 38px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
      ctx.fillText(paceStat.label, 540, 720);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 104px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
      ctx.fillText(
        `${paceStat.value}${paceStat.unit ? ' ' + paceStat.unit : ''}`,
        540,
        828
      );

      // 3. Temps / Time
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '600 38px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
      ctx.fillText(timeStat.label, 540, 980);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 104px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
      ctx.fillText(
        `${timeStat.value}${timeStat.unit ? ' ' + timeStat.unit : ''}`,
        540,
        1088
      );

      // 4. Trajectoire réelle de la course en Blanc pur (Course uniquement)
      if (data.mode === 'run') {
        drawRunTrajectoryOnCanvas(270, 1150, 540, 350, '#FFFFFF', 16);
      }

      // 5. Logo STOIC LABS en bas
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 60px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
      ctx.letterSpacing = '6px';
      ctx.fillText('STOIC LABS', 540, 1620);

      resolve(canvas.toDataURL('image/png'));
      return;
    }

    // ==================== VARIANT 2: CARTE MONOCHROME ====================
    if (variant === 'satellite') {
      const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1920);
      bgGrad.addColorStop(0, '#0E0E11');
      bgGrad.addColorStop(0.5, '#18181C');
      bgGrad.addColorStop(1, '#09090B');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1080, 1920);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 3;
      for (let i = -200; i < 1920; i += 110) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(1080, i + 180);
        ctx.stroke();
      }
      for (let x = 80; x < 1080; x += 140) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 120, 1920);
        ctx.stroke();
      }

      const topVig = ctx.createLinearGradient(0, 0, 0, 550);
      topVig.addColorStop(0, 'rgba(0,0,0,0.8)');
      topVig.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = topVig;
      ctx.fillRect(0, 0, 1080, 550);

      const botVig = ctx.createLinearGradient(0, 1250, 0, 1920);
      botVig.addColorStop(0, 'rgba(0,0,0,0)');
      botVig.addColorStop(1, 'rgba(0,0,0,0.92)');
      ctx.fillStyle = botVig;
      ctx.fillRect(0, 1250, 1080, 670);

      if (data.mode === 'run') {
        drawRunTrajectoryOnCanvas(180, 560, 720, 560, '#FFFFFF', 20, 'rgba(255, 255, 255, 0.45)');
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '600 32px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
      ctx.fillText(distStat.label, 110, 1520);
      ctx.fillText(paceStat.label, 440, 1520);
      ctx.fillText(timeStat.label, 760, 1520);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 64px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
      ctx.fillText(`${distStat.value} ${distStat.unit || ''}`, 110, 1595);
      ctx.fillText(`${paceStat.value} ${paceStat.unit || ''}`, 440, 1595);
      ctx.fillText(`${timeStat.value}`, 760, 1595);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 52px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
      ctx.letterSpacing = '6px';
      ctx.fillText('STOIC LABS', 540, 1775);

      resolve(canvas.toDataURL('image/png'));
      return;
    }

    // ==================== VARIANT 3 & 4: NOIR PROFOND / CONTRASTE BLANC ====================
    const isLightCard = variant === 'telemetry';
    ctx.fillStyle = isLightCard ? '#F5F5F7' : '#050507';
    ctx.fillRect(0, 0, 1080, 1920);

    const fgPrimary = isLightCard ? '#000000' : '#FFFFFF';
    const fgSecondary = isLightCard ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)';

    ctx.textAlign = 'center';

    ctx.fillStyle = fgSecondary;
    ctx.font = '600 36px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.fillText(distStat.label, 540, 430);
    ctx.fillStyle = fgPrimary;
    ctx.font = '800 100px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.fillText(`${distStat.value} ${distStat.unit || ''}`, 540, 535);

    ctx.fillStyle = fgSecondary;
    ctx.font = '600 36px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.fillText(paceStat.label, 540, 685);
    ctx.fillStyle = fgPrimary;
    ctx.font = '800 100px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.fillText(`${paceStat.value} ${paceStat.unit || ''}`, 540, 790);

    ctx.fillStyle = fgSecondary;
    ctx.font = '600 36px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.fillText(isLightCard ? hrStat.label : timeStat.label, 540, 940);
    ctx.fillStyle = fgPrimary;
    ctx.font = '800 100px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.fillText(
      isLightCard
        ? `${hrStat.value} ${hrStat.unit || ''}`
        : `${timeStat.value}`,
      540,
      1045
    );

    if (data.mode === 'run') {
      drawRunTrajectoryOnCanvas(270, 1140, 540, 350, fgPrimary, 16);
    }

    ctx.fillStyle = fgPrimary;
    ctx.font = '900 60px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.letterSpacing = '6px';
    ctx.fillText('STOIC LABS', 540, 1620);

    resolve(canvas.toDataURL('image/png'));
  });
}
