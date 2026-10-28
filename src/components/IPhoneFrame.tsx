import React from 'react';
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
}) => {
  const { theme } = useApp();

  return (
    <div className={`iphone-screen theme-${theme}`} data-theme={theme}>
      {/* Persistent Top Header (Bluetooth, CoVyta toggle, Settings) */}
      {header && <div className="app-top">{header}</div>}

      {/* Scrollable Viewport Content */}
      <main
        className="app-scroll-container"
        style={!header ? { paddingTop: 0, paddingBottom: 0, height: '100%', overflow: 'hidden' } : undefined}
      >
        {children}
      </main>

      {/* Floating elements & modals */}
      {overlay}
    </div>
  );
};
