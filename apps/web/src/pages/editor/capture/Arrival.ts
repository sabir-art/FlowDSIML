import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../../components/Toast';
import type { DemoEditor } from '../useDemoEditor';

/**
 * L60 §3 : arrivée d'une capture dans l'éditeur. L'extension ouvre `#/demos/:id/edit?ready=n` :
 *  - toast « Démo prête : n étapes capturées » avec l'action « Aperçu » ;
 *  - chaque étape porte l'étiquette verte « Nouvelle » jusqu'à sa première modification (texte, image,
 *    bulles, voix…), même après un rechargement de la page.
 */
const keyOf = (demoId: string) => `fd.arrival.${demoId}`;

export function useArrival(editor: DemoEditor, demoId: string | undefined, onPreview: () => void) {
  const { t } = useTranslation();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const ready = params.get('ready');
  /** Empreinte de chaque étape « Nouvelle » au moment de l'arrivée. */
  const [marks, setMarks] = useState<Record<string, string>>({});
  const loadedFor = useRef<string | null>(null);
  const sig = useCallback(
    (id: string) => {
      const s = editor.steps.find((x) => x.id === id);
      if (!s) return '';
      // La place dans la liste change quand on en déplace une autre : elle ne compte pas
      const { position: _p, updated_at: _u, ...rest } = s as typeof s & { updated_at?: string };
      return JSON.stringify([rest, editor.hotspots.filter((h) => h.step_id === id)]);
    },
    [editor.steps, editor.hotspots],
  );
  const save = useCallback(
    (m: Record<string, string>) => {
      setMarks(m);
      if (!demoId) return;
      try {
        if (Object.keys(m).length) localStorage.setItem(keyOf(demoId), JSON.stringify(m));
        else localStorage.removeItem(keyOf(demoId));
      } catch {
        /* stockage indisponible : l'étiquette ne survit pas à un rechargement */
      }
    },
    [demoId],
  );
  // Étiquettes déjà posées (rechargement de la page)
  useEffect(() => {
    if (!demoId || loadedFor.current === demoId) return;
    loadedFor.current = demoId;
    try {
      setMarks(JSON.parse(localStorage.getItem(keyOf(demoId)) ?? '{}') as Record<string, string>);
    } catch {
      setMarks({});
    }
  }, [demoId]);
  // Arrivée : toast, toutes les étapes « Nouvelle »
  useEffect(() => {
    if (!ready || !demoId || editor.loading || !editor.steps.length) return;
    const n = Number(ready) > 0 ? Number(ready) : editor.steps.length;
    save(Object.fromEntries(editor.steps.map((s) => [s.id, sig(s.id)])));
    toast(t('editor.arrival.ready', { count: n }), {
      label: t('editor.arrival.preview'),
      durationMs: 8000,
      onClick: onPreview,
    });
    const next = new URLSearchParams(params);
    next.delete('ready');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois par arrivée
  }, [ready, demoId, editor.loading, editor.steps.length]);
  // Première modification d'une étape (ou suppression) : l'étiquette part
  useEffect(() => {
    if (editor.loading) return;
    const ids = Object.keys(marks);
    if (!ids.length) return;
    const kept = ids.filter((id) => sig(id) === marks[id]);
    if (kept.length !== ids.length) save(Object.fromEntries(kept.map((id) => [id, marks[id]!])));
  }, [marks, sig, save, editor.loading]);
  return { fresh: Object.keys(marks) };
}
