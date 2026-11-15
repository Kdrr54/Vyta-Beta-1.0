import { SleepSummary } from '../types';

/**
 * Construit un objet SleepSummary médical complet à partir d'heures de début et de fin.
 * Fonctionne 24h/24, y compris pour les nuits décalées (ex: 04h30 -> 14h00 ou 09h00 -> 17h00).
 */
export function buildSleepSummary(
  startMin: number,
  endMin: number,
  avgBpm?: number
): SleepSummary {
  let totalMin = endMin - startMin;
  if (totalMin <= 0) totalMin += 1440;

  // Plafonnement médical réaliste : minimum 45 min, maximum 16h (960 min)
  totalMin = Math.max(45, Math.min(960, totalMin));

  const deepMin = Math.round(totalMin * 0.20);
  const remMin = Math.round(totalMin * 0.22);
  const awakeMin = Math.max(10, Math.round(totalMin * 0.06));
  const lightMin = Math.max(10, totalMin - deepMin - remMin - awakeMin);

  // Calcul du score Stoic
  const durationScore = Math.min(100, Math.round((totalMin / 480) * 92));
  const effRatio = (totalMin - awakeMin) / totalMin;
  const deepRemRatio = (deepMin + remMin) / totalMin;
  const score = Math.min(
    99,
    Math.max(
      50,
      Math.round(durationScore * 0.6 + effRatio * 100 * 0.25 + deepRemRatio * 100 * 0.15)
    )
  );

  return {
    score,
    deepMin,
    remMin,
    lightMin,
    awakeMin,
    startMin,
    endMin,
  };
}

/**
 * Détecte automatiquement une session de sommeil 24h/24 en analysant les 48 créneaux
 * de fréquence cardiaque (hrLog) de la bague.
 * Fonctionne que la personne dorme la nuit, le matin à 4h30 ou en journée à 9h.
 */
export function detectSleepFromHeartRateLog(
  hrLog: number[] | undefined,
  restingBpm?: number
): SleepSummary | null {
  if (!hrLog || !Array.isArray(hrLog) || hrLog.length !== 48) return null;

  const validValues = hrLog.filter((bpm) => bpm >= 40 && bpm <= 180);
  if (validValues.length < 3) return null;

  // Calcul du seuil de pouls de sommeil
  const sorted = [...validValues].sort((a, b) => a - b);
  const baseline = restingBpm || sorted[Math.floor(sorted.length * 0.25)] || 65;
  const sleepThreshold = baseline * 1.25;

  let bestStart = -1;
  let bestEnd = -1;
  let maxCount = 0;

  let currentStart = -1;
  let currentCount = 0;

  for (let i = 0; i < 48; i++) {
    const bpm = hrLog[i];
    const isSleepingSlot = bpm > 0 && bpm <= sleepThreshold;

    if (isSleepingSlot) {
      if (currentStart === -1) currentStart = i;
      currentCount++;
      if (currentCount > maxCount) {
        maxCount = currentCount;
        bestStart = currentStart;
        bestEnd = i;
      }
    } else {
      // Tolérer 1 micro-éveil bref isolé au milieu du sommeil
      const nextBpm = i + 1 < 48 ? hrLog[i + 1] : 0;
      if (currentStart !== -1 && nextBpm > 0 && nextBpm <= sleepThreshold) {
        continue;
      }
      currentStart = -1;
      currentCount = 0;
    }
  }

  // Minimum 3 créneaux de 30 min (>= 1h30 de sommeil continu)
  if (maxCount >= 3 && bestStart !== -1 && bestEnd !== -1) {
    const startMin = bestStart * 30;
    const endMin = (bestEnd + 1) * 30;
    return buildSleepSummary(startMin, endMin, baseline);
  }

  return null;
}
