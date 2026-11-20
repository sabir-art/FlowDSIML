-- L32 : lectures de démarrage regroupées (performance). Le tableau de bord et l'éditeur faisaient chacun une
-- chaîne de lectures successives (jusqu'à 8 allers-retours) ; une seule RPC les remplace.
-- Pas de changement de droits : mêmes règles que les politiques de lecture des tables concernées
-- (has_role viewer sur l'espace, dossiers restreints exclus via my_hidden_folders / my_hidden_demos,
-- demo_visible pour une démo), et réutilisation des RPC existantes (workspace_overview, workspace_kpis,
-- folder_hidden_count) qui gardent leurs propres contrôles. Alias préfixés x_ : to_jsonb(alias) ne doit
-- jamais désigner une colonne (hotspots a une colonne « h »). Lecture seule (stable), exécutable par authenticated.

-- Tableau de bord des démos (DemosPage) : liste, dossiers, statistiques et repères des cartes.
create or replace function public.dashboard_home(p_ws uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
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
    'memberCount', (select count(*) from public.members m where m.workspace_id = p_ws)
  );
end $$;
revoke all on function public.dashboard_home(uuid) from public, anon;
grant execute on function public.dashboard_home(uuid) to authenticated;

-- Éditeur (useDemoEditor) : la démo et tout ce que l'éditeur charge au démarrage. null si la démo n'existe
-- pas ou n'est pas visible (même résultat qu'une lecture filtrée par les politiques).
create or replace function public.editor_load(p_demo uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_d public.demos;
begin
  select * into v_d from public.demos where id = p_demo;
  if v_d.id is null or not public.has_role(v_d.workspace_id, 'viewer') or not public.demo_visible(p_demo) then
    return null;
  end if;
  return jsonb_build_object(
    'demo', to_jsonb(v_d),
    'steps', coalesce((select jsonb_agg(to_jsonb(x_step) order by x_step.position, x_step.created_at)
                         from public.steps x_step where x_step.demo_id = p_demo), '[]'::jsonb),
    'hotspots', coalesce((select jsonb_agg(to_jsonb(x_hs) order by x_hs.position, x_hs.created_at)
                            from public.hotspots x_hs where x_hs.demo_id = p_demo), '[]'::jsonb),
    'chapters', coalesce((select jsonb_agg(to_jsonb(x_ch) order by x_ch.position)
                            from public.chapters x_ch where x_ch.demo_id = p_demo), '[]'::jsonb),
    'forms', coalesce((select jsonb_agg(to_jsonb(x_form) order by x_form.created_at)
                         from public.forms x_form where x_form.demo_id = p_demo), '[]'::jsonb),
    'variables', coalesce((select jsonb_agg(to_jsonb(x_var) order by x_var.key)
                             from public.variables x_var where x_var.workspace_id = v_d.workspace_id), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(to_jsonb(x_q) order by x_q.position, x_q.created_at)
                             from public.quiz_questions x_q where x_q.demo_id = p_demo), '[]'::jsonb)
  );
end $$;
revoke all on function public.editor_load(uuid) from public, anon;
grant execute on function public.editor_load(uuid) to authenticated;
