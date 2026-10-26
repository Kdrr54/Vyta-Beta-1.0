import { DayMetrics, UserProfile, CoachingPersona } from '../types';
import { calculateTargetStrain } from './covytaChatBot';

const GEMINI_KEY_STORAGE = 'vyta_gemini_api_key';

/**
 * Récupère la clé API Gemini depuis l'environnement ou le localStorage
 */
export function getStoredGeminiKey(): string {
  if (typeof window !== 'undefined') {
    // 1. Clé stockée dans l'application
    const saved = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (saved && saved.trim().length > 5) return saved.trim();

    // 2. Variable d'environnement Vite (si fournie)
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 5) {
      return envKey.trim();
    }
  }
  return '';
}

/**
 * Enregistre la clé API Gemini dans le localStorage
 */
export function setStoredGeminiKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key.trim()) {
      localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    }
  }
}

export interface GeminiKeyTestResult {
  success: boolean;
  model?: string;
  error?: string;
}

/**
 * Découvre dynamiquement les modèles de génération disponibles pour la clé API
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
    console.warn('Impossible de lister les modèles dynamiquement:', e);
  }
  return [];
}

/**
 * Teste la validité d'une clé API Gemini en envoyant un ping léger
 */
export async function testGeminiApiKey(apiKey: string): Promise<GeminiKeyTestResult> {
  const clean = apiKey.trim();
  if (!clean) {
    return { success: false, error: 'Clé API vide' };
  }

  // 1. Découverte dynamique des modèles sur le compte de l'utilisateur
  const dynamicModels = await fetchActiveGeminiModels(clean);

  // 2. Modèles prioritaires (gemini-2.5-flash en premier comme demandé par Google)
  const fallbackList = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-latest',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
  ];

  const sortedDynamic = dynamicModels.sort((a, b) => {
    if (a.includes('2.5') && !b.includes('2.5')) return -1;
    if (!a.includes('2.5') && b.includes('2.5')) return 1;
    if (a.includes('flash') && !b.includes('flash')) return -1;
    if (!a.includes('flash') && b.includes('flash')) return 1;
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
          contents: [{ role: 'user', parts: [{ text: 'Ping test. Reply: OK' }] }],
          generationConfig: { maxOutputTokens: 10 },
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
            error: errMsg || `Clé invalide ou refusée (HTTP ${response.status})`,
          };
        }
      }
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Erreur réseau lors du test de connexion',
      };
    }
  }

  return {
    success: false,
    error: 'Impossible de joindre les serveurs Google Gemini.',
  };
}

export interface BiometricPromptContext {
  prompt: string;
  profile: UserProfile;
  dayData: DayMetrics;
  dayName: string;
  isToday: boolean;
  language: 'fr' | 'en';
  persona: CoachingPersona;
  conversationHistory?: { sender: 'user' | 'ai'; text: string }[];
}

export interface GeminiResponseResult {
  text: string;
  thinking?: string;
  isRealAI: boolean;
  error?: string;
}

/**
 * Construit le System Prompt ultra-riche pour Gemini avec tout le contexte biométrique Bevel
 */
