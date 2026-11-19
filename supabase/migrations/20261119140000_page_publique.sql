-- L19b (A1-12) : page publique d'une démo. Schéma validé par le chef d'équipe, avec ses conditions :
--  * demo_pages : page désactivée par défaut, titre (70), description (200), bouton d'action (40) et
--    lien https vérifié en base, style, démos liées, indexation (désactivée par défaut) ;
--  * public_page (anon) : aucun identifiant interne autre que ceux des démos (ni workspace, ni
--    utilisateur) ; même réponse nulle pour toute page indisponible ; indexation forcée à false si la
--    démo est protégée (mot de passe, invitation, domaine) ;
--  * events.channel ('page', liste fermée) et source « page » dans les analytics du workspace.

-- ===== 1. Table =====
create table if not exists public.demo_pages (
  demo_id uuid primary key references public.demos (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  enabled boolean not null default false,
  title text not null default '' check (char_length(title) <= 70),
  description text not null default '' check (char_length(description) <= 200),
  cta_label text check (cta_label is null or char_length(btrim(cta_label)) between 1 and 40),
  cta_url text check (cta_url is null or (char_length(cta_url) <= 500 and cta_url ~ '^https://[^\s/?#]+[^\s]*$')),
  style text not null default 'demo' check (style in ('demo', 'light', 'dark')),
  related boolean not null default false,
  indexable boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid(),
  constraint demo_pages_cta_pair check ((cta_label is null) = (cta_url is null))
);

-- Workspace toujours celui de la démo ; auteur et date posés à chaque écriture
create or replace function public.demo_pages_context()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select workspace_id into new.workspace_id from public.demos where id = new.demo_id;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
revoke all on function public.demo_pages_context() from public, anon, authenticated;
drop trigger if exists demo_pages_context on public.demo_pages;
create trigger demo_pages_context before insert or update on public.demo_pages
  for each row execute function public.demo_pages_context();

alter table public.demo_pages enable row level security;
drop policy if exists demo_pages_select on public.demo_pages;
create policy demo_pages_select on public.demo_pages for select to authenticated
  using (public.has_role(workspace_id, 'viewer'));
drop policy if exists demo_pages_write on public.demo_pages;
create policy demo_pages_write on public.demo_pages for all to authenticated
  using (public.has_role(workspace_id, 'editor')) with check (public.has_role(workspace_id, 'editor'));
revoke all on public.demo_pages from anon;
grant select, insert, update, delete on public.demo_pages to authenticated;

-- ===== 2. Lecture publique =====
create or replace function public.public_page(p_demo uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r record;
  v_mode text;
  v_last jsonb;
  v_center jsonb;
begin
  select d.id, d.title as demo_title, d.workspace_id, pg.title, pg.description, pg.cta_label, pg.cta_url, pg.style,
         pg.related, pg.indexable, w.name as ws_name, w.settings as ws_settings, v.manifest, v.published_at
    into r
    from public.demo_pages pg
    join public.demos d on d.id = pg.demo_id
    join public.workspaces w on w.id = d.workspace_id
    join public.demo_versions v on v.id = d.current_version_id
   where pg.demo_id = p_demo and pg.enabled and d.status = 'published' and d.deleted_at is null
     and w.public_links_enabled;
  -- Page désactivée, démo retirée, liens publics coupés : même réponse, sans aucune information
  if not found then return null; end if;
  select mode into v_mode from public.demo_access where demo_id = p_demo;
  v_last := r.manifest -> 'steps' -> (jsonb_array_length(coalesce(r.manifest -> 'steps', '[]'::jsonb)) - 1);
  select published into v_center from public.training_centers where workspace_id = r.workspace_id;
  return jsonb_build_object(
    'demoId', r.id,
    'title', coalesce(nullif(btrim(r.title), ''), r.demo_title),
    'description', r.description,
    'cta', case when r.cta_url is not null then jsonb_build_object('label', r.cta_label, 'url', r.cta_url) end,
    'endTitle', left(coalesce(v_last ->> 'title', ''), 200),
    'endBody', left(coalesce(v_last ->> 'body', ''), 1000),
    'style', r.style,
    -- Démo protégée (mot de passe, invitation, domaine) : jamais indexée
    'indexable', r.indexable and coalesce(v_mode, 'link') = 'link',
    'steps', jsonb_array_length(coalesce(r.manifest -> 'steps', '[]'::jsonb)),
    'updatedAt', r.published_at,
    'workspace', r.ws_name,
    'privacyUrl', case when (r.ws_settings ->> 'privacyUrl') ~ '^https://\S+$' then r.ws_settings ->> 'privacyUrl' end,
    'a11y', coalesce(v_center ->> 'a11y', 'non_evalue'),
    'a11yUrl', case when (v_center ->> 'a11yUrl') ~ '^https://\S+$' then v_center ->> 'a11yUrl' end,
    'related', case when r.related then coalesce((
      select jsonb_agg(jsonb_build_object('demoId', x.id, 'title', x.title, 'description', x.description) order by x.at desc)
      from (select d2.id, coalesce(nullif(btrim(p2.title), ''), d2.title) as title, p2.description, p2.updated_at as at
              from public.demo_pages p2 join public.demos d2 on d2.id = p2.demo_id
             where p2.workspace_id = r.workspace_id and p2.enabled and p2.demo_id <> r.id
               and d2.status = 'published' and d2.deleted_at is null and d2.current_version_id is not null
             order by p2.updated_at desc limit 3) x), '[]'::jsonb) else '[]'::jsonb end
  );
end $$;
revoke all on function public.public_page(uuid) from public;
grant execute on function public.public_page(uuid) to anon, authenticated;

-- ===== 3. Canal « page » des événements =====
alter table public.events add column if not exists channel text;
alter table public.events drop constraint if exists events_channel_check;
alter table public.events add constraint events_channel_check check (channel is null or channel in ('page'));

-- track_events redéfinie à l'identique de 20261119130000_analytics_collecte.sql, avec le canal en plus.
create or replace function public.track_events(p_batch jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_demo uuid;
  v_version uuid;
  v_ws uuid;
  v_link uuid;
  n int;
  allowed text[] := array['demo_view','step_view','hotspot_click','cta_click','form_view','form_submit','demo_complete'];
  v_dev jsonb := case when jsonb_typeof(p_batch -> 'device') = 'object' then p_batch -> 'device' else '{}'::jsonb end;
  v_device text;
  v_browser text;
  v_os text;
  v_lang text;
  v_country text;
  -- L19b : canal de diffusion (liste fermée) ; toute autre valeur devient null
  v_channel text := case when p_batch ->> 'channel' = 'page' then 'page' end;
begin
  begin
    v_demo := (p_batch ->> 'demoId')::uuid;
    v_version := (p_batch ->> 'versionId')::uuid;
  exception when others then
    raise exception 'BAD_BATCH';
  end;
  if jsonb_typeof(p_batch -> 'events') <> 'array' or jsonb_array_length(p_batch -> 'events') > 50 then
    raise exception 'BAD_BATCH';
  end if;
  if char_length(coalesce(p_batch ->> 'visitorId', '')) not between 8 and 64
     or char_length(coalesce(p_batch ->> 'sessionId', '')) not between 8 and 64 then
    raise exception 'BAD_BATCH';
  end if;

  select v.workspace_id into v_ws from public.demo_versions v
    join public.demos d on d.id = v.demo_id
    where v.id = v_version and v.demo_id = v_demo and d.status = 'published' and d.deleted_at is null;
  if v_ws is null then return 0; end if;

  if p_batch ->> 'linkToken' is not null then
    select id into v_link from public.share_links where token = p_batch ->> 'linkToken' and demo_id = v_demo;
  end if;

  -- L19 : listes fermées ; toute autre valeur devient null
  v_device := case when v_dev ->> 'type' in ('mobile', 'tablet', 'desktop') then v_dev ->> 'type' end;
  v_browser := case when v_dev ->> 'browser' in ('chrome', 'edge', 'firefox', 'safari', 'opera', 'samsung', 'other')
                    then v_dev ->> 'browser' end;
  v_os := case when v_dev ->> 'os' in ('windows', 'macos', 'ios', 'android', 'linux', 'chromeos', 'other')
               then v_dev ->> 'os' end;
  v_lang := case when v_dev ->> 'lang' ~ '^[a-z]{2}$' then v_dev ->> 'lang' end;
  v_country := case when p_batch ->> 'country' ~ '^[A-Z]{2}$' and p_batch ->> 'country' not in ('XX', 'T1')
                    then p_batch ->> 'country' end;

  insert into public.events (workspace_id, demo_id, version_id, link_id, visitor_id, session_id, type,
                             step_id, step_index, hotspot_id, props, referrer_host, embed_origin,
                             device, browser, os, lang, country, channel)
  select v_ws, v_demo, v_version, v_link,
         p_batch ->> 'visitorId', p_batch ->> 'sessionId', e ->> 'type',
         left(e ->> 'stepId', 64), nullif(e ->> 'stepIndex', '')::int, left(e ->> 'hotspotId', 64),
         case when jsonb_typeof(e -> 'props') = 'object' and pg_column_size(e -> 'props') < 2000 then e -> 'props' else '{}'::jsonb end,
         left(substring(p_batch ->> 'referrer' from '^[a-z]+://([^/:?#]+)'), 200),
         left(p_batch ->> 'embedOrigin', 300),
         v_device, v_browser, v_os, v_lang, v_country, v_channel
  from jsonb_array_elements(p_batch -> 'events') e
  where e ->> 'type' = any (allowed);
  get diagnostics n = row_count;
  return n;
end $$;

-- workspace_analytics et workspace_sessions redéfinies à l'identique de 20261119130100_analytics_segments.sql,
-- avec la source « page » (événements du canal page) en plus.
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
        'link', (select count(*) from e where type = 'demo_view' and source = 'link'),
        'page', (select count(*) from e where type = 'demo_view' and source = 'page')),
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
        case when e.channel = 'page' then 'page' when e.link_id is not null then 'link' when e.embed_origin is not null then 'embed' else 'direct' end as source
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
