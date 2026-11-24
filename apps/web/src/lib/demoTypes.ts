import { contentType, type ContentType } from '@flowdsiml/core';
import { supabase } from './supabase';

/**
 * L48-G : type de contenu de chaque démo d'un espace (filtre Démo d'Analytics, Parcours). Les comptes
 * d'étapes viennent du serveur (demo_step_counts) ; la règle reste celle de contentType. Erreur ou
 * fonction absente : objet vide, l'écran n'affiche alors pas de badge.
 */
export async function loadDemoTypes(
  wsId: string,
  demos: Array<{ id: string; kind?: string | null }>,
): Promise<Record<string, ContentType>> {
  const r = await supabase.rpc('demo_step_counts', { p_ws: wsId });
  if (r.error || !r.data) return {};
  const counts = r.data as Record<string, { n: number; html: number; video?: number }>;
  return Object.fromEntries(
    demos.map((d) => {
      const c = counts[d.id];
      return [d.id, contentType(d, { total: c?.n ?? 0, html: c?.html ?? 0, video: c?.video ?? 0 })];
    }),
  );
}
