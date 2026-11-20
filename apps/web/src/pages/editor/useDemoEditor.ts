import i18n from '../../i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { moveItem } from '@flowdsiml/core';
import type { Json, TablesUpdate } from '@flowdsiml/supabase-types';
import { supabase } from '../../lib/supabase';
import type { ChapterRow, DemoRow, FormRow, HotspotRow, QuestionRow, StepRow, VariableRow } from './types';
import { asVideo } from './video/videoModel';

type Table = 'demos' | 'steps' | 'hotspots' | 'chapters' | 'forms' | 'variables' | 'quiz_questions';
type Patch = Record<string, unknown>;
/** L12 : modification annulable (valeurs avant / après des seuls champs modifiés). */
type Change = { table: 'demos' | 'steps' | 'hotspots'; id: string; before: Patch; after: Patch };
type HistoryEntry = { changes: Change[]; key: string | null; at: number };
/** Saisies successives d'un même champ fusionnées en une seule étape d'annulation. */
const COALESCE_MS = 1500;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * État de l'éditeur + persistance optimiste : chaque modification est appliquée localement
 * immédiatement, puis écrite en base après un court délai (fusion des patchs par ligne).
 */
/** Tout ce que l'éditeur charge au démarrage (RPC editor_load, L32). */
interface EditorData {
  demo: DemoRow;
  steps: StepRow[];
  hotspots: HotspotRow[];
  chapters: ChapterRow[];
  forms: FormRow[];
  variables: VariableRow[];
  questions: QuestionRow[];
}

/** Repli : lectures séparées, si la RPC editor_load n'est pas encore déployée. */
async function loadSeparately(demoId: string): Promise<EditorData | null> {
  const d = await supabase.from('demos').select('*').eq('id', demoId).maybeSingle();
  if (!d.data) return null;
  const [s, h, c, f, v, q] = await Promise.all([
    supabase.from('steps').select('*').eq('demo_id', demoId).order('position').order('created_at'),
    supabase.from('hotspots').select('*').eq('demo_id', demoId).order('position').order('created_at'),
    supabase.from('chapters').select('*').eq('demo_id', demoId).order('position'),
    supabase.from('forms').select('*').eq('demo_id', demoId).order('created_at'),
    supabase.from('variables').select('*').eq('workspace_id', d.data.workspace_id).order('key'),
    supabase.from('quiz_questions').select('*').eq('demo_id', demoId).order('position').order('created_at'),
  ]);
  return {
    demo: d.data,
    steps: s.data ?? [],
    hotspots: h.data ?? [],
    chapters: c.data ?? [],
    forms: f.data ?? [],
    variables: v.data ?? [],
    questions: q.data ?? [],
  };
}

