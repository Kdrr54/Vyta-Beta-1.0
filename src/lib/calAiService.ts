import { CalAiAnalysisResult, CalAiDailyTarget, CalAiFoodItem } from '../types/calai';
import { getStoredPrismKey } from './prismService';
import { toLocalDateKey } from '../data/health';

const CALAI_STORAGE_PREFIX = 'vyta_calai_meals_';
const CALAI_TARGET_STORAGE = 'vyta_calai_targets';

export function getLocalDateKey(d: Date = new Date()): string {
  return toLocalDateKey(d);
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
  dt.setDate(dt.getDate() + deltaDays);
  return toLocalDateKey(dt);
}

export const DEFAULT_DAILY_TARGET: CalAiDailyTarget = {
  calories: 2200,
  protein: 140,
  carbs: 240,
  fat: 65,
};

/**
 * Compresse et redimensionne une image côté client (max 1024x1024, JPEG 0.82)
 * pour un téléversement instantané même en 4G/5G.
 */
export async function compressImageToDataUrl(file: File | Blob): Promise<{ base64: string; mimeType: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDim = 1024;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Impossible de créer le contexte canvas'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      const base64 = dataUrl.split(',')[1];
      resolve({
        base64,
        mimeType: 'image/jpeg',
        dataUrl,
      });
    };
    img.src = objectUrl;
  });
}

/**
 * Génère une vignette légère (~10 Ko) pour stocker le repas dans localStorage sans saturer le quota.
 */
export async function compressThumbnailDataUrl(
  dataUrl: string,
  maxDim: number = 240,
  quality: number = 0.62
): Promise<string> {
  if (!dataUrl || typeof document === 'undefined') return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Analyse une photo de plat avec Gemini Vision pour extraire les calories et macros façon Cal AI.
 */
export async function analyzeMealWithCalAi(
  imagePayload: { base64: string; mimeType: string; dataUrl?: string },
  options: {
    language?: 'fr' | 'en';
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    dateKey?: string;
  } = {}
): Promise<CalAiAnalysisResult> {
  const apiKey = getStoredPrismKey();
  if (!apiKey) {
    throw new Error('Clé API non disponible pour Cal AI');
  }

  const lang = options.language || 'fr';
  const isEn = lang === 'en';

  const systemPrompt = isEn
    ? `You are "Cal AI Vision Engine", an elite clinical computer vision system specialized in instant meal nutrition recognition and accurate calorie counting.
Analyze the user's food photo and return a strict, valid JSON object with NO markdown formatting, NO surrounding text, and NO backticks.

Expected JSON Structure:
{
  "mealName": "Name of the dish or meal in English",
  "totalCalories": 650,
  "confidence": "high",
  "macros": {
    "protein": 42,
    "carbs": 58,
    "fat": 24,
    "fiber": 6
  },
  "items": [
    {
      "name": "Grilled Chicken Breast",
      "portion": "180g",
      "calories": 290,
      "protein": 40,
      "carbs": 0,
      "fat": 6
    },
    {
      "name": "Basmati Rice",
      "portion": "150g",
      "calories": 195,
      "protein": 4,
      "carbs": 44,
      "fat": 1
    }
  ],
  "healthScore": 88,
  "advice": "High quality protein with complex carbs, ideal for recovery and satiety."
}
Be realistic, accurate, and account for cooking oils and sauces.`
    : `Tu es le moteur "Cal AI Vision", un système d'analyse d'images nutritionnelles haut de gamme spécialisé dans la reconnaissance instantanée des plats et l'estimation précise des calories et macronutriments.
Analyse la photo du plat ci-joint et retourne UNIQUEMENT un objet JSON valide, sans aucun markdown, sans guillemets inverses (\`\`\`json), et sans texte superflu.

Structure JSON obligatoire :
{
  "mealName": "Nom clair du plat en français (ex: Blanc de poulet, riz basmati et avocat)",
  "totalCalories": 650,
  "confidence": "high",
  "macros": {
    "protein": 42,
    "carbs": 58,
    "fat": 24,
    "fiber": 6
  },
  "items": [
    {
      "name": "Blanc de poulet grillé",
      "portion": "180g",
      "calories": 290,
      "protein": 40,
      "carbs": 0,
      "fat": 6
    },
    {
      "name": "Riz basmati cuit",
      "portion": "150g",
      "calories": 195,
      "protein": 4,
      "carbs": 44,
      "fat": 1
    }
  ],
  "healthScore": 88,
  "advice": "Excellente source de protéines maigres et de glucides complexes, idéale pour la récupération musculaire et une satiété durable."
}
Sois réaliste, rigoureux sur les portions visibles, et prends en compte les huiles de cuisson et sauces visibles.`;

  // Modèles multimodaux fiables et disponibles pour la vision
  const candidateModels = [
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3-flash-preview',
    'gemini-3.5-flash',
  ];

  let lastError = '';

  for (const model of candidateModels) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 14000);

      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
              {
                inline_data: {
                  mime_type: imagePayload.mimeType || 'image/jpeg',
                  data: imagePayload.base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 1200,
          responseMimeType: 'application/json',
        },
      };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text();
        lastError = `${res.status} ${errText}`;
        console.warn(`[Cal AI] Échec avec le modèle ${model} (${res.status}), essai du suivant...`);
        continue;
      }

      const data = await res.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        lastError = 'Réponse vide du modèle';
        continue;
      }

      // Nettoyer les balises Markdown éventuelles
      let cleanJson = candidateText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(cleanJson);

      const todayStr = options.dateKey || getLocalDateKey();
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const result: CalAiAnalysisResult = {
        id: `calai-${Date.now()}`,
        timestamp: timeStr,
        dateKey: todayStr,
        mealType: options.mealType || detectDefaultMealType(),
        mealName: parsed.mealName || (isEn ? 'Healthy Meal' : 'Plat Équilibré'),
        imageUrl: imagePayload.dataUrl,
        totalCalories: Number(parsed.totalCalories) || 0,
        macros: {
          protein: Number(parsed.macros?.protein) || 0,
          carbs: Number(parsed.macros?.carbs) || 0,
          fat: Number(parsed.macros?.fat) || 0,
          fiber: Number(parsed.macros?.fiber) || 0,
        },
        items: Array.isArray(parsed.items)
          ? parsed.items.map((it: any) => ({
              name: String(it.name || ''),
              portion: String(it.portion || ''),
              calories: Number(it.calories) || 0,
              protein: Number(it.protein) || 0,
              carbs: Number(it.carbs) || 0,
              fat: Number(it.fat) || 0,
              fiber: Number(it.fiber) || 0,
            }))
          : [],
        healthScore: Number(parsed.healthScore) || 85,
        advice: parsed.advice || (isEn ? 'Balanced meal.' : 'Repas équilibré.'),
      };

      return result;
    } catch (e: any) {
      lastError = e?.message || String(e);
      console.warn(`[Cal AI] Erreur modèle ${model}:`, e);
    }
  }

  throw new Error(
    isEn
      ? 'Aurelius Nutrition could not analyze the meal. Please take a closer photo and retry.'
      : 'Aurelius Nutrition n’a pas pu analyser le plat. Veuillez reprendre une photo bien éclairée et réessayer.'
  );
}

