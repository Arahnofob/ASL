// iOS / Android storage: everything lives in the app's Documents folder
// (visible in the Files app, so backups can also be copied out by hand).
import { Directory, File, Paths } from 'expo-file-system';

const root = new Directory(Paths.document, 'data');
const mediaDir = new Directory(root, 'media');

function ensureDirs() {
  if (!root.exists) root.create({ intermediates: true });
  if (!mediaDir.exists) mediaDir.create({ intermediates: true });
}

export function loadCollectionText(): string | null {
  ensureDirs();
  const f = new File(root, 'collection.json');
  if (f.exists) return f.textSync();
  const bak = new File(root, 'collection.bak.json');
  return bak.exists ? bak.textSync() : null;
}

let backedUpThisLaunch = false;

export function saveCollectionText(json: string) {
  ensureDirs();
  const target = new File(root, 'collection.json');
  // Once per app launch, keep a copy of the previous state in case something goes wrong.
  if (!backedUpThisLaunch && target.exists) {
    target.copySync(new File(root, 'collection.bak.json'), { overwrite: true });
    backedUpThisLaunch = true;
  }
  const tmp = new File(root, 'collection.tmp.json');
  tmp.writeSync(json);
  tmp.moveSync(new File(root, 'collection.json'), { overwrite: true });
}

export function saveMedia(name: string, bytes: Uint8Array) {
  ensureDirs();
  const f = new File(mediaDir, name);
  if (f.exists) f.delete();
  f.create();
  f.writeSync(bytes);
}

/** Copies a picked file (e.g. a video from Photos) into the media folder without loading it into memory. */
export async function importMediaFile(uri: string, name: string) {
  ensureDirs();
  await new File(uri).copy(new File(mediaDir, name), { overwrite: true });
}

export function readMedia(name: string): Uint8Array | null {
  const f = new File(mediaDir, name);
  return f.exists ? f.bytesSync() : null;
}

export function hasMedia(name: string): boolean {
  return new File(mediaDir, name).exists;
}

export function listMedia(): string[] {
  ensureDirs();
  return mediaDir.list().filter((e): e is File => e instanceof File).map((f) => f.name);
}

export function deleteMedia(name: string) {
  const f = new File(mediaDir, name);
  if (f.exists) f.delete();
}

/** Folder URI used as the base URL for card HTML, so <img src="x.png"> resolves to media files. */
export function mediaBaseUri(): string {
  ensureDirs();
  return mediaDir.uri.endsWith('/') ? mediaDir.uri : mediaDir.uri + '/';
}

export function mediaUri(name: string): string {
  return new File(mediaDir, name).uri;
}

/** Writes a temporary file (for sharing a backup) and returns its URI. */
export function writeTempFile(name: string, bytes: Uint8Array): string {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.writeSync(bytes);
  return f.uri;
}

export async function readPickedFile(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}
