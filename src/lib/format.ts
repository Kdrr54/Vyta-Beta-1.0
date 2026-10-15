export const pad = (n: number): string => String(n).padStart(2, '0');

/** 442 -> "7 h 22" ; 45 -> "45 min" */
export const fmtDuration = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h} h ${pad(m)}` : `${m} min`;
};

/** Clock time `startMin` minutes after `base` (HH:MM). */
export const fmtClock = (startMin: number, base = '23:15'): string => {
  const [h, m] = base.split(':').map(Number);
  const t = (h * 60 + m + startMin) % (24 * 60);
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
};

/** 309 -> "5:09" */
export const fmtMMSS = (totalSec: number): string => {
  const s = Math.round(totalSec);
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
};

/** 2512 -> "41:52" (no leading hour for runs under 1h) */
export const fmtClockSec = (totalSec: number): string => {
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
};

export const fmtNum = (n: number, decimals = 0): string => {
  const parts = n.toFixed(decimals).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decimals > 0 ? parts.join(',') : parts[0];
};

export const signed = (n: number, decimals = 0): string => {
  const abs = fmtNum(Math.abs(n), decimals);
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return abs;
};
