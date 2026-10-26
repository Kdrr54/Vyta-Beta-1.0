import React, { useState, useEffect } from 'react';
import { DynamicIsland } from './DynamicIsland';
import { Wifi, Battery } from 'lucide-react';

import { useApp } from '../context/AppContext';

interface IPhoneFrameProps {
  header?: React.ReactNode;
  overlay?: React.ReactNode;
  children: React.ReactNode;
  scale?: number;
  isChassisEnabled?: boolean;
}

export const IPhoneFrame: React.FC<IPhoneFrameProps> = ({
  header,
  overlay,
  children,
  scale = 1,
  isChassisEnabled = true,
}) => {
  const { simulatedDate, setIsDateModalOpen, theme } = useApp();
  const hours = String(simulatedDate.getHours()).padStart(2, '0');
  const minutes = String(simulatedDate.getMinutes()).padStart(2, '0');
  const timeString = `${hours}:${minutes}`;

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 500;

  return (
    <div
      className={`iphone-16-pro ${!isChassisEnabled ? 'chassis-disabled' : ''} theme-root-${theme}`}
      data-theme={theme}
      style={{
        transform: !isMobile && isChassisEnabled && scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'top center',
      }}
    >
      {/* Physical Hardware Buttons on iPhone 16 Pro */}
      {isChassisEnabled && (
        <>
          <div className="iphone-button btn-action" title="Action Button" />
          <div className="iphone-button btn-vol-up" title="Volume +" />
          <div className="iphone-button btn-vol-down" title="Volume -" />
          <div className="iphone-button btn-power" title="Side Button" />
          <div className="iphone-button btn-camera-control" title="Camera Control" />
        </>
      )}

      {/* Internal iOS Screen */}
      <div className={`iphone-screen theme-${theme}`} data-theme={theme}>
        {/* iOS Status Bar */}
        <div className="ios-status-bar">
          <span
            className="status-time"
            onClick={() => setIsDateModalOpen(true)}
            title="Appuyez pour changer la date du jour (Mode Test)"
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            {timeString}
          </span>
          <div className="status-icons">
            {/* 5G Signal bars */}
            <svg width="17" height="11" viewBox="0 0 17 11" fill="none">
              <rect x="0" y="8" width="3" height="3" rx="0.5" fill="#fff" />
              <rect x="4.5" y="5.5" width="3" height="5.5" rx="0.5" fill="#fff" />
              <rect x="9" y="3" width="3" height="8" rx="0.5" fill="#fff" />
              <rect x="13.5" y="0" width="3" height="11" rx="0.5" fill="#fff" />
            </svg>
            <Wifi size={14} strokeWidth={2.5} />
            <Battery size={19} strokeWidth={2} />
          </div>
        </div>

        {/* Dynamic Island */}
        <DynamicIsland />

        {/* Persistent Top Header (Bluetooth, CoVyta toggle, Settings) */}
        {header && <div className="app-top">{header}</div>}

        {/* Scrollable Viewport Content */}
        <main className="app-scroll-container">
          {children}
        </main>

        {/* Floating elements & modals */}
        {overlay}

        {/* iOS Home Indicator Bar */}
        <div className="ios-home-indicator" />
      </div>
    </div>
  );
};
