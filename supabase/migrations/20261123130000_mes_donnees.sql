-- L28 171/172 : « Exporter mes données » et « Supprimer mon compte » (spec docs/ux/specs/l28-complements.md §7,
-- schéma D validé par le chef d'équipe avec ses trois arbitrages). Idempotent.
--  * export_my_data() : données personnelles de l'utilisateur courant (profil, espaces et rôles,
--    commentaires écrits, notifications, préférences, confirmations de publication). Le .zip est fait et
--    téléchargé dans le navigateur : rien n'est conservé sur le serveur.
--  * account_deletion_check() : espaces qui bloquent (seul propriétaire avec d'autres membres) et espaces
--    supprimés avec le compte (seul membre), pour la modale.
--  * delete_my_account(p_email, p_password, p_orphans) : session de moins de 5 minutes (sinon
--    REAUTH_REQUIRED), adresse e-mail saisie, mot de passe vérifié s'il existe (comptes Google ou lien
--    magique : aucun). Les fichiers des espaces supprimés sont effacés par l'app avant l'appel ; les
--    chemins qu'elle n'a pas pu effacer sont inscrits dans storage_orphans pour la purge différée.
--  * Les commentaires de l'utilisateur restent, signés « Ancien membre » (author_id passe à null).

-- ===== Commentaires gardés après la suppression d'un compte =====
alter table public.step_comments alter column author_id drop not null;
alter table public.step_comments drop constraint if exists step_comments_author_id_fkey;
alter table public.step_comments add constraint step_comments_author_id_fkey
  foreign key (author_id) references auth.users (id) on delete set null;

-- Le contexte d'un commentaire reste figé ; seule exception : l'auteur effacé avec son compte
-- (on delete set null). Les utilisateurs ne peuvent modifier que body (droit par colonne).
create or replace function public.step_comments_context() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    select s.workspace_id, s.demo_id into new.workspace_id, new.demo_id from public.steps s where s.id = new.step_id;
    if new.workspace_id is null then raise exception 'STEP_NOT_FOUND'; end if;
    if auth.uid() is not null then new.author_id := auth.uid(); end if;
  elsif new.author_id is null and old.author_id is not null then
    -- Compte supprimé : le commentaire reste, signé « Ancien membre » ; rien d'autre ne change
    new := old;
    new.author_id := null;
  else
    -- Seul le texte change par UPDATE direct ; la résolution passe par set_comment_resolved.
    new.workspace_id := old.workspace_id;
    new.demo_id := old.demo_id;
    new.step_id := old.step_id;
    new.author_id := old.author_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$;

-- ===== Fichiers à purger (service_role seulement) =====
create table if not exists public.storage_orphans (
  id bigint generated always as identity primary key,
  bucket text not null check (bucket ~ '^[a-z][a-z0-9_-]{1,40}$'),
  path text not null check (char_length(path) between 1 and 1024 and path !~ '\.\.'),
  created_at timestamptz not null default now()
);
alter table public.storage_orphans enable row level security;
revoke all on public.storage_orphans from public, anon, authenticated;
grant all on public.storage_orphans to service_role;

