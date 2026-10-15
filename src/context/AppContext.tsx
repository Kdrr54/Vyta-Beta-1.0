import React, { createContext, useContext, useState, useEffect } from 'react';
import { TabType, RingFinish, BiologicalSex, UserProfile, RingDevice } from '../types';
import { TODAY_INDEX, weekMetrics, ringDevice as defaultRing } from '../data/health';

interface AppContextType {
  tab: TabType;
  setTab: (tab: TabType) => void;
  covytaActive: boolean;
  setCovytaActive: (active: boolean) => void;
  profile: UserProfile;
  updateProfile: (partial: Partial<UserProfile>) => void;
  finish: RingFinish;
  setFinish: (finish: RingFinish) => void;
  modal: 'settings' | 'subscribe' | null;
  openModal: (modal: 'settings' | 'subscribe') => void;
  closeModal: () => void;
  metricDetail: 'bpm' | 'hrv' | 'temp' | 'spo2' | null;
  openMetricDetail: (metric: 'bpm' | 'hrv' | 'temp' | 'spo2') => void;
  closeMetricDetail: () => void;
  storyData: any | null;
  openStory: (data: any) => void;
  closeStory: () => void;
  selectedDay: number;
  setSelectedDay: (day: number) => void;
  liveBpm: number;
  ring: RingDevice;
  updateRing: (partial: Partial<RingDevice>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read initial query params if present for quick testing (?tab=fit, ?covyta=1, ?sex=femme, ?modal=settings)
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialTab = (params?.get('tab') as TabType) || 'health';
  const initialCovyta = params?.get('covyta') === '1';
  const initialSex = (params?.get('sex') as BiologicalSex) || 'homme';
  const initialModal = (params?.get('modal') as 'settings' | 'subscribe' | null) || null;
  const initialMetric = (params?.get('metric') as 'bpm' | 'hrv' | 'temp' | 'spo2' | null) || null;
  const initialStory = params?.get('story') === '1' ? {
    mode: 'run',
    title: 'Course Matinale · Parc',
    dateStr: 'Jeu. 15 octobre · 07 h 10',
    accentText: 'Nouveau Record 1 km (4:48)',
    stats: [
      { label: 'Distance', value: '8.12', unit: 'km' },
      { label: 'Allure', value: '5:09', unit: '/km' },
      { label: 'Temps', value: '41:52' },
      { label: 'FC Moyenne', value: '156', unit: 'bpm' },
    ],
  } : null;

  const initialDay = params?.get('day') ? parseInt(params.get('day')!, 10) : TODAY_INDEX;

  const [tab, setTab] = useState<TabType>(initialTab);
  const [covytaActive, setCovytaActive] = useState<boolean>(initialCovyta);
  const [selectedDay, setSelectedDay] = useState<number>(initialDay);
  const [finish, setFinish] = useState<RingFinish>('gunmetal');
  const [modal, setModal] = useState<'settings' | 'subscribe' | null>(initialModal);
  const [metricDetail, setMetricDetail] = useState<'bpm' | 'hrv' | 'temp' | 'spo2' | null>(initialMetric);
  const [storyData, setStoryData] = useState<any | null>(initialStory);
  const [ring, setRing] = useState<RingDevice>(defaultRing);

  const [profile, setProfile] = useState<UserProfile>({
    firstName: 'Alexandre',
    age: 28,
    heightCm: 182,
    weightKg: 76,
    sex: initialSex,
  });

  const [liveBpm, setLiveBpm] = useState<number>(weekMetrics[TODAY_INDEX].bpm);

  // Micro-fluctuation simulation of PPG optical sensor
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveBpm(prev => {
        const delta = (Math.random() > 0.5 ? 1 : -1) * (Math.random() > 0.7 ? 1 : 0);
        return Math.min(68, Math.max(59, prev + delta));
      });
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  const updateProfile = (partial: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...partial }));
  };

  const updateRing = (partial: Partial<RingDevice>) => {
    setRing(prev => ({ ...prev, ...partial }));
  };

  const openModal = (m: 'settings' | 'subscribe') => setModal(m);
  const closeModal = () => setModal(null);
  const openMetricDetail = (m: 'bpm' | 'hrv' | 'temp' | 'spo2') => setMetricDetail(m);
  const closeMetricDetail = () => setMetricDetail(null);
  const openStory = (data: any) => setStoryData(data);
  const closeStory = () => setStoryData(null);

  return (
    <AppContext.Provider
      value={{
        tab,
        setTab,
        covytaActive,
        setCovytaActive,
        profile,
        updateProfile,
        finish,
        setFinish,
        modal,
        openModal,
        closeModal,
        metricDetail,
        openMetricDetail,
        closeMetricDetail,
        storyData,
        openStory,
        closeStory,
        selectedDay,
        setSelectedDay,
        liveBpm,
        ring,
        updateRing,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
