-- A8, guide optionnel du Sandbox (spec a8-guide-sandbox §6, paquet P3) : analytics_series redéfinie à
-- l'identique (20261125110000, migration figée), avec par démo les sessions qui ont vu le guide
-- (guideStarted), qui l'ont terminé (guideDone) et qui l'ont quitté sans le terminer (guideSkipped).
-- Les séries quotidiennes et par source ne comptent pas les événements du guide.

create or replace function public.analytics_series(
  p_workspace uuid,
  p_from timestamptz,
  p_to timestamptz default now(),
  p_demo uuid default null,
  p_source text default null,
  p_segment jsonb default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_vis text[];
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_source is not null and p_source not in ('direct', 'embed', 'link', 'page') then
    raise exception 'Source inconnue' using errcode = '22023';
  end if;
  if p_segment is not null then
    v_vis := private.segment_visitors(p_workspace, private.segment_def(p_workspace, p_segment), p_from, p_to);
  end if;
  return (
    with e as (
      select e.demo_id, e.type, e.session_id, e.visitor_id, e.occurred_at,
        case when e.channel = 'page' then 'page' when e.link_id is not null then 'link'
             when e.embed_origin is not null then 'embed' else 'direct' end as source
      from public.events e
      join public.demos d on d.id = e.demo_id and d.deleted_at is null
        and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[]))
      where e.workspace_id = p_workspace and e.occurred_at >= p_from and e.occurred_at <= p_to
        and e.type in ('demo_view', 'demo_complete', 'cta_click', 'guide_step', 'guide_done', 'guide_skip')
        and (p_demo is null or e.demo_id = p_demo)
        and (v_vis is null or e.visitor_id = any (v_vis))
    ), f as (
      select * from e where p_source is null or source = p_source
    ), l as (
      select l.demo_id, l.created_at as occurred_at,
        case when l.link_id is not null then 'link'
             else coalesce((select x.source from e x
                             where x.type = 'demo_view' and x.demo_id = l.demo_id and x.visitor_id = l.visitor_id
                               and x.occurred_at <= l.created_at
                             order by x.occurred_at desc limit 1), 'direct') end as source
      from public.leads l
      join public.demos d on d.id = l.demo_id and d.deleted_at is null
        and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[]))
      where l.workspace_id = p_workspace and l.created_at >= p_from and l.created_at <= p_to
        and (p_demo is null or l.demo_id = p_demo)
        and (v_vis is null or l.visitor_id = any (v_vis))
    ), lf as (
      select * from l where p_source is null or source = p_source
    )
    select jsonb_build_object(
      'daily', coalesce((
        select jsonb_agg(jsonb_build_object('day', coalesce(y.dday, ld.d2), 'views', coalesce(y.views, 0),
                 'visitors', coalesce(y.visitors, 0), 'completions', coalesce(y.completions, 0),
                 'cta', coalesce(y.cta, 0), 'leads', coalesce(ld.n, 0)) order by coalesce(y.dday, ld.d2))
        from (select to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') as dday,
                     count(*) filter (where type = 'demo_view') as views,
                     count(distinct visitor_id) filter (where type = 'demo_view') as visitors,
                     count(distinct session_id) filter (where type = 'demo_complete') as completions,
                     count(*) filter (where type = 'cta_click') as cta
              from f where type in ('demo_view', 'demo_complete', 'cta_click') group by 1) y
        full join (select to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') as d2, count(*) as n
                   from lf group by 1) ld on ld.d2 = y.dday
      ), '[]'::jsonb),
      'byDemo', coalesce((
        select jsonb_agg(jsonb_build_object('demo_id', demo_id, 'views', views, 'visitors', visitors,
                 'completions', completions, 'cta', cta, 'leads', leads,
                 'guideStarted', guide_started, 'guideDone', guide_done, 'guideSkipped', guide_skipped))
        from (select coalesce(a.demo_id, b.demo_id) as demo_id, coalesce(a.views, 0) as views,
                     coalesce(a.visitors, 0) as visitors, coalesce(a.completions, 0) as completions,
                     coalesce(a.cta, 0) as cta, coalesce(b.n, 0) as leads,
                     coalesce(g.started, 0) as guide_started, coalesce(g.done, 0) as guide_done,
                     coalesce(g.skipped, 0) as guide_skipped
              from (select demo_id, count(*) filter (where type = 'demo_view') as views,
                           count(distinct visitor_id) filter (where type = 'demo_view') as visitors,
                           count(distinct session_id) filter (where type = 'demo_complete') as completions,
                           count(*) filter (where type = 'cta_click') as cta
                    from f where type in ('demo_view', 'demo_complete', 'cta_click') group by 1) a
              full join (select demo_id, count(*) as n from lf group by 1) b on b.demo_id = a.demo_id
              -- A8 : guide du Sandbox, par session ; « ignoré » : guide quitté sans être terminé
              left join (select demo_id, count(*) as started, count(*) filter (where gd) as done,
                                count(*) filter (where gs and not gd) as skipped
                         from (select demo_id, session_id, bool_or(type = 'guide_done') as gd,
                                      bool_or(type = 'guide_skip') as gs
                               from f where type in ('guide_step', 'guide_done', 'guide_skip') group by 1, 2) s
                         group by 1) g on g.demo_id = coalesce(a.demo_id, b.demo_id)) z
      ), '[]'::jsonb),
      'bySource', coalesce((
        select jsonb_agg(jsonb_build_object('source', source, 'views', views, 'visitors', visitors,
                 'completions', completions, 'cta', cta, 'leads', leads))
        from (select coalesce(a.source, b.source) as source, coalesce(a.views, 0) as views,
                     coalesce(a.visitors, 0) as visitors, coalesce(a.completions, 0) as completions,
                     coalesce(a.cta, 0) as cta, coalesce(b.n, 0) as leads
              from (select source, count(*) filter (where type = 'demo_view') as views,
                           count(distinct visitor_id) filter (where type = 'demo_view') as visitors,
                           count(distinct session_id) filter (where type = 'demo_complete') as completions,
                           count(*) filter (where type = 'cta_click') as cta
                    from f where type in ('demo_view', 'demo_complete', 'cta_click') group by 1) a
              full join (select source, count(*) as n from lf group by 1) b on b.source = a.source) z
      ), '[]'::jsonb)
    )
  );
end $function$;

revoke all on function public.analytics_series(uuid, timestamptz, timestamptz, uuid, text, jsonb) from public, anon;
grant execute on function public.analytics_series(uuid, timestamptz, timestamptz, uuid, text, jsonb) to authenticated;
