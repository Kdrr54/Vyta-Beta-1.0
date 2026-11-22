import {
  CalAiAnalysisResult,
  CalAiDailyTarget,
  YukaAdditive,
  YukaAnalysis,
  YukaCriterion,
} from '../types/calai';
import { getStoredPrismKey } from './prismService';
import { toLocalDateKey } from '../data/health';

const CALAI_STORAGE_PREFIX = 'vyta_calai_meals_';
const CALAI_HYDRATION_PREFIX = 'vyta_calai_hydration_';
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

export function getYukaMeta(score: number, isEn = false): {
  rating: YukaAnalysis['rating'];
  label: string;
  color: string;
  bg: string;
  border: string;
} {
  if (score >= 75) {
    return {
      rating: 'excellent',
      label: isEn ? 'Excellent' : 'Excellent',
      color: '#22C55E',
      bg: 'rgba(34, 197, 94, 0.14)',
      border: 'rgba(34, 197, 94, 0.38)',
    };
  }
  if (score >= 50) {
    return {
      rating: 'good',
      label: isEn ? 'Good' : 'Bon',
      color: '#84CC16',
      bg: 'rgba(132, 204, 22, 0.14)',
      border: 'rgba(132, 204, 22, 0.38)',
    };
  }
  if (score >= 25) {
    return {
      rating: 'mediocre',
      label: isEn ? 'Mediocre' : 'Médiocre',
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.14)',
      border: 'rgba(245, 158, 11, 0.38)',
    };
  }
  return {
    rating: 'bad',
    label: isEn ? 'Poor' : 'Mauvais',
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.14)',
    border: 'rgba(239, 68, 68, 0.38)',
  };
}

function normalizeYukaBlock(raw: any, fallbackScore = 80, isEn = false): YukaAnalysis {
  const score = Math.max(0, Math.min(100, Math.round(Number(raw?.score ?? fallbackScore) || fallbackScore)));
  const meta = getYukaMeta(score, isEn);
  const mapCriteria = (arr: any): YukaCriterion[] =>
    Array.isArray(arr)
      ? arr
          .map((c: any) => ({
            label: String(c?.label || ''),
            value: String(c?.value || ''),
            detail: String(c?.detail || ''),
          }))
          .filter((c: YukaCriterion) => c.label.length > 0)
      : [];
  const mapAdditives = (arr: any): YukaAdditive[] =>
    Array.isArray(arr)
      ? arr
          .map((a: any) => ({
            code: String(a?.code || ''),
            name: String(a?.name || ''),
            risk: (a?.risk === 'high' || a?.risk === 'moderate' ? a.risk : 'low') as YukaAdditive['risk'],
          }))
          .filter((a: YukaAdditive) => a.code.length > 0 || a.name.length > 0)
      : [];
  const ns = typeof raw?.nutriscore === 'string' ? raw.nutriscore.toUpperCase() : undefined;
  const validNs = ns === 'A' || ns === 'B' || ns === 'C' || ns === 'D' || ns === 'E' ? ns : undefined;
  const novaNum = Number(raw?.novaGroup);
  const validNova = novaNum === 1 || novaNum === 2 || novaNum === 3 || novaNum === 4 ? novaNum : undefined;

  return {
    score,
    rating: meta.rating,
    brand: raw?.brand ? String(raw.brand) : undefined,
    barcode: raw?.barcode ? String(raw.barcode) : undefined,
    nutriscore: validNs,
    novaGroup: validNova,
    isOrganic: Boolean(raw?.isOrganic),
    sugar: raw?.sugar !== undefined ? Number(raw.sugar) || 0 : undefined,
    saturatedFat: raw?.saturatedFat !== undefined ? Number(raw.saturatedFat) || 0 : undefined,
    salt: raw?.salt !== undefined ? Number(raw.salt) || 0 : undefined,
    positives: mapCriteria(raw?.positives),
    negatives: mapCriteria(raw?.negatives),
    additives: mapAdditives(raw?.additives),
    alternatives: Array.isArray(raw?.alternatives)
      ? raw.alternatives
          .map((alt: any) => ({
            name: String(alt?.name || ''),
            brand: alt?.brand ? String(alt.brand) : undefined,
            reason: String(alt?.reason || ''),
          }))
          .filter((alt: any) => alt.name.length > 0)
      : undefined,
  };
}

