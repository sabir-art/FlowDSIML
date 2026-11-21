-- A8, guide optionnel du Sandbox (spec a8-guide-sandbox, paquet P1) :
--  * hotspots.sel : ancrage d'une bulle sur un élément d'une page HTML (sélecteur unique, 500 caractères au
--    plus) ; le rect x/y/w/h reste la position de secours, relative à la fenêtre capturée ;
--  * demos.sandbox.guideSteps : [{ page, hotspot, advance: click | next }], 30 au plus (sandbox_ok redéfinie,
--    migration 20261125170000 figée) ;
--  * publish_demo redéfinie à l'identique (20261125100000), sauf hotspots.sel et sandbox.guideSteps publiés
--    (étapes dont la page et la bulle existent encore) ;
--  * track_events redéfinie à l'identique (20261119140000), avec les événements guide_step, guide_done, guide_skip.

alter table public.hotspots add column if not exists sel text;
alter table public.hotspots drop constraint if exists hotspots_sel_check;
alter table public.hotspots add constraint hotspots_sel_check check (sel is null or char_length(sel) between 1 and 500);

create or replace function public.sandbox_ok(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select v is null or (jsonb_typeof(v) = 'object'
    and not exists (select 1 from jsonb_object_keys(v) k
                    where k not in ('start', 'autoLink', 'unlinked', 'guide', 'keyPages', 'ignoredLinks', 'guideSteps'))
    and (v -> 'start' is null or jsonb_typeof(v -> 'start') = 'null'
         or (v ->> 'start') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    and (v -> 'autoLink' is null or jsonb_typeof(v -> 'autoLink') = 'boolean')
    and (v -> 'guide' is null or jsonb_typeof(v -> 'guide') = 'boolean')
    and (v -> 'unlinked' is null or (v ->> 'unlinked') in ('toast', 'none', 'highlight'))
    and (v -> 'keyPages' is null or (jsonb_typeof(v -> 'keyPages') = 'array' and jsonb_array_length(v -> 'keyPages') <= 200
         and not exists (select 1 from jsonb_array_elements(v -> 'keyPages') k
                         where coalesce(k #>> '{}', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')))
    and (v -> 'ignoredLinks' is null or (jsonb_typeof(v -> 'ignoredLinks') = 'array'
         and jsonb_array_length(v -> 'ignoredLinks') <= 500
         and not exists (select 1 from jsonb_array_elements(v -> 'ignoredLinks') x
                         where jsonb_typeof(x) <> 'object'
                            or exists (select 1 from jsonb_object_keys(x) k where k not in ('url', 'from'))
                            or coalesce(x ->> 'url', '') !~ '^https?://\S+$'
                            or length(x ->> 'url') > 2048
                            or coalesce(x ->> 'from', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')))
    and (v -> 'guideSteps' is null or (jsonb_typeof(v -> 'guideSteps') = 'array'
         and jsonb_array_length(v -> 'guideSteps') <= 30
         and not exists (select 1 from jsonb_array_elements(v -> 'guideSteps') g
                         where jsonb_typeof(g) <> 'object'
                            or exists (select 1 from jsonb_object_keys(g) k where k not in ('page', 'hotspot', 'advance'))
                            or coalesce(g ->> 'page', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                            or coalesce(g ->> 'hotspot', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                            or (g -> 'advance' is not null and (g ->> 'advance') not in ('click', 'next'))))));
$$;

create or replace function public.track_events(p_batch jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_demo uuid;
  v_version uuid;
  v_ws uuid;
  v_link uuid;
  n int;
  allowed text[] := array['demo_view','step_view','hotspot_click','cta_click','form_view','form_submit','demo_complete',
                          'guide_step','guide_done','guide_skip'];
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

CREATE OR REPLACE FUNCTION public.publish_demo(p_demo uuid, p_ack jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_ack jsonb;
  v_quiz jsonb;
  v_bad int;
  v_ba int;
  v_glossary jsonb;
  v_dataset jsonb;
  v_ab jsonb;
  v_video int;
  v_html int;
begin
  select * into d from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id) and deleted_at is null;
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

  -- L17 : une étape Avant / Après n'est publiable qu'avec ses deux captures
  select min(n) into v_ba from (
    select row_number() over (order by s.position, s.created_at) as n, s.*
    from public.steps s where s.demo_id = p_demo
  ) x
  where x.kind::text = 'before_after' and (x.image_path is null or x.before_image_path is null);
  if v_ba is not null then
    raise exception 'BEFORE_AFTER_INCOMPLETE:%', v_ba using errcode = 'P0001';
  end if;

  -- F7 : une étape vidéo n'est publiable qu'avec son fichier et sa durée
  select min(n) into v_video from (
    select row_number() over (order by s.position, s.created_at) as n, s.*
    from public.steps s where s.demo_id = p_demo
  ) x
  where x.kind::text = 'video' and (x.video_path is null or x.video_duration_ms is null);
  if v_video is not null then
    raise exception 'VIDEO_MISSING:%', v_video using errcode = 'P0001';
  end if;

  -- A8 : une étape HTML n'est publiable qu'avec sa page capturée
  select min(n) into v_html from (
    select row_number() over (order by s.position, s.created_at) as n, s.*
    from public.steps s where s.demo_id = p_demo
  ) x
  where x.kind::text = 'html' and x.html_path is null;
  if v_html is not null then
    raise exception 'HTML_MISSING:%', v_html using errcode = 'P0001';
  end if;

  -- F2 : quiz du module (après la dernière étape). Publication bloquée tant qu'une question est invalide.
  select min(n) into v_bad from (
    select row_number() over (order by q.position, q.created_at) as n, q.*
    from public.quiz_questions q where q.demo_id = p_demo
  ) x
  where btrim(x.prompt) = ''
     -- L19 : note de 0 à 10 et réponse écrite, en mode Sondage seulement, sans choix de réponse
     or (x.type in ('nps', 'text') and coalesce(d.settings -> 'quiz' ->> 'mode', 'quiz') <> 'survey')
     or (x.type not in ('nps', 'text') and (jsonb_array_length(x.answers) < 2
       or exists (select 1 from jsonb_array_elements(x.answers) a where btrim(coalesce(a ->> 'label', '')) = '')
       or (coalesce(d.settings -> 'quiz' ->> 'mode', 'quiz') = 'quiz'
           and not exists (select 1 from jsonb_array_elements(x.answers) a where coalesce((a ->> 'correct')::boolean, false)))));
  if v_bad is not null then
    raise exception 'QUIZ_INVALID:%', v_bad using errcode = 'P0001';
  end if;
  select case when count(*) = 0 then null else jsonb_build_object(
      'mode', case when d.settings -> 'quiz' ->> 'mode' = 'survey' then 'survey' else 'quiz' end,
      'threshold', least(greatest(coalesce((d.settings -> 'quiz' ->> 'threshold')::int, 70), 0), 100),
      'attempts', least(greatest(coalesce((d.settings -> 'quiz' ->> 'attempts')::int, 3), 0), 5),
      'feedback', case when d.settings -> 'quiz' ->> 'feedback' = 'end' then 'end' else 'each' end,
      'shuffle', coalesce((d.settings -> 'quiz' ->> 'shuffle')::boolean, true),
      'required', coalesce((d.settings -> 'quiz' ->> 'required')::boolean, true),
      'questions', jsonb_agg(jsonb_build_object(
        'id', q.id::text, 'type', q.type, 'prompt', q.prompt, 'answers', q.answers,
        'explanation', q.explanation, 'stepId', q.step_id::text, 'points', q.points
      ) order by q.position, q.created_at)) end
  into v_quiz from public.quiz_questions q where q.demo_id = p_demo;

  -- F1 : liens publics désactivables par workspace (désactivés par défaut pour les nouveaux).
  -- Toute publication est publique tant que les modes restreints (F3) n'existent pas.
  if not ws.public_links_enabled then
    raise exception 'PUBLIC_DISABLED' using errcode = 'P0001';
  end if;
  -- F1 : avertissement RGPD confirmé à chaque publication publique (deux cases), journalisé
  if p_ack is null or not coalesce((p_ack ->> 'reviewed')::boolean, false)
     or not coalesce((p_ack ->> 'fictional')::boolean, false) then
    raise exception 'GDPR_ACK_REQUIRED' using errcode = 'P0001';
  end if;
  -- Bilan calculé côté serveur (zones floutées, détections laissées non floutées par étape)
  with st as (
    select row_number() over (order by s.position, s.created_at) as n, s.blurs, s.before_blurs, s.element_meta -> 'pii' as pii
    from public.steps s where s.demo_id = p_demo
  )
  select jsonb_build_object(
    'by', (select auth.uid()),
    'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'reviewed', true,
    'fictional', true,
    'blurred', coalesce(sum(
      case when jsonb_typeof(st.blurs) = 'array' then jsonb_array_length(st.blurs) else 0 end
      -- L17 : zones floutées de la capture « Avant », comptées comme celles de l'étape
      + case when jsonb_typeof(st.before_blurs) = 'array' then jsonb_array_length(st.before_blurs) else 0 end
      + case when jsonb_typeof(st.pii) = 'array'
          then (select count(*) from jsonb_array_elements(st.pii) p where coalesce((p ->> 'blurred')::boolean, false))
          else 0 end), 0),
    'pendingSteps', coalesce(jsonb_agg(st.n order by st.n) filter (where jsonb_typeof(st.pii) = 'array'
      and exists (select 1 from jsonb_array_elements(st.pii) p where not coalesce((p ->> 'blurred')::boolean, false))), '[]'::jsonb))
  into v_ack from st;
  -- L25-09 : le bilan RGPD compte le jeu de données publié (lignes et colonnes liées)
  v_ack := v_ack || coalesce((select jsonb_build_object('dataset', jsonb_build_object(
      'rows', jsonb_array_length(ds.rows),
      'columns', (select count(*) from jsonb_array_elements_text(ds.columns) x(c)
                  where x.c = ds.link_column
                     or exists (select 1 from jsonb_array_elements(ds.bindings) b where b ->> 'column' = x.c))))
    from public.demo_datasets ds where ds.demo_id = p_demo), '{}'::jsonb);

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
        then 'assets/' || st.id || '-' || md5(st.image_path) || '.webp' end as pub_path,
      case when st.kind::text = 'before_after' and st.before_image_path is not null
        then 'assets/' || st.id || '-b-' || md5(st.before_image_path) || '.webp' end as before_pub_path,
      case when st.kind::text = 'video' and st.video_path is not null
        then 'assets/' || st.id || '-v-' || md5(st.video_path) || '.webm' end as video_pub_path,
      case when st.kind::text = 'html' and st.html_path is not null
        then 'assets/' || st.id || '-h-' || md5(st.html_path) || '.html' end as html_pub_path,
      -- L25-01 : capture pleine page (animation de défilement), copiée comme l'image de l'étape
      case when st.image_path is not null and st.options #>> '{fullPage,path}' is not null
        then 'assets/' || st.id || '-p-' || md5(st.options #>> '{fullPage,path}') || '.webp' end as full_pub_path
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
      -- L17 : capture « Avant » et ses zones floutées (traitées comme blurs : incrustées à la publication)
      'beforeAfter', case when s.before_pub_path is not null then jsonb_build_object(
        'layout', coalesce(s.options #>> '{beforeAfter,layout}', 'side'),
        'labels', jsonb_build_object(
          'before', left(coalesce(s.options #>> '{beforeAfter,labels,before}', ''), 20),
          'after', left(coalesce(s.options #>> '{beforeAfter,labels,after}', ''), 20)),
        'notes', jsonb_build_object(
          'before', left(coalesce(s.options #>> '{beforeAfter,notes,before}', ''), 140),
          'after', left(coalesce(s.options #>> '{beforeAfter,notes,after}', ''), 140)),
        'before', jsonb_build_object('url', s.before_pub_path,
          'width', coalesce(s.before_image_width, 1280), 'height', coalesce(s.before_image_height, 800)),
        'beforeBlurs', s.before_blurs) end,
      -- F7 : vidéo de l'onglet (coupes, pauses-étapes, sous-titres) et image de chaque pause
      'video', case when s.video_pub_path is not null then jsonb_build_object(
        'url', s.video_pub_path,
        'durationMs', s.video_duration_ms,
        'cuts', coalesce(s.video -> 'cuts', '[]'::jsonb),
        'pauses', coalesce(s.video -> 'pauses', '[]'::jsonb),
        'captions', coalesce(s.video -> 'captions', '[]'::jsonb),
        'captionsDefault', coalesce((s.video ->> 'captionsDefault')::boolean, coalesce((s.video ->> 'hasVoice')::boolean, false)),
        'autoplayMuted', coalesce((s.video ->> 'autoplayMuted')::boolean, true),
        'hasVoice', coalesce((s.video ->> 'hasVoice')::boolean, false),
        'frames', coalesce((select jsonb_object_agg(f.key, 'assets/' || s.id || '-f-' || md5(f.value #>> '{}') || '.webp')
                            from jsonb_each(coalesce(s.video -> 'frames', '{}'::jsonb)) f), '{}'::jsonb)) end,
      -- A8 : page HTML capturée (servie en iframe srcdoc sandbox) et ses opérations. Les liens vers
      -- une étape absente de la démo sont retirés ; meta réduite à ce que le lecteur affiche.
      'html', case when s.html_pub_path is not null then jsonb_build_object(
        'url', s.html_pub_path,
        'ops', coalesce((select jsonb_agg(e.op order by e.ord) from jsonb_array_elements(s.html_ops) with ordinality as e(op, ord)
                         where e.op ->> 'op' <> 'link' or exists (
                           select 1 from public.steps t where t.demo_id = p_demo and t.id::text = e.op ->> 'value')), '[]'::jsonb),
        'title', left(coalesce(s.html_meta ->> 'title', ''), 200),
        'viewport', s.html_meta -> 'viewport',
        -- Liens de la page résolus vers une autre page de la démo (même adresse, sans fragment ni
        -- barre finale) : liaison automatique du Sandbox. Aucune adresse n'est publiée.
        'links', coalesce((select jsonb_agg(jsonb_build_object('sel', l ->> 'sel', 'step', t.id::text))
                           from jsonb_array_elements(coalesce(s.html_meta -> 'links', '[]'::jsonb)) l
                           join lateral (select t.id from public.steps t
                                         where t.demo_id = p_demo and t.kind::text = 'html' and t.id <> s.id
                                           and regexp_replace(regexp_replace(t.html_meta ->> 'url', '#.*$', ''), '/$', '')
                                             = regexp_replace(regexp_replace(l ->> 'href', '#.*$', ''), '/$', '')
                                         order by t.position, t.created_at limit 1) t on true), '[]'::jsonb)) end,
      'zoom', s.zoom,
      'cta', s.cta,
      -- L25-01 : le chemin de stockage de la page entière n'est jamais publié, seulement sa copie
      'options', (s.options - 'beforeAfter' - 'fullPage')
        || case when s.full_pub_path is not null then jsonb_build_object('fullPage', jsonb_build_object(
             'url', s.full_pub_path,
             'width', (s.options #>> '{fullPage,width}')::int,
             'height', (s.options #>> '{fullPage,height}')::int,
             'top', (s.options #>> '{fullPage,top}')::int,
             'viewportHeight', (s.options #>> '{fullPage,viewportHeight}')::int)) else '{}'::jsonb end,
      'gateFormId', case when lead_forms then s.gate_form_id::text end,
      'hotspots', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', h.id::text, 'x', h.x, 'y', h.y, 'w', h.w, 'h', h.h,
          'title', h.title, 'body', h.body, 'placement', h.placement,
          'action', h.action, 'cta', h.cta, 'pulse', h.pulse,
          -- A8 guide du Sandbox : ancrage par sélecteur sur une page HTML (rect de secours sinon)
          'sel', h.sel,
          -- mode Spotlight réglé pour toute la démo : il s'impose à chaque hotspot
          'style', case when d.settings ->> 'mode' = 'spotlight' then 'spotlight' else h.style end
        ) order by h.position, h.created_at)
        from public.hotspots h where h.step_id = s.id), '[]'::jsonb)
    ) order by s.idx),
    coalesce(jsonb_agg(jsonb_build_object('from', s.image_path, 'to', p_demo::text || '/' || s.pub_path))
      filter (where s.pub_path is not null), '[]'::jsonb)
    || coalesce(jsonb_agg(jsonb_build_object('from', s.before_image_path, 'to', p_demo::text || '/' || s.before_pub_path))
      filter (where s.before_pub_path is not null), '[]'::jsonb)
    || coalesce(jsonb_agg(jsonb_build_object('from', s.options #>> '{fullPage,path}', 'to', p_demo::text || '/' || s.full_pub_path))
      filter (where s.full_pub_path is not null), '[]'::jsonb)
    -- F7 : la vidéo (bucket videos, copiée telle quelle) et les images des pauses (bucket captures)
    || coalesce(jsonb_agg(jsonb_build_object('from', s.video_path, 'to', p_demo::text || '/' || s.video_pub_path,
                                             'bucket', 'videos'))
      filter (where s.video_pub_path is not null), '[]'::jsonb)
    || coalesce((select jsonb_agg(jsonb_build_object('from', f.value #>> '{}',
                    'to', p_demo::text || '/assets/' || s2.id || '-f-' || md5(f.value #>> '{}') || '.webp'))
                 from public.steps s2, jsonb_each(coalesce(s2.video -> 'frames', '{}'::jsonb)) f
                 where s2.demo_id = p_demo and s2.kind::text = 'video' and s2.video_path is not null), '[]'::jsonb)
    -- A8 : page HTML (bucket html, copiée telle quelle)
    || coalesce(jsonb_agg(jsonb_build_object('from', s.html_path, 'to', p_demo::text || '/' || s.html_pub_path,
                                             'bucket', 'html'))
      filter (where s.html_pub_path is not null), '[]'::jsonb)
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

  -- L17 : glossaire (termes présents dans la démo), null si le soulignement est désactivé
  if coalesce((ws.settings #>> '{glossary,underline}')::boolean, true)
     and coalesce((d.settings ->> 'glossary')::boolean, true) then
    select coalesce(jsonb_agg(jsonb_build_object(
        'term', g.term, 'oldTerm', g.old_term, 'definition', g.definition, 'forms', to_jsonb(g.forms))
        order by g.term), '[]'::jsonb)
      into v_glossary
    from public.glossary_terms g
    where g.workspace_id = d.workspace_id
      and public.glossary_in_text(public.demo_text(p_demo), g.term, g.forms);
  end if;

  -- L18 : test A/B en cours (variante B rendue par le lecteur comme la bulle A)
  select jsonb_build_object('testId', t.id::text, 'hotspotId', t.hotspot_id::text, 'splitB', t.split_b,
      'b', jsonb_build_object('title', coalesce(t.variant_b ->> 'title', ''), 'body', coalesce(t.variant_b ->> 'body', ''),
                              'cta', case when jsonb_typeof(t.variant_b -> 'cta') = 'object' then t.variant_b -> 'cta' end))
    into v_ab
  from public.ab_tests t
  where t.demo_id = p_demo and t.status = 'running'
    and exists (select 1 from public.hotspots h where h.id = t.hotspot_id);

  -- L25-09 : jeu de données publié réduit aux colonnes liées (et à la colonne de correspondance)
  select case when ds.id is null then null else jsonb_build_object(
      'columns', coalesce((select jsonb_agg(x.c order by x.o) from jsonb_array_elements_text(ds.columns) with ordinality x(c, o)
                           where x.c = ds.link_column
                              or exists (select 1 from jsonb_array_elements(ds.bindings) b where b ->> 'column' = x.c)), '[]'::jsonb),
      'rows', coalesce((select jsonb_agg((select jsonb_agg(r -> (x.o::int - 1) order by x.o)
                                          from jsonb_array_elements_text(ds.columns) with ordinality x(c, o)
                                          where x.c = ds.link_column
                                             or exists (select 1 from jsonb_array_elements(ds.bindings) b where b ->> 'column' = x.c)))
                        from jsonb_array_elements(ds.rows) r), '[]'::jsonb),
      'bindings', ds.bindings, 'rowMode', ds.row_mode, 'linkColumn', ds.link_column) end
    into v_dataset
  from (select 1) one left join public.demo_datasets ds on ds.demo_id = p_demo;

  v_manifest := jsonb_build_object(
    'schemaVersion', 1,
    'demoId', p_demo::text,
    'versionId', v_id::text,
    'workspaceId', d.workspace_id::text,
    -- PLY-01 : nom du workspace (en-tête du lecteur, « Données traitées par … »)
    'workspaceName', left(coalesce(ws.name, ''), 120),
    'title', d.title,
    -- F7 : démo capturée au format mobile (cadre téléphone, feuille du bas, « Touchez »)
    'device', d.device,
    'viewport', d.viewport,
    -- A8 : démo guidée ou Sandbox (navigation libre entre pages HTML reliées)
    'kind', d.kind,
    'sandbox', case when d.kind = 'sandbox' then jsonb_build_object(
      'start', coalesce(
        (select t.id::text from public.steps t where t.demo_id = p_demo and t.id::text = d.sandbox ->> 'start'),
        (select t.id::text from public.steps t where t.demo_id = p_demo order by t.position, t.created_at limit 1)),
      'autoLink', coalesce((d.sandbox ->> 'autoLink')::boolean, true),
      'unlinked', coalesce(d.sandbox ->> 'unlinked', 'toast'),
      'guide', coalesce((d.sandbox ->> 'guide')::boolean, false),
      'keyPages', coalesce((select jsonb_agg(k) from jsonb_array_elements_text(coalesce(d.sandbox -> 'keyPages', '[]'::jsonb)) k
                            where exists (select 1 from public.steps t where t.demo_id = p_demo and t.id::text = k)), '[]'::jsonb),
      -- A8 : étapes du guide dont la page et la bulle existent encore, dans l'ordre, 30 au plus
      'guideSteps', coalesce((select jsonb_agg(jsonb_build_object('page', g ->> 'page', 'hotspot', g ->> 'hotspot',
                                'advance', coalesce(g ->> 'advance', 'click')) order by o)
                              from jsonb_array_elements(coalesce(d.sandbox -> 'guideSteps', '[]'::jsonb)) with ordinality x(g, o)
                              where o <= 30 and exists (select 1 from public.hotspots h join public.steps t on t.id = h.step_id
                                where t.demo_id = p_demo and t.id::text = g ->> 'page' and h.id::text = g ->> 'hotspot')),
                             '[]'::jsonb)) end,
    'locale', coalesce(d.settings ->> 'locale', 'fr'),
    'publishedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'theme', v_theme,
    -- L46 : valeur fixe de l'espace (sinon celle du lien ou du CSV), à défaut le repli saisi
    'variables', coalesce((select jsonb_agg(jsonb_build_object('key', v.key, 'label', v.label,
                                                               'default', coalesce(nullif(v.value, ''), v.default_value)))
                           from public.variables v where v.workspace_id = d.workspace_id), '[]'::jsonb),
    'chapters', coalesce((select jsonb_agg(jsonb_build_object('id', c.id::text, 'title', c.title) order by c.position)
                          from public.chapters c where c.demo_id = p_demo), '[]'::jsonb),
    'steps', v_steps,
    'forms', v_forms,
    'allowedEmbedOrigins', coalesce(d.settings -> 'allowedEmbedOrigins', '[]'::jsonb),
    -- P6 : bouton d'action du client affiché en permanence dans le player (ex. « Réserver une démo »)
    'cta', case when jsonb_typeof(d.settings -> 'cta') = 'object' and d.settings -> 'cta' ? 'url' then d.settings -> 'cta' end,
    -- P13 : lien « Confidentialité » du workspace sous les formulaires de lead (https uniquement)
    'privacyUrl', case when (ws.settings ->> 'privacyUrl') ~ '^https://[^\s]+$' then ws.settings ->> 'privacyUrl' end,
    -- F1 : checklist de progression et lecture automatique (réglages de la démo)
    'checklist', case when jsonb_typeof(d.settings -> 'checklist') = 'object'
                       and coalesce((d.settings -> 'checklist' ->> 'enabled')::boolean, false)
                  then jsonb_build_object(
                    'title', left(coalesce(d.settings -> 'checklist' ->> 'title', ''), 80),
                    'position', case when d.settings -> 'checklist' ->> 'position' in ('left', 'right', 'collapsed')
                                     then d.settings -> 'checklist' ->> 'position' else 'right' end)
                  end,
    'autoplay', case when jsonb_typeof(d.settings -> 'autoplay') = 'object'
                      and coalesce((d.settings -> 'autoplay' ->> 'enabled')::boolean, false)
                 then jsonb_build_object('enabled', true,
                        'delayMs', least(greatest(coalesce((d.settings -> 'autoplay' ->> 'delayMs')::int, 4000), 1500), 30000))
                 end,
    -- F2 : quiz de validation (ou sondage) après la dernière étape
    'quiz', v_quiz,
    'glossary', v_glossary,
    'ab', v_ab,
    -- L25-09 : jeu de données (colonnes liées seulement, contrôlé à l'écriture)
    'dataset', v_dataset,
    'trackUrl', null
  );

  insert into public.demo_versions (id, demo_id, workspace_id, number, manifest, published_by, public_ack)
  values (v_id, p_demo, d.workspace_id, v_number, v_manifest, (select auth.uid()), v_ack);

  return jsonb_build_object('versionId', v_id, 'number', v_number, 'manifest', v_manifest, 'copies', v_copies);
end $function$;

revoke all on function public.publish_demo(uuid, jsonb) from public, anon;
grant execute on function public.publish_demo(uuid, jsonb) to authenticated;
