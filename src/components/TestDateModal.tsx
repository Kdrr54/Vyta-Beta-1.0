import React, { useState } from 'react';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { useApp } from '../context/AppContext';
import { X, Calendar, Clock, RotateCcw, Sparkles, Check, ChevronRight } from 'lucide-react';

interface TestDateModalProps {
  onClose: () => void;
}

export const TestDateModal: React.FC<TestDateModalProps> = ({ onClose }) => {
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const { simulatedDate, setSimulatedDate, resetSimulatedDate, language } = useApp();
  const isEn = language === 'en';

  const year = simulatedDate.getFullYear();
  const month = simulatedDate.getMonth();
  const day = simulatedDate.getDate();
  const hours = simulatedDate.getHours();
  const minutes = simulatedDate.getMinutes();

  const formattedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const formattedTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  const [inputDate, setInputDate] = useState<string>(formattedDateStr);
  const [inputTime, setInputTime] = useState<string>(formattedTimeStr);

  const weekdayFr = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][simulatedDate.getDay()];
  const weekdayEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][simulatedDate.getDay()];
  const monthFr = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][month];
  const monthEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month];

  const handleApply = (newDateStr: string, newTimeStr: string) => {
    const [y, m, d] = newDateStr.split('-').map(Number);
    const [h, min] = newTimeStr.split(':').map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const nextDate = new Date(y, m - 1, d, isNaN(h) ? 12 : h, isNaN(min) ? 0 : min);
      setSimulatedDate(nextDate);
    }
  };

  const handleQuickAddDays = (deltaDays: number) => {
    const nextDate = new Date(simulatedDate.getTime() + deltaDays * 24 * 60 * 60 * 1000);
    setSimulatedDate(nextDate);
    const ny = nextDate.getFullYear();
    const nm = nextDate.getMonth();
    const nd = nextDate.getDate();
    setInputDate(`${ny}-${String(nm + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`);
  };

  const handleSetExactDate = (targetYear: number, targetMonthIdx: number, targetDay: number) => {
    const nextDate = new Date(targetYear, targetMonthIdx, targetDay, hours, minutes);
    setSimulatedDate(nextDate);
    setInputDate(`${targetYear}-${String(targetMonthIdx + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`);
  };

  const isDefault = day === 17 && month === 9 && year === 2026;

  // Approximate cycle day calculation for test feedback (based on period start Oct 16)
  const startDate = new Date(2026, 9, 16);
  const diffDays = Math.round((new Date(year, month, day).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const estimatedCycleDay = diffDays >= 0 ? ((diffDays % 28) + 1) : 1;

  return (
    <div
      className={`modal-backdrop ${isClosing ? "is-closing" : ""}`}
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 0 16px 0',
      }}
    >
      <div
        className={`modal-sheet ${isClosing ? "is-closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '92%',
          maxWidth: '380px',
          background: 'linear-gradient(180deg, #1e0505 0%, #100202 100%)',
          border: '1.5px solid #540a0a',
          borderRadius: '24px',
          padding: '20px',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.8), 0 0 24px rgba(139, 30, 47, 0.25)',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          animation: 'slideUp 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: '#2b0404',
                border: '1px solid #731724',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Calendar size={16} color="#FF8A80" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
                {isEn ? 'System Date Simulator' : 'Simulateur de Date (Test)'}
              </h3>
              <span style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>
                {isEn ? 'Change "Today" across the whole app' : 'Modifie "Aujourd’hui" dans toute l’app'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: 'var(--text-secondary)',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Current Active Date Box */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '14px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            {isEn ? 'Current Simulated Date' : 'Date simulée actuelle'}
          </span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF' }}>
            {isEn ? `${weekdayEn}, ${monthEn} ${day}, ${year}` : `${weekdayFr} ${day} ${monthFr} ${year}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '2px' }}>
            <span style={{ fontSize: '11.5px', color: '#FF8A80', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {formattedTimeStr}
            </span>
            <span style={{ fontSize: '11px', color: '#BF5AF2', fontWeight: 700, background: 'rgba(191, 90, 242, 0.15)', padding: '2px 7px', borderRadius: '6px' }}>
              {isEn ? `Cycle Day J${estimatedCycleDay}` : `Cycle Jour J${estimatedCycleDay}`}
            </span>
            {isDefault ? (
              <span style={{ fontSize: '10.5px', color: '#30D158', fontWeight: 700, background: 'rgba(48, 209, 88, 0.15)', padding: '2px 7px', borderRadius: '6px' }}>
                {isEn ? 'Default' : 'Par défaut'}
              </span>
            ) : (
              <span style={{ fontSize: '10.5px', color: '#FF9F0A', fontWeight: 700, background: 'rgba(255, 159, 10, 0.15)', padding: '2px 7px', borderRadius: '6px' }}>
                {isEn ? 'Custom' : 'Modifié'}
              </span>
            )}
          </div>
        </div>

        {/* Quick Jump Buttons */}
        <div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
            {isEn ? 'Quick Jumps' : 'Raccourcis rapides'}
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            <button
              type="button"
              onClick={() => handleQuickAddDays(-1)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '7px 4px',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isEn ? 'Yesterday (-1d)' : 'Hier (-1j)'}
            </button>
            <button
              type="button"
              onClick={() => handleSetExactDate(2026, 9, 17)}
              style={{
                background: isDefault ? '#2b0404' : 'rgba(255, 255, 255, 0.05)',
                border: isDefault ? '1px solid #731724' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '7px 4px',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isEn ? 'Oct 17 (Reset)' : '17 oct. (Base)'}
            </button>
            <button
              type="button"
              onClick={() => handleQuickAddDays(1)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '7px 4px',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isEn ? 'Tomorrow (+1d)' : 'Demain (+1j)'}
            </button>

            <button
              type="button"
              onClick={() => handleQuickAddDays(3)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '7px 4px',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              +3 jours
            </button>
            <button
              type="button"
              onClick={() => handleQuickAddDays(7)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '7px 4px',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              +7 jours
            </button>
            <button
              type="button"
              onClick={() => handleSetExactDate(2026, 9, 29)}
              style={{
                background: 'rgba(255, 214, 10, 0.12)',
                border: '1px solid rgba(255, 214, 10, 0.3)',
                borderRadius: '10px',
                padding: '7px 4px',
                color: '#FFD60A',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Sauter au jour d'ovulation J14"
            >
              Ovulation ✨
            </button>
          </div>
        </div>

        {/* Manual Date & Time Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>
            {isEn ? 'Custom Date & Time' : 'Choisir une date précise'}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="date"
              value={inputDate}
              onChange={(e) => {
                setInputDate(e.target.value);
                handleApply(e.target.value, inputTime);
              }}
              style={{
                flex: 2,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '8px 10px',
                color: '#FFFFFF',
                fontSize: '12.5px',
                fontWeight: 600,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <input
              type="time"
              value={inputTime}
              onChange={(e) => {
                setInputTime(e.target.value);
                handleApply(inputDate, e.target.value);
              }}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '8px 10px',
                color: '#FFFFFF',
                fontSize: '12.5px',
                fontWeight: 600,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Actions Bottom Bar */}
        <div style={{ display: 'flex', gap: '8px', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            type="button"
            onClick={() => {
              resetSimulatedDate();
              setInputDate('2026-10-17');
              setInputTime('15:47');
            }}
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '10px',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <RotateCcw size={13} />
            <span>{isEn ? 'Reset (Oct 17)' : 'Réinitialiser'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #8B1E2F 0%, #2b0404 100%)',
              border: '1px solid #731724',
              borderRadius: '12px',
              padding: '10px',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(43, 4, 4, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Check size={14} />
            <span>{isEn ? 'Done' : 'Terminer'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
