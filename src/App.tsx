import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { IPhoneFrame } from './components/IPhoneFrame';
import { AppHeader } from './components/AppHeader';
import { TabBar } from './components/TabBar';
import { HealthScreen } from './components/HealthScreen';
import { FitScreen } from './components/FitScreen';
import { CoVytaScreen } from './components/CoVytaScreen';
import { SettingsModal } from './components/SettingsModal';
import { SubscribeModal } from './components/SubscribeModal';
import { StoryModal } from './components/StoryModal';
import { MetricDetailModal } from './components/MetricDetailModal';
import { Smartphone } from 'lucide-react';

const AppInner: React.FC = () => {
  const { tab, modal, closeModal, metricDetail, closeMetricDetail, storyData, closeStory } = useApp();
  const [scale, setScale] = useState(0.95);
  const [isChassisEnabled, setIsChassisEnabled] = useState(true);

  return (
    <div className="studio-viewport">
      {/* Studio Header Controls Bar (Desktop preview) */}
      <header className="studio-toolbar" aria-label="Studio Toolbar">
        <div className="studio-toolbar-brand">
          <div className="brand-dot" />
          <span>VYTA</span>
          <span className="studio-toolbar-badge">Vyta One (R21)</span>
        </div>

        <div className="studio-controls-group">
          <button
            type="button"
            className={`studio-btn ${scale === 0.85 ? 'active' : ''}`}
            onClick={() => setScale(0.85)}
            title="Échelle 85%"
          >
            85%
          </button>
          <button
            type="button"
            className={`studio-btn ${scale === 0.95 ? 'active' : ''}`}
            onClick={() => setScale(0.95)}
            title="Échelle 95%"
          >
            95%
          </button>
          <button
            type="button"
            className={`studio-btn ${scale === 1 ? 'active' : ''}`}
            onClick={() => setScale(1)}
            title="Échelle 100%"
          >
            100%
          </button>
        </div>

        <div className="studio-controls-group">
          <button
            type="button"
            className="studio-btn"
            onClick={() => setIsChassisEnabled(!isChassisEnabled)}
            title="Bascule Châssis iPhone 16 Pro"
          >
            <Smartphone size={13} />
            <span>{isChassisEnabled ? 'Châssis On' : 'Plein Écran'}</span>
          </button>
        </div>
      </header>

      {/* iPhone 16 Pro Device Mockup */}
      <IPhoneFrame
        scale={scale}
        isChassisEnabled={isChassisEnabled}
        header={<AppHeader />}
        overlay={
          <>
            <TabBar />
            {modal === 'settings' && <SettingsModal onClose={closeModal} />}
            {modal === 'subscribe' && <SubscribeModal onClose={closeModal} />}
            {storyData && <StoryModal data={storyData} onClose={closeStory} />}
            {metricDetail && <MetricDetailModal metricId={metricDetail} onClose={closeMetricDetail} />}
          </>
        }
      >
        {tab === 'health' && <HealthScreen />}
        {tab === 'fit' && <FitScreen />}
        {tab === 'covyta' && <CoVytaScreen />}
      </IPhoneFrame>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
};
