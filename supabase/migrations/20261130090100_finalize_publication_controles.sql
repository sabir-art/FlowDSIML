-- finalize_publication applique les mêmes contrôles que publish_demo : démo visible et non supprimée,
-- règle « qui peut publier », limite du plan, et seule la dernière version peut être mise en ligne.

-- ===== 2. Mise en ligne d'une version =====
create or replace function public.finalize_publication(p_version uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.demo_versions;
  d public.demos;
  n_published bigint;
begin
  select * into v from public.demo_versions where id = p_version;
  if v.id is null then raise exception 'VERSION_NOT_FOUND'; end if;
  if not public.has_role(v.workspace_id, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  select * into d from public.demos
   where id = v.demo_id and deleted_at is null and public.folder_visible(workspace_id, folder_id);
  if d.id is null then raise exception 'DEMO_NOT_FOUND'; end if;
  -- Règle de l'espace « qui peut publier » (RULE_PUBLISH)
  perform public.publish_rules_check(d.workspace_id);
  -- Seule la dernière version créée par publish_demo peut être mise en ligne
  if v.number <> (select max(x.number) from public.demo_versions x where x.demo_id = v.demo_id) then
    raise exception 'VERSION_OUTDATED' using errcode = 'P0001';
  end if;
  if d.status <> 'published' then
    select count(*) into n_published from public.demos
      where workspace_id = d.workspace_id and status = 'published' and deleted_at is null;
    if public.limit_reached(d.workspace_id, 'published_demos', n_published) then
      raise exception 'PLAN_LIMIT:published_demos' using errcode = 'P0001';
    end if;
  end if;
  update public.demos set status = 'published', current_version_id = v.id where id = v.demo_id;
end $$;
revoke all on function public.finalize_publication(uuid) from public, anon;
grant execute on function public.finalize_publication(uuid) to authenticated;
