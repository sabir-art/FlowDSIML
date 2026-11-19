import type { Mark } from './video';

/**
 * F7 : enregistrement vidéo gardé dans le navigateur (IndexedDB de l'extension) jusqu'à l'écran de
 * vérification : rien n'est envoyé avant « Envoyer ». « Supprimer l'enregistrement » l'efface.
 */
export interface PendingVideo {
  id: 'current';
  blob: Blob;
  mime: string;
  durationMs: number;
  marks: Mark[];
  /** Image de chaque repère (index dans marks → WebP), prise dans le flux enregistré. */
  frames: Blob[];
  hasVoice: boolean;
  micDenied: boolean;
  /** Zones floutées pendant l'enregistrement (nombre maximal à l'écran). */
  blurredZones: number;
  workspaceId: string;
  title: string;
  device: 'desktop' | 'mobile';
  viewport: { w: number; h: number } | null;
  url: string;
}

const DB = 'fd-video';
const STORE = 'video';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    t.onerror = () => reject(t.error);
  });
}

export const videoStore = {
  put: (v: PendingVideo) => tx('readwrite', (s) => s.put(v)),
  get: () => tx<PendingVideo | undefined>('readonly', (s) => s.get('current')),
  clear: () => tx('readwrite', (s) => s.clear()),
};