function buildResultFromParsed(
  parsed: any,
  options: {
    language?: 'fr' | 'en';
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    dateKey?: string;
    sourceType?: 'plate' | 'yuka' | 'text';
    imageUrl?: string;
    existingId?: string;
    fixedNote?: string;
  }
): CalAiAnalysisResult {
  const isEn = (options.language || 'fr') === 'en';
  const todayStr = options.dateKey || getLocalDateKey();
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.yuka?.score ?? parsed.healthScore ?? 80) || 80)));

  return {
    id: options.existingId || `calai-${Date.now()}`,
    timestamp: timeStr,
    dateKey: todayStr,
    mealType: options.mealType || detectDefaultMealType(),
    mealName: parsed.mealName || (isEn ? 'Balanced Meal' : 'Plat Équilibré'),
    sourceType: options.sourceType || 'plate',
    imageUrl: options.imageUrl,
    totalCalories: Math.max(0, Math.round(Number(parsed.totalCalories) || 0)),
    macros: {
      protein: Math.max(0, Math.round(Number(parsed.macros?.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(parsed.macros?.carbs) || 0)),
      fat: Math.max(0, Math.round(Number(parsed.macros?.fat) || 0)),
      fiber: Math.max(0, Math.round(Number(parsed.macros?.fiber) || 0)),
      sugar: parsed.macros?.sugar !== undefined ? Math.max(0, Math.round(Number(parsed.macros.sugar) || 0)) : undefined,
    },
    items: Array.isArray(parsed.items)
      ? parsed.items.map((it: any) => ({
          name: String(it.name || ''),
          portion: String(it.portion || ''),
          calories: Math.max(0, Math.round(Number(it.calories) || 0)),
          protein: Math.max(0, Math.round(Number(it.protein) || 0)),
          carbs: Math.max(0, Math.round(Number(it.carbs) || 0)),
          fat: Math.max(0, Math.round(Number(it.fat) || 0)),
          fiber: it.fiber !== undefined ? Math.max(0, Math.round(Number(it.fiber) || 0)) : undefined,
        }))
      : [],
    healthScore: score,
    yuka: parsed.yuka ? normalizeYukaBlock(parsed.yuka, score, isEn) : undefined,
    advice: parsed.advice || (isEn ? 'Balanced meal.' : 'Repas équilibré.'),
    fixedNote: options.fixedNote,
  };
}

async function callGeminiNutritionJson(
  parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }>
): Promise<any> {
  const apiKey = getStoredPrismKey();
  if (!apiKey) {
    throw new Error('Clé API non disponible pour Aurelius Nutrition');
  }

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
      const timer = setTimeout(() => controller.abort(), 16000);

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 1600,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        lastError = `${res.status} ${await res.text()}`;
        console.warn(`[Cal AI] Échec avec le modèle ${model} (${res.status}), essai du suivant...`);
        continue;
      }

      const data = await res.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        lastError = 'Réponse vide du modèle';
        continue;
      }

      let cleanJson = candidateText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      return JSON.parse(cleanJson);
    } catch (e: any) {
      lastError = e?.message || String(e);
      console.warn(`[Cal AI] Erreur modèle ${model}:`, e);
    }
  }

  throw new Error(lastError || 'Aurelius Nutrition error');
}

