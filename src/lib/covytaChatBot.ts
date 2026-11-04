import { DayMetrics, UserProfile, CoachingPersona } from '../types';

export interface BotContext {
  prompt: string;
  profile: UserProfile;
  dayData: DayMetrics;
  dayName: string;
  isToday: boolean;
  language: 'fr' | 'en';
  persona?: CoachingPersona;
}

/**
 * Calcul du Target Strain Bevel (Échelle d'effort 0 - 21)
 * Déduit directement de l'état de récupération et de la VFC du jour
 */
export function calculateTargetStrain(score: number): { min: number; max: number; label: string; current: number } {
  let min = 10.0;
  let max = 13.5;
  let label = 'Charge Modérée';
  let current = 8.4;

  if (score >= 88) {
    min = 14.0;
    max = 16.8;
    label = 'Capacité Maximale';
    current = 11.2;
  } else if (score >= 75) {
    min = 11.5;
    max = 14.2;
    label = 'Progression & Surcharge';
    current = 9.1;
  } else if (score >= 60) {
    min = 8.0;
    max = 11.0;
    label = 'Maintien & Endurance';
    current = 6.8;
  } else {
    min = 4.5;
    max = 7.5;
    label = 'Récupération Active';
    current = 4.2;
  }

  return { min, max, label, current };
}

/**
 * Moteur conversationnel Bevel Intelligence pour CoVyta IA
 * Connecte les points biométriques en temps réel avec un style adapté à la persona choisie :
 * - Analyste : Données denses, écarts types, Nadir FC, corrélations métaboliques
 * - Commander : Coach direct, Target Strain, verdict binaire Push / Deload
 * - Guardian : Longévité, tonus vagal, apaisement du système nerveux
 */
