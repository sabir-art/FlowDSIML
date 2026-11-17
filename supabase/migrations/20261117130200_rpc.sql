-- FlowDSIML — fonctions RPC (security definer, contrôles explicites)
-- Toutes fixent search_path = '' et vérifient les droits elles-mêmes.

-- ---------------------------------------------------------------------------
-- Workspaces et invitations
-- ---------------------------------------------------------------------------
create or replace function public.create_workspace(p_name text, p_slug text default null)
returns public.workspaces language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  base text;
  candidate text;
  ws public.workspaces;
  i int := 0;
begin
  if uid is null then raise exception 'Non authentifié' using errcode = '42501'; end if;
  base := coalesce(nullif(p_slug, ''), p_name);
  base := lower(regexp_replace(translate(base,
    'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ',
    'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'), '[^a-zA-Z0-9]+', '-', 'g'));
  base := trim(both '-' from base);
  if char_length(base) < 2 then base := 'workspace'; end if;
  base := left(base, 50);
  candidate := base;
  while exists (select 1 from public.workspaces where slug = candidate) loop
    i := i + 1;
    candidate := base || '-' || i;
  end loop;

  insert into public.workspaces (name, slug, created_by) values (left(p_name, 80), candidate, uid) returning * into ws;
  insert into public.members (workspace_id, user_id, role) values (ws.id, uid, 'owner');
  insert into public.subscriptions (workspace_id, plan_code) values (ws.id, ws.plan_code);
  insert into public.themes (workspace_id, name, is_default) values (ws.id, 'Par défaut', true);
  return ws;
end $$;

-- Informations publiques minimales d'une invitation (écran d'acceptation).
create or replace function public.get_invitation(p_token uuid)
returns table (workspace_name text, email text, role public.workspace_role, expired boolean, accepted boolean)
language sql stable security definer set search_path = '' as $$
  select w.name, i.email, i.role, i.expires_at < now(), i.accepted_at is not null
  from public.invitations i join public.workspaces w on w.id = i.workspace_id
  where i.token = p_token;
$$;

