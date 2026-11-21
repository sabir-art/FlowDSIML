-- L48-G : le type de contenu (captures, HTML, Sandbox) apparaît aussi dans le filtre Démo d'Analytics et
-- dans les Parcours. demo_step_counts renvoie, pour chaque démo visible, le nombre d'étapes et d'étapes
-- HTML ; la règle du type reste côté client (contentType de @flowdsiml/core), comme pour dashboard_home.
-- security invoker : la RLS de demos et steps décide de ce que l'appelant voit (dossiers restreints compris).

create or replace function public.demo_step_counts(p_ws uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_object_agg(s.demo_id, jsonb_build_object('n', s.n, 'html', s.html)), '{}'::jsonb)
    from (select st.demo_id, count(*) as n, count(*) filter (where st.kind = 'html') as html
            from public.steps st
            join public.demos d on d.id = st.demo_id
           where d.workspace_id = p_ws and d.deleted_at is null
           group by st.demo_id) s;
$$;

revoke all on function public.demo_step_counts(uuid) from public, anon;
grant execute on function public.demo_step_counts(uuid) to authenticated;
