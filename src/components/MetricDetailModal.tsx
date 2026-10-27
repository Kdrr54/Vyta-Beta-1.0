import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { WeekSelector } from './WeekSelector';
import { weekMetrics, TODAY_INDEX, WEEK, emptyDayMetrics, DayMetrics } from '../data/health';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { METRIC_DETAILS, MetricDetailItem, MetricDataPoint } from '../data/metric24h';
import { qringBle } from '../lib/qringBleService';
import {
  ChevronLeft,
  X,
  Heart,
  Activity,
  Thermometer,
  Droplets,
  Sparkles,
  Wind,
  Square,
  Clock,
  ShieldCheck,
  TrendingUp,
  Info,
} from 'lucide-react';

interface MetricDetailModalProps {
  metricId: 'bpm' | 'hrv' | 'temp' | 'spo2' | 'resp' | 'stress' | 'bp' | 'glucose';
  onClose: () => void;
}

interface MetricTheme {
  primary: string;
  secondary: string;
  glow: string;
  heroBg: string;
  heroBorder: string;
  sheetBg: string;
  sheetGlow: string;
  zoneColors: string[];
  subtitleFr: string;
  subtitleEn: string;
  tipPointsFr: { title: string; desc: string }[];
  tipPointsEn: { title: string; desc: string }[];
}

