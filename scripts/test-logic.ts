/// <reference types="node" />
// Logic tests that run without a phone: npm test
import assert from 'node:assert/strict';
import { addNote, applyDirections, createDeck, deleteDeck } from '../src/lib/collection';
import { htmlToMarkup, markupToHtml, mediaIn, plainText, sanitizeHtml } from '../src/lib/html';
import { parseDelimited, readImportFile } from '../src/lib/importers';
import { ALL, MISTAKES, deckCounts, mistakeCards, nextCard } from '../src/lib/queue';
import { answerCard, practiceMistake, undoAnswer } from '../src/lib/scheduler';
import { emptyCollection } from '../src/lib/types';
import { fromBase64 } from '../src/lib/util';
import { needsYouTube, parseTime, parseVideo, videoExtension, videoFilesIn, videosIn } from '../src/lib/video';
import { renderVideos } from '../src/components/cardHtml';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log('✓', name);
}

const MIN = 60_000;
const DAY = 86_400_000;
// A fixed "now" at noon so day boundaries (4am) are predictable.
const T0 = new Date(2026, 10, 14, 12, 0, 0).getTime();

function setup(n = 30) {
  const col = emptyCollection();
  const deck = createDeck(col, 'Unit 1', { newPerDay: 10, fuzz: false, directions: 'forward' });
  for (let i = 0; i < n; i++) addNote(col, deck.id, `front ${i}`, `back ${i}`);
  return { col, deck };
}

test('daily new-card limit', () => {
  const { col, deck } = setup();
  assert.deepEqual(deckCounts(col, deck.id, T0), { newCount: 10, learnCount: 0, reviewCount: 0 });
});

test('new cards come in order added', () => {
  const { col, deck } = setup();
  const n = nextCard(col, deck.id, T0, 0);
  assert.ok(n.card);
  assert.equal(col.notes[n.card.noteId].front, 'front 0');
});

test('Good on a new card → learning, due in ~10 min; Easy → review in days', () => {
  const { col, deck } = setup();
  const n = nextCard(col, deck.id, T0, 0);
  const card = n.card!;
  answerCard(col, card, 3, T0, 4000);
  assert.equal(card.s.state, 1);
  assert.ok(card.s.due - T0 >= 5 * MIN && card.s.due - T0 <= 15 * MIN, 'due ~10m');
  const c2 = nextCard(col, deck.id, T0 + 1000, 1).card!;
  answerCard(col, c2, 4, T0 + 1000, 3000);
  assert.equal(c2.s.state, 2);
  assert.ok(c2.s.due - T0 > DAY);
  assert.equal(deckCounts(col, deck.id, T0 + 2000).newCount, 8);
});

test('session finishes; learning card returns when due', () => {
  const { col, deck } = setup(1);
  const card = nextCard(col, deck.id, T0, 0).card!;
  answerCard(col, card, 1, T0, 1000); // Again → 1 minute
  const later = nextCard(col, deck.id, T0 + 2 * MIN, 1);
  assert.equal(later.card?.id, card.id);
  answerCard(col, card, 3, T0 + 2 * MIN, 1000); // → 10 min step
  answerCard(col, card, 3, T0 + 15 * MIN, 1000); // graduates
  assert.equal(card.s.state, 2);
  const done = nextCard(col, deck.id, T0 + 16 * MIN, 3);
  assert.equal(done.card, null);
  // Comes back as a review once due.
  const due = nextCard(col, deck.id, card.s.due + 1, 0);
  assert.equal(due.card?.id, card.id);
});

test('new day resets the new-card limit', () => {
  const { col, deck } = setup();
  for (let i = 0; i < 10; i++) answerCard(col, nextCard(col, deck.id, T0 + i, i).card!, 4, T0 + i, 1000);
  assert.equal(deckCounts(col, deck.id, T0 + 100).newCount, 0);
  assert.equal(deckCounts(col, deck.id, T0 + DAY).newCount, 10);
});

