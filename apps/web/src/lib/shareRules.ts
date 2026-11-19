/**
 * L27 §4 : règles de partage de l'espace (table share_rules, lisible par les membres). Sans ligne, les
 * valeurs par défaut s'appliquent. Les contrôles sont faits par la base ; l'interface les reflète
 * (mode désactivé et expliqué, durée maximale, publication réservée, exports désactivés).
 */
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface ShareRules {
  modes: string[];
  max_link_days: number | null;
  publish_role: 'editor' | 'admin';
  exports_allowed: boolean;
}
export const DEFAULT_RULES: ShareRules = {
  modes: ['link', 'password'],
  max_link_days: null,
  publish_role: 'editor',
  exports_allowed: true,
};
export const LINK_DAYS = [7, 30, 90] as const;

const cache = new Map<string, Promise<ShareRules>>();
const EVENT = 'fd:share-rules';

function fetchRules(wsId: string): Promise<ShareRules> {
  let p = cache.get(wsId);
  if (!p) {
    p = Promise.resolve(
      supabase
        .from('share_rules')
        .select('modes, max_link_days, publish_role, exports_allowed')
        .eq('workspace_id', wsId)
        .maybeSingle(),
    ).then(({ data }) => (data ? { ...DEFAULT_RULES, ...(data as ShareRules) } : DEFAULT_RULES));
    cache.set(wsId, p);
  }
  return p;
}

/** Après un enregistrement : relire les règles partout. */
export function shareRulesChanged(wsId: string) {
  cache.delete(wsId);
  dispatchEvent(new CustomEvent(EVENT, { detail: wsId }));
}

export function useShareRules(wsId: string | undefined): ShareRules {
  const [rules, setRules] = useState<ShareRules>(DEFAULT_RULES);
  useEffect(() => {
    if (!wsId) return;
    let alive = true;
    const load = () => void fetchRules(wsId).then((r) => alive && setRules(r));
    load();
    const on = (e: Event) => (e as CustomEvent<string>).detail === wsId && load();
    addEventListener(EVENT, on);
    return () => {
      alive = false;
      removeEventListener(EVENT, on);
    };
  }, [wsId]);
  return rules;
}

/** Le rôle peut-il publier et diffuser avec ces règles ? */
export const canPublishWith = (rules: ShareRules, role: string | undefined) =>
  rules.publish_role === 'editor' ? role !== 'viewer' && !!role : role === 'admin' || role === 'owner';
