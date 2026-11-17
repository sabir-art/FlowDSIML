-- TutoClick — Analytics du workspace (écran ANA-01, maquette analytics.html). Lecture seule, idempotent.
-- 1. workspace_analytics : indicateurs, série quotidienne (vues, démos terminées) et sources des vues,
--    filtrables par démo et par source, sur une période.
-- 2. workspace_sessions : sessions de visite (démo, source, durée, progression, lead associé), paginées.
-- 3. workspace_leads : leads avec leur progression (rôle editor et plus).
-- Les deux exigent le rôle viewer sur le workspace ; aucune écriture.
-- Données personnelles : les leads (email, champs) ne sont renvoyés qu'aux rôles editor et plus, comme la
-- politique RLS leads_select. Un viewer ne reçoit que des agrégats (nombre de leads) et un booléen has_lead.

create or replace function public.workspace_analytics(
  p_workspace uuid,
  p_from timestamptz,
  p_to timestamptz default now(),
  p_demo uuid default null,
  p_source text default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_source is not null and p_source not in ('direct', 'embed', 'link') then
    raise exception 'Source inconnue' using errcode = '22023';
  end if;
  return (
    with e as (
      select e.*,
        case when e.link_id is not null then 'link' when e.embed_origin is not null then 'embed' else 'direct' end as source
      from public.events e
      join public.demos d on d.id = e.demo_id and d.deleted_at is null
      where e.workspace_id = p_workspace and e.occurred_at >= p_from and e.occurred_at <= p_to
        and (p_demo is null or e.demo_id = p_demo)
    ), f as (
      -- filtre de source appliqué aux indicateurs ; la répartition des sources reste globale
      select * from e where p_source is null or source = p_source
    ), v as (select * from f where type = 'demo_view')
    select jsonb_build_object(
      'views', (select count(*) from v),
      'visitors', (select count(distinct visitor_id) from v),
      'completions', (select count(distinct session_id) from f where type = 'demo_complete'),
      'ctaClicks', (select count(*) from f where type = 'cta_click'),
      -- agrégat seulement (aucune donnée personnelle) : visible dès le rôle viewer
      'leads', (select count(*) from public.leads l
                join public.demos d on d.id = l.demo_id and d.deleted_at is null
                where l.workspace_id = p_workspace and l.created_at >= p_from and l.created_at <= p_to
                  and (p_demo is null or l.demo_id = p_demo)
                  -- un lead ne porte que link_id : « link » si présent, sinon direct ou intégration
                  and (p_source is null or (p_source = 'link') = (l.link_id is not null))),
      'daily', coalesce((select jsonb_agg(jsonb_build_object('day', dday, 'views', vw, 'completions', cp) order by dday)
                from (select to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') as dday,
                             count(*) filter (where type = 'demo_view') as vw,
                             count(distinct session_id) filter (where type = 'demo_complete') as cp
                      from f where type in ('demo_view', 'demo_complete') group by 1) y), '[]'::jsonb),
      'sources', jsonb_build_object(
        'direct', (select count(*) from e where type = 'demo_view' and source = 'direct'),
        'embed', (select count(*) from e where type = 'demo_view' and source = 'embed'),
        'link', (select count(*) from e where type = 'demo_view' and source = 'link'))
    )
  );
end $$;

create or replace function public.workspace_sessions(
  p_workspace uuid,
  p_from timestamptz,
  p_to timestamptz default now(),
  p_demo uuid default null,
  p_source text default null,
  p_limit int default 25,
  p_offset int default 0
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  -- Mêmes droits que la RLS leads_select : email et champs des leads réservés aux rôles editor et plus
  can_leads boolean := public.has_role(p_workspace, 'editor');
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return (
    with e as (
      select e.*,
        case when e.link_id is not null then 'link' when e.embed_origin is not null then 'embed' else 'direct' end as source
      from public.events e
      join public.demos d on d.id = e.demo_id and d.deleted_at is null
      where e.workspace_id = p_workspace and e.occurred_at >= p_from and e.occurred_at <= p_to
        and (p_demo is null or e.demo_id = p_demo)
    ), s as (
      select session_id, min(demo_id::text)::uuid as demo_id, min(visitor_id) as visitor_id,
        (array_agg(source order by occurred_at))[1] as source,
        min(occurred_at) as started_at,
        extract(epoch from max(occurred_at) - min(occurred_at))::int as duration_s,
        max(step_index) as max_step,
        bool_or(type = 'demo_complete') as completed
      from e group by session_id
    ), sf as (
      select * from s where p_source is null or source = p_source
    )
    select jsonb_build_object(
      'total', (select count(*) from sf),
      'rows', coalesce((select jsonb_agg(r order by r.started_at desc) from (
        select sf.session_id, sf.demo_id, sf.source, sf.started_at, sf.duration_s, sf.max_step, sf.completed,
          (select count(*) from public.steps st where st.demo_id = sf.demo_id) as steps_total,
          (l.email is not null) as has_lead,
          case when can_leads then l.email end as lead_email,
          case when can_leads then l.fields end as lead_fields
        from sf
        left join lateral (
          select email, fields from public.leads l
          where l.workspace_id = p_workspace and l.visitor_id = sf.visitor_id and l.demo_id = sf.demo_id
          order by l.created_at desc limit 1
        ) l on true
        order by sf.started_at desc
        limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
      ) r), '[]'::jsonb)
    )
  );
end $$;

-- 3. workspace_leads : leads de la période avec leur progression dans la démo (onglet Leads de l'écran).
--    Réservé aux rôles editor et plus (comme la RLS leads_select) : données personnelles.
create or replace function public.workspace_leads(
  p_workspace uuid,
  p_from timestamptz,
  p_to timestamptz default now(),
  p_demo uuid default null,
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_workspace, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return (
    with l as (
      select l.* from public.leads l
      left join public.demos d on d.id = l.demo_id
      where l.workspace_id = p_workspace and l.created_at >= p_from and l.created_at <= p_to
        and (d.id is null or d.deleted_at is null)
        and (p_demo is null or l.demo_id = p_demo)
    )
    select jsonb_build_object(
      'total', (select count(*) from l),
      'rows', coalesce((select jsonb_agg(r order by r.created_at desc) from (
        select l.id, l.email, l.fields, l.consent, l.created_at, l.demo_id,
          p.max_step, coalesce(p.completed, false) as completed,
          (select count(*) from public.steps st where st.demo_id = l.demo_id) as steps_total
        from l
        left join lateral (
          select max(e.step_index) as max_step, bool_or(e.type = 'demo_complete') as completed
          from public.events e
          where e.workspace_id = p_workspace and e.demo_id = l.demo_id and e.visitor_id = l.visitor_id
        ) p on true
        order by l.created_at desc
        limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset)
      ) r), '[]'::jsonb)
    )
  );
end $$;

revoke all on function public.workspace_analytics(uuid, timestamptz, timestamptz, uuid, text) from public, anon;
grant execute on function public.workspace_analytics(uuid, timestamptz, timestamptz, uuid, text) to authenticated;
revoke all on function public.workspace_sessions(uuid, timestamptz, timestamptz, uuid, text, int, int) from public, anon;
grant execute on function public.workspace_sessions(uuid, timestamptz, timestamptz, uuid, text, int, int) to authenticated;
revoke all on function public.workspace_leads(uuid, timestamptz, timestamptz, uuid, int, int) from public, anon;
grant execute on function public.workspace_leads(uuid, timestamptz, timestamptz, uuid, int, int) to authenticated;
