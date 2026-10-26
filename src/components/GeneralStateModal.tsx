import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { weekMetrics, WEEK, TODAY_INDEX, statusFor, emptyDayMetrics } from '../data/health';
import { useModalAnimation } from '../hooks/useModalAnimation';
import {
  Sparkles,
  X,
  TrendingUp,
  TrendingDown,
  Calendar,
  ShieldCheck,
  Moon,
  Activity,
  Heart,
  Zap,
  Info,
  ChevronRight,
} from 'lucide-react';

interface GeneralStateModalProps {
  onClose: () => void;
}

export const GeneralStateModal: React.FC<GeneralStateModalProps> = ({ onClose }) => {
  const { selectedDay, setSelectedDay, language, weekData, isFirstLaunch } = useApp();
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const isEn = language === 'en';

  // Active day data
  const [inspectedDay, setInspectedDay] = useState<number>(selectedDay);
  const activeDayIndex = inspectedDay;
  const activeData = (weekData && weekData[activeDayIndex]) || (isFirstLaunch ? emptyDayMetrics : (weekMetrics[activeDayIndex] || weekMetrics[TODAY_INDEX]));
  const activeScore = activeData.score;

  // Recorded days (days with data up to today)
  const recordedDays = (weekData || weekMetrics).slice(0, TODAY_INDEX + 1);
  const recordedScores = recordedDays.map((d) => d.score);
  const avgScore =
    recordedScores.length > 0
      ? Math.round(recordedScores.reduce((a, b) => a + b, 0) / recordedScores.length)
      : 86;

  // Best day in the week
  const maxScore = Math.max(...recordedScores);
  const bestDayIndex = recordedScores.indexOf(maxScore);
  const bestDayName = WEEK[bestDayIndex]?.long || (isEn ? 'Thursday' : 'Jeudi');

  // Difference vs yesterday
  const prevScore = activeDayIndex > 0 ? (weekMetrics[activeDayIndex - 1]?.score || activeScore) : activeScore;
  const diffYesterday = activeDayIndex > 0 ? activeScore - prevScore : 0;

  // Difference vs weekly average
  const diffAvg = activeScore - avgScore;

  // Pillar drivers differences vs yesterday
  const prevPillars = activeDayIndex > 0 ? weekMetrics[activeDayIndex - 1]?.pillars : activeData.pillars;
  const sleepDiff = activeData.pillars.sleep - prevPillars.sleep;
  const recoveryDiff = activeData.pillars.recovery - prevPillars.recovery;
  const activityDiff = activeData.pillars.activity - prevPillars.activity;

  return (
    <div
      className={`modal-backdrop ${isClosing ? 'is-closing' : ''}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`modal-sheet ${isClosing ? 'is-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background:
            '#0D0D10',
          borderTop: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 -24px 60px rgba(0, 0, 0, 0.95)',
          maxHeight: '92%',
          padding: '14px 18px 40px 18px',
          gap: '16px',
        }}
      >
        {/* Grabber */}
        <div
          style={{
            width: '38px',
            height: '4.5px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.22)',
            margin: '0 auto 4px auto',
          }}
        />

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'rgba(217, 249, 112, 0.16)',
                border: '1px solid rgba(217, 249, 112, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 12px rgba(217, 249, 112, 0.3)',
              }}
            >
              <Sparkles size={16} color="#D9F970" />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#FAF7F2', margin: 0 }}>
                {isEn ? 'General State & Vitality' : 'État Général & Vitalité'}
              </h2>
              <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.65)' }}>
                {isEn ? 'Weekly score differences & dynamics' : 'Écarts et dynamique de la note hebdomadaire'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            aria-label={isEn ? 'Close' : 'Fermer'}
          >
            <X size={16} />
          </button>
        </div>

        {/* ====================================================================
            1. HERO SCORE & KEY DIFFERENCES
            ==================================================================== */}
        <div
          style={{
            position: 'relative',
            padding: '18px 20px',
            borderRadius: '22px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(217, 249, 112, 0.3)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflow: 'hidden',
          }}
        >
          {/* Day Label Tag */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'rgba(250, 247, 242, 0.7)',
              }}
            >
              {WEEK[activeDayIndex]?.long} {WEEK[activeDayIndex]?.date}
              {activeDayIndex === TODAY_INDEX && (isEn ? ' · Today' : " · Aujourd'hui")}
            </span>

            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: '999px',
                background: 'rgba(217, 249, 112, 0.16)',
                color: '#D9F970',
                border: '1px solid rgba(217, 249, 112, 0.4)',
              }}
            >
              {isFirstLaunch || activeScore === 0 ? (isEn ? 'Waiting for data' : 'En attente de données') : statusFor(activeScore)}
            </span>
          </div>

          {/* Large Numeral + Main Status */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span
              style={{
                fontSize: '48px',
                fontWeight: 300,
                color: '#FAF7F2',
                lineHeight: 1,
                letterSpacing: '-1.5px',
              }}
            >
              {activeScore}
            </span>
            <span style={{ fontSize: '18px', fontWeight: 300, color: 'rgba(250, 247, 242, 0.5)' }}>
              / 100
            </span>
          </div>

          {/* Comparative Metrics Chips Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              paddingTop: '10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {/* vs Yesterday */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.035)',
                borderRadius: '12px',
                padding: '8px 10px',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.55)', display: 'block' }}>
                {isEn ? 'vs Yesterday' : 'vs Hier'}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color:
                    activeDayIndex === 0
                      ? 'rgba(250, 247, 242, 0.7)'
                      : diffYesterday >= 0
                      ? '#30D158'
                      : '#FF453A',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  marginTop: '2px',
                }}
              >
                {activeDayIndex === 0 ? (
                  'Base'
                ) : (
                  <>
                    {diffYesterday >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {diffYesterday >= 0 ? `+${diffYesterday}` : diffYesterday} pts
                  </>
                )}
              </span>
            </div>

            {/* vs Weekly Average */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.035)',
                borderRadius: '12px',
                padding: '8px 10px',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.55)', display: 'block' }}>
                {isEn ? 'vs Weekly Avg' : 'vs Moy. Semaine'}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: diffAvg >= 0 ? '#30D158' : '#FF453A',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  marginTop: '2px',
                }}
              >
                {diffAvg >= 0 ? `+${diffAvg}` : diffAvg} pts
              </span>
            </div>

            {/* Week Benchmark Avg */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.035)',
                borderRadius: '12px',
                padding: '8px 10px',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.55)', display: 'block' }}>
                {isEn ? 'Weekly Avg' : 'Moyenne (7j)'}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#FAF7F2',
                  display: 'block',
                  marginTop: '2px',
                }}
              >
                {avgScore} / 100
              </span>
            </div>
          </div>
        </div>

        {/* ====================================================================
            2. INTERACTIVE WEEKLY SCORE DIFFERENCE CHART
            ==================================================================== */}
        <div
          style={{
            padding: '16px 16px 14px 16px',
            borderRadius: '22px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#FAF7F2' }}>
              {isEn ? 'Weekly Score Progression' : 'Évolution des notes sur la semaine'}
            </span>
            <span style={{ fontSize: '11px', color: '#D9F970', fontWeight: 600 }}>
              {isEn ? `Peak : ${bestDayName} (${maxScore})` : `Pic : ${bestDayName} (${maxScore})`}
            </span>
          </div>

          {/* Bar Chart Container */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '6px',
              height: '140px',
              alignItems: 'flex-end',
              position: 'relative',
              paddingTop: '20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* Horizontal benchmark line for Weekly Average */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `${(avgScore / 100) * 110}px`,
                borderTop: '1px dashed rgba(217, 249, 112, 0.45)',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  right: '2px',
                  top: '-15px',
                  fontSize: '8.5px',
                  fontWeight: 600,
                  color: '#D9F970',
                  background: 'rgba(10, 10, 12, 0.85)',
                  padding: '1px 4px',
                  borderRadius: '4px',
                }}
              >
                {isEn ? `Avg ${avgScore}` : `Moy. ${avgScore}`}
              </span>
            </div>

            {WEEK.map((w, idx) => {
              const dayMetricsData = weekMetrics[idx];
              const score = dayMetricsData?.score || 0;
              const hasData = score > 0;
              const isSelected = idx === activeDayIndex;
              const isCurrentDay = idx === TODAY_INDEX;

              // Difference vs day before
              const pScore = idx > 0 ? (weekMetrics[idx - 1]?.score || score) : score;
              const diffVsPrev = idx > 0 ? score - pScore : 0;

              // Height in px (max 105px)
              const barHeight = hasData ? Math.max(20, Math.round((score / 100) * 105)) : 6;

              return (
                <div
                  key={w.date}
                  onClick={() => {
                    if (hasData) {
                      setInspectedDay(idx);
                      setSelectedDay(idx);
                    }
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    height: '100%',
                    justifyContent: 'flex-end',
                    cursor: hasData ? 'pointer' : 'default',
                    opacity: hasData ? 1 : 0.25,
                    zIndex: 2,
                  }}
                >
                  {/* Score Number Above Bar */}
                  {hasData && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: isSelected ? 800 : 600,
                        color: isSelected ? '#D9F970' : '#FAF7F2',
                        lineHeight: 1,
                        marginBottom: '2px',
                      }}
                    >
                      {score}
                    </span>
                  )}

                  {/* The Vertical Bar */}
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '28px',
                      height: `${barHeight}px`,
                      borderRadius: '6px 6px 2px 2px',
                      background: !hasData
                        ? 'rgba(255, 255, 255, 0.08)'
                        : isSelected
                        ? 'linear-gradient(180deg, #D9F970 0%, #A3E635 100%)'
                        : isCurrentDay
                        ? 'linear-gradient(180deg, rgba(217, 249, 112, 0.7) 0%, rgba(163, 230, 53, 0.5) 100%)'
                        : 'linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.12) 100%)',
                      boxShadow: isSelected
                        ? '0 0 16px rgba(217, 249, 112, 0.65)'
                        : 'none',
                      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />

                  {/* Day Letter */}
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#D9F970' : 'rgba(250, 247, 242, 0.65)',
                      marginTop: '4px',
                    }}
                  >
                    {w.short}
                  </span>

                  {/* Diff Tag vs Previous Day */}
                  {hasData && idx > 0 ? (
                    <span
                      style={{
                        fontSize: '8.5px',
                        fontWeight: 700,
                        color: diffVsPrev >= 0 ? '#30D158' : '#FF453A',
                        lineHeight: 1,
                      }}
                    >
                      {diffVsPrev >= 0 ? `+${diffVsPrev}` : diffVsPrev}
                    </span>
                  ) : hasData ? (
                    <span style={{ fontSize: '8.5px', color: 'rgba(250, 247, 242, 0.35)' }}>-</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* ====================================================================
            3. DAILY COMPARISON MATRIX (Différence jour par jour)
            ==================================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#FAF7F2' }}>
            {isEn ? 'Daily Score Breakdown & Variations' : 'Comparaison détaillée par rapport aux autres jours'}
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recordedDays.map((d, idx) => {
              const diffFromActive = d.score - activeScore;
              const isCurrentRow = idx === activeDayIndex;

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setInspectedDay(idx);
                    setSelectedDay(idx);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '14px',
                    background: isCurrentRow
                      ? 'rgba(217, 249, 112, 0.12)'
                      : 'rgba(255, 255, 255, 0.035)',
                    border: isCurrentRow
                      ? '1px solid rgba(217, 249, 112, 0.35)'
                      : '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Left: Day & Date */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        background: isCurrentRow ? '#D9F970' : 'rgba(255, 255, 255, 0.08)',
                        color: isCurrentRow ? '#0A0A0C' : '#FAF7F2',
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {WEEK[idx]?.short}
                    </div>

                    <div>
                      <span
                        style={{
                          fontSize: '12.5px',
                          fontWeight: isCurrentRow ? 700 : 500,
                          color: '#FAF7F2',
                          display: 'block',
                        }}
                      >
                        {WEEK[idx]?.long} {WEEK[idx]?.date}
                        {idx === TODAY_INDEX && (isEn ? ' (Today)' : " (Aujourd'hui)")}
                      </span>
                      <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.5)' }}>
                        {statusFor(d.score)} · Sommeil {d.pillars.sleep} · VRC {d.pillars.recovery}
                      </span>
                    </div>
                  </div>

                  {/* Right: Score + Gap vs Active Day */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: '6px',
                        background:
                          isCurrentRow
                            ? 'rgba(217, 249, 112, 0.2)'
                            : diffFromActive >= 0
                            ? 'rgba(48, 209, 88, 0.15)'
                            : 'rgba(255, 69, 58, 0.15)',
                        color:
                          isCurrentRow
                            ? '#D9F970'
                            : diffFromActive >= 0
                            ? '#30D158'
                            : '#FF453A',
                      }}
                    >
                      {isCurrentRow
                        ? (isEn ? 'Active Day' : 'Jour actif')
                        : diffFromActive >= 0
                        ? `+${diffFromActive} pts`
                        : `${diffFromActive} pts`}
                    </span>

                    <span
                      style={{
                        fontSize: '16px',
                        fontWeight: 400,
                        color: '#FAF7F2',
                        minWidth: '32px',
                        textAlign: 'right',
                      }}
                    >
                      {d.score}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ====================================================================
            4. THE 3 PILLARS THAT EXPLAIN THE DIFFERENCE
            ==================================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#FAF7F2' }}>
            {isEn ? 'Pillars Driving the Variation' : "Les 3 piliers qui expliquent l'écart"}
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {/* Sleep Pillar */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.035)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: '14px',
                padding: '10px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Moon size={13} color="#A78BFA" />
                <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.7)' }}>
                  {isEn ? 'Sleep' : 'Sommeil'}
                </span>
              </div>
              <span style={{ fontSize: '18px', fontWeight: 400, color: '#FAF7F2' }}>
                {isFirstLaunch || activeScore === 0 ? '--' : activeData.pillars.sleep}
                <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.45)' }}>/100</span>
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: sleepDiff >= 0 ? '#30D158' : '#FF453A',
                }}
              >
                {sleepDiff >= 0 ? `+${sleepDiff}` : sleepDiff} pts vs hier
              </span>
            </div>

            {/* HRV Recovery Pillar */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.035)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: '14px',
                padding: '10px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Activity size={13} color="#38BDF8" />
                <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.7)' }}>
                  {isEn ? 'HRV Recov.' : 'Récup. VRC'}
                </span>
              </div>
              <span style={{ fontSize: '18px', fontWeight: 400, color: '#FAF7F2' }}>
                {isFirstLaunch || activeScore === 0 ? '--' : activeData.pillars.recovery}
                <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.45)' }}>/100</span>
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: recoveryDiff >= 0 ? '#30D158' : '#FF453A',
                }}
              >
                {recoveryDiff >= 0 ? `+${recoveryDiff}` : recoveryDiff} pts vs hier
              </span>
            </div>

            {/* Activity Pillar */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.035)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: '14px',
                padding: '10px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Zap size={13} color="#D9F970" />
                <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.7)' }}>
                  {isEn ? 'Activity' : 'Activité'}
                </span>
              </div>
              <span style={{ fontSize: '18px', fontWeight: 400, color: '#FAF7F2' }}>
                {isFirstLaunch || activeScore === 0 ? '--' : activeData.pillars.activity}
                <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.45)' }}>/100</span>
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: activityDiff >= 0 ? '#30D158' : '#FF453A',
                }}
              >
                {activityDiff >= 0 ? `+${activityDiff}` : activityDiff} pts vs hier
              </span>
            </div>
          </div>
        </div>

        {/* ====================================================================
            5. COVYTA AI BIOMETRIC INSIGHT
            ==================================================================== */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '16px',
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(217, 249, 112, 0.15) 0%, rgba(10, 10, 12, 0.95) 75%), #0A0A0C',
            border: '1px solid rgba(217, 249, 112, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Sparkles size={14} color="#D9F970" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#FAF7F2' }}>
              {isEn ? 'Biometric Insight · Why your score changed' : 'Analyse biométrique · Synthèse de votre écart'}
            </span>
          </div>

          <p style={{ fontSize: '12px', lineHeight: 1.5, color: 'rgba(250, 247, 242, 0.85)', margin: 0 }}>
            {activeScore >= 90
              ? isEn
                ? `Outstanding condition! Your score of ${activeScore}/100 exceeds your weekly average (${avgScore}) by +${diffAvg} points. Deeper restorative sleep (+14 min) and an elevated HRV (74 ms) are the two primary drivers of this positive gap.`
                : `Condition physique remarquable ! Votre note de ${activeScore}/100 dépasse de +${diffAvg} points votre moyenne hebdomadaire (${avgScore}). Un sommeil profond plus réparateur (+14 min) et une VRC élevée (74 ms) expliquent cette excellente progression.`
              : isEn
              ? `Your score of ${activeScore}/100 is ${Math.abs(diffAvg)} points below your weekly average (${avgScore}). Light nocturnal awakenings and lower HRV recovery account for the variation.`
              : `Votre note de ${activeScore}/100 est en retrait de ${Math.abs(diffAvg)} points par rapport à votre moyenne (${avgScore}). Une dette de sommeil léger et une VRC plus basse expliquent cet écart temporaire.`}
          </p>
        </div>
      </div>
    </div>
  );
};
