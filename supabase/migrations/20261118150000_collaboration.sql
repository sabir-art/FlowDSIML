-- FlowDSIML — L22 Mode présentateur et collaboration. Idempotent, additif.
--  * steps.presenter_notes : notes privées de l'animateur (1 000 caractères, spec L22-01). publish_demo ne lit pas cette colonne :
--    elles ne sont jamais publiées (ni manifeste, ni lecteur).
--  * notifications : notifications dans l'app (pas d'e-mail). Elles ne portent que des références ;
--    le texte du commentaire est relu via step_comments, soumis à sa propre RLS. Créées par trigger
--    (nouveau commentaire : personnes mentionnées « @[Nom](uuid) », fil de l'étape, créateur de la
--    démo ; résolution : auteur), jamais par le client. Préférences par type dans
--    profiles.notification_prefs (un type à false n'est plus notifié). Chacun ne lit que les siennes, et seulement s'il est encore membre du workspace.
--  * Présence (Realtime) : canal privé « demo:<uuid> » réservé aux membres (viewer+), extension
--    presence seulement, sujet validé par expression régulière avant tout cast.

-- ===== Notes du présentateur =====
alter table public.steps add column if not exists presenter_notes text not null default '';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'steps_presenter_notes_len') then
    alter table public.steps add constraint steps_presenter_notes_len check (char_length(presenter_notes) <= 1000);
  end if;
end $$;

-- ===== Notifications =====
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('mention', 'comment', 'reply', 'resolved')),
  demo_id uuid not null references public.demos (id) on delete cascade,
  step_id uuid not null references public.steps (id) on delete cascade,
  comment_id uuid not null references public.step_comments (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
-- Préférences de notification dans l'app : {"mention": bool, "reply": bool, "comment": bool, "resolved": bool}
alter table public.profiles add column if not exists notification_prefs jsonb not null default '{}'::jsonb;
create or replace function public.notification_prefs_valid(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and not exists (select 1 from jsonb_each(p) e
                    where e.key not in ('mention', 'reply', 'comment', 'resolved') or jsonb_typeof(e.value) <> 'boolean');
$$;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_notification_prefs_valid') then
    alter table public.profiles add constraint profiles_notification_prefs_valid
      check (public.notification_prefs_valid(notification_prefs));
  end if;
end $$;

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
revoke insert, update, delete on public.notifications from authenticated;
grant select on public.notifications to authenticated;
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and public.has_role(workspace_id, 'viewer'));

/** Le type est-il activé pour cet utilisateur ? (absent = activé) */
create or replace function public.notification_wanted(p_user uuid, p_kind text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (p.notification_prefs ->> p_kind)::boolean from public.profiles p where p.id = p_user), true);
$$;
revoke all on function public.notification_wanted(uuid, text) from public, anon, authenticated;

/** Destinataires d'un nouveau commentaire, un seul par personne, par priorité : mention (@), réponse
    à un fil où la personne a écrit, commentaire sur une démo qu'elle a créée. Jamais l'auteur, jamais
    un non-membre, jamais un type désactivé dans ses préférences. */
create or replace function public.notify_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (workspace_id, user_id, kind, demo_id, step_id, comment_id, actor_id)
    select new.workspace_id, r.uid, r.kind, new.demo_id, new.step_id, new.id, new.author_id
    from (
      select distinct on (uid) uid, kind from (
        select (m[1])::uuid as uid, 'mention' as kind, 0 as prio
          from regexp_matches(new.body,
                 '@\[[^\]]{1,80}\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)', 'g') as m
        union all
        select c.author_id, 'reply', 1
          from public.step_comments c where c.step_id = new.step_id and c.id <> new.id
        union all
        select d.created_by, 'comment', 2 from public.demos d where d.id = new.demo_id and d.created_by is not null
      ) x order by uid, prio
    ) r
    where r.uid is distinct from new.author_id
      and exists (select 1 from public.members m where m.workspace_id = new.workspace_id and m.user_id = r.uid)
      and public.notification_wanted(r.uid, r.kind);
  elsif tg_op = 'UPDATE' and old.resolved_at is null and new.resolved_at is not null
        and new.resolved_by is distinct from new.author_id
        and exists (select 1 from public.members m where m.workspace_id = new.workspace_id and m.user_id = new.author_id)
        and public.notification_wanted(new.author_id, 'resolved') then
    insert into public.notifications (workspace_id, user_id, kind, demo_id, step_id, comment_id, actor_id)
    values (new.workspace_id, new.author_id, 'resolved', new.demo_id, new.step_id, new.id, new.resolved_by);
  end if;
  return null;
end $$;
revoke all on function public.notify_comment() from public, anon, authenticated;
drop trigger if exists step_comments_notify on public.step_comments;
create trigger step_comments_notify after insert or update of resolved_at on public.step_comments
  for each row execute function public.notify_comment();

/** Marque comme lues ses propres notifications (toutes si p_ids est null). Renvoie le nombre. */
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end $$;

-- ===== Présence sur une démo (Realtime Authorization) =====
/** Le sujet « demo:<uuid> » désigne une démo dont l'utilisateur est membre (viewer+). Tout autre
    sujet, mal formé compris, est refusé sans erreur (regex stricte avant le cast). */
create or replace function public.presence_topic_allowed(p_topic text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if p_topic is null
     or p_topic !~ '^demo:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return coalesce(public.has_role(public.demo_workspace(substr(p_topic, 6)::uuid), 'viewer'), false);
end $$;
revoke all on function public.presence_topic_allowed(text) from public, anon;
grant execute on function public.presence_topic_allowed(text) to authenticated;

-- Un refus de droits sur le schéma realtime (rôle de déploiement) ne doit pas faire échouer la
-- migration : on le signale, et les policies sont vérifiées après déploiement.
do $$
begin
  if to_regclass('realtime.messages') is not null then
    begin
      execute 'drop policy if exists demo_presence_read on realtime.messages';
      execute $p$create policy demo_presence_read on realtime.messages for select to authenticated
        using (extension = 'presence' and public.presence_topic_allowed((select realtime.topic())))$p$;
      execute 'drop policy if exists demo_presence_write on realtime.messages';
      execute $p$create policy demo_presence_write on realtime.messages for insert to authenticated
        with check (extension = 'presence' and public.presence_topic_allowed((select realtime.topic())))$p$;
    exception when insufficient_privilege then
      raise notice 'Policies de présence non créées (droits insuffisants sur realtime.messages) : à créer à la main';
    end;
  end if;
end $$;
