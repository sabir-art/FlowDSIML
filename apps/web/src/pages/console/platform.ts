/**
 * L41 : rôle du compte dans la Console propriétaire (équipe TutoClick) et point de nouveauté.
 * console_me() renvoie null pour tout autre compte : rien n'est révélé côté client.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';

export type PlatformRole = 'admin' | 'read_only';
const cache = new Map<string, Promise<PlatformRole | null>>();

/** undefined pendant le chargement, null pour un compte qui n'est pas propriétaire de la plateforme. */
export function usePlatformRole(): PlatformRole | null | undefined {
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const [role, setRole] = useState<PlatformRole | null | undefined>(undefined);
  useEffect(() => {
    if (!uid) return setRole(null);
    let alive = true;
    if (!cache.has(uid))
      cache.set(
        uid,
        Promise.resolve(supabase.rpc('console_me')).then(({ data }) => (data as PlatformRole | null) ?? null),
      );
    void cache.get(uid)!.then((r) => alive && setRole(r));
    return () => {
      alive = false;
    };
  }, [uid]);
  return role;
}

const SEEN = 'fd:news-seen';
/** La page Nouveautés a été ouverte : le point disparaît partout. */
export const notifyNewsSeen = () => window.dispatchEvent(new Event(SEEN));

/** Nombre d'annonces publiées depuis la dernière visite de la page Nouveautés par cette personne. */
export function useNewsUnseen(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void supabase
        .rpc('news_unseen_count')
        .then(({ data }) => alive && setN(typeof data === 'number' ? data : 0));
    load();
    const reset = () => setN(0);
    window.addEventListener(SEEN, reset);
    return () => {
      alive = false;
      window.removeEventListener(SEEN, reset);
    };
  }, []);
  return n;
}
