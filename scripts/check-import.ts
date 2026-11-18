/// <reference types="node" />
// Usage: npx tsx scripts/check-import.ts <file>
import { readFileSync } from 'node:fs';
import { readImportFile } from '../src/lib/importers';
import { htmlToMarkup, markupToHtml, plainText } from '../src/lib/html';

const path = process.argv[2];
const r = readImportFile(path, new Uint8Array(readFileSync(path)));
if (r.kind !== 'decks') throw new Error('expected decks');
console.log('source', r.source, 'media', Object.keys(r.media).length, 'warnings', r.warnings);
for (const d of r.decks) {
  console.log(`deck "${d.name}": ${d.notes.length} notes; empty fronts ${d.notes.filter((n) => !n.front).length}, empty backs ${d.notes.filter((n) => !n.back).length}`);
  const withSound = d.notes.filter((n) => /\[sound:/.test(n.front + n.back));
  console.log('notes with sound', withSound.length, withSound[0]);
  const longest = [...d.notes].sort((a, b) => b.front.length + b.back.length - a.front.length - a.back.length)[0];
  console.log('longest note:', longest);
  for (const n of d.notes.slice(0, 6)) console.log(JSON.stringify(plainText(n.front)), '→', JSON.stringify(plainText(n.back)));
  // Round trip through the editor format should not lose text.
  let lost = 0;
  for (const n of d.notes) for (const f of [n.front, n.back]) if (plainText(markupToHtml(htmlToMarkup(f))) !== plainText(f)) { if (lost++ < 3) console.log('ROUNDTRIP DIFF', JSON.stringify(plainText(f)), JSON.stringify(plainText(markupToHtml(htmlToMarkup(f))))); }
  console.log('roundtrip differences', lost);
}
