import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { weekMetrics, TODAY_INDEX, emptyDayMetrics, DayMetrics } from '../data/health';
import { Heart, Square, Activity, Check } from 'lucide-react';
import { qringBle } from '../lib/qringBleService';

interface HeartRateCardProps {
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const HeartRateCard: React.FC<HeartRateCardProps> = ({
  onClick,
  className = '',
  style = {},
}) => {
  const { liveBpm, setLiveBpm, selectedDay, language, weekData, isFirstLaunch, setWeekData, cardThemeMode, ring, openModal } = useApp();
  const isMono = cardThemeMode === 'monochrome';
  const dayData = (weekData && weekData[selectedDay]) || (isFirstLaunch ? emptyDayMetrics : (weekMetrics[selectedDay] || weekMetrics[TODAY_INDEX]));

  const isToday = selectedDay === TODAY_INDEX;
  const isPastDay = selectedDay < TODAY_INDEX;

  const [isMeasuring, setIsMeasuring] = useState(false);
  const [countdown, setCountdown] = useState(20);
  const [justCompleted, setJustCompleted] = useState(false);
  const [measureFeedback, setMeasureFeedback] = useState<string | null>(null);

  const liveBpmRef = useRef(liveBpm);
  liveBpmRef.current = liveBpm;

  // BPM de la journée sélectionnée (ou BPM direct pendant une mesure active)
  const dayBpm = dayData?.bpm || 0;
  const rawBpm = isMeasuring ? (liveBpm > 0 ? liveBpm : dayBpm) : dayBpm;
  const displayBpm = rawBpm > 0 ? rawBpm : 0;
  const displayBpmText = displayBpm > 0 ? String(displayBpm) : (isMeasuring ? '...' : '--');
  const minBpmText = (dayData?.minBpm && dayData.minBpm > 0) ? String(dayData.minBpm) : '--';
  const maxBpmText = (dayData?.maxBpm && dayData.maxBpm > 0) ? String(dayData.maxBpm) : '--';

  const isResting = displayBpm > 0 && displayBpm <= 75;

  const handleStopMeasure = useCallback((completed = false) => {
    setIsMeasuring(false);
    setCountdown(20);
    qringBle.stopRealTimeHeartRate();

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(35); } catch (_) {}
    }

    const finalBpm = liveBpmRef.current;
    if (completed) {
      if (finalBpm >= 40 && finalBpm <= 200) {
        setJustCompleted(true);
        setMeasureFeedback(language === 'fr' ? `✓ ${finalBpm} BPM mesuré et enregistré` : `✓ ${finalBpm} BPM measured & saved`);
        setTimeout(() => {
          setJustCompleted(false);
          setMeasureFeedback(null);
        }, 4500);
        setWeekData(prev => {
          const next = [...prev];
          const idx = Math.min(6, Math.max(0, selectedDay));
          const cur = { ...(next[idx] || {}) };
          cur.bpm = finalBpm;
          cur.minBpm = cur.minBpm && cur.minBpm > 0 ? Math.min(cur.minBpm, finalBpm) : finalBpm;
          cur.maxBpm = cur.maxBpm && cur.maxBpm > 0 ? Math.max(cur.maxBpm, finalBpm) : finalBpm;
          if (!cur.restingBpm || cur.restingBpm === 0) cur.restingBpm = finalBpm;
          next[idx] = cur as DayMetrics;
          try {
            localStorage.setItem('vyta_week_data', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      } else {
        setMeasureFeedback(language === 'fr' ? 'Pouls non détecté (gardez la bague bien serrée au doigt)' : 'No pulse detected (keep ring snug on finger)');
        setTimeout(() => setMeasureFeedback(null), 4500);
      }
    }
  }, [language, selectedDay, setWeekData]);

  const handleStartMeasure = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([18, 30, 22]); } catch (_) {}
    }
    setJustCompleted(false);
    setCountdown(20);
    qringBle.startRealTimeHeartRate();
    setIsMeasuring(true);
  };