function detectDefaultMealType(): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'snack';
  return 'dinner';
}

/**
 * Récupère les repas enregistrés pour un jour donné (par défaut aujourd'hui en heure locale)
 */
export function getLoggedMeals(dateKey?: string): CalAiAnalysisResult[] {
  if (typeof window === 'undefined') return [];
  const key = dateKey || getLocalDateKey();
  try {
    const raw = localStorage.getItem(`${CALAI_STORAGE_PREFIX}${key}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Enregistre un repas dans le journal quotidien du jour ciblé (dateKey)
 * Protégé contre le dépassement de quota localStorage lié aux miniatures photo.
 */
export function saveLoggedMeal(meal: CalAiAnalysisResult): void {
  if (typeof window === 'undefined') return;
  const dateKey = meal.dateKey || getLocalDateKey();
  const normalizedMeal: CalAiAnalysisResult = { ...meal, dateKey };
  const current = getLoggedMeals(dateKey).filter((m) => m.id !== normalizedMeal.id);
  const updated = [normalizedMeal, ...current];
  try {
    localStorage.setItem(`${CALAI_STORAGE_PREFIX}${dateKey}`, JSON.stringify(updated));
  } catch {
    // Fallback sans image en cas de quota localStorage plein : ne jamais perdre les calories/macros
    try {
      const liteUpdated = updated.map((m, idx) => (idx === 0 || m.imageUrl ? { ...m, imageUrl: undefined } : m));
      localStorage.setItem(`${CALAI_STORAGE_PREFIX}${dateKey}`, JSON.stringify(liteUpdated));
    } catch (_) {}
  }
  try {
    window.dispatchEvent(new CustomEvent('aurel-meals-updated', { detail: { dateKey } }));
  } catch (_) {}
}

/**
 * Supprime un repas du journal d'un jour donné
 */
export function deleteLoggedMeal(mealId: string, dateKey?: string): void {
  if (typeof window === 'undefined') return;
  const key = dateKey || getLocalDateKey();
  const current = getLoggedMeals(key);
  const updated = current.filter((m) => m.id !== mealId);
  try {
    if (updated.length === 0) {
      localStorage.removeItem(`${CALAI_STORAGE_PREFIX}${key}`);
    } else {
      localStorage.setItem(`${CALAI_STORAGE_PREFIX}${key}`, JSON.stringify(updated));
    }
    window.dispatchEvent(new CustomEvent('aurel-meals-updated', { detail: { dateKey: key } }));
  } catch (_) {}
}

/**
 * Liste toutes les journées contenant au moins un repas enregistré (du plus récent au plus ancien)
 */
export function getAllLoggedMealDates(): { dateKey: string; mealCount: number; calories: number }[] {
  if (typeof window === 'undefined') return [];
  const results: { dateKey: string; mealCount: number; calories: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(CALAI_STORAGE_PREFIX)) continue;
      const dateKey = k.slice(CALAI_STORAGE_PREFIX.length);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
      const meals = getLoggedMeals(dateKey);
      if (meals.length > 0) {
        const calories = meals.reduce((sum, m) => sum + (m.totalCalories || 0), 0);
        results.push({ dateKey, mealCount: meals.length, calories });
      }
    }
  } catch (_) {}
  return results.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

/**
 * Calcule le total nutritionnel de la journée
 */
export function getDailyNutritionSummary(dateKey?: string): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  mealCount: number;
} {
  const meals = getLoggedMeals(dateKey);
  return meals.reduce(
    (acc, m) => {
      acc.calories += m.totalCalories || 0;
      acc.protein += m.macros?.protein || 0;
      acc.carbs += m.macros?.carbs || 0;
      acc.fat += m.macros?.fat || 0;
      acc.fiber += m.macros?.fiber || 0;
      acc.mealCount += 1;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, mealCount: 0 }
  );
}

/**
 * Objectifs nutritionnels journaliers
 */
export function getDailyTargets(): CalAiDailyTarget {
  if (typeof window === 'undefined') return DEFAULT_DAILY_TARGET;
  try {
    const raw = localStorage.getItem(CALAI_TARGET_STORAGE);
    if (!raw) return DEFAULT_DAILY_TARGET;
    return { ...DEFAULT_DAILY_TARGET, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_DAILY_TARGET;
  }
}
