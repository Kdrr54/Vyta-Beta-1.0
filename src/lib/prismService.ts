import { DayMetrics, UserProfile } from '../types';
import { calculateTargetStrain } from './covytaChatBot';

const PRISM_GEMINI_KEY_STORAGE = 'vyta_gemini_api_key';
const DEFAULT_GEMINI_KEY = 'AQ.Ab8RN6K8tuI674qFgJDFcJocIrMkR8Wt9fJku-9f9rUSMJzRrw';

/**
 * Récupère la clé API Gemini depuis l'environnement ou le localStorage
 */
export function getStoredPrismKey(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(PRISM_GEMINI_KEY_STORAGE);
    if (saved && saved.trim().length > 5) return saved.trim();

    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 5) {
      return envKey.trim();
    }
  }
  return DEFAULT_GEMINI_KEY;
}

/**
 * Enregistre la clé API Gemini
 */
export function setStoredPrismKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key.trim()) {
      localStorage.setItem(PRISM_GEMINI_KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(PRISM_GEMINI_KEY_STORAGE);
    }
  }
}

export interface PrismKeyTestResult {
  success: boolean;
  model?: string;
  error?: string;
}

/**
 * Découvre dynamiquement les modèles disponibles pour la clé API
 */
async function fetchActiveGeminiModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      const models: string[] = (data.models || [])
        .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m: any) => m.name.replace(/^models\//, ''));
      if (models.length > 0) {
        return models;
      }
    }
  } catch (e) {
    console.warn('[Prism] Impossible de lister les modèles dynamiquement:', e);
  }
  return [];
}

/**
 * Teste la validité de la clé API
 */
export async function testPrismApiKey(apiKey: string): Promise<PrismKeyTestResult> {
  const clean = apiKey.trim();
  if (!clean) {
    return { success: false, error: 'Clé API vide' };
  }

  const dynamicModels = await fetchActiveGeminiModels(clean);

  const fallbackList = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ];

  const sortedDynamic = dynamicModels.sort((a, b) => {
    if (a.includes('3.5') && !b.includes('3.5')) return -1;
    if (!a.includes('3.5') && b.includes('3.5')) return 1;
    if (a.includes('flash') && !b.includes('flash')) return -1;
    return 0;
  });

  const models = Array.from(new Set([...sortedDynamic, ...fallbackList]));

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${clean}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Ping Prism test. Reply OK' }] }],
          generationConfig: { maxOutputTokens: 8 },
        }),
      });

      if (response.ok) {
        const friendlyName = model.includes('2.5')
          ? 'Gemini 2.5 Flash'
          : model.includes('2.0')
          ? 'Gemini 2.0 Flash'
          : model.includes('pro')
          ? 'Gemini Pro'
          : 'Gemini Flash';

        return {
          success: true,
          model: friendlyName,
        };
      } else {
        const errJson = await response.json().catch(() => null);
        const errMsg = errJson?.error?.message;
        if (response.status === 400 && errMsg?.includes('API key not valid')) {
          return {
            success: false,
            error: errMsg || `Clé invalide (HTTP ${response.status})`,
          };
        }
      }
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Erreur de connexion',
      };
    }
  }

  return {
    success: false,
    error: 'Impossible de joindre les serveurs IA.',
  };
}

export interface PrismPromptContext {
  prompt: string;
  profile: UserProfile;
  dayData: DayMetrics;
  dayName: string;
  isToday: boolean;
  language: 'fr' | 'en';
  conversationHistory?: { sender: 'user' | 'prism'; text: string }[];
}

export interface PrismResponseResult {
  text: string;
  thinking?: string;
  isRealAI: boolean;
  error?: string;
}

/**
 * Construit le prompt système clinique de Prism avec toute la télémétrie des 8 biométries
 */
