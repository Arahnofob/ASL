// Sign videos on cards.
//
// A card holds a video as a token in its HTML, like sounds and images:
//   [video:v-abc123.mp4]                  a file saved in the app (from Photos, the camera or Files)
//   [video:https://youtu.be/xyz?t=12]     a link, played from the original site (nothing is copied)
//
// Links can be YouTube (embedded with YouTube's own player), a direct video file (.mp4 etc.),
// or any other page (shown as a button that opens it).

import { decodeEntities } from './html';

export type VideoSource =
  | { kind: 'file'; name: string }
  | { kind: 'youtube'; id: string; start?: number; end?: number; url: string }
  | { kind: 'direct'; url: string }
  | { kind: 'page'; url: string; host: string };

const VIDEO_EXT = /\.(mp4|m4v|mov|webm)$/i;
const TOKEN = /\[video:([^\]]+)\]/g;

export function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

/** Raw values of the [video:…] tokens in a note side, in order. */
export function videosIn(html: string): string[] {
  return [...html.matchAll(TOKEN)].map((m) => decodeEntities(m[1]).trim());
}

/** Names of saved video files referenced by a note side (links are skipped). */
export function videoFilesIn(html: string): string[] {
  return videosIn(html).filter((v) => !isUrl(v));
}

export function videoToken(value: string): string {
  return `[video:${value.trim()}]`;
}

/** "1m05s", "65", "65s", "1h2m3s" → seconds. */
export function parseTime(v: string | null | undefined): number | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.floor(Number(s));
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(s);
  if (!m || !(m[1] || m[2] || m[3])) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function youtubeId(u: URL): string | null {
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  const ok = (id: string | null | undefined) => (id && /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : null);
  if (host === 'youtu.be') return ok(u.pathname.split('/')[1]);
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null;
  if (u.pathname === '/watch') return ok(u.searchParams.get('v'));
  const m = /^\/(embed|shorts|live|v)\/([^/?#]+)/.exec(u.pathname);
  return m ? ok(m[2]) : null;
}

/** Works out how to play a [video:…] value. Returns null for an unusable value. */
export function parseVideo(value: string): VideoSource | null {
  const v = value.trim();
  if (!v) return null;
  if (!isUrl(v)) return /[/\\]/.test(v) ? null : { kind: 'file', name: v };
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  const id = youtubeId(u);
  if (id) {
    // Start time can be ?t=1m5s, ?start=65, or #t=65; end time ?end=70.
    const start = parseTime(u.searchParams.get('t') ?? u.searchParams.get('start') ?? (/[#&]t=([^&]+)/.exec(u.hash)?.[1] ?? null));
    const end = parseTime(u.searchParams.get('end'));
    return { kind: 'youtube', id, start, end: end !== undefined && end > (start ?? 0) ? end : undefined, url: v };
  }
  if (VIDEO_EXT.test(u.pathname)) return { kind: 'direct', url: v };
  return { kind: 'page', url: v, host: u.hostname.replace(/^www\./, '') };
}

/** True when a card needs YouTube's player (so the card page must load from a web address). */
export function needsYouTube(html: string): boolean {
  return videosIn(html).some((v) => parseVideo(v)?.kind === 'youtube');
}

/** File extension for a picked video, from its file name or MIME type. */
export function videoExtension(nameOrUri: string, mime?: string | null): string {
  const m = /\.([a-z0-9]{2,4})(?:[?#].*)?$/i.exec(nameOrUri);
  if (m && VIDEO_EXT.test('.' + m[1])) return m[1].toLowerCase();
  if (mime?.includes('quicktime')) return 'mov';
  if (mime?.includes('webm')) return 'webm';
  return 'mp4';
}
