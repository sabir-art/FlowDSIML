-- FlowDSIML — buckets Storage et politiques
-- captures  : privé. Chemin = <workspace_id>/<demo_id>/<fichier>. Lecture viewer, écriture editor.
-- published : public. Chemin = <demo_id>/... (manifestes, images publiées). Écriture editor du workspace de la démo.
-- branding  : public. Chemin = <workspace_id>/... (logos). Écriture admin.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('captures', 'captures', false, 10485760, array['image/webp', 'image/png', 'image/jpeg']),
  ('published', 'published', true, 10485760, array['image/webp', 'image/png', 'image/jpeg', 'application/json']),
  ('branding', 'branding', true, 2097152, array['image/webp', 'image/png', 'image/jpeg', 'image/svg+xml'])
on conflict (id) do nothing;

-- uuid sûr depuis un segment de chemin (null si invalide)
create or replace function public.path_uuid(path text, idx int)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return ((string_to_array(path, '/'))[idx])::uuid;
exception when others then
  return null;
end $$;
grant execute on function public.path_uuid(text, int) to authenticated, anon;

create or replace function public.demo_workspace(p_demo uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select workspace_id from public.demos where id = p_demo;
$$;
revoke all on function public.demo_workspace(uuid) from public, anon;
grant execute on function public.demo_workspace(uuid) to authenticated;

drop policy if exists captures_select on storage.objects;
create policy captures_select on storage.objects for select to authenticated
  using (bucket_id = 'captures' and public.has_role(public.path_uuid(name, 1), 'viewer'));
drop policy if exists captures_insert on storage.objects;
create policy captures_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'captures' and public.has_role(public.path_uuid(name, 1), 'editor'));
drop policy if exists captures_update on storage.objects;
create policy captures_update on storage.objects for update to authenticated
  using (bucket_id = 'captures' and public.has_role(public.path_uuid(name, 1), 'editor'));
drop policy if exists captures_delete on storage.objects;
create policy captures_delete on storage.objects for delete to authenticated
  using (bucket_id = 'captures' and public.has_role(public.path_uuid(name, 1), 'editor'));

-- published : lecture publique via l'URL publique (pas besoin de politique select pour anon) ;
-- les editors peuvent lister / écrire / remplacer latest.json.
drop policy if exists published_select on storage.objects;
create policy published_select on storage.objects for select to authenticated
  using (bucket_id = 'published' and public.has_role(public.demo_workspace(public.path_uuid(name, 1)), 'viewer'));
drop policy if exists published_insert on storage.objects;
create policy published_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'published' and public.has_role(public.demo_workspace(public.path_uuid(name, 1)), 'editor'));
drop policy if exists published_update on storage.objects;
create policy published_update on storage.objects for update to authenticated
  using (bucket_id = 'published' and public.has_role(public.demo_workspace(public.path_uuid(name, 1)), 'editor'));
drop policy if exists published_delete on storage.objects;
create policy published_delete on storage.objects for delete to authenticated
  using (bucket_id = 'published' and public.has_role(public.demo_workspace(public.path_uuid(name, 1)), 'editor'));

drop policy if exists branding_write on storage.objects;
create policy branding_write on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.has_role(public.path_uuid(name, 1), 'admin'));
drop policy if exists branding_update on storage.objects;
create policy branding_update on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.has_role(public.path_uuid(name, 1), 'admin'));
drop policy if exists branding_select on storage.objects;
create policy branding_select on storage.objects for select to authenticated
  using (bucket_id = 'branding' and public.has_role(public.path_uuid(name, 1), 'viewer'));
drop policy if exists branding_delete on storage.objects;
create policy branding_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.has_role(public.path_uuid(name, 1), 'admin'));