const METRIC_THEMES: Record<'bpm' | 'hrv' | 'temp' | 'spo2' | 'resp' | 'stress' | 'bp' | 'glucose', MetricTheme> = {
  spo2: {
    primary: '#E879F9',
    secondary: '#D946EF',
    glow: 'rgba(232, 121, 249, 0.45)',
    heroBg: 'radial-gradient(ellipse at 60% 0%, rgba(217, 70, 239, 0.38) 0%, rgba(162, 28, 175, 0.16) 55%, rgba(13, 13, 16, 0.96) 85%), #0A0A0E',
    heroBorder: '1px solid rgba(240, 171, 252, 0.45)',
    sheetBg: '#0D0D10',
    sheetGlow: '0 -24px 60px rgba(0, 0, 0, 0.95)',
    zoneColors: ['#E879F9', '#C084FC', '#64748B'],
    subtitleFr: 'Saturation capillaire périphérique',
    subtitleEn: 'Peripheral capillary oxygen saturation',
    tipPointsFr: [
      {
        title: 'Oxygénation cellulaire continue',
        desc: 'Une saturation moyenne au-dessus de 98% garantit une diffusion parfaite de l’oxygène vers le cortex cérébral et les tissus musculaires profonds.',
      },
      {
        title: 'Qualité du sommeil & voies respiratoires',
        desc: 'Zéro épisode de désaturation nocturne (<95%). Vos voies aériennes sont restées parfaitement dégagées tout au long des cycles de sommeil.',
      },
      {
        title: 'Recommandation bien-être',
        desc: 'Maintenez une bonne ventilation de votre chambre à coucher avant le coucher afin de conserver un taux d’oxygène ambiant optimal.',
      },
    ],
    tipPointsEn: [
      {
        title: 'Continuous cellular oxygenation',
        desc: 'Average saturation above 98% ensures optimal oxygen delivery to cerebral cortex and deep muscle tissues.',
      },
      {
        title: 'Sleep quality & airway patency',
        desc: 'Zero nocturnal desaturation events (<95%). Continuous and smooth airflow throughout all deep sleep cycles.',
      },
      {
        title: 'Optimal recovery tip',
        desc: 'Ensure proper room ventilation before bedtime to maintain ideal ambient oxygen density.',
      },
    ],
  },

  hrv: {
    primary: '#D9F970',
    secondary: '#84CC16',
    glow: 'rgba(217, 249, 112, 0.45)',
    heroBg: 'radial-gradient(ellipse at 50% 0%, rgba(217, 249, 112, 0.34) 0%, rgba(132, 204, 22, 0.14) 55%, rgba(13, 13, 16, 0.96) 85%), #0A0A0E',
    heroBorder: '1px solid rgba(228, 255, 142, 0.45)',
    sheetBg: '#0D0D10',
    sheetGlow: '0 -24px 60px rgba(0, 0, 0, 0.95)',
    zoneColors: ['#D9F970', '#86EFAC', '#64748B'],
    subtitleFr: 'Système nerveux autonome & VRC',
    subtitleEn: 'Autonomic nervous system & HRV',
    tipPointsFr: [
      {
        title: 'Dominance parasympathique élevée',
        desc: 'Votre variabilité de fréquence cardiaque est haute (68 ms), signe d’un frein vagal actif favorisant la baisse du cortisol et la régénération.',
      },
      {
        title: 'Excellente capacité de récupération',
        desc: 'Votre système nerveux est prêt à tolérer un niveau de stress physique ou intellectuel important sans risquer le surentraînement.',
      },
      {
        title: 'Recommandation performance',
        desc: 'Journée idéale pour une séance de renforcement ou un effort soutenu, votre capital nerveux est au zénith.',
      },
    ],
    tipPointsEn: [
      {
        title: 'High parasympathetic tone',
        desc: 'Elevated HRV (68 ms) reflects strong vagal stimulation, reducing stress hormones and accelerating cellular repair.',
      },
      {
        title: 'High resilience reserve',
        desc: 'Your autonomic nervous system is fully recharged and ready for demanding physical or mental tasks.',
      },
      {
        title: 'Performance advice',
        desc: 'Ideal day for high-intensity training or productive focus sessions.',
      },
    ],
  },

  temp: {
    primary: '#FB923C',
    secondary: '#EA580C',
    glow: 'rgba(251, 146, 60, 0.45)',
    heroBg: 'radial-gradient(ellipse at 50% 0%, rgba(251, 146, 60, 0.34) 0%, rgba(217, 119, 6, 0.14) 55%, rgba(13, 13, 16, 0.96) 85%), #0A0A0E',
    heroBorder: '1px solid rgba(253, 186, 116, 0.45)',
    sheetBg: '#0D0D10',
    sheetGlow: '0 -24px 60px rgba(0, 0, 0, 0.95)',
    zoneColors: ['#FB923C', '#FDBA74', '#64748B'],
    subtitleFr: 'Thermorégulation & rythme circadien',
    subtitleEn: 'Circadian thermoregulation',
    tipPointsFr: [
      {
        title: 'Creux thermique nocturne idéal',
        desc: 'La baisse naturelle de température (-0,26 °C) en milieu de nuit permet la libération profonde de mélatonine et un sommeil lent profond.',
      },
      {
        title: 'Homéostasie immunitaire stable',
        desc: 'Aucun écart anormal détecté. L’absence d’élévation soutenue (>+0,4 °C) confirme l’absence d’infection virale ou d’inflammation aiguë.',
      },
      {
        title: 'Recommandation chambre',
        desc: 'Maintenez une température ambiante fraîche de 18-19 °C pour accompagner la vasodilatation périphérique nocturne.',
      },
    ],
    tipPointsEn: [
      {
        title: 'Ideal nocturnal temperature drop',
        desc: 'Natural dip (-0.26 °C) during deep sleep promotes melatonin release and restorative sleep architecture.',
      },
      {
        title: 'Stable immune homeostasis',
        desc: 'No irregular temperature deviation. Absence of sustained heat spikes confirms zero systemic inflammation.',
      },
      {
        title: 'Room thermal advice',
        desc: 'Keep sleeping area around 18-19 °C to assist natural peripheral heat dissipation.',
      },
    ],
  },

  bpm: {
    primary: '#FF453A',
    secondary: '#E11D48',
    glow: 'rgba(255, 69, 58, 0.45)',
    heroBg: 'radial-gradient(ellipse at 50% 0%, rgba(255, 69, 58, 0.35) 0%, rgba(225, 29, 72, 0.15) 55%, rgba(13, 13, 16, 0.96) 85%), #0A0A0E',
    heroBorder: '1px solid rgba(255, 90, 82, 0.5)',
    sheetBg: '#0D0D10',
    sheetGlow: '0 -24px 60px rgba(0, 0, 0, 0.95)',
    zoneColors: ['#34D399', '#FF453A', '#E11D48'],
    subtitleFr: 'Fréquence cardiaque & électrocardiogramme',
    subtitleEn: 'Heart rate & electrocardiogram',
    tipPointsFr: [
      {
        title: 'Fréquence au repos optimale',
        desc: 'Un rythme de repos à 59 bpm reflète une excellente condition cardiorespiratoire et un volume d’éjection systolique élevé.',
      },
      {
        title: 'Réactivité et récupération',
        desc: 'Votre cœur répond dynamiquement à l’effort (pic à 164 bpm) et redescend rapidement en zone de repos post-exercice.',
      },
      {
        title: 'Recommandation cardiovasculaire',
        desc: 'Pensez à bien vous hydrater tout au long de la journée pour fluidifier la volémie et alléger la charge sur le ventricule gauche.',
      },
    ],
    tipPointsEn: [
      {
        title: 'Optimal resting heart rate',
        desc: 'Resting pulse around 59 bpm indicates high cardiorespiratory fitness and efficient stroke volume.',
      },
      {
        title: 'Cardiac reactivity and recovery',
        desc: 'Smooth escalation during physical exercise (peak 164 bpm) followed by swift recovery to resting baseline.',
      },
      {
        title: 'Cardiovascular advice',
        desc: 'Stay consistently hydrated to support optimal blood volume and lower cardiac workload.',
      },
    ],
  },

  resp: {
    primary: '#38BDF8',
    secondary: '#0284C7',
    glow: 'rgba(56, 189, 248, 0.45)',
    heroBg: 'radial-gradient(ellipse at 50% 0%, rgba(56, 189, 248, 0.34) 0%, rgba(2, 132, 199, 0.14) 55%, rgba(13, 13, 16, 0.96) 85%), #0A0A0E',
    heroBorder: '1px solid rgba(125, 211, 252, 0.45)',
    sheetBg: '#0D0D10',
    sheetGlow: '0 -24px 60px rgba(0, 0, 0, 0.95)',
    zoneColors: ['#38BDF8', '#93C5FD', '#64748B'],
    subtitleFr: 'Fréquence respiratoire & ventilation',
    subtitleEn: 'Respiratory rate & ventilation',
    tipPointsFr: [
      {
        title: 'Cadence respiratoire sereine',
        desc: 'Une fréquence au repos de 14 rpm témoigne d’une respiration diaphragmatique stable et d’une absence d’hyperventilation de stress.',
      },
      {
        title: 'Stabilité des échanges gazeux',
        desc: 'Les cycles respiratoires nocturnes sont restés d’une parfaite régularité, favorisant l’élimination efficace du CO2.',
      },
      {
        title: 'Recommandation détente',
        desc: '5 minutes de cohérence cardiaque (inspiration 5s, expiration 5s) en fin d’après-midi optimisent l’oxygénation et le calme mental.',
      },
    ],
    tipPointsEn: [
      {
        title: 'Calm resting respiratory rate',
        desc: 'Resting rhythm of 14 rpm reflects deep diaphragmatic breathing and low physiological anxiety.',
      },
      {
        title: 'Gas exchange efficiency',
        desc: 'Continuous and steady respiratory cycles during sleep promote balanced blood pH and CO2 clearing.',
      },
      {
        title: 'Relaxation advice',
        desc: '5 minutes of rhythmic 5-5 breathing in the evening will ease nervous tension and prepare for restorative sleep.',
      },
    ],
  },
  stress: {
    primary: '#FFFFFF',
    secondary: '#A1A1AA',
    glow: 'rgba(255, 255, 255, 0.35)',
    heroBg: 'radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.16) 0%, rgba(200, 200, 200, 0.05) 55%, rgba(13, 13, 16, 0.98) 85%), #0A0A0E',
    heroBorder: '1px solid rgba(255, 255, 255, 0.22)',
    sheetBg: '#0D0D10',
    sheetGlow: '0 -24px 60px rgba(0, 0, 0, 0.95)',
    zoneColors: ['#FFFFFF', '#A1A1AA', '#52525B'],
    subtitleFr: 'Tension nerveuse & équilibre neuro-végétatif (SDK)',
    subtitleEn: 'Nervous tension & autonomic balance (SDK)',
    tipPointsFr: [
      {
        title: 'Prédominance parasympathique',
        desc: 'Le score de 24/100 confirme un tonus vagal actif favorisant la décompression physique et la détente cellulaire.',
      },
      {
        title: 'Résilience au stress',
        desc: 'Les épisodes d’activation diurne sont suivis d’un retour rapide à la ligne de base, signe d’une excellente flexibilité cardiaque.',
      },
      {
        title: 'Conseil récupération',
        desc: 'Conservez des micro-pauses sans écran pour maintenir ce niveau bas de tension nerveuse tout au long de la journée.',
      },
    ],
    tipPointsEn: [
      {
        title: 'Parasympathetic dominance',
        desc: 'Score of 24/100 confirms an active vagal tone supporting cellular rest and rapid physical recovery.',
      },
      {
        title: 'Stress resilience',
        desc: 'Daytime stress peaks are followed by swift baseline normalization, reflecting great nervous flexibility.',
      },
      {
        title: 'Restoration tip',
        desc: 'Keep taking screen-free micro-breaks to preserve this low autonomic stress baseline throughout the day.',
      },
    ],
  },

  bp: {
    primary: '#FFFFFF',
    secondary: '#A1A1AA',
    glow: 'rgba(255, 255, 255, 0.35)',
    heroBg: 'radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.16) 0%, rgba(200, 200, 200, 0.05) 55%, rgba(13, 13, 16, 0.98) 85%), #0A0A0E',
    heroBorder: '1px solid rgba(255, 255, 255, 0.22)',
    sheetBg: '#0D0D10',
    sheetGlow: '0 -24px 60px rgba(0, 0, 0, 0.95)',
    zoneColors: ['#FFFFFF', '#A1A1AA', '#52525B'],
    subtitleFr: 'Pression artérielle systolique & diastolique (PPG)',
    subtitleEn: 'Systolic & diastolic blood pressure (PPG)',
    tipPointsFr: [
      {
        title: 'Conformité hémodynamique',
        desc: 'Valeurs mesurées à 118/76 mmHg. La pression systolique (<120) et diastolique (<80) sont dans la zone optimale recommandée.',
      },
      {
        title: 'Élasticité de l’arbre vasculaire',
        desc: 'La propagation de l’onde de pouls estimée par le capteur optique reflète une compliance artérielle saine.',
      },
      {
        title: 'Conseil santé vasculaire',
        desc: 'Une hydratation régulière et un apport équilibré en électrolytes soutiennent cette tension idéale.',
      },
    ],
    tipPointsEn: [
      {
        title: 'Hemodynamic compliance',
        desc: 'Values at 118/76 mmHg. Both systolic (<120) and diastolic (<80) remain strictly within optimal health guidelines.',
      },
      {
        title: 'Vascular elasticity',
        desc: 'Optical pulse wave analysis indicates healthy arterial wall flexibility and smooth microvascular blood flow.',
      },
      {
        title: 'Cardiovascular tip',
        desc: 'Regular hydration and mineral balance keep your arterial pressure in this smooth resting range.',
      },
    ],
  },

  glucose: {
    primary: '#FFFFFF',
    secondary: '#A1A1AA',
    glow: 'rgba(255, 255, 255, 0.35)',
    heroBg: 'radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.16) 0%, rgba(200, 200, 200, 0.05) 55%, rgba(13, 13, 16, 0.98) 85%), #0A0A0E',
    heroBorder: '1px solid rgba(255, 255, 255, 0.22)',
    sheetBg: '#0D0D10',
    sheetGlow: '0 -24px 60px rgba(0, 0, 0, 0.95)',
    zoneColors: ['#FFFFFF', '#A1A1AA', '#52525B'],
    subtitleFr: 'Indice de stabilité glucidique & métabolique (SDK)',
    subtitleEn: 'Metabolic glucose stability & optical trend (SDK)',
    tipPointsFr: [
      {
        title: 'Amortissement glycémique optimal',
        desc: 'La courbe d’absorption montre une stabilité de 94%, sans pics d’insuline marqués ni variations brusques.',
      },
      {
        title: 'Stabilité énergétique continue',
        desc: 'L’absence de chute glycémique réactive après les repas préserve votre vigilance et prévient les coups de fatigue.',
      },
      {
        title: 'Conseil nutritionnel',
        desc: 'Privilégiez les fibres en début de repas pour maintenir cette courbe métabolique parfaitement régulière.',
      },
    ],
    tipPointsEn: [
      {
        title: 'Optimal glucose buffering',
        desc: 'Stability score of 94% indicates smooth post-meal carbohydrate management without insulin spikes.',
      },
      {
        title: 'Continuous energy delivery',
        desc: 'Absence of reactive glucose crashes protects brain energy and prevents afternoon sluggishness.',
      },
      {
        title: 'Nutrition tip',
        desc: 'Eating dietary fiber and protein prior to starches keeps your metabolic baseline steady.',
      },
    ],
  },
};


