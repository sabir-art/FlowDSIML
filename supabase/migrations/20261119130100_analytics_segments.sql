-- L19 (A4, analytics avancées) partie 2 : temps réel et segments. Schéma validé par le chef d'équipe.
--  * live_demo (viewer, interrogée toutes les 10 s) : 20 visiteurs actifs les plus récents (événement
--    depuis moins de 5 min) et le nombre restant ; indicateurs du moment. Identité (apprenant ou e-mail
--    du lead) seulement à partir d'editor ; un viewer voit « Visiteur ».
--  * segments : définitions enregistrées (nom, toutes / au moins une condition, 8 conditions au plus).
--  * workspace_analytics / workspace_sessions / workspace_leads : paramètre p_segment (segment enregistré
--    { id } ou définition { match, conditions }) ; sous 5 visiteurs, agrégats seulement (pas de lignes).

-- ===== 1. Conditions d'un segment =====
create or replace function public.segment_conditions_ok(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) between 1 and 8
    and not exists (
      select 1 from jsonb_array_elements(p) c
      where jsonb_typeof(c) <> 'object' or not coalesce(case c ->> 'field'
        when 'device' then c ->> 'op' in ('is', 'is_not') and c ->> 'value' in ('mobile', 'tablet', 'desktop')
        when 'browser' then c ->> 'op' in ('is', 'is_not')
          and c ->> 'value' in ('chrome', 'edge', 'firefox', 'safari', 'opera', 'samsung', 'other')
        when 'os' then c ->> 'op' in ('is', 'is_not')
          and c ->> 'value' in ('windows', 'macos', 'ios', 'android', 'linux', 'chromeos', 'other')
        when 'lang' then c ->> 'op' in ('is', 'is_not') and c ->> 'value' ~ '^[a-z]{2}$'
        when 'country' then c ->> 'op' in ('is', 'is_not') and c ->> 'value' ~ '^[A-Z]{2}$'
        when 'source' then c ->> 'op' in ('is', 'is_not') and c ->> 'value' in ('direct', 'embed', 'link')
        when 'demo' then c ->> 'op' in ('is', 'is_not')
          and c ->> 'value' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        when 'completed' then c ->> 'op' = 'is' and jsonb_typeof(c -> 'value') = 'boolean'
        when 'lead' then c ->> 'op' = 'is' and jsonb_typeof(c -> 'value') = 'boolean'
        when 'cta' then c ->> 'op' = 'is' and jsonb_typeof(c -> 'value') = 'boolean'
        when 'steps' then c ->> 'op' in ('gte', 'lte') and jsonb_typeof(c -> 'value') = 'number'
          and (c ->> 'value') ~ '^\d{1,3}$'
        when 'referrer' then c ->> 'op' in ('contains', 'not_contains') and jsonb_typeof(c -> 'value') = 'string'
          and char_length(btrim(c ->> 'value')) between 1 and 100
        else false end, false));
$$;

create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  match text not null default 'all' check (match in ('all', 'any')),
  conditions jsonb not null check (public.segment_conditions_ok(conditions)),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists segments_ws_name_idx on public.segments (workspace_id, lower(btrim(name)));
drop trigger if exists set_updated_at on public.segments;
create trigger set_updated_at before update on public.segments for each row execute function public.set_updated_at();
alter table public.segments enable row level security;
drop policy if exists segments_select on public.segments;
create policy segments_select on public.segments for select to authenticated
  using (public.has_role(workspace_id, 'viewer'));
drop policy if exists segments_write on public.segments;
create policy segments_write on public.segments for all to authenticated
  using (public.has_role(workspace_id, 'editor')) with check (public.has_role(workspace_id, 'editor'));
revoke all on public.segments from anon;
grant select, insert, update, delete on public.segments to authenticated;

