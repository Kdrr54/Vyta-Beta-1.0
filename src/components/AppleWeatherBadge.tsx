import React, { useEffect, useState } from 'react';
import { fetchWeatherForLocation, AppleWeatherData } from '../lib/appleWeatherService';
import { Sun, Cloud, CloudRain, CloudSnow, Wind, Sparkles } from 'lucide-react';

export const AppleWeatherBadge: React.FC = () => {
  const [weather, setWeather] = useState<AppleWeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeatherForLocation().then(data => {
      setWeather(data);
      setLoading(false);
    });
  }, []);

  if (loading || !weather) return null;

  const renderIcon = () => {
    switch (weather.conditionCode) {
      case 'Clear': return <Sun size={13} color="#FFD60A" />;
      case 'PartlyCloudy': return <Cloud size={13} color="#D1D1D6" />;
      case 'Cloudy': return <Cloud size={13} color="#8E8E93" />;
      case 'Rain': return <CloudRain size={13} color="#0A84FF" />;
      case 'Snow': return <CloudSnow size={13} color="#FFFFFF" />;
      case 'Windy': return <Wind size={13} color="#64D2FF" />;
      default: return <Sun size={13} color="#FFD60A" />;
    }
  };

  return (
    <div
      className="apple-weather-pill"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderRadius: '14px',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: '11.5px',
        color: '#FFFFFF',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        {renderIcon()}
        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
          {weather.temperatureC}°C
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>• {weather.condition}</span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '10.5px' }}>
          (Vent {weather.windSpeedKmH} km/h)
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <Sparkles size={11} color="var(--accent-green)" />
        <span style={{ fontSize: '10.5px', color: 'var(--accent-green)', fontWeight: 600 }}>
          Indice run : {weather.runningConditionScore}%
        </span>
      </div>
    </div>
  );
};
