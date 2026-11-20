/**
 * L38-1 : lien personnel du centre de formation. Le centre reconnaît l'apprenant au jeton de n'importe quel
 * lien personnalisé de l'espace (`#/c/<adresse>?l=<jeton>`) : c'est ce lien, et non celui de la démo seule,
 * qui affiche la progression, la reprise et l'attestation.
 */
import type { Tables } from '@flowdsiml/supabase-types';
import { centerUrl, type CenterDraft } from '../center/centerDraft';

export interface CenterModule {
  slug: string;
  pathTitle: string;
  /** Position du module dans la formation (1 pour le premier). */
  position: number;
}

/**
 * Formation publiée dans le centre qui contient la démo (la première visible, dans l'ordre du centre), ou
 * null : centre non publié, Demo Center, ou démo dans aucune formation visible.
 */
export function centerModuleOf(
  center: Pick<Tables<'training_centers'>, 'slug' | 'published'> | null,
  paths: Pick<Tables<'paths'>, 'id' | 'title'>[],
  modules: Pick<Tables<'path_modules'>, 'path_id' | 'demo_id' | 'position'>[],
  demoId: string,
): CenterModule | null {
  const conf = center?.published as CenterDraft | null | undefined;
  if (!center || !conf || conf.kind === 'demo') return null;
  for (const v of conf.paths ?? []) {
    if (!v.visible) continue;
    const path = paths.find((p) => p.id === v.id);
    if (!path) continue;
    const ordered = modules.filter((m) => m.path_id === v.id).sort((a, b) => a.position - b.position);
    const i = ordered.findIndex((m) => m.demo_id === demoId);
    if (i >= 0) return { slug: center.slug, pathTitle: path.title, position: i + 1 };
  }
  return null;
}

/** Lien personnel du centre pour un lien personnalisé (jeton). */
export const centerLinkUrl = (playerUrl: string, slug: string, token: string) =>
  `${centerUrl(playerUrl, slug)}?l=${encodeURIComponent(token)}`;