/**
 * Compresse et redimensionne une image côté client (max 1024x1024, JPEG 0.82)
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

const YUKA_JSON_SCHEMA_EN = `{
  "mealName": "Clear meal or product name in English",
  "totalCalories": 540,
  "macros": { "protein": 38, "carbs": 48, "fat": 20, "fiber": 7, "sugar": 4 },
  "items": [
    { "name": "Food item in English", "portion": "150g", "calories": 250, "protein": 30, "carbs": 0, "fat": 12 }
  ],
  "healthScore": 84,
  "yuka": {
    "score": 84,
    "brand": "Brand if known",
    "nutriscore": "A",
    "novaGroup": 1,
    "isOrganic": false,
    "sugar": 4,
    "saturatedFat": 3,
    "salt": 0.6,
    "positives": [
      { "label": "Protein", "value": "38 g", "detail": "Excellent source for muscle recovery and satiety" },
      { "label": "Fiber", "value": "7 g", "detail": "Supports healthy digestion" }
    ],
    "negatives": [
      { "label": "Sodium", "value": "0.6 g", "detail": "Moderate" }
    ],
    "additives": [
      { "code": "E322", "name": "Lecithin", "risk": "low" }
    ],
    "alternatives": [
      { "name": "Healthier alternative", "brand": "Organic", "reason": "Lower sugar and zero additives" }
    ]
  },
  "advice": "Short, actionable nutritional summary in English."
}`;

const YUKA_JSON_SCHEMA_FR = `{
  "mealName": "Nom clair du plat ou produit",
  "totalCalories": 540,
  "macros": { "protein": 38, "carbs": 48, "fat": 20, "fiber": 7, "sugar": 4 },
  "items": [
    { "name": "Aliment", "portion": "150g", "calories": 250, "protein": 30, "carbs": 0, "fat": 12 }
  ],
  "healthScore": 84,
  "yuka": {
    "score": 84,
    "brand": "Marque si connue",
    "nutriscore": "A",
    "novaGroup": 1,
    "isOrganic": false,
    "sugar": 4,
    "saturatedFat": 3,
    "salt": 0.6,
    "positives": [
      { "label": "Protéines", "value": "38 g", "detail": "Excellent apport pour la satiété et les muscles" },
      { "label": "Fibres", "value": "7 g", "detail": "Bon soutien digestif" }
    ],
    "negatives": [
      { "label": "Sel", "value": "0.6 g", "detail": "Modéré" }
    ],
    "additives": [
      { "code": "E322", "name": "Lécithine", "risk": "low" }
    ],
    "alternatives": [
      { "name": "Alternative plus saine", "brand": "Bio", "reason": "Moins de sucres et aucun additif" }
    ]
  },
  "advice": "Synthèse nutritionnelle courte et actionnable."
}`;

/**
 * Analyse une photo de plat avec Gemini Vision (Cal AI + Score Yuka 0-100).
 */
export async function analyzeMealWithCalAi(
  imagePayload: { base64: string; mimeType: string; dataUrl?: string },
  options: {
    language?: 'fr' | 'en';
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    dateKey?: string;
  } = {}
): Promise<CalAiAnalysisResult> {
  const isEn = (options.language || 'fr') === 'en';
  const prompt = isEn
    ? `You are "Aurelius Nutrition Vision" (Cal AI + Yuka-grade quality engine). Analyze the food photo and return ONLY valid JSON (no markdown) matching:
${YUKA_JSON_SCHEMA_EN}
IMPORTANT: ALL text values (mealName, items[].name, items[].portion, positives, negatives, additives[].name, alternatives, advice) MUST be written in English. Be accurate on portions, cooking oils, sauces, Yuka score (0-100), and healthier alternatives if score < 70.`
    : `Tu es "Aurelius Nutrition Vision" (moteur Cal AI + notation qualité type Yuka). Analyse la photo du plat et retourne UNIQUEMENT un JSON valide (sans markdown) conforme à :
${YUKA_JSON_SCHEMA_FR}
Sois réaliste sur les portions visibles, les huiles/sauces, la note Yuka sur 100, les points positifs/négatifs, les additifs éventuels et des alternatives plus saines si le score < 70.`;

  try {
    const parsed = await callGeminiNutritionJson([
      { text: prompt },
      { inline_data: { mime_type: imagePayload.mimeType || 'image/jpeg', data: imagePayload.base64 } },
    ]);
    return buildResultFromParsed(parsed, {
      ...options,
      sourceType: 'plate',
      imageUrl: imagePayload.dataUrl,
    });
  } catch {
    throw new Error(
      isEn
        ? 'Aurelius Nutrition could not analyze the meal. Please take a closer photo and retry.'
        : 'Aurelius Nutrition n’a pas pu analyser le plat. Veuillez reprendre une photo bien éclairée et réessayer.'
    );
  }
}

/**
 * Système Yuka : lookup OpenFoodFacts par code-barres + notation Yuka (0-100), ou recherche nom/photo produit.
 */