function buildBiometricSystemPrompt(ctx: BiometricPromptContext): string {
  const { profile, dayData, dayName, isToday, language, persona } = ctx;
  const isEn = language === 'en';
  const strain = calculateTargetStrain(dayData.score);
  const deepHours = Math.floor(dayData.sleep.deepMin / 60);
  const deepMins = dayData.sleep.deepMin % 60;
  const remHours = Math.floor(dayData.sleep.remMin / 60);
  const remMins = dayData.sleep.remMin % 60;

  const isZeroState = dayData.score === 0 && (dayData.bpm === 0 || dayData.steps === 0);

  return `Tu es "CoVyta IA", l'intelligence artificielle conversationnelle et biométrique officielle de la bague connectée en titane "Vyta One".
${isZeroState ? `
[ÉTAT DU MATÉRIEL : La bague connectée est actuellement réinitialisée à 0 donnée de santé en attente de première utilisation. Si l'utilisateur te demande d'analyser ses scores ou sa nuit du jour, rappelle-lui gentiment que la bague attend ses premières synchronisations. Pour toute autre question (santé, sport, bien-être, physiologie, entraînement, conversation générale), réponds-lui de manière naturelle, experte et complète sans bloquer la discussion.]` : ''}

Tu es une véritable intelligence artificielle générative. Réponds de façon humaine, vivante, personnalisée et bienveillante à chaque question posée.

==================================================
TÉLÉMÉTRIE BIOMÉTRIQUE RÉELLE DE L'UTILISATEUR (${dayName}) :
==================================================
• Profil : ${profile.firstName}, ${profile.age} ans, sexe biologique ${profile.sex}, ${profile.weightKg} kg, ${profile.heightCm} cm.
• Date analysée : ${dayName} ${isToday ? "(Aujourd'hui - temps réel)" : "(Journée passée)"}
• Score de Vitalité / Récupération : ${dayData.score} / 100
• Target Strain Bevel Cible : ${strain.min} à ${strain.max} / 21 (Niveau : ${strain.label})
• Body Energy (Batterie Corporelle) : ${dayData.bodyEnergy} % (démarré à ${dayData.bodyEnergyWake} % au réveil)
• Variabilité Cardiaque VFC (RMSSD) : ${dayData.hrv} ms (Ligne de base : ${dayData.hrvBaseline} ms)
• Fréquence Cardiaque : Repos ${dayData.restingBpm} bpm, Moyenne 24h ${dayData.bpm} bpm
• Écart de Température Cutanée Nocturne : ${dayData.tempDelta > 0 ? '+' : ''}${dayData.tempDelta} °C (par rapport au zéro de référence)
• Architecture du Sommeil :
  - Score Sommeil : ${dayData.sleep.score} / 100
  - Sommeil Profond : ${deepHours}h ${deepMins}m (${Math.round((dayData.sleep.deepMin / 460) * 100)} %)
  - Sommeil Paradoxal (REM) : ${remHours}h ${remMins}m
  - Sommeil Léger : ${Math.floor(dayData.sleep.lightMin / 60)}h ${dayData.sleep.lightMin % 60}m
  - Éveil nocturne : ${dayData.sleep.awakeMin} min
• Activité & Charge : ${dayData.steps.toLocaleString()} pas, ${dayData.distanceKm} km, ${dayData.activeKcal} kcal brûlées
• Radar Immunitaire : ${dayData.anomaly ? `Anomalie thermique/VFC détectée (+${dayData.anomaly.tempDelta}°C, VFC ${dayData.anomaly.hrvDelta}ms)` : 'Système immunitaire stable, aucune anomalie'}

==================================================
MODE DE PENSÉE & PERSONA ACTIF : "${persona.toUpperCase()}"
==================================================
Adapte strictement ton ton selon la persona :
1. "ANALYST" (Data Nerd) : Approche scientifique et mathématique rigoureuse. Utilise des z-scores, nadir cardiaque, pourcentages d'architecture de sommeil, déviations standard de VFC et mécanismes biochimiques (adénosine, cortisol, acétylcholine).
2. "COMMANDER" (Coach Performance) : Ton direct, percutant, motivant. Donne un verdict net (Push ou Deload), fixe les cibles de Target Strain, zones d'effort (Zone 2 vs Zone 4), et des formats de séries/reps/RPE si musculation demandée.
3. "GUARDIAN" (Longévité & Bienveillance) : Priorise la préservation du système nerveux parasympathique, le tonus vagal, la baisse de l'inflammation, la cohérence circadienne et un sommeil réparateur.

==================================================
DIRECTIVES CRUCIALES DE RAISONNEMENT :
==================================================
1. Commence OBLIGATOIREMENT ta réponse par un bloc <thinking>...</thinking> dans lequel tu détailles ton raisonnement étape par étape :
   - Analyse des signaux contradictoires ou dominants de la bague
   - Calcul de la charge résiduelle et du tonus vagal
   - Déduction causale
2. Après la balise </thinking>, fournis la réponse destinée à l'utilisateur :
   - Structure ta réponse avec des titres Markdown ("### Titre"), du gras ("**mot**"), et des puces ("•").
   - Intègre toujours une section "🔗 Synthèse Causale" (format Bevel : \`Facteur A\` ➔ \`Signal B\` ➔ \`Conséquence C\`).
   - Réponds en ${isEn ? 'anglais' : 'français'}, avec clarté, expertise et naturel. Ne dis jamais que tu es un simple modèle de texte : tu es CoVyta IA, l'intelligence vivante de la bague Vyta One.`;
}

/**
 * Appelle l'API Google Gemini 2.0 Flash avec Thinking / Raisonnement
 */
export async function queryGeminiBiometricAI(ctx: BiometricPromptContext): Promise<GeminiResponseResult> {
  const apiKey = getStoredGeminiKey();

  if (!apiKey) {
    return {
      text: '',
      isRealAI: false,
      error: 'NO_API_KEY',
    };
  }

  const systemInstruction = buildBiometricSystemPrompt(ctx);

  // Construction de l'historique conversationnel pour le contexte multi-tours
  const contents: any[] = [];
  
  if (ctx.conversationHistory && ctx.conversationHistory.length > 0) {
    // Ne garder que les 6 derniers messages pour rester réactif et concentré
    const recent = ctx.conversationHistory.slice(-6);
    for (const msg of recent) {
      contents.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      });
    }
  }

  // Ajouter la question actuelle
  contents.push({
    role: 'user',
    parts: [{ text: ctx.prompt }],
  });

  // 1. Découverte dynamique des modèles sur le compte de l'utilisateur
  const dynamicModels = await fetchActiveGeminiModels(apiKey);

  const fallbackList = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-latest',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
  ];

  const sortedDynamic = dynamicModels.sort((a, b) => {
    if (a.includes('2.5') && !b.includes('2.5')) return -1;
    if (!a.includes('2.5') && b.includes('2.5')) return 1;
    if (a.includes('flash') && !b.includes('flash')) return -1;
    if (!a.includes('flash') && b.includes('flash')) return 1;
    return 0;
  });

  const candidateModels = Array.from(new Set([...sortedDynamic, ...fallbackList]));

  let lastError = '';

  for (const model of candidateModels) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1200,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!rawText) {
          return {
            text: ctx.language === 'en' ? 'No response generated.' : 'Aucune réponse générée.',
            isRealAI: true,
          };
        }

        // Extraction de la balise <thinking>...</thinking>
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
        const errMsg = errJson?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        lastError = errMsg;
        console.warn(`Modèle Gemini ${model} indisponible (${errMsg}), essai du modèle suivant...`);
        // Si c'est une clé invalide, inutile d'essayer les autres modèles
        if (response.status === 400 && errMsg?.includes('API key not valid')) {
          break;
        }
      }
    } catch (err: any) {
      lastError = err?.message || 'Erreur réseau';
      console.warn(`Exception sur modèle ${model}:`, err);
    }
  }

  return {
    text: '',
    isRealAI: false,
    error: lastError || 'Aucun modèle Gemini disponible.',
  };
}
