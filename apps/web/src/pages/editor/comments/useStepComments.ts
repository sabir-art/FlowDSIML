import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Tables } from '@flowdsiml/supabase-types';
import { supabase } from '../../../lib/supabase';
import { check } from '../../../lib/useAction';
import { changesChannel } from '../../../lib/channelName';

export type StepComment = Tables<'step_comments'>;
export interface CommentAuthor {
  user_id: string;
  email: string;
  full_name: string;
  role?: string;
}
/** Événement reçu d'un autre membre (annonce aria-live, mise en évidence « Nouveau »). */
export interface RemoteEvent {
  kind: 'added' | 'resolved' | 'deleted';
  authorId: string | null;
  commentId: string;
  at: number;
}

/**
 * Commentaires internes d'une démo (toutes étapes), rafraîchis en temps réel via Supabase Realtime.
 * Jamais publiés : la table n'est lue ni par publish_demo ni par le player.
 */
export function useStepComments(demoId: string, workspaceId: string | undefined, myId: string | undefined) {
  const [comments, setComments] = useState<StepComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [authors, setAuthors] = useState<Record<string, CommentAuthor>>({});
  const [remote, setRemote] = useState<RemoteEvent | null>(null);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const mine = useRef(new Set<string>());

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('step_comments')
      .select('*')
      .eq('demo_id', demoId)
      .order('created_at', { ascending: true });
    if (!error) setComments(data ?? []);
    setLoading(false);
  }, [demoId]);

  useEffect(() => {
    setLoading(true);
    void reload();
    // Temps réel (best effort) : un collègue commente, résout ou supprime → rafraîchissement + annonce.
    const channel = supabase
      .channel(changesChannel(`step_comments:${demoId}`))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'step_comments', filter: `demo_id=eq.${demoId}` },
        (payload) => {
          void reload();
          const n = payload.new as Partial<StepComment>;
          const o = payload.old as Partial<StepComment>;
          if (payload.eventType === 'INSERT' && n.id && n.author_id !== myId && !mine.current.has(n.id))
            setRemote({ kind: 'added', authorId: n.author_id ?? null, commentId: n.id, at: Date.now() });
          else if (
            payload.eventType === 'UPDATE' &&
            n.id &&
            n.resolved_at &&
            !o.resolved_at &&
            n.resolved_by !== myId
          )
            setRemote({ kind: 'resolved', authorId: n.resolved_by ?? null, commentId: n.id, at: Date.now() });
          else if (payload.eventType === 'DELETE' && o.id && !mine.current.has(o.id))
            setRemote({ kind: 'deleted', authorId: null, commentId: o.id, at: Date.now() });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [demoId, reload, myId]);

  useEffect(() => {
    const up = () => {
      setOnline(true);
      void reload();
    };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, [reload]);

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

  /** Attend le retour du réseau avant d'envoyer (la saisie reste possible hors ligne). */
  const whenOnline = useCallback(
    () =>
      navigator.onLine
        ? Promise.resolve()
        : new Promise<void>((resolve) => window.addEventListener('online', () => resolve(), { once: true })),
    [],
  );

  const add = useCallback(
    async (stepId: string, body: string) => {
      await whenOnline();
      const row = check(
        await supabase.from('step_comments').insert({ step_id: stepId, body }).select().single(),
      );
      mine.current.add(row.id);
      setComments((list) => (list.some((c) => c.id === row.id) ? list : [...list, row]));
    },
    [whenOnline],
  );
  const update = useCallback(async (id: string, body: string) => {
    check(await supabase.from('step_comments').update({ body }).eq('id', id));
    setComments((list) =>
      list.map((c) => (c.id === id ? { ...c, body, updated_at: new Date().toISOString() } : c)),
    );
  }, []);
  const remove = useCallback(async (id: string) => {
    mine.current.add(id);
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

  return { comments, loading, authors, openByStep, remote, online, reload, add, update, remove, setResolved };
}

export type StepCommentsApi = ReturnType<typeof useStepComments>;
