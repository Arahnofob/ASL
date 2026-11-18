export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const DAY = 86_400_000;

/** Study day for a timestamp, as "YYYY-MM-DD", where a day starts at `startHour` local time. */
export function dayKey(ts: number, startHour: number): string {
  const d = new Date(ts - startHour * 3_600_000);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Timestamp at which the current study day started. */
export function dayStart(now: number, startHour: number): number {
  const d = new Date(now);
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), startHour, 0, 0, 0).getTime();
  return s <= now ? s : s - DAY;
}

export function dayEnd(now: number, startHour: number): number {
  return dayStart(now, startHour) + DAY;
}

/** Short human interval, e.g. "<1m", "10m", "3h", "4d", "2.1mo", "1.3y". */
export function fmtInterval(ms: number): string {
  const min = ms / 60_000;
  if (min < 1) return '<1m';
  if (min < 60) return `${Math.round(min)}m`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  if (d < 30) return `${Math.round(d)}d`;
  if (d < 365) return `${(d / 30).toFixed(1).replace(/\.0$/, '')}mo`;
  return `${(d / 365).toFixed(1).replace(/\.0$/, '')}y`;
}

/** Deterministic pseudo-random number in [0,1) from a string — used for "random" new-card order. */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decodes base64 (no dependency on atob, which not every JS engine has). */
export function fromBase64(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64_CHARS.indexOf(clean[i]) << 18) | (B64_CHARS.indexOf(clean[i + 1]) << 12) | ((B64_CHARS.indexOf(clean[i + 2]) & 63) << 6) | (B64_CHARS.indexOf(clean[i + 3]) & 63);
    out[o++] = (n >> 16) & 255;
    if (clean[i + 2] !== undefined) out[o++] = (n >> 8) & 255;
    if (clean[i + 3] !== undefined) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}