test('undo restores card and review log', () => {
  const { col, deck } = setup();
  const card = nextCard(col, deck.id, T0, 0).card!;
  const before = JSON.stringify(card.s);
  const u = answerCard(col, card, 3, T0, 1000);
  assert.equal(col.reviews.length, 1);
  undoAnswer(col, u);
  assert.equal(JSON.stringify(card.s), before);
  assert.equal(col.reviews.length, 0);
});

test('both directions: reverse cards created, sibling buried after answer', () => {
  const { col, deck } = setup(3);
  applyDirections(col, deck.id, 'both');
  assert.equal(Object.values(col.cards).length, 6);
  const first = nextCard(col, deck.id, T0, 0).card!;
  answerCard(col, first, 4, T0, 1000);
  const sibling = Object.values(col.cards).find((c) => c.noteId === first.noteId && c.id !== first.id)!;
  for (let i = 1; i < 6; i++) {
    const n = nextCard(col, deck.id, T0 + i, i).card;
    if (!n) break;
    assert.notEqual(n.id, sibling.id);
    answerCard(col, n, 4, T0 + i, 1000);
  }
  // Switching back suspends (doesn't delete) reverse cards, and switching again restores them.
  applyDirections(col, deck.id, 'forward');
  assert.equal(Object.values(col.cards).filter((c) => c.suspended).length, 3);
  applyDirections(col, deck.id, 'both');
  assert.equal(Object.values(col.cards).filter((c) => c.suspended).length, 0);
  assert.equal(Object.values(col.cards).length, 6);
});

test('delete deck removes everything', () => {
  const { col, deck } = setup(5);
  answerCard(col, nextCard(col, deck.id, T0, 0).card!, 3, T0, 1000);
  deleteDeck(col, deck.id);
  assert.equal(Object.keys(col.cards).length + Object.keys(col.notes).length + col.reviews.length, 0);
});

test('daily goal is shared by all decks', () => {
  const col = emptyCollection();
  col.settings.dailyNew = 20;
  const decks = ['A', 'B', 'C'].map((n) => createDeck(col, n, { fuzz: false }));
  for (const d of decks) for (let i = 0; i < 30; i++) addNote(col, d.id, `${d.name} ${i}`, `back ${i}`);
  // Three decks with 20/day each still only give 20 new cards in total.
  assert.equal(deckCounts(col, ALL, T0).newCount, 20);
  // Studying all decks spreads new cards evenly: 7 + 7 + 6.
  const seen: Record<string, number> = {};
  for (let i = 0; i < 20; i++) {
    const c = nextCard(col, ALL, T0 + i, i).card!;
    seen[c.deckId] = (seen[c.deckId] ?? 0) + 1;
    answerCard(col, c, 4, T0 + i, 1000);
  }
  assert.deepEqual(Object.values(seen).sort(), [6, 7, 7]);
  // Goal reached: no more new cards anywhere today, including from a single deck.
  assert.equal(deckCounts(col, ALL, T0 + 100).newCount, 0);
  assert.equal(deckCounts(col, decks[0].id, T0 + 100).newCount, 0);
  // Raising the goal in Settings gives more.
  col.settings.dailyNew = 30;
  assert.equal(deckCounts(col, ALL, T0 + 100).newCount, 10);
});

test('mistakes list: filled by Again, cleared after two correct answers', () => {
  const { col, deck } = setup(5);
  const a = nextCard(col, deck.id, T0, 0).card!;
  const u = answerCard(col, a, 1, T0, 1000); // Again → on the list
  assert.deepEqual(mistakeCards(col, T0).map((c) => c.id), [a.id]);
  undoAnswer(col, u);
  assert.equal(mistakeCards(col, T0).length, 0); // undo removes it again
  answerCard(col, a, 1, T0, 1000);
  const before = JSON.stringify(a.s);
  // Practice session: "Again" keeps it, "Got it" hides it for today; the schedule is untouched.
  assert.equal(nextCard(col, MISTAKES, T0, 0).card?.id, a.id);
  practiceMistake(col, a, false, T0 + 1);
  assert.equal(nextCard(col, MISTAKES, T0 + 2, 1).card?.id, a.id);
  practiceMistake(col, a, true, T0 + 3);
  assert.equal(nextCard(col, MISTAKES, T0 + 4, 2).card, null);
  assert.equal(JSON.stringify(a.s), before);
  assert.equal(mistakeCards(col, T0).length, 1); // still listed until right twice
  // A correct answer in normal study is the second success → cleared.
  answerCard(col, a, 3, T0 + 20 * MIN, 1000);
  assert.equal(mistakeCards(col, T0 + 20 * MIN).length, 0);
});

