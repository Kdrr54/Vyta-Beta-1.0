import React from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle, Sparkles, Lock, ArrowRight, ShieldCheck } from 'lucide-react';

interface ImmunityRadarProps {
  anomaly: { tempDelta: number; hrvDelta: number } | null;
}

export const ImmunityRadar: React.FC<ImmunityRadarProps> = ({ anomaly }) => {
  const { covytaActive, openModal } = useApp();

  const hasAnomaly = !!anomaly;

  return (
    <div className={`immunity-radar-card ${hasAnomaly ? 'anomaly-active' : ''}`}>
      <div className="immunity-header">
        <div className="immunity-title-wrap">
          {hasAnomaly ? (
            <div className="immunity-dot" />
          ) : (
            <ShieldCheck size={18} color="var(--accent-green)" />
          )}
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Système Immunitaire
            </span>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
              Radar d'Immunité R21
            </h3>
          </div>
        </div>

        {hasAnomaly ? (
          <span className="immunity-badge-alert">Anomalie Détectée</span>
        ) : (
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-green)', background: 'rgba(48,209,88,0.1)', padding: '3px 8px', borderRadius: '6px' }}>
            Bouclier Actif
          </span>
        )}
      </div>

      {/* Free Anomaly Preview Metrics */}
      {hasAnomaly ? (
        <div className="immunity-metrics-row">
          <div className="immunity-metric-box">
            <span className="metric-name">Température Cutanée</span>
            <span className="metric-val-alert">+{anomaly.tempDelta} °C</span>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>au-dessus de la ligne basale</span>
          </div>

          <div className="immunity-metric-box">
            <span className="metric-name">Variabilité Cardiaque (VFC)</span>
            <span className="metric-val-alert">{anomaly.hrvDelta} ms</span>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>baisse soudaine diurne</span>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
          Aucune anomalie thermique ni cardiaque détectée sur les dernières 24h. Votre système immunitaire opère dans sa plage optimale.
        </p>
      )}

      {/* CoVyta Diagnostic & Action Protocol (Hook / Blurred when OFF) */}
      <div className={`covyta-diag-container ${covytaActive ? 'gold-active' : ''}`}>
        <div className={`covyta-diag-content ${!covytaActive ? 'blurred' : ''}`}>
          <div className="covyta-diag-badge">
            <Sparkles size={13} color="var(--gold)" />
            <span>DIAGNOSTIC & PROTOCOLE COVYTA</span>
          </div>

          <p className="covyta-diag-text">
            <strong>Suspicion de réponse inflammatoire précoce (phase prodromique J0).</strong> Le croisement de l'élévation thermique (+0,4 °C) et du plongeon de VFC indique une lutte immunitaire active.
          </p>

          <div className="covyta-diag-protocol-list">
            <div className="diag-step">
              <span className="diag-step-num">1.</span>
              <span><strong>Hydratation cellulaire :</strong> 500 ml d'eau à température ambiante avec électrolytes.</span>
            </div>
            <div className="diag-step">
              <span className="diag-step-num">2.</span>
              <span><strong>Coupure d'effort :</strong> Remplacement de la séance d'intensité par 20 min de respiration guidée.</span>
            </div>
            <div className="diag-step">
              <span className="diag-step-num">3.</span>
              <span><strong>Coucher anticipé :</strong> Fenêtre de sommeil impérative à 22h45 pour stimuler les cytokines.</span>
            </div>
          </div>
        </div>

        {/* Lock overlay if CoVyta is not active */}
        {!covytaActive && (
          <div className="covyta-lock-overlay">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FFFFFF', fontSize: '12.5px', fontWeight: 600 }}>
              <Lock size={14} color="var(--gold)" />
              <span>Diagnostic réservé aux membres CoVyta</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', maxWidth: '280px', margin: 0 }}>
              Accédez au protocole d'anticipation médicale et aux actions recommandées pour stopper la charge virale.
            </p>
            <button
              type="button"
              className="covyta-lock-cta"
              onClick={() => openModal('subscribe')}
            >
              <span>Débloquer avec CoVyta IA</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
