import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flame, Footprints, MapPin, RefreshCw, SlidersHorizontal, Target, Timer, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { emptyDayMetrics, weekMetrics } from '../data/health';
import { fmtNum } from '../lib/format';
import { qringBle } from '../lib/qringBleService';
import { WeekSelector } from './WeekSelector';

export const STEPS_GOAL_STORAGE_KEY = 'vyta_steps_goal';
export const DEFAULT_STEPS_GOAL = 10000;

export function readStoredStepsGoal(): number {
  if (typeof window === 'undefined') return DEFAULT_STEPS_GOAL;
  try {
    const raw = Number(localStorage.getItem(STEPS_GOAL_STORAGE_KEY));
    if (Number.isFinite(raw) && raw >= 1000 && raw <= 50000) return Math.round(raw);
  } catch (_) {}
  return DEFAULT_STEPS_GOAL;
}

const GOAL_PRESETS = [6000, 8000, 10000, 12000, 15000];

export const StepsTabView: React.FC = () => {
  const {
    language,
    weekData,
    selectedDay,
    setSelectedDay,
    weekDays,
    weekOffset,
    todayIndex,
    ring,
    profile,
    cardThemeMode,
    isFirstLaunch,
  } = useApp();

  const isEn = language === 'en';
  const isMono = cardThemeMode === 'monochrome';
  const isToday = weekOffset === 0 && selectedDay === todayIndex;

  const [goal, setGoal] = useState<number>(() => readStoredStepsGoal());
  const [editingGoal, setEditingGoal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const dayData =
    (weekData && weekData[selectedDay]) ||
    (isFirstLaunch ? emptyDayMetrics : weekMetrics[selectedDay] || emptyDayMetrics);

  const steps = Math.max(0, Math.round(dayData?.steps || 0));
  const activeKcal = steps > 0 ? Math.max(1, Math.round(dayData?.activeKcal || steps * 0.04)) : 0;

  // Real ring distance if reported; otherwise derive from user's height-calibrated stride
  const strideMeters = Math.max(0.55, Math.min(0.95, ((profile?.heightCm || 175) * 0.415) / 100));
  const hasRealDistance = typeof dayData?.distanceKm === 'number' && dayData.distanceKm > 0;
  const displayDistanceKm = hasRealDistance ? dayData.distanceKm : (steps * strideMeters) / 1000;
  const estActiveMin = steps > 0 ? Math.max(1, Math.round(steps / 95)) : 0;

  const pct = goal > 0 ? Math.min(100, Math.round((steps / goal) * 100)) : 0;
  const remaining = Math.max(0, goal - steps);
  const goalReached = steps >= goal && goal > 0;

  const hourly = useMemo(() => {
    if (Array.isArray(dayData?.stepsHourly) && dayData.stepsHourly.length === 24) {
      return dayData.stepsHourly.map((v) => (typeof v === 'number' && v > 0 ? Math.round(v) : 0));
    }
    return new Array(24).fill(0);
  }, [dayData?.stepsHourly]);

  const hasHourlyData = hourly.some((v) => v > 0);
  const maxHourly = Math.max(100, ...hourly);
  const peakHourIdx = hasHourlyData ? hourly.indexOf(Math.max(...hourly)) : -1;

  const autoFetchedKeyRef = useRef<string | null>(null);
  const [checkedHourlyOnce, setCheckedHourlyOnce] = useState(false);

  useEffect(() => {
    setSelectedHour(null);
    setCheckedHourlyOnce(false);
  }, [selectedDay, weekOffset]);

  useEffect(() => {
    if (hasHourlyData) return;
    if (!ring.isConnected || !qringBle.isConnected()) return;
    if (weekOffset !== 0 || selectedDay > todayIndex) return;
    const key = `${weekOffset}-${selectedDay}`;
    if (autoFetchedKeyRef.current === key) return;
    autoFetchedKeyRef.current = key;
    const dayOffset = Math.max(0, todayIndex - selectedDay);
    setSyncing(true);
    qringBle
      .requestStepsData(dayOffset)
      .catch(() => false)
      .finally(() => {
        setSyncing(false);
        setCheckedHourlyOnce(true);
      });
  }, [hasHourlyData, ring.isConnected, selectedDay, weekOffset, todayIndex]);

  const weeklyStats = useMemo(() => {
    const items = weekDays.map((d, idx) => {
      const m = weekData && weekData[idx];
      const isFuture = weekOffset === 0 && idx > todayIndex;
      const val = isFuture ? 0 : Math.max(0, Math.round(m?.steps || 0));
      return {
        idx,
        short: isEn ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'][idx] : d.short,
        long: d.long,
        steps: val,
        isFuture,
        isSelected: idx === selectedDay,
        isToday: weekOffset === 0 && idx === todayIndex,
      };
    });
    const totalWeek = items.reduce((sum, d) => sum + d.steps, 0);
    const activeDays = items.filter((d) => d.steps > 0);
    const avgWeek = activeDays.length > 0 ? Math.round(totalWeek / activeDays.length) : 0;
    const maxWeek = Math.max(goal, ...items.map((d) => d.steps));
    return { items, totalWeek, avgWeek, maxWeek };
  }, [weekDays, weekData, weekOffset, todayIndex, selectedDay, isEn, goal]);

  const updateGoal = (nextGoal: number) => {
    const clamped = Math.max(1000, Math.min(50000, Math.round(nextGoal / 500) * 500));
    setGoal(clamped);
    try {
      localStorage.setItem(STEPS_GOAL_STORAGE_KEY, String(clamped));
      window.dispatchEvent(new CustomEvent('vyta:steps-goal-changed', { detail: clamped }));
    } catch (_) {}
  };

  const handleSyncSteps = async () => {
    if (syncing || !isToday) return;
    setSyncing(true);
    setSyncSuccess(false);
    try {
      const ok = await qringBle.requestStepsData(0);
      setCheckedHourlyOnce(true);
      if (ok) {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 1800);
      }
    } finally {
      setSyncing(false);
    }
  };

  const accent = isMono ? '#FAF7F2' : goalReached ? '#30D158' : '#FB923C';
  const accentSoft = isMono ? 'rgba(255, 255, 255, 0.14)' : goalReached ? 'rgba(48, 209, 88, 0.16)' : 'rgba(251, 146, 60, 0.16)';
  const accentBorder = isMono ? 'rgba(255, 255, 255, 0.32)' : goalReached ? 'rgba(48, 209, 88, 0.45)' : 'rgba(251, 146, 60, 0.45)';

  // SVG Ring Geometry
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);

  const selectedDayLabel = isToday
    ? isEn
      ? 'Today'
      : "Aujourd'hui"
    : `${weekDays[selectedDay]?.long || ''} ${weekDays[selectedDay]?.date || ''}`.trim();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '20px' }}>
      <WeekSelector />

      {/* 1. HERO STEPS RING CARD */}
      <div
        style={{
          position: 'relative',
          padding: '18px 16px 16px 16px',
          borderRadius: '26px',
          background: isMono
            ? 'radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.08), rgba(10, 10, 12, 0.96) 75%)'
            : 'radial-gradient(ellipse at 50% 0%, rgba(251, 146, 60, 0.22), rgba(234, 88, 12, 0.06) 45%, rgba(10, 10, 12, 0.96) 80%)',
          border: `1px solid ${isMono ? 'rgba(255, 255, 255, 0.14)' : 'rgba(251, 146, 60, 0.3)'}`,
          boxShadow: '0 14px 32px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {/* Top Row: Day Label + Sync Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '10px',
                background: accentSoft,
                border: `1px solid ${accentBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Footprints size={15} color={accent} />
            </div>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#FAF7F2' }}>
                {isEn ? `Steps · ${selectedDayLabel}` : `Pas · ${selectedDayLabel}`}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)' }}>
                {ring.isConnected
                  ? isEn
                    ? 'Aurel Ring connected'
                    : 'Aurel Ring connectée'
                  : isEn
                  ? 'Ring offline (cached)'
                  : 'Bague hors ligne'}
              </div>
            </div>
          </div>

          {isToday && (
            <button
              type="button"
              onClick={handleSyncSteps}
              disabled={syncing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 11px',
                borderRadius: '999px',
                border: `1px solid ${ring.isConnected ? accentBorder : 'rgba(255, 255, 255, 0.16)'}`,
                background: ring.isConnected ? accentSoft : 'rgba(255, 255, 255, 0.06)',
                color: '#FAF7F2',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: syncing ? 'wait' : 'pointer',
              }}
            >
              {syncSuccess ? (
                <Check size={13} color="#30D158" />
              ) : (
                <RefreshCw
                  size={13}
                  color={ring.isConnected ? accent : 'currentColor'}
                  style={syncing ? { animation: 'spin 0.9s linear infinite' } : undefined}
                />
              )}
              <span>{syncSuccess ? (isEn ? 'Synced' : 'À jour') : isEn ? 'Sync' : 'Actualiser'}</span>
            </button>
          )}
        </div>

        {/* Center Radial Progress Gauge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 0 8px 0' }}>
          <div style={{ position: 'relative', width: '184px', height: '184px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="184" height="184" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
              <defs>
                <linearGradient id="stepsArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={isMono ? '#FFFFFF' : goalReached ? '#30D158' : '#F97316'} />
                  <stop offset="100%" stopColor={isMono ? 'rgba(255,255,255,0.65)' : goalReached ? '#6EE7B7' : '#FBBF24'} />
                </linearGradient>
              </defs>
              <circle
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="12"
              />
              <circle
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke="url(#stepsArcGrad)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{
                  transition: 'stroke-dashoffset 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
                  filter: isMono
                    ? 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.35))'
                    : `drop-shadow(0 0 10px ${goalReached ? 'rgba(48, 209, 88, 0.5)' : 'rgba(251, 146, 60, 0.5)'})`,
                }}
              />
            </svg>

            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '36px',
                  fontWeight: 300,
                  color: '#FAF7F2',
                  letterSpacing: '-1.2px',
                  lineHeight: 1.05,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtNum(steps)}
              </span>
              <span style={{ fontSize: '12px', color: 'rgba(250, 247, 242, 0.55)', fontWeight: 500, marginTop: '2px' }}>
                {isEn ? `of ${fmtNum(goal)} steps` : `sur ${fmtNum(goal)} pas`}
              </span>
              <span
                style={{
                  marginTop: '6px',
                  padding: '2px 9px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: accentSoft,
                  border: `1px solid ${accentBorder}`,
                  color: accent,
                }}
              >
                {pct}%
              </span>
            </div>
          </div>

          {/* Goal Summary + Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontSize: '12px', color: goalReached ? '#30D158' : 'rgba(250, 247, 242, 0.72)', fontWeight: 600 }}>
              {goalReached
                ? isEn
                  ? 'Daily goal reached'
                  : 'Objectif quotidien atteint'
                : isEn
                ? `${fmtNum(remaining)} steps remaining`
                : `Encore ${fmtNum(remaining)} pas avant l'objectif`}
            </span>
            <button
              type="button"
              onClick={() => setEditingGoal((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 9px',
                borderRadius: '999px',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                background: editingGoal ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.06)',
                color: '#FAF7F2',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <SlidersHorizontal size={11} />
              <span>{isEn ? 'Goal' : 'Objectif'}</span>
            </button>
          </div>

          {editingGoal && (
            <div
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '10px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.75)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Target size={12} color={accent} />
                  {isEn ? 'Daily step goal' : 'Objectif quotidien'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => updateGoal(goal - 500)}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.14)',
                      background: 'rgba(255,255,255,0.06)',
                      color: '#FAF7F2',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    −
                  </button>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#FAF7F2', minWidth: '56px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtNum(goal)}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateGoal(goal + 500)}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.14)',
                      background: 'rgba(255,255,255,0.06)',
                      color: '#FAF7F2',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {GOAL_PRESETS.map((preset) => {
                  const active = goal === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => updateGoal(preset)}
                      style={{
                        flex: 1,
                        minWidth: '52px',
                        padding: '6px 4px',
                        borderRadius: '10px',
                        border: `1px solid ${active ? accentBorder : 'rgba(255, 255, 255, 0.1)'}`,
                        background: active ? accentSoft : 'rgba(255, 255, 255, 0.04)',
                        color: active ? accent : 'rgba(250, 247, 242, 0.72)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {fmtNum(preset)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. 3 REAL METRIC TILES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        <div
          style={{
            padding: '12px 10px',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)' }}>
            <Flame size={13} color={isMono ? '#FAF7F2' : '#FB923C'} />
            <span>{isEn ? 'Calories' : 'Calories'}</span>
          </div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: '#FAF7F2', fontVariantNumeric: 'tabular-nums' }}>
            {activeKcal > 0 ? `${fmtNum(activeKcal)}` : '0'}{' '}
            <span style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(250, 247, 242, 0.55)' }}>kcal</span>
          </div>
        </div>

        <div
          style={{
            padding: '12px 10px',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)' }}>
            <MapPin size={13} color={isMono ? '#FAF7F2' : '#38BDF8'} />
            <span>{isEn ? 'Distance' : 'Distance'}</span>
          </div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: '#FAF7F2', fontVariantNumeric: 'tabular-nums' }}>
            {displayDistanceKm > 0 ? displayDistanceKm.toFixed(2) : '0.00'}{' '}
            <span style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(250, 247, 242, 0.55)' }}>
              {hasRealDistance || steps === 0 ? 'km' : 'km~'}
            </span>
          </div>
        </div>

        <div
          style={{
            padding: '12px 10px',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)' }}>
            <Timer size={13} color={isMono ? '#FAF7F2' : '#30D158'} />
            <span>{isEn ? 'Active' : 'Actif'}</span>
          </div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: '#FAF7F2', fontVariantNumeric: 'tabular-nums' }}>
            {estActiveMin > 0 ? `~${estActiveMin}` : '0'}{' '}
            <span style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(250, 247, 242, 0.55)' }}>min</span>
          </div>
        </div>
      </div>

      {/* 3. HOURLY STEPS CHART (00h–23h) */}
      <div
        style={{
          padding: '16px',
          borderRadius: '22px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#FAF7F2' }}>
              {isEn ? 'Hourly distribution' : 'Répartition par heure'}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)' }}>
              {selectedHour !== null && hourly[selectedHour] > 0
                ? `${String(selectedHour).padStart(2, '0')}h–${String((selectedHour + 1) % 24).padStart(2, '0')}h · ${fmtNum(hourly[selectedHour])} ${isEn ? 'steps' : 'pas'}`
                : peakHourIdx >= 0
                ? isEn
                  ? `Peak: ${String(peakHourIdx).padStart(2, '0')}h (${fmtNum(hourly[peakHourIdx])} steps)`
                  : `Pic à ${String(peakHourIdx).padStart(2, '0')}h (${fmtNum(hourly[peakHourIdx])} pas)`
                : isEn
                ? '00h – 23h'
                : '00h – 23h'}
            </div>
          </div>
        </div>

        {hasHourlyData ? (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(24, minmax(0, 1fr))',
                alignItems: 'end',
                gap: '3px',
                height: '104px',
                paddingTop: '8px',
              }}
            >
              {hourly.map((val, h) => {
                const barPct = val > 0 ? Math.max(8, Math.round((val / maxHourly) * 100)) : 3;
                const isSel = selectedHour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSelectedHour(isSel ? null : h)}
                    aria-label={`${h}h: ${val} pas`}
                    style={{
                      height: '100%',
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      display: 'flex',
                      alignItems: 'flex-end',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: `${barPct}%`,
                        borderRadius: '4px 4px 2px 2px',
                        background:
                          val > 0
                            ? isSel
                              ? '#FFFFFF'
                              : isMono
                              ? 'rgba(255, 255, 255, 0.78)'
                              : 'linear-gradient(180deg, #FBBF24 0%, #F97316 100%)'
                            : 'rgba(255, 255, 255, 0.07)',
                        boxShadow: isSel ? `0 0 10px ${accent}` : undefined,
                        transition: 'height 0.25s ease',
                      }}
                    />
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'rgba(250, 247, 242, 0.45)', fontFamily: 'var(--font-mono)' }}>
              <span>00h</span>
              <span>06h</span>
              <span>12h</span>
              <span>18h</span>
              <span>23h</span>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '16px 12px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              fontSize: '12px',
              color: 'rgba(250, 247, 242, 0.58)',
              textAlign: 'center',
              lineHeight: 1.45,
            }}
          >
            {steps > 0
              ? checkedHourlyOnce
                ? isEn
                  ? `${fmtNum(steps)} total steps synced for this day. This ring firmware stores the daily cumulative count only (no 15-min hourly blocks sent for this day).`
                  : `${fmtNum(steps)} pas synchronisés pour ce jour. Ce firmware ne renvoie que le total cumulé (aucun bloc 15 min envoyé pour cette journée).`
                : isEn
                ? `${fmtNum(steps)} total steps recorded. Syncing hourly blocks from the ring...`
                : `${fmtNum(steps)} pas enregistrés au total. Récupération des blocs 15 min depuis la bague...`
              : isEn
              ? 'No steps detected yet for this day. Walk naturally for ~15s while wearing your ring.'
              : 'Aucun pas détecté pour cette journée. Marchez quelques secondes bague au doigt puis synchronisez.'}
          </div>
        )}
      </div>

      {/* 4. WEEKLY STEPS SUMMARY (L M M J V S D) */}
      <div
        style={{
          padding: '16px',
          borderRadius: '22px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#FAF7F2' }}>
              {isEn ? 'This week' : 'Bilan de la semaine'}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)' }}>
              {isEn
                ? `Total ${fmtNum(weeklyStats.totalWeek)} · Avg ${fmtNum(weeklyStats.avgWeek)}/d`
                : `Total ${fmtNum(weeklyStats.totalWeek)} · Moy. ${fmtNum(weeklyStats.avgWeek)}/j`}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px', alignItems: 'end', height: '108px', paddingTop: '10px' }}>
          {weeklyStats.items.map((d) => {
            const barH = d.steps > 0 ? Math.max(10, Math.round((d.steps / weeklyStats.maxWeek) * 100)) : 4;
            const hitGoal = d.steps >= goal;
            return (
              <button
                key={d.idx}
                type="button"
                disabled={d.isFuture}
                onClick={() => !d.isFuture && setSelectedDay(d.idx)}
                style={{
                  height: '100%',
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '6px',
                  cursor: d.isFuture ? 'default' : 'pointer',
                  opacity: d.isFuture ? 0.35 : 1,
                }}
              >
                <span style={{ fontSize: '9.5px', fontWeight: 600, color: d.isSelected ? '#FAF7F2' : 'rgba(250, 247, 242, 0.5)', fontVariantNumeric: 'tabular-nums' }}>
                  {d.steps > 0 ? (d.steps >= 1000 ? `${(d.steps / 1000).toFixed(1)}k` : d.steps) : '—'}
                </span>
                <div style={{ width: '100%', height: '66px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <div
                    style={{
                      width: '18px',
                      height: `${barH}%`,
                      borderRadius: '7px 7px 4px 4px',
                      background:
                        d.steps > 0
                          ? hitGoal && !isMono
                            ? 'linear-gradient(180deg, #34D399 0%, #10B981 100%)'
                            : isMono
                            ? 'rgba(255, 255, 255, 0.8)'
                            : 'linear-gradient(180deg, #FBBF24 0%, #F97316 100%)'
                          : 'rgba(255, 255, 255, 0.08)',
                      border: d.isSelected ? '1.5px solid #FFFFFF' : '1px solid transparent',
                      transition: 'height 0.3s ease',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: d.isSelected || d.isToday ? 800 : 600,
                    color: d.isSelected ? accent : d.isToday ? '#FAF7F2' : 'rgba(250, 247, 242, 0.55)',
                  }}
                >
                  {d.short}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