-- ===== Export =====
create or replace function public.export_my_data()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return jsonb_build_object(
    'exportedAt', now(),
    'profile', (select jsonb_build_object('id', u.id, 'email', u.email, 'fullName', p.full_name,
                                          'locale', p.locale, 'createdAt', u.created_at)
                  from auth.users u left join public.profiles p on p.id = u.id where u.id = v_uid),
    'workspaces', coalesce((select jsonb_agg(jsonb_build_object('name', w.name, 'role', m.role, 'since', m.created_at)
                                             order by w.name)
                              from public.members m join public.workspaces w on w.id = m.workspace_id
                             where m.user_id = v_uid), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('workspace', w.name, 'demo', d.title, 'body', c.body,
                                                              'createdAt', c.created_at, 'resolvedAt', c.resolved_at)
                                           order by c.created_at)
                            from public.step_comments c
                            join public.demos d on d.id = c.demo_id
                            join public.workspaces w on w.id = c.workspace_id
                           where c.author_id = v_uid), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('kind', n.kind, 'demo', d.title,
                                                                   'createdAt', n.created_at, 'readAt', n.read_at)
                                                order by n.created_at)
                                 from public.notifications n left join public.demos d on d.id = n.demo_id
                                where n.user_id = v_uid), '[]'::jsonb),
    'preferences', jsonb_build_object(
      'notifications', (select s.prefs from public.notification_settings s where s.user_id = v_uid),
      'mutedDemos', coalesce((select jsonb_agg(d.title order by d.title) from public.notification_mutes nm
                                join public.demos d on d.id = nm.demo_id where nm.user_id = v_uid), '[]'::jsonb)),
    'publicationConfirmations', coalesce((select jsonb_agg(jsonb_build_object('demo', d.title, 'version', v.number,
                                                                              'confirmation', v.public_ack)
                                                           order by v.published_at)
                                            from public.demo_versions v join public.demos d on d.id = v.demo_id
                                           where v.public_ack ->> 'by' = v_uid::text), '[]'::jsonb));
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- ===== Suppression du compte =====
create or replace function public.account_deletion_check()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    -- Seul propriétaire d'un espace qui a d'autres membres : à transférer d'abord
    'blocking', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name) order by w.name)
                            from public.members m join public.workspaces w on w.id = m.workspace_id
                           where m.user_id = (select auth.uid()) and m.role = 'owner'
                             and not exists (select 1 from public.members o where o.workspace_id = m.workspace_id
                                               and o.user_id <> m.user_id and o.role = 'owner')
                             and exists (select 1 from public.members o where o.workspace_id = m.workspace_id
                                           and o.user_id <> m.user_id)), '[]'::jsonb),
    -- Seul membre : supprimé avec le compte
    'solo', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name,
                                         'demos', (select count(*) from public.demos d where d.workspace_id = w.id
                                                     and d.deleted_at is null)) order by w.name)
                        from public.members m join public.workspaces w on w.id = m.workspace_id
                       where m.user_id = (select auth.uid())
                         and not exists (select 1 from public.members o where o.workspace_id = m.workspace_id
                                           and o.user_id <> m.user_id)), '[]'::jsonb),
    'hasPassword', coalesce((select coalesce(u.encrypted_password, '') <> '' from auth.users u
                              where u.id = (select auth.uid())), false));
$$;
revoke all on function public.account_deletion_check() from public, anon;
grant execute on function public.account_deletion_check() to authenticated;

create or replace function public.delete_my_account(p_email text, p_password text default null,
                                                    p_orphans jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_user record;
  v_check jsonb;
  v_iat bigint := nullif(auth.jwt() ->> 'iat', '')::bigint;
  v_solo uuid[];
begin
  if v_uid is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  -- Session récente exigée (moins de 5 minutes) : l'app redemande la connexion sinon
  if v_iat is null or v_iat < extract(epoch from now())::bigint - 300 then
    raise exception 'REAUTH_REQUIRED' using errcode = 'P0001';
  end if;
  select id, email, coalesce(encrypted_password, '') as pw into v_user from auth.users where id = v_uid;
  if lower(trim(coalesce(p_email, ''))) is distinct from lower(v_user.email) then
    raise exception 'EMAIL_MISMATCH' using errcode = 'P0001';
  end if;
  if v_user.pw <> '' and (p_password is null or extensions.crypt(p_password, v_user.pw) <> v_user.pw) then
    raise exception 'PASSWORD_MISMATCH' using errcode = 'P0001';
  end if;
  v_check := public.account_deletion_check();
  if jsonb_array_length(v_check -> 'blocking') > 0 then
    raise exception 'ACCOUNT_SOLE_OWNER:%', (select string_agg(b ->> 'name', ', ')
                                              from jsonb_array_elements(v_check -> 'blocking') b)
      using errcode = 'P0001';
  end if;
  select coalesce(array_agg((s ->> 'id')::uuid), '{}') into v_solo from jsonb_array_elements(v_check -> 'solo') s;
  -- Chemins non effacés par l'app : seulement ceux des espaces supprimés (ou de leurs démos publiées)
  insert into public.storage_orphans (bucket, path)
  select o ->> 'bucket', o ->> 'path'
    from jsonb_array_elements(case when jsonb_typeof(p_orphans) = 'array' then p_orphans else '[]'::jsonb end) o
   where jsonb_typeof(o -> 'bucket') = 'string' and jsonb_typeof(o -> 'path') = 'string'
     and (public.path_uuid(o ->> 'path', 1) = any (v_solo)
          or exists (select 1 from public.demos d where d.workspace_id = any (v_solo)
                       and d.id = public.path_uuid(o ->> 'path', 1)));
  delete from public.workspaces where id = any (v_solo);
  delete from auth.users where id = v_uid;
end $$;
revoke all on function public.delete_my_account(text, text, jsonb) from public, anon;
grant execute on function public.delete_my_account(text, text, jsonb) to authenticated;