create or replace function public.accept_invitation(p_token uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  my_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  inv public.invitations;
  n bigint;
begin
  if uid is null then raise exception 'Non authentifié' using errcode = '42501'; end if;
  select * into inv from public.invitations where token = p_token for update;
  if inv.id is null then raise exception 'INVITATION_NOT_FOUND'; end if;
  if inv.accepted_at is not null then raise exception 'INVITATION_ALREADY_USED'; end if;
  if inv.expires_at < now() then raise exception 'INVITATION_EXPIRED'; end if;
  if inv.email <> my_email then raise exception 'INVITATION_EMAIL_MISMATCH'; end if;

  if not exists (select 1 from public.members where workspace_id = inv.workspace_id and user_id = uid) then
    select count(*) into n from public.members where workspace_id = inv.workspace_id;
    if public.limit_reached(inv.workspace_id, 'members', n) then
      raise exception 'PLAN_LIMIT:members' using errcode = 'P0001';
    end if;
    insert into public.members (workspace_id, user_id, role) values (inv.workspace_id, uid, inv.role);
  end if;
  update public.invitations set accepted_at = now() where id = inv.id;
  return inv.workspace_id;
end $$;

-- Membres d'un workspace avec email (auth.users n'est pas lisible côté client).
create or replace function public.list_members(p_workspace uuid)
returns table (user_id uuid, email text, full_name text, role public.workspace_role, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return query
    select m.user_id, u.email::text, coalesce(p.full_name, ''), m.role, m.created_at
    from public.members m
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.id = m.user_id
    where m.workspace_id = p_workspace
    order by m.created_at;
end $$;

-- Usage courant vs limites (affichage du plan).
create or replace function public.workspace_usage(p_workspace uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return jsonb_build_object(
    'plan', (select w.plan_code from public.workspaces w where w.id = p_workspace),
    'limits', (select p.limits from public.workspaces w join public.plans p on p.code = w.plan_code where w.id = p_workspace),
    'published_demos', (select count(*) from public.demos where workspace_id = p_workspace and status = 'published' and deleted_at is null),
    'demos', (select count(*) from public.demos where workspace_id = p_workspace and deleted_at is null),
    'members', (select count(*) from public.members where workspace_id = p_workspace)
  );
end $$;

-- ---------------------------------------------------------------------------
-- Publication
-- ---------------------------------------------------------------------------
-- Étape 1 : construit le manifeste et crée la version (pas encore en ligne).
-- Retourne { versionId, number, manifest, copies: [{from, to}] }.
-- Le client copie les images (captures → published), téléverse le manifeste, puis appelle finalize_publication.
create or replace function public.publish_demo(p_demo uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d public.demos;
  ws public.workspaces;
  lim jsonb;
  n_published bigint;
  v_number int;
  v_id uuid := gen_random_uuid();
  v_theme jsonb;
  v_steps jsonb;
  v_copies jsonb;
  v_forms jsonb;
  v_manifest jsonb;
  lead_forms boolean;
begin
  select * into d from public.demos where id = p_demo and deleted_at is null;
  if d.id is null then raise exception 'DEMO_NOT_FOUND'; end if;
  if not public.has_role(d.workspace_id, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  select * into ws from public.workspaces where id = d.workspace_id;
  select limits into lim from public.plans where code = ws.plan_code;

  if d.status <> 'published' then
    select count(*) into n_published from public.demos
      where workspace_id = d.workspace_id and status = 'published' and deleted_at is null;
    if public.limit_reached(d.workspace_id, 'published_demos', n_published) then
      raise exception 'PLAN_LIMIT:published_demos' using errcode = 'P0001';
    end if;
  end if;

  if not exists (select 1 from public.steps where demo_id = p_demo) then
    raise exception 'DEMO_EMPTY';
  end if;

  lead_forms := coalesce((lim ->> 'lead_forms')::boolean, false);

  select coalesce(max(number), 0) + 1 into v_number from public.demo_versions where demo_id = p_demo;

  -- Thème : thème choisi (ou défaut du workspace) + surcharges de la démo
  select coalesce(t.tokens, '{}'::jsonb) into v_theme from public.themes t
    where t.id = coalesce(d.theme_id, (select id from public.themes where workspace_id = d.workspace_id and is_default limit 1));
  v_theme := coalesce(v_theme, '{}'::jsonb) || coalesce(d.settings -> 'theme', '{}'::jsonb);
  v_theme := v_theme || jsonb_build_object(
    'showBranding', not coalesce((lim ->> 'remove_branding')::boolean, false) or coalesce((v_theme ->> 'showBranding')::boolean, true)
  );

  with s as (
    select st.*, row_number() over (order by st.position, st.created_at) - 1 as idx,
      case when st.image_path is not null
        then 'assets/' || st.id || '-' || md5(st.image_path) || '.webp' end as pub_path
    from public.steps st where st.demo_id = p_demo
  )
  select
    jsonb_agg(jsonb_build_object(
      'id', s.id::text,
      'chapterId', s.chapter_id::text,
      'kind', s.kind,
      'image', case when s.pub_path is not null then jsonb_build_object(
        'url', s.pub_path, 'width', coalesce(s.image_width, 1280), 'height', coalesce(s.image_height, 800)) end,
      'snapshotUrl', null,
      'title', s.title,
      'body', s.body,
      'blurs', s.blurs,
      'zoom', s.zoom,
      'cta', s.cta,
      'gateFormId', case when lead_forms then s.gate_form_id::text end,
      'hotspots', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', h.id::text, 'x', h.x, 'y', h.y, 'w', h.w, 'h', h.h,
          'title', h.title, 'body', h.body, 'placement', h.placement,
          'action', h.action, 'cta', h.cta, 'pulse', h.pulse
        ) order by h.position, h.created_at)
        from public.hotspots h where h.step_id = s.id), '[]'::jsonb)
    ) order by s.idx),
    coalesce(jsonb_agg(jsonb_build_object('from', s.image_path, 'to', p_demo::text || '/' || s.pub_path))
      filter (where s.pub_path is not null), '[]'::jsonb)
  into v_steps, v_copies
  from s;

  if lead_forms then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id::text, 'title', f.title, 'description', f.description, 'submitLabel', f.submit_label,
      'fields', f.fields, 'consentText', f.consent_text, 'skippable', f.skippable)), '[]'::jsonb)
    into v_forms from public.forms f where f.demo_id = p_demo;
  else
    v_forms := '[]'::jsonb;
  end if;

  v_manifest := jsonb_build_object(
    'schemaVersion', 1,
    'demoId', p_demo::text,
    'versionId', v_id::text,
    'workspaceId', d.workspace_id::text,
    'title', d.title,
    'locale', coalesce(d.settings ->> 'locale', 'fr'),
    'publishedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'theme', v_theme,
    'variables', coalesce((select jsonb_agg(jsonb_build_object('key', v.key, 'label', v.label, 'default', v.default_value))
                           from public.variables v where v.workspace_id = d.workspace_id), '[]'::jsonb),
    'chapters', coalesce((select jsonb_agg(jsonb_build_object('id', c.id::text, 'title', c.title) order by c.position)
                          from public.chapters c where c.demo_id = p_demo), '[]'::jsonb),
    'steps', v_steps,
    'forms', v_forms,
    'allowedEmbedOrigins', coalesce(d.settings -> 'allowedEmbedOrigins', '[]'::jsonb),
    'trackUrl', null
  );

  insert into public.demo_versions (id, demo_id, workspace_id, number, manifest, published_by)
  values (v_id, p_demo, d.workspace_id, v_number, v_manifest, (select auth.uid()));

  return jsonb_build_object('versionId', v_id, 'number', v_number, 'manifest', v_manifest, 'copies', v_copies);
