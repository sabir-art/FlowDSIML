-- Retours client du 24/11 (2e série) §5 : temps réel à l'échelle de l'espace. Nouveau fichier, idempotent ;
-- live_demo (temps réel d'une démo) ne change pas.
-- public.live_space(p_workspace, p_demo) : ce qui se passe maintenant sur toutes les démos de l'espace que
-- la personne peut voir (accès par dossier respecté), ou sur une seule si p_demo est donné.
--  * kpis : visiteurs en ce moment (5 min), vues des 30 dernières minutes, fins de démo et leads du jour ;
--  * demos : nombre de visiteurs en direct par démo (groupe « En direct » du filtre) ;
--  * visitors : 20 visiteurs les plus récents, avec leur démo, leur étape et le nombre d'étapes ;
--  * feed : fil d'activité de la dernière heure (début, fin, lead), 12 lignes au plus.
-- Confidentialité, comme live_demo : rôle viewer au moins ; l'identité (apprenant, e-mail du lead) n'est
-- renvoyée qu'aux rôles editor et plus ; le fil d'activité ne porte aucune identité ; la clé d'un visiteur
-- est un condensat tronqué, jamais son identifiant.

create or replace function public.live_space(p_workspace uuid, p_demo uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_named boolean;
  v_day timestamptz := (date_trunc('day', now() at time zone 'Europe/Paris')) at time zone 'Europe/Paris';
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  -- Identité (apprenant, e-mail du lead) : editor et plus, comme les RLS leads et learners
  v_named := public.has_role(p_workspace, 'editor');
  return (
    with d as (
      -- Démos de l'espace visibles par la personne (accès par dossier), filtrées si une démo est choisie
      select dm.id from public.demos dm
       where dm.workspace_id = p_workspace and dm.deleted_at is null
         and (p_demo is null or dm.id = p_demo)
         and public.demo_visible(dm.id)
    ), last as (
      select distinct on (e.demo_id, e.visitor_id)
             e.demo_id, e.visitor_id, e.occurred_at, e.step_index, e.device, e.country,
             min(e.occurred_at) over (partition by e.demo_id, e.visitor_id) as since
        from public.events e join d on d.id = e.demo_id
       where e.workspace_id = p_workspace and e.occurred_at > now() - interval '5 minutes'
       order by e.demo_id, e.visitor_id, e.occurred_at desc
    ), top as (
      select * from last order by occurred_at desc limit 20
    ), feed as (
      select x.kind, x.demo_id, x.at from (
        select case e.type when 'demo_view' then 'start' else 'end' end as kind, e.demo_id, e.occurred_at as at
          from public.events e join d on d.id = e.demo_id
         where e.workspace_id = p_workspace and e.type in ('demo_view', 'demo_complete')
           and e.occurred_at > now() - interval '60 minutes'
        union all
        select 'lead', l.demo_id, l.created_at
          from public.leads l join d on d.id = l.demo_id
         where l.workspace_id = p_workspace and l.created_at > now() - interval '60 minutes'
      ) x order by x.at desc limit 12
    )
    select jsonb_build_object(
      'kpis', jsonb_build_object(
        'live', (select count(*) from last),
        'views30', (select count(*) from public.events e join d on d.id = e.demo_id
                     where e.workspace_id = p_workspace and e.type = 'demo_view'
                       and e.occurred_at > now() - interval '30 minutes'),
        'endsToday', (select count(*) from public.events e join d on d.id = e.demo_id
                       where e.workspace_id = p_workspace and e.type = 'demo_complete' and e.occurred_at >= v_day),
        'leadsToday', (select count(*) from public.leads l join d on d.id = l.demo_id
                        where l.workspace_id = p_workspace and l.created_at >= v_day)),
      'more', greatest((select count(*) from last) - 20, 0),
      'demos', coalesce((select jsonb_agg(jsonb_build_object('demoId', g.demo_id, 'live', g.n) order by g.n desc, g.demo_id)
                           from (select demo_id, count(*) as n from last group by demo_id) g), '[]'::jsonb),
      'visitors', coalesce((select jsonb_agg(jsonb_build_object(
          -- Même clé que live_demo : live_visits (nouveau ou récurrent) s'y rattache
          'key', left(md5(t.visitor_id), 10),
          'demoId', t.demo_id, 'lastAt', t.occurred_at, 'since', t.since,
          'stepIndex', t.step_index,
          'stepsTotal', (select count(*) from public.steps st where st.demo_id = t.demo_id),
          'device', t.device, 'country', t.country,
          'learner', exists (select 1 from public.learner_visitors lv
                               where lv.workspace_id = p_workspace and lv.visitor_id = t.visitor_id),
          'identity', case when v_named then coalesce(
              (select coalesce(nullif(l.full_name, ''), l.email) from public.learner_visitors lv
                 join public.learners l on l.id = lv.learner_id
                 where lv.workspace_id = p_workspace and lv.visitor_id = t.visitor_id limit 1),
              (select ld.email from public.leads ld where ld.demo_id = t.demo_id and ld.visitor_id = t.visitor_id
                 order by ld.created_at desc limit 1)) end)
        order by t.occurred_at desc) from top t), '[]'::jsonb),
      'feed', coalesce((select jsonb_agg(jsonb_build_object('kind', f.kind, 'demoId', f.demo_id, 'at', f.at)
                          order by f.at desc) from feed f), '[]'::jsonb)
    )
  );
end $$;
revoke all on function public.live_space(uuid, uuid) from public, anon;
grant execute on function public.live_space(uuid, uuid) to authenticated;
