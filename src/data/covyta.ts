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
}

export interface Insight {
  id: string;
  title: string;
  value: string;
  text: string;
}

export const quickQuestions: QuickQuestion[] = [
  {
    id: 'hrv',
    label: 'Pourquoi ma VFC a baissé ?',
    answer:
      'Votre VFC est passée de 74 ms cette nuit à 60 ms en journée (−14 ms). Trois facteurs se combinent : ① une température cutanée +0,4 °C au-dessus de votre ligne de base, ② une charge d’entraînement soutenue ces 3 derniers jours (zones 3-4), ③ un coucher à 23 h 15. Recommandation : hydratation dans l’heure, dîner léger, coucher à 22 h 45. Si l’écart persiste 48 h, consultez un professionnel de santé.',
  },
  {
    id: 'session',
    label: 'Adapte ma séance du jour',
    answer:
      'Body Energy à 78 % mais signaux d’alerte immunitaire : je remplace votre séance Pull prévue (intensité 85 %) par une version allégée — 3 séries au lieu de 4, charges −10 %, repos 90 s, aucun travail à l’échec. Tonnage cible ≈ 3,2 t. Si votre température dépasse +0,6 °C, privilégiez 30 min de marche en zone 1.',
  },
  {
    id: 'sleep',
    label: 'Comment mieux dormir cette nuit ?',
    answer:
      'Visez un coucher à 22 h 45 pour 8 h 10 de sommeil. Chambre à 18 °C, écrans coupés 45 min avant, dernier repas 3 h avant le coucher, lumière chaude après 21 h. Objectif : retrouver 1 h 55 de sommeil profond (1 h 52 cette nuit) et une VFC nocturne ≥ 74 ms.',
  },
  {
    id: 'run',
    label: 'Puis-je courir demain ?',
    answer:
      'Probabilité de récupération complète demain : 82 % si vous êtes couché avant 23 h. Footing conseillé : 40 min en zone 2 (allure ≈ 5:45 /km, FC < 145 bpm). Si votre température reste élevée au réveil, optez pour un repos actif (marche, mobilité).',
  },
];

export const quickQuestionsByDay: Record<number, QuickQuestion[]> = {
  3: quickQuestions,
  2: [
    {
      id: 'load_mer',
      label: 'Bilan séance fractionnés',
      answer:
        'Votre séance de fractionnés a généré 505 kcal pour une FC moyenne de 152 bpm. Votre cœur a récupéré de 38 bpm dans les 2 premières minutes, ce qui indique un excellent état cardiovasculaire.',
    },
    {
      id: 'sleep_mer',
      label: 'Sommeil profond 1h46',
      answer:
        '1h46 de sommeil profond enregistré (22 % du total). Votre système nerveux central a parfaitement éliminé les toxines métaboliques.',
    },
    {
      id: 'hrv_mer',
      label: 'Stabilité VFC 71 ms',
      answer:
        'Votre VFC est restée stable à 71 ms (baseline 66 ms). Votre balance sympathique/parasympathique était idéalement équilibrée.',
    },
  ],
  1: [
    {
      id: 'fatigue_mar',
      label: 'Baisse VFC (61 ms)',
      answer:
        'Le coucher tardif à 23h40 et la charge du lundi ont réduit votre sommeil profond (1h22). Votre système nerveux a compensé par une FC repos légèrement plus haute (54 bpm).',
    },
    {
      id: 'recup_mar',
      label: 'Récupération active',
      answer:
        '30 min de marche et 10 min de mobilité ont réactivé la circulation sanguine sans fatiguer vos réserves de glycogène.',
    },
  ],
  0: [
    {
      id: 'kickoff_lun',
      label: 'Bilan début de semaine',
      answer:
        'Score de 86/100, 10 240 pas et 560 kcal actives. Vos biométries de base sont parfaitement calées pour un cycle d’entraînement progressif.',
    },
    {
      id: 'peak_lun',
      label: 'Créneau circadien optimal',
      answer:
        'Votre pic de force musculaire se produit 8 à 10 heures après le réveil, soit vers 17h30 pour un réveil à 07h00.',
    },
  ],
};

export const insights: Insight[] = [
  {
    id: 'bed',
    title: 'Fenêtre de coucher',
    value: '22 h 45',
    text: 'Réveil moyen à 06 h 55 : 8 h 10 de sommeil visées pour retrouver 1 h 55 de sommeil profond.',
  },
  {
    id: 'load',
    title: 'Charge vs récupération',
    value: 'Équilibré',
    text: 'Charge 7 jours : 412 u · Récupération 91 %. Une séance modérée est idéale aujourd’hui.',
  },
  {
    id: 'hrv',
    title: 'Tendance VFC',
    value: '74 → 60 ms',
    text: 'Baisse diurne de 14 ms : cumul de charge et température +0,4 °C. Surveillance renforcée 48 h.',
  },
  {
    id: 'temp',
    title: 'Température & immunité',
    value: '+0,4 °C',
    text: 'Écart au-dessus de votre base : protocole léger activé (hydratation, coucher avancé, intensité réduite).',
  },
];

