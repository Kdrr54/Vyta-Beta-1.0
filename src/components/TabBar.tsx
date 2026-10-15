import React from 'react';
import { useApp } from '../context/AppContext';
import { TabType } from '../types';
import { HeartPulse, Dumbbell, Sparkles } from 'lucide-react';

export const TabBar: React.FC = () => {
  const { tab, setTab, covytaActive } = useApp();

  return (
    <nav className="apple-tab-bar" aria-label="Navigation principale">
      <button
        type="button"
        className={`tab-item ${tab === 'health' ? 'active' : ''}`}
        onClick={() => setTab('health')}
        aria-label="Health (Aujourd'hui)"
      >
        <HeartPulse size={19} strokeWidth={tab === 'health' ? 2.4 : 1.8} />
        <span className="tab-label">Health</span>
      </button>

      <button
        type="button"
        className={`tab-item ${tab === 'fit' ? 'active' : ''}`}
        onClick={() => setTab('fit')}
        aria-label="Fit (Sport & Performance)"
      >
        <Dumbbell size={19} strokeWidth={tab === 'fit' ? 2.4 : 1.8} />
        <span className="tab-label">Fit</span>
      </button>

      <button
        type="button"
        className={`tab-item ${tab === 'covyta' ? 'active' : ''}`}
        onClick={() => setTab('covyta')}
        aria-label="CoVyta IA (Le Coach Personnel)"
        style={{ color: tab === 'covyta' && covytaActive ? 'var(--gold-light)' : undefined }}
      >
        <Sparkles size={19} strokeWidth={tab === 'covyta' ? 2.4 : 1.8} />
        <span className="tab-label">CoVyta IA</span>
      </button>
    </nav>
  );
};
