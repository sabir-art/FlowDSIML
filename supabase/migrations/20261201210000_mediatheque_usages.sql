-- Médiathèque (retours client du 24/11 §3.2) : « Voir les démos qui l'utilisent ». Nouveau fichier ; idempotent.
-- Même règle que media_usage (qui ne donne que le nombre) : démos non supprimées de l'espace du fichier,
-- hors des dossiers masqués à la personne. Lecture ouverte à tout membre de l'espace, comme la médiathèque.

create or replace function public.media_file_demos(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare m public.media_files;
begin
  select * into m from public.media_files where id = p_id;
  if m.id is null or not public.has_role(m.workspace_id, 'viewer') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title) order by d.title, d.id)
      from public.demos d
     where d.workspace_id = m.workspace_id and d.deleted_at is null
       and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[]))
       and (strpos(d.settings::text, m.path) > 0
            or exists (select 1 from public.steps s where s.demo_id = d.id and strpos(s.options::text, m.path) > 0))),
    '[]'::jsonb);
end $$;
revoke all on function public.media_file_demos(uuid) from public, anon;
grant execute on function public.media_file_demos(uuid) to authenticated;