test('html sanitizer strips junk, keeps formatting', () => {
  assert.equal(sanitizeHtml('<div class="x" onclick="evil()"><p style="a">Hi <strong>there</strong><script>x</script></p></div>'), '<div><p>Hi <strong>there</strong></p></div>');
  assert.equal(sanitizeHtml('<img src="a.png" onerror="x">'), '<img src="a.png">');
});

test('editor markup round trip', () => {
  const html = '<p>Je <b>suis</b> <i>ici</i></p><p>[sound:a.m4a]</p>';
  const m = htmlToMarkup(html);
  assert.equal(m, 'Je **suis** *ici*\n[sound:a.m4a]');
  assert.equal(markupToHtml(m), 'Je <b>suis</b> <i>ici</i><br>[sound:a.m4a]');
  assert.equal(markupToHtml('a < b & c'), 'a &lt; b &amp; c');
});

test('CSV / TSV import', () => {
  const d = parseDelimited('bonjour\thello\n"le, chat"\tthe cat\n', 'x');
  assert.equal(d.notes.length, 2);
  assert.equal(d.notes[1].front, 'le, chat');
  const c = parseDelimited('un;one\ndeux;two', 'y');
  assert.equal(c.notes[1].back, 'two');
});

test('AnkiApp XML import', () => {
  const xml = `<deck name="Test" tags="French"><fields><rich-text name="Front" sides="11"></rich-text><rich-text name="Back" sides="01"></rich-text></fields><cards><card><rich-text name="Back">To ask</rich-text><rich-text name="Front">demander</rich-text></card><card><rich-text name="Front">&lt;p&gt;Hi&amp;nbsp;&lt;/p&gt;</rich-text><rich-text name="Back">Salut
ça va</rich-text></card></cards></deck>`;
  const r = readImportFile('x.xml', new TextEncoder().encode(xml));
  assert.equal(r.kind, 'decks');
  if (r.kind !== 'decks') return;
  assert.equal(r.decks[0].name, 'Test');
  assert.deepEqual(r.decks[0].notes[0], { front: 'demander', back: 'To ask', tags: ['French'] });
  assert.equal(r.decks[0].notes[1].back, 'Salut<br>ça va');
});

test('YouTube links: id, start and end times', () => {
  assert.deepEqual(parseVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m05s'), { kind: 'youtube', id: 'dQw4w9WgXcQ', start: 65, end: undefined, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m05s' });
  assert.equal(parseVideo('https://youtu.be/dQw4w9WgXcQ?t=42')?.kind, 'youtube');
  assert.equal((parseVideo('https://youtu.be/dQw4w9WgXcQ?t=42') as { start?: number }).start, 42);
  assert.equal((parseVideo('https://m.youtube.com/shorts/abcDEF12345') as { id: string }).id, 'abcDEF12345');
  assert.equal((parseVideo('https://www.youtube.com/embed/abcDEF12345?start=10&end=14') as { end?: number }).end, 14);
  assert.equal((parseVideo('https://www.youtube.com/embed/abcDEF12345?start=10&end=5') as { end?: number }).end, undefined);
  assert.equal(parseTime('1h2m3s'), 3723);
  assert.equal(parseTime('abc'), undefined);
});

