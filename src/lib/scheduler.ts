import { createEmptyCard, fsrs, generatorParameters, type Card as FCard, type FSRS, type StepUnit } from 'ts-fsrs';
import type { Card, Collection, DeckSettings, Rating, SchedState } from './types';
import { dayKey } from './util';

export function newSched(now = Date.now()): SchedState {
  return fromF(createEmptyCard(new Date(now)));
}

function toF(s: SchedState): FCard {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    learning_steps: s.learningSteps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.lastReview ? new Date(s.lastReview) : undefined,
  };
}

function fromF(c: FCard): SchedState {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as SchedState['state'],
    lastReview: c.last_review ? c.last_review.getTime() : undefined,
  };
}

/** Parses "1m 10m 1h" into steps; returns null if anything is invalid. */
export function parseSteps(text: string): StepUnit[] | null {
  const parts = text.trim().split(/[\s,]+/).filter(Boolean);
  if (!parts.every((p) => /^\d+(\.\d+)?[mhd]$/.test(p))) return null;
  return parts as StepUnit[];
}

const cache = new Map<string, FSRS>();
function schedulerFor(s: DeckSettings): FSRS {
  const key = [s.retention, s.learningSteps, s.relearningSteps, s.maxIntervalDays, s.fuzz].join('|');
  let f = cache.get(key);
  if (!f) {
    f = fsrs(
      generatorParameters({
        request_retention: Math.min(0.99, Math.max(0.7, s.retention)),
        maximum_interval: Math.max(1, s.maxIntervalDays),
        enable_fuzz: s.fuzz,
        learning_steps: parseSteps(s.learningSteps) ?? ['1m', '10m'],
        relearning_steps: parseSteps(s.relearningSteps) ?? ['10m'],
      }),
    );
    cache.set(key, f);
  }
  return f;
}

/** Next due time for each answer button, without changing the card. */
export function previewDue(card: Card, settings: DeckSettings, now: number): Record<Rating, number> {
  const r = schedulerFor(settings).repeat(toF(card.s), new Date(now));
  return { 1: r[1].card.due.getTime(), 2: r[2].card.due.getTime(), 3: r[3].card.due.getTime(), 4: r[4].card.due.getTime() };
}

export interface UndoEntry {
  cardId: string;
  prev: SchedState;
  prevBuried: Record<string, string | undefined>;
  prevMiss: Card['miss'];
  reviewCount: number;
}

/** Records an answer: reschedules the card, logs the review and buries its sibling for today. */
export function answerCard(col: Collection, card: Card, rating: Rating, now: number, ms: number): UndoEntry {
  const deck = col.decks[card.deckId];
  const undo: UndoEntry = { cardId: card.id, prev: { ...card.s }, prevBuried: {}, prevMiss: card.miss && { ...card.miss }, reviewCount: col.reviews.length };
  const next = schedulerFor(deck.settings).next(toF(card.s), new Date(now), rating as 1 | 2 | 3 | 4);
  col.reviews.push({
    cardId: card.id,
    deckId: card.deckId,
    at: now,
    rating,
    state: card.s.state,
    ivl: next.card.scheduled_days,
    ms: Math.min(ms, 300_000),
  });
  card.s = fromF(next.card);
  markMistake(card, rating >= 3, rating === 1, now);

  // Bury siblings (the reverse card of the same note) until tomorrow, like Anki does.
  const today = dayKey(now, col.settings.dayStartHour);
  for (const other of Object.values(col.cards)) {
    if (other.noteId === card.noteId && other.id !== card.id && (other.s.state === 0 || other.s.state === 2)) {
      undo.prevBuried[other.id] = other.buriedUntil;
      other.buriedUntil = today;
    }
  }
  return undo;
}

export function undoAnswer(col: Collection, u: UndoEntry) {
  const card = col.cards[u.cardId];
  if (card) {
    card.s = u.prev;
    card.miss = u.prevMiss;
  }
  col.reviews.length = Math.min(col.reviews.length, u.reviewCount);
  for (const [id, b] of Object.entries(u.prevBuried)) if (col.cards[id]) col.cards[id].buriedUntil = b;
}

/** Cards answered correctly this many times after a mistake leave the Mistakes list. */
const MISS_CLEAR = 2;

/** Keeps the automatic Mistakes list up to date after any answer. */
function markMistake(card: Card, ok: boolean, wrong: boolean, now: number) {
  if (wrong) card.miss = { at: now, left: MISS_CLEAR };
  else if (ok && card.miss && --card.miss.left <= 0) card.miss = undefined;
}

/**
 * Extra practice from the Mistakes list. It doesn't change the card's schedule:
 * "Got it" counts towards clearing the mistake, "Again" puts it at the back of the line.
 */
export function practiceMistake(col: Collection, card: Card, ok: boolean, now: number) {
  if (!card.miss) return;
  if (ok) {
    card.miss.doneDay = dayKey(now, col.settings.dayStartHour);
    if (--card.miss.left <= 0) card.miss = undefined;
  } else {
    card.miss = { at: now, left: MISS_CLEAR };
  }
}

export function resetCard(card: Card) {
  card.miss = undefined;
  card.s = newSched();
  card.buriedUntil = undefined;
}
