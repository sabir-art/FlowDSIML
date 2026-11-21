/**
 * Retours client 21/11 §4.4 : la photo de profil remplace l'initiale partout où il y a un avatar.
 * Posée dans la pastille existante (qui garde son initiale dessous) : si la photo manque ou ne se
 * charge pas, l'initiale reste visible, sans icône d'image cassée.
 * Bucket privé « avatars » : chemin lu dans profiles (co-membres autorisés par la RLS), URL signée
 * d'une heure, chemins et URL mis en cache et demandés par lots (une requête pour toute une liste).
 */
import { useState, useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';

const BUCKET = 'avatars';
const TTL = 3600;

interface Entry {
  /** undefined : pas encore lu ; null : aucune photo. */
  path?: string | null;
  url?: string | null;
  exp?: number;
}
const store = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;
const notify = () => {
  version++;
  listeners.forEach((l) => l());
};

let queue = new Set<string>();
let scheduled = false;
async function flush() {
  scheduled = false;
  const ids = [...queue];
  queue = new Set();
  if (!ids.length) return;
  const { data } = await supabase.from('profiles').select('id, avatar_path').in('id', ids);
  const found = new Map((data ?? []).map((r) => [r.id, r.avatar_path]));
  for (const id of ids) store.set(id, { path: found.get(id) ?? null });
  await sign(ids);
}
async function sign(ids: string[]) {
  const withPath = ids.filter((id) => store.get(id)?.path);
  if (withPath.length) {
    const paths = withPath.map((id) => store.get(id)!.path!);
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, TTL);
    const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
    const exp = Date.now() + (TTL - 60) * 1000;
    for (const id of withPath) {
      const e = store.get(id)!;
      store.set(id, { ...e, url: byPath.get(e.path!) ?? null, exp });
    }
  }
  notify();
}
function request(id: string) {
  queue.add(id);
  store.set(id, store.get(id) ?? {});
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(() => void flush());
  }
}

/** Après un changement de sa propre photo : nouveau chemin (null : retirée), URL signée à nouveau. */
export function setAvatarPath(userId: string, path: string | null) {
  store.set(userId, { path });
  void sign([userId]);
}

function useAvatarUrl(userId: string | null | undefined): string | null {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
  if (!userId) return null;
  const e = store.get(userId);
  if (!e || (e.url && e.exp && e.exp < Date.now())) {
    if (!queue.has(userId)) request(userId);
    return e?.url ?? null;
  }
  return e.url ?? null;
}

/**
 * Photo par-dessus l'initiale, dans une pastille `.avatar`, `.cm-avatar`, `.nb-avatar`… (qui reçoit
 * `has-photo`). Décorative par défaut (le nom est écrit à côté) ; `alt` porte le nom sinon.
 */
export function AvatarPhoto({ userId, alt = '' }: { userId: string | null | undefined; alt?: string }) {
  const url = useAvatarUrl(userId);
  const [broken, setBroken] = useState<string | null>(null);
  if (!url || broken === url) return null;
  return <img className="av-photo" src={url} alt={alt} draggable={false} onError={() => setBroken(url)} />;
}
