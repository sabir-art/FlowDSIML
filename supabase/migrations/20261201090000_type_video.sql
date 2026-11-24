-- EXT-02 §4.1 : quatrième type de contenu, « Vidéo » (démo dont plus de la moitié des étapes sont des
-- vidéos). demo_step_counts renvoie aussi le nombre d'étapes vidéo de chaque démo ; la règle du type reste
-- côté client (contentType de @flowdsiml/core). Même forme qu'avant, avec une clé de plus.
-- security invoker : la RLS de demos et steps décide de ce que l'appelant voit (dossiers restreints compris).

create or replace function public.demo_step_counts(p_ws uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(
           jsonb_object_agg(s.demo_id, jsonb_build_object('n', s.n, 'html', s.html, 'video', s.video)),
           '{}'::jsonb)
    from (select st.demo_id,
                 count(*) as n,
                 count(*) filter (where st.kind = 'html') as html,
                 count(*) filter (where st.kind = 'video') as video
            from public.steps st
            join public.demos d on d.id = st.demo_id
           where d.workspace_id = p_ws and d.deleted_at is null
           group by st.demo_id) s;
$$;

revoke all on function public.demo_step_counts(uuid) from public, anon;
grant execute on function public.demo_step_counts(uuid) to authenticated;
