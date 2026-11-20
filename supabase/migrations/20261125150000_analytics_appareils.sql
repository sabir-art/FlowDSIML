-- L48-D §3.2 : widget « Appareils et navigateurs ». workspace_analytics redéfinie à l'identique de
-- 20261122100000_acces_dossiers.sql (droits, filtres, dossiers masqués), avec en plus `devices` et
-- `browsers` : nombre de vues (demo_view) par valeur de events.device et events.browser.
-- Aucun changement de schéma ni de droits.
CREATE OR REPLACE FUNCTION public.workspace_analytics(p_workspace uuid, p_from timestamp with time zone, p_to timestamp with time zone DEFAULT now(), p_demo uuid DEFAULT NULL::uuid, p_source text DEFAULT NULL::text, p_segment jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      select e.*,
        case when e.channel = 'page' then 'page' when e.link_id is not null then 'link' when e.embed_origin is not null then 'embed' else 'direct' end as source
      from public.events e
      join public.demos d on d.id = e.demo_id and d.deleted_at is null and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[]))
      where e.workspace_id = p_workspace and e.occurred_at >= p_from and e.occurred_at <= p_to
        and (p_demo is null or e.demo_id = p_demo)
        and (v_vis is null or e.visitor_id = any (v_vis))
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
                join public.demos d on d.id = l.demo_id and d.deleted_at is null and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[]))
                where l.workspace_id = p_workspace and l.created_at >= p_from and l.created_at <= p_to
                  and (p_demo is null or l.demo_id = p_demo)
                  and (v_vis is null or l.visitor_id = any (v_vis))
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
        'link', (select count(*) from e where type = 'demo_view' and source = 'link'),
        'page', (select count(*) from e where type = 'demo_view' and source = 'page')),
      -- L48-D : vues par appareil et par navigateur (colonnes envoyées par le lecteur, L19), mêmes filtres
      'devices', coalesce((select jsonb_object_agg(k, n) from (
                  select coalesce(device, 'unknown') as k, count(*) as n from v group by 1) x), '{}'::jsonb),
      'browsers', coalesce((select jsonb_object_agg(k, n) from (
                  select coalesce(browser, 'unknown') as k, count(*) as n from v group by 1) x), '{}'::jsonb),
      'segmentVisitors', case when v_vis is not null then cardinality(v_vis) end
    )
  );
end $function$;
