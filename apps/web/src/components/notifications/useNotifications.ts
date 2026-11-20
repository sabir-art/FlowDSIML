/**
 * L22-05 : notifications de l'utilisateur dans le workspace courant (30 derniers jours).
 * Les lignes ne portent que des références : extrait, titre de démo et numéro d'étape sont relus
 * sous RLS. Un membre qui a perdu l'accès ne voit plus rien (RLS de notifications et step_comments).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import {
  isSystemKind,
  readPrefs,
  type NotificationKind,
  type NotificationPrefs,
  type NotificationRow,
} from './notifications';

export interface NotificationItem extends NotificationRow {
  actorName: string;
  demoTitle: string;
  stepNumber: number | null;
  body: string | null;
  /** L28-06 : commentaire supprimé (la notification reste lisible). */
  deleted: boolean;
}
/** L28-06 : démo dont les notifications sont coupées (sauf les mentions). */
export interface MutedDemo {
  demoId: string;
  title: string;
}

const DAYS = 30;

export function useNotifications() {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const ws = current?.id;
  const me = user?.id;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefsState] = useState<NotificationPrefs>(() => readPrefs(null));
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!ws || !me) return;
    const mine = ++seq.current;
    const since = new Date(Date.now() - DAYS * 86400_000).toISOString();
    const { data } = await supabase
      .from('notifications')
      .select('id, kind, demo_id, step_id, comment_id, alert_id, data, actor_id, created_at, read_at')
      .eq('workspace_id', ws)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100);
    const rows = (data ?? []) as NotificationRow[];
    const uniq = (k: 'demo_id' | 'step_id' | 'comment_id') => [
      ...new Set(rows.map((r) => r[k]).filter((v): v is string => !!v)),
    ];
    const [comments, demos, steps, members] = rows.length
      ? await Promise.all([
          supabase.from('step_comments').select('id, body').in('id', uniq('comment_id')),
          supabase.from('demos').select('id, title').in('id', uniq('demo_id')),
          supabase.from('steps').select('id, position').in('id', uniq('step_id')),
          supabase.rpc('list_members', { p_workspace: ws }),
        ])
      : [null, null, null, null];
    if (mine !== seq.current) return;
    const by = <T extends { id: string }>(list: T[] | null | undefined) =>
      new Map((list ?? []).map((x) => [x.id, x]));
    const cm = by(comments?.data as Array<{ id: string; body: string }> | null);
    const dm = by(demos?.data as Array<{ id: string; title: string }> | null);
    const sm = by(steps?.data as Array<{ id: string; position: number }> | null);
    const names = new Map(
      ((members?.data ?? []) as Array<{ user_id: string; full_name: string; email: string }>).map((m) => [
        m.user_id,
        m.full_name || m.email,
      ]),
    );
    setItems(
      rows
        // L28-06 : commentaire supprimé (comment_id vide) : la notification reste. Accès perdu au fil :
        // elle disparaît. Une alerte ne porte pas de fil : elle reste.
        .filter((r) => isSystemKind(r.kind) || !r.comment_id || cm.has(r.comment_id))
        .map((r) => ({
          ...r,
          actorName: (r.actor_id && names.get(r.actor_id)) || '',
          demoTitle: (r.demo_id && dm.get(r.demo_id)?.title) || '',
          stepNumber: r.step_id && sm.has(r.step_id) ? sm.get(r.step_id)!.position + 1 : null,
          body: (r.comment_id && cm.get(r.comment_id)?.body) || null,
          deleted: !isSystemKind(r.kind) && !r.comment_id,
        })),
    );
    setLoading(false);
  }, [ws, me]);

  useEffect(() => {
    if (!ws || !me) return;
    setLoading(true);
    void reload();
    // La pastille se met à jour sans recharger ; rien n'est annoncé (seul le nombre change)
    const channel = supabase
      .channel(`notifications:${me}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` },
        () => void reload(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ws, me, reload]);

  // Préférences : table à part, lisible par son seul propriétaire (RLS)
  const hasRow = useRef(false);
  useEffect(() => {
    if (!me) return;
    void supabase
      .from('notification_settings')
      .select('prefs')
      .eq('user_id', me)
      .maybeSingle()
      .then(({ data }) => {
        hasRow.current = !!data;
        setPrefsState(readPrefs(data?.prefs));
      });
  }, [me]);

  const markRead = useCallback(async (ids?: string[]) => {
    const at = new Date().toISOString();
    setItems((list) =>
      list.map((n) => (!ids || ids.includes(n.id) ? { ...n, read_at: n.read_at ?? at } : n)),
    );
    await supabase.rpc('mark_notifications_read', ids ? { p_ids: ids } : {});
  }, []);

  const setPref = useCallback(
    async (kind: NotificationKind, on: boolean) => {
      if (!me) return;
      const next = { ...prefs, [kind]: on };
      setPrefsState(next);
      const { error } = hasRow.current
        ? await supabase.from('notification_settings').update({ prefs: next }).eq('user_id', me)
        : await supabase.from('notification_settings').insert({ user_id: me, prefs: next });
      if (!error) hasRow.current = true;
      if (error) setPrefsState(prefs);
      return !error;
    },
    [me, prefs],
  );

  // L28-06 : démos coupées (privées, RLS)
  const [muted, setMuted] = useState<MutedDemo[]>([]);
  const loadMuted = useCallback(async () => {
    if (!ws || !me) return;
    const { data } = await supabase
      .from('notification_mutes')
      .select('demo_id, demos(title)')
      .eq('workspace_id', ws);
    setMuted(
      ((data ?? []) as unknown as Array<{ demo_id: string; demos: { title: string } | null }>).map((m) => ({
        demoId: m.demo_id,
        title: m.demos?.title ?? '',
      })),
    );
  }, [ws, me]);
  useEffect(() => void loadMuted(), [loadMuted]);
  const mute = useCallback(
    async (demoId: string) => {
      if (!ws) return false;
      const { error } = await supabase
        .from('notification_mutes')
        .insert({ demo_id: demoId, workspace_id: ws });
      await loadMuted();
      return !error;
    },
    [ws, loadMuted],
  );
  const unmute = useCallback(
    async (demoId: string) => {
      const { error } = await supabase.from('notification_mutes').delete().eq('demo_id', demoId);
      await loadMuted();
      return !error;
    },
    [loadMuted],
  );

  const unread = items.filter((n) => !n.read_at).length;
  return { items, loading, unread, markRead, prefs, setPref, reload, muted, mute, unmute };
}
