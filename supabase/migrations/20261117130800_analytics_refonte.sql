-- FlowDSIML — Refonte DSI : données des nouveaux graphiques. Idempotent, non destructif.
-- 1. demo_analytics : ajoute 'sources' (origine des vues : lien personnalisé, intégration, direct) et
--    les visiteurs par jour dans 'daily' ({day, views, visitors}). Les clés existantes sont inchangées.
-- 2. workspace_kpis : indicateurs agrégés du workspace sur une période (KPI du tableau de bord,
--    appelé deux fois pour la comparaison avec la période précédente).

create or replace function public.demo_analytics(p_demo uuid, p_from timestamptz default now() - interval '30 days', p_to timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare ws uuid;
begin
  select workspace_id into ws from public.demos where id = p_demo;
  if ws is null or not public.has_role(ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return (
    with e as (
      select * from public.events where demo_id = p_demo and occurred_at >= p_from and occurred_at <= p_to
    ), v as (
      select *, case when link_id is not null then 'link' when embed_origin is not null then 'embed' else 'direct' end as source
      from e where type = 'demo_view'
    )
    select jsonb_build_object(
      'views', (select count(*) from v),
      'visitors', (select count(distinct visitor_id) from v),
      'completions', (select count(distinct session_id) from e where type = 'demo_complete'),
      'ctaClicks', (select count(*) from e where type = 'cta_click'),
      'leads', (select count(*) from public.leads l where l.demo_id = p_demo and l.created_at >= p_from and l.created_at <= p_to),
      'steps', coalesce((select jsonb_agg(jsonb_build_object('stepIndex', step_index, 'visitors', c) order by step_index)
                from (select step_index, count(distinct visitor_id) c from e where type = 'step_view' and step_index is not null group by step_index) x), '[]'::jsonb),
      'daily', coalesce((select jsonb_agg(jsonb_build_object('day', dday, 'views', c, 'visitors', u) order by dday)
                from (select to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') as dday, count(*) c, count(distinct visitor_id) u
                      from v group by 1) y), '[]'::jsonb),
      'sources', jsonb_build_object(
        'direct', (select count(*) from v where source = 'direct'),
        'embed', (select count(*) from v where source = 'embed'),
        'link', (select count(*) from v where source = 'link'))
    )
  );
end $$;

create or replace function public.workspace_kpis(p_workspace uuid, p_from timestamptz, p_to timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return (
    with e as (
      select e.* from public.events e
      join public.demos d on d.id = e.demo_id and d.deleted_at is null
      where e.workspace_id = p_workspace and e.occurred_at >= p_from and e.occurred_at <= p_to
    )
    select jsonb_build_object(
      'views', (select count(*) from e where type = 'demo_view'),
      'visitors', (select count(distinct visitor_id) from e where type = 'demo_view'),
      'completions', (select count(distinct session_id) from e where type = 'demo_complete'),
      'leads', (select count(*) from public.leads l join public.demos d on d.id = l.demo_id and d.deleted_at is null
                where l.workspace_id = p_workspace and l.created_at >= p_from and l.created_at <= p_to)
    )
  );
end $$;

revoke all on function public.workspace_kpis(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.workspace_kpis(uuid, timestamptz, timestamptz) to authenticated;
