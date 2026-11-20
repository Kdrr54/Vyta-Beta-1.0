import React from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, ShieldCheck, Clock } from 'lucide-react';
import { evaluateDailyImmunity, IMMUNITY_MIN_DAY_SAMPLES } from '../lib/immunityRadar';

interface ImmunityRadarProps {
  anomaly: { tempDelta: number; hrvDelta: number; detectedAtTs?: number } | null;
  hasHrv?: boolean;
  hasTemp?: boolean;
}

export const ImmunityRadar: React.FC<ImmunityRadarProps> = ({ anomaly, hasHrv = false, hasTemp = false }) => {
  const { t, isFirstLaunch, cardThemeMode, language, weekData, selectedDay } = useApp();
  const isMono = cardThemeMode === 'monochrome';
  const isEn = language === 'en';

  const curDay = weekData && weekData[selectedDay] ? weekData[selectedDay] : null;
  const dailyEval = React.useMemo(
    () => evaluateDailyImmunity(curDay, weekData, selectedDay),
    [curDay, weekData, selectedDay]
  );

  const hasData = !isFirstLaunch && (hasHrv || hasTemp || dailyEval.sampleCount > 0);
  const resolvedAnomaly = dailyEval.anomaly ?? (dailyEval.status === 'collecting' ? null : anomaly);
  // Une anomalie n'est affichée que lorsque l'évaluation sur la journée entière confirme un écart durable
  const hasAnomaly =
    hasData &&
    dailyEval.status === 'anomaly' &&
    !!resolvedAnomaly &&
    (resolvedAnomaly.tempDelta !== 0 || resolvedAnomaly.hrvDelta !== 0);

  const detectedLabel = React.useMemo(() => {
    if (!hasAnomaly || !anomaly) return null;
    const ts = anomaly.detectedAtTs || Date.now();
    const d = new Date(ts);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const hhmm = d.toLocaleTimeString(isEn ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) {
      return isEn ? `Detected today at ${hhmm}` : `Détectée aujourd’hui à ${hhmm}`;
    }
    if (d.toDateString() === yesterday.toDateString()) {
      return isEn ? `Detected yesterday at ${hhmm}` : `Détectée hier à ${hhmm}`;
    }
    const dayStr = d.toLocaleDateString(isEn ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' });
    return isEn ? `Detected ${dayStr} at ${hhmm}` : `Détectée le ${dayStr} à ${hhmm}`;
  }, [hasAnomaly, anomaly, isEn]);

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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <span className="immunity-badge-alert">{t('immunity.anomaly_detected')}</span>
            {detectedLabel && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'rgba(255, 162, 154, 0.88)',
                }}
              >
                <Clock size={10} />
                <span>
                  {detectedLabel} · {dailyEval.sampleCount} {isEn ? 'samples' : 'relevés'}
                </span>
              </span>
            )}
          </div>
        ) : (
          <span className="immunity-shield-badge">
            {!hasData
              ? isEn
                ? 'Waiting for data'
                : 'En attente de mesures'
              : dailyEval.status === 'collecting'
              ? isEn
                ? `Full-day scan (${dailyEval.sampleCount}/${IMMUNITY_MIN_DAY_SAMPLES})`
                : `Analyse journée (${dailyEval.sampleCount}/${IMMUNITY_MIN_DAY_SAMPLES})`
              : isEn
              ? `Shield Active · ${dailyEval.sampleCount} samples`
              : `${t('immunity.shield_active')} · ${dailyEval.sampleCount} relevés`}
          </span>
        )}
      </div>

      {/* Affichage d'un diagnostic et protocole d'action UNIQUEMENT en cas de VRAIE anomalie durable sur la journée */}
      {hasAnomaly && resolvedAnomaly ? (
        <>
          <div className="immunity-metrics-row">
            <div className="immunity-metric-box">
              <span className="metric-name">{t('health.temp')}</span>
              <span className="metric-val-alert">+{resolvedAnomaly.tempDelta} °C</span>
            </div>

            <div className="immunity-metric-box">
              <span className="metric-name">{t('health.hrv')}</span>
              <span className="metric-val-alert">{resolvedAnomaly.hrvDelta} ms</span>
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
                    <span>{t('immunity.diag_factor_temp')} (<strong>+{resolvedAnomaly.tempDelta} °C</strong>)</span>
                  </div>
                  <div className="covyta-diag-row">
                    <span className="diag-num red">2.</span>
                    <span>{t('immunity.diag_factor_hrv')} (<strong>{resolvedAnomaly.hrvDelta} ms</strong>)</span>
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
        /* État sain, en cours d'analyse journée ou en attente : AUCUN faux diagnostic affiché */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {!hasData
              ? isEn
                ? 'Waiting for HRV and temperature measurements'
                : 'En attente des relevés VRC et température'
              : dailyEval.status === 'collecting'
              ? isEn
                ? `Evaluating across the full day (${dailyEval.sampleCount}/${IMMUNITY_MIN_DAY_SAMPLES} readings)`
                : `Évaluation en cours sur la journée (${dailyEval.sampleCount}/${IMMUNITY_MIN_DAY_SAMPLES} relevés)`
              : t('immunity.no_anomaly')}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px', color: '#D1D1D6' }}>
            {!hasData ? (
              <span style={{ fontSize: '11.5px', color: 'rgba(250, 247, 242, 0.65)', lineHeight: 1.45 }}>
                Synchronisez votre bague pour analyser votre VRC et votre température cutanée. Aucune validation n'est affichée sans mesures réelles.
              </span>
            ) : dailyEval.status === 'collecting' ? (
              <span style={{ fontSize: '11.5px', color: 'rgba(250, 247, 242, 0.72)', lineHeight: 1.45 }}>
                {isEn
                  ? `Current averages${dailyEval.avgTemp ? ` · Temp ${dailyEval.avgTemp}°C` : ''}${dailyEval.avgHrv ? ` · HRV ${dailyEval.avgHrv} ms` : ''}. Confirmed only after ${IMMUNITY_MIN_DAY_SAMPLES}+ readings across the day to avoid false alerts.`
                  : `Moyennes actuelles${dailyEval.avgTemp ? ` · Temp. ${dailyEval.avgTemp}°C` : ''}${dailyEval.avgHrv ? ` · VRC ${dailyEval.avgHrv} ms` : ''}. Confirmation uniquement après ${IMMUNITY_MIN_DAY_SAMPLES} relevés répartis sur la journée pour éviter les fausses alertes.`}
              </span>
            ) : (
              <>
                {(hasTemp || dailyEval.avgTemp !== null) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: isMono ? '#FAF7F2' : '#30D158' }}>✓</span>
                    <span>
                      {t('immunity.temp_normal')}
                      {dailyEval.avgTemp !== null ? ` (${dailyEval.avgTemp}°C moy.)` : ''}
                    </span>
                  </div>
                )}
                {(hasHrv || dailyEval.avgHrv !== null) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: isMono ? '#FAF7F2' : '#30D158' }}>✓</span>
                    <span>
                      {t('immunity.hrv_stable')}
                      {dailyEval.avgHrv !== null ? ` (${dailyEval.avgHrv} ms moy.)` : ''}
                    </span>
                  </div>
                )}
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