function buildPrismSystemPrompt(ctx: PrismPromptContext): string {
  const { profile, dayData, dayName, isToday, language } = ctx;
  const isEn = language === 'en';
  const strain = calculateTargetStrain(dayData.score);
  const deepHours = Math.floor(dayData.sleep.deepMin / 60);
  const deepMins = dayData.sleep.deepMin % 60;
  const remHours = Math.floor(dayData.sleep.remMin / 60);
  const remMins = dayData.sleep.remMin % 60;
  const isFemale = profile.sex === 'femme';

  const isZeroState = dayData.score === 0 && (dayData.bpm === 0 || dayData.steps === 0);

  return `Tu es "Prism", l'IA de la bague connectée "Vyta One", spécialisée à 100% en Health & Fitness.

${isZeroState ? `[ÉTAT MATÉRIEL : Bague neuve ou réinitialisée en attente de synchronisation.]` : ''}

==================================================
RÈGLE SUPRÊME : CONCISION RADICALE (QUE L'ESSENTIEL) :
==================================================
- L'utilisateur VEUT UNIQUEMENT L'ESSENTIEL. INTERDICTION FORMELLE DE FAIRE DES DISCOURS OU DU BAVARDAGE.
- MAXIMUM 2 À 4 LIGNES AU TOTAL (30 à 60 mots max). Jamais de gros pavé.
- ZÉRO phrase d'introduction creuse ("C'est une excellente question", "D'un point de vue physiologique...", "J'espère que tu vas bien").
- Va DROIT AU BUT dès le 1er mot :
  1. Verdict direct (1 courte phrase claire).
  2. Les 1 ou 2 chiffres clés biométriques en gras (**74 ms**, **89/100**, **51 bpm**, etc.).
  3. L'action concrète immédiate précédée de 💡 ou 🎯.

==================================================
PÉRIMÈTRE HEALTH & FITNESS & REFUS ULTRA-COURTS :
==================================================
- Tu traites EXCLUSIVEMENT la santé, le sport, la récupération, le sommeil et la nutrition sportive.
- Si la question est hors sujet (devoir de français, maths, code, météo, culture générale) : REFUSE EN UNE SEULE PHRASE NETTE :
  "Je gère uniquement ta santé, ton sommeil et ton sport avec la bague Vyta One. Pose-moi une question sur ta forme !"
- Si salutation ("salut", "ça va") : Réponds en UNE SEULE phrase amicale et courte.

==================================================
DONNÉES BIOMÉTRIQUES EN TEMPS RÉEL (${dayName}, ${isToday ? "Aujourd'hui" : "Archive"}) :
==================================================
• Utilisateur : ${profile.firstName}, ${profile.age} ans, sexe biologique ${profile.sex}, ${profile.weightKg} kg, ${profile.heightCm} cm.
• Score de Vitalité / Récupération Globale : ${dayData.score} / 100
• Variabilité Cardiaque VFC (RMSSD) : ${dayData.hrv} ms (Baseline personnelle : ${dayData.hrvBaseline} ms, écart : ${dayData.hrv - dayData.hrvBaseline >= 0 ? '+' : ''}${dayData.hrv - dayData.hrvBaseline} ms)
• Fréquence Cardiaque : Repos nocturne ${dayData.restingBpm} bpm, Moyenne 24h ${dayData.bpm} bpm
• Architecture du Sommeil :
  - Score Sommeil : ${dayData.sleep.score} / 100 (${Math.floor((dayData.sleep.deepMin + dayData.sleep.remMin + dayData.sleep.lightMin) / 60)}h ${(dayData.sleep.deepMin + dayData.sleep.remMin + dayData.sleep.lightMin) % 60}m)
  - Sommeil Profond : ${deepHours}h ${deepMins}m
  - Sommeil Paradoxal (REM) : ${remHours}h ${remMins}m
  - Sommeil Léger : ${Math.floor(dayData.sleep.lightMin / 60)}h ${dayData.sleep.lightMin % 60}m
  - Éveils nocturnes : ${dayData.sleep.awakeMin} min
• Batterie Corporelle (Body Energy) : ${dayData.bodyEnergy} %
• Écart Thermique Cutané : ${dayData.tempDelta > 0 ? '+' : ''}${dayData.tempDelta} °C (vs moyenne 0.0 °C)
• Oxygénation Sanguine SpO2 : ${dayData.spo2 || 98} %
• Tension Artérielle Estimée : ${dayData.bloodPressure ? (dayData.bloodPressure.sbp + '/' + dayData.bloodPressure.dbp) : '118/78'} mmHg
• Activité & Charge : ${dayData.steps.toLocaleString()} pas, ${dayData.distanceKm} km, ${dayData.activeKcal} kcal
• Target Strain Cible : ${strain.min} à ${strain.max} / 21 (Niveau : ${strain.label})
${isFemale ? `• Physiologie Féminine : Suivi de cycle actif.` : ''}
• Statut immunitaire : ${dayData.anomaly ? `Attention: variation thermique inhabituelle (${dayData.anomaly.tempDelta > 0 ? '+' : ''}${dayData.anomaly.tempDelta}°C) et baisse de VFC.` : 'Biomarqueurs stables, aucun signe inflammatoire.'}

Réponds impérativement en ${isEn ? 'anglais' : 'français'}.`;
}