  const handleToggleMeasure = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMeasuring) {
      handleStopMeasure(false);
    } else {
      handleStartMeasure(e);
    }
  };

  // Stop measure if user navigates to a past day
  useEffect(() => {
    if (isMeasuring && !isToday) {
      handleStopMeasure(false);
    }
  }, [selectedDay, isToday, isMeasuring, handleStopMeasure]);

  // Real-time PPG measurement lifecycle for today (20 secondes)
  useEffect(() => {
    if (!isMeasuring || !isToday) return;

    // 1. Subscribe to real BLE notifications from physical ring if connected
    const unsubscribe = qringBle.subscribe((data) => {
      if (data.heartRate && data.heartRate >= 40 && data.heartRate <= 200) {
        setLiveBpm(data.heartRate);
      }
    });

    // 2. Send start command to ring hardware via BLE
    qringBle.startRealTimeHeartRate();

    // 3. Countdown timer 20 seconds
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleStopMeasure(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      unsubscribe();
      qringBle.stopRealTimeHeartRate();
    };
  }, [isMeasuring, isToday, handleStopMeasure, setLiveBpm]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bufferRef = useRef<number[]>([]);
  const phaseRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);
  const targetPointsRef = useRef<number>(240);

  const getEcgValue = (phase: number): number => {
    const p = ((phase % 1) + 1) % 1;
    const pWave = 3.6 * Math.exp(-Math.pow(p - 0.16, 2) / (2 * 0.025 * 0.025));
    const qDip = -3.2 * Math.exp(-Math.pow(p - 0.28, 2) / (2 * 0.012 * 0.012));
    const rPeak = 19.5 * Math.exp(-Math.pow(p - 0.33, 2) / (2 * 0.015 * 0.015));
    const sDip = -13.0 * Math.exp(-Math.pow(p - 0.39, 2) / (2 * 0.018 * 0.018));
    const tWave = 7.2 * Math.exp(-Math.pow(p - 0.58, 2) / (2 * 0.045 * 0.045));
    return pWave + qDip + rPeak + sDip + tWave;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    // Helper to draw a calm, static recorded wave for past historical days (live ECG paused)
    const drawStaticWave = () => {
      if (!canvas || !container) return;
      const dpr = Math.min(window.devicePixelRatio || 2, 3);
      const rect = container.getBoundingClientRect();
      const w = Math.max(rect.width, 100);
      const h = Math.max(rect.height, 46);

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const centerY = h * 0.54;

      if (displayBpm <= 0) {
        // Tracé en attente de mesure : ligne continue épurée et élégante (100% synchronisée)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(w, centerY);
        ctx.strokeStyle = '#FF453A';
        ctx.lineWidth = 2.0;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(255, 69, 58, 0.45)';
        ctx.shadowBlur = 6;
        ctx.globalAlpha = 0.8;
        ctx.stroke();

        // Edge fade mask
        ctx.globalCompositeOperation = 'destination-in';
        const fadeGrad = ctx.createLinearGradient(0, 0, w, 0);
        fadeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        fadeGrad.addColorStop(0.06, 'rgba(0, 0, 0, 1)');
        fadeGrad.addColorStop(0.94, 'rgba(0, 0, 0, 1)');
        fadeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = fadeGrad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();

        ctx.restore();
        return;
      }

      const count = Math.max(130, Math.floor(w * 0.72));
      const stepX = w / (count - 1);

      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < count; i++) {
        const ph = (i / count) * 4.2;
        const val = getEcgValue(ph);
        pts.push({ x: i * stepX, y: centerY - val });
      }

      if (pts.length > 2) {
        // 1. Static Glow Aura
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.strokeStyle = '#FF5A52';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(255, 90, 82, 0.4)';
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.22;
        ctx.stroke();
        ctx.restore();

        // 2. Static Core Line
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        const strokeGrad = ctx.createLinearGradient(0, 0, w, 0);
        strokeGrad.addColorStop(0, '#FF453A');
        strokeGrad.addColorStop(0.5, '#FF3B30');
        strokeGrad.addColorStop(1, '#FF5A52');
        ctx.strokeStyle = strokeGrad;
        ctx.lineWidth = 2.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(255, 59, 48, 0.5)';
        ctx.shadowBlur = 6;
        ctx.globalAlpha = 0.82;
        ctx.stroke();
        ctx.restore();

        // 3. Fade Mask
        ctx.save();
        ctx.globalCompositeOperation = 'destination-in';
        const fadeGrad = ctx.createLinearGradient(0, 0, w, 0);
        fadeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        fadeGrad.addColorStop(0.06, 'rgba(0, 0, 0, 1)');
        fadeGrad.addColorStop(0.94, 'rgba(0, 0, 0, 1)');
        fadeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = fadeGrad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      ctx.restore();
    };

    if (isPastDay || !isMeasuring) {
      drawStaticWave();
      const roPast = new ResizeObserver(drawStaticWave);
      roPast.observe(container);
      return () => {
        roPast.disconnect();
      };
    }

    // Active live ECG animation for today
    const resize = () => {
      if (!canvas || !container) return;
      const dpr = Math.min(window.devicePixelRatio || 2, 3);
      const rect = container.getBoundingClientRect();
      const w = Math.max(rect.width, 100);
      const h = Math.max(rect.height, 46);

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const target = Math.max(130, Math.floor(w * 0.72));
      targetPointsRef.current = target;

      if (bufferRef.current.length < target) {
        const missing = target - bufferRef.current.length;
        const prepend: number[] = [];
        for (let i = 0; i < missing; i++) {
          const ph = phaseRef.current - ((missing - i) / target) * 2.2;
          prepend.push(getEcgValue(ph));
        }
        bufferRef.current = [...prepend, ...bufferRef.current];
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    lastTimeRef.current = performance.now();

    const render = (now: number) => {
      if (!isRunning) return;

      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;

      const dpr = Math.min(window.devicePixelRatio || 2, 3);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const centerY = h * 0.54;

      if (displayBpm <= 0) {
        // Pendant la mesure, tant qu'aucun BPM n'a encore été reçu : ligne continue avec balayage subtil
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(w, centerY);
        ctx.strokeStyle = '#FF453A';
        ctx.lineWidth = 2.0;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(255, 69, 58, 0.45)';
        ctx.shadowBlur = 6;
        ctx.globalAlpha = 0.8;
        ctx.stroke();

        // Balayage lumineux délicat qui parcourt la ligne continue pour indiquer la synchronisation active
        const sweepX = ((now * 0.12) % (w + 60)) - 30;
        const sweepGrad = ctx.createRadialGradient(sweepX, centerY, 0, sweepX, centerY, 28);
        sweepGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        sweepGrad.addColorStop(0.35, 'rgba(255, 69, 58, 0.7)');
        sweepGrad.addColorStop(1, 'rgba(255, 69, 58, 0)');
        ctx.fillStyle = sweepGrad;
        ctx.beginPath();
        ctx.arc(sweepX, centerY, 28, 0, Math.PI * 2);
        ctx.fill();

        // Soft Edge Fade Mask
        ctx.globalCompositeOperation = 'destination-in';
        const fadeGrad = ctx.createLinearGradient(0, 0, w, 0);
        fadeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        fadeGrad.addColorStop(0.06, 'rgba(0, 0, 0, 1)');
        fadeGrad.addColorStop(0.94, 'rgba(0, 0, 0, 1)');
        fadeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = fadeGrad;
        ctx.fillRect(0, 0, w, h);

        ctx.restore();
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }
const beatsPerSec = Math.max(40, Math.min(220, displayBpm)) / 60;
      phaseRef.current = (phaseRef.current + dt * beatsPerSec) % 1.0;

      const rawVal = getEcgValue(phaseRef.current);
      const noise = Math.sin(now * 0.012) * 0.35;
      const currentSample = Math.max(-13.5, Math.min(20.5, rawVal + noise));

      const targetPoints = targetPointsRef.current || 240;
      bufferRef.current.push(currentSample);
      while (bufferRef.current.length > targetPoints) {
        bufferRef.current.shift();
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const buffer = bufferRef.current;
      const count = buffer.length;
      if (count > 2) {
        const centerY = h * 0.54;
        const stepX = w / (count - 1);

        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < count; i++) {
          const x = i * stepX;
          const y = centerY - buffer[i];
          pts.push({ x, y });
        }

        // 1. Background Diffuse Glow Aura
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

        ctx.strokeStyle = '#FF5A52';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(255, 90, 82, 0.9)';
        ctx.shadowBlur = 12;
        ctx.globalAlpha = 0.35;
        ctx.stroke();
        ctx.restore();

        // 2. Sharp Core Line
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

        const strokeGrad = ctx.createLinearGradient(0, 0, w, 0);
        if (isMono) {
          strokeGrad.addColorStop(0, '#FFFFFF');
          strokeGrad.addColorStop(0.5, '#FAF7F2');
          strokeGrad.addColorStop(1, '#E4E4E7');
          ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
        } else {
          strokeGrad.addColorStop(0, '#FF453A');
          strokeGrad.addColorStop(0.5, '#FF3B30');
          strokeGrad.addColorStop(1, '#FF5A52');
          ctx.shadowColor = 'rgba(255, 59, 48, 0.85)';
        }

        ctx.strokeStyle = strokeGrad;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();

        // 3. Soft Edge Fade Mask
        ctx.save();
        ctx.globalCompositeOperation = 'destination-in';
        const fadeGrad = ctx.createLinearGradient(0, 0, w, 0);
        fadeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        fadeGrad.addColorStop(0.06, 'rgba(0, 0, 0, 1)');
        fadeGrad.addColorStop(0.94, 'rgba(0, 0, 0, 1)');
        fadeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = fadeGrad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
    };
  }, [displayBpm, isPastDay, isMeasuring]);

  const beatPeriod = useMemo(() => {
    return (60 / Math.max(40, Math.min(220, displayBpm))).toFixed(3);
  }, [displayBpm]);

  return (
    <div
      className={`metric-card clickable heart-rate-ecg-card ${className}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      title="Ouvrir le suivi détaillé 24h de la Fréquence Cardiaque"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px 18px 16px 18px',
        minHeight: '148px',
        width: '100%',
        boxSizing: 'border-box',
        gap: '0px',
        borderRadius: '26px',
        overflow: 'hidden',
        cursor: 'pointer',
        userSelect: 'none',
        background:
          isMeasuring
            ? 'radial-gradient(ellipse at 50% 110%, rgba(255, 69, 58, 0.40) 0%, rgba(255, 45, 85, 0.16) 45%, rgba(10, 10, 12, 0.95) 82%), rgba(10, 10, 12, 0.90)'
            : 'radial-gradient(ellipse at 50% 110%, rgba(255, 69, 58, 0.30) 0%, rgba(255, 45, 85, 0.10) 42%, rgba(10, 10, 12, 0.95) 78%), rgba(10, 10, 12, 0.86)',
        backdropFilter: 'blur(26px)',
        WebkitBackdropFilter: 'blur(26px)',
        borderTop: isMeasuring ? '1px solid rgba(255, 90, 82, 0.4)' : '1px solid rgba(255, 248, 240, 0.16)',
        borderLeft: isMeasuring ? '1px solid rgba(255, 90, 82, 0.3)' : '1px solid rgba(255, 248, 240, 0.12)',
        borderRight: isMeasuring ? '1px solid rgba(255, 90, 82, 0.3)' : '1px solid rgba(255, 248, 240, 0.12)',
        borderBottom: isMeasuring
          ? '2px solid rgba(255, 69, 58, 0.95)'
          : '1.5px solid rgba(255, 69, 58, 0.65)',
        boxShadow: isMeasuring
          ? '0 16px 36px rgba(0, 0, 0, 0.55), 0 0 28px rgba(255, 69, 58, 0.38)'
          : '0 14px 32px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(255, 69, 58, 0.18)',
        transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        ...style,
      }}
    >
      {/* Top Row: Editorial Title + Badges + Action Button / Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          zIndex: 2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '13.5px',
              fontWeight: 400,
              color: 'rgba(250, 247, 242, 0.88)',
              letterSpacing: '-0.1px',
            }}
          >
            {language === 'fr' ? 'Fréquence Cardiaque' : 'Heart Rate'}
          </span>

          {isPastDay ? (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '2px 7.5px',
                borderRadius: '999px',
                color: 'rgba(250, 247, 242, 0.65)',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {language === 'fr' ? 'Enregistré' : 'Recorded'}
            </span>
          ) : null}
        </div>

        {/* Top-Right: Calm Orb for Past Days / Measure Button for Today */}
        {isPastDay ? (
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={language === 'fr' ? 'Historique 24h enregistré' : 'Recorded 24h history'}
          >
            <Heart size={13} color="#FF5A52" strokeWidth={1.8} style={{ opacity: 0.8 }} />
          </div>
        ) : isMeasuring ? (
          <button
            type="button"
            onClick={handleToggleMeasure}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 11px',
              borderRadius: '999px',
              background: 'rgba(255, 69, 58, 0.18)',
              border: '1px solid rgba(255, 69, 58, 0.55)',
              color: '#FAF7F2',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
              boxShadow: '0 0 12px rgba(255, 69, 58, 0.4)',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#FF453A',
                animation: 'restingDotBreathe 0.8s ease-in-out infinite alternate',
              }}
            />
            <span style={{ color: '#FF5A52', fontFamily: 'var(--font-mono)' }}>{countdown}s</span>
            <span style={{ fontSize: '10px', color: 'rgba(250, 247, 242, 0.7)' }}>
              {language === 'fr' ? 'Arrêter' : 'Stop'}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleToggleMeasure}
            title={language === 'fr' ? 'Lancer la mesure en direct (20s)' : 'Start live measurement (20s)'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 11px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FAF7F2',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Heart
              size={12}
              color="#FF453A"
              fill="#FF453A"
              style={{
                filter: 'drop-shadow(0 0 4px rgba(255, 69, 58, 0.6))',
                animation: 'restingDotBreathe 1.5s ease-in-out infinite alternate',
              }}
            />
            <span>{justCompleted ? (language === 'fr' ? 'Enregistré' : 'Saved') : (language === 'fr' ? 'Mesurer (20s)' : 'Measure (20s)')}</span>
          </button>
        )}
      </div>

      {/* Center: Wide ECG Canvas */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '2px 0',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />



        {isPastDay && (
          <div
            style={{
              position: 'absolute',
              top: '3px',
              right: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '9.5px',
              color: 'rgba(250, 247, 242, 0.45)',
              background: 'rgba(20, 20, 24, 0.55)',
              padding: '2px 7px',
              borderRadius: '6px',
              backdropFilter: 'blur(8px)',
              pointerEvents: 'none',
              letterSpacing: '0.03em',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <span>Tracé 24h</span>
          </div>
        )}
      </div>

      {/* Bottom Row: Editorial Light-Weight Number + Status or Min/Peak */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          width: '100%',
          marginTop: '2px',
          zIndex: 2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', flexWrap: 'nowrap' }}>
          <span
            style={{
              fontSize: '30px',
              fontWeight: 300,
              color: isMeasuring ? '#FF5A52' : '#FAF7F2',
              lineHeight: 1,
              letterSpacing: '-0.8px',
              textShadow: isMeasuring ? '0 0 16px rgba(255, 69, 58, 0.6)' : 'none',
              transition: 'color 0.25s ease, text-shadow 0.25s ease',
            }}
          >
            {displayBpmText}
          </span>
          <span
            style={{
              fontSize: '12.5px',
              fontWeight: 400,
              color: isMeasuring ? '#FF5A52' : 'rgba(250, 247, 242, 0.7)',
              lineHeight: 1,
            }}
          >
            BPM
          </span>
        </div>

        {/* Right side: Min & Peak for all days (including today), perfectly aligned on the same baseline */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', flexWrap: 'nowrap' }}>
          <span
            style={{
              fontSize: '11.5px',
              lineHeight: 1,
              color: 'rgba(250, 247, 242, 0.78)',
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: '3px',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                lineHeight: 1,
                color: 'rgba(250, 247, 242, 0.45)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Min
            </span>
            <span style={{ fontWeight: 400, color: '#FAF7F2', lineHeight: 1 }}>{minBpmText}</span>
          </span>
          <span style={{ color: 'rgba(250, 247, 242, 0.22)', fontSize: '10px', lineHeight: 1 }}>·</span>
          <span
            style={{
              fontSize: '11.5px',
              lineHeight: 1,
              color: 'rgba(250, 247, 242, 0.78)',
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: '3px',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                lineHeight: 1,
                color: 'rgba(250, 247, 242, 0.45)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {language === 'fr' ? 'Pic' : 'Peak'}
            </span>
            <span style={{ fontWeight: 400, color: '#FF5A52', lineHeight: 1 }}>{maxBpmText}</span>
          </span>
        </div>
      </div>

      {measureFeedback && (
        <div
          style={{
            marginTop: '8px',
            padding: '4px 10px',
            borderRadius: '999px',
            background: justCompleted ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 69, 58, 0.18)',
            border: justCompleted ? '1px solid rgba(48, 209, 88, 0.45)' : '1px solid rgba(255, 69, 58, 0.45)',
            color: justCompleted ? '#30D158' : '#FF5A52',
            fontSize: '10.5px',
            fontWeight: 600,
            textAlign: 'center',
            letterSpacing: '0.01em',
            zIndex: 3,
          }}
        >
          {measureFeedback}
        </div>
      )}
    </div>
  );
};