export function useDemoEditor(demoId: string) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [demo, setDemo] = useState<DemoRow | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [hotspots, setHotspots] = useState<HotspotRow[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [variables, setVariables] = useState<VariableRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastError, setLastError] = useState<unknown>(null);
  // L12 : historique d'annulation (Ctrl Z / Ctrl Maj Z) des modifications de démo, étapes et hotspots
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const batchRef = useRef<Change[] | null>(null);
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const syncHistory = () => setHistory({ undo: undoStack.current.length, redo: redoStack.current.length });

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
    const paths = [
      ...new Set(
        rows
          .flatMap((s) => [
            s.image_path,
            s.before_image_path,
            ...Object.values(asVideo(s.video).frames),
            // L25-01 : capture pleine page (aperçu du défilement)
            (s.options as { fullPage?: { path?: string } } | null)?.fullPage?.path,
          ])
          .filter((p): p is string => !!p),
      ),
    ];
    // F7 : vidéos (bucket videos), signées dans la même table d'adresses
    const videos = [...new Set(rows.map((s) => s.video_path).filter((p): p is string => !!p))];
    // A8 : pages HTML (bucket html)
    const pages = [...new Set(rows.map((s) => s.html_path).filter((p): p is string => !!p))];
    if (!paths.length && !videos.length && !pages.length) return;
    const [img, vid, htm] = await Promise.all([
      paths.length ? supabase.storage.from('captures').createSignedUrls(paths, 3600) : { data: [] },
      videos.length ? supabase.storage.from('videos').createSignedUrls(videos, 3600) : { data: [] },
      pages.length ? supabase.storage.from('html').createSignedUrls(pages, 3600) : { data: [] },
    ]);
    setImageUrls((prev) => {
      const next = { ...prev };
      for (const d of [...(img.data ?? []), ...(vid.data ?? []), ...(htm.data ?? [])])
        if (d.path && d.signedUrl) next[d.path] = d.signedUrl;
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    // L32 : une seule lecture (editor_load), sinon les lectures séparées (migration pas encore appliquée)
    const one = await supabase.rpc('editor_load', { p_demo: demoId });
    let data: EditorData | null;
    if (!one.error) data = (one.data as unknown as EditorData | null) ?? null;
    else data = await loadSeparately(demoId);
    if (!data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setDemo(data.demo);
    setSteps(data.steps);
    setHotspots(data.hotspots);
    setChapters(data.chapters);
    setForms(data.forms);
    setVariables(data.variables);
    setQuestions(data.questions);
    await signImages(data.steps);
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

  const api = useMemo(() => {
    const apply = (table: Change['table'], id: string, patch: Patch) => {
      if (table === 'demos') setDemo((d) => (d ? { ...d, ...patch } : d));
      if (table === 'steps') setSteps((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      if (table === 'hotspots')
        setHotspots((list) => list.map((h) => (h.id === id ? { ...h, ...patch } : h)));
      queue(table, id, patch);
    };
    const record = (table: Change['table'], id: string, row: Patch | undefined, patch: Patch) => {
      if (!row) return;
      // Champ absent = null (undefined disparaîtrait de la requête et ne serait pas rétabli)
      const before = Object.fromEntries(Object.keys(patch).map((k) => [k, row[k] ?? null]));
      const change: Change = { table, id, before, after: { ...patch } };
      if (batchRef.current) return void batchRef.current.push(change);
      const key = `${table}:${id}:${Object.keys(patch).sort().join(',')}`;
      const top = undoStack.current[undoStack.current.length - 1];
      if (top && top.key === key && Date.now() - top.at < COALESCE_MS) {
        Object.assign(top.changes[0]!.after, patch);
        top.at = Date.now();
      } else {
        undoStack.current.push({ changes: [change], key, at: Date.now() });
        if (undoStack.current.length > 100) undoStack.current.shift();
      }
      redoStack.current = [];
      syncHistory();
    };
    const edit = (table: Change['table'], id: string, row: Patch | undefined, patch: Patch) => {
      record(table, id, row, patch);
      apply(table, id, patch);
    };
    return {
      updateDemo(patch: Partial<DemoRow>) {
        edit('demos', demoId, demo as Patch | undefined, patch as Patch);
      },
      updateStep(id: string, patch: Partial<StepRow>) {
        edit('steps', id, steps.find((s) => s.id === id) as Patch | undefined, patch as Patch);
      },
      updateHotspot(id: string, patch: Partial<HotspotRow>) {
        edit('hotspots', id, hotspots.find((h) => h.id === id) as Patch | undefined, patch as Patch);
      },
      /** Regroupe plusieurs modifications en une seule étape d'annulation (actions de masse). */
      batch(fn: () => void) {
        batchRef.current = [];
        try {
          fn();
        } finally {
          const changes = batchRef.current;
          batchRef.current = null;
          if (changes.length) {
            undoStack.current.push({ changes, key: null, at: Date.now() });
            redoStack.current = [];
            syncHistory();
          }
        }
      },
      undo() {
        const e = undoStack.current.pop();
        if (!e) return false;
        for (const c of [...e.changes].reverse()) apply(c.table, c.id, c.before);
        redoStack.current.push(e);
        syncHistory();
        return true;
      },
      redo() {
        const e = redoStack.current.pop();
        if (!e) return false;
        for (const c of e.changes) apply(c.table, c.id, c.after);
        e.key = null;
        undoStack.current.push(e);
        syncHistory();
        return true;
      },
      canUndo: history.undo > 0,
      canRedo: history.redo > 0,
      /** L18 : une modification faite côté serveur (test A/B) rend la démo « non publiée ». */
      markDirty() {
        setDemo((d) => (d ? { ...d, updated_at: new Date().toISOString() } : d));
      },
      updateChapter(id: string, patch: Partial<ChapterRow>) {
        setChapters((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
        queue('chapters', id, patch);
      },
      updateForm(id: string, patch: Partial<FormRow>) {
        setForms((list) => list.map((f) => (f.id === id ? { ...f, ...patch } : f)));
        queue('forms', id, patch);
      },
      updateQuestion(id: string, patch: Partial<QuestionRow>) {
        setQuestions((list) => list.map((q) => (q.id === id ? { ...q, ...patch } : q)));
        queue('quiz_questions', id, patch);
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

      /**
       * F7 : « Créer n étapes captures » : une capture par pause-étape (image de la pause copiée,
       * texte de la bulle), juste après l'étape vidéo. La vidéo reste en place.
       */
      convertVideo: (stepId: string) =>
        run(async () => {
          await flush();
          const src = steps.find((x) => x.id === stepId);
          if (!src) return 0;
          const v = asVideo(src.video);
          const pauses = [...v.pauses].sort((a, b) => a.t - b.t);
          const at = steps.indexOf(src);
          const created: StepRow[] = [];
          for (const [i, pz] of pauses.entries()) {
            const frame = v.frames[pz.id];
            let image: string | null = null;
            if (frame) {
              image = `${demo!.workspace_id}/${demoId}/${crypto.randomUUID()}.webp`;
              const cp = await supabase.storage.from('captures').copy(frame, image);
              if (cp.error) image = null;
            }
            const { data, error } = await supabase
              .from('steps')
              .insert({
                demo_id: demoId,
                workspace_id: demo!.workspace_id,
                kind: image ? 'image' : 'text',
                title: pz.title,
                body: pz.body,
                position: at + 1 + i,
                image_path: image,
              })
              .select()
              .single();
            if (error) throw error;
            created.push(data);
          }
          const next = [...steps];
          next.splice(at + 1, 0, ...created);
          await persistOrder(next);
          await signImages(created);
          return created.length;
        }),

      /** L17 : étape Avant / Après vide (captures choisies ensuite dans le panneau). */
      addBeforeAfterStep: (afterIndex: number, title: string) =>
        run(async () => {
          await flush();
          const position = afterIndex + 1;
          const { data, error } = await supabase
            .from('steps')
            .insert({
              demo_id: demoId,
              workspace_id: demo!.workspace_id,
              kind: 'before_after',
              title,
              position,
              options: {
                beforeAfter: {
                  layout: 'side',
                  // L17-02 : libellés préremplis (modifiables)
                  labels: { before: i18n.t('editor.ba.before'), after: i18n.t('editor.ba.after') },
                  notes: { before: '', after: '' },
                  sources: {},
                },
              },
            })
            .select()
            .single();
          if (error) throw error;
          const next = [...steps];
          next.splice(position, 0, data);
          await persistOrder(next);
          return data;
        }),

      /**
       * L17 : capture « Avant » ou « Maintenant » d'une étape Avant / Après. Une étape source est
       * copiée (fichier et flous) : la modifier ensuite ne change pas l'Avant / Après.
       */
      setBeforeAfterImage: (
        stepId: string,
        side: 'before' | 'after',
        from: { stepId: string } | { file: File },
      ) =>
        run(async () => {
          await flush();
          const target = steps.find((s) => s.id === stepId)!;
          let path: string;
          let width: number;
          let height: number;
          let blurs: NonNullable<Json> = [];
          let source: NonNullable<Json>;
          if ('stepId' in from) {
            const src = steps.find((s) => s.id === from.stepId);
            if (!src?.image_path) throw new Error('NO_IMAGE');
            const ext = src.image_path.split('.').pop() || 'webp';
            path = `${demo!.workspace_id}/${demoId}/${stepId}-${side}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
            const cp = await supabase.storage.from('captures').copy(src.image_path, path);
            if (cp.error) throw cp.error;
            width = src.image_width ?? 1280;
            height = src.image_height ?? 800;
            blurs = src.blurs;
            source = { kind: 'step', stepId: src.id };
          } else {
            const file = from.file;
            const bmp = await createImageBitmap(file);
            const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp';
            path = `${demo!.workspace_id}/${demoId}/${stepId}-${side}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
            const up = await supabase.storage.from('captures').upload(path, file, { contentType: file.type });
            if (up.error) throw up.error;
            width = bmp.width;
            height = bmp.height;
            source = { kind: 'upload', name: file.name.slice(0, 120) };
          }
          const opts = (target.options ?? {}) as Record<string, unknown>;
          const ba = (opts.beforeAfter ?? {}) as Record<string, unknown>;
          const patch =
            side === 'after'
              ? { image_path: path, image_width: width, image_height: height, blurs }
              : {
                  before_image_path: path,
                  before_image_width: width,
                  before_image_height: height,
                  before_blurs: blurs,
                };
          const options = {
            ...opts,
            beforeAfter: { ...ba, sources: { ...((ba.sources as object) ?? {}), [side]: source } },
          } as NonNullable<Json>;
          const { data, error } = await supabase
            .from('steps')
            .update({ ...patch, options })
            .eq('id', stepId)
            .select()
            .single();
          if (error) throw error;
          await signImages([data]);
          setSteps((list) => list.map((s) => (s.id === stepId ? data : s)));
          return data;
        }),

      /** L26-04 : capture d'une étape « À capturer » (image importée ; l'extension fait de même). */
      captureStep: (stepId: string, file: File) =>
        run(async () => {
          await flush();
          const bmp = await createImageBitmap(file);
          const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp';
          const path = `${demo!.workspace_id}/${demoId}/${stepId}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
          const up = await supabase.storage.from('captures').upload(path, file, { contentType: file.type });
          if (up.error) throw up.error;
          const { data, error } = await supabase
            .from('steps')
            // REV-07 : image importée (aucune détection automatique des données personnelles), comptée au bilan RGPD
            .update({
              image_path: path,
              image_width: bmp.width,
              image_height: bmp.height,
              to_capture: false,
              element_meta: {
                ...((steps.find((s) => s.id === stepId)?.element_meta as object) ?? {}),
                imported: true,
              },
            })
            .eq('id', stepId)
            .select()
            .single();
          if (error) throw error;
          await signImages([data]);
          setSteps((list) => list.map((s) => (s.id === stepId ? data : s)));
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
              element_meta: { imported: true },
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

      /** PLY-03 : valeurs par défaut lisibles telles quelles dans le lecteur (libellé, description, consentement). */
      createForm: (workspaceName = '') =>
        run(async () => {
          const { data, error } = await supabase
            .from('forms')
            .insert({
              workspace_id: demo!.workspace_id,
              demo_id: demoId,
              description: i18n.t('editor.form.defaultDescription'),
              fields: [
                { key: 'email', label: i18n.t('editor.form.emailPro'), type: 'email', required: true },
              ],
              consent_text: workspaceName ? i18n.t('editor.form.defaultConsent', { ws: workspaceName }) : '',
            })
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

      /** F2 : questions du quiz (après la dernière étape). */
      addQuestion: (row: Pick<QuestionRow, 'type' | 'answers'>) =>
        run(async () => {
          await flush();
          const { data, error } = await supabase
            .from('quiz_questions')
            .insert({
              demo_id: demoId,
              workspace_id: demo!.workspace_id,
              position: questions.length,
              prompt: '',
              explanation: '',
              points: 1,
              step_id: null,
              ...row,
            })
            .select()
            .single();
          if (error) throw error;
          setQuestions((l) => [...l, data]);
          return data;
        }),

      deleteQuestion: (id: string) =>
        run(async () => {
          const { error } = await supabase.from('quiz_questions').delete().eq('id', id);
          if (error) throw error;
          setQuestions((l) => l.filter((q) => q.id !== id).map((q, i) => ({ ...q, position: i })));
        }),

      moveQuestion: (from: number, to: number) =>
        run(async () => {
          await flush();
          const next = moveItem(questions, from, to).map((q, i) => ({ ...q, position: i }));
          setQuestions(next);
          for (const q of next) {
            if (questions.find((o) => o.id === q.id)?.position === q.position) continue;
            const { error } = await supabase
              .from('quiz_questions')
              .update({ position: q.position })
              .eq('id', q.id);
            if (error) throw error;
          }
        }),

      flush,
      reload: load,
      /**
       * L22-08 : ligne relue après l'enregistrement d'une autre personne. Fusion champ par champ,
       * sans historique ni file d'enregistrement ; les champs de `keep` (modifiés ici à l'instant) restent.
       */
      mergeRemote(table: 'steps' | 'hotspots', row: Patch & { id: string }, keep: string[] = []) {
        const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !keep.includes(k)));
        if (table === 'steps')
          setSteps((list) => list.map((s) => (s.id === row.id ? { ...s, ...patch } : s)));
        else setHotspots((list) => list.map((h) => (h.id === row.id ? { ...h, ...patch } : h)));
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoId, demo, steps, hotspots, chapters, questions, queue, run, flush, load, signImages, history]);

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
    questions,
    imageUrls,
    saveState,
    lastError,
    ...api,
  };
}

export type DemoEditor = ReturnType<typeof useDemoEditor>;

/** Conversion utilitaire pour les colonnes JSON. */
export const json = (v: unknown) => v as Json;
