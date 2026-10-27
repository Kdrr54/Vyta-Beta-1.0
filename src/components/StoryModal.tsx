import React, { useState, useEffect, useMemo } from 'react';
import { useModalAnimation } from '../hooks/useModalAnimation';
import {
  generateStoryDataUrl,
  getRunTrajectorySvgPath,
  StoryData,
  StoryTemplateVariant,
  DEFAULT_ROUTE_PATH_D,
  convertGpsPointsToSvgPath,
  getRunnerPosition,
} from '../lib/story';
import { Copy, ArrowDownCircle, Link2, Share, Check } from 'lucide-react';

interface StoryModalProps {
  data: StoryData;
  onClose: () => void;
}

const SLIDE_VARIANTS: StoryTemplateVariant[] = [
  'transparent',
  'satellite',
  'dark_gold',
  'telemetry',
];

export const StoryModal: React.FC<StoryModalProps> = ({ data, onClose }) => {
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const distStat = data.stats[0] || { label: 'Distance', value: '4.15', unit: 'km' };
  const paceStat = data.stats[1] || { label: 'Pace', value: '5:09', unit: '/km' };
  const timeStat = data.stats[2] || { label: 'Time', value: '30m 0s', unit: '' };
  const hrStat = data.stats[3] || { label: 'FC Moyenne', value: '156', unit: 'bpm' };

  const routeSvgPath = useMemo(
    () => getRunTrajectorySvgPath(120, 80, 6, data.routeProgress ?? 1),
    [data.routeProgress]
  );

  const currentProg =
    typeof data.routeProgress === 'number' && data.routeProgress > 0.02
      ? Math.min(1, data.routeProgress)
      : 1;
  const runnerPos = getRunnerPosition(currentProg);

  const trajectoryInfo = useMemo(() => {
    if (data.realGpsPoints && data.realGpsPoints.length >= 2) {
      return convertGpsPointsToSvgPath(data.realGpsPoints, 360, 230, 36);
    }
    return {
      pathD: DEFAULT_ROUTE_PATH_D,
      startPoint: { x: 40, y: 170 },
      endPoint: { x: 320, y: 60 },
    };
  }, [data.realGpsPoints]);

  useEffect(() => {
    const variant = SLIDE_VARIANTS[activeSlide] || 'transparent';
    generateStoryDataUrl(data, variant).then((url) => setDataUrl(url));
  }, [data, activeSlide]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2200);
  };

  const handleSaveImage = () => {
    if (!dataUrl) return;
    const variant = SLIDE_VARIANTS[activeSlide] || 'transparent';
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `vyta-${data.mode}-${variant}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    triggerToast('Image enregistrée (PNG)');
  };

  const handleCopyToClipboard = async () => {
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
          }),
        ]);
        triggerToast('Sticker copié dans le presse-papiers !');
      } else {
        handleSaveImage();
      }
    } catch {
      handleSaveImage();
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      triggerToast('Lien copié !');
    } catch {
      triggerToast('Lien copié !');
    }
  };

  const handleMoreShare = async () => {
    if (!dataUrl) return;
    try {
      if (navigator.share) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], 'vyta-activity.png', { type: 'image/png' });
        await navigator.share({
          title: 'Vyta Activity',
          text: `${data.title} — ${distStat.value} ${distStat.unit || ''}`,
          files: [file],
        });
      } else {
        handleSaveImage();
      }
    } catch {
      // Ignored
    }
  };

  const handleInstagramStory = async () => {
    await handleCopyToClipboard();
    triggerToast('Sticker prêt pour Instagram Story !');
  };

  const renderCardContent = (variant: StoryTemplateVariant) => {
    const currentProg =
      typeof data.routeProgress === 'number' && data.routeProgress > 0.02
        ? Math.min(1, data.routeProgress)
        : 1;
    const runnerPos = getRunnerPosition(currentProg);

    if (variant === 'transparent') {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            backgroundColor: '#1E1E21',
            backgroundImage: `
              linear-gradient(45deg, #2A2A2E 25%, transparent 25%),
              linear-gradient(-45deg, #2A2A2E 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #2A2A2E 75%),
              linear-gradient(-45deg, transparent 75%, #2A2A2E 75%)
            `,
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 14px 22px 14px',
            boxSizing: 'border-box',
            userSelect: 'none',
          }}
        >
          {/* Top-left TRANSPARENT outlined badge */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
            <span
              style={{
                border: '1px solid rgba(255, 255, 255, 0.65)',
                color: '#FFFFFF',
                fontSize: '8.5px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                padding: '2px 6px',
                textTransform: 'uppercase',
                background: 'rgba(0, 0, 0, 0.25)',
              }}
            >
              TRANSPARENT
            </span>
          </div>

          {/* 3 Stacked Stats (Distance, Pace, Time) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              marginTop: '4px',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.78)',
                  marginBottom: '1px',
                }}
              >
                {distStat.label}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '23px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                {distStat.value} {distStat.unit}
              </span>
            </div>

            <div style={{ textAlign: 'center' }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.78)',
                  marginBottom: '1px',
                }}
              >
                {paceStat.label}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '23px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                {paceStat.value} {paceStat.unit}
              </span>
            </div>

            <div style={{ textAlign: 'center' }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.78)',
                  marginBottom: '1px',
                }}
              >
                {timeStat.label}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '23px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                {timeStat.value}
              </span>
            </div>
          </div>

          {/* Trajectoire réelle synchronisée de la course (Course uniquement) */}
          {data.mode === 'run' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0' }}>
              <svg width="130" height="85" viewBox="0 0 360 230" fill="none">
                <path
                  d={trajectoryInfo.pathD}
                  pathLength={100}
                  strokeDasharray={`${Math.max(1, currentProg * 100)} 200`}
                  strokeDashoffset={0}
                  stroke="#FFFFFF"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: 'drop-shadow(0 2px 8px rgba(255,255,255,0.6))' }}
                />
                <circle cx={trajectoryInfo.startPoint.x} cy={trajectoryInfo.startPoint.y} r="7" fill="#FFFFFF" stroke="#000000" strokeWidth="2.5" />
                <circle cx={trajectoryInfo.startPoint.x} cy={trajectoryInfo.startPoint.y} r="3" fill="#000000" />
                <circle cx={trajectoryInfo.endPoint.x} cy={trajectoryInfo.endPoint.y} r="7" fill="#007AFF" stroke="#FFFFFF" strokeWidth="2.5" />
                <circle cx={trajectoryInfo.endPoint.x} cy={trajectoryInfo.endPoint.y} r="3" fill="#FFFFFF" />
              </svg>
            </div>
          )}

          {/* Bottom Geometric Wordmark */}
          <div
            style={{
              fontSize: '17px',
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '0.14em',
              fontFamily: 'var(--font-display), -apple-system, BlinkMacSystemFont, sans-serif',
            }}
          >
            VYTA
          </div>
        </div>
      );
    }

    if (variant === 'satellite') {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            background: 'linear-gradient(165deg, #141417 0%, #1E1E22 45%, #0D0D10 100%)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '16px',
            boxSizing: 'border-box',
            overflow: 'hidden',
            userSelect: 'none',
          }}
        >
          {/* Monochrome Aerial Map Blocks & Streets */}
          <svg
            viewBox="0 0 200 340"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: 0.5,
              pointerEvents: 'none',
            }}
            preserveAspectRatio="xMidYMid slice"
          >
            <g stroke="#3A3A3E" strokeWidth="1.5" fill="#18181B">
              <polygon points="10,45 85,38 92,85 15,92" />
              <polygon points="102,35 188,48 180,98 100,86" />
              <polygon points="18,105 90,98 84,165 12,158" />
              <polygon points="102,98 185,110 175,175 96,165" />
              <polygon points="15,178 88,175 82,248 10,240" />
              <polygon points="98,178 182,186 172,255 94,248" />
              <polygon points="14,258 175,266 168,330 12,325" />
            </g>
            <path
              d="M -10 95 Q 95 85 210 105 M 95 20 L 88 340"
              stroke="#525258"
              strokeWidth="3.5"
              fill="none"
            />
          </svg>

          <div style={{ position: 'relative', zIndex: 2 }} />

          {/* Center Route Trace on Monochrome Map (Course uniquement) */}
          {data.mode === 'run' && (
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center' }}>
              <svg width="140" height="90" viewBox="0 0 360 230" fill="none">
                <path
                  d={trajectoryInfo.pathD}
                  pathLength={100}
                  strokeDasharray={`${Math.max(1, currentProg * 100)} 200`}
                  strokeDashoffset={0}
                  stroke="#FFFFFF"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: 'drop-shadow(0 2px 10px rgba(255,255,255,0.6))' }}
                />
                <circle cx={trajectoryInfo.startPoint.x} cy={trajectoryInfo.startPoint.y} r="7" fill="#FFFFFF" stroke="#000000" strokeWidth="2.5" />
                <circle cx={trajectoryInfo.startPoint.x} cy={trajectoryInfo.startPoint.y} r="3" fill="#000000" />
                <circle cx={trajectoryInfo.endPoint.x} cy={trajectoryInfo.endPoint.y} r="7" fill="#007AFF" stroke="#FFFFFF" strokeWidth="2.5" />
                <circle cx={trajectoryInfo.endPoint.x} cy={trajectoryInfo.endPoint.y} r="3" fill="#FFFFFF" />
              </svg>
            </div>
          )}

          {/* Bottom Stats Overlay */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              background: 'rgba(10, 10, 12, 0.82)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '10px 10px 8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'left' }}>
              <div>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.65)', display: 'block' }}>
                  {distStat.label}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF' }}>
                  {distStat.value} {distStat.unit}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.65)', display: 'block' }}>
                  {paceStat.label}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF' }}>
                  {paceStat.value} {paceStat.unit}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.65)', display: 'block' }}>
                  {timeStat.label}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF' }}>
                  {timeStat.value}
                </span>
              </div>
            </div>
            <div
              style={{
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 900,
                letterSpacing: '0.16em',
                color: '#FFFFFF',
              }}
            >
              VYTA
            </div>
          </div>
        </div>
      );
    }

    const isLight = variant === 'telemetry';
    const fg = isLight ? '#000000' : '#FFFFFF';
    const subFg = isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.65)';
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: isLight
            ? '#F5F5F7'
            : 'radial-gradient(circle at 50% 35%, #1C1C20 0%, #050507 75%)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 14px 22px 14px',
          boxSizing: 'border-box',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '10px', color: subFg }}>
              {distStat.label}
            </span>
            <span style={{ fontSize: '22px', fontWeight: 800, color: fg }}>
              {distStat.value} {distStat.unit}
            </span>
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '10px', color: subFg }}>
              {paceStat.label}
            </span>
            <span style={{ fontSize: '22px', fontWeight: 800, color: fg }}>
              {paceStat.value} {paceStat.unit}
            </span>
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '10px', color: subFg }}>
              {isLight ? hrStat.label : timeStat.label}
            </span>
            <span style={{ fontSize: '22px', fontWeight: 800, color: fg }}>
              {isLight ? `${hrStat.value} ${hrStat.unit || ''}` : timeStat.value}
            </span>
          </div>
        </div>

        {data.mode === 'run' && (
          <svg width="125" height="85" viewBox="0 0 360 230" fill="none">
            <path
              d={trajectoryInfo.pathD}
              pathLength={100}
              strokeDasharray={`${Math.max(1, currentProg * 100)} 200`}
              strokeDashoffset={0}
              stroke={fg}
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={trajectoryInfo.startPoint.x} cy={trajectoryInfo.startPoint.y} r="7" fill={fg} stroke={isLight ? '#F5F5F7' : '#050507'} strokeWidth="2.5" />
            <circle cx={trajectoryInfo.startPoint.x} cy={trajectoryInfo.startPoint.y} r="3" fill={isLight ? '#F5F5F7' : '#050507'} />
            <circle cx={trajectoryInfo.endPoint.x} cy={trajectoryInfo.endPoint.y} r="7" fill={fg} stroke={isLight ? '#F5F5F7' : '#050507'} strokeWidth="2.5" />
            <circle cx={trajectoryInfo.endPoint.x} cy={trajectoryInfo.endPoint.y} r="3" fill={isLight ? '#F5F5F7' : '#050507'} />
          </svg>
        )}

        <div style={{ fontSize: '17px', fontWeight: 900, color: fg, letterSpacing: '0.14em' }}>
          VYTA
        </div>
      </div>
    );
  };

  return (
    <div
      className={`modal-backdrop ${isClosing ? "is-closing" : ""}`}
      onClick={handleClose}
      style={{
        zIndex: 180,
        background: 'rgba(0, 0, 0, 0.72)',
        alignItems: 'flex-end',
      }}
    >
      <div
        className={`modal-sheet ${isClosing ? "is-closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          height: '93%',
          background: '#0D0D10',
          borderTop: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '24px 24px 0 0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: '#FFFFFF',
          overflow: 'hidden',
          boxShadow: '0 -20px 50px rgba(0, 0, 0, 0.85)',
          position: 'relative',
          paddingBottom: '18px',
        }}
      >
        {/* 1. Top Navigation Header: Close | Share Activity */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '70px 1fr 70px',
            alignItems: 'center',
            padding: '15px 16px 13px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              margin: 0,
              textAlign: 'left',
              fontSize: '14.5px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Fermer
          </button>

          <span
            style={{
              textAlign: 'center',
              fontSize: '15.5px',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.01em',
            }}
          >
            Partager l'activité
          </span>

          <div />
        </div>

        {/* Toast feedback banner */}
        {toastMsg && (
          <div
            style={{
              position: 'absolute',
              top: '56px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#FFFFFF',
              color: '#000000',
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '11.5px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              zIndex: 40,
              boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
              whiteSpace: 'nowrap',
            }}
          >
            <Check size={13} color="#000000" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* 2. Horizontal Card Carousel with right-card peek + 4 dots */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            width: '100%',
            overflow: 'hidden',
            paddingTop: '8px',
          }}
          onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchStartX === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX;
            if (dx < -35 && activeSlide < SLIDE_VARIANTS.length - 1) {
              setActiveSlide(activeSlide + 1);
            } else if (dx > 35 && activeSlide > 0) {
              setActiveSlide(activeSlide - 1);
            }
            setTouchStartX(null);
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '352px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {SLIDE_VARIANTS.map((variant, idx) => {
              const offset = idx - activeSlide;
              const isCurrent = offset === 0;
              return (
                <div
                  key={variant}
                  onClick={() => setActiveSlide(idx)}
                  style={{
                    position: 'absolute',
                    width: '204px',
                    height: isCurrent ? '348px' : '296px',
                    transform: `translateX(${offset * 224}px)`,
                    transition: 'all 320ms cubic-bezier(0.22, 1, 0.36, 1)',
                    boxShadow: isCurrent
                      ? '0 16px 36px rgba(0, 0, 0, 0.65)'
                      : '0 8px 20px rgba(0, 0, 0, 0.4)',
                    cursor: isCurrent ? 'default' : 'pointer',
                    overflow: 'hidden',
                    zIndex: isCurrent ? 10 : 5,
                    opacity: Math.abs(offset) > 1 ? 0 : 1,
                    pointerEvents: Math.abs(offset) > 1 ? 'none' : 'auto',
                  }}
                >
                  {renderCardContent(variant)}
                </div>
              );
            })}
          </div>

          {/* 4 Pagination Dots */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '16px',
            }}
          >
            {SLIDE_VARIANTS.map((v, idx) => (
              <button
                key={v}
                type="button"
                aria-label={`Modèle ${idx + 1}`}
                onClick={() => setActiveSlide(idx)}
                style={{
                  width: '6.5px',
                  height: '6.5px',
                  borderRadius: '50%',
                  border: 'none',
                  padding: 0,
                  background: idx === activeSlide ? '#FFFFFF' : 'rgba(255, 255, 255, 0.25)',
                  cursor: 'pointer',
                  transition: 'background 200ms ease',
                }}
              />
            ))}
          </div>
        </div>

        {/* 3. "Partager sur" Section at Bottom */}
        <div
          style={{
            width: '100%',
            padding: '4px 20px 6px 20px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.01em',
            }}
          >
            Partager sur
          </span>

          {/* Row 1: Instagram Story */}
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <button
              type="button"
              onClick={handleInstagramStory}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                width: '68px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(255, 255, 255, 0.15)',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  lineHeight: 1.15,
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  textAlign: 'center',
                }}
              >
                Instagram
                <br />
                Story
              </span>
            </button>
          </div>

          {/* Row 2: Copier | Enregistrer | Copier le lien | Plus */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              justifyItems: 'center',
              marginTop: '2px',
            }}
          >
            {/* Copier */}
            <button
              type="button"
              onClick={handleCopyToClipboard}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                }}
              >
                <Copy size={20} strokeWidth={1.9} />
              </div>
              <span
                style={{
                  fontSize: '11px',
                  lineHeight: 1.15,
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                }}
              >
                Copier
              </span>
            </button>

            {/* Enregistrer */}
            <button
              type="button"
              onClick={handleSaveImage}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                }}
              >
                <ArrowDownCircle size={21} strokeWidth={1.9} />
              </div>
              <span
                style={{
                  fontSize: '11px',
                  lineHeight: 1.15,
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                }}
              >
                Enregistrer
              </span>
            </button>

            {/* Copier le lien */}
            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                }}
              >
                <Link2 size={20} strokeWidth={1.9} />
              </div>
              <span
                style={{
                  fontSize: '11px',
                  lineHeight: 1.15,
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                }}
              >
                Copier le lien
              </span>
            </button>

            {/* Plus */}
            <button
              type="button"
              onClick={handleMoreShare}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                }}
              >
                <Share size={20} strokeWidth={1.9} />
              </div>
              <span
                style={{
                  fontSize: '11px',
                  lineHeight: 1.15,
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                }}
              >
                Plus
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
