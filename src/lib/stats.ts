import type { Collection } from './types';
import { dayKey } from './util';

const DAY = 86_400_000;

/** Consecutive study days up to today (or yesterday, if nothing studied yet today). */
export function streakDays(col: Collection, now: number, deckId?: string): number {
  const h = col.settings.dayStartHour;
  const days = new Set<string>();
  for (const r of col.reviews) if (!deckId || r.deckId === deckId) days.add(dayKey(r.at, h));
  let streak = 0;
  for (let d = days.has(dayKey(now, h)) ? now : now - DAY; days.has(dayKey(d, h)); d -= DAY) streak++;
  return streak;
}

export function studiedToday(col: Collection, now: number, dayStartMs: number): number {
  let n = 0;
  for (let i = col.reviews.length - 1; i >= 0 && col.reviews[i].at >= dayStartMs; i--) n++;
  return now >= dayStartMs ? n : 0;
}

export interface DeckProgress {
  total: number;
  /** Cards that have been studied at least once. */
  seen: number;
  /** Review cards with an interval of 3 weeks or more. */
  mature: number;
}

export function deckProgress(col: Collection): Record<string, DeckProgress> {
  const out: Record<string, DeckProgress> = {};
  for (const c of Object.values(col.cards)) {
    if (c.suspended) continue;
    const p = (out[c.deckId] ??= { total: 0, seen: 0, mature: 0 });
    p.total++;
    if (c.s.state !== 0) p.seen++;
    if (c.s.state === 2 && c.s.scheduledDays >= 21) p.mature++;
  }
  return out;
}

/** Rough time estimate for a number of cards. */
export function estimateMinutes(cards: number): number {
  return Math.max(1, Math.round((cards * 10) / 60));
}
