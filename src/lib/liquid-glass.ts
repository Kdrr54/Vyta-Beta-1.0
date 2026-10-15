import { useEffect, useRef } from 'react';

export interface LiquidGlassOptions {
  scale?: number;       // default -112 (negative = magnifying bulge)
  chroma?: number;      // default 6 (chromatic dispersion fringe)
  border?: number;      // default 0.07 (inset fraction)
  mapBlur?: number;     // default 12 (px edge curvature softness)
  blur?: number;        // default 3 (px backdrop blur)
  saturate?: number;    // default 1.5 (boost)
  radius?: number;      // override border-radius in px
  fallbackBlur?: number;// default 16 (px for Safari/Firefox)
}

export interface LiquidGlassInstance {
  supported: boolean;
  refresh: () => void;
  destroy: () => void;
}

declare global {
  interface Window {
    liquidGlass?: (el: HTMLElement, opts?: LiquidGlassOptions) => LiquidGlassInstance;
  }
}

export function useLiquidGlass<T extends HTMLElement>(options?: LiquidGlassOptions) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof window !== 'undefined' && window.liquidGlass) {
      const instance = window.liquidGlass(el, {
        scale: -90,
        chroma: 5,
        border: 0.08,
        mapBlur: 14,
        blur: 16,
        saturate: 1.6,
        fallbackBlur: 20,
        ...options
      });

      return () => {
        instance?.destroy();
      };
    }
  }, [options]);

  return ref;
}