/**
 * Envoie une requête directe à la véritable IA Google Gemini
 * ZÉRO message prédéfini : appelle l'API ou renvoie une erreur explicite si clé manquante.
 */
export async function queryPrismAI(ctx: PrismPromptContext): Promise<PrismResponseResult> {
  const apiKey = getStoredPrismKey();

  if (!apiKey) {
    return {
      text: '',
      isRealAI: false,
      error: 'NO_API_KEY',
    };
  }

  const systemInstruction = buildPrismSystemPrompt(ctx);

  const contents: any[] = [];
  if (ctx.conversationHistory && ctx.conversationHistory.length > 0) {
    const recent = ctx.conversationHistory.slice(-6);
    for (const msg of recent) {
      contents.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      });
    }
  }

  contents.push({
    role: 'user',
    parts: [{ text: ctx.prompt }],
  });

  const dynamicModels = await fetchActiveGeminiModels(apiKey);
  const fallbackList = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ];

  const sortedDynamic = dynamicModels.sort((a, b) => {
    if (a.includes('3.5') && !b.includes('3.5')) return -1;
    if (!a.includes('3.5') && b.includes('3.5')) return 1;
    if (a.includes('flash') && !b.includes('flash')) return -1;
    return 0;
  });

  const candidateModels = Array.from(new Set([...sortedDynamic, ...fallbackList]));
  let lastError = '';

  for (const model of candidateModels) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 220,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!rawText) {
          return {
            text: ctx.language === 'en' ? 'No response generated by the AI model.' : "L'IA n'a retourné aucune réponse.",
            isRealAI: true,
          };
        }

        let thinking = '';
        let userText = rawText;

        const thinkingMatch = rawText.match(/<thinking>([\s\S]*?)<\/thinking>/i);
        if (thinkingMatch) {
          thinking = thinkingMatch[1].trim();
          userText = rawText.replace(/<thinking>[\s\S]*?<\/thinking>/i, '').trim();
        }

        return {
          text: userText,
          thinking,
          isRealAI: true,
        };
      } else {
        const errJson = await response.json().catch(() => null);
        const errMsg = errJson?.error?.message || `HTTP ${response.status}`;
        lastError = errMsg;
        if (response.status === 400 && errMsg?.includes('API key not valid')) {
          break;
        }
      }
    } catch (err: any) {
      lastError = err?.message || 'Erreur réseau';
    }
  }

  return {
    text: '',
    isRealAI: false,
    error: lastError || 'Erreur de connexion aux serveurs Gemini.',
  };
}
