import React from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, ShieldCheck } from 'lucide-react';

interface ImmunityRadarProps {
  anomaly: { tempDelta: number; hrvDelta: number } | null;
}

export const ImmunityRadar: React.FC<ImmunityRadarProps> = ({ anomaly }) => {
  const { covytaActive, openModal, t, isFirstLaunch, cardThemeMode } = useApp();
  const isMono = cardThemeMode === 'monochrome';

  // Une anomalie n'existe QUE si la bague a transmis des données et qu'un écart réel a été détecté
  const hasAnomaly = !isFirstLaunch && !!anomaly && (anomaly.tempDelta !== 0 || anomaly.hrvDelta !== 0);

  return (
    <div
      className={`immunity-radar-card ${hasAnomaly ? 'anomaly-active' : ''}`}
      style={{
        position: 'relative',
        width: '100%',
        padding: '16px 18px',
        borderRadius: '26px',
        overflow: 'hidden',
        background: hasAnomaly
          ? 'radial-gradient(ellipse at 50% 115%, rgba(255, 69, 58, 0.28) 0%, rgba(255, 45, 85, 0.08) 42%, rgba(10, 10, 12, 0.95) 78%), rgba(10, 10, 12, 0.86)'
          : (isMono
            ? 'radial-gradient(ellipse at 50% 115%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 48%, rgba(10, 10, 12, 0.96) 80%), #0A0A0C'
            : 'radial-gradient(ellipse at 50% 115%, rgba(52, 211, 153, 0.25) 0%, rgba(16, 185, 129, 0.08) 42%, rgba(10, 10, 12, 0.95) 78%), rgba(10, 10, 12, 0.86)'),
        backdropFilter: 'blur(26px)',
        WebkitBackdropFilter: 'blur(26px)',
        borderTop: '1px solid rgba(255, 248, 240, 0.16)',
        borderLeft: '1px solid rgba(255, 248, 240, 0.12)',
        borderRight: '1px solid rgba(255, 248, 240, 0.12)',
        borderBottom: hasAnomaly
          ? '1.5px solid rgba(255, 69, 58, 0.65)'
          : (isMono ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(52, 211, 153, 0.65)'),
        boxShadow: hasAnomaly
          ? '0 14px 32px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(255, 69, 58, 0.14)'
          : (isMono
            ? '0 14px 32px rgba(0, 0, 0, 0.55), 0 4px 18px rgba(255, 255, 255, 0.06)'
            : '0 14px 32px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(52, 211, 153, 0.14)'),
        userSelect: 'none',
      }}
    >
      <div className="immunity-header">
        <div className="immunity-title-wrap">
          {hasAnomaly ? (
            <div
              className="immunity-dot"
              style={{
                backgroundColor: '#FF453A',
                boxShadow: '0 0 10px rgba(255, 69, 58, 0.9)',
                flexShrink: 0,
              }}
            />
          ) : (
            <ShieldCheck size={18} color="var(--text-primary)" />
          )}
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {t('immunity.title')}
            </h3>
          </div>
        </div>

        {hasAnomaly ? (
          <span className="immunity-badge-alert">{t('immunity.anomaly_detected')}</span>
        ) : (
          <span className="immunity-shield-badge">
            {isFirstLaunch ? 'Calibrage initial' : t('immunity.shield_active')}
          </span>
        )}
      </div>

      {/* Affichage d'un diagnostic et protocole d'action UNIQUEMENT en cas de VRAIE anomalie détectée */}
      {hasAnomaly && anomaly ? (
        <>
          <div className="immunity-metrics-row">
            <div className="immunity-metric-box">
              <span className="metric-name">{t('health.temp')}</span>
              <span className="metric-val-alert">+{anomaly.tempDelta} °C</span>
            </div>

            <div className="immunity-metric-box">
              <span className="metric-name">{t('health.hrv')}</span>
              <span className="metric-val-alert">{anomaly.hrvDelta} ms</span>
            </div>
          </div>

          <div className="covyta-diag-container gold-active" style={{ marginTop: '10px' }}>
            <div className="covyta-diag-content">
              <div className="covyta-diag-badge">
                <Sparkles size={13} color="var(--gold)" />
                <span>{t('immunity.diag_badge')}</span>
              </div>

              <div className="covyta-diag-title">
                {t('immunity.diag_title')}
              </div>

              <div className="covyta-diag-block">
                <span className="covyta-diag-subtitle">{t('immunity.diag_factors')}</span>
                <div className="covyta-diag-list">
                  <div className="covyta-diag-row">
                    <span className="diag-num red">1.</span>
                    <span>{t('immunity.diag_factor_temp')} (<strong>+{anomaly.tempDelta} °C</strong>)</span>
                  </div>
                  <div className="covyta-diag-row">
                    <span className="diag-num red">2.</span>
                    <span>{t('immunity.diag_factor_hrv')} (<strong>{anomaly.hrvDelta} ms</strong>)</span>
                  </div>
                </div>
              </div>

              <div className="covyta-diag-block" style={{ marginTop: '8px' }}>
                <span className="covyta-diag-subtitle">{t('immunity.diag_advice_title')}</span>
                <div className="covyta-diag-protocol-list">
                  <div className="diag-step">
                    <span className="diag-step-num" style={{ color: '#30D158', fontWeight: 800 }}>1.</span>
                    <span><strong>{t('immunity.diag_step1_title')}</strong> {t('immunity.diag_step1_desc')}</span>
                  </div>
                  <div className="diag-step">
                    <span className="diag-step-num" style={{ color: '#30D158', fontWeight: 800 }}>2.</span>
                    <span><strong>{t('immunity.diag_step2_title')}</strong> {t('immunity.diag_step2_desc')}</span>
                  </div>
                  <div className="diag-step">
                    <span className="diag-step-num" style={{ color: '#30D158', fontWeight: 800 }}>3.</span>
                    <span><strong>{t('immunity.diag_step3_title')}</strong> {t('immunity.diag_step3_desc')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* État sain ou premier lancement : AUCUN faux diagnostic affiché */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {isFirstLaunch ? 'Calibrage de référence en cours' : t('immunity.no_anomaly')}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px', color: '#D1D1D6' }}>
            {isFirstLaunch ? (
              <span style={{ fontSize: '11.5px', color: 'rgba(250, 247, 242, 0.65)', lineHeight: 1.45 }}>
                Portez votre bague pendant 24h pour établir votre profil immunitaire de référence. Aucun diagnostic n'est émis tant que vos données réelles ne sont pas transmises.
              </span>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: isMono ? '#FAF7F2' : '#30D158' }}>✓</span>
                  <span>{t('immunity.temp_normal')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: isMono ? '#FAF7F2' : '#30D158' }}>✓</span>
                  <span>{t('immunity.hrv_stable')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: isMono ? '#FAF7F2' : '#30D158' }}>✓</span>
                  <span>{t('immunity.immune_optimal')}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
