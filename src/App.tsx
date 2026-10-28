import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { IPhoneFrame } from './components/IPhoneFrame';
import { AppHeader } from './components/AppHeader';
import { TabBar } from './components/TabBar';
import { HealthScreen } from './components/HealthScreen';
import { SleepScreen } from './components/SleepScreen';
import { CycleScreen } from './components/CycleScreen';
import { FitScreen } from './components/FitScreen';
import { SettingsModal } from './components/SettingsModal';
import { SubscribeModal } from './components/SubscribeModal';
import { StoryModal } from './components/StoryModal';
import { MetricDetailModal } from './components/MetricDetailModal';
import { TestDateModal } from './components/TestDateModal';
import { HealthKitSyncModal } from './components/HealthKitSyncModal';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { PairingModal } from './components/PairingModal';
import { OnboardingFlow } from './components/OnboardingFlow';
import { GeneralStateModal } from './components/GeneralStateModal';
import { FindMyRingModal } from './components/FindMyRingModal';
import { PrismModal } from './components/PrismModal';
import { AppleNotificationBanner } from './components/AppleNotificationBanner';

const AppInner: React.FC = () => {
  const {
    tab,
    setTab,
    modal,
    openModal,
    closeModal,
    metricDetail,
    closeMetricDetail,
    storyData,
    closeStory,
    isDateModalOpen,
    setIsDateModalOpen,
    isPaired,
    setIsPaired,
    isLiveRunningViewOpen,
  } = useApp();

  React.useEffect(() => {
    closeModal();
    if (tab === 'covyta') {
      setTab('health');
    }
  }, [tab, setTab]);

  // Réinitialiser immédiatement le défilement tout en haut lors d'un changement d'onglet
  React.useLayoutEffect(() => {
    const el = document.querySelector('.app-scroll-container') as HTMLElement | null;
    if (el) {
      el.style.scrollBehavior = 'auto';
      el.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    requestAnimationFrame(() => {
      if (el) {
        el.scrollTop = 0;
        el.style.scrollBehavior = '';
      }
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, [tab]);

  // Si la bague n'est pas encore appairée (premier lancement) :
  // Afficher IMMÉDIATEMENT et EXCLUSIVEMENT la page d'appairage en plein écran mobile.
  if (!isPaired) {
    return (
      <div className="studio-viewport" style={{ padding: 0, background: '#040605' }}>
        <div
          className="iphone-screen"
          style={{
            width: '100vw',
            maxWidth: '430px',
            height: '100dvh',
            position: 'relative',
            background: '#040605',
            overflow: 'hidden',
          }}
        >
          <OnboardingFlow onComplete={() => setIsPaired(true)} />
        </div>
      </div>
    );
  }

  // Application principale une fois la bague appairée
  return (
    <div className="studio-viewport" style={{ padding: 0, background: '#040605' }}>
      <IPhoneFrame
        header={!isLiveRunningViewOpen ? <AppHeader /> : null}
        overlay={
          <>
            {!isLiveRunningViewOpen && <TabBar />}
            <AppleNotificationBanner />
            {modal === 'settings' && <SettingsModal onClose={closeModal} />}
            {modal === 'prism' && <PrismModal onClose={closeModal} />}
            {modal === 'find_my' && (
              <FindMyRingModal
                onClose={closeModal}
                onBack={() => openModal('settings')}
              />
            )}
            {modal === 'subscribe' && <SubscribeModal onClose={closeModal} />}
            {modal === 'healthkit' && <HealthKitSyncModal onClose={closeModal} />}
            {modal === 'notifications' && <NotificationCenterModal onClose={closeModal} />}
            {modal === 'pairing' && <PairingModal onClose={closeModal} />}
            {modal === 'general_state' && <GeneralStateModal onClose={closeModal} />}
            {storyData && <StoryModal data={storyData} onClose={closeStory} />}
            {metricDetail && <MetricDetailModal metricId={metricDetail} onClose={closeMetricDetail} />}
            {isDateModalOpen && <TestDateModal onClose={() => setIsDateModalOpen(false)} />}
          </>
        }
      >
        <div key={tab} className="apple-tab-view">
          {tab === 'health' && <HealthScreen />}
          {tab === 'sleep' && <SleepScreen />}
          {tab === 'cycle' && <CycleScreen />}
          {tab === 'fit' && <FitScreen />}
        </div>
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
