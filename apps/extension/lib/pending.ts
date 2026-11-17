import type { RelRect, Viewport, PxRect } from './geometry';
import type { PiiType } from './pii';

/** Zone à vérifier sur une capture (coordonnées relatives 0–1). */
export interface PendingZone {
  id: string;
  type: PiiType;
  rect: RelRect;
  /** Extrait masqué, affiché localement ; jamais envoyé. */
  excerpt: string;
  /** Sera floutée dans les pixels à l'envoi (coché par défaut). */
  blur: boolean;
  /** Zone tracée à la main sur l'écran de vérification. */
  manual?: boolean;
}

/** Capture gardée dans le navigateur jusqu'à la validation (spec f1-formation §1). */
export interface PendingCapture {
  id: string;
  order: number;
  image: Blob;
  width: number;
  height: number;
  viewport: Viewport;
  dpr: number;
  url: string;
  title: string;
  label: string;
  selector: string;
  tag: string;
  element: PxRect | null;
  click: { x: number; y: number };
  zones: PendingZone[];
}

const DB = 'fd-pending';
const STORE = 'captures';

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

export const pending = {
  put: (c: PendingCapture) => tx('readwrite', (s) => s.put(c)),
  all: async () =>
    (await tx<PendingCapture[]>('readonly', (s) => s.getAll())).sort((a, b) => a.order - b.order),
  clear: () => tx('readwrite', (s) => s.clear()),
  count: () => tx<number>('readonly', (s) => s.count()),
};
