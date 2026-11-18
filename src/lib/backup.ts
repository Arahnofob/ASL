import { strToU8, zipSync, type Zippable } from 'fflate';
import { mediaIn } from './html';
import { listMedia, readMedia } from './storage';
import type { Collection } from './types';

/** A zip with collection.json + media/, which can be restored through Import. */
export function buildBackup(col: Collection): Uint8Array {
  const files: Zippable = { 'collection.json': strToU8(JSON.stringify(col)) };
  for (const name of listMedia()) {
    const bytes = readMedia(name);
    if (bytes) files[`media/${name}`] = [bytes, { level: 0 }];
  }
  return zipSync(files, { level: 6 });
}

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `signs-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.zip`;
}

/** Media files no longer referenced by any note. */
export function unusedMedia(col: Collection): string[] {
  const used = new Set<string>();
  for (const n of Object.values(col.notes)) for (const m of mediaIn(n.front + n.back)) used.add(m);
  return listMedia().filter((m) => !used.has(m));
}