// Interpolation Catmull-Rom vers Bézier cubique pour courbe organique fluide
function getSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function getSmoothArea(points: { x: number; y: number }[], bottomY: number): string {
  if (points.length < 2) return '';
  const path = getSmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${path} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
}

export const MetricDetailModal: React.FC<MetricDetailModalProps> = ({ metricId, onClose }) => {
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const { selectedDay, liveBpm, setLiveBpm, t, language, isFirstLaunch, weekData, setWeekData } = useApp();
  const dayData = (weekData && weekData[selectedDay]) || (isFirstLaunch ? emptyDayMetrics : (weekMetrics[selectedDay] || weekMetrics[TODAY_INDEX]));
  const detail: MetricDetailItem = METRIC_DETAILS[metricId];
  const theme: MetricTheme = METRIC_THEMES[metricId];

  const [period, setPeriod] = useState<'24h' | '7j' | '30j'>('24h');
  const [activeTab, setActiveTab] = useState<'stats' | 'moments' | 'advice'>('stats');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const [isMeasuring, setIsMeasuring] = useState(false);
  const [countdown, setCountdown] = useState(30);

  // Value for the selected day in WeekSelector
  const dayMetricValue = React.useMemo(() => {
    if (metricId === 'bpm') {
      if (selectedDay === TODAY_INDEX && isMeasuring && liveBpm) return liveBpm;
      if (isFirstLaunch) return (dayData?.bpm || 0);
      return dayData?.bpm || 62;
    }
    if (metricId === 'hrv') {
      if (isFirstLaunch) return (dayData?.hrv || 0);
      return dayData?.hrv || 71;
    }
    if (metricId === 'temp') {
      return dayData.tempDelta;
    }
    if (metricId === 'spo2') {
      if (isFirstLaunch) return (dayData?.spo2 || 0);
      return dayData?.spo2 || 98.4;
    }
    return 14.2;
  }, [metricId, selectedDay, dayData, isMeasuring, liveBpm]);

  useEffect(() => {
    if (!isMeasuring || metricId !== 'bpm') return;

    const unsubscribe = qringBle.subscribe((data) => {
      if (data.heartRate && data.heartRate > 35 && data.heartRate < 220) {
        setLiveBpm(data.heartRate);
      }
    });

    qringBle.startRealTimeHeartRate();

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setIsMeasuring(false);
          setCountdown(30);
          qringBle.stopRealTimeHeartRate();
          return 0;
        }
        setLiveBpm((current) => {
          const delta = (Math.random() - 0.46) * 2.2;
          return Math.round(Math.max(52, Math.min(180, current + delta)));
        });
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [isMeasuring, metricId, setLiveBpm]);

  const isEn = language === 'en';
  const displayTitle = isEn ? detail.titleEn : detail.title;
  const displaySubtitle = isEn ? theme.subtitleEn : theme.subtitleFr;
  const displayBadge = isEn ? detail.badgeEn : detail.badge;
  const selectedDayInfo = WEEK[selectedDay] || WEEK[TODAY_INDEX];
  const displayPeriodText = `${selectedDayInfo?.long} ${selectedDayInfo?.date}${selectedDay === TODAY_INDEX ? (isEn ? " (Today)" : " (Aujourd'hui)") : ""}`;
  const displaySummary = isEn ? detail.summaryEn : detail.summary;
  const displayAdvice = isEn ? detail.adviceEn : detail.advice;
  const displayStats = isEn ? detail.statsEn : detail.stats;
  const displayMoments = isEn ? detail.momentsEn : detail.moments;
  const displayDistribution = isEn ? detail.distributionEn : detail.distribution;
  const displayTipPoints = isEn ? theme.tipPointsEn : theme.tipPointsFr;

  const isZeroState = isFirstLaunch && (dayMetricValue === 0 || dayMetricValue === null);

  // Active dataset based on selected day curve
  const dataset: MetricDataPoint[] = React.useMemo(() => {
    if (isZeroState) {
      return detail.points24h.map((p) => ({ ...p, value: 0 }));
    }
    const base = detail.points24h;
    const baseAvg = base.reduce((s, p) => s + p.value, 0) / (base.length || 1);
    const targetVal = typeof dayMetricValue === 'number' ? dayMetricValue : baseAvg;
    const delta = targetVal - baseAvg;
    return base.map((p) => {
      if (metricId === 'temp') {
        return { ...p, value: Math.round((p.value + delta * 0.4) * 100) / 100 };
      }
      const shifted = Math.round((p.value + delta) * 10) / 10;
      return {
        ...p,
        value: Math.max(detail.minVal, Math.min(detail.maxVal, shifted)),
      };
    });
  }, [detail, dayMetricValue, metricId, isZeroState]);

  // Active point when hovering or default to latest
  const activePoint: MetricDataPoint =
    hoverIndex !== null && dataset[hoverIndex]
      ? dataset[hoverIndex]
      : dataset[dataset.length - 1];

  // SVG Chart Dimensions & Offsets
  const chartHeight = 160;
  const chartWidth = 330;
  const paddingLeft = 48;
  const paddingRight = 12;
  const paddingTop = 22;
  const paddingBottom = 22;
  const bottomY = chartHeight - paddingBottom;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = bottomY - paddingTop;

  const values = dataset.map((d) => d.value);
  const minVal = Math.min(detail.minVal, ...values);
  const maxVal = Math.max(detail.maxVal, ...values);
  const range = maxVal - minVal || 1;
  const midVal = (minVal + maxVal) / 2;
  const avgVal = values.reduce((sum, v) => sum + v, 0) / (values.length || 1);

  const getX = (i: number) => {
    if (dataset.length <= 1) return paddingLeft;
    return paddingLeft + (i / (dataset.length - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(minVal, Math.min(maxVal, val));
    const ratio = (clamped - minVal) / range;
    return bottomY - ratio * plotHeight;
  };

  const avgY = getY(avgVal);

  const coordPoints = dataset.map((pt, i) => ({
    x: getX(i),
    y: getY(pt.value),
  }));
  const linePath = getSmoothPath(coordPoints);
  const areaPath = getSmoothArea(coordPoints, bottomY);

  const getIcon = () => {
    switch (detail.iconName) {
      case 'heart':
        return <Heart size={16} color={theme.primary} fill={theme.primary} />;
      case 'activity':
        return <Activity size={16} color={theme.primary} />;
      case 'thermometer':
        return <Thermometer size={16} color={theme.primary} />;
      case 'droplets':
        return <Droplets size={16} color={theme.primary} fill={theme.primary} />;
      case 'wind':
        return <Wind size={16} color={theme.primary} />;
    }
  };

  const formatVal = (val: number) => {
    if (metricId === 'temp') {
      return val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2);
    }
    return val % 1 === 0 ? val.toString() : val.toFixed(1);
  };

  const formatTick = (val: number) => {
    if (metricId === 'temp') {
      return val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
    }
    return Math.round(val).toString();
  };

  const handlePointerMove = (clientX: number, rect: DOMRect) => {
    const plotLeft = rect.left + (paddingLeft / chartWidth) * rect.width;
    const plotW = (plotWidth / chartWidth) * rect.width;
    const relX = Math.max(0, Math.min(1, (clientX - plotLeft) / plotW));
    const idx = Math.min(
      dataset.length - 1,
      Math.max(0, Math.round(relX * (dataset.length - 1)))
    );
    setHoverIndex(idx);
  };

  const currentDisplayVal =
    hoverIndex !== null
      ? formatVal(activePoint.value)
      : metricId === 'bpm' && selectedDay === TODAY_INDEX && isMeasuring && liveBpm
      ? liveBpm
      : formatVal(dayMetricValue);

  return (
    <div className={`modal-backdrop ${isClosing ? "is-closing" : ""}`} onClick={handleClose} role="dialog" aria-modal="true">
      <div
        className={`metric-detail-sheet ${isClosing ? "is-closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.sheetBg,
          boxShadow: theme.sheetGlow,
        }}
      >
        {/* Grabber */}
        <div className="metric-sheet-grabber" />

        {/* Top Header */}
        <div className="metric-detail-header">
          <button
            type="button"
            className="metric-back-btn"
            onClick={handleClose}
            aria-label={t('metric.back')}
          >
            <ChevronLeft size={19} color="#FAF7F2" />
            <span style={{ color: '#FAF7F2' }}>{t('metric.back')}</span>
          </button>

          <div className="metric-header-title-wrap">
            <h2 className="metric-header-title">{displayTitle}</h2>
            <span className="metric-header-sub" style={{ color: `${theme.primary}CC` }}>
              {displaySubtitle}
            </span>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Week Selector (Photo 2) replacing the 24h/7j/30j tabs */}
        <div style={{ padding: '0 2px', marginTop: '2px', marginBottom: '2px' }}>
          <WeekSelector />
        </div>

        {/* Hero Dynamic Value Card matching the Home Card Theme */}
        <div
          className="metric-hero-banner"
          style={{
            background: theme.heroBg,
            border: theme.heroBorder,
            boxShadow: `0 14px 34px rgba(0, 0, 0, 0.6), 0 4px 20px ${theme.glow}`,
          }}
        >
          {/* Top Row: Icon Chip + Status Badge + Period tag */}
          <div className="metric-hero-top">
            <div className="metric-hero-badge">
              <span
                className="metric-hero-icon-chip"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: `1px solid ${theme.primary}55`,
                  boxShadow: `0 0 10px ${theme.primary}33`,
                }}
              >
                {getIcon()}
              </span>
              <span
                className="metric-hero-badge-tag"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: `1px solid ${theme.primary}55`,
                  color: '#FAF7F2',
                }}
              >
                {hoverIndex !== null ? activePoint.label : displayBadge}
              </span>
            </div>

            <span
              className="metric-hero-period-label"
              style={{
                fontSize: '11px',
                color: 'rgba(250, 247, 242, 0.7)',
                fontWeight: 500,
              }}
            >
              {hoverIndex !== null
                ? activePoint.info || t('metric.recorded_measure')
                : displayPeriodText}
            </span>
          </div>

          {/* Main Visual Row: Big Number & Unit + Signature Metric Visual Graphic */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '4px',
            }}
          >
            {/* Left Value */}
            <div>
              <div className="metric-hero-val-row">
                <span
                  className="metric-hero-val"
                  style={{
                    color: isMeasuring ? '#FF5A52' : '#FAF7F2',
                    textShadow: `0 0 24px ${theme.glow}`,
                    transition: 'color 0.25s ease',
                  }}
                >
                  {currentDisplayVal}
                </span>
                <span
                  className="metric-hero-unit"
                  style={{ color: `${theme.primary}DD`, fontSize: '16px' }}
                >
                  {detail.unit}
                </span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: 'rgba(250, 247, 242, 0.65)',
                  marginTop: '3px',
                  display: 'block',
                }}
              >
                {hoverIndex !== null
                  ? isEn ? 'Inspected data point' : 'Point inspecté sur la courbe'
                  : displayBadge}
              </span>
            </div>

            {/* Right Signature Visual: Matching the Home Screen Card Aesthetic! */}
            {metricId === 'spo2' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '10px',
                    color: '#F0ABFC',
                    marginBottom: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontWeight: 600,
                  }}
                >
                  <span style={{ fontSize: '7.5px' }}>▲</span> 0.7% {isEn ? 'Optimal' : 'Optimal'}
                </span>

                <svg width="86" height="46" viewBox="0 0 86 46" style={{ overflow: 'visible' }}>
                  {/* Dashed reference arch */}
                  <path
                    d="M 12 42 A 31 31 0 0 1 74 42"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.22)"
                    strokeWidth="1.2"
                    strokeDasharray="2 2.5"
                  />
                  {/* Glowing Orchid Arch */}
                  <path
                    d="M 5 42 A 38 38 0 0 1 81 42"
                    fill="none"
                    stroke={theme.primary}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 8px ${theme.glow})` }}
                  />
                  {/* Dynamic indicator dot on arch */}
                  {(() => {
                    const rawVal = Number(activePoint?.value ?? 98.6);
                    const ratio = Math.max(0, Math.min(1, (rawVal - 94) / 6));
                    const angle = Math.PI * (1 - ratio);
                    const cx = 43 - 38 * Math.cos(angle);
                    const cy = 42 - 38 * Math.sin(angle);
                    return (
                      <g>
                        <circle
                          cx={cx}
                          cy={cy}
                          r="6"
                          fill={theme.primary}
                          opacity="0.4"
                          style={{ filter: `drop-shadow(0 0 6px ${theme.primary})` }}
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r="3.5"
                          fill="#FAF7F2"
                          stroke={theme.primary}
                          strokeWidth="2"
                        />
                      </g>
                    );
                  })()}
                </svg>
              </div>
            )}

            {metricId === 'hrv' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '10px',
                    color: '#D9F970',
                    marginBottom: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontWeight: 600,
                  }}
                >
                  <span style={{ fontSize: '7.5px' }}>▲</span> +12% {isEn ? 'Recovered' : 'Récupéré'}
                </span>

                <svg width="86" height="42" viewBox="0 0 86 42" fill="none" style={{ overflow: 'visible' }}>
                  {/* Secondary sympathetic wave */}
                  <path
                    d="M 0 22 Q 21 8, 43 22 T 86 22"
                    stroke="rgba(250, 247, 242, 0.28)"
                    strokeWidth="1.3"
                    fill="none"
                  />
                  {/* Primary parasympathetic glowing lime wave */}
                  <path
                    d="M 0 20 Q 21 34, 43 20 T 86 20"
                    stroke={theme.primary}
                    strokeWidth="2"
                    fill="none"
                    style={{ filter: `drop-shadow(0 0 7px ${theme.glow})` }}
                  />
                </svg>
              </div>
            )}

            {metricId === 'temp' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '10px',
                    color: '#FB923C',
                    marginBottom: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontWeight: 600,
                  }}
                >
                  -0,08 °C vs réf.
                </span>

                <svg width="86" height="42" viewBox="0 0 86 42" style={{ overflow: 'visible' }}>
                  {/* Dotted reference line */}
                  <path
                    d="M 2 28 C 22 28, 42 14, 64 14 C 74 14, 82 18, 86 20"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.22)"
                    strokeWidth="1.2"
                    strokeDasharray="2 2.5"
                  />
                  {/* Glowing amber circadian wave */}
                  <path
                    d="M 2 30 C 22 30, 40 18, 58 18 C 72 18, 80 24, 86 24"
                    fill="none"
                    stroke={theme.primary}
                    strokeWidth="2"
                    style={{ filter: `drop-shadow(0 0 6px ${theme.glow})` }}
                  />
                  {/* Glowing node marker */}
                  <circle cx="58" cy="18" r="5" fill="#18120E" stroke={theme.primary} strokeWidth="2" />
                  <circle cx="58" cy="18" r="2" fill="#FDBA74" />
                </svg>
              </div>
            )}

            {metricId === 'resp' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '10px',
                    color: '#38BDF8',
                    marginBottom: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontWeight: 600,
                  }}
                >
                  {isEn ? 'Calm Cadence' : 'Cadence calme'}
                </span>

                <svg width="86" height="42" viewBox="0 0 86 42" fill="none" style={{ overflow: 'visible' }}>
                  <path
                    d="M 0 21 C 14 7, 28 35, 43 21 C 57 7, 71 35, 86 21"
                    stroke={theme.primary}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    fill="none"
                    style={{ filter: `drop-shadow(0 0 7px ${theme.glow})` }}
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Electrocardiogramme (ECG) en direct si Fréquence Cardiaque */}
          {metricId === 'bpm' && (
            <div style={{ margin: '8px 0 6px 0', width: '100%' }}>
              <div style={{ height: '44px', width: '100%' }}>
                <svg
                  viewBox="0 0 200 60"
                  style={{ width: '100%', height: '100%', overflow: 'visible' }}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="modalEcgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FF453A" />
                      <stop offset="50%" stopColor="#FF3B30" />
                      <stop offset="100%" stopColor="#E11D48" />
                    </linearGradient>
                    <linearGradient id="modalEcgFade" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                      <stop offset="15%" stopColor="#FFFFFF" stopOpacity="0.9" />
                      <stop offset="85%" stopColor="#FFFFFF" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                    </linearGradient>
                    <mask id="modalEcgMask">
                      <rect x="0" y="0" width="200" height="60" fill="url(#modalEcgFade)" />
                    </mask>
                    <filter id="modalEcgGlow" x="-20%" y="-30%" width="140%" height="160%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <path
                    d="M 0 30 C 15 30, 25 30, 35 30 C 39 30, 42 27, 45 27 C 48 27, 51 32, 54 32 C 58 32, 61 24, 65 24 C 69 24, 72 38, 75 38 C 79 38, 80 5, 83 5 C 86 5, 88 53, 91 53 C 94 53, 96 18, 99 18 C 102 18, 105 38, 108 38 C 112 38, 114 18, 117 18 C 121 18, 124 35, 128 35 C 131 35, 134 26, 137 26 C 141 26, 144 32, 147 32 C 153 32, 165 30, 200 30"
                    fill="none"
                    stroke="#FF3B30"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.3"
                    filter="url(#modalEcgGlow)"
                    mask="url(#modalEcgMask)"
                  />
                  <path
                    d="M 0 30 C 15 30, 25 30, 35 30 C 39 30, 42 27, 45 27 C 48 27, 51 32, 54 32 C 58 32, 61 24, 65 24 C 69 24, 72 38, 75 38 C 79 38, 80 5, 83 5 C 86 5, 88 53, 91 53 C 94 53, 96 18, 99 18 C 102 18, 105 38, 108 38 C 112 38, 114 18, 117 18 C 121 18, 124 35, 128 35 C 131 35, 134 26, 137 26 C 141 26, 144 32, 147 32 C 153 32, 165 30, 200 30"
                    fill="none"
                    stroke="url(#modalEcgGrad)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    mask="url(#modalEcgMask)"
                    className="ecg-pulse-line"
                  />
                </svg>
              </div>

              {/* Bouton de mesure du capteur en direct */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (isMeasuring) {
                      setIsMeasuring(false);
                      setCountdown(30);
                      qringBle.stopRealTimeHeartRate();
                    } else {
                      setIsMeasuring(true);
                      setCountdown(30);
                      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                        try {
                          navigator.vibrate([18, 30, 22]);
                        } catch (_) {}
                      }
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '7px 16px',
                    borderRadius: '999px',
                    background: isMeasuring
                      ? 'linear-gradient(135deg, rgba(255, 69, 58, 0.35), rgba(255, 45, 85, 0.25))'
                      : 'rgba(255, 69, 58, 0.14)',
                    border: isMeasuring
                      ? '1px solid rgba(255, 90, 82, 0.85)'
                      : '1px solid rgba(255, 69, 58, 0.45)',
                    color: '#FAF7F2',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    boxShadow: isMeasuring
                      ? '0 0 18px rgba(255, 69, 58, 0.65)'
                      : '0 2px 10px rgba(255, 69, 58, 0.2)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isMeasuring ? (
                    <>
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#30D158',
                          boxShadow: '0 0 8px #30D158',
                        }}
                      />
                      <span>
                        {language === 'fr'
                          ? `Arrêter la mesure (${countdown}s)`
                          : `Stop sensor (${countdown}s)`}
                      </span>
                      <Square size={10} fill="#FAF7F2" color="#FAF7F2" />
                    </>
                  ) : (
                    <>
                      <Heart size={13} fill="#FF453A" color="#FF453A" />
                      <span>
                        {language === 'fr'
                          ? 'Lancer la mesure en temps réel (30s)'
                          : 'Start live heart rate sensor (30s)'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <p className="metric-hero-summary-txt">{isZeroState ? (isEn ? "Waiting for first biometric measurement from your Vyta One." : "En attente de la première mesure biométrique de votre bague Vyta One.") : displaySummary}</p>
        </div>

        {/* Dynamic Interactive SVG Chart */}
        <div
          className="metric-chart-card"
          style={{
            background: 'rgba(16, 16, 20, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Header of Chart with Live Hover Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 4px 8px 4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={13} color={theme.primary} />
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'rgba(250, 247, 242, 0.9)',
                }}
              >
                {isEn ? 'Continuous 24h Trend' : 'Tendance continue 24h'}
              </span>
            </div>

            <div
              style={{
                fontSize: '10.5px',
                color: 'rgba(250, 247, 242, 0.65)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span>{isEn ? 'Avg: ' : 'Moy: '}</span>
              <strong style={{ color: theme.primary }}>
                {formatVal(avgVal)} {detail.unit}
              </strong>
            </div>
          </div>

          <div
            className="metric-svg-wrapper"
            onMouseMove={(e) => handlePointerMove(e.clientX, e.currentTarget.getBoundingClientRect())}
            onTouchMove={(e) => handlePointerMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <svg
              width="100%"
              height={chartHeight}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="none"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <linearGradient id={`areaGrad-${detail.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.primary} stopOpacity="0.45" />
                  <stop offset="55%" stopColor={theme.primary} stopOpacity="0.12" />
                  <stop offset="100%" stopColor={theme.primary} stopOpacity="0.0" />
                </linearGradient>

                <linearGradient id={`strokeGrad-${detail.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={theme.primary} />
                  <stop offset="50%" stopColor={theme.secondary} />
                  <stop offset="100%" stopColor={theme.primary} />
                </linearGradient>

                <filter id={`chartGlow-${detail.id}`} x="-20%" y="-30%" width="140%" height="160%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Vertical Unit Header */}
              <text
                x={paddingLeft - 8}
                y={12}
                textAnchor="end"
                fill="rgba(255, 255, 255, 0.6)"
                fontSize="9"
                fontFamily="var(--font-mono)"
                fontWeight="700"
                letterSpacing="0.04em"
              >
                {detail.unit}
              </text>

              {/* Minimal Clean Horizontal Gridlines & Y-Axis Graduations */}
              {[
                { val: maxVal, y: getY(maxVal), label: formatTick(maxVal) },
                { val: midVal, y: getY(midVal), label: formatTick(midVal) },
                { val: minVal, y: getY(minVal), label: formatTick(minVal) },
              ].map((tick, idx) => (
                <g key={idx}>
                  <line
                    x1={paddingLeft}
                    y1={tick.y}
                    x2={chartWidth - paddingRight}
                    y2={tick.y}
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={tick.y + 3.5}
                    textAnchor="end"
                    fill="rgba(255, 255, 255, 0.45)"
                    fontSize="9.5"
                    fontFamily="var(--font-mono)"
                    fontWeight="500"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}

              {/* Trait Moyen (Average Reference Line) */}
              <line
                x1={paddingLeft}
                y1={avgY}
                x2={chartWidth - paddingRight}
                y2={avgY}
                stroke={theme.primary}
                strokeDasharray="4 3"
                strokeWidth="1"
                opacity="0.5"
              />

              {/* Area Fill */}
              <path d={areaPath} fill={`url(#areaGrad-${detail.id})`} />

              {/* Ambient Glowing Halo Line */}
              <path
                d={linePath}
                fill="none"
                stroke={theme.primary}
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.32"
                filter={`url(#chartGlow-${detail.id})`}
              />

              {/* Sharp High-Intensity Core Line */}
              <path
                d={linePath}
                fill="none"
                stroke={`url(#strokeGrad-${detail.id})`}
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Interactive Scrub Cursor Indicator */}
              {hoverIndex !== null && (
                <>
                  <line
                    x1={getX(hoverIndex)}
                    y1={paddingTop - 4}
                    x2={getX(hoverIndex)}
                    y2={bottomY}
                    stroke="rgba(255, 255, 255, 0.55)"
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                  />
                  {/* Glowing halo dot */}
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getY(activePoint.value)}
                    r="8.5"
                    fill={theme.primary}
                    opacity="0.4"
                    filter={`url(#chartGlow-${detail.id})`}
                  />
                  {/* Sharp core dot */}
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getY(activePoint.value)}
                    r="4.5"
                    fill="#FFFFFF"
                    stroke={theme.primary}
                    strokeWidth="2.5"
                  />
                </>
              )}

              {/* Bottom Time Axis Labels */}
              {dataset.map((pt, i) => {
                if (dataset.length > 12 && i % 3 !== 0 && i !== dataset.length - 1) return null;
                return (
                  <text
                    key={i}
                    x={getX(i)}
                    y={chartHeight - 4}
                    textAnchor="middle"
                    fill="rgba(255, 255, 255, 0.45)"
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                  >
                    {pt.label}
                  </text>
                );
              })}
            </svg>

            {/* Floating Tooltip when scrubbing */}
            {hoverIndex !== null && (
              <div
                style={{
                  position: 'absolute',
                  left: `${Math.max(12, Math.min(84, (getX(hoverIndex) / chartWidth) * 100))}%`,
                  top: '6px',
                  transform: 'translateX(-50%)',
                  background: 'rgba(20, 20, 26, 0.92)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: `1px solid ${theme.primary}77`,
                  borderRadius: '12px',
                  padding: '4px 10px',
                  boxShadow: `0 4px 14px rgba(0, 0, 0, 0.6), 0 0 10px ${theme.glow}`,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  zIndex: 10,
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'rgba(250, 247, 242, 0.7)',
                  }}
                >
                  {activePoint.label}
                </span>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: theme.primary,
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {formatVal(activePoint.value)} {detail.unit}
                </span>
                {activePoint.info && (
                  <span
                    style={{
                      fontSize: '9.5px',
                      color: 'rgba(250, 247, 242, 0.85)',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    {activePoint.info}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Progressive Sub-Tabs Navigation */}
        <div className="metric-subtabs-nav">
          {(
            [
              { id: 'stats', label: t('metric.tab_stats') },
              { id: 'moments', label: t('metric.tab_moments') },
              { id: 'advice', label: t('metric.tab_advice') },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`metric-subtab-btn ${isActive ? 'active' : ''}`}
                style={
                  isActive
                    ? {
                        background: 'rgba(255, 255, 255, 0.12)',
                        border: `1px solid ${theme.primary}77`,
                        boxShadow: `0 0 12px ${theme.glow}`,
                        color: '#FFFFFF',
                      }
                    : {}
                }
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: CHIFFRES CLÉS (STATS & DISTRIBUTION) */}
        {activeTab === 'stats' && (
          <div className="metric-tab-pane">
            {/* 3 Essential Stat Cards in 1 Row */}
            <div className="metric-stats-row-3">
              {displayStats.map((st, i) => {
                const isMiddle = i === 1;
                return (
                  <div
                    key={i}
                    className="metric-mini-stat-card"
                    style={{
                      background: isMiddle ? 'rgba(255, 255, 255, 0.05)' : 'rgba(20, 20, 24, 0.65)',
                      border: isMiddle
                        ? `1px solid ${theme.primary}66`
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      boxShadow: isMiddle ? `0 0 14px ${theme.glow}` : undefined,
                    }}
                  >
                    <span className="mini-stat-label">{st.label}</span>
                    <span
                      className="mini-stat-val"
                      style={{
                        color: isMiddle ? theme.primary : '#FFFFFF',
                        textShadow: isMiddle ? `0 0 12px ${theme.glow}` : undefined,
                      }}
                    >
                      {st.value}
                    </span>
                    <span className="mini-stat-sub">{st.sub}</span>
                  </div>
                );
              })}
            </div>

            {/* Clean Zone Distribution with Dynamic Biomarker Colors */}
            <div
              className="metric-clean-card"
              style={{
                background: 'rgba(20, 20, 24, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="clean-card-title">{t('metric.distribution')}</span>
                <span
                  style={{
                    fontSize: '11px',
                    color: `${theme.primary}DD`,
                    fontWeight: 600,
                  }}
                >
                  {isEn ? 'Physiological Balance' : 'Équilibre physiologique'}
                </span>
              </div>

              {/* Multi-segment Progress Bar with actual biological colors */}
              <div className="clean-distrib-bar" style={{ height: '10px' }}>
                {displayDistribution.map((d, i) => {
                  const segColor = theme.zoneColors[i] || '#64748B';
                  return (
                    <div
                      key={i}
                      className="clean-distrib-seg"
                      style={{
                        width: `${d.percent}%`,
                        backgroundColor: segColor,
                        boxShadow: i === 0 ? `0 0 8px ${segColor}` : undefined,
                      }}
                      title={`${d.name}: ${d.percent}%`}
                    />
                  );
                })}
              </div>

              {/* Legend with glowing color dots */}
              <div className="clean-distrib-legend">
                {displayDistribution.map((d, i) => {
                  const segColor = theme.zoneColors[i] || '#64748B';
                  return (
                    <div key={i} className="distrib-legend-item">
                      <span
                        className="distrib-legend-dot"
                        style={{
                          backgroundColor: segColor,
                          boxShadow: `0 0 6px ${segColor}`,
                        }}
                      />
                      <span className="distrib-legend-name">{d.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '10.5px',
                            color: 'rgba(250, 247, 242, 0.65)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.06)',
                          }}
                        >
                          {d.percent}%
                        </span>
                        <span className="distrib-legend-dur">{d.duration}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MOMENTS CLÉS (KEY EVENTS) */}
        {activeTab === 'moments' && (
          <div className="metric-tab-pane">
            <div
              className="metric-clean-card"
              style={{
                background: 'rgba(20, 20, 24, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="clean-card-title">{t('metric.key_moments')}</span>
                <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)' }}>
                  {isEn ? 'Tap to inspect' : 'Touchez pour inspecter'}
                </span>
              </div>

              <div className="metric-clean-moments-list">
                {displayMoments.map((m, i) => {
                  const isHovered = hoverIndex === m.pointIndex;
                  return (
                    <button
                      key={i}
                      type="button"
                      className="clean-moment-row"
                      style={{
                        background: isHovered
                          ? 'rgba(255, 255, 255, 0.09)'
                          : 'rgba(255, 255, 255, 0.04)',
                        border: isHovered
                          ? `1px solid ${theme.primary}88`
                          : '1px solid rgba(255, 255, 255, 0.06)',
                        boxShadow: isHovered ? `0 0 14px ${theme.glow}` : undefined,
                      }}
                      onClick={() => {
                        setPeriod('24h');
                        setHoverIndex(m.pointIndex);
                        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                          try {
                            navigator.vibrate(15);
                          } catch (_) {}
                        }
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          color: '#FFFFFF',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          fontWeight: 700,
                          minWidth: '45px',
                        }}
                      >
                        <Clock size={11} color={theme.primary} />
                        <span>{m.time}</span>
                      </div>

                      <div className="clean-moment-text">
                        <span className="clean-moment-name">{m.title}</span>
                        <span className="clean-moment-tag">{m.tag}</span>
                      </div>

                      <span
                        className="clean-moment-val"
                        style={{
                          color: theme.primary,
                          textShadow: `0 0 10px ${theme.glow}`,
                        }}
                      >
                        {m.value}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CONSEIL SANTÉ (ACTIONABLE MEDICAL & CLINICAL ADVICE) */}
        {activeTab === 'advice' && (
          <div className="metric-tab-pane">
            <div
              className="metric-clean-card advice-card"
              style={{
                background: 'rgba(20, 20, 24, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
              }}
            >
              {/* Header */}
              <div className="advice-header">
                <Sparkles size={17} color={theme.primary} />
                <span className="clean-card-title">
                  {isEn ? 'Clinical Analysis & Advice' : 'Analyse Physiologique & Recommandations'}
                </span>
              </div>

              {/* Main Clinical Summary */}
              <p
                className="clean-advice-p"
                style={{
                  fontSize: '13px',
                  lineHeight: '1.55',
                  color: '#FAF7F2',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${theme.primary}33`,
                }}
              >
                {displayAdvice}
              </p>

              {/* 3 Structured physiological takeaways */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                {displayTipPoints.map((tp, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: `1px solid ${theme.primary}55`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '1px',
                      }}
                    >
                      <ShieldCheck size={11} color={theme.primary} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#FAF7F2',
                        }}
                      >
                        {tp.title}
                      </span>
                      <span
                        style={{
                          fontSize: '11.5px',
                          lineHeight: '1.45',
                          color: 'rgba(250, 247, 242, 0.72)',
                        }}
                      >
                        {tp.desc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