function computeOpenFoodFactsYuka(p: any, barcode: string, isEn: boolean): CalAiAnalysisResult {
  const nut = p.nutriments || {};
  const kcal100 = Math.round(Number(nut['energy-kcal_100g'] || nut['energy-kcal'] || 0));
  const prot100 = parseFloat((Number(nut.proteins_100g || 0)).toFixed(1));
  const carbs100 = parseFloat((Number(nut.carbohydrates_100g || 0)).toFixed(1));
  const fat100 = parseFloat((Number(nut.fat_100g || 0)).toFixed(1));
  const sugar100 = parseFloat((Number(nut.sugars_100g || 0)).toFixed(1));
  const satFat100 = parseFloat((Number(nut['saturated-fat_100g'] || 0)).toFixed(1));
  const salt100 = parseFloat((Number(nut.salt_100g || 0)).toFixed(2));
  const fiber100 = parseFloat((Number(nut.fiber_100g || 0)).toFixed(1));

  const nsRaw = typeof p.nutriscore_grade === 'string' ? p.nutriscore_grade.toUpperCase() : '';
  const nsMap: Record<string, number> = { A: 88, B: 74, C: 54, D: 34, E: 16 };
  let yukaScore = nsMap[nsRaw] ?? 62;

  const additivesTags: string[] = Array.isArray(p.additives_tags) ? p.additives_tags : [];
  const highRiskCodes = ['E250', 'E249', 'E320', 'E321', 'E951', 'E950', 'E102', 'E110', 'E129', 'E171', 'E621', 'E471', 'E472', 'E407'];
  const modRiskCodes = ['E330', 'E300', 'E322', 'E412', 'E415', 'E440', 'E500', 'E202', 'E211'];

  const additives: YukaAdditive[] = additivesTags.slice(0, 8).map((tag) => {
    const clean = tag.replace(/^en:/i, '').toUpperCase();
    const risk: YukaAdditive['risk'] = highRiskCodes.some((c) => clean.startsWith(c))
      ? 'high'
      : modRiskCodes.some((c) => clean.startsWith(c))
      ? 'moderate'
      : 'low';
    return {
      code: clean,
      name: clean,
      risk,
    };
  });

  const highCount = additives.filter((a) => a.risk === 'high').length;
  const modCount = additives.filter((a) => a.risk === 'moderate').length;
  yukaScore -= highCount * 15 + modCount * 5;

  const novaNum = Number(p.nova_group);
  if (novaNum === 4) yukaScore -= 8;
  const isOrganic = Array.isArray(p.labels_tags) && p.labels_tags.some((t: string) => t.includes('organic') || t.includes('bio'));
  if (isOrganic) yukaScore += 8;
  yukaScore = Math.max(0, Math.min(100, Math.round(yukaScore)));

  const positives: YukaCriterion[] = [];
  const negatives: YukaCriterion[] = [];

  if (prot100 >= 8) positives.push({ label: isEn ? 'Protein' : 'Protéines', value: `${prot100}g / 100g`, detail: isEn ? 'Rich in protein' : 'Bonne teneur en protéines' });
  if (fiber100 >= 3.5) positives.push({ label: isEn ? 'Fiber' : 'Fibres', value: `${fiber100}g / 100g`, detail: isEn ? 'Good fiber source' : 'Riche en fibres' });
  if (sugar100 <= 5) positives.push({ label: isEn ? 'Low Sugar' : 'Peu sucré', value: `${sugar100}g / 100g`, detail: isEn ? 'Low glycemic impact' : 'Faible teneur en sucres' });
  if (satFat100 <= 2) positives.push({ label: isEn ? 'Saturated Fat' : 'Graisses saturées', value: `${satFat100}g / 100g`, detail: isEn ? 'Low saturated fat' : 'Faible en acides gras saturés' });
  if (additives.length === 0) positives.push({ label: isEn ? 'No Additives' : 'Sans additif', value: '0', detail: isEn ? 'Clean ingredient list' : 'Liste d’ingrédients propre' });
  if (isOrganic) positives.push({ label: 'Bio', value: 'AB / EU', detail: isEn ? 'Certified organic' : 'Issu de l’agriculture biologique' });

  if (sugar100 > 12.5) negatives.push({ label: isEn ? 'Sugar' : 'Sucres', value: `${sugar100}g / 100g`, detail: isEn ? 'Too sweet' : 'Trop sucré' });
  if (satFat100 > 5) negatives.push({ label: isEn ? 'Saturated Fat' : 'Graisses saturées', value: `${satFat100}g / 100g`, detail: isEn ? 'High saturated fat' : 'Teneur élevée en graisses saturées' });
  if (salt100 > 1.2) negatives.push({ label: isEn ? 'Salt' : 'Sel', value: `${salt100}g / 100g`, detail: isEn ? 'Too salty' : 'Trop salé' });
  if (kcal100 > 420) negatives.push({ label: isEn ? 'Calories' : 'Calories', value: `${kcal100} kcal / 100g`, detail: isEn ? 'Calorie dense' : 'Très calorique' });
  if (highCount > 0) negatives.push({ label: isEn ? 'Additives' : 'Additifs à risque', value: `${highCount}`, detail: isEn ? 'Contains controversial additives' : 'Contient des additifs à éviter' });
  if (novaNum === 4) negatives.push({ label: 'NOVA 4', value: isEn ? 'Ultra-processed' : 'Ultra-transformé', detail: isEn ? 'Industrial formulation' : 'Produit ultra-transformé' });

  const name = p.product_name_fr || p.product_name || `Produit ${barcode}`;
  const brand = p.brands ? String(p.brands).split(',')[0].trim() : undefined;
  const meta = getYukaMeta(yukaScore, isEn);

  return {
    id: `yuka-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    dateKey: getLocalDateKey(),
    mealType: detectDefaultMealType(),
    mealName: brand ? `${name} · ${brand}` : name,
    sourceType: 'yuka',
    imageUrl: p.image_front_small_url || p.image_url,
    totalCalories: kcal100,
    macros: {
      protein: Math.round(prot100),
      carbs: Math.round(carbs100),
      fat: Math.round(fat100),
      fiber: Math.round(fiber100),
      sugar: Math.round(sugar100),
    },
    items: [
      {
        name,
        portion: p.serving_size || '100g (réf.)',
        calories: kcal100,
        protein: Math.round(prot100),
        carbs: Math.round(carbs100),
        fat: Math.round(fat100),
        fiber: Math.round(fiber100),
      },
    ],
    healthScore: yukaScore,
    yuka: {
      score: yukaScore,
      rating: meta.rating,
      brand,
      barcode,
      nutriscore: (['A', 'B', 'C', 'D', 'E'].includes(nsRaw) ? nsRaw : undefined) as YukaAnalysis['nutriscore'],
      novaGroup: (novaNum >= 1 && novaNum <= 4 ? novaNum : undefined) as YukaAnalysis['novaGroup'],
      isOrganic,
      sugar: sugar100,
      saturatedFat: satFat100,
      salt: salt100,
      positives,
      negatives,
      additives,
    },
    advice: isEn
      ? `Yuka Quality ${yukaScore}/100 (${meta.label}) per 100g. Adjust portion or tap Fix with Aurelius if you ate more or less than 100g.`
      : `Note Yuka ${yukaScore}/100 (${meta.label}) pour 100g. Utilise « Fix avec Aurelius » si tu as mangé une autre quantité (ex: 1 pot de 125g).`,
  };
}

export async function analyzeProductYuka(params: {
  barcodeOrQuery?: string;
  imagePayload?: { base64: string; mimeType: string; dataUrl?: string };
  language?: 'fr' | 'en';
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  dateKey?: string;
}): Promise<CalAiAnalysisResult> {
  const isEn = (params.language || 'fr') === 'en';
  const query = (params.barcodeOrQuery || '').trim();

  // 1. Direct OpenFoodFacts barcode lookup if digits
  if (/^\d{8,14}$/.test(query)) {
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${query}.json`);
      if (res.ok) {
        const json = await res.json();
        if (json?.status === 1 && json?.product) {
          const built = computeOpenFoodFactsYuka(json.product, query, isEn);
          return {
            ...built,
            dateKey: params.dateKey || built.dateKey,
            mealType: params.mealType || built.mealType,
          };
        }
      }
    } catch (_) {}
  }

  // 2. Gemini Vision / Text Yuka analysis (reads barcode, nutrition table, ingredients list, or product name)
  const prompt = isEn
    ? `You are "Aurelius Yuka Scanner". Read the product photo (packaging, nutrition label, ingredients, or barcode) or product query "${query}" and return ONLY valid JSON (no markdown) with a real Yuka-style 0-100 quality score, Nutri-Score (A-E), NOVA (1-4), additives (E-numbers + risk: low/moderate/high), positives, negatives, and 2 healthier alternatives if score < 70. ALL text values MUST be in English:
${YUKA_JSON_SCHEMA_EN}`
    : `Tu es "Aurelius Yuka Scanner". Lis la photo du produit (emballage, tableau nutritionnel, liste d'ingrédients ou code-barres) ou la recherche "${query}" et retourne UNIQUEMENT un JSON valide (sans markdown) avec une vraie note Yuka 0-100, Nutri-Score (A-E), NOVA (1-4), additifs (codes E + risque low/moderate/high), qualités (positives), défauts (negatives) et 2 alternatives plus saines si score < 70 :
${YUKA_JSON_SCHEMA_FR}`;

  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [{ text: prompt }];
  if (params.imagePayload) {
    parts.push({ inline_data: { mime_type: params.imagePayload.mimeType || 'image/jpeg', data: params.imagePayload.base64 } });
  }

  const parsed = await callGeminiNutritionJson(parts);
  // If Gemini extracted a barcode from the photo, try OpenFoodFacts for exact DB accuracy!
  const detectedBarcode = String(parsed?.yuka?.barcode || '').replace(/\D/g, '');
  if (!query && /^\d{8,14}$/.test(detectedBarcode)) {
    try {
      const offRes = await fetch(`https://world.openfoodfacts.org/api/v2/product/${detectedBarcode}.json`);
      if (offRes.ok) {
        const offJson = await offRes.json();
        if (offJson?.status === 1 && offJson?.product) {
          const built = computeOpenFoodFactsYuka(offJson.product, detectedBarcode, isEn);
          return {
            ...built,
            dateKey: params.dateKey || built.dateKey,
            mealType: params.mealType || built.mealType,
          };
        }
      }
    } catch (_) {}
  }

  return buildResultFromParsed(parsed, {
    language: params.language,
    mealType: params.mealType,
    dateKey: params.dateKey,
    sourceType: 'yuka',
    imageUrl: params.imagePayload?.dataUrl,
  });
}

