import React from 'react';
import { useApp } from '../context/AppContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface WeekSelectorProps {
  selectedDay?: number;
  onSelectDay?: (day: number) => void;
}

export const WeekSelector: React.FC<WeekSelectorProps> = ({
  selectedDay: propSelectedDay,
  onSelectDay: propOnSelectDay,
}) => {
  const {
    selectedDay: contextSelectedDay,
    setSelectedDay: contextSetSelectedDay,
    weekOffset,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    weekDays,
    weekRangeLabel,
    t,
    language,
    todayIndex,
  } = useApp();

  const activeSelectedDay = propSelectedDay !== undefined ? propSelectedDay : contextSelectedDay;
  const handleSelectDay = propOnSelectDay || contextSetSelectedDay;

  return (
    <div className="week-selector-wrapper" role="group" aria-label={t('week.selector_label')}>
      {/* Navigation bar with chevron buttons and week title */}
      <div className="week-nav-bar">
        <button
          type="button"
          className="week-nav-chevron-btn"
          onClick={goToPreviousWeek}
          title={language === 'fr' ? 'Semaine précédente' : 'Previous week'}
          aria-label={language === 'fr' ? 'Semaine précédente' : 'Previous week'}
        >
          <ChevronLeft size={16} />
        </button>

        <div className="week-nav-center">
          <span className="week-nav-title">{weekRangeLabel}</span>
          {weekOffset !== 0 && (
            <button
              type="button"
              className="week-nav-today-badge"
              onClick={goToCurrentWeek}
              title={language === 'fr' ? "Revenir à aujourd'hui" : 'Back to today'}
            >
              {language === 'fr' ? "Aujourd'hui" : 'Today'}
            </button>
          )}
        </div>

        <button
          type="button"
          className="week-nav-chevron-btn"
          onClick={goToNextWeek}
          disabled={weekOffset >= 0}
          title={language === 'fr' ? 'Semaine suivante' : 'Next week'}
          aria-label={language === 'fr' ? 'Semaine suivante' : 'Next week'}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 7 Days Grid */}
      <div className="week-selector">
        {weekDays.map((day, idx) => {
          const isCurrentWeek = weekOffset === 0;
          const isToday = isCurrentWeek && idx === todayIndex;
          const isSelected = idx === activeSelectedDay;
          const isFuture = isCurrentWeek && idx > todayIndex;

          const dayLetter = language === 'en'
            ? idx === 0 ? 'M' : idx === 1 ? 'T' : idx === 2 ? 'W' : idx === 3 ? 'T' : idx === 4 ? 'F' : idx === 5 ? 'S' : 'S'
            : day.short;

          return (
            <button
              key={`${day.short}-${day.date}-${idx}`}
              type="button"
              className={`week-day-btn ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''}`}
              onClick={() => !isFuture && handleSelectDay(idx)}
              disabled={isFuture}
              title={`${day.long} ${day.date}${isToday ? ` (${t('week.today')})` : ''}`}
            >
              <span className="week-day-letter">{dayLetter}</span>
              <span className="week-day-num">{day.date}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
