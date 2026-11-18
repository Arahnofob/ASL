const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const KEEP = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'div', 'ul', 'ol', 'li', 'sub', 'sup', 'hr', 'img', 'h1', 'h2', 'h3', 'blockquote', 'code', 'pre', 'table', 'tr', 'td', 'th', 'tbody', 'thead']);

/**
 * Keeps simple formatting and drops everything else (classes, styles, scripts, unknown tags).
 * Pasted web content often carries lots of junk markup; this makes it render cleanly.
 */
export function sanitizeHtml(html: string): string {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|head|title)\b[\s\S]*?<\/\1\s*>/gi, '');
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (m, tag: string, attrs: string) => {
    const t = tag.toLowerCase();
    if (!KEEP.has(t)) return '';
    const closing = m.startsWith('</');
    if (closing) return `</${t}>`;
    if (t === 'img') {
      const src = /\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
      const v = src ? (src[2] ?? src[3]) : '';
      return v && !/^\s*javascript:/i.test(v) ? `<img src="${escapeHtml(decodeEntities(v))}">` : '';
    }
    return `<${t}>`;
  });
  return s.replace(/(<p>\s*(&nbsp;| |\s)*<\/p>\s*)+$/g, '').trim();
}

/** Text only, for lists and search. */
export function plainText(html: string): string {
  return decodeEntities(
    html
      .replace(/\[sound:[^\]]+\]/g, '🔊')
      .replace(/\[video:[^\]]+\]/g, '🎬')
      .replace(/<img[^>]*>/gi, '🖼')
      .replace(/<(br|\/p|\/div|\/li)[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[\s ]+/g, ' ')
    .trim();
}

/*
 * Editing format: plain text with light markup, so cards can be edited comfortably on a phone.
 *   **bold**   *italic*   __underline__   [image:file.png]   [sound:file.m4a]   [video:file.mp4 or link]
 * Line breaks are kept.
 */

export function htmlToMarkup(html: string): string {
  let s = html
    .replace(/\r/g, '')
    .replace(/>\s*\n\s*</g, '><')
    .replace(/\n/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|blockquote|tr)>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<(b|strong)>/gi, '**')
    .replace(/<\/(b|strong)>/gi, '**')
    .replace(/<(i|em)>/gi, '*')
    .replace(/<\/(i|em)>/gi, '*')
    .replace(/<u>/gi, '__')
    .replace(/<\/u>/gi, '__')
    .replace(/<img[^>]*\bsrc="([^"]*)"[^>]*>/gi, (_m, src: string) => `[image:${decodeEntities(src)}]`)
    .replace(/<hr>/gi, '\n---\n')
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s).replace(/ /g, ' ');
  return s
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\*\*\s*\*\*/g, '')
    .trim();
}

export function markupToHtml(text: string): string {
  // Media tokens (e.g. links with __ or * in them) are kept out of the formatting rules.
  const kept: string[] = [];
  let s = escapeHtml(text.replace(/\r/g, '').trim()).replace(/\[(video|sound|image):[^\]\n]+\]/g, (m) => `\u0000${kept.push(m) - 1}\u0000`);
  s = s
    .replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\n]+?)\*/g, '$1<i>$2</i>')
    .replace(/__([\s\S]+?)__/g, '<u>$1</u>')
    .replace(/^---$/gm, '<hr>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => kept[Number(i)]);
  return s
    .replace(/\[image:([^\]]+)\]/g, (_m, f: string) => `<img src="${f}">`)
    .replace(/\n/g, '<br>');
}

/** Filenames of [sound:...] references, in order. */
export function soundsIn(html: string): string[] {
  return [...html.matchAll(/\[sound:([^\]]+)\]/g)].map((m) => m[1]);
}

/** Replaces [sound:x] with a tappable speaker button for the card renderer. */
export function renderSounds(html: string): string {
  return html.replace(/\[sound:([^\]]+)\]/g, (_m, f: string) => `<button class="snd" data-snd="${escapeHtml(f)}" aria-label="Play audio">🔊</button>`);
}

export function mediaIn(html: string): string[] {
  const out = soundsIn(html);
  for (const m of html.matchAll(/<img[^>]*\bsrc="([^"]+)"/gi)) out.push(decodeEntities(m[1]));
  // Saved sign videos ([video:file.mp4]); links ([video:https://…]) aren't files.
  for (const m of html.matchAll(/\[video:([^\]]+)\]/g)) {
    const v = decodeEntities(m[1]).trim();
    if (!/^https?:\/\//i.test(v)) out.push(v);
  }
  return out;
}