export const dailyInsights: Record<number, Insight[]> = {
  3: insights,
  2: [
    {
      id: 'bed',
      title: 'Coucher effectif',
      value: '23 h 05',
      text: '8h05 de sommeil : 1h46 de sommeil profond et récupération globale à 91 %.',
    },
    {
      id: 'load',
      title: 'Charge d’entraînement',
      value: '505 kcal',
      text: '9 120 pas. Séance de fractionnés parfaitement assimilée par le myocarde.',
    },
    {
      id: 'hrv',
      title: 'VFC nocturne',
      value: '71 ms',
      text: 'Rebond parasympathique favorable (+5 ms au-dessus de votre baseline).',
    },
    {
      id: 'temp',
      title: 'Température cutanée',
      value: '-0,02 °C',
      text: 'Équilibre thermique stable tout au long de la nuit et de la journée.',
    },
  ],
  1: [
    {
      id: 'bed',
      title: 'Coucher effectif',
      value: '23 h 40',
      text: 'Coucher retardé : sommeil profond écourté à 1h22 (score de sommeil 74/100).',
    },
    {
      id: 'load',
      title: 'Charge d’entraînement',
      value: '390 kcal',
      text: '6 980 pas. Séance de décharge et récupération active.',
    },
    {
      id: 'hrv',
      title: 'VFC nocturne',
      value: '61 ms',
      text: 'Fléchissement de 5 ms sous votre ligne de base : repos compensatoire nécessaire.',
    },
    {
      id: 'temp',
      title: 'Température cutanée',
      value: '+0,12 °C',
      text: 'Légère élévation métabolique consécutive à la fatigue accumulée.',
    },
  ],
  0: [
    {
      id: 'bed',
      title: 'Coucher effectif',
      value: '22 h 55',
      text: 'Sommeil profond 1h38. Énergie au réveil à 88 % avec un endormissement rapide.',
    },
    {
      id: 'load',
      title: 'Charge d’entraînement',
      value: '560 kcal',
      text: '10 240 pas. Reprise dynamique de début de semaine parfaitement menée.',
    },
    {
      id: 'hrv',
      title: 'VFC nocturne',
      value: '69 ms',
      text: 'Au-dessus de votre ligne de base (66 ms). Réserves nerveuses optimales.',
    },
    {
      id: 'temp',
      title: 'Température cutanée',
      value: '-0,05 °C',
      text: 'Excellente homéostasie thermique pendant la phase de repos.',
    },
  ],
};

export const seedChatsByDay: Record<number, ChatMessage[]> = {
  3: [
    {
      id: 'day3-msg1',
      sender: 'ai',
      timeStr: '07:42',
      text: 'Bonjour Alexandre. J’ai analysé vos signaux de la nuit et de la journée : votre vitalité est haute (91/100) mais j’observe une élévation thermique de +0,4 °C combinée à une VFC diurne en baisse (−14 ms). Je vous conseille d’anticiper votre coucher à 22h45 ce soir.',
    },
  ],
  2: [
    {
      id: 'day2-msg1',
      sender: 'ai',
      timeStr: '07:15',
      text: "Bonjour Alexandre. Votre nuit a été très réparatrice (score 88/100, 1h46 de sommeil profond). Votre VFC nocturne à 71 ms témoigne d'une excellente résilience nerveuse.",
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
      text: "Oui, votre Body Energy est à 75 % et votre rythme cardiaque au repos à 51 bpm. Vous pouvez maintenir l'intensité prévue, mais prévoyez 15 min de retour au calme et 500 ml d'eau riche en électrolytes après l'effort.",
    },
    {
      id: 'day2-msg4',
      sender: 'ai',
      timeStr: '20:10',
      text: "Bilan fin de journée : Vos 9 120 pas et votre séance ont été bien digérés. Pensez à couper les écrans vers 22h15 pour favoriser l'endormissement.",
    },
  ],
  1: [
    {
      id: 'day1-msg1',
      sender: 'ai',
      timeStr: '07:28',
      text: 'Bonjour Alexandre. Votre sommeil a été écourté cette nuit (coucher à 23h40, score 74/100). Votre VFC est descendue à 61 ms.',
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
      text: "Journée de décharge conseillée : remplacez l'effort violent par une marche de 30 min et de la mobilité douce. Une micro-sieste de 20 minutes entre 13h et 14h aidera votre système parasympathique.",
    },
  ],
  0: [
    {
      id: 'day0-msg1',
      sender: 'ai',
      timeStr: '07:12',
      text: 'Bonjour Alexandre. Excellent redémarrage de semaine : score de vitalité à 86/100, FC repos 52 bpm et VFC à 69 ms. Vos biométries sont au vert pour attaquer le cycle.',
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
      text: "Votre pic de force neuromusculaire et de vigilance thermique se situe entre 17h15 et 18h45. C'est le créneau idéal pour votre première séance de musculation ou votre course.",
    },
  ],
};

export const subscriptionFeatures = [
  'Diagnostic du Radar d’Immunité et protocole d’action personnalisé',
  'Coach quotidien : séance adaptée à votre VFC, sommeil et température',
  'Fenêtre de coucher idéale recalculée chaque soir',
  'Réponses instantanées à vos questions de santé et de performance',
];
