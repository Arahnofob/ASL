import { strFromU8, unzipSync } from 'fflate';
import { decodeEntities, escapeHtml, sanitizeHtml } from './html';
import type { Collection, DirectionsSetting } from './types';
import { normalizeCollection } from './types';

export interface ImportedNote {
  front: string;
  back: string;
  tags: string[];
}

export interface ImportedDeck {
  name: string;
  notes: ImportedNote[];
  directions: DirectionsSetting;
}

export type ImportResult =
  | { kind: 'decks'; source: string; decks: ImportedDeck[]; media: Record<string, Uint8Array>; warnings: string[] }
  | { kind: 'backup'; collection: Collection; media: Record<string, Uint8Array> };

/** Guess a file extension from the first bytes of a media file. */
export function sniffMedia(b: Uint8Array): { ext: string; kind: 'audio' | 'image' } | null {
  const ascii = (from: number, len: number) => String.fromCharCode(...b.subarray(from, from + len));
  if (b[0] === 0x89 && ascii(1, 3) === 'PNG') return { ext: 'png', kind: 'image' };
  if (b[0] === 0xff && b[1] === 0xd8) return { ext: 'jpg', kind: 'image' };
  if (ascii(0, 3) === 'GIF') return { ext: 'gif', kind: 'image' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return { ext: 'webp', kind: 'image' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return { ext: 'wav', kind: 'audio' };
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4);
    if (/^(heic|heix|mif1|avif)/.test(brand)) return { ext: brand === 'avif' ? 'avif' : 'heic', kind: 'image' };
    return { ext: 'm4a', kind: 'audio' };
  }
  if (ascii(0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { ext: 'mp3', kind: 'audio' };
  if (ascii(0, 4) === 'OggS') return { ext: 'ogg', kind: 'audio' };
  if (/^\s*<svg|^\s*<\?xml/.test(ascii(0, 32))) return { ext: 'svg', kind: 'image' };
  return null;
}

function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`).exec(attrs);
  return m ? decodeEntities(m[2] ?? m[3]) : undefined;
}

/**
 * AnkiApp ("Anki App" by Admium) XML export:
 *   <deck name="..." tags="..."><fields><rich-text name="Front" sides="11"/>...</fields>
 *   <cards><card><rich-text name="Front">escaped html</rich-text>...</card></cards></deck>
 * Media are separate files in blobs/<id>, referenced as {{blob <id>}}.
 * `sides` is a bitmask: first digit = shown on question side, second = shown on answer side.
 */
export function parseAnkiAppXml(xml: string, blobs: Record<string, Uint8Array>, media: Record<string, Uint8Array>, warnings: string[]): ImportedDeck[] {
  const decks: ImportedDeck[] = [];
  const blobName = new Map<string, { file: string; kind: 'audio' | 'image' } | null>();
  const resolveBlob = (id: string) => {
    if (!blobName.has(id)) {
      const bytes = blobs[id];
      const t = bytes ? sniffMedia(bytes) : null;
      if (bytes && t) {
        const file = `${t.kind === 'audio' ? 'sound' : 'image'}-${id.slice(0, 10).toLowerCase()}.${t.ext}`;
        media[file] = bytes;
        blobName.set(id, { file, kind: t.kind });
      } else {
        blobName.set(id, null);
        warnings.push(bytes ? `Unknown media type for ${id}, skipped.` : `Missing media file ${id}, skipped.`);
      }
    }
    return blobName.get(id);
  };

  for (const dm of xml.matchAll(/<deck\b([^>]*)>([\s\S]*?)<\/deck>/g)) {
    const name = (attr(dm[1], 'name') ?? 'Imported deck').trim() || 'Imported deck';
    const deckTags = (attr(dm[1], 'tags') ?? '').split(/[\s,]+/).filter(Boolean);
    const body = dm[2];

    const fields: { name: string; type: string; q: boolean; a: boolean }[] = [];
    const fm = /<fields>([\s\S]*?)<\/fields>/.exec(body);
    if (fm) {
      for (const f of fm[1].matchAll(/<([a-zA-Z-]+)\b([^>]*?)\/?>/g)) {
        if (f[1].startsWith('/')) continue;
        const fname = attr(f[2], 'name');
        if (!fname) continue;
        const sides = attr(f[2], 'sides') ?? '11';
        fields.push({ name: fname, type: f[1], q: sides[0] === '1', a: sides[1] !== '0' });
      }
    }

    const notes: ImportedNote[] = [];
    for (const cm of body.matchAll(/<card\b([^>]*)>([\s\S]*?)<\/card>/g)) {
      const values: Record<string, string> = {};
      for (const v of cm[2].matchAll(/<([a-zA-Z-]+)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g)) {
        const fname = attr(v[2], 'name');
        if (!fname) continue;
        const raw = decodeEntities(v[3] ?? '');
        let html = v[1] === 'rich-text' ? raw : escapeHtml(raw);
        // Plain text typed with line breaks (no HTML block tags): keep the line breaks.
        if (!/<(p|div|br|li)\b/i.test(html)) html = html.trim().replace(/\n/g, '<br>');
        html = html.replace(/\{\{blob\s+([0-9a-fA-F]+)\s*\}\}/g, (_m, id: string) => {
          const b = resolveBlob(id);
          if (!b) return '';
          return b.kind === 'audio' ? `[sound:${b.file}]` : `<img src="${b.file}">`;
        });
        values[fname] = sanitizeHtml(html);
      }
      const defs = fields.length ? fields : Object.keys(values).map((n, i) => ({ name: n, type: 'rich-text', q: i === 0, a: true }));
      const join = (list: string[]) => list.filter((x) => x.trim()).join('<br>');
      const front = join(defs.filter((d) => d.q).map((d) => values[d.name] ?? ''));
      const back = join(defs.filter((d) => !d.q && d.a).map((d) => values[d.name] ?? ''));
      const cardTags = (attr(cm[1], 'tags') ?? '').split(/[\s,]+/).filter(Boolean);
      if (front || back) notes.push({ front, back, tags: [...new Set([...deckTags, ...cardTags])] });
    }
    decks.push({ name, notes, directions: 'forward' });
  }
  return decks;
}

/** Tab / semicolon / comma separated text: first column = front, second = back, optional third = tags. */
export function parseDelimited(text: string, name: string): ImportedDeck {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
  const sample = lines.slice(0, 20).join('\n');
  const delim = ['\t', ';', ','].map((d) => [d, sample.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"' && cur === '') quoted = true;
      else if (ch === delim) {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  // A field that is just a link becomes a sign video, e.g.  https://youtu.be/abc?t=30, mother
  const toHtml = (s: string) =>
    /^https?:\/\/\S+$/i.test(s.trim()) ? `[video:${escapeHtml(s.trim())}]` : /<[a-z][^>]*>/i.test(s) ? sanitizeHtml(s) : escapeHtml(s.trim());
  const notes = lines
    .map(parseLine)
    .filter((cols) => cols.length >= 2)
    .map((cols) => ({ front: toHtml(cols[0]), back: toHtml(cols[1]), tags: (cols[2] ?? '').split(/\s+/).filter(Boolean) }));
  const hasVideo = notes.some((n) => n.front.startsWith('[video:') || n.back.startsWith('[video:'));
  return { name, notes, directions: hasVideo ? 'both' : 'forward' };
}

const baseName = (path: string) => path.split('/').pop() ?? path;
const stripExt = (n: string) => n.replace(/\.[^.]+$/, '');

/** Reads any supported file and returns what's inside. Throws with a readable message on failure. */
export function readImportFile(fileName: string, bytes: Uint8Array): ImportResult {
  const lower = fileName.toLowerCase();
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;

  if (lower.endsWith('.apkg') || lower.endsWith('.colpkg')) {
    throw new Error(
      'This is an Anki desktop/AnkiMobile package (.apkg). Importing those isn\'t supported yet — export from AnkiApp (XML/zip) or as a text/CSV file instead.',
    );
  }

  if (isZip) {
    const files = unzipSync(bytes);
    const names = Object.keys(files).filter((n) => !n.startsWith('__MACOSX/') && !n.endsWith('/'));

    const colFile = names.find((n) => baseName(n) === 'collection.json');
    if (colFile) {
      const collection = normalizeCollection(JSON.parse(strFromU8(files[colFile])));
      const media: Record<string, Uint8Array> = {};
      for (const n of names) if (n.includes('media/')) media[baseName(n)] = files[n];
      return { kind: 'backup', collection, media };
    }

    const xmls = names.filter((n) => n.toLowerCase().endsWith('.xml'));
    if (xmls.length) {
      const blobs: Record<string, Uint8Array> = {};
      for (const n of names) if (/(^|\/)blobs\/[^/]+$/.test(n)) blobs[baseName(n)] = files[n];
      const media: Record<string, Uint8Array> = {};
      const warnings: string[] = [];
      const decks = xmls.flatMap((n) => parseAnkiAppXml(strFromU8(files[n]), blobs, media, warnings));
      return { kind: 'decks', source: 'AnkiApp', decks, media, warnings };
    }

    const texts = names.filter((n) => /\.(csv|tsv|txt)$/i.test(n));
    if (texts.length) {
      return { kind: 'decks', source: 'Text', decks: texts.map((n) => parseDelimited(strFromU8(files[n]), stripExt(baseName(n)))), media: {}, warnings: [] };
    }
    throw new Error('No cards found in this zip. Supported: AnkiApp export (.zip with .xml), backups from this app, CSV/TXT.');
  }

  const text = strFromU8(bytes);
  if (/<deck\b/.test(text)) {
    const media: Record<string, Uint8Array> = {};
    const warnings: string[] = [];
    const decks = parseAnkiAppXml(text, {}, media, warnings);
    return { kind: 'decks', source: 'AnkiApp', decks, media, warnings };
  }
  const deck = parseDelimited(text, stripExt(baseName(fileName)));
  if (!deck.notes.length) throw new Error('Couldn\'t find any cards in this file.');
  return { kind: 'decks', source: 'Text', decks: [deck], media: {}, warnings: [] };
}