end $$;

-- Étape 2 : met la version en ligne (après téléversement du manifeste dans Storage).
create or replace function public.finalize_publication(p_version uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.demo_versions;
begin
  select * into v from public.demo_versions where id = p_version;
  if v.id is null then raise exception 'VERSION_NOT_FOUND'; end if;
  if not public.has_role(v.workspace_id, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  update public.demos set status = 'published', current_version_id = v.id where id = v.demo_id;
end $$;

create or replace function public.unpublish_demo(p_demo uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  select workspace_id into ws from public.demos where id = p_demo;
  if ws is null or not public.has_role(ws, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  update public.demos set status = 'draft' where id = p_demo;
end $$;

-- Duplique une démo (brouillon) avec chapitres, étapes, hotspots et formulaires.
create or replace function public.duplicate_demo(p_demo uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  d public.demos;
  v_new uuid := gen_random_uuid();
begin
  select * into d from public.demos where id = p_demo and deleted_at is null;
  if d.id is null or not public.has_role(d.workspace_id, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;

  insert into public.demos (id, workspace_id, folder_id, title, theme_id, settings, cover_path, created_by)
  values (v_new, d.workspace_id, d.folder_id, left(d.title || ' (copie)', 160), d.theme_id, d.settings, d.cover_path, (select auth.uid()));

  drop table if exists pg_temp._map;
  create temp table _map (old_id uuid primary key, new_id uuid not null) on commit drop;

  insert into _map select id, gen_random_uuid() from public.chapters where demo_id = p_demo;
  insert into public.chapters (id, demo_id, workspace_id, title, position)
    select m.new_id, v_new, d.workspace_id, c.title, c.position from public.chapters c join _map m on m.old_id = c.id;

  insert into _map select id, gen_random_uuid() from public.forms where demo_id = p_demo;
  insert into public.forms (id, workspace_id, demo_id, title, description, submit_label, fields, consent_text, skippable)
    select m.new_id, f.workspace_id, v_new, f.title, f.description, f.submit_label, f.fields, f.consent_text, f.skippable
    from public.forms f join _map m on m.old_id = f.id;

  insert into _map select id, gen_random_uuid() from public.steps where demo_id = p_demo;
  insert into public.steps (id, demo_id, workspace_id, position, chapter_id, kind, image_path, image_width, image_height,
                            snapshot_path, title, body, zoom, blurs, gate_form_id, cta, page_url, page_title, element_meta)
    select m.new_id, v_new, d.workspace_id, s.position, mc.new_id, s.kind, s.image_path, s.image_width, s.image_height,
           s.snapshot_path, s.title, s.body, s.zoom, s.blurs, mf.new_id, s.cta, s.page_url, s.page_title, s.element_meta
    from public.steps s join _map m on m.old_id = s.id
    left join _map mc on mc.old_id = s.chapter_id
    left join _map mf on mf.old_id = s.gate_form_id;

  insert into public.hotspots (step_id, demo_id, workspace_id, x, y, w, h, title, body, placement, action, cta, pulse, position)
    select m.new_id, v_new, d.workspace_id, h.x, h.y, h.w, h.h, h.title, h.body, h.placement,
           -- les cibles "goto" pointent vers les nouvelles étapes
           case when h.action ->> 'type' = 'goto'
             then jsonb_build_object('type', 'goto', 'stepId', coalesce((select g.new_id::text from _map g where g.old_id::text = h.action ->> 'stepId'), h.action ->> 'stepId'))
             else h.action end,
           h.cta, h.pulse, h.position
    from public.hotspots h join _map m on m.old_id = h.step_id;

  return v_new;
end $$;

-- ---------------------------------------------------------------------------
-- Accès public (player) : lien de partage, tracking, leads
-- ---------------------------------------------------------------------------
create or replace function public.resolve_share_link(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('demoId', l.demo_id, 'linkId', l.id, 'variables', l.variables)
  from public.share_links l join public.demos d on d.id = l.demo_id
  where l.token = p_token and l.is_active and (l.expires_at is null or l.expires_at > now())
    and d.status = 'published' and d.deleted_at is null;
$$;

-- Ingestion d'un lot d'événements (appelée par l'Edge Function `track`, ou directement par le player en secours).
create or replace function public.track_events(p_batch jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_demo uuid;
  v_version uuid;
  v_ws uuid;
  v_link uuid;
  n int;
  allowed text[] := array['demo_view','step_view','hotspot_click','cta_click','form_view','form_submit','demo_complete'];
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

  insert into public.events (workspace_id, demo_id, version_id, link_id, visitor_id, session_id, type,
                             step_id, step_index, hotspot_id, props, referrer_host, embed_origin)
  select v_ws, v_demo, v_version, v_link,
         p_batch ->> 'visitorId', p_batch ->> 'sessionId', e ->> 'type',
         left(e ->> 'stepId', 64), nullif(e ->> 'stepIndex', '')::int, left(e ->> 'hotspotId', 64),
         case when jsonb_typeof(e -> 'props') = 'object' and pg_column_size(e -> 'props') < 2000 then e -> 'props' else '{}'::jsonb end,
         left(substring(p_batch ->> 'referrer' from '^[a-z]+://([^/:?#]+)'), 200),
         left(p_batch ->> 'embedOrigin', 300)
  from jsonb_array_elements(p_batch -> 'events') e
  where e ->> 'type' = any (allowed);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.submit_lead(
  p_demo uuid, p_version uuid, p_email text, p_fields jsonb default '{}'::jsonb,
  p_consent boolean default false, p_visitor text default null, p_link_token text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_ws uuid;
  v_link uuid;
  v_id uuid;
  v_email text := lower(trim(p_email));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'BAD_EMAIL'; end if;
  if pg_column_size(p_fields) > 4000 or jsonb_typeof(p_fields) <> 'object' then raise exception 'BAD_FIELDS'; end if;

  select v.workspace_id into v_ws from public.demo_versions v join public.demos d on d.id = v.demo_id
    where v.id = p_version and v.demo_id = p_demo and d.status = 'published' and d.deleted_at is null;
  if v_ws is null then raise exception 'DEMO_NOT_FOUND'; end if;
  if not coalesce((public.plan_limit(v_ws, 'lead_forms') #>> '{}')::boolean, false) then
    raise exception 'PLAN_LIMIT:lead_forms' using errcode = 'P0001';
  end if;
  -- Anti-abus minimal : 20 soumissions max par visiteur et par heure.
  if p_visitor is not null and (
    select count(*) from public.leads where visitor_id = p_visitor and created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'RATE_LIMITED';
  end if;

  if p_link_token is not null then
    select id into v_link from public.share_links where token = p_link_token and demo_id = p_demo;
  end if;

  insert into public.leads (workspace_id, demo_id, version_id, link_id, visitor_id, email, fields, consent)
  values (v_ws, p_demo, p_version, v_link, left(p_visitor, 64), v_email, p_fields, p_consent)
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Analytics
-- ---------------------------------------------------------------------------
create or replace function public.demo_analytics(p_demo uuid, p_from timestamptz default now() - interval '30 days', p_to timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare ws uuid;
begin
  select workspace_id into ws from public.demos where id = p_demo;
  if ws is null or not public.has_role(ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return (
    with e as (
      select * from public.events where demo_id = p_demo and occurred_at >= p_from and occurred_at <= p_to
    )
    select jsonb_build_object(
      'views', (select count(*) from e where type = 'demo_view'),
      'visitors', (select count(distinct visitor_id) from e where type = 'demo_view'),
      'completions', (select count(distinct session_id) from e where type = 'demo_complete'),
      'ctaClicks', (select count(*) from e where type = 'cta_click'),
      'leads', (select count(*) from public.leads l where l.demo_id = p_demo and l.created_at >= p_from and l.created_at <= p_to),
      'steps', coalesce((select jsonb_agg(jsonb_build_object('stepIndex', step_index, 'visitors', c) order by step_index)
                from (select step_index, count(distinct visitor_id) c from e where type = 'step_view' and step_index is not null group by step_index) x), '[]'::jsonb),
      'daily', coalesce((select jsonb_agg(jsonb_build_object('day', dday, 'views', c) order by dday)
                from (select to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') as dday, count(*) c from e where type = 'demo_view' group by 1) y), '[]'::jsonb)
    )
  );
end $$;

create or replace function public.workspace_overview(p_workspace uuid, p_days int default 30)
returns table (demo_id uuid, views bigint, visitors bigint, completions bigint, leads bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return query
    select d.id,
      (select count(*) from public.events e where e.demo_id = d.id and e.type = 'demo_view' and e.occurred_at > now() - make_interval(days => p_days)),
      (select count(distinct e.visitor_id) from public.events e where e.demo_id = d.id and e.type = 'demo_view' and e.occurred_at > now() - make_interval(days => p_days)),
      (select count(distinct e.session_id) from public.events e where e.demo_id = d.id and e.type = 'demo_complete' and e.occurred_at > now() - make_interval(days => p_days)),
      (select count(*) from public.leads l where l.demo_id = d.id and l.created_at > now() - make_interval(days => p_days))
    from public.demos d where d.workspace_id = p_workspace and d.deleted_at is null;
end $$;

-- Rétention : purge des événements bruts selon le plan (appelée par pg_cron).
create or replace function public.purge_old_events()
returns bigint language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
  delete from public.events e using public.workspaces w, public.plans p
  where e.workspace_id = w.id and p.code = w.plan_code
    and e.occurred_at < now() - make_interval(days => coalesce((p.limits ->> 'analytics_retention_days')::int, 30));
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  -- Par défaut : retirer l'exécution à public/anon pour toutes nos fonctions.
  foreach f in array array[
    'public.create_workspace(text, text)', 'public.get_invitation(uuid)', 'public.accept_invitation(uuid)',
    'public.list_members(uuid)', 'public.workspace_usage(uuid)', 'public.publish_demo(uuid)',
    'public.finalize_publication(uuid)', 'public.unpublish_demo(uuid)', 'public.duplicate_demo(uuid)',
    'public.resolve_share_link(text)', 'public.track_events(jsonb)',
    'public.submit_lead(uuid, uuid, text, jsonb, boolean, text, text)',
    'public.demo_analytics(uuid, timestamptz, timestamptz)', 'public.workspace_overview(uuid, int)',
    'public.purge_old_events()', 'public.ensure_events_partitions(int)',
    'public.has_role(uuid, public.workspace_role)', 'public.my_role(uuid)',
    'public.plan_limit(uuid, text)', 'public.limit_reached(uuid, text, bigint)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
  end loop;

  foreach f in array array[
    'public.create_workspace(text, text)', 'public.get_invitation(uuid)', 'public.accept_invitation(uuid)',
    'public.list_members(uuid)', 'public.workspace_usage(uuid)', 'public.publish_demo(uuid)',
    'public.finalize_publication(uuid)', 'public.unpublish_demo(uuid)', 'public.duplicate_demo(uuid)',
    'public.demo_analytics(uuid, timestamptz, timestamptz)', 'public.workspace_overview(uuid, int)',
    'public.has_role(uuid, public.workspace_role)', 'public.my_role(uuid)', 'public.plan_limit(uuid, text)'
  ] loop
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  -- Fonctions publiques du player
  foreach f in array array[
    'public.get_invitation(uuid)', 'public.resolve_share_link(text)', 'public.track_events(jsonb)',
    'public.submit_lead(uuid, uuid, text, jsonb, boolean, text, text)'
  ] loop
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
