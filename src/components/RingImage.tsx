import React from 'react';
import { useApp } from '../context/AppContext';
import { finishes, RING_IMAGE } from '../data/health';

interface RingImageProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  noShadow?: boolean;
  angle?: 'front' | 'angle-left' | 'angle-right';
}

export const RingImage: React.FC<RingImageProps> = ({
  size = 155,
  className = '',
  style = {},
  noShadow = false,
  angle = 'front',
}) => {
  const { finish } = useApp();
  const currentFinish = finishes.find((f) => f.id === finish) || finishes[1];
  const imageSrc = angle === 'angle-left' 
    ? '/assets/ring/ring-angle-left.png' 
    : angle === 'angle-right'
    ? '/assets/ring/ring-iso-transparent.png'
    : RING_IMAGE;

  const shadowFilter = noShadow || size < 40 
    ? 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6))' 
    : 'drop-shadow(0 16px 24px rgba(0, 0, 0, 0.9))';

  return (
    <div
      className={`ring-image-container ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <img
        src={imageSrc}
        alt="Stoic Ring One"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: `${shadowFilter} ${currentFinish.imgFilter}`,
          transition: 'filter 320ms ease, transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
      {currentFinish.tint && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: currentFinish.tint,
            mixBlendMode: 'color',
            pointerEvents: 'none',
            maskImage: `url(${RING_IMAGE})`,
            WebkitMaskImage: `url(${RING_IMAGE})`,
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
            opacity: 0.65,
          }}
        />
      )}
    </div>
  );
};
