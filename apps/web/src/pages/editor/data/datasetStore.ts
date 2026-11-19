import { useEffect, useSyncExternalStore } from 'react';
import type { DatasetBinding } from '@flowdsiml/manifest';
import type { Json } from '@flowdsiml/supabase-types';
import { supabase } from '../../../lib/supabase';

/** L25-09 : jeu de données de la démo (une ligne demo_datasets au plus). */
export interface DemoDataset {
  id: string;
  name: string;
  columns: string[];
  rows: string[][];
  bindings: DatasetBinding[];
  row_mode: 'link' | 'first';
  link_column: string | null;
}

interface State {
  demoId: string | null;
  loaded: boolean;
  dataset: DemoDataset | null;
}
let state: State = { demoId: null, loaded: false, dataset: null };
const subs = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
};

const asDataset = (r: Record<string, unknown>): DemoDataset => ({
  id: r.id as string,
  name: r.name as string,
  columns: (r.columns as string[]) ?? [],
  rows: (r.rows as string[][]) ?? [],
  bindings: (r.bindings as DatasetBinding[]) ?? [],
  row_mode: r.row_mode === 'link' ? 'link' : 'first',
  link_column: (r.link_column as string | null) ?? null,
});

/** Jeu de données de la démo, chargé une fois par démo. */
export function useDataset(demoId: string | undefined): State {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
  useEffect(() => {
    if (!demoId || state.demoId === demoId) return;
    set({ demoId, loaded: false, dataset: null });
    void supabase
      .from('demo_datasets')
      .select('*')
      .eq('demo_id', demoId)
      .maybeSingle()
      .then(({ data }) => {
        if (state.demoId === demoId)
          set({ loaded: true, dataset: data ? asDataset(data as unknown as Record<string, unknown>) : null });
      });
  }, [demoId]);
  return s.demoId === demoId ? s : { demoId: demoId ?? null, loaded: false, dataset: null };
}

/** Enregistre (création ou remplacement) ; la base refait les contrôles (dataset_ok). */
export async function saveDataset(
  demoId: string,
  workspaceId: string,
  d: Omit<DemoDataset, 'id'>,
): Promise<DemoDataset> {
  const values = {
    name: d.name.slice(0, 120),
    columns: d.columns as unknown as Json,
    rows: d.rows as unknown as Json,
    bindings: d.bindings as unknown as Json,
    row_mode: d.row_mode,
    link_column: d.link_column,
  };
  const existing = state.demoId === demoId ? state.dataset : null;
  const res = existing
    ? await supabase.from('demo_datasets').update(values).eq('id', existing.id).select('*').single()
    : await supabase
        .from('demo_datasets')
        .insert({ ...values, demo_id: demoId, workspace_id: workspaceId })
        .select('*')
        .single();
  if (res.error) throw res.error;
  const saved = asDataset(res.data as unknown as Record<string, unknown>);
  set({ demoId, loaded: true, dataset: saved });
  return saved;
}

export async function removeDataset(demoId: string): Promise<void> {
  const existing = state.demoId === demoId ? state.dataset : null;
  if (!existing) return;
  const { error } = await supabase.from('demo_datasets').delete().eq('id', existing.id);
  if (error) throw error;
  set({ dataset: null });
}

/** Colonnes publiées : colonne de correspondance et colonnes reliées seulement. */
export function publishedColumns(d: Pick<DemoDataset, 'columns' | 'bindings' | 'link_column'>): string[] {
  return d.columns.filter((c) => c === d.link_column || d.bindings.some((b) => b.column === c));
}
