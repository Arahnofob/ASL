import type { Card, Collection, Deck } from './types';
import { dayEnd, dayKey, dayStart, hash01 } from './util';

/** Study scope: one deck id, or every deck together. */
export const ALL = 'all';
/** Study scope: the automatic list of recently missed cards (extra practice). */
export const MISTAKES = 'mistakes';
const MISTAKE_DAYS = 30;

/** Recently missed cards, oldest mistake first. `forPractice` leaves out the ones already practised today. */
export function mistakeCards(col: Collection, now: number, forPractice = false): Card[] {
  const today = dayKey(now, col.settings.dayStartHour);
  const since = now - MISTAKE_DAYS * 86_400_000;
  return Object.values(col.cards)
    .filter((c) => c.miss && !c.suspended && c.miss.at >= since && col.decks[c.deckId] && !(forPractice && c.miss.doneDay === today))
    .sort((a, b) => a.miss!.at - b.miss!.at);
}

/** Learning cards due within this window are shown early when nothing else is left. */
const LEARN_AHEAD_MS = 20 * 60_000;

interface Done {
  newDone: number;
  reviewsDone: number;
}

interface TodayStats {
  total: Done;
  byDeck: Map<string, Done>;
}

/** New cards introduced and reviews done today, overall and per deck. */
export function todayStats(col: Collection, now: number): TodayStats {
  const start = dayStart(now, col.settings.dayStartHour);
  const total: Done = { newDone: 0, reviewsDone: 0 };
  const byDeck = new Map<string, Done>();
  for (let i = col.reviews.length - 1; i >= 0; i--) {
    const r = col.reviews[i];
    if (r.at < start) break;
    const d = byDeck.get(r.deckId) ?? { newDone: 0, reviewsDone: 0 };
    if (r.state === 0) {
      d.newDone++;
      total.newDone++;
    } else if (r.state === 2) {
      d.reviewsDone++;
      total.reviewsDone++;
    }
    byDeck.set(r.deckId, d);
  }
  return { total, byDeck };
}

const extraToday = (deck: Deck, today: string) => (deck.extraNew?.day === today ? deck.extraNew.count : 0);

export interface DeckQueue {
  learnNow: Card[];
  learnLater: Card[];
  reviews: Card[];
  news: Card[];
}

/** One deck's candidates, each list capped by that deck's own limits. */
function deckCandidates(col: Collection, deck: Deck, now: number, stats: TodayStats): DeckQueue {
  const today = dayKey(now, col.settings.dayStartHour);
  const end = dayEnd(now, col.settings.dayStartHour);
  const q: DeckQueue = { learnNow: [], learnLater: [], reviews: [], news: [] };
  for (const c of Object.values(col.cards)) {
    if (c.deckId !== deck.id || c.suspended || c.buriedUntil === today) continue;
    const st = c.s.state;
    if (st === 1 || st === 3) {
      if (c.s.due <= now) q.learnNow.push(c);
      else if (c.s.due < end) q.learnLater.push(c);
    } else if (st === 2) {
      if (c.s.due < end) q.reviews.push(c);
    } else {
      q.news.push(c);
    }
  }
  const done = stats.byDeck.get(deck.id) ?? { newDone: 0, reviewsDone: 0 };
  q.reviews.sort((a, b) => a.s.due - b.s.due);
  q.reviews = q.reviews.slice(0, Math.max(0, deck.settings.reviewsPerDay - done.reviewsDone));
  if (deck.settings.newOrder === 'random') q.news.sort((a, b) => hash01(a.noteId + today) - hash01(b.noteId + today) || a.order - b.order);
  else q.news.sort((a, b) => a.order - b.order);
  q.news = q.news.slice(0, Math.max(0, deck.settings.newPerDay + extraToday(deck, today) - done.newDone));
  return q;
}

/**
 * The cards available now for a deck or for all decks, with both the per-deck limits
 * and the overall daily goal (Settings) applied. With several decks, new cards are
 * shared out evenly between them.
 */
