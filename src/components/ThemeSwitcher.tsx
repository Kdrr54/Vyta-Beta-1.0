import React from 'react';
import { useApp } from '../context/AppContext';
import { AppTheme } from '../types';
import { Sparkles, Mountain, Moon } from 'lucide-react';

interface ThemeSwitcherProps {
  compact?: boolean;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ compact = false }) => {
  const { theme, setTheme } = useApp();

  const handleSelect = (nextTheme: AppTheme) => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } catch (e) {}
    setTheme(nextTheme);
  };

  const themes: { id: AppTheme; label: string; icon: React.ReactNode }[] = [
    {
      id: 'ceramic',
      label: 'Céramique',
      icon: <Sparkles size={11} />,
    },
    {
      id: 'alpine',
      label: 'Alpine',
      icon: <Mountain size={11} />,
    },
    {
      id: 'dark',
      label: 'Onyx',
      icon: <Moon size={11} />,
    },
  ];

  return (
    <div className="theme-switcher-pill" role="radiogroup" aria-label="Sélecteur d'ambiance visuelle">
      {themes.map((t) => {
        const isActive = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            className={`theme-opt-btn ${isActive ? 'active' : ''}`}
            onClick={() => handleSelect(t.id)}
            role="radio"
            aria-checked={isActive}
            title={`Passer au thème ${t.label}`}
          >
            {t.icon}
            {!compact && <span>{t.label}</span>}
          </button>
        );
      })}
    </div>
  );
};
