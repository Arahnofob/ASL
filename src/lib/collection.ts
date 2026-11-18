import { newSched } from './scheduler';
import { DEFAULT_DECK_SETTINGS, type Card, type Collection, type Deck, type DeckSettings, type Direction, type DirectionsSetting, type Note } from './types';
import { uid } from './util';

export function createDeck(col: Collection, name: string, settings?: Partial<DeckSettings>): Deck {
  const deck: Deck = { id: uid(), name: name.trim() || 'New deck', createdAt: Date.now(), settings: { ...DEFAULT_DECK_SETTINGS, ...settings } };
  col.decks[deck.id] = deck;
  return deck;
}

export function sortedDecks(col: Collection): Deck[] {
  return Object.values(col.decks).sort((a, b) => a.name.localeCompare(b.name));
}

function maxOrder(col: Collection, deckId: string) {
  let m = 0;
  for (const c of Object.values(col.cards)) if (c.deckId === deckId && c.order > m) m = c.order;
  return m;
}

function wantedDirs(setting: DirectionsSetting): Direction[] {
  return setting === 'both' ? ['forward', 'reverse'] : [setting];
}

function makeCard(note: Note, dir: Direction, order: number): Card {
  return { id: uid(), noteId: note.id, deckId: note.deckId, dir, s: newSched(), order };
}

/** Adds a note and creates its cards according to the deck's direction setting. */
export function addNote(col: Collection, deckId: string, front: string, back: string, tags: string[] = [], orderHint?: number): Note {
  const now = Date.now();
  const note: Note = { id: uid(), deckId, front, back, tags, createdAt: now, modifiedAt: now };
  col.notes[note.id] = note;
  const order = orderHint ?? maxOrder(col, deckId) + 1;
  for (const dir of wantedDirs(col.decks[deckId].settings.directions)) {
    const card = makeCard(note, dir, order);
    col.cards[card.id] = card;
  }
  return note;
}

export function cardsOfNote(col: Collection, noteId: string): Card[] {
  return Object.values(col.cards).filter((c) => c.noteId === noteId);
}

export function deleteNote(col: Collection, noteId: string) {
  for (const c of cardsOfNote(col, noteId)) delete col.cards[c.id];
  delete col.notes[noteId];
}

export function moveNote(col: Collection, noteId: string, deckId: string) {
  const note = col.notes[noteId];
  if (!note || note.deckId === deckId) return;
  note.deckId = deckId;
  for (const c of cardsOfNote(col, noteId)) c.deckId = deckId;
}

export function deleteDeck(col: Collection, deckId: string) {
  for (const n of Object.values(col.notes)) if (n.deckId === deckId) deleteNote(col, n.id);
  col.reviews = col.reviews.filter((r) => r.deckId !== deckId);
  delete col.decks[deckId];
}

/**
 * Changes which directions are studied. Missing cards are created as new;
 * cards for directions no longer wanted are suspended (not deleted) so their progress is kept.
 */
export function applyDirections(col: Collection, deckId: string, setting: DirectionsSetting) {
  const deck = col.decks[deckId];
  deck.settings.directions = setting;
  const wanted = new Set(wantedDirs(setting));
  const byNote = new Map<string, Card[]>();
  for (const c of Object.values(col.cards)) {
    if (c.deckId !== deckId) continue;
    const list = byNote.get(c.noteId) ?? [];
    list.push(c);
    byNote.set(c.noteId, list);
  }
  for (const note of Object.values(col.notes)) {
    if (note.deckId !== deckId) continue;
    const cards = byNote.get(note.id) ?? [];
    const order = cards[0]?.order ?? maxOrder(col, deckId) + 1;
    for (const dir of wanted) {
      const existing = cards.find((c) => c.dir === dir);
      if (existing) {
        if (existing.suspended && existing.autoSuspended) {
          existing.suspended = false;
          delete existing.autoSuspended;
        }
      } else {
        const card = makeCard(note, dir, order);
        col.cards[card.id] = card;
      }
    }
    for (const c of cards) {
      if (!wanted.has(c.dir) && !c.suspended) {
        c.suspended = true;
        c.autoSuspended = true;
      }
    }
  }
}

export function noteKey(front: string, back: string) {
  return `${front.trim()}\u0001${back.trim()}`;
}
