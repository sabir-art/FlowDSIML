-- FlowDSIML — L26-06 à L26-08 : visiteurs récurrents. Idempotent, additif. Schéma soumis au chef d'équipe.
--  * workspaces.visit_measure (activée par défaut) et visit_gap_minutes (30 ou 1 440) : réglage
--    « Mesure des visites », modifiable par un admin+ (grant de colonne + RLS ws_update).
--  * Mesure désactivée : le visitor_id reçu est remplacé par 's:' || session_id à l'insertion
--    (trigger), donc les identifiants existants sont ignorés quel que soit le lecteur.
--  * private.visit_sessions : numéro de visite de chaque session (13 mois d'historique au plus).
--    Clé du visiteur : l'apprenant identifié (learner_visitors), sinon l'identifiant du lecteur.
--    Une nouvelle visite commence quand une session démarre plus de visit_gap_minutes après la fin de
--    la précédente.
--  * Lecture (viewer+) : workspace_returning (agrégats, mêmes filtres que workspace_analytics),
--    session_visits (numéro de visite des sessions affichées), live_visits (temps réel).
--  * Segments : champ « returning » (op 'is', booléen).
-- Aucune redéfinition de workspace_analytics, workspace_sessions, live_demo ni track_events.

-- ===== 1. Réglage =====
alter table public.workspaces add column if not exists visit_measure boolean not null default true;
alter table public.workspaces add column if not exists visit_gap_minutes int not null default 30;
alter table public.workspaces drop constraint if exists workspaces_visit_gap_check;
alter table public.workspaces add constraint workspaces_visit_gap_check check (visit_gap_minutes in (30, 1440));
grant update (visit_measure, visit_gap_minutes) on public.workspaces to authenticated;

-- ===== 2. Mesure désactivée : identifiant de session =====
create or replace function public.events_visit_measure()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select w.visit_measure from public.workspaces w where w.id = new.workspace_id), true) then
    new.visitor_id := left('s:' || new.session_id, 66);
  end if;
  return new;
end $$;
revoke all on function public.events_visit_measure() from public, anon, authenticated;
drop trigger if exists events_visit_measure on public.events;
create trigger events_visit_measure before insert on public.events
  for each row execute function public.events_visit_measure();

-- ===== 3. Numéro de visite des sessions =====
create or replace function private.visit_sessions(p_ws uuid, p_keys text[] default null)
returns table (session_id text, visitor_key text, started_at timestamptz, visit_no int)
language sql stable security definer set search_path = '' as $$
  with gap as (
    select make_interval(mins => w.visit_gap_minutes) as g from public.workspaces w where w.id = p_ws
  ), s as (
    select e.session_id, coalesce(lv.learner_id::text, e.visitor_id) as vkey,
      min(e.occurred_at) as st, max(e.occurred_at) as en
    from public.events e
    left join public.learner_visitors lv on lv.workspace_id = e.workspace_id and lv.visitor_id = e.visitor_id
    where e.workspace_id = p_ws and e.occurred_at > now() - interval '395 days'
      and e.visitor_id not like 's:%'
    group by e.session_id, 2
  ), k as (
    select * from s where p_keys is null or s.vkey = any (p_keys)
  ), n as (
    select k.*, case when lag(k.en) over w is null or k.st - lag(k.en) over w > (select g from gap) then 1 else 0 end as fresh
    from k window w as (partition by k.vkey order by k.st)
  )
  select n.session_id, n.vkey, n.st, (sum(n.fresh) over (partition by n.vkey order by n.st))::int
  from n;
$$;
revoke all on function private.visit_sessions(uuid, text[]) from public;

-- Clé de visiteur (apprenant ou identifiant du lecteur) d'un visitor_id
create or replace function private.visitor_key(p_ws uuid, p_visitor text)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select lv.learner_id::text from public.learner_visitors lv
                   where lv.workspace_id = p_ws and lv.visitor_id = p_visitor), p_visitor);
$$;
revoke all on function private.visitor_key(uuid, text) from public;

