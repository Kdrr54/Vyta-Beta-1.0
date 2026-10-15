import React from 'react';
import { useApp } from '../context/AppContext';
import { WEEK, TODAY_INDEX } from '../data/health';

export const WeekSelector: React.FC = () => {
  const { selectedDay, setSelectedDay } = useApp();

  return (
    <div className="week-selector" role="group" aria-label="Sélecteur de semaine">
      {WEEK.map((day, idx) => {
        const isToday = idx === TODAY_INDEX;
        const isSelected = idx === selectedDay;
        const isFuture = idx > TODAY_INDEX;

        return (
          <button
            key={`${day.short}-${day.date}`}
            type="button"
            className={`week-day-btn ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''}`}
            onClick={() => !isFuture && setSelectedDay(idx)}
            disabled={isFuture}
            title={`${day.long} ${day.date} octobre${isToday ? " (Aujourd'hui)" : ''}${isFuture ? ' (À venir)' : ''}`}
          >
            <span className="week-day-letter">{day.short}</span>
            <span className="week-day-num">{day.date}</span>
          </button>
        );
      })}
    </div>
  );
};
