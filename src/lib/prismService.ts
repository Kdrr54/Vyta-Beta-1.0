import { DayMetrics, UserProfile } from '../types';
import { calculateTargetStrain } from './covytaChatBot';

const PRISM_GEMINI_KEY_STORAGE = 'vyta_gemini_api_key';
const DEFAULT_GEMINI_KEY = 'AQ.Ab8RN6K8tuI674qFgJDFcJocIrMkR8Wt9fJku-9f9rUSMJzRrw';

let cachedWorkingModel: string | null = null;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

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
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {},
      4000
    );
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
    'gemini-flash-latest',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
  ];

  const sortedDynamic = dynamicModels
    .filter((m) => !m.includes('2.5') && !m.includes('2.0') && !m.includes('1.5'))
    .sort((a, b) => {
      if (a === 'gemini-3.5-flash') return -1;
      if (b === 'gemini-3.5-flash') return 1;
      if (a.includes('3.5') && !b.includes('3.5')) return -1;
      if (!a.includes('3.5') && b.includes('3.5')) return 1;
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
          generationConfig: {
            maxOutputTokens: 60,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });

      if (response.ok) {
        const friendlyName = model.includes('3.5')
          ? 'Gemini 3.5 Flash'
          : model.includes('3.7')
          ? 'Gemini 3.7 Flash'
          : model.includes('3.8')
          ? 'Gemini 3.8 Flash'
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
  const totalSleepMins = dayData.sleep.deepMin + dayData.sleep.remMin + dayData.sleep.lightMin;
  const sleepHours = Math.floor(totalSleepMins / 60);
  const sleepRemainderMins = totalSleepMins % 60;
  const isFemale = profile.sex === 'femme';

  const isZeroState = dayData.score === 0 && (dayData.bpm === 0 || dayData.steps === 0);

  if (isEn) {
    return `You are "Zénon", the biological intelligence and performance coach for the "Stoic Ring One" smart ring by Stoic Labs.
Your mission is to analyze the user's real biometric data and provide clear, reassuring, expert, and actionable advice.

CORE GUIDELINES:
1. NATURAL & ENGAGING TONE:
   - Speak in natural, friendly, and motivating English.
   - Avoid cryptic acronyms or unexplained jargon. Explain metrics simply.
   - Never output fragmented headers like "Target Strain: 8-11" or meta instructions like "Structure required".
2. CLARITY & BREVITY:
   - Directly answer what the user asked.
   - Start with a clear verdict ("You're in great shape today!", or "Your body needs rest today").
   - Highlight 2-3 key relevant biometrics using **bold numbers** with units.
   - Always conclude with a practical, personalized action or tip (preceded by 💡).
   - Keep answers well-spaced with bullet points, around 4 to 8 lines.

CURRENT REAL-TIME BIOMETRICS (${dayName}, ${isToday ? 'Today' : 'Archive'}):
• User: ${profile.firstName}, ${profile.age} yrs, ${profile.sex}, ${profile.weightKg} kg, ${profile.heightCm} cm.
• Vitality / Recovery Score: ${dayData.score} / 100
• Heart Rate Variability (HRV / RMSSD): ${dayData.hrv} ms (Baseline: ${dayData.hrvBaseline} ms)
• Heart Rate: Resting ${dayData.restingBpm} bpm, 24h Average ${dayData.bpm} bpm
• Sleep: ${sleepHours}h ${sleepRemainderMins}m (Score: ${dayData.sleep.score}/100, Deep: ${deepHours}h ${deepMins}m, REM: ${remHours}h ${remMins}m)
• Body Energy: ${dayData.bodyEnergy} %
• Skin Temp Deviation: ${dayData.tempDelta > 0 ? '+' : ''}${dayData.tempDelta} °C
• Blood Oxygen (SpO2): ${dayData.spo2 || 98} %
• Recommended Exertion (Target Strain): ${strain.label} (${strain.min} to ${strain.max} / 21)
• Activity: ${dayData.steps.toLocaleString()} steps, ${dayData.distanceKm} km, ${dayData.activeKcal} kcal.`;
  }

  return `Tu es "Zénon", l'intelligence biologique et coach de santé & performance de la bague connectée "Stoic Ring One" de Stoic Labs.
Ton rôle est d'analyser les données biométriques réelles de l'utilisateur pour lui donner des réponses claires, chaleureuses, expertes et immédiatement compréhensibles.

DIRECTIVES ESSENTIELLES :
1. PARLE EN FRANÇAIS NATUREL, FLUIDE ET BIENVEILLANT :
   - Parle comme un véritable coach personnel attentionné et compétent.
   - Évite absolument le jargon cryptique ou les termes techniques en anglais non expliqués. 
   - Ne réponds JAMAIS sous forme de bouts de phrases isolés ou de sigles bruts (ex: "Target Strain: 8-11" ou "Structure required"). Si tu mentionnes la charge d'entraînement, parle de "Niveau d'effort conseillé" ou "Capacité d'effort du jour".
   - Si l'utilisateur te salue ou te demande des nouvelles ("salut", "comment ça va"), réponds amicalement et propose-lui de faire un point sur sa forme du jour.
2. STRUCTURE CLAIRE ET DIGESTE :
   - Réponds directement et précisément à la question posée.
   - Commence par un verdict franc et rassurant (ex: "Oui ${profile.firstName}, ton corps est en très bonne forme aujourd'hui !").
   - Mets en valeur 2 ou 3 biométries clés les plus pertinentes avec leurs chiffres **en gras** et une brève explication de ce que cela signifie pour son corps.
   - Termine toujours par une recommandation concrète, pratique et adaptée (précédée de 💡).
   - Utilise des listes à puces (•) pour aérer et rendre la lecture agréable (4 à 8 lignes au total).

DONNÉES BIOMÉTRIQUES EN TEMPS RÉEL (${dayName}, ${isToday ? "Aujourd'hui" : "Archive"}) :
• Utilisateur : ${profile.firstName}, ${profile.age} ans, sexe biologique ${profile.sex}, ${profile.weightKg} kg, ${profile.heightCm} cm.
• Score de Vitalité / Récupération Globale : ${dayData.score} / 100 (${dayData.score >= 75 ? 'Excellente récupération' : dayData.score >= 50 ? 'Récupération modérée' : 'Fatigue / Besoin de repos'})
• Variabilité Cardiaque (VFC / RMSSD) : ${dayData.hrv} ms (Baseline habituelle : ${dayData.hrvBaseline} ms, écart : ${dayData.hrv - dayData.hrvBaseline >= 0 ? '+' : ''}${dayData.hrv - dayData.hrvBaseline} ms)
• Fréquence Cardiaque : Repos nocturne ${dayData.restingBpm} bpm, Moyenne ${dayData.bpm} bpm
• Sommeil de cette nuit : ${sleepHours}h ${sleepRemainderMins}m (Score : ${dayData.sleep.score}/100, dont ${deepHours}h ${deepMins}m de sommeil profond régénérateur et ${remHours}h ${remMins}m de paradoxal)
• Énergie Corporelle (Body Energy) : ${dayData.bodyEnergy} % (Réserve disponible)
• Température Cutanée : Écart ${dayData.tempDelta > 0 ? '+' : ''}${dayData.tempDelta} °C (vs moyenne habituelle)
• Oxygénation Sanguine SpO2 : ${dayData.spo2 || 98} % (Saturation optimale)
• Tension Artérielle Estimée : ${dayData.bloodPressure ? (dayData.bloodPressure.sbp + '/' + dayData.bloodPressure.dbp) : '118/78'} mmHg
• Activité du jour : ${dayData.steps.toLocaleString()} pas, ${dayData.distanceKm} km, ${dayData.activeKcal} kcal
• Niveau d'effort recommandé aujourd'hui : ${strain.label} (${strain.min} à ${strain.max} / 21)
${isFemale ? `• Physiologie Féminine : Suivi du cycle hormonal actif.` : ''}
• Statut immunitaire : ${dayData.anomaly ? `Attention: variation thermique inhabituelle (${dayData.anomaly.tempDelta > 0 ? '+' : ''}${dayData.anomaly.tempDelta}°C) et baisse de VFC.` : 'Biomarqueurs stables, système immunitaire au repos.'}
${isZeroState ? `[Note : La bague vient d'être synchronisée, encourage l'utilisateur avec ses premières mesures.]` : ''}`;
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

  const fallbackList = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3.7-flash',
  ];

  let candidateModels: string[];
  if (cachedWorkingModel) {
    candidateModels = Array.from(new Set([cachedWorkingModel, ...fallbackList])).slice(0, 4);
  } else {
    const dynamicModels = await fetchActiveGeminiModels(apiKey);
    const sortedDynamic = dynamicModels
      .filter((m) =>
        m.includes('flash') &&
        !m.includes('image') &&
        !m.includes('tts') &&
        !m.includes('audio') &&
        !m.includes('2.5') &&
        !m.includes('2.0') &&
        !m.includes('1.5')
      )
      .sort((a, b) => {
        if (a === 'gemini-3.5-flash') return -1;
        if (b === 'gemini-3.5-flash') return 1;
        if (a.includes('3.5') && !b.includes('3.5')) return -1;
        if (!a.includes('3.5') && b.includes('3.5')) return 1;
        return 0;
      });
    candidateModels = Array.from(new Set([...sortedDynamic, ...fallbackList])).slice(0, 4);
  }

  let lastError = '';

  for (const model of candidateModels) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetchWithTimeout(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 1200,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
      }, 14000);

      if (response.ok) {
        cachedWorkingModel = model;
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
      if (cachedWorkingModel === model) cachedWorkingModel = null;
      lastError = err?.name === 'AbortError'
        ? 'Délai dépassé (serveur lent)'
        : (err?.message || 'Erreur réseau');
    }
  }

  return {
    text: '',
    isRealAI: false,
    error: lastError || 'Erreur de connexion aux serveurs Gemini.',
  };
}