-- ===== 4. Agrégats de la période (L26-06) =====
create or replace function public.workspace_returning(
  p_workspace uuid,
  p_from timestamptz,
  p_to timestamptz default now(),
  p_demo uuid default null,
  p_source text default null,
  p_segment jsonb default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_on boolean;
  v_gap int;
  v_vis text[];
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_source is not null and p_source not in ('direct', 'embed', 'link', 'page') then
    raise exception 'Source inconnue' using errcode = '22023';
  end if;
  select visit_measure, visit_gap_minutes into v_on, v_gap from public.workspaces where id = p_workspace;
  if not v_on then
    return jsonb_build_object('enabled', false, 'gapMinutes', v_gap);
  end if;
  if p_segment is not null then
    v_vis := private.segment_visitors(p_workspace, private.segment_def(p_workspace, p_segment), p_from, p_to);
  end if;
  return (
    with e as (
      select e.session_id, e.demo_id, private.visitor_key(p_workspace, e.visitor_id) as vkey
      from public.events e
      join public.demos d on d.id = e.demo_id and d.deleted_at is null
      where e.workspace_id = p_workspace and e.occurred_at >= p_from and e.occurred_at <= p_to
        and e.type = 'demo_view' and e.visitor_id not like 's:%'
        and (p_demo is null or e.demo_id = p_demo)
        and (v_vis is null or e.visitor_id = any (v_vis))
        and (p_source is null or p_source = case when e.channel = 'page' then 'page' when e.link_id is not null then 'link'
                                                  when e.embed_origin is not null then 'embed' else 'direct' end)
    ), vs as (
      select * from private.visit_sessions(p_workspace, (select array_agg(distinct vkey) from e))
    ), pv as (
      -- visites de la période de chaque visiteur (sessions vues pendant la période)
      select e.vkey, max(vs.visit_no) as last_no, count(distinct vs.visit_no) as visits
      from e join vs on vs.session_id = e.session_id and vs.visitor_key = e.vkey
      group by e.vkey
    ), dv as (
      select e.demo_id, count(distinct e.vkey) as total,
        count(distinct e.vkey) filter (where vs.visit_no >= 2) as ret
      from e join vs on vs.session_id = e.session_id and vs.visitor_key = e.vkey
      group by e.demo_id
    )
    select jsonb_build_object(
      'enabled', true,
      'gapMinutes', v_gap,
      'total', (select count(*) from pv),
      'visitors', (select count(*) from pv where last_no >= 2),
      'avgVisits', (select round(avg(visits)::numeric, 1) from pv where last_no >= 2),
      'topDemos', coalesce((select jsonb_agg(jsonb_build_object('demoId', x.demo_id, 'title', x.title,
                                                               'visitors', x.total, 'returning', x.ret)
                                             order by x.ret desc, x.total desc)
                            from (select dv.*, d.title from dv join public.demos d on d.id = dv.demo_id
                                  where dv.ret > 0 order by dv.ret desc, dv.total desc limit 3) x), '[]'::jsonb)
    )
  );
end $$;
revoke all on function public.workspace_returning(uuid, timestamptz, timestamptz, uuid, text, jsonb) from public, anon;
grant execute on function public.workspace_returning(uuid, timestamptz, timestamptz, uuid, text, jsonb) to authenticated;

-- ===== 5. Numéro de visite des sessions affichées (L26-07) =====
create or replace function public.session_visits(p_workspace uuid, p_sessions text[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if not coalesce((select visit_measure from public.workspaces where id = p_workspace), false)
     or p_sessions is null or cardinality(p_sessions) = 0 then
    return '{}'::jsonb;
  end if;
  if cardinality(p_sessions) > 200 then raise exception 'TOO_MANY' using errcode = '22023'; end if;
  return coalesce((
    select jsonb_object_agg(vs.session_id, vs.visit_no)
    from private.visit_sessions(p_workspace, (
      select array_agg(distinct private.visitor_key(p_workspace, e.visitor_id)) from public.events e
      where e.workspace_id = p_workspace and e.session_id = any (p_sessions) and e.visitor_id not like 's:%'
    )) vs
    where vs.session_id = any (p_sessions)), '{}'::jsonb);
end $$;
revoke all on function public.session_visits(uuid, text[]) from public, anon;
grant execute on function public.session_visits(uuid, text[]) to authenticated;

-- ===== 6. Temps réel (L26-07) : même clé que live_demo (md5 du visitor_id, 10 caractères) =====
create or replace function public.live_visits(p_demo uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.demos where id = p_demo and deleted_at is null;
  if v_ws is null or not public.has_role(v_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if not coalesce((select visit_measure from public.workspaces where id = v_ws), false) then
    return '{}'::jsonb;
  end if;
  return coalesce((
    with live as (
      select distinct on (e.visitor_id) e.visitor_id, e.session_id,
        private.visitor_key(v_ws, e.visitor_id) as vkey
      from public.events e
      where e.demo_id = p_demo and e.occurred_at > now() - interval '5 minutes' and e.visitor_id not like 's:%'
      order by e.visitor_id, e.occurred_at desc
    )
    select jsonb_object_agg(left(md5(l.visitor_id), 10), vs.visit_no)
    from live l
    join private.visit_sessions(v_ws, (select array_agg(distinct vkey) from live)) vs
      on vs.session_id = l.session_id and vs.visitor_key = l.vkey), '{}'::jsonb);
end $$;
revoke all on function public.live_visits(uuid) from public, anon;
grant execute on function public.live_visits(uuid) to authenticated;

-- ===== 7. Segments : « Nouveau ou récurrent » =====
-- segment_conditions_ok, segment_match et segment_visitors redéfinies à l'identique de
-- 20261119130100_analytics_segments.sql, avec le champ returning en plus.
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
        when 'returning' then c ->> 'op' = 'is' and jsonb_typeof(c -> 'value') = 'boolean'
        when 'steps' then c ->> 'op' in ('gte', 'lte') and jsonb_typeof(c -> 'value') = 'number'
          and (c ->> 'value') ~ '^\d{1,3}$'
        when 'referrer' then c ->> 'op' in ('contains', 'not_contains') and jsonb_typeof(c -> 'value') = 'string'
          and char_length(btrim(c ->> 'value')) between 1 and 100
        else false end, false));
$$;

create or replace function private.segment_match(a jsonb, c jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case
    when c ->> 'field' in ('device', 'browser', 'os', 'lang', 'country', 'source') then
      case when c ->> 'op' = 'is' then coalesce(a ->> (c ->> 'field') = c ->> 'value', false)
           else coalesce(a ->> (c ->> 'field') <> c ->> 'value', true) end
    when c ->> 'field' = 'demo' then ((a -> 'demos') ? (c ->> 'value')) = (c ->> 'op' = 'is')
    when c ->> 'field' in ('completed', 'lead', 'cta', 'returning') then
      coalesce((a ->> (c ->> 'field'))::boolean, false) = (c ->> 'value')::boolean
    when c ->> 'field' = 'steps' then
      case when c ->> 'op' = 'gte' then (a ->> 'steps')::int >= (c ->> 'value')::int
           else (a ->> 'steps')::int <= (c ->> 'value')::int end
    when c ->> 'field' = 'referrer' then
      (position(lower(btrim(c ->> 'value')) in lower(coalesce(a ->> 'referrer', ''))) > 0) = (c ->> 'op' = 'contains')
    else false end;
$$;

create or replace function private.segment_visitors(p_ws uuid, p_def jsonb, p_from timestamptz, p_to timestamptz)
returns text[] language sql stable security definer set search_path = '' as $$
  with ev as (
    select e.* from public.events e
    join public.demos d on d.id = e.demo_id and d.deleted_at is null
    where e.workspace_id = p_ws and e.occurred_at >= p_from and e.occurred_at <= p_to
  ), keys as (
    select distinct ev.visitor_id, ev.session_id, private.visitor_key(p_ws, ev.visitor_id) as vkey
    from ev where ev.visitor_id not like 's:%'
  ), retk as (
    -- récurrent : une session de la période porte un numéro de visite >= 2 (mesure activée seulement) ;
    -- pour un apprenant, tous ses identifiants
    select distinct k.vkey
    from keys k
    join private.visit_sessions(p_ws, (select array_agg(distinct vkey) from keys)) vs
      on vs.session_id = k.session_id and vs.visitor_key = k.vkey
    where vs.visit_no >= 2
      and coalesce((select w.visit_measure from public.workspaces w where w.id = p_ws), false)
  ), ret as (
    select distinct k.visitor_id from keys k join retk r on r.vkey = k.vkey
  ), a as (
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
      'lead', exists (select 1 from public.leads l where l.workspace_id = p_ws and l.visitor_id = e.visitor_id),
      'returning', exists (select 1 from ret where ret.visitor_id = e.visitor_id)
    ) as attrs
    from ev e
    group by e.visitor_id
  )
  select coalesce(array_agg(a.visitor_id), '{}') from a
  where case when p_def ->> 'match' = 'any'
    then (select bool_or(private.segment_match(a.attrs, c)) from jsonb_array_elements(p_def -> 'conditions') c)
    else (select bool_and(private.segment_match(a.attrs, c)) from jsonb_array_elements(p_def -> 'conditions') c) end;
$$;
revoke all on function private.segment_match(jsonb, jsonb) from public;
revoke all on function private.segment_visitors(uuid, jsonb, timestamptz, timestamptz) from public;
