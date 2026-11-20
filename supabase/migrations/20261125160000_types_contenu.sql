-- L48-G : trois types de contenu (captures, HTML, Sandbox). dashboard_home renvoie en plus le nombre
-- d'étapes HTML de chaque démo (« htmlCounts »), pour le badge et le filtre Type de la page Démos.
-- Redéfinition complète de 20261123230000 (migration figée) ; droits inchangés.

create or replace function public.dashboard_home(p_ws uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_hidden uuid[];
  v_ids uuid[];
  v_now timestamptz := now();
begin
  if not public.has_role(p_ws, 'viewer') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  v_hidden := coalesce(public.my_hidden_folders(), '{}'::uuid[]);
  select coalesce(array_agg(d.id), '{}'::uuid[]) into v_ids
    from public.demos d
   where d.workspace_id = p_ws and d.deleted_at is null
     and (d.folder_id is null or not (d.folder_id = any (v_hidden)));
  return jsonb_build_object(
    'demos', coalesce((select jsonb_agg(to_jsonb(x_demo) order by x_demo.updated_at desc)
                         from public.demos x_demo where x_demo.id = any (v_ids)), '[]'::jsonb),
    'folders', coalesce((select jsonb_agg(to_jsonb(x_folder) order by x_folder.name)
                           from public.folders x_folder
                          where x_folder.workspace_id = p_ws and not (x_folder.id = any (v_hidden))), '[]'::jsonb),
    'overview', coalesce((select jsonb_agg(to_jsonb(x_ov)) from public.workspace_overview(p_ws, 30) x_ov), '[]'::jsonb),
    'kpis', jsonb_build_object(
      'cur', public.workspace_kpis(p_ws, v_now - interval '30 days', v_now),
      'prev', public.workspace_kpis(p_ws, v_now - interval '60 days', v_now - interval '30 days')),
    'locked', coalesce((select jsonb_agg(a.demo_id) from public.demo_access a
                         where a.workspace_id = p_ws and a.locked_by_rules and a.demo_id = any (v_ids)), '[]'::jsonb),
    'hidden', coalesce((select jsonb_object_agg(f.id, coalesce(public.folder_hidden_count(f.id), 0))
                          from public.folders f
                         where f.workspace_id = p_ws and f.restricted and not (f.id = any (v_hidden))), '{}'::jsonb),
    'stepCounts', coalesce((select jsonb_object_agg(s.demo_id, s.n)
                              from (select st.demo_id, count(*) as n from public.steps st
                                     where st.demo_id = any (v_ids) group by st.demo_id) s), '{}'::jsonb),
    -- L48-G : étapes HTML par démo (type de contenu : « Démo HTML » si plus de la moitié des étapes)
    'htmlCounts', coalesce((select jsonb_object_agg(s.demo_id, s.n)
                              from (select st.demo_id, count(*) as n from public.steps st
                                     where st.demo_id = any (v_ids) and st.kind = 'html' group by st.demo_id) s),
                           '{}'::jsonb),
    'publishedAt', coalesce((select jsonb_object_agg(d.id, v.published_at)
                               from public.demos d join public.demo_versions v on v.id = d.current_version_id
                              where d.id = any (v_ids) and d.status = 'published' and v.published_at is not null),
                            '{}'::jsonb),
    -- Couverture : image de la première étape qui en a une (chemin du bucket captures, signé côté client)
    'covers', coalesce((select jsonb_object_agg(x.demo_id, x.image_path)
                          from (select distinct on (st.demo_id) st.demo_id, st.image_path from public.steps st
                                 where st.demo_id = any (v_ids) and st.image_path is not null
                                 order by st.demo_id, st.position, st.created_at) x), '{}'::jsonb),
    'shareRulesPlan', coalesce((select (p.limits ->> 'share_rules')::boolean
                                  from public.workspaces w join public.plans p on p.code = w.plan_code
                                 where w.id = p_ws), false),
    'memberCount', (select count(*) from public.members m where m.workspace_id = p_ws),
    -- L32 (squelettes) : état de la prise en main, pour réserver sa carte seulement si elle sera affichée
    -- (éditeurs et plus, comme workspace_onboarding ; null pour un lecteur)
    'onboarding', case when public.has_role(p_ws, 'editor') then public.workspace_onboarding(p_ws) end
  );
end $$;
revoke all on function public.dashboard_home(uuid) from public, anon;
grant execute on function public.dashboard_home(uuid) to authenticated;
