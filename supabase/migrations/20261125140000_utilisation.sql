-- L48-A §6 : page « Utilisation » (remplace « Plans et facturation »). workspace_usage redéfinie à
-- l'identique de 20261117130200_rpc.sql, avec en plus le stockage réel par type (octets de
-- storage.objects : médiathèque, vidéos, voix off), comme le contrôle de quota MEDIA_QUOTA (500 Mo).
-- Aucun droit modifié : mêmes contrôles (lecteur de l'espace), mêmes attributions.
create or replace function public.workspace_usage(p_workspace uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return jsonb_build_object(
    'plan', (select w.plan_code from public.workspaces w where w.id = p_workspace),
    'limits', (select p.limits from public.workspaces w join public.plans p on p.code = w.plan_code where w.id = p_workspace),
    'published_demos', (select count(*) from public.demos where workspace_id = p_workspace and status = 'published' and deleted_at is null),
    'demos', (select count(*) from public.demos where workspace_id = p_workspace and deleted_at is null),
    'members', (select count(*) from public.members where workspace_id = p_workspace),
    'storage', (
      select jsonb_build_object(
        'media', coalesce(sum((o.metadata ->> 'size')::bigint) filter (where o.bucket_id = 'media'), 0),
        'videos', coalesce(sum((o.metadata ->> 'size')::bigint) filter (where o.bucket_id = 'videos'), 0),
        'voices', coalesce(sum((o.metadata ->> 'size')::bigint) filter (where o.bucket_id = 'voices'), 0),
        'limit', 524288000)
      from storage.objects o
      where o.bucket_id in ('media', 'videos', 'voices') and o.name like p_workspace::text || '/%')
  );
end $$;
