export interface QuickQuestion {
  id: string;
  label: string;
  answer: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timeStr: string;
  thinking?: string;
  isRealAI?: boolean;
  isStreaming?: boolean;
}

export interface Insight {
  id: string;
  title: string;
  value: string;
  text: string;
}

export const quickQuestions: QuickQuestion[] = [
  {
    id: 'target_strain',
    label: '🎯 Calculer mon Target Strain aujourd\'hui',
    answer:
      `### Calcul du Target Strain · Bevel Intelligence 🎯

Votre **Score de Récupération est à 89/100** avec une **VFC à 68 ms**.

• **Target Strain Cible** : **11,5 à 14,2 / 21** (Progression & Surcharge)
• **Strain actuel accumulé** : **9,1 / 21**
• **Fenêtre d'effort idéale** : **10h30 – 12h15**

🔗 **Synthèse Causale Bevel** :
Votre sommeil profond (1h48m) a parfaitement rechargé votre tonus parasympathique. Vous pouvez monter l'intensité sans risque de surentraînement.`,
  },
  {
    id: 'connecting_dots',
    label: '🔗 Connecter les points (Synthèse Causale)',
    answer:
      `### Synthèse Causale · Bevel Intelligence 🔗

Voici comment vos métriques interagissent en temps réel :

**1. Facteur Déclencheur** : Baisse de température nocturne stabilisée à **−0,05 °C**.
**2. Réponse Végétative** : VFC nocturne à **68 ms** (+8 ms au-dessus de la ligne de base).
**3. Conséquence Énergétique** : Body Energy disponible à **78 %** au réveil.

🔗 **Arbre de Causalité Bevel** :
\`Sommeil réparateur\` ➔ \`Hausse VFC nocturne\` ➔ \`Restitution du tonus vagal\` ➔ \`Capacité de charge élevée\`

### Recommandation Bevel
Séance de renforcement ou cardio tempo recommandée ce matin. Verrouillez un coucher à **22h45** ce soir.`,
  },
  {
    id: 'hrv',
    label: 'Pourquoi ma VFC a baissé ?',
    answer:
      `### Analyse de la Baisse de VFC · Bevel
      
Votre VFC est passée de **74 ms cette nuit** à **60 ms en journée** (−14 ms). Trois facteurs se combinent :

• **Température cutanée** : **+0,4 °C** au-dessus de votre ligne de base
• **Charge d’entraînement** : Soutenue ces 3 derniers jours (zones 3-4)
• **Heure de coucher** : Tardif à 23h15

### Plan d'Action Recommandé
• **Hydratation** : 500 ml d'eau dans l'heure avec électrolytes
• **Dîner léger** : Avant 20h pour favoriser la baisse thermique
• **Coucher impératif** : **22h45** ce soir`,
  },
  {
    id: 'habit_simulator',
    label: '☕ Impact caféine & repas tardif',
    answer:
      `### Simulateur d'Habitudes & Métabolisme · Bevel ☕

D'après votre profil et votre sensibilité circadienne :

• **Coupure Caféine recommandée** : **14h00** au plus tard (demi-vie ≈ 6h).
• **Dîner tardif (> 20h30)** : Augmente la FC au repos de **+4 bpm** et retarde le nadir cardiaque de 2 heures.
• **Magnésium avant le coucher** : Améliore la VFC nocturne de **+6 à 10 %**.`,
  },
  {
    id: 'session',
    label: '🏋️‍♂️ Adapte ma séance du jour',
    answer:
      `### Adaptation Force & Surcharge Progressive · Bevel 🏋️‍♂️

Votre **Body Energy est à 78 %** et votre Target Strain se situe entre **11,5 et 14,2**.

• **Séance Haut du Corps** : 4 séries de 6 à 8 reps
• **Surcharge progressive** : +2,5 % autorisée sur les mouvements polyarticulaires
• **Temps de repos** : 2 minutes entre les séries
• **Plafond RPE** : 8,0 (gardez 2 répétitions en réserve)`,
  },
];

