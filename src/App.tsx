import React, { useState } from 'react';
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
import { GeneralStateModal } from './components/GeneralStateModal';
import { AppleNotificationBanner } from './components/AppleNotificationBanner';
import { Smartphone, Calendar, Sparkles, Lock, Heart, Bell, Bluetooth, Minus, Plus, BatteryCharging, Play, Pause, RotateCcw, FastForward } from 'lucide-react';

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
    simulatedDate,
    liveBpm,
    setLiveBpm,
    ring,
    updateRing,
    isSimulating,
    toggleSimulation,
    simulationHoursElapsed,
    isFirstLaunch,
    isPaired,
    setIsPaired,
    resetToFactory,
    loadDemoData,
  } = useApp();
  const [scale, setScale] = useState(0.95);
  const [isChassisEnabled, setIsChassisEnabled] = useState(true);

  React.useEffect(() => {
    closeModal();
    if (tab === 'covyta') {
      setTab('health');
    }
  }, [tab, setTab]);

  return (
    <div className="studio-viewport">
      {/* Studio Header Controls Bar (Desktop preview) */}
      <header className="studio-toolbar" aria-label="Studio Toolbar">
        <div className="studio-toolbar-brand">
          <div className="brand-dot" />
          <span>VYTA</span>
          <span className="studio-toolbar-badge">Vyta One</span>
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

        {/* Contrôleur BPM en direct (Augmenter / Diminuer en temps réel) */}
        <div
          className="studio-controls-group"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(255, 59, 48, 0.1)',
            border: '1px solid rgba(255, 59, 48, 0.3)',
            borderRadius: '10px',
            padding: '3px 7px',
          }}
          title="Contrôleur de fréquence cardiaque en direct"
        >
          {/* Bouton - (Descendre) */}
          <button
            type="button"
            className="studio-btn"
            onClick={() => setLiveBpm((prev) => Math.max(40, prev - 5))}
            title="Diminuer le rythme (-5 BPM)"
            style={{
              padding: '3px 6px',
              minWidth: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Minus size={12} strokeWidth={2.8} />
          </button>

          {/* Affichage BPM + Cœur pulsant */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '0 4px',
              minWidth: '68px',
              justifyContent: 'center',
              userSelect: 'none',
            }}
          >
            <Heart
              size={12}
              color="#FF3B30"
              fill="#FF3B30"
              style={{
                animation: `restingDotBreathe ${(60 / Math.max(40, liveBpm)).toFixed(2)}s ease-in-out infinite alternate`,
              }}
            />
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: '#FFFFFF',
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.02em',
              }}
            >
              {liveBpm > 0 ? liveBpm : '--'} <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>BPM</span>
            </span>
          </div>

          {/* Bouton + (Augmenter) */}
          <button
            type="button"
            className="studio-btn"
            onClick={() => setLiveBpm((prev) => Math.min(210, prev + 5))}
            title="Augmenter le rythme (+5 BPM)"
            style={{
              padding: '3px 6px',
              minWidth: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={12} strokeWidth={2.8} />
          </button>

          {/* Paliers rapides d'intensité cardiaque */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '3px', borderLeft: '1px solid rgba(255,255,255,0.12)', paddingLeft: '5px' }}>
            {[
              { bpm: 55, label: '55', tip: 'Repos / Sommeil (55 BPM)' },
              { bpm: 75, label: '75', tip: 'Activité calme (75 BPM)' },
              { bpm: 135, label: '135', tip: 'Effort Cardio (135 BPM)' },
              { bpm: 175, label: '175', tip: 'Sprint maximal (175 BPM)' },
            ].map((p) => {
              const isCur = Math.abs(liveBpm - p.bpm) <= 3;
              return (
                <button
                  key={p.bpm}
                  type="button"
                  onClick={() => setLiveBpm(p.bpm)}
                  title={p.tip}
                  style={{
                    background: isCur ? '#FF3B30' : 'rgba(255, 255, 255, 0.08)',
                    border: isCur ? '1px solid #FF3B30' : '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '5px',
                    padding: '2px 5px',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    color: isCur ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contrôleur Batterie Bague en direct (Augmenter / Diminuer en temps réel) */}
        <div
          className="studio-controls-group"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(217, 249, 112, 0.09)',
            border: '1px solid rgba(217, 249, 112, 0.32)',
            borderRadius: '10px',
            padding: '3px 7px',
          }}
          title="Contrôleur du niveau de batterie de la bague en direct"
        >
          {/* Bouton - (Descendre Batterie) */}
          <button
            type="button"
            className="studio-btn"
            onClick={() =>
              updateRing({ batteryRing: Math.max(1, (ring.batteryRing ?? 87) - 5) })
            }
            title="Diminuer la batterie (-5%)"
            style={{
              padding: '3px 6px',
              minWidth: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Minus size={12} strokeWidth={2.8} />
          </button>

          {/* Affichage Batterie % */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '0 4px',
              minWidth: '58px',
              justifyContent: 'center',
              userSelect: 'none',
            }}
          >
            <BatteryCharging
              size={13}
              color={(ring.batteryRing ?? 87) <= 20 ? '#FF5A52' : '#D9F970'}
            />
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: '#FFFFFF',
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.02em',
              }}
            >
              {ring.batteryRing ?? 87}
              <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.65)', fontWeight: 600, marginLeft: '1px' }}>
                %
              </span>
            </span>
          </div>

          {/* Bouton + (Augmenter Batterie) */}
          <button
            type="button"
            className="studio-btn"
            onClick={() =>
              updateRing({ batteryRing: Math.min(100, (ring.batteryRing ?? 87) + 5) })
            }
            title="Augmenter la batterie (+5%)"
            style={{
              padding: '3px 6px',
              minWidth: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={12} strokeWidth={2.8} />
          </button>

          {/* Paliers rapides de batterie */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              marginLeft: '3px',
              borderLeft: '1px solid rgba(255,255,255,0.12)',
              paddingLeft: '5px',
            }}
          >
            {[
              { pct: 2, label: '2%', tip: 'Batterie critique (2%)' },
              { pct: 15, label: '15%', tip: 'Batterie faible (15%)' },
              { pct: 50, label: '50%', tip: 'Batterie moitié (50%)' },
              { pct: 87, label: '87%', tip: 'Batterie nominale (87%)' },
              { pct: 100, label: '100%', tip: 'Charge complète (100%)' },
            ].map((b) => {
              const isCur = Math.abs((ring.batteryRing ?? 87) - b.pct) <= 2;
              return (
                <button
                  key={b.pct}
                  type="button"
                  onClick={() => updateRing({ batteryRing: b.pct })}
                  title={b.tip}
                  style={{
                    background: isCur ? '#D9F970' : 'rgba(255, 255, 255, 0.08)',
                    border: isCur ? '1px solid #D9F970' : '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '5px',
                    padding: '2px 5px',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    color: isCur ? '#0A0A0C' : 'rgba(255, 255, 255, 0.75)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================
            MODULE SIMULATION ACCÉLÉRÉE (1s = 1h) & REMISE À ZÉRO USINE
            ======================================================== */}
        <div
          className="studio-controls-group"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: isSimulating ? 'rgba(217, 249, 112, 0.18)' : 'rgba(255, 255, 255, 0.05)',
            border: isSimulating ? '1.5px solid #D9F970' : '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '10px',
            padding: '3px 8px',
            transition: 'all 0.25s ease',
          }}
        >
          {/* Bouton Play/Pause Simulation (1s = 1h) */}
          <button
            type="button"
            className="studio-btn"
            onClick={toggleSimulation}
            title={isSimulating ? "Mettre la simulation en pause" : "Démarrer la simulation accélérée (1 seconde = 1 heure de vie de bague)"}
            style={{
              background: isSimulating ? '#D9F970' : 'rgba(217, 249, 112, 0.12)',
              color: isSimulating ? '#0A0A0C' : '#D9F970',
              border: '1px solid #D9F970',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 9px',
            }}
          >
            {isSimulating ? <Pause size={12} fill="#0A0A0C" /> : <Play size={12} fill="#D9F970" />}
            <span>{isSimulating ? 'Simulation 1s=1h ON' : 'Simuler (1s = 1h)'}</span>
          </button>

          {/* Badge Heures Simulées */}
          {simulationHoursElapsed > 0 && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#D9F970',
                fontFamily: 'var(--font-mono, monospace)',
                padding: '2px 6px',
                background: 'rgba(217, 249, 112, 0.15)',
                borderRadius: '6px',
              }}
            >
              +{simulationHoursElapsed}h
            </span>
          )}

          {/* Bouton Remise à Zéro Usine (Premier Lancement) */}
          <button
            type="button"
            className="studio-btn"
            onClick={resetToFactory}
            title="Réinitialiser l'application comme au premier déballage (zéro données, bague à appairer)"
            style={{
              color: '#FF8A80',
              borderColor: 'rgba(255, 138, 128, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RotateCcw size={12} />
            <span>Réinitialiser (Usine)</span>
          </button>

          {/* Bouton Recharger Données Démo */}
          {isFirstLaunch && (
            <button
              type="button"
              className="studio-btn"
              onClick={loadDemoData}
              title="Restaurer les données de démonstration d'une semaine complète"
              style={{
                color: '#38BDF8',
                borderColor: 'rgba(56, 189, 248, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Sparkles size={12} />
              <span>Charger Démo</span>
            </button>
          )}
        </div>

        <div className="studio-controls-group">
          {/* Bouton Appairage Smart Ring */}
          <button
            type="button"
            className="studio-btn"
            onClick={() => openModal('pairing')}
            title="Ouvrir la page d'appairage Smart Ring (Oura / Apple style)"
            style={{ color: '#10B981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
          >
            <Bluetooth size={13} />
            <span>Appairage</span>
          </button>

          {/* Bouton Apple Santé (HealthKit) */}
          <button
            type="button"
            className="studio-btn"
            onClick={() => openModal('healthkit')}
            title="Ouvrir le pont Apple Santé & Fitness"
            style={{ color: '#FF2D55' }}
          >
            <Heart size={13} />
            <span>Apple Santé</span>
          </button>

          {/* Bouton Notifications Apple APNs */}
          <button
            type="button"
            className="studio-btn"
            onClick={() => openModal('notifications')}
            title="Centre d'alertes Apple APNs"
          >
            <Bell size={13} />
            <span>Alertes</span>
          </button>

          <button
            type="button"
            className="studio-btn"
            onClick={() => setIsDateModalOpen(true)}
            title="Simuler la date du jour (Mode Test)"
            style={{ color: '#FF8A80', borderColor: 'rgba(139, 30, 47, 0.4)' }}
          >
            <Calendar size={13} />
            <span>{`${simulatedDate.getDate()}/${simulatedDate.getMonth() + 1}/${simulatedDate.getFullYear()}`}</span>
          </button>

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
            <AppleNotificationBanner />
            {modal === 'settings' && <SettingsModal onClose={closeModal} />}
            {modal === 'subscribe' && <SubscribeModal onClose={closeModal} />}
            {modal === 'healthkit' && <HealthKitSyncModal onClose={closeModal} />}
            {modal === 'notifications' && <NotificationCenterModal onClose={closeModal} />}
            {(!isPaired || modal === 'pairing') && (
              <PairingModal
                onClose={() => {
                  if (modal === 'pairing') closeModal();
                }}
              />
            )}
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