/**
 * Analyse un repas décrit à l'écrit (sans photo) avec score Yuka + macros.
 */
export async function analyzeTextMealWithAurelius(
  description: string,
  options: {
    language?: 'fr' | 'en';
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    dateKey?: string;
  } = {}
): Promise<CalAiAnalysisResult> {
  const isEn = (options.language || 'fr') === 'en';
  const prompt = isEn
    ? `You are "Aurelius Nutrition Engine". Estimate exact calories, macros, items, Yuka quality score (0-100), positives, negatives, and advice for this meal description: "${description}". ALL text values MUST be written in English. Return ONLY valid JSON matching:
${YUKA_JSON_SCHEMA_EN}`
    : `Tu es "Aurelius Nutrition Engine". Calcule les calories, macros, ingrédients détaillés, la note qualité Yuka (0-100), points positifs/négatifs et conseils pour ce repas décrit par l'utilisateur : "${description}". Retourne UNIQUEMENT un JSON valide conforme à :
${YUKA_JSON_SCHEMA_FR}`;

  const parsed = await callGeminiNutritionJson([{ text: prompt }]);
  return buildResultFromParsed(parsed, {
    ...options,
    sourceType: 'text',
  });
}

/**
 * Bouton "Fix avec Aurelius" : corrige un repas déjà analysé/enregistré (oubli d'ingrédient, portion différente, sauce ajoutée...).
 */