test('other links and saved files', () => {
  assert.deepEqual(parseVideo('https://example.org/signs/mother.mp4'), { kind: 'direct', url: 'https://example.org/signs/mother.mp4' });
  assert.deepEqual(parseVideo('https://www.signingsavvy.com/sign/MOTHER/280/1'), { kind: 'page', url: 'https://www.signingsavvy.com/sign/MOTHER/280/1', host: 'signingsavvy.com' });
  assert.deepEqual(parseVideo('v-abc.mp4'), { kind: 'file', name: 'v-abc.mp4' });
  assert.equal(parseVideo('../etc/passwd'), null);
  assert.equal(parseVideo('https://www.youtube.com/channel/xyz')?.kind, 'page');
  assert.equal(videoExtension('file:///tmp/IMG_0001.MOV'), 'mov');
  assert.equal(videoExtension('blob:abc', 'video/quicktime'), 'mov');
  assert.equal(videoExtension('picked'), 'mp4');
});

test('video tokens in notes: media list, search text, markup round trip', () => {
  const front = markupToHtml('[video:https://youtu.be/dQw4w9WgXcQ?t=5&end=9]\nhandshape: flat B');
  assert.ok(front.includes('&amp;'), 'URL is escaped in stored HTML');
  assert.deepEqual(videosIn(front), ['https://youtu.be/dQw4w9WgXcQ?t=5&end=9']);
  assert.equal(htmlToMarkup(front), '[video:https://youtu.be/dQw4w9WgXcQ?t=5&end=9]\nhandshape: flat B');
  assert.ok(needsYouTube(front));
  const local = '[video:v-1.mov]<br>[sound:a.m4a]';
  assert.deepEqual(videoFilesIn(local), ['v-1.mov']);
  assert.deepEqual(mediaIn(local).sort(), ['a.m4a', 'v-1.mov']);
  assert.deepEqual(mediaIn(front), [], 'links are not media files');
  assert.equal(plainText(local), '🎬 🔊');
  assert.equal(markupToHtml('**hi** [video:https://youtu.be/ab__cd*ef*gh]'), '<b>hi</b> [video:https://youtu.be/ab__cd*ef*gh]');
});

test('card player HTML', () => {
  const yt = renderVideos('[video:https://youtu.be/dQw4w9WgXcQ?t=5&amp;end=9]');
  assert.ok(yt.includes('data-id="dQw4w9WgXcQ"') && yt.includes('data-start="5"') && yt.includes('data-end="9"'));
  const file = renderVideos('[video:v-1.mp4]', (n) => `blob:${n}`);
  assert.ok(file.includes('<video src="blob:v-1.mp4"') && file.includes('playsinline') && file.includes('data-act="speed"'));
  const page = renderVideos('[video:https://example.org/sign?a=1&amp;b="x"]');
  assert.ok(page.includes('data-open="https://example.org/sign?a=1&amp;b=&quot;x&quot;"') && page.includes('example.org'));
  assert.equal(renderVideos('[video:../x]'), '');
});

test('CSV import: a link becomes the sign video', () => {
  const d = parseDelimited('https://youtu.be/dQw4w9WgXcQ?t=30,mother,unit3\nhello,"hi there"', 'Class');
  assert.equal(d.notes[0].front, '[video:https://youtu.be/dQw4w9WgXcQ?t=30]');
  assert.deepEqual(d.notes[0].tags, ['unit3']);
  assert.equal(d.notes[1].back, 'hi there');
  assert.equal(d.directions, 'both');
});

test('decodes base64 audio', () => {
  for (const sample of ['', 'a', 'ab', 'abc', 'abcd', 'Bonjour ! Ça va ?']) {
    const bytes = Buffer.from(sample, 'utf8');
    assert.deepEqual(Buffer.from(fromBase64(bytes.toString('base64'))), bytes);
  }
  const big = Buffer.from(Array.from({ length: 5000 }, (_, i) => (i * 37) % 256));
  assert.deepEqual(Buffer.from(fromBase64(big.toString('base64'))), big);
});

console.log(`\n${passed} tests passed`);