export const quickQuestionsByDay: Record<number, QuickQuestion[]> = {
  3: quickQuestions,
  2: [
    {
      id: 'load_mer',
      label: 'Bilan séance fractionnés',
      answer:
        `### Bilan Séance Fractionnés · Mercredi 14

Votre séance de fractionnés a été très productive :

• **Dépense active** : **505 kcal**
• **FC moyenne** : **152 bpm**
• **Récupération post-effort** : **−38 bpm** en 2 min

### Conseil CoVyta
Votre cœur récupère vite. Prévoyez **500 ml d'eau avec électrolytes** pour reconstituer vos réserves minérales.`,
    },
    {
      id: 'sleep_mer',
      label: 'Sommeil profond 1h46',
      answer:
        `### Qualité du Sommeil Profond

Excellente régénération nocturne enregistrée :

• **Durée en phase N3** : **1h46** (22 % du sommeil total)
• **Élimination métabolique** : Optimale
• **Score de sommeil** : **88/100**

Votre système nerveux a parfaitement récupéré de la journée.`,
    },
    {
      id: 'hrv_mer',
      label: 'Stabilité VFC 71 ms',
      answer:
        `### Stabilité de la VFC (RMSSD)

Votre VFC est au-dessus de votre baseline de 66 ms :

• **Niveau mesuré** : **71 ms** (+5 ms)
• **Balance autonome** : Équilibre parasympathique idéal
• **Résistance au stress** : Maximale`,
    },
  ],
  1: [
    {
      id: 'fatigue_mar',
      label: 'Baisse VFC (61 ms)',
      answer:
        `### Analyse du Fléchissement de VFC

Votre VFC est descendue à **61 ms** (−5 ms sous votre baseline) :

• **Coucher retardé** : **23h40**
• **Sommeil profond écourté** : **1h22**
• **FC de repos** : Légère hausse à **54 bpm**

### Conseil CoVyta
Avancez votre coucher à **22h45** ce soir pour compenser la dette de sommeil.`,
    },
    {
      id: 'recup_mar',
      label: 'Récupération active',
      answer:
        `### Protocole de Récupération Active

Programme recommandé pour votre journée de décharge :

• **30 min de marche** en zone 1 pour relancer le drainage lymphatique
• **10 min d'étirements doux** ou mobilité
• **Micro-sieste de 20 min** entre 13h et 14h`,
    },
  ],
  0: [
    {
      id: 'kickoff_lun',
      label: 'Bilan début de semaine',
      answer:
        `### Démarrage de Semaine · Lundi 12

Vos constantes physiologiques sont au vert :

• **Score de vitalité** : **86/100**
• **Volume d'activité** : **10 240 pas** et **560 kcal**
• **FC repos & VFC** : **52 bpm** et **69 ms**

Excellentes dispositions pour aborder un nouveau cycle d'entraînement.`,
    },
    {
      id: 'peak_lun',
      label: 'Créneau circadien optimal',
      answer:
        `### Fenêtre Circadienne Idéale

Votre pic d'efficacité neuromusculaire se produit 8 à 10 heures après l'éveil :

• **Créneau optimal** : **17h15 à 18h45**
• **Avantages** : Température corporelle à son pic, réactivité neuromusculaire maximale`,
    },
  ],
};

export const insights: Insight[] = [
  {
    id: 'bed',
    title: 'Fenêtre de coucher',
    value: '22 h 45',
    text: 'Cible : 8 h de sommeil',
  },
  {
    id: 'load',
    title: 'Charge vs récupération',
    value: 'Équilibré',
    text: 'Séance modérée recommandée',
  },
  {
    id: 'hrv',
    title: 'Tendance VFC',
    value: '74 → 60 ms',
    text: 'Baisse diurne (-14 ms)',
  },
  {
    id: 'temp',
    title: 'Température & immunité',
    value: '+0,4 °C',
    text: 'Surveillance 48 h',
  },
];

export const dailyInsights: Record<number, Insight[]> = {
  3: insights,
  2: [
    {
      id: 'bed',
      title: 'Coucher effectif',
      value: '23 h 05',
      text: '8 h 05 de sommeil',
    },
    {
      id: 'load',
      title: 'Charge d’entraînement',
      value: '505 kcal',
      text: 'Fractionnés assimilés',
    },
    {
      id: 'hrv',
      title: 'VFC nocturne',
      value: '71 ms',
      text: 'Rebond favorable (+5 ms)',
    },
    {
      id: 'temp',
      title: 'Température cutanée',
      value: '-0,02 °C',
      text: 'Homéostasie stable',
    },
  ],
  1: [
    {
      id: 'bed',
      title: 'Coucher effectif',
      value: '23 h 40',
      text: 'Sommeil écourté (1h22 prof.)',
    },
    {
      id: 'load',
      title: 'Charge d’entraînement',
      value: '390 kcal',
      text: 'Récupération active',
    },
    {
      id: 'hrv',
      title: 'VFC nocturne',
      value: '61 ms',
      text: 'Sous la base (-5 ms)',
    },
    {
      id: 'temp',
      title: 'Température cutanée',
      value: '+0,12 °C',
      text: 'Légère fatigue',
    },
  ],
  0: [
    {
      id: 'bed',
      title: 'Coucher effectif',
      value: '22 h 55',
      text: 'Sommeil profond : 1 h 38',
    },
    {
      id: 'load',
      title: 'Charge d’entraînement',
      value: '560 kcal',
      text: '10 240 pas validés',
    },
    {
      id: 'hrv',
      title: 'VFC nocturne',
      value: '69 ms',
      text: 'Réserves optimales',
    },
    {
      id: 'temp',
      title: 'Température cutanée',
      value: '-0,05 °C',
      text: 'Thermorégulation saine',
    },
  ],
};