export async function fixMealWithAurelius(
  existingMeal: CalAiAnalysisResult,
  correctionPrompt: string,
  language: 'fr' | 'en' = 'fr'
): Promise<CalAiAnalysisResult> {
  const isEn = language === 'en';
  const snapshot = {
    mealName: existingMeal.mealName,
    totalCalories: existingMeal.totalCalories,
    macros: existingMeal.macros,
    items: existingMeal.items,
    yuka: existingMeal.yuka,
  };

  const prompt = isEn
    ? `You are "Aurelius Fix Engine". The user noticed a mistake or missing item in their logged meal.
Current meal JSON:
${JSON.stringify(snapshot)}

User correction request: "${correctionPrompt}"

Apply the user's correction precisely (add missing food/oil/sauce, adjust portions, remove items, recalculate calories, protein, carbs, fat, fiber, Yuka score 0-100, positives, negatives, and advice). ALL text values MUST be written in English. Return ONLY valid JSON matching:
${YUKA_JSON_SCHEMA_EN}`
    : `Tu es "Aurelius Fix Engine". L'utilisateur signale un oubli ou une erreur dans l'analyse de son repas.
Repas actuel (JSON) :
${JSON.stringify(snapshot)}

Correction demandée par l'utilisateur : "${correctionPrompt}"

Applique exactement cette correction (ajoute l'ingrédient/sauce/huile oublié, ajuste les portions, retire ce qui n'y est pas, et recalcule proprement totalCalories, macros, items, note Yuka 0-100, points positifs/négatifs et conseil). Retourne UNIQUEMENT un JSON valide conforme à :
${YUKA_JSON_SCHEMA_FR}`;

  const parsed = await callGeminiNutritionJson([{ text: prompt }]);
  return buildResultFromParsed(parsed, {
    language,
    mealType: existingMeal.mealType,
    dateKey: existingMeal.dateKey,
    sourceType: existingMeal.sourceType || 'plate',
    imageUrl: existingMeal.imageUrl,
    existingId: existingMeal.id,
    fixedNote: correctionPrompt,
  });
}

