import React, { useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { HeartPulse, Moon, Dumbbell, Flower2, Settings } from 'lucide-react';
import { TODAY_INDEX } from '../data/health';
import { LiquidNavbar, LiquidNavItem } from './ui/liquid-glass-navbar';

export const TabBar: React.FC = () => {
  const { tab, setTab, t, profile, modal, openModal, closeModal, setSelectedDay } = useApp();
  const isFemale = profile.sex === 'femme';
  const isSettingsOpen = modal === 'settings';

  useEffect(() => {
    if (!isFemale && tab === 'cycle') {
      setTab('health');
    }
  }, [isFemale, tab, setTab]);

  interface AppNavItem extends LiquidNavItem {
    id: 'health' | 'sleep' | 'fit' | 'cycle' | 'settings';
  }

  const navItems = useMemo<AppNavItem[]>(() => {
    const base: AppNavItem[] = [
      {
        id: 'health',
        label: t('tab.health') || 'Santé',
        icon: <HeartPulse size={18} strokeWidth={2.1} />,
        fx: 'glow',
      },
      {
        id: 'sleep',
        label: t('tab.sleep') || 'Sommeil',
        icon: <Moon size={18} strokeWidth={2.1} />,
        fx: 'drop',
      },
      {
        id: 'fit',
        label: t('tab.fit') || 'Activité',
        icon: <Dumbbell size={18} strokeWidth={2.1} />,
        fx: 'plane',
      },
    ];

    if (isFemale) {
      base.push({
        id: 'cycle',
        label: t('tab.cycle') || 'Cycle',
        icon: <Flower2 size={18} strokeWidth={2.1} />,
        fx: 'wave',
      });
    } else {
      base.push({
        id: 'settings',
        label: t('settings.title') || 'Réglages',
        icon: <Settings size={18} strokeWidth={2.1} />,
        fx: 'spin',
      });
    }

    return base;
  }, [isFemale, t]);

  const activeIndex = useMemo(() => {
    if (!isFemale && isSettingsOpen) return 3;
    if (tab === 'health') return 0;
    if (tab === 'sleep') return 1;
    if (tab === 'fit') return 2;
    if (tab === 'cycle' && isFemale) return 3;
    return 0;
  }, [tab, isFemale, isSettingsOpen]);

  const handleTabChange = (index: number) => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } catch (_) {}

    const item = navItems[index];
    if (!item) return;

    if (item.id === 'settings') {
      if (isSettingsOpen) {
        closeModal();
      } else {
        openModal('settings');
      }
      return;
    }

    if (modal) {
      closeModal();
    }

    if (item.id === 'health') {
      setSelectedDay(TODAY_INDEX);
    }

    if (item.id === tab && !isSettingsOpen) {
      const el = document.querySelector('.app-scroll-container') as HTMLElement | null;
      if (el) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      setTab(item.id);
    }
  };

  return (
    <div
      className="liquid-navbar-bottom-wrapper"
      style={{
        position: 'absolute',
        bottom: 'max(14px, env(safe-area-inset-bottom, 14px))',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 90,
        pointerEvents: 'none',
      }}
    >
      <div style={{ pointerEvents: 'auto', maxWidth: 'calc(100% - 16px)' }}>
        <LiquidNavbar
          tone="dark"
          active={activeIndex}
          onChange={handleTabChange}
          items={navItems}
          compact={false}
          sound={false}
          style={{
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7), 0 2px 10px rgba(0, 0, 0, 0.35)',
          }}
        />
      </div>
    </div>
  );
};
