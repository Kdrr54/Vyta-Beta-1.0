import React, { Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { IPhoneFrame } from './components/IPhoneFrame';
import { AppHeader } from './components/AppHeader';
import { TabBar } from './components/TabBar';
import { HealthScreen } from './components/HealthScreen';
import { AppleNotificationBanner } from './components/AppleNotificationBanner';
import { TODAY_INDEX } from './data/health';
import { installGlobalModalSheetDrag } from './hooks/useModalAnimation';

const SleepScreen = lazy(() => import('./components/SleepScreen').then((m) => ({ default: m.SleepScreen })));
const CycleScreen = lazy(() => import('./components/CycleScreen').then((m) => ({ default: m.CycleScreen })));
const FitScreen = lazy(() => import('./components/FitScreen').then((m) => ({ default: m.FitScreen })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal })));
const StoryModal = lazy(() => import('./components/StoryModal').then((m) => ({ default: m.StoryModal })));
const MetricDetailModal = lazy(() => import('./components/MetricDetailModal').then((m) => ({ default: m.MetricDetailModal })));
const TestDateModal = lazy(() => import('./components/TestDateModal').then((m) => ({ default: m.TestDateModal })));
const HealthKitSyncModal = lazy(() => import('./components/HealthKitSyncModal').then((m) => ({ default: m.HealthKitSyncModal })));
const NotificationCenterModal = lazy(() => import('./components/NotificationCenterModal').then((m) => ({ default: m.NotificationCenterModal })));
const PairingModal = lazy(() => import('./components/PairingModal').then((m) => ({ default: m.PairingModal })));
const OnboardingFlow = lazy(() => import('./components/OnboardingFlow').then((m) => ({ default: m.OnboardingFlow })));
const GeneralStateModal = lazy(() => import('./components/GeneralStateModal').then((m) => ({ default: m.GeneralStateModal })));
const FindMyRingModal = lazy(() => import('./components/FindMyRingModal').then((m) => ({ default: m.FindMyRingModal })));
const PrismModal = lazy(() => import('./components/PrismModal').then((m) => ({ default: m.PrismModal })));
const CalAiModal = lazy(() => import('./components/CalAiModal').then((m) => ({ default: m.CalAiModal })));
const NapModal = lazy(() => import('./components/NapModal').then((m) => ({ default: m.NapModal })));

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
    setSelectedDay,
  } = useApp();

  const [visitedTabs, setVisitedTabs] = React.useState<Set<string>>(() => new Set(['health']));

  React.useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, [tab]);

  // Préchargement silencieux en tâche de fond des onglets et modales fréquentes après le premier rendu
  React.useEffect(() => {
    if (!isPaired) return;
    const prefetch = () => {
      import('./components/SleepScreen');
      import('./components/FitScreen');
      import('./components/CycleScreen');
      import('./components/PrismModal');
      import('./components/SettingsModal');
      import('./components/MetricDetailModal');
    };
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(prefetch, { timeout: 1200 });
      return () => w.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(prefetch, 350);
    return () => window.clearTimeout(timer);
  }, [isPaired]);

  React.useEffect(() => {
    closeModal();
    if (tab === 'covyta') {
      setTab('health');
    }
    if (tab === 'health') {
      setSelectedDay(TODAY_INDEX);
    }
  }, [tab, setTab, setSelectedDay, closeModal]);

  // Réinitialiser immédiatement le défilement tout en haut lors d'un changement d'onglet
  React.useLayoutEffect(() => {
    const el = document.querySelector('.app-scroll-container') as HTMLElement | null;
    if (el) {
      el.scrollTop = 0;
    }
  }, [tab]);

  // Verrouillage universel du scroll d'arrière-plan dès qu'une modale (.modal-backdrop) est ouverte
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const syncScrollLock = () => {
      const hasModal = Boolean(document.querySelector('.modal-backdrop'));
      const scroller = document.querySelector('.app-scroll-container') as HTMLElement | null;
      if (scroller) {
        scroller.style.overflowY = hasModal ? 'hidden' : '';
        scroller.style.touchAction = hasModal ? 'none' : '';
        scroller.style.overscrollBehavior = hasModal ? 'none' : '';
      }
      document.body.style.overflow = hasModal ? 'hidden' : '';
      document.documentElement.style.overflow = hasModal ? 'hidden' : '';
    };
    syncScrollLock();
    const observer = new MutationObserver(syncScrollLock);
    observer.observe(document.body, { childList: true, subtree: true });
    const uninstallSheetDrag = installGlobalModalSheetDrag();
    return () => {
      uninstallSheetDrag();
      observer.disconnect();
      const scroller = document.querySelector('.app-scroll-container') as HTMLElement | null;
      if (scroller) {
        scroller.style.overflowY = '';
        scroller.style.touchAction = '';
        scroller.style.overscrollBehavior = '';
      }
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

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
          <Suspense fallback={null}>
            <OnboardingFlow onComplete={() => setIsPaired(true)} />
          </Suspense>
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
            {!isLiveRunningViewOpen && !metricDetail && !storyData && !isDateModalOpen && modal !== 'nap' && modal !== 'prism' && modal !== 'calai' && <TabBar />}
            <AppleNotificationBanner />
            <Suspense fallback={null}>
              {modal === 'settings' && <SettingsModal onClose={closeModal} />}
              {modal === 'prism' && <PrismModal onClose={closeModal} />}
              {modal === 'calai' && <CalAiModal onClose={closeModal} />}
              {modal === 'find_my' && (
                <FindMyRingModal
                  onClose={closeModal}
                  onBack={() => openModal('settings')}
                />
              )}
              {modal === 'healthkit' && <HealthKitSyncModal onClose={closeModal} />}
              {modal === 'notifications' && <NotificationCenterModal onClose={closeModal} />}
              {modal === 'pairing' && <PairingModal onClose={closeModal} />}
              {modal === 'general_state' && <GeneralStateModal onClose={closeModal} />}
              {modal === 'nap' && <NapModal onClose={closeModal} />}
              {storyData && <StoryModal data={storyData} onClose={closeStory} />}
              {metricDetail && <MetricDetailModal metricId={metricDetail} onClose={closeMetricDetail} />}
              {isDateModalOpen && <TestDateModal onClose={() => setIsDateModalOpen(false)} />}
            </Suspense>
          </>
        }
      >
        <Suspense fallback={null}>
          {visitedTabs.has('health') && (
            <div className={tab === 'health' ? 'apple-tab-view' : undefined} style={{ display: tab === 'health' ? 'block' : 'none' }}>
              <HealthScreen />
            </div>
          )}
          {visitedTabs.has('sleep') && (
            <div className={tab === 'sleep' ? 'apple-tab-view' : undefined} style={{ display: tab === 'sleep' ? 'block' : 'none' }}>
              <SleepScreen />
            </div>
          )}
          {visitedTabs.has('cycle') && (
            <div className={tab === 'cycle' ? 'apple-tab-view' : undefined} style={{ display: tab === 'cycle' ? 'block' : 'none' }}>
              <CycleScreen />
            </div>
          )}
          {visitedTabs.has('fit') && (
            <div className={tab === 'fit' ? 'apple-tab-view' : undefined} style={{ display: tab === 'fit' ? 'block' : 'none' }}>
              <FitScreen />
            </div>
          )}
        </Suspense>
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