function detectDefaultMealType(): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'snack';
  return 'dinner';
}

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

export function saveLoggedMeal(meal: CalAiAnalysisResult): void {
  if (typeof window === 'undefined') return;
  const dateKey = meal.dateKey || getLocalDateKey();
  const normalizedMeal: CalAiAnalysisResult = { ...meal, dateKey };
  const current = getLoggedMeals(dateKey).filter((m) => m.id !== normalizedMeal.id);
  const updated = [normalizedMeal, ...current];
  try {
    localStorage.setItem(`${CALAI_STORAGE_PREFIX}${dateKey}`, JSON.stringify(updated));
  } catch {
    try {
      const liteUpdated = updated.map((m, idx) => (idx === 0 || m.imageUrl ? { ...m, imageUrl: undefined } : m));
      localStorage.setItem(`${CALAI_STORAGE_PREFIX}${dateKey}`, JSON.stringify(liteUpdated));
    } catch (_) {}
  }
  try {
    window.dispatchEvent(new CustomEvent('aurel-meals-updated', { detail: { dateKey } }));
  } catch (_) {}
}

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

export function getDailyNutritionSummary(dateKey?: string): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  mealCount: number;
  avgYukaScore: number | null;
} {
  const meals = getLoggedMeals(dateKey);
  let yukaSum = 0;
  let yukaCount = 0;
  const sum = meals.reduce(
    (acc, m) => {
      acc.calories += m.totalCalories || 0;
      acc.protein += m.macros?.protein || 0;
      acc.carbs += m.macros?.carbs || 0;
      acc.fat += m.macros?.fat || 0;
      acc.fiber += m.macros?.fiber || 0;
      acc.mealCount += 1;
      const sc = m.yuka?.score ?? m.healthScore;
      if (typeof sc === 'number' && sc > 0) {
        yukaSum += sc;
        yukaCount += 1;
      }
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, mealCount: 0 }
  );
  return {
    ...sum,
    avgYukaScore: yukaCount > 0 ? Math.round(yukaSum / yukaCount) : null,
  };
}

export function getDailyHydrationMl(dateKey?: string): number {
  if (typeof window === 'undefined') return 0;
  const key = dateKey || getLocalDateKey();
  try {
    const val = Number(localStorage.getItem(`${CALAI_HYDRATION_PREFIX}${key}`) || 0);
    return isNaN(val) ? 0 : Math.max(0, Math.min(8000, Math.round(val)));
  } catch {
    return 0;
  }
}

export function saveDailyHydrationMl(ml: number, dateKey?: string): number {
  const clamped = Math.max(0, Math.min(8000, Math.round(ml)));
  if (typeof window === 'undefined') return clamped;
  const key = dateKey || getLocalDateKey();
  try {
    localStorage.setItem(`${CALAI_HYDRATION_PREFIX}${key}`, String(clamped));
  } catch (_) {}
  return clamped;
}

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

export function saveDailyTargets(target: CalAiDailyTarget): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CALAI_TARGET_STORAGE, JSON.stringify(target));
  } catch (_) {}
}

export function computeRecommendedDailyTargets(params: {
  sex: 'femme' | 'homme';
  age: number;
  heightCm: number;
  weightKg: number;
}): CalAiDailyTarget {
  const bmr =
    10 * params.weightKg +
    6.25 * params.heightCm -
    5 * params.age +
    (params.sex === 'homme' ? 5 : -161);
  const calories = Math.max(1350, Math.min(4200, Math.round((bmr * 1.45) / 10) * 10));
  const protein = Math.max(70, Math.round(params.weightKg * 1.8));
  const fat = Math.max(40, Math.round((calories * 0.27) / 9));
  const remainingKcal = Math.max(200, calories - protein * 4 - fat * 9);
  const carbs = Math.round(remainingKcal / 4);
  return { calories, protein, carbs, fat };
}
