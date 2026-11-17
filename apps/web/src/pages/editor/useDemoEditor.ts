import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { moveItem } from '@flowdsiml/core';
import type { Json, TablesUpdate } from '@flowdsiml/supabase-types';
import { supabase } from '../../lib/supabase';
import type { ChapterRow, DemoRow, FormRow, HotspotRow, StepRow, VariableRow } from './types';

type Table = 'demos' | 'steps' | 'hotspots' | 'chapters' | 'forms' | 'variables';
type Patch = Record<string, unknown>;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * État de l'éditeur + persistance optimiste : chaque modification est appliquée localement
 * immédiatement, puis écrite en base après un court délai (fusion des patchs par ligne).
 */
export function useDemoEditor(demoId: string) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [demo, setDemo] = useState<DemoRow | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [hotspots, setHotspots] = useState<HotspotRow[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [variables, setVariables] = useState<VariableRow[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastError, setLastError] = useState<unknown>(null);

  const pending = useRef(new Map<string, { table: Table; id: string; patch: Patch }>());
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    const items = [...pending.current.values()];
    pending.current.clear();
    if (!items.length) return;
    setSaveState('saving');
    try {
      for (const { table, id, patch } of items) {
        const { error } = await supabase
          .from(table)
          .update(patch as TablesUpdate<typeof table>)
          .eq('id', id);
        if (error) throw error;
      }
      setSaveState('saved');
    } catch (e) {
      setLastError(e);
      setSaveState('error');
    }
  }, []);

  const queue = useCallback(
    (table: Table, id: string, patch: Patch) => {
      const key = `${table}:${id}`;
      const prev = pending.current.get(key);
      pending.current.set(key, { table, id, patch: { ...(prev?.patch ?? {}), ...patch } });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 600);
      setSaveState('saving');
    },
    [flush],
  );

  // Écrit les modifications en attente avant de quitter la page.
  useEffect(() => {
    const handler = () => void flush();
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      void flush();
    };
  }, [flush]);

  const signImages = useCallback(async (rows: StepRow[]) => {
    const paths = [...new Set(rows.map((s) => s.image_path).filter((p): p is string => !!p))];
    if (!paths.length) return;
    const { data } = await supabase.storage.from('captures').createSignedUrls(paths, 3600);
    setImageUrls((prev) => {
      const next = { ...prev };
      for (const d of data ?? []) if (d.path && d.signedUrl) next[d.path] = d.signedUrl;
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await supabase.from('demos').select('*').eq('id', demoId).maybeSingle();
    if (!d.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const [s, h, c, f, v] = await Promise.all([
      supabase.from('steps').select('*').eq('demo_id', demoId).order('position').order('created_at'),
      supabase.from('hotspots').select('*').eq('demo_id', demoId).order('position').order('created_at'),
      supabase.from('chapters').select('*').eq('demo_id', demoId).order('position'),
      supabase.from('forms').select('*').eq('demo_id', demoId).order('created_at'),
      supabase.from('variables').select('*').eq('workspace_id', d.data.workspace_id).order('key'),
    ]);
    setDemo(d.data);
    setSteps(s.data ?? []);
    setHotspots(h.data ?? []);
    setChapters(c.data ?? []);
    setForms(f.data ?? []);
    setVariables(v.data ?? []);
    await signImages(s.data ?? []);
    setLoading(false);
  }, [demoId, signImages]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      setLastError(null);
      return await fn();
    } catch (e) {
      setLastError(e);
      return undefined;
    }
  }, []);

  const api = useMemo(
    () => ({
      updateDemo(patch: Partial<DemoRow>) {
        setDemo((d) => (d ? { ...d, ...patch } : d));
        queue('demos', demoId, patch);
      },
      updateStep(id: string, patch: Partial<StepRow>) {
        setSteps((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
        queue('steps', id, patch);
      },
      updateHotspot(id: string, patch: Partial<HotspotRow>) {
        setHotspots((list) => list.map((h) => (h.id === id ? { ...h, ...patch } : h)));
        queue('hotspots', id, patch);
      },
      updateChapter(id: string, patch: Partial<ChapterRow>) {
        setChapters((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
        queue('chapters', id, patch);
      },
      updateForm(id: string, patch: Partial<FormRow>) {
        setForms((list) => list.map((f) => (f.id === id ? { ...f, ...patch } : f)));
        queue('forms', id, patch);
      },
      updateVariable(id: string, patch: Partial<VariableRow>) {
        setVariables((list) => list.map((v) => (v.id === id ? { ...v, ...patch } : v)));
        queue('variables', id, patch);
      },

      addTextStep: (afterIndex: number, title: string, options?: StepRow['options']) =>
        run(async () => {
          await flush();
          const position = afterIndex + 1;
          const { data, error } = await supabase
            .from('steps')
            .insert({
              demo_id: demoId,
              workspace_id: demo!.workspace_id,
              kind: 'text',
              title,
              position,
              ...(options ? { options } : {}),
            })
            .select()
            .single();
          if (error) throw error;
          const next = [...steps];
          next.splice(position, 0, data);
          await persistOrder(next);
          return data;
        }),

      addImageStep: (afterIndex: number, file: File) =>
        run(async () => {
          await flush();
          const bmp = await createImageBitmap(file);
          const id = crypto.randomUUID();
          const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp';
          const path = `${demo!.workspace_id}/${demoId}/${id}.${ext}`;
          const up = await supabase.storage.from('captures').upload(path, file, { contentType: file.type });
          if (up.error) throw up.error;
          const { data, error } = await supabase
            .from('steps')
            .insert({
              id,
              demo_id: demoId,
              workspace_id: demo!.workspace_id,
              kind: 'image',
              image_path: path,
              image_width: bmp.width,
              image_height: bmp.height,
              position: afterIndex + 1,
            })
            .select()
            .single();
          if (error) throw error;
          const next = [...steps];
          next.splice(afterIndex + 1, 0, data);
          await signImages([data]);
          await persistOrder(next);
          return data;
        }),

      deleteStep: (id: string) =>
        run(async () => {
          const { error } = await supabase.from('steps').delete().eq('id', id);
          if (error) throw error;
          setHotspots((l) => l.filter((h) => h.step_id !== id));
          await persistOrder(steps.filter((s) => s.id !== id));
        }),

      moveStep: (from: number, to: number) => run(() => persistOrder(moveItem(steps, from, to))),

      addHotspot: (stepId: string, x: number, y: number, title: string) =>
        run(async () => {
          const { data, error } = await supabase
            .from('hotspots')
            .insert({
              step_id: stepId,
              demo_id: demoId,
              workspace_id: demo!.workspace_id,
              x: Math.max(0, Math.min(0.96, x - 0.02)),
              y: Math.max(0, Math.min(0.96, y - 0.02)),
              w: 0.04,
              h: 0.04,
              title,
              position: hotspots.filter((h) => h.step_id === stepId).length,
            })
            .select()
            .single();
          if (error) throw error;
          setHotspots((l) => [...l, data]);
          return data;
        }),

      deleteHotspot: (id: string) =>
        run(async () => {
          const { error } = await supabase.from('hotspots').delete().eq('id', id);
          if (error) throw error;
          setHotspots((l) => l.filter((h) => h.id !== id));
        }),

      addChapter: (title: string) =>
        run(async () => {
          const { data, error } = await supabase
            .from('chapters')
            .insert({ demo_id: demoId, workspace_id: demo!.workspace_id, title, position: chapters.length })
            .select()
            .single();
          if (error) throw error;
          setChapters((l) => [...l, data]);
          return data;
        }),

      deleteChapter: (id: string) =>
        run(async () => {
          const { error } = await supabase.from('chapters').delete().eq('id', id);
          if (error) throw error;
          setChapters((l) => l.filter((c) => c.id !== id));
          setSteps((l) => l.map((s) => (s.chapter_id === id ? { ...s, chapter_id: null } : s)));
        }),

      createForm: () =>
        run(async () => {
          const { data, error } = await supabase
            .from('forms')
            .insert({ workspace_id: demo!.workspace_id, demo_id: demoId })
            .select()
            .single();
          if (error) throw error;
          setForms((l) => [...l, data]);
          return data;
        }),

      deleteForm: (id: string) =>
        run(async () => {
          const { error } = await supabase.from('forms').delete().eq('id', id);
          if (error) throw error;
          setForms((l) => l.filter((f) => f.id !== id));
          setSteps((l) => l.map((s) => (s.gate_form_id === id ? { ...s, gate_form_id: null } : s)));
        }),

      addVariable: (key: string) =>
        run(async () => {
          const { data, error } = await supabase
            .from('variables')
            .insert({ workspace_id: demo!.workspace_id, key, label: key })
            .select()
            .single();
          if (error) throw error;
          setVariables((l) => [...l, data].sort((a, b) => a.key.localeCompare(b.key)));
          return data;
        }),

      deleteVariable: (id: string) =>
        run(async () => {
          const { error } = await supabase.from('variables').delete().eq('id', id);
          if (error) throw error;
          setVariables((l) => l.filter((v) => v.id !== id));
        }),

      flush,
      reload: load,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demoId, demo, steps, hotspots, chapters, queue, run, flush, load, signImages],
  );

  async function persistOrder(next: StepRow[]) {
    const ordered = next.map((s, i) => ({ ...s, position: i }));
    setSteps(ordered);
    const changed = ordered.filter((s, i) => steps.find((o) => o.id === s.id)?.position !== i);
    for (const s of changed) {
      const { error } = await supabase.from('steps').update({ position: s.position }).eq('id', s.id);
      if (error) throw error;
    }
  }

  return {
    loading,
    notFound,
    demo,
    steps,
    hotspots,
    chapters,
    forms,
    variables,
    imageUrls,
    saveState,
    lastError,
    ...api,
  };
}

export type DemoEditor = ReturnType<typeof useDemoEditor>;

/** Conversion utilitaire pour les colonnes JSON. */
export const json = (v: unknown) => v as Json;
