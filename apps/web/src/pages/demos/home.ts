import type { Tables } from '@flowdsiml/supabase-types';
import { supabase } from '../../lib/supabase';

export type Stats = { views: number; completions: number; visitors: number; leads: number };

/** Tout ce que le tableau de bord des démos lit au démarrage (RPC dashboard_home, L32). */
export interface HomeData {
  demos: Tables<'demos'>[];
  folders: Tables<'folders'>[];
  overview: Array<Stats & { demo_id: string }>;
  kpis: { cur: Stats | null; prev: Stats | null };
  locked: string[];
  /** Dossiers restreints : membres qui ne les voient pas. */
  hidden: Record<string, number>;
  stepCounts: Record<string, number>;
  publishedAt: Record<string, string>;
  /** Chemin (bucket captures) de la première image de chaque démo. */
  covers: Record<string, string>;
  memberCount: number;
  /** État de la prise en main (éditeurs et plus), comme workspace_onboarding ; absent en repli. */
  onboarding?: unknown;
}

/** Une seule lecture (dashboard_home) ; repli sur les lectures séparées si la migration L32 manque. */
export async function loadHome(ws: { id: string }): Promise<HomeData> {
  const one = await supabase.rpc('dashboard_home', { p_ws: ws.id });
  if (!one.error && one.data) return one.data as unknown as HomeData;
  // Repli seulement si la fonction n'existe pas encore ; toute autre erreur va à l'écran d'erreur (L32 §4)
  if (one.error && !isMissingFunction(one.error)) throw one.error;
  return loadSeparately(ws);
}

/** PostgREST : fonction absente du schéma (migration L32 pas encore appliquée). */
export const isMissingFunction = (e: { code?: string; message?: string }) =>
  e.code === 'PGRST202' || e.code === '42883' || /could not find the function/i.test(e.message ?? '');

async function loadSeparately(ws: { id: string }): Promise<HomeData> {
  const now = Date.now();
  const iso = (days: number) => new Date(now - days * 86400_000).toISOString();
  const [d, f, o, lk, cur, prev, members] = await Promise.all([
    supabase
      .from('demos')
      .select('*')
      .eq('workspace_id', ws.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),
    supabase.from('folders').select('*').eq('workspace_id', ws.id).order('name'),
    supabase.rpc('workspace_overview', { p_workspace: ws.id, p_days: 30 }),
    supabase.from('demo_access').select('demo_id').eq('workspace_id', ws.id).eq('locked_by_rules', true),
    supabase.rpc('workspace_kpis', {
      p_workspace: ws.id,
      p_from: iso(30),
      p_to: new Date(now).toISOString(),
    }),
    supabase.rpc('workspace_kpis', { p_workspace: ws.id, p_from: iso(60), p_to: iso(30) }),
    supabase.rpc('list_members', { p_workspace: ws.id }),
  ]);
  const demos = d.data ?? [];
  const folders = f.data ?? [];
  const ids = demos.map((x) => x.id);
  const restricted = folders.filter((x) => x.restricted).map((x) => x.id);
  const versions = demos
    .filter((x) => x.status === 'published' && x.current_version_id)
    .map((x) => x.current_version_id!);
  const [hidden, steps, v] = await Promise.all([
    Promise.all(
      restricted.map((id) =>
        supabase.rpc('folder_hidden_count', { p_folder: id }).then((r) => [id, r.data ?? 0] as const),
      ),
    ),
    ids.length
      ? supabase.from('steps').select('demo_id, image_path, position').in('demo_id', ids).order('position')
      : Promise.resolve({ data: [] as Array<{ demo_id: string; image_path: string | null }> }),
    versions.length
      ? supabase.from('demo_versions').select('demo_id, published_at').in('id', versions)
      : Promise.resolve({ data: [] as Array<{ demo_id: string; published_at: string | null }> }),
  ]);
  const stepCounts: Record<string, number> = {};
  const covers: Record<string, string> = {};
  for (const r of steps.data ?? []) {
    stepCounts[r.demo_id] = (stepCounts[r.demo_id] ?? 0) + 1;
    if (r.image_path && !covers[r.demo_id]) covers[r.demo_id] = r.image_path;
  }
  return {
    demos,
    folders,
    overview: (o.data ?? []) as Array<Stats & { demo_id: string }>,
    kpis: {
      cur: cur.error ? null : ((cur.data as unknown as Stats) ?? null),
      prev: prev.error ? null : ((prev.data as unknown as Stats) ?? null),
    },
    locked: (lk.data ?? []).map((x) => x.demo_id),
    hidden: Object.fromEntries(hidden),
    stepCounts,
    publishedAt: Object.fromEntries(
      (v.data ?? []).filter((r) => r.published_at).map((r) => [r.demo_id, r.published_at!]),
    ),
    covers,
    memberCount: (members.data ?? []).length,
  };
}
