export type Language = 'fr' | 'en';

export const translations = {
  fr: {
    // Navigation & Tabs
    'tab.health': 'Santé',
    'tab.sleep': 'Sommeil',
    'tab.cycle': 'Cycle',
    'tab.fit': 'Activité',
    'tab.covyta': 'Zénon',

    // Header
    'header.covyta_on': 'Zénon ACTIF',
    'header.covyta_off': 'Zénon OFF',
    'header.ring_title': 'Bague Stoic Ring One • Réglages & Diagnostics',
    'header.battery_tooltip': 'Batterie bague : ',

    // Week & Dates
    'week.today': "Aujourd'hui",
    'week.yesterday': 'Hier',
    'week.selector_label': 'Sélecteur de semaine',
    'week.mon': 'L',
    'week.tue': 'M',
    'week.wed': 'M',
    'week.thu': 'J',
    'week.fri': 'V',
    'week.sat': 'S',
    'week.sun': 'D',

    // Settings Modal
    'settings.title': 'Réglages',
    'settings.close': 'Fermer',
    'settings.bio_title': 'Profil Biométrique',
    'settings.bio_sex_label': 'Sexe Biologique (pilote le module Cycle Féminin)',
    'settings.female': 'Femme',
    'settings.male': 'Homme',
    'settings.first_name': 'Prénom',
    'settings.age': 'Âge (ans)',
    'settings.height': 'Taille (cm)',
    'settings.weight': 'Poids (kg)',
    'settings.my_ring': 'Ma Bague (Stoic Ring One)',
    'settings.ring_battery': 'Batterie Bague',
    'settings.days_left': '5 jours restants',
    'settings.case_battery': 'Boîtier Nomade',
    'settings.case_recharges': '4 recharges',
    'settings.find_my_ring': 'Localiser ma Bague (Find My Ring)',
    'settings.language_title': 'Langue & Région',
    'settings.language_hint': 'Détection automatique selon la langue de votre iPhone.',

    // Health Screen - Hero & Pillars
    'health.vitality_score': 'Score de Vitalité',
    'health.optimal': 'Optimal',
    'health.good': 'Bon',
    'health.attention': 'À surveiller',
    'health.sleep': 'Sommeil',
    'health.recovery': 'Récup. VRC',
    'health.activity': 'Activité',

    // Activity Counters
    'health.steps': 'Pas',
    'health.distance': 'Distance',
    'health.calories': 'Calories',

    // 4 Biometrics Cards
    'health.hr': 'Fréquence Cardiaque',
    'health.hr_tag': 'Direct',
    'health.hrv': 'VRC (RMSSD)',
    'health.hrv_tag': '+8 ms',
    'health.temp': 'Température Cutanée',
    'health.temp_tag': 'Stable',
    'health.spo2': 'Oxygénation SpO2',
    'health.spo2_tag': 'Normal',

    // Body Energy Gauge
    'energy.title': 'Énergie Corporelle',
    'energy.recharged': 'Rechargé',
    'energy.moderate': 'Modéré',
    'energy.wake': 'Au réveil (07:00)',
    'energy.current': 'Disponible actuellement',
    'energy.bedtime': 'Prévu au coucher (23:00)',

    // Immunity Radar
    'immunity.title': "Radar d'Immunité",
    'immunity.shield_active': 'Bouclier Actif',
    'immunity.anomaly_detected': 'Anomalie Détectée',
    'immunity.no_anomaly': 'Aucune anomalie détectée sur les dernières 24h',
    'immunity.temp_normal': 'Température cutanée dans la plage normale',
    'immunity.hrv_stable': 'Variabilité cardiaque (VFC) stable et équilibrée',
    'immunity.immune_optimal': 'Système immunitaire au repos optimal',
    'immunity.diag_badge': 'DIAGNOSTIC & PROTOCOLE STOÏK',
    'immunity.diag_title': 'Suspicion de réponse inflammatoire précoce',
    'immunity.diag_factors': 'Avec le croisement de deux facteurs :',
    'immunity.diag_factor_temp': "L'élévation thermique",
    'immunity.diag_factor_hrv': 'Plongeon de VFC',
    'immunity.diag_advice_title': 'On te conseille de :',
    'immunity.diag_step1_title': 'Hydratation cellulaire :',
    'immunity.diag_step1_desc': "500 ml d'eau à température ambiante avec électrolytes.",
    'immunity.diag_step2_title': "Coupure d'effort :",
    'immunity.diag_step2_desc': "Remplacement de la séance d'intensité par 20 min de respiration guidée.",
    'immunity.diag_step3_title': 'Coucher anticipé :',
    'immunity.diag_step3_desc': 'Fenêtre de sommeil impérative à 22h45 pour stimuler les cytokines.',
    'immunity.unlock_btn': 'Débloquer le Protocole Stoïk IA',

    // Sleep Phases
    'sleep.title': 'Phases de Sommeil',
    'sleep.score': 'Score :',
    'sleep.total': 'Sommeil effectif',
    'sleep.deep': 'Profond',
    'sleep.rem': 'REM / Paradoxal',
    'sleep.light': 'Léger',
    'sleep.awake': 'Éveil',

    // Cardio Age
    'cardio.title': 'Âge Cardiovasculaire',
    'cardio.years': 'ans',

    // Fit Screen Subtabs & Running
    'fit.subtab_run': 'Course',
    'fit.subtab_routes': 'Trajets',
    'fit.subtab_gym': 'Musculation',
    'fit.beacon_live': 'GPS LIVE',
    'fit.beacon_paused': 'EN PAUSE',
    'fit.beacon_ready': 'PRÊT',
    'fit.start': 'Démarrer',
    'fit.pause': 'Pause',
    'fit.resume': 'Reprendre',
    'fit.finish': 'Terminer la course',
    'fit.open_routes': 'Ouvrir les Trajets',
    'fit.share_story': 'Partager en Story',
    'fit.distance_label': 'Distance',
    'fit.pace_label': 'Allure',
    'fit.time_label': 'Temps',
    'fit.hr_label': 'Cardio',
    'fit.calories_label': 'Calories',
    'fit.elevation_label': 'Dénivelé',
    'fit.speed_label': 'Vitesse',
    'fit.my_routes': 'Mes Trajets',
    'fit.new_route': 'Nouveau Parcours',
    'fit.create_route': 'Créer un Trajet',
    'fit.all_sessions': 'Toutes mes séances',
    'fit.sets': 'Séries',
    'fit.reps': 'reps',

    // CoVyta AI Screen
    'covyta.subtitle': 'Intelligence Biométrique Personnelle',
    'covyta.input_placeholder': 'Posez une question sur votre santé ou vos performances...',
    'covyta.send': 'Envoyer',
    'covyta.suggest_recovery': 'Comment optimiser ma récupération aujourd\'hui ?',
    'covyta.suggest_sleep': 'Pourquoi mon sommeil profond a chuté ?',
    'covyta.suggest_run': 'Quelle allure de course me conseilles-tu ?',
    'covyta.locked_title': 'Mode Découverte Limitée',
    'covyta.locked_desc': 'Activez Zénon Premium pour débloquer les analyses biologiques en temps réel et le coaching prédictif.',
    'covyta.subscribe_btn': 'Activer Zénon • 5,99 €',

    // Metric Detail Modal (BPM, HRV, Temp, SpO2)
    'metric.back': 'Santé',
    'metric.period_24h': '24 Heures',
    'metric.period_7d': '7 Jours',
    'metric.period_30d': '30 Jours',
    'metric.tab_stats': 'Chiffres Clés',
    'metric.tab_moments': 'Moments',
    'metric.tab_advice': 'Conseil',
    'metric.distribution': 'Répartition',
    'metric.key_moments': 'Moments Marquants',
    'metric.immediate_insight': 'Analyse Immédiate',
    'metric.recorded_measure': 'Mesure enregistrée',

    // Subscribe Modal
    'sub.title': 'Zénon Premium',
    'sub.banner_title': 'Abonnement Sans Engagement',
    'sub.price': '5,99 €',
    'sub.period': '/ 4 semaines',
    'sub.cancel_anytime': 'Résiliable en 1 clic',
    'sub.features_unlocked': 'Fonctionnalités exclusives débloquées :',
    'sub.apple_pay': 'Payer avec Apple Pay',
    'sub.card_pay': 'Carte Bancaire (CB, Visa, Mastercard)',
    'sub.welcome_title': 'Bienvenue dans Zénon !',
    'sub.welcome_desc': 'Tous les diagnostics et protocoles biométriques sont désormais actifs.',
  },

  en: {
    // Navigation & Tabs
    'tab.health': 'Health',
    'tab.sleep': 'Sleep',
    'tab.cycle': 'Cycle',
    'tab.fit': 'Activity',
    'tab.covyta': 'Zénon',

    // Header
    'header.covyta_on': 'Zénon ACTIF',
    'header.covyta_off': 'Zénon OFF',
    'header.ring_title': 'Stoic Ring One Ring • Settings & Diagnostics',
    'header.battery_tooltip': 'Ring battery: ',

    // Week & Dates
    'week.today': 'Today',
    'week.yesterday': 'Yesterday',
    'week.selector_label': 'Week selector',
    'week.mon': 'M',
    'week.tue': 'T',
    'week.wed': 'W',
    'week.thu': 'T',
    'week.fri': 'F',
    'week.sat': 'S',
    'week.sun': 'S',

    // Settings Modal
    'settings.title': 'Settings',
    'settings.close': 'Close',
    'settings.bio_title': 'Biometric Profile',
    'settings.bio_sex_label': 'Biological Sex (powers Female Cycle tracking)',
    'settings.female': 'Female',
    'settings.male': 'Male',
    'settings.first_name': 'First Name',
    'settings.age': 'Age (yrs)',
    'settings.height': 'Height (cm)',
    'settings.weight': 'Weight (kg)',
    'settings.my_ring': 'My Ring (Stoic Ring One)',
    'settings.ring_battery': 'Ring Battery',
    'settings.days_left': '5 days left',
    'settings.case_battery': 'Travel Case',
    'settings.case_recharges': '4 recharges',
    'settings.find_my_ring': 'Find My Ring',
    'settings.language_title': 'Language & Region',
    'settings.language_hint': 'Automatically detected based on your iPhone language.',

    // Health Screen - Hero & Pillars
    'health.vitality_score': 'Vitality Score',
    'health.optimal': 'Optimal',
    'health.good': 'Good',
    'health.attention': 'Needs Attention',
    'health.sleep': 'Sleep',
    'health.recovery': 'HRV Recovery',
    'health.activity': 'Activity',

    // Activity Counters
    'health.steps': 'Steps',
    'health.distance': 'Distance',
    'health.calories': 'Calories',

    // 4 Biometrics Cards
    'health.hr': 'Heart Rate',
    'health.hr_tag': 'Live',
    'health.hrv': 'HRV (RMSSD)',
    'health.hrv_tag': '+8 ms',
    'health.temp': 'Skin Temperature',
    'health.temp_tag': 'Stable',
    'health.spo2': 'Oxygenation SpO2',
    'health.spo2_tag': 'Normal',

    // Body Energy Gauge
    'energy.title': 'Body Energy',
    'energy.recharged': 'Recharged',
    'energy.moderate': 'Moderate',
    'energy.wake': 'At wake (07:00)',
    'energy.current': 'Available now',
    'energy.bedtime': 'Expected at bedtime (23:00)',

    // Immunity Radar
    'immunity.title': 'Immunity Radar',
    'immunity.shield_active': 'Shield Active',
    'immunity.anomaly_detected': 'Anomaly Detected',
    'immunity.no_anomaly': 'No anomaly detected in the last 24h',
    'immunity.temp_normal': 'Skin temperature within normal baseline',
    'immunity.hrv_stable': 'Heart rate variability (HRV) balanced and steady',
    'immunity.immune_optimal': 'Immune defense in optimal resting state',
    'immunity.diag_badge': 'STOÏK DIAGNOSTIC & PROTOCOL',
    'immunity.diag_title': 'Early inflammatory response suspected',
    'immunity.diag_factors': 'Based on two concurring biometric signals:',
    'immunity.diag_factor_temp': 'Temperature elevation',
    'immunity.diag_factor_hrv': 'HRV drop',
    'immunity.diag_advice_title': 'Recommended action plan:',
    'immunity.diag_step1_title': 'Cellular hydration:',
    'immunity.diag_step1_desc': '500 ml room temperature water with electrolytes.',
    'immunity.diag_step2_title': 'Exertion pause:',
    'immunity.diag_step2_desc': 'Replace intense workout with 20 min guided breathwork.',
    'immunity.diag_step3_title': 'Early bedtime:',
    'immunity.diag_step3_desc': 'Sleep window required by 10:45 PM to trigger cytokines.',
    'immunity.unlock_btn': 'Unlock Stoïk AI Protocol',

    // Sleep Phases
    'sleep.title': 'Sleep Stages',
    'sleep.score': 'Score:',
    'sleep.total': 'Effective Sleep',
    'sleep.deep': 'Deep',
    'sleep.rem': 'REM / Paradoxical',
    'sleep.light': 'Light',
    'sleep.awake': 'Awake',

    // Cardio Age
    'cardio.title': 'Cardiovascular Age',
    'cardio.years': 'yrs',

    // Fit Screen Subtabs & Running
    'fit.subtab_run': 'Running',
    'fit.subtab_routes': 'Routes',
    'fit.subtab_gym': 'Strength',
    'fit.beacon_live': 'LIVE GPS',
    'fit.beacon_paused': 'PAUSED',
    'fit.beacon_ready': 'READY',
    'fit.start': 'Start',
    'fit.pause': 'Pause',
    'fit.resume': 'Resume',
    'fit.finish': 'Finish Workout',
    'fit.open_routes': 'Open Routes',
    'fit.share_story': 'Share as Story',
    'fit.distance_label': 'Distance',
    'fit.pace_label': 'Pace',
    'fit.time_label': 'Time',
    'fit.hr_label': 'Heart Rate',
    'fit.calories_label': 'Calories',
    'fit.elevation_label': 'Elevation',
    'fit.speed_label': 'Speed',
    'fit.my_routes': 'My Routes',
    'fit.new_route': 'New Route',
    'fit.create_route': 'Create Route',
    'fit.all_sessions': 'All Workout Sessions',
    'fit.sets': 'Sets',
    'fit.reps': 'reps',

    // CoVyta AI Screen
    'covyta.subtitle': 'Personal Biometric Intelligence',
    'covyta.input_placeholder': 'Ask anything about your health or workouts...',
    'covyta.send': 'Send',
    'covyta.suggest_recovery': 'How can I optimize my recovery today?',
    'covyta.suggest_sleep': 'Why did my deep sleep drop last night?',
    'covyta.suggest_run': 'What running pace do you recommend?',
    'covyta.locked_title': 'Limited Discovery Mode',
    'covyta.locked_desc': 'Activate Zénon Premium to unlock real-time biological analysis and predictive coaching.',
    'covyta.subscribe_btn': 'Activate Zénon • €5.99',

    // Metric Detail Modal (BPM, HRV, Temp, SpO2)
    'metric.back': 'Health',
    'metric.period_24h': '24 Hours',
    'metric.period_7d': '7 Days',
    'metric.period_30d': '30 Days',
    'metric.tab_stats': 'Key Stats',
    'metric.tab_moments': 'Moments',
    'metric.tab_advice': 'Advice',
    'metric.distribution': 'Distribution',
    'metric.key_moments': 'Key Moments',
    'metric.immediate_insight': 'Immediate Insight',
    'metric.recorded_measure': 'Recorded measurement',

    // Subscribe Modal
    'sub.title': 'Zénon Premium',
    'sub.banner_title': 'No Commitment Subscription',
    'sub.price': '€5.99',
    'sub.period': '/ 4 weeks',
    'sub.cancel_anytime': 'Cancel in 1 click',
    'sub.features_unlocked': 'Exclusive unlocked features:',
    'sub.apple_pay': 'Pay with Apple Pay',
    'sub.card_pay': 'Credit Card (Visa, Mastercard)',
    'sub.welcome_title': 'Welcome to Zénon!',
    'sub.welcome_desc': 'All biometric diagnostics and custom protocols are now active.',
  },
} as const;

export type TranslationKey = keyof typeof translations['fr'];

/**
 * Returns translated string according to current language, falling back to French.
 */
export function getTranslation(lang: Language, key: TranslationKey): string {
  const dict = translations[lang] || translations.fr;
  return dict[key] || translations.fr[key] || key;
}

/**
 * Detects device language (defaults to 'fr' if French locale, otherwise 'en' for international/European users).
 */
export function detectDefaultLanguage(): Language {
  if (typeof window !== 'undefined' && window.navigator) {
    const navLang = (window.navigator.language || (window.navigator as any).userLanguage || '').toLowerCase();
    if (navLang.startsWith('fr')) {
      return 'fr';
    }
    return 'en';
  }
  return 'fr';
}
