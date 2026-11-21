-- Retour client (photo de profil), cadrage du chef : bucket Storage « avatars ». Idempotent.
-- - Privé : lecture par l'utilisateur lui-même et par les membres d'un espace en commun (URL signées).
-- - Écriture, remplacement et suppression par l'utilisateur seul, sous son dossier <uid>/.
-- - JPG, PNG ou WebP, 2 Mo au plus : imposé par le bucket (taille et type), pas seulement par l'app.
-- - profiles.avatar_path : chemin de la photo, toujours dans le dossier de la personne.
-- - RGPD : à la suppression du compte, l'app efface la photo ; ce qui reste est inscrit dans
--   storage_orphans (purge différée), par un déclencheur sur auth.users. L'export « Mes données » joint
--   la photo (préparé dans le navigateur, comme le reste de l'export).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

/** Deux personnes partagent-elles au moins un espace ? (lecture des photos) */
create or replace function public.shares_workspace(p_other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_other = (select auth.uid())
      or exists (select 1 from public.members a
                   join public.members b on b.workspace_id = a.workspace_id
                  where a.user_id = (select auth.uid()) and b.user_id = p_other);
$$;
revoke all on function public.shares_workspace(uuid) from public, anon;
grant execute on function public.shares_workspace(uuid) to authenticated;

drop policy if exists avatars_select on storage.objects;
create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.shares_workspace(public.path_uuid(name, 1)));
drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.path_uuid(name, 1) = (select auth.uid()));
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.path_uuid(name, 1) = (select auth.uid()))
  with check (bucket_id = 'avatars' and public.path_uuid(name, 1) = (select auth.uid()));
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.path_uuid(name, 1) = (select auth.uid()));

-- Chemin de la photo : toujours <id>/<nom>.(jpg|png|webp), jamais le dossier d'un autre
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles drop constraint if exists profiles_avatar_path_ok;
alter table public.profiles add constraint profiles_avatar_path_ok check (
  avatar_path is null
  or avatar_path ~ ('^' || id::text || '/[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$'));

-- RGPD : photos restées dans le bucket à la suppression du compte, pour la purge différée
create or replace function private.avatars_orphan_on_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.storage_orphans (bucket, path)
  select 'avatars', o.name from storage.objects o
   where o.bucket_id = 'avatars' and public.path_uuid(o.name, 1) = old.id;
  return old;
end $$;
revoke all on function private.avatars_orphan_on_delete() from public, anon, authenticated;
drop trigger if exists avatars_orphan_on_delete on auth.users;
create trigger avatars_orphan_on_delete before delete on auth.users
  for each row execute function private.avatars_orphan_on_delete();