export const seedChatsByDay: Record<number, ChatMessage[]> = {
  3: [
    {
      id: 'day3-msg1',
      sender: 'ai',
      timeStr: '07:42',
      text: `### Analyse Matinale · Jeudi 15 Octobre

Bonjour Alexandre. Vos signaux physiologiques de la nuit et de la journée ont été analysés :

• **Vitalité globale** : **91/100** (niveau optimal)
• **Température cutanée** : **+0,4 °C** (élévation prodromique)
• **VFC diurne** : **−14 ms** (système nerveux sous charge)

### Recommandation CoVyta
Nous vous conseillons d'anticiper votre coucher à **22h45** ce soir pour stopper la charge immunitaire.`,
    },
  ],
  2: [
    {
      id: 'day2-msg1',
      sender: 'ai',
      timeStr: '07:15',
      text: `### Bilan Nocturne · Mercredi 14 Octobre

Bonjour Alexandre. Votre nuit a été **très réparatrice** :

• **Score de sommeil** : **88/100**
• **Sommeil profond** : **1h46** (élimination métabolique)
• **VFC nocturne** : **71 ms** (+5 ms vs baseline)

Votre système nerveux autonome démontre une excellente résilience.`,
    },
    {
      id: 'day2-msg2',
      sender: 'user',
      timeStr: '12:35',
      text: "Puis-je forcer sur le fractionné aujourd'hui ?",
    },
    {
      id: 'day2-msg3',
      sender: 'ai',
      timeStr: '12:36',
      text: `### Validation Séance & Intensité

Oui, vos constantes autorisent l'effort :

• **Body Energy** : **75 %** disponible
• **Rythme cardiaque repos** : **51 bpm** (très stable)
• **Protocole conseillé** : Prévoyez **15 min de retour au calme** et **500 ml d'eau** riche en électrolytes après l'effort.`,
    },
    {
      id: 'day2-msg4',
      sender: 'ai',
      timeStr: '20:10',
      text: `### Synthèse de Fin de Journée

Vos **9 120 pas** et votre séance ont été parfaitement assimilés.

• Coupez les écrans dès **22h15**
• Cible d'endormissement : **22h50** pour consolider le cycle`,
    },
  ],
  1: [
    {
      id: 'day1-msg1',
      sender: 'ai',
      timeStr: '07:28',
      text: `### Bilan Nocturne · Mardi 13 Octobre

Bonjour Alexandre. Votre sommeil a été écourté cette nuit :

• **Coucher retardé** : **23h40**
• **Score de sommeil** : **74/100**
• **VFC** : **61 ms** (−5 ms sous votre baseline)`,
    },
    {
      id: 'day1-msg2',
      sender: 'user',
      timeStr: '08:50',
      text: 'Que me conseilles-tu pour la récupération ?',
    },
    {
      id: 'day1-msg3',
      sender: 'ai',
      timeStr: '08:51',
      text: `### Protocole Récupération Active

Journée de décharge conseillée :

• Remplacez l'effort violent par **30 min de marche** et **mobilité douce**
• Une **micro-sieste de 20 minutes** entre 13h et 14h aidera votre système parasympathique.`,
    },
  ],
  0: [
    {
      id: 'day0-msg1',
      sender: 'ai',
      timeStr: '07:12',
      text: `### Lancement de Semaine · Lundi 12 Octobre

Bonjour Alexandre. Excellent redémarrage de semaine :

• **Score de vitalité** : **86/100**
• **FC repos** : **52 bpm**
• **VFC de base** : **69 ms**

Vos biométries sont au vert pour attaquer le cycle.`,
    },
    {
      id: 'day0-msg2',
      sender: 'user',
      timeStr: '16:15',
      text: "Quel est mon meilleur créneau pour m'entraîner ?",
    },
    {
      id: 'day0-msg3',
      sender: 'ai',
      timeStr: '16:16',
      text: `### Fenêtre Circadienne Optimale

Votre pic neuromusculaire et de vigilance se situe entre **17h15 et 18h45** :

• C'est le créneau idéal pour votre première séance de musculation ou votre course.`,
    },
  ],
};

export const subscriptionFeatures = [
  'Diagnostic du Radar d’Immunité et protocole d’action personnalisé',
  'Coach quotidien : séance adaptée à votre VFC, sommeil et température',
  'Fenêtre de coucher idéale recalculée chaque soir',
  'Réponses instantanées à vos questions de santé et de performance',
];