export function buildQueue(col: Collection, scope: string, now: number): DeckQueue {
  if (scope === MISTAKES) return { learnNow: mistakeCards(col, now, true), learnLater: [], reviews: [], news: [] };
  const decks = scope === ALL ? Object.values(col.decks).sort((a, b) => a.name.localeCompare(b.name)) : col.decks[scope] ? [col.decks[scope]] : [];
  const q: DeckQueue = { learnNow: [], learnLater: [], reviews: [], news: [] };
  if (!decks.length) return q;
  const stats = todayStats(col, now);
  const today = dayKey(now, col.settings.dayStartHour);
  const per = decks.map((d) => ({ deck: d, q: deckCandidates(col, d, now, stats) }));

  for (const p of per) {
    q.learnNow.push(...p.q.learnNow);
    q.learnLater.push(...p.q.learnLater);
    q.reviews.push(...p.q.reviews);
  }
  q.learnNow.sort((a, b) => a.s.due - b.s.due);
  q.learnLater.sort((a, b) => a.s.due - b.s.due);
  q.reviews.sort((a, b) => a.s.due - b.s.due);
  q.reviews = q.reviews.slice(0, Math.max(0, col.settings.dailyReviews - stats.total.reviewsDone));

  // "Learn more today" boosts lift the overall goal too.
  const extras = decks.reduce((a, d) => a + extraToday(d, today), 0);
  const newCap = Math.max(0, col.settings.dailyNew + extras - stats.total.newDone);
  if (per.length === 1) {
    q.news = per[0].q.news.slice(0, newCap);
  } else {
    // Round-robin: next new card comes from the deck that has introduced the fewest today.
    const taken = per.map((p) => (stats.byDeck.get(p.deck.id)?.newDone ?? 0));
    const idx = per.map(() => 0);
    while (q.news.length < newCap) {
      let best = -1;
      for (let i = 0; i < per.length; i++) {
        if (idx[i] >= per[i].q.news.length) continue;
        if (best < 0 || taken[i] < taken[best]) best = i;
      }
      if (best < 0) break;
      q.news.push(per[best].q.news[idx[best]++]);
      taken[best]++;
    }
  }
  return q;
}

export interface Counts {
  newCount: number;
  learnCount: number;
  reviewCount: number;
}

export function deckCounts(col: Collection, scope: string, now: number): Counts {
  const q = buildQueue(col, scope, now);
  return { newCount: q.news.length, learnCount: q.learnNow.length + q.learnLater.length, reviewCount: q.reviews.length };
}

export type Next = { card: Card } | { card: null; nextLearnAt?: number };

/**
 * Picks the next card to study.
 * `answered` = cards answered so far in this session (used to spread new cards among reviews).
 * `lastId` = previous card, to avoid showing the same card twice in a row when possible.
 */
export function nextCard(col: Collection, scope: string, now: number, answered: number, lastId?: string): Next {
  const q = buildQueue(col, scope, now);
  const pickLearn = (list: Card[]) => list.find((c) => c.id !== lastId) ?? list[0];

  if (q.learnNow.length) {
    const others = q.reviews.length + q.news.length;
    if (q.learnNow.some((c) => c.id !== lastId) || others === 0) return { card: pickLearn(q.learnNow) };
  }

  const r = q.reviews[0];
  const n = q.news[0];
  if (r && n) {
    const mix = scope === ALL ? 'mixed' : (col.decks[scope]?.settings.newMix ?? 'mixed');
    if (mix === 'before') return { card: n };
    if (mix === 'after') return { card: r };
    const every = Math.max(1, Math.round((q.reviews.length + q.news.length) / q.news.length));
    return { card: answered % every === every - 1 ? n : r };
  }
  if (r) return { card: r };
  if (n) return { card: n };

  if (q.learnNow.length) return { card: q.learnNow[0] };
  const soon = q.learnLater.filter((c) => c.s.due - now <= LEARN_AHEAD_MS);
  if (soon.length) return { card: pickLearn(soon) };
  return { card: null, nextLearnAt: q.learnLater[0]?.s.due };
}
