import React from 'react';
import { useApp } from '../context/AppContext';
import { WEEK, TODAY_INDEX } from '../data/health';

interface WeekSelectorProps {
  selectedDay?: number;
  onSelectDay?: (day: number) => void;
}

export const WeekSelector: React.FC<WeekSelectorProps> = ({
  selectedDay: propSelectedDay,
  onSelectDay: propOnSelectDay,
}) => {
  const { selectedDay: contextSelectedDay, setSelectedDay: contextSetSelectedDay, t, language } = useApp();
  const activeSelectedDay = propSelectedDay !== undefined ? propSelectedDay : contextSelectedDay;
  const handleSelectDay = propOnSelectDay || contextSetSelectedDay;

  return (
    <div className="week-selector" role="group" aria-label={t('week.selector_label')}>
      {WEEK.map((day, idx) => {
        const isToday = idx === TODAY_INDEX;
        const isSelected = idx === activeSelectedDay;
        const isFuture = idx > TODAY_INDEX;

        const dayLetter = language === 'en'
          ? idx === 0 ? 'M' : idx === 1 ? 'T' : idx === 2 ? 'W' : idx === 3 ? 'T' : idx === 4 ? 'F' : idx === 5 ? 'S' : 'S'
          : day.short;

        return (
          <button
            key={`${day.short}-${day.date}`}
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
  );
};
