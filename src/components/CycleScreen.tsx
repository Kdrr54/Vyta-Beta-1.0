import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Flame,
  Zap,
  Droplets,
  PenLine,
  Check,
  TrendingUp,
  Sparkles,
  X,
  CheckCircle2,
  Settings2,
  RotateCcw,
} from 'lucide-react';

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface DayTempPoint {
  day: number;
  temp: number;
  phase: 'menstruation' | 'follicular' | 'ovulation' | 'luteal';
}

export type PeriodFlow = 'light' | 'medium' | 'heavy' | null;
export type CervicalMucus = 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite' | null;
export type SpottingType = 'light' | 'ovulation' | null;

export interface CalendarDayLog {
  period?: PeriodFlow;
  mucus?: CervicalMucus;
  spotting?: SpottingType;
  symptoms?: string[];
  note?: string;
}

export const CycleScreen: React.FC = () => {
  const { language, setTab, profile, simulatedDate } = useApp();
  const isEn = language === 'en';

  // --------------------------------------------------------------------------
  // CYCLE PREDICTION ONBOARDING & SETUP STATE
  // --------------------------------------------------------------------------
  // Check if cycle parameters are already configured
  const [isConfigured, setIsConfigured] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('vyta_cycle_configured') === 'true';
    }
    return false;
  });

  // Cycle configuration inputs
  const [lastPeriodDay, setLastPeriodDay] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vyta_cycle_last_period');
      return saved ? parseInt(saved, 10) : 16; // 16 October by default (yesterday)
    }
    return 16;
  });

  const [cycleLength, setCycleLength] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vyta_cycle_length');
      return saved ? parseInt(saved, 10) : 28;
    }
    return 28;
  });

  const [periodDuration, setPeriodDuration] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vyta_period_duration');
      return saved ? parseInt(saved, 10) : 5;
    }
    return 5;
  });

  // Modal / Sheet for editing setup
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // DYNAMIC CYCLE DAY CALCULATION (CONNECTED TO SIMULATED DATE)
  // --------------------------------------------------------------------------
  const todayCalDay = simulatedDate.getDate();
  const todayMonth = simulatedDate.getMonth(); // 0-indexed (9 = October)
  const todayYear = simulatedDate.getFullYear();

  // Calculate current cycle day from simulated date and cycle start (lastPeriodDay in Oct 2026):
  const computedCycleDay = (() => {
    if (!isConfigured) return 2;
    const startDate = new Date(2026, 9, lastPeriodDay);
    const currentDate = new Date(todayYear, todayMonth, todayCalDay);
    const diffDays = Math.round((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 1;
    return Math.min(cycleLength, (diffDays % cycleLength) + 1);
  })();

  // Current active day in the 28-day cycle view
  const [selectedCycleDay, setSelectedCycleDay] = useState<number>(computedCycleDay);

  // Selected calendar day and active month view
  const [viewYear, setViewYear] = useState<number>(todayYear);
  const [viewMonth, setViewMonth] = useState<number>(todayMonth);
  const [selectedCalDay, setSelectedCalDay] = useState<number>(todayCalDay);
  const [showMonthDropdown, setShowMonthDropdown] = useState<boolean>(false);

  // Update selectedCycleDay whenever configuration or simulated date changes
  useEffect(() => {
    if (isConfigured) {
      setSelectedCycleDay(computedCycleDay);
      setViewYear(todayYear);
      setViewMonth(todayMonth);
      setSelectedCalDay(todayCalDay);
    }
  }, [computedCycleDay, todayCalDay, todayMonth, todayYear, isConfigured]);

  // --------------------------------------------------------------------------
  // TACTILE CIRCULAR ROTARY DIAL GESTURE
  // --------------------------------------------------------------------------
  const dialContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const updateDayFromPointer = (clientX: number, clientY: number) => {
    if (!dialContainerRef.current) return;
    const rect = dialContainerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;

    // Angle in degrees from 12 o'clock (top) clockwise
    const rad = Math.atan2(dy, dx);
    const deg = (rad * 180) / Math.PI;
    const clockDeg = (deg + 90 + 360) % 360;

    let day = Math.floor((clockDeg / 360) * cycleLength) + 1;
    day = Math.max(1, Math.min(cycleLength, day));

    setSelectedCycleDay((prevDay) => {
      if (day !== prevDay) {
        const targetDate = new Date(2026, 9, lastPeriodDay + (day - 1));
        if (targetDate.getMonth() === 9) {
          setSelectedCalDay(targetDate.getDate());
        }
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(6);
          } catch (e) {}
        }
      }
      return day;
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isConfigured) {
      setShowConfigModal(true);
      return;
    }
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {}
    setIsDragging(true);
    updateDayFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !isConfigured) return;
    updateDayFromPointer(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
  };

  // --------------------------------------------------------------------------
  // BBT CHART HORIZONTAL SCRUBBING GESTURE (MOVE POINT ACCORDING TO J)
  // --------------------------------------------------------------------------
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingChart, setIsDraggingChart] = useState<boolean>(false);

  const updateDayFromChartPointer = (clientX: number) => {
    if (!chartContainerRef.current) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const padX = 26;
    const chartW = 320;
    const graphW = chartW - padX * 2;

    const relX = clientX - rect.left;
    const scale = chartW / Math.max(1, rect.width);
    const svgX = relX * scale;

    const t = Math.max(0, Math.min(1, (svgX - padX) / graphW));
    const day = Math.max(1, Math.min(cycleLength, Math.round(1 + t * (cycleLength - 1))));

    setSelectedCycleDay((prevDay) => {
      if (day !== prevDay) {
        const targetDate = new Date(2026, 9, lastPeriodDay + (day - 1));
        if (targetDate.getMonth() === 9) {
          setSelectedCalDay(targetDate.getDate());
        }
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(6);
          } catch (e) {}
        }
      }
      return day;
    });
  };

  const handleChartPointerDown = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {}
    setIsDraggingChart(true);
    updateDayFromChartPointer(e.clientX);
  };

  const handleChartPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingChart) return;
    updateDayFromChartPointer(e.clientX);
  };

  const handleChartPointerUp = (e: React.PointerEvent) => {
    setIsDraggingChart(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
  };

  // --------------------------------------------------------------------------
  // BIOMARKER LOGS (STARTS 100% EMPTY AS REQUESTED: 0 INFOS)
  // --------------------------------------------------------------------------
  const [calendarLogs, setCalendarLogs] = useState<Record<string, CalendarDayLog>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vyta_calendar_logs');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return {}; // Empty state: 0 infos logged!
  });

  const getDayLog = (day: number): CalendarDayLog => {
    const key = `${viewYear}-${viewMonth}-${day}`;
    return (calendarLogs as any)[key] || (viewYear === 2026 && viewMonth === 9 ? (calendarLogs as any)[day] : undefined) || {};
  };

  const updateDayLog = (day: number, field: keyof CalendarDayLog, value: any) => {
    const key = `${viewYear}-${viewMonth}-${day}`;
    setCalendarLogs((prev) => {
      const current = (prev as any)[key] || (viewYear === 2026 && viewMonth === 9 ? (prev as any)[day] : undefined) || {};
      const updated = {
        ...current,
        [field]: current[field] === value ? null : value,
      };
      const next = {
        ...prev,
        [key]: updated,
        ...(viewYear === 2026 && viewMonth === 9 ? { [day]: updated } : {}),
      };
      try {
        localStorage.setItem('vyta_calendar_logs', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // Quick modals for Symptoms & Flow
  const [activeModal, setActiveModal] = useState<'symptoms' | 'flow' | null>(null);
  const [flowStatus, setFlowStatus] = useState<string | null>(null);
  const [loggedSymptoms, setLoggedSymptoms] = useState<string[]>([]);

  const toggleSymptom = (id: string) => {
    setLoggedSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  // Handler to validate cycle prediction configuration
  const handleValidateConfig = () => {
    setIsConfigured(true);
    setShowConfigModal(false);
    try {
      localStorage.setItem('vyta_cycle_configured', 'true');
      localStorage.setItem('vyta_cycle_last_period', lastPeriodDay.toString());
      localStorage.setItem('vyta_cycle_length', cycleLength.toString());
      localStorage.setItem('vyta_period_duration', periodDuration.toString());
    } catch (e) {}
  };

  // Handler to reset all cycle data back to 0
  const handleResetAll = () => {
    setIsConfigured(false);
    setCalendarLogs({});
    setLoggedSymptoms([]);
    setFlowStatus(null);
    setShowConfigModal(false);
    try {
      localStorage.removeItem('vyta_cycle_configured');
      localStorage.removeItem('vyta_calendar_logs');
    } catch (e) {}
  };

  // Generate realistic 28-day nocturnal basal body temperature curve
  const tempPoints: DayTempPoint[] = Array.from({ length: cycleLength }, (_, i) => {
    const day = i + 1;
    const ovuDay = cycleLength - 14;
    let temp = 36.35;
    let phase: DayTempPoint['phase'] = 'follicular';

    if (day <= periodDuration) {
      phase = 'menstruation';
      temp = 36.37 - (day - 1) * 0.02 + Math.sin(day * 1.5) * 0.015;
    } else if (day < ovuDay - 1) {
      phase = 'follicular';
      temp = 36.31 + Math.sin(day * 0.8) * 0.025;
    } else if (day >= ovuDay - 1 && day <= ovuDay) {
      phase = 'ovulation';
      temp = 36.24 + (day === ovuDay ? -0.03 : 0);
    } else if (day === ovuDay + 1) {
      phase = 'luteal';
      temp = 36.52;
    } else if (day < cycleLength - 2) {
      phase = 'luteal';
      temp = 36.73 + Math.sin((day - ovuDay) * 0.5) * 0.03;
    } else {
      phase = 'luteal';
      temp = 36.46 - (day - (cycleLength - 2)) * 0.08;
    }
    return { day, temp: Number(temp.toFixed(2)), phase };
  });

  const selectedPoint = tempPoints[selectedCycleDay - 1] || tempPoints[0];

  // Helper for phase details according to cycle day
  const getPhaseInfo = (day: number) => {
    if (!isConfigured) {
      return {
        key: 'unconfigured',
        badgeFr: 'CYCLE EN ATTENTE DE CONFIGURATION',
        badgeEn: 'CYCLE PENDING SETUP',
        phaseWordFr: 'à prédire',
        phaseWordEn: 'to predict',
        color: 'var(--text-secondary)',
        orbClass: 'unconfigured',
        fertileChanceFr: '—',
        fertileChanceEn: '—',
        adviceFr: 'Renseignez la date de vos dernières règles pour calculer et afficher vos prédictions personnalisées.',
        adviceEn: 'Enter your last period date to calculate and display your personalized predictions.',
        estrogen: 50,
        progesterone: 50,
      };
    }

    const ovuDay = cycleLength - 14;

    if (day <= periodDuration) {
      return {
        key: 'menstruation',
        badgeFr: `J${day} DES RÈGLES`,
        badgeEn: `DAY ${day} OF PERIOD`,
        phaseWordFr: 'menstruelle',
        phaseWordEn: 'menstrual',
        color: '#8B1E2F',
        orbClass: 'menstruation',
        fertileChanceFr: 'Faible',
        fertileChanceEn: 'Low',
        adviceFr: 'Phase de repos et récupération. Favorisez le magnésium, le fer et un sommeil réparateur.',
        adviceEn: 'Rest and recovery phase. Prioritize magnesium, iron, and deep sleep.',
        estrogen: 20,
        progesterone: 10,
      };
    }
    if (day < ovuDay) {
      const daysToOvu = ovuDay - day;
      return {
        key: 'follicular',
        badgeFr: `J${day} · PHASE FOLLICULAIRE`,
        badgeEn: `DAY ${day} · FOLLICULAR PHASE`,
        phaseWordFr: 'folliculaire',
        phaseWordEn: 'follicular',
        color: '#BF5AF2',
        orbClass: 'follicular',
        fertileChanceFr: daysToOvu <= 3 ? 'Élevée' : 'Moyenne',
        fertileChanceEn: daysToOvu <= 3 ? 'High' : 'Medium',
        adviceFr: 'Pic d’œstrogènes : force musculaire maximale, énergie haute et endurance au zénith.',
        adviceEn: 'Estrogen surge: peak muscular power, high energy, and optimal endurance.',
        estrogen: 85,
        progesterone: 15,
      };
    }
    if (day <= ovuDay + 2) {
      return {
        key: 'ovulation',
        badgeFr: `J${day} · OVULATION & PIC FERTILE`,
        badgeEn: `DAY ${day} · OVULATION & PEAK`,
        phaseWordFr: 'ovulatoire',
        phaseWordEn: 'ovulatory',
        color: '#FFD60A',
        orbClass: 'ovulation',
        fertileChanceFr: 'Maximale',
        fertileChanceEn: 'Peak',
        adviceFr: 'Pic de métabolisme et vitalité. Hydratation accrue recommandée suite à l’élévation thermique.',
        adviceEn: 'Metabolic peak and highest vitality. Hydrate well as basal temperature begins rising.',
        estrogen: 95,
        progesterone: 40,
      };
    }
    const daysToPeriod = cycleLength - day + 1;
    return {
      key: 'luteal',
      badgeFr: `J${day} · PHASE LUTÉALE`,
      badgeEn: `DAY ${day} · LUTEAL PHASE`,
      phaseWordFr: 'lutéale',
      phaseWordEn: 'luteal',
      color: '#5E5CE6',
      orbClass: 'luteal',
      fertileChanceFr: 'Très faible',
      fertileChanceEn: 'Very low',
      adviceFr: 'Montée de progestérone : privilégiez l’endurance fondamentale douce (Zone 2) et le yoga.',
      adviceEn: 'Progesterone rise: focus on gentle zone 2 cardio, mobility, and cool bedroom temperature.',
      estrogen: 45,
      progesterone: 85,
    };
  };

  const currentInfo = getPhaseInfo(selectedCycleDay);

  // Orbital ring geometry: center (144, 144), radius = 134 (spaced out around the 216px sphere)
  const orbitRadius = 134;
  const orbitCenter = 144;
  const circumference = 2 * Math.PI * orbitRadius;

  const p1Len = (periodDuration / cycleLength) * circumference;
  const p2Len = ((cycleLength - 14 - periodDuration) / cycleLength) * circumference;
  const p3Len = (3 / cycleLength) * circumference;
  const p4Len = circumference - (p1Len + p2Len + p3Len);

  const markerAngleDeg = -90 + ((selectedCycleDay - 0.5) / cycleLength) * 360;
  const markerRad = (markerAngleDeg * Math.PI) / 180;
  const markerX = orbitCenter + orbitRadius * Math.cos(markerRad);
  const markerY = orbitCenter + orbitRadius * Math.sin(markerRad);

  const displayName = profile.firstName || 'Chloé';
  const initialLetter = displayName.charAt(0).toUpperCase();

  const currentCalLog = getDayLog(selectedCalDay);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;

  // Helper to format the exact calendar date corresponding to any cycle day (J1, J2, ... J28)
  const getCycleDayDateLabel = (dayNum: number) => {
    if (!isConfigured) {
      return isEn ? `Today, ${MONTH_NAMES_EN[todayMonth]} ${todayCalDay}` : `Aujourd’hui, ${todayCalDay} ${MONTH_NAMES_FR[todayMonth].toLowerCase()}`;
    }

    // Cycle day 1 (J1) starts on lastPeriodDay of October 2026
    const dateObj = new Date(2026, 9, lastPeriodDay + (dayNum - 1));
    const dayOfMonth = dateObj.getDate();
    const monthIndex = dateObj.getMonth();
    const year = dateObj.getFullYear();

    const isToday = dayOfMonth === todayCalDay && monthIndex === todayMonth && year === todayYear;
    const isYesterday = (new Date(year, monthIndex, dayOfMonth).toDateString() === new Date(todayYear, todayMonth, todayCalDay - 1).toDateString());
    const isTomorrow = (new Date(year, monthIndex, dayOfMonth).toDateString() === new Date(todayYear, todayMonth, todayCalDay + 1).toDateString());

    const weekdayFr = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][dateObj.getDay()];
    const weekdayEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getDay()];

    const monthFr = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][monthIndex];
    const monthEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][monthIndex];

    if (isToday) {
      return isEn ? `Today · ${weekdayEn}, ${monthEn} ${dayOfMonth}` : `Aujourd’hui · ${weekdayFr} ${dayOfMonth} ${monthFr}`;
    }
    if (isYesterday) {
      return isEn ? `Yesterday · ${weekdayEn}, ${monthEn} ${dayOfMonth}` : `Hier · ${weekdayFr} ${dayOfMonth} ${monthFr}`;
    }
    if (isTomorrow) {
      return isEn ? `Tomorrow · ${weekdayEn}, ${monthEn} ${dayOfMonth}` : `Demain · ${weekdayFr} ${dayOfMonth} ${monthFr}`;
    }

    return isEn ? `${weekdayEn}, ${monthEn} ${dayOfMonth}` : `${weekdayFr} ${dayOfMonth} ${monthFr}`;
  };

  // Calculate predicted period days across any month
  const isPredictedPeriodDayForMonth = (calDay: number, year: number, month: number) => {
    if (!isConfigured) return false;
    const thisDate = new Date(year, month, calDay);
    const startDate = new Date(2026, 9, lastPeriodDay);
    const diffDays = Math.round((thisDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const cycleMod = ((diffDays % cycleLength) + cycleLength) % cycleLength;
    return cycleMod < periodDuration;
  };

  const isPredictedOvulationDayForMonth = (calDay: number, year: number, month: number) => {
    if (!isConfigured) return false;
    const thisDate = new Date(year, month, calDay);
    const startDate = new Date(2026, 9, lastPeriodDay);
    const diffDays = Math.round((thisDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const ovuDayInCycle = cycleLength - 14;
    const cycleMod = ((diffDays % cycleLength) + cycleLength) % cycleLength;
    return cycleMod === (ovuDayInCycle - 1);
  };

  const isPredictedFertileWindowForMonth = (calDay: number, year: number, month: number) => {
    if (!isConfigured) return false;
    const thisDate = new Date(year, month, calDay);
    const startDate = new Date(2026, 9, lastPeriodDay);
    const diffDays = Math.round((thisDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const ovuDayInCycle = cycleLength - 14;
    const cycleMod = ((diffDays % cycleLength) + cycleLength) % cycleLength;
    return cycleMod >= (ovuDayInCycle - 5) && cycleMod <= (ovuDayInCycle);
  };

  return (
    <div className="screen-content cycle-screen-wrapper" style={{ paddingBottom: '96px' }}>
      {/* 1. Header with Hello Name, Settings/Configure Button, and User Initial */}
      <div
        style={{
          paddingTop: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1
          style={{
            fontSize: '26px',
            fontWeight: 800,
            color: '#FFFFFF',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          {`Hello ${displayName}`}
        </h1>
      </div>

      {/* -----------------------------------------------------------------------
          ONBOARDING BANNER (WHEN 0 INFOS CONFIGURED)
          ----------------------------------------------------------------------- */}
      {!isConfigured && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(43, 4, 4, 0.75) 0%, rgba(20, 2, 2, 0.95) 100%)',
            border: '1.5px solid #2b0404',
            borderRadius: '20px',
            padding: '16px 18px',
            marginTop: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            animation: 'fadeIn 240ms ease-out',
            boxShadow: '0 8px 30px rgba(43, 4, 4, 0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#C44558" />
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              {isEn ? 'Predict your menstrual cycle' : 'Prédire votre cycle menstruel'}
            </h3>
          </div>

          <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.45 }}>
            {isEn
              ? 'No cycle data recorded yet. Provide 3 quick details so Vyta can predict your phases, ovulation, and next period.'
              : 'Aucune donnée enregistrée pour le moment. Renseignez 3 informations simples pour que Vyta prévoie vos phases, votre ovulation et vos prochaines règles.'}
          </p>

          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #420808 0%, #2b0404 100%)',
              border: '1px solid #731724',
              borderRadius: '999px',
              padding: '8px 16px',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(43, 4, 4, 0.6)',
              transition: 'transform 160ms ease',
            }}
          >
            <span>{isEn ? 'Setup & Predict Cycle ✨' : 'Renseigner mes infos & Prédire ✨'}</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* 2. Top Phase Pill Badge (e.g. J2 DES RÈGLES) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '999px',
            padding: '6px 18px',
            fontSize: '11.5px',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#E4E4EA',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          }}
        >
          {isEn ? currentInfo.badgeEn : currentInfo.badgeFr}
        </div>
      </div>

      {/* 3. The Luminous Organic Orb & Orbital Cycle Ring (Tactile Rotary Dial) */}
      <div
        ref={dialContainerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'relative',
          width: '288px',
          height: '288px',
          margin: '16px auto 4px auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          cursor: isConfigured ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
        }}
        title={!isConfigured ? 'Touchez pour calibrer le cycle' : 'Faites tourner tactilement en cercle pour changer de jour'}
      >
        {/* Orbital SVG Track */}
        <svg
          width="288"
          height="288"
          viewBox="0 0 288 288"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: 'rotate(-90deg)',
            pointerEvents: 'none',
          }}
        >
          {/* Base Guide Circle */}
          <circle
            cx={orbitCenter}
            cy={orbitCenter}
            r={orbitRadius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="3"
          />

          {isConfigured && (
            <>
              {/* Arc 1: Menstruation */}
              <circle
                cx={orbitCenter}
                cy={orbitCenter}
                r={orbitRadius}
                fill="none"
                stroke="#8B1E2F"
                strokeWidth={currentInfo.key === 'menstruation' ? 5 : 3}
                strokeDasharray={`${p1Len} ${circumference - p1Len}`}
                strokeDashoffset={0}
                strokeLinecap="round"
                opacity={currentInfo.key === 'menstruation' ? 1 : 0.45}
              />

              {/* Arc 2: Follicular */}
              <circle
                cx={orbitCenter}
                cy={orbitCenter}
                r={orbitRadius}
                fill="none"
                stroke="#BF5AF2"
                strokeWidth={currentInfo.key === 'follicular' ? 5 : 3}
                strokeDasharray={`${p2Len} ${circumference - p2Len}`}
                strokeDashoffset={-p1Len}
                strokeLinecap="round"
                opacity={currentInfo.key === 'follicular' ? 1 : 0.45}
              />

              {/* Arc 3: Ovulation */}
              <circle
                cx={orbitCenter}
                cy={orbitCenter}
                r={orbitRadius}
                fill="none"
                stroke="#FFD60A"
                strokeWidth={currentInfo.key === 'ovulation' ? 5 : 3}
                strokeDasharray={`${p3Len} ${circumference - p3Len}`}
                strokeDashoffset={-(p1Len + p2Len)}
                strokeLinecap="round"
                opacity={currentInfo.key === 'ovulation' ? 1 : 0.5}
              />

              {/* Arc 4: Luteal */}
              <circle
                cx={orbitCenter}
                cy={orbitCenter}
                r={orbitRadius}
                fill="none"
                stroke="#8A4B38"
                strokeWidth={currentInfo.key === 'luteal' ? 5 : 3}
                strokeDasharray={`${p4Len} ${circumference - p4Len}`}
                strokeDashoffset={-(p1Len + p2Len + p3Len)}
                strokeLinecap="round"
                opacity={currentInfo.key === 'luteal' ? 1 : 0.35}
              />
            </>
          )}
        </svg>

        {/* Floating Capsule Node Marker on the Orbit (when configured) */}
        {isConfigured && (
          <div
            style={{
              position: 'absolute',
              left: `${markerX}px`,
              top: `${markerY}px`,
              transform: `translate(-50%, -50%) scale(${isDragging ? 1.18 : 1})`,
              background: currentInfo.color,
              color: '#FFFFFF',
              borderRadius: '999px',
              padding: '3px 9px',
              fontSize: '11px',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              boxShadow: `0 0 16px ${currentInfo.color}, 0 2px 8px rgba(0, 0, 0, 0.6)`,
              zIndex: 10,
              pointerEvents: 'none',
              transition: isDragging ? 'none' : 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {`J${selectedCycleDay}`}
          </div>
        )}

        {/* Central Organic Luminous Sphere */}
        <div
          className={`cycle-organic-sphere ${currentInfo.orbClass}`}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="cycle-sphere-cloud"
            style={{
              top: '-15%',
              left: '-10%',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.45) 0%, transparent 70%)',
            }}
          />
          <div
            className="cycle-sphere-cloud"
            style={{
              bottom: '-20%',
              right: '-10%',
              background: isConfigured ? 'radial-gradient(circle, rgba(160, 10, 60, 0.6) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(60, 50, 70, 0.6) 0%, transparent 70%)',
              animationDuration: '18s',
            }}
          />

          {/* Typography Stack */}
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'rgba(255, 255, 255, 0.88)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              zIndex: 2,
            }}
          >
            PHASE
          </span>

          <h2
            style={{
              fontSize: '27px',
              fontWeight: 800,
              color: '#FFFFFF',
              margin: '2px 0 0 0',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              zIndex: 2,
            }}
          >
            {isEn ? currentInfo.phaseWordEn : currentInfo.phaseWordFr}
          </h2>

          <div
            style={{
              width: '24px',
              height: '3px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.85)',
              marginTop: '8px',
              zIndex: 2,
            }}
          />
        </div>
      </div>

      {/* 4. Date Subtitle for each Cycle Day (Clean without arrows) */}
      <div style={{ textAlign: 'center', marginTop: '8px' }}>
        <span
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '-0.01em',
          }}
        >
          {getCycleDayDateLabel(selectedCycleDay)}
        </span>
      </div>



      {/* =========================================================================
          6. CALENDRIER INTERACTIF : RÈGLES, GLAIRE & SPOTTING (0 INFOS PAR DÉFAUT)
          ========================================================================= */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '16px',
          marginTop: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon size={16} color="#B83244" />
            <button
              type="button"
              onClick={() => setShowMonthDropdown(!showMonthDropdown)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '4px 10px',
                color: '#FFFFFF',
                fontSize: '13.5px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              title={isEn ? "Click to change month" : "Appuyez pour changer de mois"}
            >
              <span>{isEn ? `${MONTH_NAMES_EN[viewMonth]} ${viewYear}` : `${MONTH_NAMES_FR[viewMonth]} ${viewYear}`}</span>
              <ChevronDown size={14} color="var(--text-secondary)" style={{ transform: showMonthDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} />
            </button>

            {/* Quick Prev / Next Month Arrow Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <button
                type="button"
                onClick={() => {
                  if (viewMonth === 0) {
                    setViewMonth(11);
                    setViewYear(viewYear - 1);
                  } else {
                    setViewMonth(viewMonth - 1);
                  }
                  setShowMonthDropdown(false);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  padding: '4px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={isEn ? "Previous month" : "Mois précédent"}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (viewMonth === 11) {
                    setViewMonth(0);
                    setViewYear(viewYear + 1);
                  } else {
                    setViewMonth(viewMonth + 1);
                  }
                  setShowMonthDropdown(false);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  padding: '4px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={isEn ? "Next month" : "Mois suivant"}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
            }}
          >
            <Settings2 size={12} />
            <span>{isConfigured ? (isEn ? 'Edit prediction' : 'Modifier calcul') : (isEn ? 'Configure' : 'Calibrer')}</span>
          </button>
        </div>

        {/* Month Selector Dropdown Popup */}
        {showMonthDropdown && (
          <div
            style={{
              background: '#180303',
              border: '1.5px solid #540a0a',
              borderRadius: '16px',
              padding: '12px',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.75)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              zIndex: 30,
            }}
          >
            {/* Year Selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 6px 4px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                type="button"
                onClick={() => setViewYear(viewYear - 1)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 6px' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>{viewYear}</span>
              <button
                type="button"
                onClick={() => setViewYear(viewYear + 1)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 6px' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 12 Months Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {(isEn ? MONTH_NAMES_EN : MONTH_NAMES_FR).map((mName, mIdx) => {
                const isCurrent = viewMonth === mIdx;
                const isActualCurrentMonth = mIdx === 9 && viewYear === 2026;
                return (
                  <button
                    key={mIdx}
                    type="button"
                    onClick={() => {
                      setViewMonth(mIdx);
                      setShowMonthDropdown(false);
                    }}
                    style={{
                      background: isCurrent ? '#2b0404' : 'rgba(255, 255, 255, 0.04)',
                      border: isCurrent ? '1.5px solid #8B1E2F' : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '10px',
                      padding: '8px 4px',
                      color: isCurrent ? '#FFFFFF' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: isCurrent ? 800 : 600,
                      cursor: 'pointer',
                      textAlign: 'center',
                      position: 'relative',
                    }}
                  >
                    {mName}
                    {isActualCurrentMonth && (
                      <span style={{ position: 'absolute', top: '3px', right: '4px', width: '4px', height: '4px', borderRadius: '50%', background: '#0A84FF' }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Days of week header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
          <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
        </div>

        {/* Dynamic Month Calendar Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {/* Empty cells to offset the first day of the month */}
          {Array.from({ length: firstDayIndex }).map((_, emptyIdx) => (
            <div key={`empty-${emptyIdx}`} style={{ height: '38px' }} />
          ))}

          {Array.from({ length: daysInMonth }, (_, i) => {
            const calDay = i + 1;
            const log = getDayLog(calDay);
            const isSelected = selectedCalDay === calDay;
            const isToday = calDay === todayCalDay && viewMonth === todayMonth && viewYear === todayYear;
            const hasPeriodLog = !!log.period;
            const isPeriod = isPredictedPeriodDayForMonth(calDay, viewYear, viewMonth) || hasPeriodLog;
            const isOvulation = isPredictedOvulationDayForMonth(calDay, viewYear, viewMonth);
            const isFertile = isPredictedFertileWindowForMonth(calDay, viewYear, viewMonth);
            const hasMucus = !!log.mucus;
            const hasSpotting = !!log.spotting;

            let cellBg = 'rgba(255, 255, 255, 0.02)';
            let borderColor = 'rgba(255, 255, 255, 0.05)';
            let dayTextColor = 'var(--text-secondary)';

            if (hasPeriodLog || (isPeriod && !hasMucus && !hasSpotting)) {
              cellBg = 'rgba(43, 4, 4, 0.75)';
              borderColor = '#731724';
              dayTextColor = '#FF8A80';
            } else if (hasSpotting && hasMucus) {
              cellBg = 'linear-gradient(135deg, rgba(255, 159, 10, 0.32) 0%, rgba(10, 132, 255, 0.32) 100%)';
              borderColor = 'rgba(255, 159, 10, 0.65)';
              dayTextColor = '#FFD60A';
            } else if (hasSpotting) {
              cellBg = 'rgba(255, 159, 10, 0.28)';
              borderColor = 'rgba(255, 159, 10, 0.55)';
              dayTextColor = '#FFB340';
            } else if (hasMucus) {
              cellBg = 'rgba(10, 132, 255, 0.28)';
              borderColor = 'rgba(10, 132, 255, 0.55)';
              dayTextColor = '#5AC8FA';
            } else if (isPeriod) {
              cellBg = 'rgba(43, 4, 4, 0.6)';
              borderColor = '#2b0404';
              dayTextColor = '#C44558';
            } else if (isOvulation) {
              cellBg = 'rgba(255, 214, 10, 0.18)';
              borderColor = 'rgba(255, 214, 10, 0.45)';
              dayTextColor = '#FFD60A';
            } else if (isFertile) {
              cellBg = 'rgba(255, 214, 10, 0.08)';
              borderColor = 'rgba(255, 214, 10, 0.2)';
              dayTextColor = '#E5C100';
            }

            if (isToday || isSelected) {
              dayTextColor = '#FFFFFF';
            }

            return (
              <div
                key={calDay}
                className={`cal-grid-cell ${isSelected ? 'selected' : ''}`}
                style={{
                  background: cellBg,
                  borderColor: isSelected ? '#FFFFFF' : borderColor,
                }}
                onClick={() => {
                  setSelectedCalDay(calDay);
                  if (isConfigured && viewMonth === 9 && viewYear === 2026) {
                    const diff = calDay - lastPeriodDay;
                    if (diff >= 0 && diff < cycleLength) {
                      setSelectedCycleDay(diff + 1);
                    } else if (diff >= cycleLength && diff < cycleLength * 2) {
                      setSelectedCycleDay((diff % cycleLength) + 1);
                    }
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: isToday || isSelected ? 800 : (hasPeriodLog || hasSpotting || hasMucus || isOvulation ? 700 : 500),
                    color: dayTextColor,
                  }}
                >
                  {calDay}
                </span>

                {/* Biomarker dots row: Period (Red), Mucus (Blue), Spotting (Amber) */}
                <div className="cal-dots-row">
                  {log.period && <span className="cal-dot period" title="Règles" />}
                  {log.mucus && <span className="cal-dot mucus" title="Glaire cervicale" />}
                  {log.spotting && <span className="cal-dot spotting" title="Spotting" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '10px', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="cal-dot period" />
            <span>{isEn ? 'Period' : 'Règles'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="cal-dot mucus" />
            <span>{isEn ? 'Cervical mucus' : 'Glaire cervicale'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="cal-dot spotting" />
            <span>{isEn ? 'Spotting' : 'Spotting'}</span>
          </div>
        </div>

        {/* =========================================================================
            DAY BIOMARKER LOGGING EDITOR SHEET (FOR SELECTED DAY)
            ========================================================================= */}
        <div
          style={{
            background: 'linear-gradient(180deg, #1c0505 0%, #100202 100%)',
            border: '1.5px solid #2b0404',
            borderRadius: '16px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginTop: '4px',
            boxShadow: '0 8px 24px rgba(43, 4, 4, 0.5)',
          }}
        >
          {/* Day Title and Status summary */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>
                {isEn ? `${selectedCalDay} ${MONTH_NAMES_EN[viewMonth]} ${viewYear}` : `${selectedCalDay} ${MONTH_NAMES_FR[viewMonth].toLowerCase()} ${viewYear}`}
              </span>
              {selectedCalDay === todayCalDay && viewMonth === todayMonth && viewYear === todayYear && (
                <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '4px', background: '#2b0404', border: '1px solid #731724', color: '#FFFFFF', fontWeight: 700 }}>
                  {isEn ? 'Today' : "Aujourd'hui"}
                </span>
              )}
            </div>

            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {isEn ? 'Biomarker Entry' : 'Saisie directe'}
            </span>
          </div>

          {/* 1. RÈGLES (Menstruations) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8B1E2F' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF' }}>
                {isEn ? 'Period (Flow)' : 'Règles (Menstruations)'}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[
                { id: 'light', labelFr: 'Légères 🩸', labelEn: 'Light 🩸' },
                { id: 'medium', labelFr: 'Moyennes 🩸🩸', labelEn: 'Medium 🩸🩸' },
                { id: 'heavy', labelFr: 'Abondantes 🩸🩸🩸', labelEn: 'Heavy 🩸🩸🩸' },
              ].map((opt) => {
                const isSelected = currentCalLog.period === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateDayLog(selectedCalDay, 'period', opt.id)}
                    className={`cal-marker-pill ${isSelected ? 'active-period' : ''}`}
                  >
                    {isSelected && <Check size={11} />}
                    <span>{isEn ? opt.labelEn : opt.labelFr}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. GLAIRE CERVICALE (Cervical Mucus) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0A84FF' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF' }}>
                {isEn ? 'Cervical Mucus (Fertility cue)' : 'Glaire cervicale (Fertilité)'}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[
                { id: 'dry', labelFr: 'Sèche', labelEn: 'Dry' },
                { id: 'sticky', labelFr: 'Collante', labelEn: 'Sticky' },
                { id: 'creamy', labelFr: 'Crémeuse', labelEn: 'Creamy' },
                { id: 'watery', labelFr: 'Aqueuse', labelEn: 'Watery' },
                { id: 'eggwhite', labelFr: 'Blanc d’œuf (fertile ✨)', labelEn: 'Egg white (peak ✨)' },
              ].map((opt) => {
                const isSelected = currentCalLog.mucus === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateDayLog(selectedCalDay, 'mucus', opt.id)}
                    className={`cal-marker-pill ${isSelected ? 'active-mucus' : ''}`}
                  >
                    {isSelected && <Check size={11} />}
                    <span>{isEn ? opt.labelEn : opt.labelFr}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. SPOTTING (Pertes légères / intermenstruelles) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF9F0A' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF' }}>
                {isEn ? 'Spotting (Light bleeding)' : 'Spotting (Pertes légères)'}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[
                { id: 'light', labelFr: 'Spotting léger', labelEn: 'Light spotting' },
                { id: 'ovulation', labelFr: 'Spotting d’ovulation', labelEn: 'Ovulation spotting' },
              ].map((opt) => {
                const isSelected = currentCalLog.spotting === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateDayLog(selectedCalDay, 'spotting', opt.id)}
                    className={`cal-marker-pill ${isSelected ? 'active-spotting' : ''}`}
                  >
                    {isSelected && <Check size={11} />}
                    <span>{isEn ? opt.labelEn : opt.labelFr}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. SYMPTÔMES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#B83244' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF' }}>
                  {isEn ? 'Symptoms' : 'Symptômes'}
                </span>
              </div>
              {((currentCalLog.symptoms && currentCalLog.symptoms.length > 0) || loggedSymptoms.length > 0) && (
                <span style={{ fontSize: '10px', color: '#B83244', fontWeight: 600 }}>
                  {(currentCalLog.symptoms?.length || loggedSymptoms.length)} {isEn ? 'selected' : 'sélectionné(s)'}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[
                { id: 'cramps', labelFr: 'Crampes', labelEn: 'Cramps' },
                { id: 'headache', labelFr: 'Maux de tête', labelEn: 'Headache' },
                { id: 'fatigue', labelFr: 'Fatigue', labelEn: 'Fatigue' },
                { id: 'bloating', labelFr: 'Ballonnements', labelEn: 'Bloating' },
                { id: 'mood', labelFr: 'Humeur', labelEn: 'Mood' },
                { id: 'tender_breasts', labelFr: 'Seins sensibles', labelEn: 'Tender breasts' },
              ].map((opt) => {
                const daySymptoms = currentCalLog.symptoms || loggedSymptoms || [];
                const isSelected = daySymptoms.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      const next = isSelected
                        ? daySymptoms.filter((s) => s !== opt.id)
                        : [...daySymptoms, opt.id];
                      updateDayLog(selectedCalDay, 'symptoms', next);
                      setLoggedSymptoms(next);
                    }}
                    className={`cal-marker-pill ${isSelected ? 'active-period' : ''}`}
                  >
                    {isSelected && <Check size={11} />}
                    <span>{isEn ? opt.labelEn : opt.labelFr}</span>
                  </button>
                );
              })}
            </div>

            {/* Note personnelle */}
            <div style={{ marginTop: '6px', position: 'relative' }}>
              <input
                type="text"
                value={currentCalLog.note || ''}
                onChange={(e) => updateDayLog(selectedCalDay, 'note', e.target.value)}
                placeholder={isEn ? 'Add a note (e.g. cramps, energy, mood...)' : 'Ajouter une note (ex: tiraillements, humeur, sport...)'}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '7px 10px 7px 28px',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#B83244')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
              />
              <PenLine
                size={12}
                color="var(--text-tertiary)"
                style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              />
            </div>
          </div>

          {/* Active Status Live Recap */}
          {(currentCalLog.period || currentCalLog.mucus || currentCalLog.spotting || (currentCalLog.symptoms && currentCalLog.symptoms.length > 0) || currentCalLog.note) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#FFFFFF', background: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: '8px' }}>
              <CheckCircle2 size={13} color="#30D158" />
              <span>
                {isEn ? 'Recorded for this day: ' : 'Enregistré pour ce jour : '}
                <strong>
                  {[
                    currentCalLog.period ? (isEn ? `Period (${currentCalLog.period})` : `Règles (${currentCalLog.period})`) : null,
                    currentCalLog.mucus ? (isEn ? `Mucus (${currentCalLog.mucus})` : `Glaire (${currentCalLog.mucus})`) : null,
                    currentCalLog.spotting ? (isEn ? `Spotting (${currentCalLog.spotting})` : `Spotting (${currentCalLog.spotting})`) : null,
                    currentCalLog.symptoms && currentCalLog.symptoms.length > 0 ? (isEn ? `${currentCalLog.symptoms.length} symptoms` : `${currentCalLog.symptoms.length} symptôme(s)`) : null,
                    currentCalLog.note ? (isEn ? `Note: "${currentCalLog.note.slice(0, 16)}${currentCalLog.note.length > 16 ? '…' : ''}"` : `Note: "${currentCalLog.note.slice(0, 16)}${currentCalLog.note.length > 16 ? '…' : ''}"`) : null,
                  ].filter(Boolean).join(' • ')}
                </strong>
              </span>
            </div>
          ) : (
            <span style={{ fontSize: '10.5px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              {isEn ? 'No biomarkers logged yet for this date. Tap buttons above to record.' : 'Aucun marqueur saisi pour cette date. Touchez les options ci-dessus pour enregistrer.'}
            </span>
          )}
        </div>
      </div>

      {/* =========================================================================
          SETUP & CALIBRATION MODAL / SHEET
          ========================================================================= */}
      {showConfigModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(16px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 200ms ease-out',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              maxHeight: '88vh',
              overflowY: 'auto',
              background: 'linear-gradient(180deg, #180303 0%, #0d0101 100%)',
              border: '1.5px solid #2b0404',
              borderRadius: '24px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(43, 4, 4, 0.4)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#C44558" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  {isEn ? 'Predict Menstrual Cycle' : 'Prédiction du Cycle'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {isEn
                ? 'Vyta uses these 3 key metrics to calculate and predict your phases, fertile window, and period schedule.'
                : 'Vyta utilise ces 3 métriques clés pour prédire avec précision vos phases, votre ovulation et vos prochaines règles.'}
            </p>

            {/* Input 1: Calendar Grid to select First Day of Last Period */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {isEn ? '1. First day of last period' : '1. Premier jour des dernières règles'}
                </label>
                <span style={{ fontSize: '10.5px', color: '#C44558', fontWeight: 700 }}>
                  {isEn ? `Selected: Oct ${lastPeriodDay}` : `Sélection : ${lastPeriodDay} oct.`}
                </span>
              </div>

              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {isEn
                  ? 'Select the exact date your last period started on the calendar:'
                  : 'Sélectionnez sur le calendrier la date où vos dernières règles ont commencé :'}
              </span>

              {/* Mini Calendar for Last Period Selection */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF' }}>Octobre 2026</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    {isEn ? `Today: ${todayCalDay} ${MONTH_NAMES_EN[todayMonth].slice(0, 3)}` : `Aujourd’hui : ${todayCalDay} ${MONTH_NAMES_FR[todayMonth].slice(0, 4)}`}
                  </span>
                </div>

                {/* Weekday headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '9.5px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
                </div>

                {/* 31 Days Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
                  {Array.from({ length: 31 }, (_, i) => {
                    const dayNum = i + 1;
                    const isSelected = lastPeriodDay === dayNum;
                    const isToday = dayNum === todayCalDay && todayMonth === 9 && todayYear === 2026;
                    const isFuture = todayMonth === 9 && todayYear === 2026 ? dayNum > todayCalDay : false;

                    let bg = 'rgba(255, 255, 255, 0.03)';
                    let color = isFuture ? 'rgba(255, 255, 255, 0.25)' : 'var(--text-secondary)';
                    let border = '1px solid transparent';

                    if (isSelected) {
                      bg = '#2b0404';
                      color = '#FFFFFF';
                      border = '1.5px solid #8B1E2F';
                    } else if (isToday) {
                      border = '1px solid rgba(255, 255, 255, 0.4)';
                      color = '#FFFFFF';
                    }

                    return (
                      <button
                        key={dayNum}
                        type="button"
                        onClick={() => setLastPeriodDay(dayNum)}
                        style={{
                          height: '27px',
                          borderRadius: '6px',
                          background: bg,
                          border: border,
                          color: color,
                          fontSize: '11px',
                          fontWeight: isSelected ? 800 : (isToday ? 700 : 500),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 0 10px rgba(139, 30, 47, 0.8)' : 'none',
                          transition: 'all 140ms ease',
                        }}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Input 2: Average Cycle Length */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF', display: 'block' }}>
                  {isEn ? 'Average Cycle Length' : 'Durée moyenne du cycle'}
                </span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>
                  {isEn ? 'Typically 28 days' : 'Généralement 28 jours (21 à 38j)'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setCycleLength((c) => Math.max(21, c - 1))}
                  style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#FFFFFF', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}
                >
                  -
                </button>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#FFFFFF', minWidth: '46px', textAlign: 'center' }}>
                  {cycleLength} {isEn ? 'days' : 'jours'}
                </span>
                <button
                  type="button"
                  onClick={() => setCycleLength((c) => Math.min(38, c + 1))}
                  style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#FFFFFF', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Input 3: Period Duration */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF', display: 'block' }}>
                  {isEn ? 'Average Period Duration' : 'Durée des règles'}
                </span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>
                  {isEn ? 'Typically 5 days' : 'Généralement 4 à 6 jours'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPeriodDuration((p) => Math.max(2, p - 1))}
                  style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#FFFFFF', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}
                >
                  -
                </button>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#FFFFFF', minWidth: '46px', textAlign: 'center' }}>
                  {periodDuration} {isEn ? 'days' : 'jours'}
                </span>
                <button
                  type="button"
                  onClick={() => setPeriodDuration((p) => Math.min(10, p + 1))}
                  style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#FFFFFF', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={handleValidateConfig}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #420808 0%, #2b0404 100%)',
                  border: '1px solid #731724',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(43, 4, 4, 0.6)',
                }}
              >
                {isEn ? 'Save & Predict My Cycle ✨' : 'Enregistrer & Prédire mon cycle ✨'}
              </button>

              {isConfigured && (
                <button
                  type="button"
                  onClick={handleResetAll}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#FF453A',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  <RotateCcw size={12} />
                  <span>{isEn ? 'Reset to blank state (0 info)' : 'Réinitialiser toutes les données à 0'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. Nocturnal Basal Body Temperature (BBT) 28-day Curve */}
      {(() => {
        const minT = 36.1;
        const maxT = 36.88;
        const chartW = 320;
        const chartH = 120;
        const padX = 26;
        const padTop = 22;
        const padBottom = 22;
        const graphW = chartW - padX * 2;
        const graphH = chartH - padTop - padBottom;

        const getPtCoord = (pt: DayTempPoint, idx: number) => {
          const x = padX + (idx / Math.max(1, cycleLength - 1)) * graphW;
          const ratio = (pt.temp - minT) / (maxT - minT);
          const y = chartH - padBottom - ratio * graphH;
          return { x, y };
        };

        const pts = tempPoints.map((pt, i) => getPtCoord(pt, i));

        // Separate real measured days (up to computedCycleDay) from upcoming future days
        const measuredPts = pts.slice(0, computedCycleDay);
        const projectedPts = pts.slice(Math.max(0, computedCycleDay - 1));

        const buildSmoothPath = (points: { x: number; y: number }[]) => {
          if (points.length <= 1) return '';
          return points.reduce((acc, curr, i, arr) => {
            if (i === 0) return `M ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
            const prev = arr[i - 1];
            const midX = (prev.x + curr.x) / 2;
            const midY = (prev.y + curr.y) / 2;
            return `${acc} Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)}, ${midX.toFixed(1)} ${midY.toFixed(1)} T ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
          }, '');
        };

        const measuredCurvePath = buildSmoothPath(measuredPts);
        const projectedCurvePath = buildSmoothPath(projectedPts);
        const fullCurvePath = buildSmoothPath(pts);

        const baselineY = chartH - padBottom - ((36.35 - minT) / (maxT - minT)) * graphH;
        const ovuDayIndex = cycleLength - 14 - 1;
        const ovuCoord = pts[Math.min(ovuDayIndex, pts.length - 1)] || pts[0];
        const activeIdx = Math.min(Math.max(0, selectedCycleDay - 1), pts.length - 1);
        const activeCoord = pts[activeIdx];

        const isFollicularOrPeriod = selectedCycleDay <= (cycleLength - 14 - 1);
        const isOvulationWindow = selectedCycleDay >= (cycleLength - 14) && selectedCycleDay <= (cycleLength - 14 + 2);
        const isLutealPhase = selectedCycleDay > (cycleLength - 14 + 2);

        return (
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '20px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '14px',
            }}
          >
            {/* Header: Title */}
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {isEn ? 'Basal Body Temperature (BBT)' : 'Température Basale Nocturne'}
              </span>
              <div style={{ marginTop: '3px' }}>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                  {selectedPoint.temp.toFixed(2).replace('.', ',')} °C
                </span>
              </div>
            </div>


            {/* Interactive SVG Chart (Draggable according to J) */}
            <div
              ref={chartContainerRef}
              onPointerDown={handleChartPointerDown}
              onPointerMove={handleChartPointerMove}
              onPointerUp={handleChartPointerUp}
              onPointerCancel={handleChartPointerUp}
              style={{
                width: '100%',
                height: `${chartH}px`,
                position: 'relative',
                overflow: 'hidden',
                cursor: isDraggingChart ? 'grabbing' : 'ew-resize',
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              title={isEn ? "Drag horizontally to select any cycle day" : "Glissez horizontalement pour déplacer le point selon les J"}
            >
              <svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="tempFillGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
                    <stop offset="50%" stopColor="#BF5AF2" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="#0A84FF" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Shaded vertical band for Ovulation window */}
                <rect
                  x={ovuCoord.x - 14}
                  y={padTop - 4}
                  width="28"
                  height={graphH + 8}
                  fill="rgba(255, 214, 10, 0.08)"
                  rx="6"
                />

                {/* Upper line: 36.8°C */}
                <line x1={padX} y1={padTop} x2={chartW - padX} y2={padTop} stroke="rgba(255, 255, 255, 0.06)" />
                <text x={chartW - padX + 2} y={padTop + 3} fill="rgba(255, 255, 255, 0.3)" fontSize="8.5" textAnchor="start">36,8°</text>

                {/* Baseline reference: 36.35°C */}
                <line
                  x1={padX}
                  y1={baselineY}
                  x2={chartW - padX}
                  y2={baselineY}
                  stroke="rgba(255, 255, 255, 0.22)"
                  strokeDasharray="3 3"
                />

                {/* Lower line: 36.2°C */}
                <line x1={padX} y1={chartH - padBottom} x2={chartW - padX} y2={chartH - padBottom} stroke="rgba(255, 255, 255, 0.06)" />
                <text x={chartW - padX + 2} y={chartH - padBottom + 3} fill="rgba(255, 255, 255, 0.3)" fontSize="8.5" textAnchor="start">36,2°</text>

                {/* Area under curve */}
                {fullCurvePath && (
                  <path
                    d={`${fullCurvePath} L ${pts[pts.length - 1].x.toFixed(1)} ${chartH - padBottom} L ${pts[0].x.toFixed(1)} ${chartH - padBottom} Z`}
                    fill="url(#tempFillGrad)"
                  />
                )}

                {/* 1. REAL MEASURED LINE: Solid White for past/current days */}
                {measuredCurvePath ? (
                  <path
                    d={measuredCurvePath}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                ) : (
                  <circle cx={pts[0].x} cy={pts[0].y} r="3" fill="#FFFFFF" />
                )}

                {/* Measured Day Points */}
                {measuredPts.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r="2.5"
                    fill="#FFFFFF"
                  />
                ))}

                {/* 2. FUTURE DAYS PROJECTION: Subtle Dashed Line */}
                {projectedCurvePath && (
                  <path
                    d={projectedCurvePath}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.45)"
                    strokeWidth="1.8"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                  />
                )}

                {/* Ovulation marker pin */}
                <line
                  x1={ovuCoord.x}
                  y1={padTop}
                  x2={ovuCoord.x}
                  y2={chartH - padBottom}
                  stroke="#FFD60A"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.6"
                />

                {/* Active day vertical cursor */}
                <line
                  x1={activeCoord.x}
                  y1={padTop - 6}
                  x2={activeCoord.x}
                  y2={chartH - padBottom + 4}
                  stroke={isDraggingChart ? "#FFFFFF" : "rgba(255, 255, 255, 0.45)"}
                  strokeWidth={isDraggingChart ? "2" : "1.5"}
                  strokeDasharray="2 2"
                />

                {/* Active Day Point Halo & Circle */}
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.y}
                  r={isDraggingChart ? "11" : "8"}
                  fill={currentInfo.color}
                  opacity={isDraggingChart ? "0.6" : "0.35"}
                />
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.y}
                  r={isDraggingChart ? "5.5" : "4.5"}
                  fill="#FFFFFF"
                  stroke={currentInfo.color}
                  strokeWidth="2.5"
                />
              </svg>

              {/* Floating Pill on Active Point */}
              <div
                style={{
                  position: 'absolute',
                  left: `${(activeCoord.x / chartW) * 100}%`,
                  top: `${Math.max(14, activeCoord.y - 18)}px`,
                  transform: `translate(-50%, -50%) scale(${isDraggingChart ? 1.08 : 1})`,
                  background: 'rgba(0, 0, 0, 0.9)',
                  border: `1px solid ${isDraggingChart ? '#FFFFFF' : currentInfo.color}`,
                  borderRadius: '999px',
                  padding: '2px 8px',
                  fontSize: '9.5px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.6)',
                  transition: isDraggingChart ? 'none' : 'transform 120ms ease',
                }}
              >
                {`J${selectedCycleDay} · ${selectedPoint.temp.toFixed(2)} °C`}
              </div>
            </div>

            {/* X-Axis Cycle Days Timeline */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0 6px',
                fontSize: '10px',
                color: 'var(--text-tertiary)',
                fontWeight: 600,
                marginTop: '-4px',
              }}
            >
              <span style={{ color: selectedCycleDay <= 5 ? '#FFFFFF' : 'inherit', fontWeight: selectedCycleDay <= 5 ? 700 : 500 }}>
                {isEn ? 'D1 Period' : 'J1 Règles'}
              </span>
              <span>J7</span>
              <span style={{ color: isOvulationWindow ? '#FFD60A' : '#E5C100', fontWeight: 700 }}>
                {isEn ? 'D14 Ovulation' : 'J14 Ovulation ✨'}
              </span>
              <span>J21</span>
              <span style={{ color: selectedCycleDay >= 26 ? '#FFFFFF' : 'inherit', fontWeight: selectedCycleDay >= 26 ? 700 : 500 }}>
                {isEn ? `D${cycleLength} End` : `J${cycleLength} Fin`}
              </span>
            </div>

            {/* Legend: Real Measurement vs Projection */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '14px',
                fontSize: '9.5px',
                color: 'var(--text-secondary)',
                marginTop: '1px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '12px', height: '2.5px', background: '#FFFFFF', borderRadius: '2px' }} />
                <span style={{ color: '#FFFFFF', fontWeight: 600 }}>
                  {isEn ? 'Measured by Ring' : 'Mesuré par la bague'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '12px', height: '0', borderTop: '2px dashed rgba(255, 255, 255, 0.5)' }} />
                <span>
                  {isEn ? 'Forecast model' : 'Projection théorique'}
                </span>
              </div>
            </div>

            {/* Explanatory Context Note: What does this mean? */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '14px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={13} color="#30D158" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF' }}>
                  {selectedCycleDay <= computedCycleDay
                    ? (isEn ? `Day ${selectedCycleDay} · Measured Night Reading` : `Jour ${selectedCycleDay} · Donnée réelle mesurée par la bague`)
                    : (isEn ? `Day ${selectedCycleDay} · Forecasted Day` : `Jour ${selectedCycleDay} · Projection théorique (jour futur)`)}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.45 }}>
                {selectedCycleDay <= computedCycleDay
                  ? (isEn
                      ? `The solid white line shows your actual night temperature (${selectedPoint.temp.toFixed(2)}°C). The dashed curve ahead illustrates the expected cycle trajectory until your period.`
                      : `La ligne blanche continue correspond aux vraies mesures de la bague (${selectedPoint.temp.toFixed(2)} °C). Les pointillés à venir montrent la trajectoire thermique attendue pour votre cycle.`)
                  : (isEn
                      ? `This night has not happened yet! The dashed curve is a reference model: your Vyta ring will record and replace it with your true biological temperature after each night's sleep.`
                      : `Cette nuit n'a pas encore eu lieu ! Les pointillés représentent le modèle de référence : votre bague Vyta One y inscrira votre vraie température biologique au réveil chaque matin.`)}
              </p>
            </div>
          </div>
        );
      })()}

      {/* 8. Hormonal Vitality & Workout Prescription */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(43, 4, 4, 0.5) 0%, rgba(20, 2, 2, 0.7) 100%)',
          border: '1.5px solid #2b0404',
          borderRadius: '20px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginTop: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Flame size={14} color="#C44558" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>
            {isEn ? 'Training & Recovery Guidance' : 'Conseil Entraînement & Récupération'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.45 }}>
          {isEn ? currentInfo.adviceEn : currentInfo.adviceFr}
        </p>
      </div>
    </div>
  );
};
