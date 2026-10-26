import { useEffect } from 'react';

/*!
 * Apple-style Liquid Glass Refraction Engine
 * Generates an SVG displacement map with chromatic aberration for realistic rim refraction
 * and automatic frosted-blur fallback for Safari and Firefox.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
let uid = 0;
let svgDefs: SVGDefsElement | null = null;

export const isLiquidGlassSupported = (): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const ua = navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  if (isSafari || isFirefox) return false;
  if (!('supports' in CSS) || !CSS.supports('backdrop-filter', 'url(#lg)')) return false;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    return !!c.getContext('2d')?.getImageData(0, 0, 1, 1);
  } catch (_) {
    return false;
  }
};

function ensureDefs(): SVGDefsElement {
  if (svgDefs && svgDefs.isConnected) return svgDefs;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.style.pointerEvents = 'none';
  svg.style.overflow = 'hidden';
  svgDefs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(svgDefs);
  document.body.appendChild(svg);
  return svgDefs;
}

function makeMap(w: number, h: number, radius: number, border: number, mapBlur: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(w));
  canvas.height = Math.max(1, Math.floor(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const gx = ctx.createLinearGradient(0, 0, w, 0);
  gx.addColorStop(0, 'rgb(0,0,0)');
  gx.addColorStop(1, 'rgb(255,0,0)');
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, w, h);

  const gy = ctx.createLinearGradient(0, 0, 0, h);
  gy.addColorStop(0, 'rgb(0,0,0)');
  gy.addColorStop(1, 'rgb(0,0,255)');
  ctx.globalCompositeOperation = 'difference';
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'source-over';
  const inset = border * Math.min(w, h);
  ctx.filter = `blur(${mapBlur}px)`;
  ctx.fillStyle = 'rgba(128,128,128,0.94)';
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(inset, inset, w - inset * 2, h - inset * 2, Math.max(radius - inset, 2));
  } else {
    ctx.rect(inset, inset, w - inset * 2, h - inset * 2);
  }
  ctx.fill();
  ctx.filter = 'none';
  return canvas.toDataURL();
}

export interface LiquidGlassOptions {
  scale?: number;
  chroma?: number;
  border?: number;
  mapBlur?: number;
  blur?: number;
  saturate?: number;
  radius?: number | null;
  fallbackBlur?: number;
}

export interface LiquidGlassHandle {
  supported: boolean;
  refresh: () => void;
  destroy: () => void;
}

export function applyLiquidGlass(el: HTMLElement, opts: LiquidGlassOptions = {}): LiquidGlassHandle {
  const o = {
    scale: opts.scale ?? -95,
    chroma: opts.chroma ?? 6,
    border: opts.border ?? 0.08,
    mapBlur: opts.mapBlur ?? 14,
    blur: opts.blur ?? 4,
    saturate: opts.saturate ?? 2.1,
    radius: opts.radius ?? null,
    fallbackBlur: opts.fallbackBlur ?? 32,
  };

  const supported = isLiquidGlassSupported();

  if (!supported) {
    el.classList.add('lg-fallback');
    return {
      supported: false,
      refresh: () => {},
      destroy: () => {
        el.classList.remove('lg-fallback');
      },
    };
  }

  const id = `lg-filter-${++uid}`;
  const scales = [o.scale, o.scale + o.chroma, o.scale + 2 * o.chroma];

  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', '100%');
  filter.setAttribute('height', '100%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const feImage = document.createElementNS(SVG_NS, 'feImage');
  feImage.setAttribute('x', '0');
  feImage.setAttribute('y', '0');
  feImage.setAttribute('result', 'map');
  feImage.setAttribute('preserveAspectRatio', 'none');
  filter.appendChild(feImage);

  const keep = [
    '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
    '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
    '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
  ];
  const channels: string[] = [];
  for (let i = 0; i < 3; i++) {
    const disp = document.createElementNS(SVG_NS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'map');
    disp.setAttribute('scale', String(scales[i]));
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'B');
    disp.setAttribute('result', `d${i}`);
    filter.appendChild(disp);

    const cm = document.createElementNS(SVG_NS, 'feColorMatrix');
    cm.setAttribute('in', `d${i}`);
    cm.setAttribute('type', 'matrix');
    cm.setAttribute('values', keep[i]);
    cm.setAttribute('result', `c${i}`);
    filter.appendChild(cm);
    channels.push(`c${i}`);
  }

  const blend1 = document.createElementNS(SVG_NS, 'feBlend');
  blend1.setAttribute('in', channels[0]);
  blend1.setAttribute('in2', channels[1]);
  blend1.setAttribute('mode', 'screen');
  blend1.setAttribute('result', 'c01');
  filter.appendChild(blend1);

  const blend2 = document.createElementNS(SVG_NS, 'feBlend');
  blend2.setAttribute('in', 'c01');
  blend2.setAttribute('in2', channels[2]);
  blend2.setAttribute('mode', 'screen');
  filter.appendChild(blend2);

  ensureDefs().appendChild(filter);

  function resolveRadius(): number {
    if (o.radius != null) return o.radius;
    const raw = getComputedStyle(el).borderTopLeftRadius || '32px';
    const v = parseFloat(raw) || 32;
    return raw.trim().endsWith('%') ? (v / 100) * Math.min(el.offsetWidth, el.offsetHeight) : v;
  }

  function refresh() {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h) return;
    const r = resolveRadius();
    feImage.setAttribute('href', makeMap(w, h, r, o.border, o.mapBlur));
    feImage.setAttribute('width', String(w));
    feImage.setAttribute('height', String(h));
  }

  refresh();
  el.style.backdropFilter = `url(#${id}) blur(${o.blur}px) saturate(${o.saturate})`;
  (el.style as any).webkitBackdropFilter = `url(#${id}) blur(${o.blur}px) saturate(${o.saturate})`;

  let timer: any = null;
  const ro = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 100);
  });
  ro.observe(el);

  return {
    supported: true,
    refresh,
    destroy: () => {
      ro.disconnect();
      clearTimeout(timer);
      filter.remove();
      el.style.backdropFilter = '';
      (el.style as any).webkitBackdropFilter = '';
    },
  };
}

export function useLiquidGlass(
  ref: React.RefObject<HTMLElement | null>,
  opts?: LiquidGlassOptions
) {
  useEffect(() => {
    if (!ref.current) return;
    const handle = applyLiquidGlass(ref.current, opts);
    return () => handle.destroy();
  }, [ref, opts?.scale, opts?.chroma, opts?.border]);
}
