import type { HtmlCapture } from './htmlCapture';

/**
 * A8 : pages capturées en HTML, gardées dans le navigateur (IndexedDB de l'extension) jusqu'à
 * l'écran de vérification : rien n'est envoyé avant « Envoyer ».
 */
export interface PendingHtmlPage extends HtmlCapture {
  order: number;
  /** Clic fait sur cette page avant la page suivante (lien proposé vers l'étape suivante). */
  clickSel?: string;
  clickLabel?: string;
}

const DB = 'fd-html';
const STORE = 'pages';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'order' });
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

export const htmlStore = {
  all: () => tx<PendingHtmlPage[]>('readonly', (s) => s.getAll() as IDBRequest<PendingHtmlPage[]>),
  count: () => tx<number>('readonly', (s) => s.count()),
  put: (p: PendingHtmlPage) => tx('readwrite', (s) => s.put(p)),
  clear: () => tx('readwrite', (s) => s.clear()),
  async last(): Promise<PendingHtmlPage | null> {
    const all = await htmlStore.all();
    return all.sort((a, b) => b.order - a.order)[0] ?? null;
  },
};
