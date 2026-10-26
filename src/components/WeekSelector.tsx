import React from 'react';
import { useApp } from '../context/AppContext';
import { WEEK, TODAY_INDEX } from '../data/health';

const dayKeys: Record<string, 'week.mon' | 'week.tue' | 'week.wed' | 'week.thu' | 'week.fri' | 'week.sat' | 'week.sun'> = {
  L: 'week.mon',
  M: 'week.tue',
  J: 'week.thu',
  V: 'week.fri',
  S: 'week.sat',
  D: 'week.sun',
};

export const WeekSelector: React.FC = () => {
  const { selectedDay, setSelectedDay, t, language } = useApp();

  return (
    <div className="week-selector" role="group" aria-label={t('week.selector_label')}>
      {WEEK.map((day, idx) => {
        const isToday = idx === TODAY_INDEX;
        const isSelected = idx === selectedDay;
        const isFuture = idx > TODAY_INDEX;

        const dayLetter = language === 'en'
          ? idx === 0 ? 'M' : idx === 1 ? 'T' : idx === 2 ? 'W' : idx === 3 ? 'T' : idx === 4 ? 'F' : idx === 5 ? 'S' : 'S'
          : day.short;

        return (
          <button
            key={`${day.short}-${day.date}`}
            type="button"
            className={`week-day-btn ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''}`}
            onClick={() => !isFuture && setSelectedDay(idx)}
            disabled={isFuture}
            title={`${day.long} ${day.date}${isToday ? ` (${t('week.today')})` : ''}`}
          >
            <span className="week-day-letter">{dayLetter}</span>
            <span className="week-day-num">{day.date}</span>
          </button>
        );
      })}
    </div>
  );
};
