-- F7 (L21) : vidéo de l'onglet et démo mobile. Schéma validé par le chef d'équipe :
--  * steps : video_path (bucket videos, <ws>/<démo>/<uuid>.webm), video_duration_ms (10 min au plus),
--    video (coupes, pauses-étapes, sous-titres, lecture, images des pauses) validé en base ;
--  * demos : device (desktop | mobile) et viewport ;
--  * bucket videos : privé, video/webm, 50 Mo par fichier (plan gratuit) ; quota de 500 Mo partagé
--    avec la médiathèque, vérifié quand une étape cite la vidéo ;
--  * publish_demo : VIDEO_MISSING, copie de la vidéo et des images de pause, manifeste step.video,
--    device et viewport ;
--  * public_page : chemin public du logo (bucket branding), autorisé par le chef.

-- ===== 1. Étape vidéo =====
create or replace function public.video_options_ok(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'object' and pg_column_size(v) <= 262144
    and not exists (select 1 from jsonb_object_keys(v) k
                    where k not in ('cuts', 'pauses', 'captions', 'captionsDefault', 'autoplayMuted', 'hasVoice', 'frames'))
    and (v -> 'captionsDefault' is null or jsonb_typeof(v -> 'captionsDefault') = 'boolean')
    and (v -> 'autoplayMuted' is null or jsonb_typeof(v -> 'autoplayMuted') = 'boolean')
    and (v -> 'hasVoice' is null or jsonb_typeof(v -> 'hasVoice') = 'boolean')
    and (v -> 'cuts' is null or (jsonb_typeof(v -> 'cuts') = 'array' and jsonb_array_length(v -> 'cuts') <= 50
         and not exists (select 1 from jsonb_array_elements(v -> 'cuts') c
           where jsonb_typeof(c -> 'from') <> 'number' or jsonb_typeof(c -> 'to') <> 'number'
              or (c ->> 'from')::numeric < 0 or (c ->> 'to')::numeric > 600000
              or (c ->> 'from')::numeric >= (c ->> 'to')::numeric)))
    and (v -> 'pauses' is null or (jsonb_typeof(v -> 'pauses') = 'array' and jsonb_array_length(v -> 'pauses') <= 50
         and not exists (select 1 from jsonb_array_elements(v -> 'pauses') p
           where jsonb_typeof(p -> 'id') <> 'string' or char_length(p ->> 'id') not between 1 and 40
              or jsonb_typeof(p -> 't') <> 'number' or (p ->> 't')::numeric not between 0 and 600000
              or char_length(coalesce(p ->> 'title', '')) > 200 or char_length(coalesce(p ->> 'body', '')) > 2000)))
    and (v -> 'captions' is null or (jsonb_typeof(v -> 'captions') = 'array' and jsonb_array_length(v -> 'captions') <= 500
         and not exists (select 1 from jsonb_array_elements(v -> 'captions') c
           where jsonb_typeof(c -> 'from') <> 'number' or jsonb_typeof(c -> 'to') <> 'number'
              or (c ->> 'from')::numeric < 0 or (c ->> 'to')::numeric > 600000
              or (c ->> 'from')::numeric >= (c ->> 'to')::numeric
              or jsonb_typeof(c -> 'text') <> 'string' or char_length(c ->> 'text') not between 1 and 200)))
    and (v -> 'frames' is null or (jsonb_typeof(v -> 'frames') = 'object'
         and (select count(*) from jsonb_object_keys(v -> 'frames')) <= 50
         and not exists (select 1 from jsonb_each(v -> 'frames') f
           where jsonb_typeof(f.value) <> 'string' or char_length(f.value #>> '{}') > 300)));
$$;

alter table public.steps add column if not exists video_path text;
alter table public.steps add column if not exists video_duration_ms int;
alter table public.steps add column if not exists video jsonb not null default '{}'::jsonb;
alter table public.steps drop constraint if exists steps_video_ok;
alter table public.steps add constraint steps_video_ok check (
  public.video_options_ok(video)
  and (video_duration_ms is null or video_duration_ms between 1 and 600000)
  and (video_path is null or video_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webm$'));

-- Vidéo et images des pauses rangées sous le dossier du workspace ; le fichier vidéo doit exister ;
-- quota de 500 Mo partagé avec la médiathèque (tailles réelles lues dans le stockage)
create or replace function public.steps_video_check()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_total bigint;
begin
  if new.video_path is not null and public.path_uuid(new.video_path, 1) is distinct from new.workspace_id then
    raise exception 'VIDEO_PATH' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_each(coalesce(new.video -> 'frames', '{}'::jsonb)) f
             where public.path_uuid(f.value #>> '{}', 1) is distinct from new.workspace_id) then
    raise exception 'VIDEO_PATH' using errcode = '23514';
  end if;
  if new.video_path is not null and (tg_op = 'INSERT' or new.video_path is distinct from old.video_path) then
    if not exists (select 1 from storage.objects o where o.bucket_id = 'videos' and o.name = new.video_path) then
      raise exception 'VIDEO_OBJECT_MISSING' using errcode = 'P0001';
    end if;
    select coalesce(sum((o.metadata ->> 'size')::bigint), 0) into v_total
      from storage.objects o where o.bucket_id in ('media', 'videos') and o.name like new.workspace_id::text || '/%';
    if v_total > 524288000 then raise exception 'MEDIA_QUOTA' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
revoke all on function public.steps_video_check() from public, anon, authenticated;
drop trigger if exists steps_video_check on public.steps;
create trigger steps_video_check before insert or update of video_path, video on public.steps
  for each row execute function public.steps_video_check();

-- ===== 2. Démo mobile =====
alter table public.demos add column if not exists device text not null default 'desktop';
alter table public.demos drop constraint if exists demos_device_check;
alter table public.demos add constraint demos_device_check check (device in ('desktop', 'mobile'));
alter table public.demos add column if not exists viewport jsonb;
alter table public.demos drop constraint if exists demos_viewport_check;
alter table public.demos add constraint demos_viewport_check check (viewport is null or (
  jsonb_typeof(viewport) = 'object'
  and jsonb_typeof(viewport -> 'w') = 'number' and jsonb_typeof(viewport -> 'h') = 'number'
  and (viewport ->> 'w')::numeric between 200 and 2000 and (viewport ->> 'h')::numeric between 200 and 2000
  and viewport - 'w' - 'h' = '{}'::jsonb));
grant update (device, viewport) on public.demos to authenticated;

-- ===== 3. Stockage =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 52428800, array['video/webm'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = array['video/webm'];
-- Les vidéos publiées sont copiées dans le bucket « published » (privé, URL signées par open-demo)
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['image/webp', 'image/png', 'image/jpeg', 'application/json', 'video/webm']
 where id = 'published';

drop policy if exists videos_select on storage.objects;
create policy videos_select on storage.objects for select to authenticated
  using (bucket_id = 'videos' and public.has_role(public.path_uuid(name, 1), 'viewer'));
drop policy if exists videos_insert on storage.objects;
create policy videos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and public.has_role(public.path_uuid(name, 1), 'editor'));
drop policy if exists videos_update on storage.objects;
create policy videos_update on storage.objects for update to authenticated
  using (bucket_id = 'videos' and public.has_role(public.path_uuid(name, 1), 'editor'));
drop policy if exists videos_delete on storage.objects;
create policy videos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and public.has_role(public.path_uuid(name, 1), 'editor'));

-- Occupation partagée (médiathèque + vidéos) : pied de la médiathèque et de l'éditeur vidéo
create or replace function public.media_used(p_ws uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o
          where o.bucket_id in ('media', 'videos') and o.name like p_ws::text || '/%');
end $$;
-- La médiathèque compte aussi les vidéos dans son quota
create or replace function public.media_files_check()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_size bigint;
  v_total bigint;
begin
  if public.path_uuid(new.path, 1) is distinct from new.workspace_id then
    raise exception 'MEDIA_PATH' using errcode = '23514';
  end if;
  select (o.metadata ->> 'size')::bigint into v_size
    from storage.objects o where o.bucket_id = 'media' and o.name = new.path;
  if v_size is null then raise exception 'MEDIA_OBJECT_MISSING' using errcode = 'P0001'; end if;
  new.size_bytes := v_size;
  perform 1 from public.workspaces where id = new.workspace_id for update;
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0) into v_total
    from storage.objects o where o.bucket_id in ('media', 'videos') and o.name like new.workspace_id::text || '/%';
  if v_total > 524288000 then raise exception 'MEDIA_QUOTA' using errcode = 'P0001'; end if;
  return new;
end $$;

-- ===== 4. Publication =====
-- publish_demo redéfinie à l'identique de 20261119130000_analytics_collecte.sql, avec la vidéo
-- (VIDEO_MISSING, step.video, copies) et device / viewport en plus.
create or replace function public.publish_demo(p_demo uuid, p_ack jsonb default null)
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
  v_ack jsonb;
  v_quiz jsonb;
  v_bad int;
  v_ba int;
  v_glossary jsonb;
  v_ab jsonb;
  v_video int;
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
        then 'assets/' || st.id || '-v-' || md5(st.video_path) || '.webm' end as video_pub_path
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
      'zoom', s.zoom,
      'cta', s.cta,
      'options', s.options - 'beforeAfter',
      'gateFormId', case when lead_forms then s.gate_form_id::text end,
      'hotspots', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', h.id::text, 'x', h.x, 'y', h.y, 'w', h.w, 'h', h.h,
          'title', h.title, 'body', h.body, 'placement', h.placement,
          'action', h.action, 'cta', h.cta, 'pulse', h.pulse,
          -- mode Spotlight réglé pour toute la démo : il s'impose à chaque hotspot
          'style', case when d.settings ->> 'mode' = 'spotlight' then 'spotlight' else h.style end
        ) order by h.position, h.created_at)
        from public.hotspots h where h.step_id = s.id), '[]'::jsonb)
    ) order by s.idx),
    coalesce(jsonb_agg(jsonb_build_object('from', s.image_path, 'to', p_demo::text || '/' || s.pub_path))
      filter (where s.pub_path is not null), '[]'::jsonb)
    || coalesce(jsonb_agg(jsonb_build_object('from', s.before_image_path, 'to', p_demo::text || '/' || s.before_pub_path))
      filter (where s.before_pub_path is not null), '[]'::jsonb)
    -- F7 : la vidéo (bucket videos, copiée telle quelle) et les images des pauses (bucket captures)
    || coalesce(jsonb_agg(jsonb_build_object('from', s.video_path, 'to', p_demo::text || '/' || s.video_pub_path,
                                             'bucket', 'videos'))
      filter (where s.video_pub_path is not null), '[]'::jsonb)
    || coalesce((select jsonb_agg(jsonb_build_object('from', f.value #>> '{}',
                    'to', p_demo::text || '/assets/' || s2.id || '-f-' || md5(f.value #>> '{}') || '.webp'))
                 from public.steps s2, jsonb_each(coalesce(s2.video -> 'frames', '{}'::jsonb)) f
                 where s2.demo_id = p_demo and s2.kind::text = 'video' and s2.video_path is not null), '[]'::jsonb)
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
    'trackUrl', null
  );

  insert into public.demo_versions (id, demo_id, workspace_id, number, manifest, published_by, public_ack)
  values (v_id, p_demo, d.workspace_id, v_number, v_manifest, (select auth.uid()), v_ack);

  return jsonb_build_object('versionId', v_id, 'number', v_number, 'manifest', v_manifest, 'copies', v_copies);
end $$;

revoke all on function public.publish_demo(uuid, jsonb) from public, anon;
grant execute on function public.publish_demo(uuid, jsonb) to authenticated;

-- ===== 5. Page publique : logo du workspace =====
-- public_page redéfinie à l'identique de 20261119140000_page_publique.sql, avec logoPath en plus.
create or replace function public.public_page(p_demo uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r record;
  v_mode text;
  v_last jsonb;
  v_center jsonb;
begin
  select d.id, d.title as demo_title, d.workspace_id, pg.title, pg.description, pg.cta_label, pg.cta_url, pg.style,
         pg.related, pg.indexable, w.name as ws_name, w.logo_path, w.settings as ws_settings, v.manifest, v.published_at
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
    -- Chemin public du logo (bucket branding) : autorisé par le chef même s'il contient l'id du workspace
    'logoPath', case when public.path_uuid(r.logo_path, 1) = r.workspace_id then r.logo_path end,
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
