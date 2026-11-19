-- FlowDSIML — L19-01 (reprise UX) : temps réel, distinction « Apprenant identifié ».
-- Idempotent. Remplace live_demo (même signature) : ajoute à chaque visiteur
--  * learner (booléen) : visiteur rattaché à un apprenant du workspace, pour tout rôle viewer+ ;
--    aucun nom ni e-mail n'est ajouté (l'identité reste réservée à editor+) ;
--  * structure (texte) : nom de la structure de l'apprenant, pour editor+ seulement.
-- Corps identique à 20261119130100 pour le reste.

create or replace function public.live_demo(p_demo uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws uuid;
  v_named boolean;
  v_day timestamptz := (date_trunc('day', now() at time zone 'Europe/Paris')) at time zone 'Europe/Paris';
begin
  select workspace_id into v_ws from public.demos where id = p_demo and deleted_at is null;
  if v_ws is null or not public.has_role(v_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  -- Identité (apprenant, e-mail du lead) : editor et plus, comme les RLS leads et learners
  v_named := public.has_role(v_ws, 'editor');
  return (
    with last as (
      select distinct on (e.visitor_id) e.visitor_id, e.occurred_at, e.step_id, e.step_index, e.device, e.country, e.type,
        min(e.occurred_at) over (partition by e.visitor_id) as since
      from public.events e
      where e.demo_id = p_demo and e.occurred_at > now() - interval '5 minutes'
      order by e.visitor_id, e.occurred_at desc
    ), top as (
      select * from last order by occurred_at desc limit 20
    )
    select jsonb_build_object(
      'kpis', jsonb_build_object(
        'live', (select count(*) from last),
        'views30', (select count(*) from public.events where demo_id = p_demo and type = 'demo_view'
                      and occurred_at > now() - interval '30 minutes'),
        'ctaToday', (select count(*) from public.events where demo_id = p_demo and type = 'cta_click' and occurred_at >= v_day),
        'leadsToday', (select count(*) from public.leads where demo_id = p_demo and created_at >= v_day)),
      'stepsTotal', (select count(*) from public.steps where demo_id = p_demo),
      'more', greatest((select count(*) from last) - 20, 0),
      'visitors', coalesce((select jsonb_agg(jsonb_build_object(
          'key', left(md5(t.visitor_id), 10),
          'lastAt', t.occurred_at, 'since', t.since, 'stepIndex', t.step_index,
          'stepTitle', (select nullif(st.title, '') from public.steps st where st.demo_id = p_demo and st.id::text = t.step_id),
          'device', t.device, 'country', t.country, 'lastType', t.type,
          -- L19-01 : le visiteur est-il un apprenant suivi ? (sans nom ni e-mail pour les rôles sans suivi
          -- nominatif) ; structure de l'apprenant seulement pour les rôles avec suivi nominatif
          'learner', exists (select 1 from public.learner_visitors lv
                               where lv.workspace_id = v_ws and lv.visitor_id = t.visitor_id),
          'structure', case when v_named then
              (select s.name from public.learner_visitors lv
                 join public.learners l on l.id = lv.learner_id
                 join public.structures s on s.id = l.structure_id
                 where lv.workspace_id = v_ws and lv.visitor_id = t.visitor_id limit 1) end,
          'identity', case when v_named then coalesce(
              (select coalesce(nullif(l.full_name, ''), l.email) from public.learner_visitors lv
                 join public.learners l on l.id = lv.learner_id
                 where lv.workspace_id = v_ws and lv.visitor_id = t.visitor_id),
              (select ld.email from public.leads ld where ld.demo_id = p_demo and ld.visitor_id = t.visitor_id
                 order by ld.created_at desc limit 1)) end)
        order by t.occurred_at desc) from top t), '[]'::jsonb)
    )
  );
end $$;
revoke all on function public.live_demo(uuid) from public, anon;
grant execute on function public.live_demo(uuid) to authenticated;
