-- L29 schéma E (validé par le chef d'équipe le 20 novembre) : l'accès restreint par dossier (L27-09)
-- s'applique aussi aux fichiers. Revue de sécurité S1 (docs/tech/securite-revue.md) : sans ce filtre,
-- un membre exclu d'un dossier pouvait lister <espace>/ et ouvrir les fichiers des démos du dossier.
--  * captures, videos, voices, html (chemin <espace>/<démo>/…) : demo_visible(path_uuid(name, 2)) ;
--  * published (chemin <démo>/…) : demo_visible(path_uuid(name, 1)) ; le lecteur public passe par
--    open-demo (service role) et n'est pas concerné.
-- demo_visible vaut true pour un identifiant qui n'est pas une démo (ou null) : un chemin mal formé
-- n'ouvre jamais plus que le has_role existant. Idempotent.

drop policy if exists captures_select on storage.objects;
create policy captures_select on storage.objects for select to authenticated
  using (bucket_id = 'captures' and public.has_role(public.path_uuid(name, 1), 'viewer') and public.demo_visible(public.path_uuid(name, 2)));
drop policy if exists captures_insert on storage.objects;
create policy captures_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'captures' and public.has_role(public.path_uuid(name, 1), 'editor') and public.demo_visible(public.path_uuid(name, 2)));
drop policy if exists captures_update on storage.objects;
create policy captures_update on storage.objects for update to authenticated
  using (bucket_id = 'captures' and public.has_role(public.path_uuid(name, 1), 'editor') and public.demo_visible(public.path_uuid(name, 2)));
drop policy if exists captures_delete on storage.objects;
create policy captures_delete on storage.objects for delete to authenticated
  using (bucket_id = 'captures' and public.has_role(public.path_uuid(name, 1), 'editor') and public.demo_visible(public.path_uuid(name, 2)));
drop policy if exists videos_select on storage.objects;
create policy videos_select on storage.objects for select to authenticated
  using (bucket_id = 'videos' and public.has_role(public.path_uuid(name, 1), 'viewer') and public.demo_visible(public.path_uuid(name, 2)));
drop policy if exists videos_insert on storage.objects;
create policy videos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and public.has_role(public.path_uuid(name, 1), 'editor') and public.demo_visible(public.path_uuid(name, 2)));
drop policy if exists videos_update on storage.objects;
create policy videos_update on storage.objects for update to authenticated
  using (bucket_id = 'videos' and public.has_role(public.path_uuid(name, 1), 'editor') and public.demo_visible(public.path_uuid(name, 2)));
drop policy if exists videos_delete on storage.objects;
create policy videos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and public.has_role(public.path_uuid(name, 1), 'editor') and public.demo_visible(public.path_uuid(name, 2)));
drop policy if exists voices_select on storage.objects;
create policy voices_select on storage.objects for select to authenticated
  using (bucket_id = 'voices' and public.has_role(public.path_uuid(name, 1), 'viewer') and public.demo_visible(public.path_uuid(name, 2)));
drop policy if exists voices_insert on storage.objects;
create policy voices_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'voices' and public.has_role(public.path_uuid(name, 1), 'editor') and public.demo_visible(public.path_uuid(name, 2)));
drop policy if exists voices_update on storage.objects;
create policy voices_update on storage.objects for update to authenticated
  using (bucket_id = 'voices' and public.has_role(public.path_uuid(name, 1), 'editor') and public.demo_visible(public.path_uuid(name, 2)));
drop policy if exists voices_delete on storage.objects;
create policy voices_delete on storage.objects for delete to authenticated
  using (bucket_id = 'voices' and public.has_role(public.path_uuid(name, 1), 'editor') and public.demo_visible(public.path_uuid(name, 2)));
drop policy if exists html_select on storage.objects;
create policy html_select on storage.objects for select to authenticated
  using (bucket_id = 'html' and public.has_role(public.path_uuid(name, 1), 'viewer') and public.demo_visible(public.path_uuid(name, 2)));
drop policy if exists html_delete on storage.objects;
create policy html_delete on storage.objects for delete to authenticated
  using (bucket_id = 'html' and public.has_role(public.path_uuid(name, 1), 'editor') and public.demo_visible(public.path_uuid(name, 2)));
drop policy if exists published_select on storage.objects;
create policy published_select on storage.objects for select to authenticated
  using (bucket_id = 'published' and public.has_role(public.demo_workspace(public.path_uuid(name, 1)), 'viewer') and public.demo_visible(public.path_uuid(name, 1)));
drop policy if exists published_insert on storage.objects;
create policy published_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'published' and public.has_role(public.demo_workspace(public.path_uuid(name, 1)), 'editor') and public.demo_visible(public.path_uuid(name, 1)));
drop policy if exists published_update on storage.objects;
create policy published_update on storage.objects for update to authenticated
  using (bucket_id = 'published' and public.has_role(public.demo_workspace(public.path_uuid(name, 1)), 'editor') and public.demo_visible(public.path_uuid(name, 1)));
drop policy if exists published_delete on storage.objects;
create policy published_delete on storage.objects for delete to authenticated
  using (bucket_id = 'published' and public.has_role(public.demo_workspace(public.path_uuid(name, 1)), 'editor') and public.demo_visible(public.path_uuid(name, 1)));
