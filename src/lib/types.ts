/** Which side of a note is shown as the question. */
export type Direction = 'forward' | 'reverse';
export type DirectionsSetting = 'forward' | 'reverse' | 'both';
/** Only flashcards for now; kept as a type so saved settings stay compatible. */
export type StudyMode = 'flip';

/** 0 = New, 1 = Learning, 2 = Review, 3 = Relearning (same numbering as FSRS / Anki). */
export type CardState = 0 | 1 | 2 | 3;
export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

export interface DeckSettings {
  newPerDay: number;
  reviewsPerDay: number;
  /** Desired retention for FSRS, e.g. 0.9 = aim to remember 90% of cards. */
  retention: number;
  /** Space separated, e.g. "1m 10m". Units: m, h, d. */
  learningSteps: string;
  relearningSteps: string;
  maxIntervalDays: number;
  fuzz: boolean;
  newOrder: 'added' | 'random';
  newMix: 'mixed' | 'after' | 'before';
  directions: DirectionsSetting;
  autoplayAudio: boolean;
  /** Last study mode used for this deck. */
  studyMode: StudyMode;
  /** Extra CSS applied to this deck's cards. */
  css: string;
}

export interface Deck {
  id: string;
  name: string;
  createdAt: number;
  settings: DeckSettings;
  /** "Study more new cards today" boost. */
  extraNew?: { day: string; count: number };
}

export interface Note {
  id: string;
  deckId: string;
  /**
   * HTML. Audio is written as [sound:file.m4a], images as <img src="file.png">, and sign videos as
   * [video:file.mp4] (a saved file) or [video:https://…] (a link, e.g. YouTube, played from the site).
   */
  front: string;
  back: string;
  tags: string[];
  createdAt: number;
  modifiedAt: number;
}

export interface SchedState {
  due: number; // ms timestamp
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReview?: number;
}

export interface Card {
  id: string;
  noteId: string;
  deckId: string;
  dir: Direction;
  s: SchedState;
  /** Position in the new-card queue. */
  order: number;
  suspended?: boolean;
  /** Suspended because its direction was switched off in deck options. */
  autoSuspended?: boolean;
  /** Day key (see dates.ts) until which the card is hidden. */
  buriedUntil?: string;
  /**
   * Set when the card was answered "Again": it joins the automatic Mistakes list until it has
   * been answered correctly `left` more times. `doneDay` = already practised today.
   */
  miss?: { at: number; left: number; doneDay?: string };
}

export interface Review {
  cardId: string;
  deckId: string;
  at: number;
  rating: Rating;
  /** State of the card *before* this answer. */
  state: CardState;
  /** Interval given by this answer, in days (0 for learning steps). */
  ivl: number;
  ms: number;
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  fontSize: number;
  align: 'center' | 'left';
  /** Where the card text sits: vertically centred (like AnkiApp) or at the top. */
  cardPosition: 'middle' | 'top';
  /** Daily goal across all decks: new cards per day. Adding decks doesn't raise it. */
  dailyNew: number;
  /** Daily cap across all decks: reviews per day. */
  dailyReviews: number;
  /** Cards per study session before a short break screen; 0 = no limit. */
  sessionSize: number;
  /** Study mode used for "study all decks". */
  lastMode: StudyMode;
  /** Daily reminder notification. */
  reminderOn: boolean;
  reminderHour: number;
  reminderMinute: number;
  /** Hour at which a new study day starts (Anki uses 4am). */
  dayStartHour: number;
  showIntervals: boolean;
  showRemaining: boolean;
  /** CSS applied to every card. */
  globalCss: string;
  /** Playback speed of sign videos when a card opens (1 = normal). */
  videoSpeed: number;
  /** Show sign videos mirrored, as if the signer were your reflection. */
  videoMirror: boolean;
}

export interface Collection {
  version: 1;
  decks: Record<string, Deck>;
  notes: Record<string, Note>;
  cards: Record<string, Card>;
  reviews: Review[];
  settings: AppSettings;
  /** Data migrations already applied. */
  migrated?: { mistakes?: boolean };
}

export const DEFAULT_DECK_SETTINGS: DeckSettings = {
  newPerDay: 20,
  reviewsPerDay: 200,
  retention: 0.9,
  learningSteps: '1m 10m',
  relearningSteps: '10m',
  maxIntervalDays: 36500,
  fuzz: true,
  newOrder: 'added',
  newMix: 'mixed',
  // Both: recognise the sign (video → English) and produce it (English → video).
  directions: 'both',
  autoplayAudio: true,
  studyMode: 'flip',
  css: '',
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'system',
  fontSize: 24,
  align: 'center',
  cardPosition: 'middle',
  dailyNew: 20,
  dailyReviews: 200,
  sessionSize: 0,
  lastMode: 'flip',
  reminderOn: false,
  reminderHour: 19,
  reminderMinute: 0,
  dayStartHour: 4,
  showIntervals: true,
  showRemaining: true,
  globalCss: '',
  videoSpeed: 1,
  videoMirror: false,
};

export function emptyCollection(): Collection {
  return { version: 1, decks: {}, notes: {}, cards: {}, reviews: [], settings: { ...DEFAULT_APP_SETTINGS } };
}

/** Fill in any settings added in later versions of the app. */
export function normalizeCollection(c: Collection): Collection {
  c.settings = { ...DEFAULT_APP_SETTINGS, ...(c.settings ?? {}) };
  if ((c.settings.lastMode as string) !== 'flip') c.settings.lastMode = 'flip';
  c.decks ??= {};
  c.notes ??= {};
  c.cards ??= {};
  c.reviews ??= [];
  for (const d of Object.values(c.decks)) {
    d.settings = { ...DEFAULT_DECK_SETTINGS, ...(d.settings ?? {}) };
    if ((d.settings.studyMode as string) !== 'flip') d.settings.studyMode = 'flip';
  }
  // One-time: build the Mistakes list from the last two weeks of review history.
  if (!c.migrated?.mistakes) {
    const since = Date.now() - 14 * 86_400_000;
    for (const r of c.reviews) {
      if (r.at < since) continue;
      const card = c.cards[r.cardId];
      if (!card) continue;
      if (r.rating === 1) card.miss = { at: r.at, left: 2 };
      else if (r.rating >= 3 && card.miss && --card.miss.left <= 0) delete card.miss;
    }
    c.migrated = { ...c.migrated, mistakes: true };
  }
  return c;
}
