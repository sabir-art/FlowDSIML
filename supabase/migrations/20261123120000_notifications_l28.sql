-- L28 122 : notifications de commentaires (spec docs/ux/specs/l28-complements.md §6, schéma C validé par le
-- chef d'équipe). Idempotent.
--  * Commentaire supprimé : la notification reste (comment_id passe à null) et l'app affiche « Ce commentaire
--    a été supprimé. ». Aucun extrait n'est stocké dans la notification (le texte est relu sous RLS).
--  * notification_mutes : démos coupées par personne (« Couper les notifications de cette démo »).
--  * notify_comment : mention toujours envoyée (préférences et démo coupée ne la bloquent pas) ; aucune
--    notification à un membre qui ne voit pas la démo (dossier restreint L27) ; le reste est inchangé :
--    jamais pour ses propres actions, une seule par événement (priorité à la mention), réouverture muette.

-- ===== Commentaire supprimé =====
alter table public.notifications alter column comment_id drop not null;
alter table public.notifications drop constraint if exists notifications_comment_id_fkey;
alter table public.notifications add constraint notifications_comment_id_fkey
  foreign key (comment_id) references public.step_comments (id) on delete set null;
alter table public.notifications drop constraint if exists notifications_kind_refs;
alter table public.notifications add constraint notifications_kind_refs check (case when kind = 'alert'
  then alert_id is not null and comment_id is null
  else demo_id is not null and step_id is not null and alert_id is null end);

-- ===== Démos coupées =====
create table if not exists public.notification_mutes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  demo_id uuid not null references public.demos (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, demo_id)
);
alter table public.notification_mutes enable row level security;
revoke all on public.notification_mutes from anon, authenticated;
grant select, delete on public.notification_mutes to authenticated;
grant insert (demo_id, workspace_id) on public.notification_mutes to authenticated;
drop policy if exists notification_mutes_own on public.notification_mutes;
create policy notification_mutes_own on public.notification_mutes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.has_role(workspace_id, 'viewer')
              and exists (select 1 from public.demos d where d.id = demo_id and d.workspace_id = notification_mutes.workspace_id));

-- ===== Visibilité d'une démo pour un membre donné (dossier restreint L27) =====
create or replace function public.demo_visible_to(p_demo uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select exists (select 1 from public.members m where m.workspace_id = d.workspace_id and m.user_id = p_user
                     and m.role >= 'admin')
        or d.folder_id is null
        or not exists (
          with recursive anc as (
            select f.id, f.parent_id, f.restricted from public.folders f where f.id = d.folder_id
            union all
            select f.id, f.parent_id, f.restricted from public.folders f join anc on f.id = anc.parent_id
          )
          select 1 from anc where anc.restricted
            and not exists (select 1 from public.folder_members fm where fm.folder_id = anc.id and fm.user_id = p_user))
    from public.demos d where d.id = p_demo), false);
$$;
revoke all on function public.demo_visible_to(uuid, uuid) from public, anon, authenticated;

-- Préférence d'un type (la mention est toujours voulue)
create or replace function public.notification_wanted(p_user uuid, p_kind text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_kind = 'mention'
      or coalesce((select (n.prefs ->> p_kind)::boolean from public.notification_settings n where n.user_id = p_user), true);
$$;
revoke all on function public.notification_wanted(uuid, text) from public, anon, authenticated;

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
          from public.step_comments c where c.step_id = new.step_id and c.id <> new.id and c.author_id is not null
        union all
        select d.created_by, 'comment', 2 from public.demos d where d.id = new.demo_id and d.created_by is not null
      ) x order by uid, prio
    ) r
    where r.uid is distinct from new.author_id
      and exists (select 1 from public.members m where m.workspace_id = new.workspace_id and m.user_id = r.uid)
      and public.demo_visible_to(new.demo_id, r.uid)
      and public.notification_wanted(r.uid, r.kind)
      and (r.kind = 'mention' or not exists (select 1 from public.notification_mutes nm
                                              where nm.user_id = r.uid and nm.demo_id = new.demo_id));
  elsif tg_op = 'UPDATE' and old.resolved_at is null and new.resolved_at is not null
        and new.author_id is not null
        and new.resolved_by is distinct from new.author_id
        and exists (select 1 from public.members m where m.workspace_id = new.workspace_id and m.user_id = new.author_id)
        and public.demo_visible_to(new.demo_id, new.author_id)
        and public.notification_wanted(new.author_id, 'resolved')
        and not exists (select 1 from public.notification_mutes nm
                         where nm.user_id = new.author_id and nm.demo_id = new.demo_id) then
    insert into public.notifications (workspace_id, user_id, kind, demo_id, step_id, comment_id, actor_id)
    values (new.workspace_id, new.author_id, 'resolved', new.demo_id, new.step_id, new.id, new.resolved_by);
  end if;
  return null;
end $$;
revoke all on function public.notify_comment() from public, anon, authenticated;
