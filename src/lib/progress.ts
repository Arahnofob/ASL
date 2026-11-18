import type { Collection } from './types';
import { dayStart } from './util';

const DAY = 86_400_000;

export interface ProgressPoint {
  t: number; // start of the study day
  v: number; // share of cards started, 0..1
}

export interface DeckPlan {
  total: number;
  started: number;
  /** Planned new cards per day (deck limit). */
  pace: number;
  /** Average new cards per day over the last 14 days. */
  recentPace: number;
  /** Days until every card has been started at the planned pace (null if pace is 0). */
  daysLeft: number | null;
  finishAt: number | null;
  history: ProgressPoint[];
  projection: ProgressPoint[];
  reviewsToday: number;
}

/** Progress = share of (unsuspended) cards studied at least once; projection at the planned pace. */
export function deckPlan(col: Collection, deckId: string, now: number): DeckPlan {
  const h = col.settings.dayStartHour;
  const today = dayStart(now, h);
  const deck = col.decks[deckId];
  let total = 0;
  let started = 0;
  const ids = new Set<string>();
  for (const c of Object.values(col.cards)) {
    if (c.deckId !== deckId || c.suspended) continue;
    total++;
    ids.add(c.id);
    if (c.s.state !== 0) started++;
  }

  // First review of each card = the day it was started.
  const firstSeen = new Map<string, number>();
  let reviewsToday = 0;
  for (const r of col.reviews) {
    if (r.deckId !== deckId) continue;
    if (r.at >= today) reviewsToday++;
    if (r.state === 0 && ids.has(r.cardId) && !firstSeen.has(r.cardId)) firstSeen.set(r.cardId, r.at);
  }
  const perDay = new Map<number, number>();
  for (const at of firstSeen.values()) {
    const d = dayStart(at, h);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  // Cards started before history was kept (or reset) count from the beginning.
  const baseline = Math.max(0, started - firstSeen.size);
  const firstDay = perDay.size ? Math.min(...perDay.keys()) : today;
  const from = Math.min(firstDay, today - 13 * DAY);
  const history: ProgressPoint[] = [];
  let cum = baseline;
  for (let d = from; d <= today; d += DAY) {
    cum += perDay.get(d) ?? 0;
    history.push({ t: d, v: total ? Math.min(1, cum / total) : 0 });
  }
  // Use the real current value for today (handles resets/suspensions exactly).
  history[history.length - 1].v = total ? started / total : 0;

  let recent = 0;
  for (const [d, n] of perDay) if (d > today - 14 * DAY) recent += n;
  const recentPace = Math.round((recent / 14) * 10) / 10;

  const pace = deck?.settings.newPerDay ?? 0;
  const remaining = total - started;
  const daysLeft = remaining === 0 ? 0 : pace > 0 ? Math.ceil(remaining / pace) : null;
  const finishAt = daysLeft === null ? null : today + daysLeft * DAY;
  const projection: ProgressPoint[] = [];
  if (daysLeft !== null && total) {
    const step = Math.max(1, Math.ceil(daysLeft / 60));
    for (let i = 0; i <= daysLeft; i += step) projection.push({ t: today + i * DAY, v: Math.min(1, (started + i * pace) / total) });
    projection.push({ t: today + daysLeft * DAY, v: 1 });
  }
  return { total, started, pace, recentPace, daysLeft, finishAt, history, projection, reviewsToday };
}
