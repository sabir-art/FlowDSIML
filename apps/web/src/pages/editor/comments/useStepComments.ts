import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Tables } from '@flowdsiml/supabase-types';
import { supabase } from '../../../lib/supabase';
import { check } from '../../../lib/useAction';

export type StepComment = Tables<'step_comments'>;
export interface CommentAuthor {
  user_id: string;
  email: string;
  full_name: string;
}

/**
 * Commentaires internes d'une démo (toutes étapes), rafraîchis en temps réel via Supabase Realtime.
 * Jamais publiés : la table n'est lue ni par publish_demo ni par le player.
 */
export function useStepComments(demoId: string, workspaceId: string | undefined) {
  const [comments, setComments] = useState<StepComment[]>([]);
  const [authors, setAuthors] = useState<Record<string, CommentAuthor>>({});
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('step_comments')
      .select('*')
      .eq('demo_id', demoId)
      .order('created_at', { ascending: true });
    if (e) setError(e);
    else setComments(data ?? []);
  }, [demoId]);

  useEffect(() => {
    void reload();
    // Temps réel : un collègue commente → rafraîchissement (best effort, sans bloquer l'éditeur).
    const channel = supabase
      .channel(`step_comments:${demoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'step_comments', filter: `demo_id=eq.${demoId}` },
        () => void reload(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [demoId, reload]);

  useEffect(() => {
    if (!workspaceId) return;
    void supabase.rpc('list_members', { p_workspace: workspaceId }).then(({ data }) => {
      const rows = (data ?? []) as CommentAuthor[];
      setAuthors(Object.fromEntries(rows.map((r) => [r.user_id, r])));
    });
  }, [workspaceId]);

  /** Nombre de commentaires ouverts par étape (badges du rail). */
  const openByStep = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of comments) if (!c.resolved_at) m[c.step_id] = (m[c.step_id] ?? 0) + 1;
    return m;
  }, [comments]);

  const add = useCallback(async (stepId: string, body: string) => {
    const row = check(
      await supabase.from('step_comments').insert({ step_id: stepId, body }).select().single(),
    );
    setComments((list) => (list.some((c) => c.id === row.id) ? list : [...list, row]));
  }, []);
  const update = useCallback(async (id: string, body: string) => {
    check(await supabase.from('step_comments').update({ body }).eq('id', id));
    setComments((list) => list.map((c) => (c.id === id ? { ...c, body } : c)));
  }, []);
  const remove = useCallback(async (id: string) => {
    check(await supabase.from('step_comments').delete().eq('id', id));
    setComments((list) => list.filter((c) => c.id !== id));
  }, []);
  const setResolved = useCallback(
    async (id: string, resolved: boolean) => {
      check(await supabase.rpc('set_comment_resolved', { p_comment: id, p_resolved: resolved }));
      await reload();
    },
    [reload],
  );

  return { comments, authors, openByStep, error, reload, add, update, remove, setResolved };
}

export type StepCommentsApi = ReturnType<typeof useStepComments>;