-- Définition effective : segment enregistré du workspace ({ id }) ou définition fournie ({ match, conditions })
create or replace function private.segment_def(p_ws uuid, p_segment jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
begin
  if p_segment ? 'id' then
    select jsonb_build_object('match', s.match, 'conditions', s.conditions) into v
      from public.segments s where s.id::text = p_segment ->> 'id' and s.workspace_id = p_ws;
    if v is null then raise exception 'SEGMENT_NOT_FOUND' using errcode = '22023'; end if;
    return v;
  end if;
  if coalesce(p_segment ->> 'match', 'all') not in ('all', 'any') or not public.segment_conditions_ok(p_segment -> 'conditions') then
    raise exception 'SEGMENT_INVALID' using errcode = '22023';
  end if;
  return jsonb_build_object('match', coalesce(p_segment ->> 'match', 'all'), 'conditions', p_segment -> 'conditions');
end $$;

create or replace function private.segment_match(a jsonb, c jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case
    when c ->> 'field' in ('device', 'browser', 'os', 'lang', 'country', 'source') then
      case when c ->> 'op' = 'is' then coalesce(a ->> (c ->> 'field') = c ->> 'value', false)
           else coalesce(a ->> (c ->> 'field') <> c ->> 'value', true) end
    when c ->> 'field' = 'demo' then ((a -> 'demos') ? (c ->> 'value')) = (c ->> 'op' = 'is')
    when c ->> 'field' in ('completed', 'lead', 'cta') then
      coalesce((a ->> (c ->> 'field'))::boolean, false) = (c ->> 'value')::boolean
    when c ->> 'field' = 'steps' then
      case when c ->> 'op' = 'gte' then (a ->> 'steps')::int >= (c ->> 'value')::int
           else (a ->> 'steps')::int <= (c ->> 'value')::int end
    when c ->> 'field' = 'referrer' then
      (position(lower(btrim(c ->> 'value')) in lower(coalesce(a ->> 'referrer', ''))) > 0) = (c ->> 'op' = 'contains')
    else false end;
$$;

-- Visiteurs de la période qui répondent au segment (attributs : dernier appareil connu, première source…)
create or replace function private.segment_visitors(p_ws uuid, p_def jsonb, p_from timestamptz, p_to timestamptz)
returns text[] language sql stable security definer set search_path = '' as $$
  with a as (
    select e.visitor_id, jsonb_build_object(
      'device', (array_agg(e.device order by e.occurred_at desc) filter (where e.device is not null))[1],
      'browser', (array_agg(e.browser order by e.occurred_at desc) filter (where e.browser is not null))[1],
      'os', (array_agg(e.os order by e.occurred_at desc) filter (where e.os is not null))[1],
      'lang', (array_agg(e.lang order by e.occurred_at desc) filter (where e.lang is not null))[1],
      'country', (array_agg(e.country order by e.occurred_at desc) filter (where e.country is not null))[1],
      'source', (array_agg(case when e.link_id is not null then 'link' when e.embed_origin is not null then 'embed'
                                else 'direct' end order by e.occurred_at))[1],
      'referrer', (array_agg(e.referrer_host order by e.occurred_at) filter (where e.referrer_host is not null))[1],
      'demos', to_jsonb(array_agg(distinct e.demo_id::text)),
      'completed', bool_or(e.type = 'demo_complete'),
      'cta', bool_or(e.type = 'cta_click'),
      'steps', coalesce(max(e.step_index) + 1, 0),
      'lead', exists (select 1 from public.leads l where l.workspace_id = p_ws and l.visitor_id = e.visitor_id)
    ) as attrs
    from public.events e
    join public.demos d on d.id = e.demo_id and d.deleted_at is null
    where e.workspace_id = p_ws and e.occurred_at >= p_from and e.occurred_at <= p_to
    group by e.visitor_id
  )
  select coalesce(array_agg(a.visitor_id), '{}') from a
  where case when p_def ->> 'match' = 'any'
    then (select bool_or(private.segment_match(a.attrs, c)) from jsonb_array_elements(p_def -> 'conditions') c)
    else (select bool_and(private.segment_match(a.attrs, c)) from jsonb_array_elements(p_def -> 'conditions') c) end;
$$;
revoke all on function private.segment_def(uuid, jsonb) from public;
revoke all on function private.segment_match(jsonb, jsonb) from public;
revoke all on function private.segment_visitors(uuid, jsonb, timestamptz, timestamptz) from public;

-- Aperçu d'un segment (viewer) : visiteurs du segment et de la période
create or replace function public.segment_count(p_workspace uuid, p_segment jsonb, p_from timestamptz,
                                                p_to timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return jsonb_build_object(
    'visitors', cardinality(private.segment_visitors(p_workspace, private.segment_def(p_workspace, p_segment), p_from, p_to)),
    'total', (select count(distinct visitor_id) from public.events e join public.demos d on d.id = e.demo_id and d.deleted_at is null
              where e.workspace_id = p_workspace and e.occurred_at >= p_from and e.occurred_at <= p_to));
end $$;
revoke all on function public.segment_count(uuid, jsonb, timestamptz, timestamptz) from public, anon;
grant execute on function public.segment_count(uuid, jsonb, timestamptz, timestamptz) to authenticated;

-- ===== 2. Analytics du workspace avec segment =====
-- Signature changée (p_segment en dernier, null par défaut) : les anciennes versions sont retirées.
drop function if exists public.workspace_analytics(uuid, timestamptz, timestamptz, uuid, text);
drop function if exists public.workspace_sessions(uuid, timestamptz, timestamptz, uuid, text, int, int);
drop function if exists public.workspace_leads(uuid, timestamptz, timestamptz, uuid, int, int);

create or replace function public.workspace_analytics(
  p_workspace uuid,
  p_from timestamptz,
  p_to timestamptz default now(),
  p_demo uuid default null,
  p_source text default null,
  p_segment jsonb default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_vis text[];
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_source is not null and p_source not in ('direct', 'embed', 'link') then
    raise exception 'Source inconnue' using errcode = '22023';
  end if;
  if p_segment is not null then
    v_vis := private.segment_visitors(p_workspace, private.segment_def(p_workspace, p_segment), p_from, p_to);
  end if;
  return (
    with e as (
      select e.*,
        case when e.link_id is not null then 'link' when e.embed_origin is not null then 'embed' else 'direct' end as source
      from public.events e
      join public.demos d on d.id = e.demo_id and d.deleted_at is null
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
                join public.demos d on d.id = l.demo_id and d.deleted_at is null
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
        'link', (select count(*) from e where type = 'demo_view' and source = 'link')),
      'segmentVisitors', case when v_vis is not null then cardinality(v_vis) end
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
  p_offset int default 0,
  p_segment jsonb default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  -- Mêmes droits que la RLS leads_select : email et champs des leads réservés aux rôles editor et plus
  can_leads boolean := public.has_role(p_workspace, 'editor');
  v_vis text[];
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_segment is not null then
    v_vis := private.segment_visitors(p_workspace, private.segment_def(p_workspace, p_segment), p_from, p_to);
    -- Sous 5 visiteurs : agrégats seulement, aucune ligne (risque de réidentification)
    if cardinality(v_vis) < 5 then
      return jsonb_build_object('total', 0, 'rows', '[]'::jsonb, 'tooSmall', true);
    end if;
  end if;
  return (
    with e as (
      select e.*,
        case when e.link_id is not null then 'link' when e.embed_origin is not null then 'embed' else 'direct' end as source
      from public.events e
      join public.demos d on d.id = e.demo_id and d.deleted_at is null
      where e.workspace_id = p_workspace and e.occurred_at >= p_from and e.occurred_at <= p_to
        and (p_demo is null or e.demo_id = p_demo)
        and (v_vis is null or e.visitor_id = any (v_vis))
    ), s as (
      select session_id, min(demo_id::text)::uuid as demo_id, min(visitor_id) as visitor_id,
        (array_agg(source order by occurred_at))[1] as source,
        min(occurred_at) as started_at,
        extract(epoch from max(occurred_at) - min(occurred_at))::int as duration_s,
        max(step_index) as max_step,
        bool_or(type = 'demo_complete') as completed,
        (array_agg(device order by occurred_at desc) filter (where device is not null))[1] as device,
        (array_agg(country order by occurred_at desc) filter (where country is not null))[1] as country
      from e group by session_id
    ), sf as (
      select * from s where p_source is null or source = p_source
    )
    select jsonb_build_object(
      'total', (select count(*) from sf),
      'rows', coalesce((select jsonb_agg(r order by r.started_at desc) from (
        select sf.session_id, sf.demo_id, sf.source, sf.started_at, sf.duration_s, sf.max_step, sf.completed,
          sf.device, sf.country,
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

create or replace function public.workspace_leads(
  p_workspace uuid,
  p_from timestamptz,
  p_to timestamptz default now(),
  p_demo uuid default null,
  p_limit int default 50,
  p_offset int default 0,
  p_segment jsonb default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_vis text[];
begin
  if not public.has_role(p_workspace, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_segment is not null then
    v_vis := private.segment_visitors(p_workspace, private.segment_def(p_workspace, p_segment), p_from, p_to);
    if cardinality(v_vis) < 5 then
      return jsonb_build_object('total', 0, 'rows', '[]'::jsonb, 'tooSmall', true);
    end if;
  end if;
  return (
    with l as (
      select l.* from public.leads l
      left join public.demos d on d.id = l.demo_id
      where l.workspace_id = p_workspace and l.created_at >= p_from and l.created_at <= p_to
        and (d.id is null or d.deleted_at is null)
        and (p_demo is null or l.demo_id = p_demo)
        and (v_vis is null or l.visitor_id = any (v_vis))
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

revoke all on function public.workspace_analytics(uuid, timestamptz, timestamptz, uuid, text, jsonb) from public, anon;
grant execute on function public.workspace_analytics(uuid, timestamptz, timestamptz, uuid, text, jsonb) to authenticated;
revoke all on function public.workspace_sessions(uuid, timestamptz, timestamptz, uuid, text, int, int, jsonb) from public, anon;
grant execute on function public.workspace_sessions(uuid, timestamptz, timestamptz, uuid, text, int, int, jsonb) to authenticated;
revoke all on function public.workspace_leads(uuid, timestamptz, timestamptz, uuid, int, int, jsonb) from public, anon;
grant execute on function public.workspace_leads(uuid, timestamptz, timestamptz, uuid, int, int, jsonb) to authenticated;

-- ===== 3. Temps réel d'une démo =====
create index if not exists events_demo_recent_idx on public.events (demo_id, occurred_at desc);

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
