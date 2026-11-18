// Browser storage, used only for previewing / testing the app on the web.
// The collection goes to localStorage; media stay in memory for the session.
const KEY = 'signs.collection';
const media = new Map<string, { bytes: Uint8Array; url: string }>();

export function loadCollectionText(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveCollectionText(json: string) {
  try {
    localStorage.setItem(KEY, json);
  } catch {
    // Storage full or unavailable — the web build is only for testing.
  }
}

const MIME: Record<string, string> = { m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };

export function saveMedia(name: string, bytes: Uint8Array) {
  const old = media.get(name);
  if (old) URL.revokeObjectURL(old.url);
  const type = MIME[name.split('.').pop() ?? ''] ?? 'application/octet-stream';
  media.set(name, { bytes, url: URL.createObjectURL(new Blob([bytes as BlobPart], { type })) });
}

export async function importMediaFile(uri: string, name: string) {
  saveMedia(name, new Uint8Array(await (await fetch(uri)).arrayBuffer()));
}

export function readMedia(name: string): Uint8Array | null {
  return media.get(name)?.bytes ?? null;
}

export function hasMedia(name: string): boolean {
  return media.has(name);
}

export function listMedia(): string[] {
  return [...media.keys()];
}

export function deleteMedia(name: string) {
  const m = media.get(name);
  if (m) URL.revokeObjectURL(m.url);
  media.delete(name);
}

export function mediaBaseUri(): string {
  return '';
}

export function mediaUri(name: string): string {
  return media.get(name)?.url ?? '';
}

export function writeTempFile(name: string, bytes: Uint8Array): string {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
  a.download = name;
  a.click();
  return a.href;
}

export async function readPickedFile(uri: string): Promise<Uint8Array> {
  return new Uint8Array(await (await fetch(uri)).arrayBuffer());
}
