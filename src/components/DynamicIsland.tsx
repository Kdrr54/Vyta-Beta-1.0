import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Battery, Heart } from 'lucide-react';
import { RingImage } from './RingImage';

export const DynamicIsland: React.FC = () => {
  const { liveBpm, ring } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`dynamic-island ${isExpanded ? 'expanded' : ''}`}
      onClick={() => setIsExpanded(!isExpanded)}
      title="Dynamic Island"
    >
      {!isExpanded ? (
        <div className="di-content-collapsed">
          <div className="di-left">
            <RingImage size={18} />
          </div>
          <div className="di-right">
            <Heart size={11} color="#FFFFFF" fill="#FFFFFF" />
            <span style={{ fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {liveBpm}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RingImage size={32} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Vyta One R21</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Bluetooth 5.4 • Capteurs actifs</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Battery size={15} color="#FFFFFF" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
              {ring.batteryRing}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