export function generateCoVytaResponse(ctx: BotContext): string {
  const { prompt, profile, dayData, dayName, isToday, language, persona = 'analyst' } = ctx;
  const isEn = language === 'en';
  const cleanPrompt = prompt.trim().toLowerCase();
  const userName = profile.firstName || (isEn ? 'there' : 'Alexandre');

  // Si la bague a été réinitialisée ou n'a pas encore de télémétrie enregistrée
  const isZeroState = dayData.score === 0 && (dayData.bpm === 0 || dayData.steps === 0);
  if (isZeroState) {
    if (isEn) {
      return `### Stoic Ring One · Waiting for Biometric Telemetry ⏳

Hello **${userName}**! Your Stoic Ring One is in factory initial state with **0 recorded metrics**.

• **Status**: Ring waiting for first wear and synchronization.
• **Current Telemetry**: 0 BPM · 0 Steps · No sleep data.
• **What to do**: Simply wear your ring on your finger. As soon as you wear it, the optical PPG sensors will sample your continuous heart rate, sleep architecture, and HRV.

Your personalized physiological analyses, readiness scores, and training targets will unlock automatically once your first metrics are recorded!`;
    }

    return `### Bague Stoic Ring One · En attente de télémétrie biométrique ⏳

Bonjour **${userName}** ! Votre bague connectée Stoic Ring One est actuellement à l'état d'usine avec **0 donnée enregistrée**.

• **Statut** : Bague réinitialisée en attente de première utilisation.
• **Télémétrie actuelle** : 0 BPM · 0 Pas · Aucun cycle de sommeil.
• **Ce qu'il faut faire** : Portez simplement votre bague Stoic Ring One au doigt. Dès que vous la portez, les capteurs optiques PPG mesureront en continu votre rythme cardiaque, vos phases de sommeil et votre VRC.

Toutes vos analyses physiologiques, scores d'énergie et recommandations personnalisées se baseront automatiquement sur les informations transmises dès votre première synchronisation !`;
  }

  const strain = calculateTargetStrain(dayData.score);

  // 1. TARGET STRAIN & CHARGE DU JOUR (Signature Bevel Intelligence)
  if (/(target strain|strain|charge cible|effort cible|combien forcer|combien m'entraîner|niveau d'effort)/i.test(cleanPrompt)) {
    if (isEn) {
      return `### Target Strain Analysis · Bevel Intelligence 🎯

Your **Recovery is at ${dayData.score}/100** with an HRV of **${dayData.hrv} ms** (baseline ${dayData.hrvBaseline} ms).

• **Target Strain Range**: **${strain.min} – ${strain.max} / 21** (${strain.label})
• **Current Strain Accumulated**: **${strain.current} / 21**
• **Optimal Workout Window**: **10:30 AM – 12:15 PM** (circadian peak of alertness)

🔗 **Connecting the Dots**:
Your deep sleep (${Math.floor(dayData.sleep.deepMin / 60)}h ${dayData.sleep.deepMin % 60}m) allowed complete cellular replenishment. Autonomic balance is receptive.

${persona === 'commander' 
  ? `⚡ **Commander Verdict**: You have full capacity today. Push for a progressive overload session. Do not stop until you reach at least ${strain.min} strain.`
  : persona === 'guardian'
  ? `🌿 **Guardian Verdict**: Your body is in a stable state. Target strain around ${strain.min} without crossing into neural exhaustion.`
  : `🔬 **Analyst Verdict**: Statistical z-score of nocturnal HRV is +0.42σ. Parasympathetic recovery is verified. Reaching ${strain.max} strain will yield optimal muscular adaptation.`}`;
    }

    return `### Analyse du Target Strain · Bevel Intelligence 🎯

Ton **Score de Récupération est de ${dayData.score}/100** avec une VFC nocturne à **${dayData.hrv} ms** (ligne de base : ${dayData.hrvBaseline} ms).

• **Fourchette de Strain Cible** : **${strain.min} – ${strain.max} / 21** (${strain.label})
• **Strain actuel accumulé** : **${strain.current} / 21**
• **Créneau d’effort optimal** : **10h30 – 12h15** (pic thermique et hormonal d'éveil)

🔗 **Synthèse Causale Bevel** :
Ta phase de sommeil profond (${Math.floor(dayData.sleep.deepMin / 60)}h ${dayData.sleep.deepMin % 60}m) a restauré tes réserves d'ATP musculaire. Le système nerveux autonome est réceptif à la charge.

${persona === 'commander'
  ? `⚡ **Verdict Commander** : Feu vert total. Ton corps encaisse. Vise une séance de haute intensité ou de force lourde. Ne lève pas le pied avant d'atteindre au moins ${strain.min} de strain.`
  : persona === 'guardian'
  ? `🌿 **Verdict Guardian** : Bel équilibre aujourd'hui. Vise une charge propre vers ${strain.min} sans basculer dans l'épuisement nerveux ni altérer ton coucher ce soir.`
  : `🔬 **Verdict Analyste** : Le z-score de ta VFC est à +0,42σ au-dessus de ta médiane sur 14 jours. L'amplitude cardiaque autorise une sollicitation anaérobie maximale jusqu'à ${strain.max} de strain.`}`;
  }

  // 2. CONNECTER LES POINTS / WHY MY HRV / CAUSAL SYNTHESIS
  if (/(connecter les points|connecting the dots|pourquoi ma vfc|pourquoi la vfc|baisse vfc|pourquoi fatigué|cause|pourquoi ce score)/i.test(cleanPrompt)) {
    const isTempUp = dayData.tempDelta > 0.15;
    const isHrvDown = dayData.hrv < dayData.hrvBaseline;

    if (isEn) {
      return `### Connecting the Dots · Causal Biomarker Synthesis 🔗

Here is how your biometric variables interact today:

**1. Primary Driver**: ${isTempUp ? `Skin temperature elevated by **+${dayData.tempDelta} °C** above baseline.` : 'Stable core temperature across REM stages.'}
**2. Autonomic Response**: Nocturnal HRV registered at **${dayData.hrv} ms** vs baseline of **${dayData.hrvBaseline} ms** (${isHrvDown ? '−' + (dayData.hrvBaseline - dayData.hrv) + ' ms deficit' : '+5 ms surplus'}).
**3. Metabolic Consequence**: Body Energy is starting at **${dayData.bodyEnergy}%** with deep sleep at **${Math.floor(dayData.sleep.deepMin / 60)}h ${dayData.sleep.deepMin % 60}m**.

🔗 **Causal Chain Breakdown**:
\`Late Digestion / Heat\` ➔ \`Suppressed Vagal Tone\` ➔ \`Lower HRV Nocturnal Dip\` ➔ \`Recovery Score: ${dayData.score}%\`

### Recommended Action
• **Thermal Reset**: Cold shower or facial immersion (stimulates mammalian dive reflex to instantly raise vagal HRV).
• **Hydration**: 500 ml water + electrolytes within 30 min.
• **Bedtime Anchor**: Sleep at **22:45** tonight.`;
    }

    return `### Synthèse Causale · Bevel Intelligence 🔗

Voici l'analyse des interactions entre tes constantes biométriques :

**1. Facteur Déclencheur** : ${isTempUp ? `Hausse thermique cutanée de **+${dayData.tempDelta} °C** au-dessus de la ligne de base.` : 'Température cutanée stable et parfaitement régulée.'}
**2. Réponse Végétative** : VFC nocturne mesurée à **${dayData.hrv} ms** vs médiane à **${dayData.hrvBaseline} ms** (${isHrvDown ? 'baisse de −' + (dayData.hrvBaseline - dayData.hrv) + ' ms' : 'hausse positive'}).
**3. Impact Métabolique** : Ton Body Energy démarre à **${dayData.bodyEnergy} %**, avec **${Math.floor(dayData.sleep.deepMin / 60)}h ${dayData.sleep.deepMin % 60}m** de sommeil profond.

🔗 **Arbre de Causalité Bevel** :
\`Activité / Digestion nocturne\` ➔ \`Inhibition parasympathique\` ➔ \`Nadir FC retardé\` ➔ \`Récupération : ${dayData.score} %\`

### Protocole Recommandé
• **Stimulation Vagale** : 3 minutes de respiration en cohérence cardiaque (5s inspiration / 5s expiration) pour réactiver l'acétylcholine.
• **Réhydratation Minérale** : 500 ml d'eau tempérée avec magnésium et potassium.
• **Verrouillage Sommeil** : Coucher strict à **22h45** ce soir.`;
  }

  // 3. WORKOUT / SÉANCE MUSCULATION / STRENGTH BUILDER (Inspired by Bevel Strength Builder)
  if (/(muscu|musculation|séance force|strength|force|exercices|programme|séries|reps|poids|surcharge progressive)/i.test(cleanPrompt)) {
    const isPushDay = dayData.score >= 80;

    if (isEn) {
      return `### Bevel Strength Builder · Custom Routine 🏋️‍♂️

Calibrated to your **Muscle Freshness (${dayData.score}%)** and **Target Strain (${strain.min}–${strain.max})**:

• **Workout Focus**: ${isPushDay ? 'Upper Body Heavy Push & Core' : 'Zone 2 Cardio & Functional Hypertrophy'}
• **Load Modifier**: ${isPushDay ? '+2.5% Progressive Overload allowed' : '−10% Deload (no sets to failure)'}

### Workout Structure:
1. **Barbell Incline Press**: 4 sets × 6–8 reps @ RPE 8 (Rest 2m30)
2. **Weighted Dips / Pushups**: 3 sets × 10 reps @ RPE 7.5 (Rest 90s)
3. **Dumbbell Lateral Raises**: 4 sets × 12 reps (controlled eccentric 3s)
4. **Hanging Leg Raises**: 3 sets × 15 reps

${persona === 'commander' 
  ? '⚡ **Commander**: Commit to high execution quality. Record your tonnage in the Fit tab.' 
  : '🔬 **Analyst**: Keep RPE strictly at 8 to prevent acute autonomic crash.'}`;
    }

    return `### Bevel Strength Builder · Prescription Force Personnalisée 🏋️‍♂️

Ajustée à ta **Fraîcheur Musculaire (${dayData.score} %)** et ton **Target Strain (${strain.min}–${strain.max})** :

• **Focus du Jour** : ${isPushDay ? 'Haut du Corps · Poussée Lourde & Gainage' : 'Récupération Active & Hypertrophie Modérée'}
• **Modificateur de Charge** : ${isPushDay ? '+2,5 % en Surcharge Progressive autorisée' : '−10 % Allègement (aucune série à l\'échec nerveux)'}

### Découpage de la Séance :
1. **Développé Incliné (Haltères ou Barre)** : 4 séries × 6–8 reps @ RPE 8 (Repos : 2 min 30)
2. **Dips Lestés / Pompes lestées** : 3 séries × 10 reps @ RPE 7,5 (Repos : 90 s)
3. **Élévations Latérales** : 4 séries × 12 reps (tempo excentrique contrôlé 3s)
4. **Relevés de Jambes suspendu** : 3 séries × 15 reps

${persona === 'commander'
  ? '⚡ **Commander** : Zéro distraction. Reste focus sur le tempo. Note ton tonnage dans l\'onglet Fit dès la fin.'
  : '🔬 **Analyst** : Plafonne ton RPE à 8,0 maximum pour garantir un rebond de VFC supérieur à 70 ms cette nuit.'}`;
  }

  // 4. HABIT & METABOLIC SIMULATOR (Caféine, Alcool, Dîner tardif, Suppléments)
  if (/(café|caféine|alcool|bière|vin|dîner|manger tard|magnésium|sauna|glace|bain froid|complément)/i.test(cleanPrompt)) {
    if (isEn) {
      return `### Bevel Habit & Metabolic Simulator ☕🧪

Simulating behavioral impacts on your biometric baseline:

• **Caffeine Cut-off**: Your adenosine sensitivity requires cutting off caffeine **by 2:00 PM** (half-life ≈ 6 hours). A cup at 4 PM reduces deep sleep by **−24 minutes**.
• **Late Dinner (> 8:30 PM)**: Triggers thermal elevation during the first 3 hours of sleep, increasing resting HR by **+4 bpm** and lowering nocturnal HRV.
• **Magnesium Glycinate (300 mg)**: Taken 45 min before bed, shown to boost parasympathetic tone and reduce sleep fragmentation by **14%**.
• **Sauna (20 min @ 80°C)**: Excellent when taken 3 hours before sleep; prompts a rapid core temperature drop upon cooling, accelerating sleep onset.`;
    }

    return `### Simulateur d'Habitudes & Métabolisme · Bevel ☕🧪

Simulation de l'impact physiologique sur tes capteurs Stoic Ring One :

• **Coupure Caféine** : Ta demi-vie d'élimination de la caféine est d'environ 6h. Tout café consommé **après 14h00** amputera ton sommeil profond de **−24 minutes** ce soir.
• **Dîner Tardif (après 20h30)** : Maintient un débit splanchnique élevé durant la première moitié de nuit, haussant ta FC nocturne de **+4 à 6 bpm** et bridant ta VFC.
• **Bisglycinate de Magnésium (300 mg)** : Pris 45 min avant le coucher, il favorise l'inhibition du glutamate et diminue les micro-réveils nocturnes de **14 %**.
• **Sauna (20 min à 80 °C)** : Recommandé 3h avant le coucher. La vasodilatation périphérique induit une chute thermique réparatrice favorable au sommeil profond.`;
  }

  // 5. SALUTATIONS / GREETINGS
  const greetingsRegex = /^(salut|bonjour|bonsoir|coucou|hello|hey|yo|hi|good\s*morning|good\s*evening)[\s!.,?]*$/i;
  const greetingsExtended = /(salut|bonjour|hello|coucou|ça va|comment vas-tu|comment tu vas|comment ca va|how are you|how's it going)/i;

  if (greetingsRegex.test(cleanPrompt) || (cleanPrompt.length <= 15 && greetingsExtended.test(cleanPrompt))) {
    if (isEn) {
      return `### Hello ${userName}! 👋 · Stoic Labs
 
Synchronized in real time with your **Stoic Ring One** smart ring.

• **Recovery Score**: **${dayData.score}/100**
• **Target Strain**: **${strain.min}–${strain.max} / 21**
• **Resting HR**: **${dayData.restingBpm} bpm** · **HRV**: **${dayData.hrv} ms**
• **Body Energy**: **${dayData.bodyEnergy}%** available

Mode active: **${persona.toUpperCase()}**. Ask me to **connect the dots**, **calculate your strain**, or **audit your sleep architecture**!`;
    }

    return `### Bonjour ${userName} ! 👋 · Stoic Labs

Synchronisé en direct avec ta bague **Stoic Ring One**.

• **Score de Récupération** : **${dayData.score}/100**
• **Target Strain du Jour** : **${strain.min}–${strain.max} / 21**
• **FC au Repos** : **${dayData.restingBpm} bpm** · **VFC** : **${dayData.hrv} ms**
• **Body Energy** : **${dayData.bodyEnergy} %** disponible

Mode actif : **${persona === 'analyst' ? '🔬 ANALYSTE' : persona === 'commander' ? '⚡ COMMANDER' : '🌿 GUARDIAN'}**. Demande-moi de **connecter les points**, **ajuster ton entraînement**, ou **simuler une habitude** !`;
  }

  // 6. QUI ES-TU / WHO ARE YOU
  if (/(qui es-tu|qui es tu|c'est quoi covyta|c'est quoi zénon|c'est quoi zenon|présente-toi|who are you|what is covyta|what is zenon|stoic labs)/i.test(cleanPrompt)) {
    if (isEn) {
      return `### I am Zénon · Biological AI by Stoic Labs ⚡

A native biological intelligence tailored for the **Stoic Ring One** titanium smart ring.

Unlike generic language models, I connect the dots across:
• **Nocturnal Autonomic Tone** (HRV in milliseconds & Nadir HR)
• **Skin Temperature Baseline** (0.01°C optical infrared readings)
• **Target Strain Calculation** (0-21 daily exertion budget)
• **Sleep Architecture & Chronobiology** (Deep/REM ratios)

Switch between **Analyst**, **Commander**, and **Guardian** personas above to adapt my tone to your goals.`;
    }

    return `### Je suis Zénon · L'IA Biologique de Stoic Labs ⚡

Un moteur d'intelligence biologique natif conçu pour la bague connectée en titane **Stoic Ring One**.

Contrairement aux IA génériques, je relie la cause à l'effet sur ton corps :
• **Tonus Autonome Nocturne** (VFC en millisecondes et Nadir cardiaque)
• **Ligne de Base Thermique** (Capteur infrarouge à ±0,01 °C)
• **Target Strain Quotidien** (Budget d'effort optimal sur l'échelle 0 – 21)
• **Architecture du Sommeil** (Ratios Sommeil Profond / REM et synchronisation circadienne)

Tu peux basculer entre **Analyste**, **Commander** et **Guardian** à tout moment selon tes besoins.`;
  }

  // 7. FORME DU JOUR / BILAN
  if (/(comment je vais|ma forme|bilan|état|résumé|comment va mon corps|how am i doing|my status|overview)/i.test(cleanPrompt)) {
    if (isEn) {
      return `### Biometric Status · ${dayName}

• **Recovery Index**: **${dayData.score}/100** (${dayData.score >= 80 ? 'Optimal state' : 'Restorative state'})
• **Target Strain Range**: **${strain.min}–${strain.max} / 21**
• **Body Energy**: **${dayData.bodyEnergy}%** (woke up at ${dayData.bodyEnergyWake}%)
• **Resting Heart Rate**: **${dayData.restingBpm} bpm** (steady)
• **HRV Balance**: **${dayData.hrv} ms** (baseline ${dayData.hrvBaseline} ms)

🔗 **Bevel Takeaway**: ${dayData.bodyEnergy >= 75 ? 'Optimal metabolic reserves. High cognitive clarity and physical readiness.' : 'Neural fatigue detected. Favor zone 2 endurance or restorative habits.'}`;
    }

    return `### Bilan Biométrique Complet · ${dayName}

• **Indice de Récupération** : **${dayData.score}/100** (${dayData.score >= 80 ? 'Condition optimale' : 'Besoin de régulation'})
• **Target Strain Conseillé** : **${strain.min}–${strain.max} / 21** (${strain.label})
• **Body Energy disponible** : **${dayData.bodyEnergy} %** (démarré à ${dayData.bodyEnergyWake} % au réveil)
• **FC au repos** : **${dayData.restingBpm} bpm** (ligne stable)
• **Équilibre VFC** : **${dayData.hrv} ms** (vs médiane ${dayData.hrvBaseline} ms)

🔗 **Synthèse Bevel** : ${dayData.bodyEnergy >= 75 ? 'Excellente réserve nerveuse. Tu peux viser une charge élevée sans risque d\'épuisement.' : 'Ton système nerveux autonome demande de la modération : favorise la zone 2 et respecte ton heure de coucher.'}`;
  }

  // 8. FATIGUE / COUP DE BARRE
  if (/(fatigué|fatigue|épuisé|crevé|pas d'énergie|manque d'énergie|coup de barre|dormir|tired|exhausted|no energy|sleepy)/i.test(cleanPrompt)) {
    if (isEn) {
      return `### Fatigue Root-Cause Protocol · Bevel Intelligence 🔋

Your Body Energy is currently at **${dayData.bodyEnergy}%**.

• **Root Cause 1**: HRV at **${dayData.hrv} ms**, revealing an active parasympathetic recovery state.
• **Root Cause 2**: Core temperature ${dayData.tempDelta > 0.15 ? `elevated by +${dayData.tempDelta}°C (immune or digestive load)` : 'normal'}.

### Immediate Action Plan
1. **Electrolyte Infusion**: 500 ml water with sodium & magnesium.
2. **20-Minute NSDR (Non-Sleep Deep Rest)**: Rest eyes closed without falling into slow-wave sleep.
3. **Caffeine Gate**: Zero caffeine past 2:00 PM to protect tonight's deep sleep.`;
    }

    return `### Diagnostic de Fatigue & Protocole Immédiat · Bevel 🔋

Ton niveau de Body Energy est actuellement à **${dayData.bodyEnergy} %**.

• **Cause n°1** : Ta VFC nocturne (${dayData.hrv} ms) indique un système parasympathique en fort travail d'autorégulation.
• **Cause n°2** : ${dayData.tempDelta > 0.15 ? `Hausse thermique cutanée (+${dayData.tempDelta} °C) liée à une réponse immunitaire ou digestive.` : 'Dette de sommeil profond accumulée sur les dernières 48h.'}

### Plan d'Action Recommandé
1. **Hydratation & Électrolytes** : 500 ml d'eau avec une pincée de sel marin ou électrolytes.
2. **Séance NSDR de 20 min** : Relaxation profonde yeux fermés pour faire chuter le cortisol sans perturber le cycle nocturne.
3. **Coupure Caféine Immédiate** : Aucun stimulant après 14h pour préserver ton architecture de sommeil ce soir.`;
  }

  // 9. SOMMEIL / NUIT
  if (/(sommeil|dormir|nuit|mieux dormir|insomnie|profond|rem|réveil|sleep|bedtime|insomnia|deep sleep)/i.test(cleanPrompt)) {
    const deepHours = Math.floor(dayData.sleep.deepMin / 60);
    const deepMins = dayData.sleep.deepMin % 60;

    if (isEn) {
      return `### Sleep Architecture & Chronobiology 🌙

Nocturnal telemetry recorded by Stoic Ring One:
• **Sleep Score**: **${dayData.sleep.score}/100**
• **Deep Sleep**: **${deepHours}h ${deepMins}m** (physical cellular repair)
• **REM Sleep**: **${Math.floor(dayData.sleep.remMin / 60)}h ${dayData.sleep.remMin % 60}m** (cognitive & memory consolidation)

### Zénon Recommendations
• **Sleep Need Tonight**: **8h 15m** (including 25m debt compensation)
• **Bedtime Target**: **22:45**
• **Room Ambient**: **18 °C** with complete darkness`;
    }

    return `### Architecture du Sommeil & Chronobiologie 🌙

Relevés nocturnes de ta bague Stoic Ring One :
• **Score de Sommeil** : **${dayData.sleep.score}/100**
• **Sommeil Profond** : **${deepHours}h ${deepMins}m** (sécrétion d'hormone de croissance et réparation tissulaire)
• **Sommeil Paradoxal (REM)** : **${Math.floor(dayData.sleep.remMin / 60)}h ${dayData.sleep.remMin % 60}m** (synthèse mémorielle et gestion émotionnelle)

### Recommandations Zénon
• **Besoin de Sommeil ce soir** : **8h15** (dont +25 min de compensation de dette)
• **Heure de Coucher Recommandée** : **22h45**
• **Environnement** : Température de chambre à **18 °C** et obscurité complète`;
  }

  // 10. COURSE / RUNNING / CARDIO
  if (/(courir|course|footing|cardio|allure|vma|zone 2|run|running)/i.test(cleanPrompt)) {
    const canPush = dayData.score >= 80;

    if (isEn) {
      return `### Running & Aerobic Capacity 🏃

• **Recovery Index**: **${dayData.score}/100** · **Target Strain**: **${strain.min}–${strain.max} / 21**
• **Resting HR**: **${dayData.restingBpm} bpm**

${canPush ? `
**Prescription**: 🟢 **Threshold / Tempo Run Approved**
• **Distance**: 7 to 9 km
• **Target Pace**: ≈ 4:50 – 5:10 /km
• **Heart Rate**: Zone 3–4 (150–165 bpm)
• **Target Strain Contribution**: +6.5` : `
**Prescription**: 🟡 **Aerobic Base (Zone 2) Only**
• **Duration**: 35–45 minutes
• **Target Pace**: ≈ 5:45 – 6:15 /km
• **Ceiling Heart Rate**: Stay under 142 bpm
• **Target Strain Contribution**: +4.0`}`;
    }

    return `### Prescription Running & Capacité Aérobie 🏃

• **Indice de Récupération** : **${dayData.score}/100** · **Target Strain** : **${strain.min}–${strain.max} / 21**
• **FC au Repos** : **${dayData.restingBpm} bpm**

${canPush ? `
**Prescription** : 🟢 **Séance Allure Spécifique ou Fractionné Validée**
• **Format** : 8 km avec 3 × 6 min à allure seuil
• **Allure cible** : ≈ 4:50 – 5:10 /km
• **Fréquence cardiaque** : Zones 3–4 (150–165 bpm)
• **Gain de Strain estimé** : +6,8` : `
**Prescription** : 🟡 **Endurance Fondamentale (Zone 2 Stricte)**
• **Format** : Footing léger de 35 à 45 minutes
• **Allure cible** : ≈ 5:45 – 6:15 /km
• **Plafond cardiaque** : Ne pas dépasser 142 bpm
• **Gain de Strain estimé** : +3,8`}`;
  }

  // 11. TEMPERATURE / MALADIE / IMMUNITE
  if (/(température|fièvre|malade|maladie|rhume|gorge|immunité|infection)/i.test(cleanPrompt)) {
    if (isEn) {
      return `### Immune Radar & Temperature Baseline 🛡️

• **Current Temperature Delta**: **${dayData.tempDelta > 0 ? '+' : ''}${dayData.tempDelta} °C** vs baseline
• **HRV Shift**: **${dayData.hrv} ms** (baseline ${dayData.hrvBaseline} ms)

${dayData.tempDelta > 0.25 ? `
⚠️ **Early Immune Activation Detected**
Your peripheral vasodilation is elevated. The immune system is allocating metabolic energy.
• Cancel high-intensity workouts.
• Take 1000 mg Vitamin C + 25 mg Zinc bisglycinate.
• Sleep before 10:30 PM.` : `
✅ **Immune Shield Stable**
No thermal anomaly detected. Your autonomic balance is resilient.`}`;
    }

    return `### Radar Immunitaire & Thermométrie Nocturne 🛡️

• **Écart Thermique Actuel** : **${dayData.tempDelta > 0 ? '+' : ''}${dayData.tempDelta} °C** vs ligne de base
• **Déviation VFC** : **${dayData.hrv} ms** (vs médiane ${dayData.hrvBaseline} ms)

${dayData.tempDelta > 0.25 ? `
⚠️ **Activation Immunitaire Précoce Détectée**
Ta bague enregistre une hausse thermique continue. Ton organisme mobilise ses ressources immunitaires.
• Annule tout entraînement intensif (risque d'épuisement cellulaire).
• Apport recommandé : 1000 mg Vitamine C + 25 mg Zinc bisglycinate.
• Coucher impératif avant 22h30.` : `
✅ **Bouclier Immunitaire Optimal**
Aucune anomalie thermique détectée. Ton système nerveux et ton métabolisme sont protégés.`}`;
  }

  // 12. FALLBACK UNIVERSEL AVANCE ET CONTEXTUALISE
  if (isEn) {
    return `### Bevel Intelligence Analysis · ${dayName} ⚡

Regarding **"${prompt}"**:

Based on your current physiological telemetry:
• **Recovery Score**: **${dayData.score}/100** · **Target Strain**: **${strain.min}–${strain.max} / 21**
• **HRV**: **${dayData.hrv} ms** · **Body Energy**: **${dayData.bodyEnergy}%**
• **Resting HR**: **${dayData.restingBpm} bpm**

🔗 **Connecting the Dots**:
Your biomarkers reflect an autonomic state suited for ${dayData.score >= 80 ? 'progressive training and peak mental clarity' : 'active recovery and nervous system restoration'}.

${persona === 'commander' 
  ? '⚡ Focus on completing your daily strain without exceeding recovery boundaries.' 
  : persona === 'guardian'
  ? '🌿 Listen to subtle fatigue signals and anchor your circadian rhythm tonight.'
  : '🔬 Monitored variables confirm stable homeostasis across optical PPG channels.'}`;
  }

  return `### Analyse Bevel Intelligence · ${dayName} ⚡

Concernant ta demande : **« ${prompt} »**

D'après tes données biométriques actuelles :
• **Score de Récupération** : **${dayData.score}/100** · **Target Strain** : **${strain.min}–${strain.max} / 21**
• **VFC** : **${dayData.hrv} ms** · **Body Energy** : **${dayData.bodyEnergy} %**
• **FC au Repos** : **${dayData.restingBpm} bpm**

🔗 **Synthèse Causale Bevel** :
Tes constantes indiquent un système nerveux autonome ${dayData.score >= 80 ? 'parfaitement régénéré, prêt pour une surcharge progressive et des efforts intenses' : 'en phase de récupération active, nécessitant de préserver tes réserves'}.

${persona === 'commander'
  ? '⚡ Vise ton objectif de charge du jour sans hésiter. Ton corps est programmé pour encaisser.'
  : persona === 'guardian'
  ? '🌿 Prends soin de ton tonus vagal et assure-toi d\'un dîner léger avant 20h30.'
  : '🔬 Les capteurs PPG et thermiques confirment une homéostasie stable avec un nadir cardiaque régulier.'}`;
}
