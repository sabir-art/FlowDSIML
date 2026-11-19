-- A8 (L20) : capture HTML, Sandbox, Demo Center. Schéma validé par le chef d'équipe :
--  * steps : html_path (bucket html, <ws>/<démo>/<uuid>.html), html_ops (opérations sélecteur +
--    action + valeur, validées), html_meta (titre, adresse, taille, viewport, liens repérés) ;
--  * bucket html : privé, text/html, 10 Mo ; aucune écriture par les clients : seule la fonction
--    html-ingest (second assainissement, clé de service) y dépose les pages ;
--  * demos : kind (guided | sandbox) et sandbox (départ, liaison automatique, clic non relié,
--    guide, pages clés) ;
--  * publish_demo : HTML_MISSING, copie de la page, manifeste step.html, kind et sandbox ;
--  * training_centers : type de centre (formation | démos), héros et bouton « Nous contacter » ;
--    center_payload renvoie les démos ouvertes pour un Demo Center (sans compte ni progression).
-- Rendu : iframe srcdoc sandbox="allow-scripts" sans allow-same-origin (origine opaque), validé.

-- ===== 1. Étape HTML =====
create or replace function public.html_ops_ok(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'array' and jsonb_array_length(v) <= 500
    and not exists (
      select 1 from jsonb_array_elements(v) o
      where jsonb_typeof(o) <> 'object'
         or exists (select 1 from jsonb_object_keys(o) k where k not in ('id', 'sel', 'op', 'value', 'before', 'scope', 'group'))
         or coalesce(o ->> 'id', '') !~ '^[A-Za-z0-9_-]{1,40}$'
         or jsonb_typeof(o -> 'sel') <> 'string' or char_length(o ->> 'sel') not between 1 and 500
         or coalesce(o ->> 'op', '') not in ('text', 'hide', 'blur', 'link', 'image', 'remove')
         or coalesce(o ->> 'scope', '') not in ('step', 'all')
         or (o -> 'group' is not null and coalesce(o ->> 'group', '') !~ '^[A-Za-z0-9_-]{1,40}$')
         or (o -> 'value' is not null and (jsonb_typeof(o -> 'value') <> 'string' or char_length(o ->> 'value') > 5000))
         or (o -> 'before' is not null and (jsonb_typeof(o -> 'before') <> 'string' or char_length(o ->> 'before') > 5000))
         or (o ->> 'op' in ('text', 'link', 'image') and jsonb_typeof(o -> 'value') is distinct from 'string')
         -- Lien : id d'étape ; image : fichier de la médiathèque ou des captures du workspace
         or (o ->> 'op' = 'link' and (o ->> 'value') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
         or (o ->> 'op' = 'image' and (o ->> 'value') !~ '^[0-9a-f-]{36}/[0-9A-Za-z/._-]{1,200}\.(webp|png|jpe?g|gif|svg)$'));
$$;

create or replace function public.html_meta_ok(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'object'
    and not exists (select 1 from jsonb_object_keys(v) k
                    where k not in ('title', 'url', 'bytes', 'viewport', 'links', 'blurred', 'canvases'))
    and (v -> 'title' is null or (jsonb_typeof(v -> 'title') = 'string' and char_length(v ->> 'title') <= 200))
    and (v -> 'url' is null or (jsonb_typeof(v -> 'url') = 'string' and char_length(v ->> 'url') <= 2000))
    and (v -> 'bytes' is null or (jsonb_typeof(v -> 'bytes') = 'number' and (v ->> 'bytes')::numeric between 0 and 10485760))
    and (v -> 'blurred' is null or jsonb_typeof(v -> 'blurred') = 'number')
    and (v -> 'canvases' is null or jsonb_typeof(v -> 'canvases') = 'number')
    and (v -> 'viewport' is null or (jsonb_typeof(v -> 'viewport') = 'object'
         and jsonb_typeof(v -> 'viewport' -> 'w') = 'number' and jsonb_typeof(v -> 'viewport' -> 'h') = 'number'
         and (v -> 'viewport') - 'w' - 'h' = '{}'::jsonb))
    and (v -> 'links' is null or (jsonb_typeof(v -> 'links') = 'array' and jsonb_array_length(v -> 'links') <= 300
         and not exists (select 1 from jsonb_array_elements(v -> 'links') l
                         where jsonb_typeof(l) <> 'object'
                            or exists (select 1 from jsonb_object_keys(l) k where k not in ('sel', 'href', 'label'))
                            or jsonb_typeof(l -> 'sel') <> 'string' or char_length(l ->> 'sel') not between 1 and 500
                            or coalesce(l ->> 'href', '') !~ '^https?://' or char_length(l ->> 'href') > 2000
                            or (l -> 'label' is not null and (jsonb_typeof(l -> 'label') <> 'string' or char_length(l ->> 'label') > 120)))));
$$;

alter table public.steps add column if not exists html_path text;
alter table public.steps add column if not exists html_ops jsonb not null default '[]'::jsonb;
alter table public.steps add column if not exists html_meta jsonb not null default '{}'::jsonb;
alter table public.steps drop constraint if exists steps_html_ok;
alter table public.steps add constraint steps_html_ok check (
  public.html_ops_ok(html_ops) and public.html_meta_ok(html_meta)
  and (html_path is null or html_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.html$'));

-- Page rangée sous le dossier du workspace et déposée par html-ingest ; images des opérations
-- prises dans le workspace
create or replace function public.steps_html_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.html_path is not null and public.path_uuid(new.html_path, 1) is distinct from new.workspace_id then
    raise exception 'HTML_PATH' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_array_elements(new.html_ops) o
             where o ->> 'op' = 'image' and public.path_uuid(o ->> 'value', 1) is distinct from new.workspace_id) then
    raise exception 'HTML_PATH' using errcode = '23514';
  end if;
  if new.html_path is not null and (tg_op = 'INSERT' or new.html_path is distinct from old.html_path) then
    if not exists (select 1 from storage.objects o where o.bucket_id = 'html' and o.name = new.html_path) then
      raise exception 'HTML_OBJECT_MISSING' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.steps_html_check() from public, anon, authenticated;
drop trigger if exists steps_html_check on public.steps;
create trigger steps_html_check before insert or update of html_path, html_ops on public.steps
  for each row execute function public.steps_html_check();

-- ===== 2. Sandbox =====
create or replace function public.sandbox_ok(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select v is null or (jsonb_typeof(v) = 'object'
    and not exists (select 1 from jsonb_object_keys(v) k where k not in ('start', 'autoLink', 'unlinked', 'guide', 'keyPages'))
    and (v -> 'start' is null or jsonb_typeof(v -> 'start') = 'null'
         or (v ->> 'start') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    and (v -> 'autoLink' is null or jsonb_typeof(v -> 'autoLink') = 'boolean')
    and (v -> 'guide' is null or jsonb_typeof(v -> 'guide') = 'boolean')
    and (v -> 'unlinked' is null or (v ->> 'unlinked') in ('toast', 'none', 'highlight'))
    and (v -> 'keyPages' is null or (jsonb_typeof(v -> 'keyPages') = 'array' and jsonb_array_length(v -> 'keyPages') <= 200
         and not exists (select 1 from jsonb_array_elements(v -> 'keyPages') k
                         where coalesce(k #>> '{}', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))));
$$;

alter table public.demos add column if not exists kind text not null default 'guided';
alter table public.demos drop constraint if exists demos_kind_check;
alter table public.demos add constraint demos_kind_check check (kind in ('guided', 'sandbox'));
alter table public.demos add column if not exists sandbox jsonb;
alter table public.demos drop constraint if exists demos_sandbox_check;
alter table public.demos add constraint demos_sandbox_check check (public.sandbox_ok(sandbox));
grant update (kind, sandbox) on public.demos to authenticated;

-- ===== 3. Stockage =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('html', 'html', false, 10485760, array['text/html'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['text/html'];
-- Les pages publiées sont copiées dans « published » (privé, URL signées par open-demo)
update storage.buckets
   set allowed_mime_types = array['image/webp', 'image/png', 'image/jpeg', 'application/json', 'video/webm', 'text/html']
 where id = 'published';

-- Lecture (éditeur) et suppression par le workspace ; aucune écriture : html-ingest seulement
drop policy if exists html_select on storage.objects;
create policy html_select on storage.objects for select to authenticated
  using (bucket_id = 'html' and public.has_role(public.path_uuid(name, 1), 'viewer'));
drop policy if exists html_delete on storage.objects;
create policy html_delete on storage.objects for delete to authenticated
  using (bucket_id = 'html' and public.has_role(public.path_uuid(name, 1), 'editor'));

-- ===== 4. Publication =====
-- publish_demo redéfinie à l'identique de 20261119150100_video_mobile.sql, avec les étapes HTML
-- (HTML_MISSING, step.html, copies) et kind / sandbox en plus.
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
  v_html int;
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
        then 'assets/' || st.id || '-h-' || md5(st.html_path) || '.html' end as html_pub_path
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
        'links', coalesce((select jsonb_agg(jsonb_build_object('sel', l ->> 'sel', 'href', l ->> 'href'))
                           from jsonb_array_elements(coalesce(s.html_meta -> 'links', '[]'::jsonb)) l), '[]'::jsonb)) end,
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
                            where exists (select 1 from public.steps t where t.demo_id = p_demo and t.id::text = k)), '[]'::jsonb)) end,
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

-- ===== 5. Demo Center =====
create or replace function public.center_draft_valid(d jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(d) = 'object'
    and not exists (
      select 1 from jsonb_object_keys(d) k
      where k not in ('title', 'intro', 'brand', 'accent', 'style', 'logoPath', 'help', 'indexable', 'a11y', 'a11yUrl',
                    'privacyUrl', 'paths', 'kind', 'heroTitle', 'heroSubtitle', 'cta'))
    and (d -> 'title' is null or (jsonb_typeof(d -> 'title') = 'string' and char_length(d ->> 'title') <= 120))
    and (d -> 'intro' is null or (jsonb_typeof(d -> 'intro') = 'string' and char_length(d ->> 'intro') <= 600))
    and (d -> 'brand' is null or (d ->> 'brand') ~ '^#[0-9a-fA-F]{6}$')
    and (d -> 'accent' is null or (d ->> 'accent') ~ '^#[0-9a-fA-F]{6}$')
    and (d -> 'style' is null or (d ->> 'style') in ('workspace', 'sober', 'dark', 'contrast'))
    and (d -> 'logoPath' is null or jsonb_typeof(d -> 'logoPath') = 'null'
         or (d ->> 'logoPath') ~ '^[0-9a-f-]{36}/center-logo-[0-9a-z]{4,24}\.(png|svg|webp)$')
    and (d -> 'help' is null or (jsonb_typeof(d -> 'help') = 'string' and char_length(d ->> 'help') <= 200
         and ((d ->> 'help') = '' or (d ->> 'help') ~ '^https://\S+$' or (d ->> 'help') ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')))
    and (d -> 'a11yUrl' is null or (jsonb_typeof(d -> 'a11yUrl') = 'string' and char_length(d ->> 'a11yUrl') <= 300
         and ((d ->> 'a11yUrl') = '' or (d ->> 'a11yUrl') ~ '^https://\S+$')))
    and (d -> 'privacyUrl' is null or (jsonb_typeof(d -> 'privacyUrl') = 'string' and char_length(d ->> 'privacyUrl') <= 300
         and ((d ->> 'privacyUrl') = '' or (d ->> 'privacyUrl') ~ '^https://\S+$')))
    and (d -> 'indexable' is null or jsonb_typeof(d -> 'indexable') = 'boolean')
    and (d -> 'a11y' is null or (d ->> 'a11y') in ('non_evalue', 'partiel', 'total'))
    and (d -> 'paths' is null or (
      jsonb_typeof(d -> 'paths') = 'array' and jsonb_array_length(d -> 'paths') <= 50
      and not exists (
        select 1 from jsonb_array_elements(d -> 'paths') p
        where jsonb_typeof(p) <> 'object'
           or (p ->> 'id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           or jsonb_typeof(p -> 'visible') <> 'boolean')))
    -- A8 : type de centre, héros, bouton « Nous contacter » (lien https ou formulaire de lead)
    and (d -> 'kind' is null or (d ->> 'kind') in ('training', 'demo'))
    and (d -> 'heroTitle' is null or (jsonb_typeof(d -> 'heroTitle') = 'string' and char_length(d ->> 'heroTitle') <= 120))
    and (d -> 'heroSubtitle' is null or (jsonb_typeof(d -> 'heroSubtitle') = 'string' and char_length(d ->> 'heroSubtitle') <= 240))
    and (d -> 'cta' is null or jsonb_typeof(d -> 'cta') = 'null' or (
      jsonb_typeof(d -> 'cta') = 'object'
      and not exists (select 1 from jsonb_object_keys(d -> 'cta') k where k not in ('label', 'url', 'formId'))
      and jsonb_typeof(d -> 'cta' -> 'label') = 'string' and char_length(d -> 'cta' ->> 'label') between 1 and 40
      and ((d -> 'cta' ->> 'url') ~ '^https://\S+$' and char_length(d -> 'cta' ->> 'url') <= 300 and d -> 'cta' -> 'formId' is null
           or (d -> 'cta' ->> 'formId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and d -> 'cta' -> 'url' is null)));
$$;

-- Démos d'un Demo Center : publiées, liens publics ouverts (ni mot de passe ni expiration passée).
-- Type et nombre d'étapes ou de pages, étiquettes, dossier (section) ; aucune durée.
create or replace function public.center_demos(p_ws uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'demoId', d.id, 'title', d.title,
      'kind', d.kind,
      'steps', coalesce(jsonb_array_length(v.manifest -> 'steps'), 0),
      'section', f.name,
      'tags', (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'color', t.color) order by t.name), '[]'::jsonb)
               from public.demo_tags dt join public.tags t on t.id = dt.tag_id where dt.demo_id = d.id),
      'cover', case when (v.manifest -> 'steps' -> 0 -> 'image' ->> 'url') ~ '^assets/[\w.-]+$'
                    then v.manifest -> 'steps' -> 0 -> 'image' ->> 'url' end
    ) order by f.name nulls last, d.title), '[]'::jsonb)
  from public.demos d
  join public.demo_versions v on v.id = d.current_version_id
  left join public.folders f on f.id = d.folder_id
  left join public.demo_access a on a.demo_id = d.id
  where d.workspace_id = p_ws and d.status = 'published' and d.deleted_at is null
    and (a.demo_id is null or (a.mode = 'link' and (a.expires_at is null or a.expires_at > now())));
$$;
revoke all on function public.center_demos(uuid) from public, anon, authenticated;

-- center_payload redéfinie à l'identique de 20261118140000_centre_nom_connu.sql, avec le type de
-- centre, le héros, le bouton et la liste des démos d'un Demo Center en plus.
create or replace function public.center_payload(p_ws uuid, p_link_token text, p_visitor text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.training_centers;
  v_link public.share_links;
  l public.learners;
  v_first text;
  v_learner uuid;
begin
  select * into c from public.training_centers where workspace_id = p_ws;
  if c.published ->> 'kind' = 'demo' then
    p_link_token := null;
    p_visitor := null;
  end if;
  -- Visiteur identifié : lien personnel actif, non expiré, sur une démo publiée du workspace
  if p_link_token is not null and char_length(p_link_token) between 8 and 128 then
    select sl.* into v_link from public.share_links sl join public.demos d on d.id = sl.demo_id
     where sl.token = p_link_token and sl.workspace_id = p_ws and sl.is_active
       and (sl.expires_at is null or sl.expires_at > now())
       and d.status = 'published' and d.deleted_at is null;
    if found then
      select * into l from public.learners where share_link_id = v_link.id;
      if found then
        v_learner := l.id;
        v_first := coalesce(nullif(btrim(v_link.variables ->> 'first_name'), ''), split_part(btrim(l.full_name), ' ', 1));
        -- Les modules ouverts depuis le centre comptent pour cet apprenant (le lien prime sur un formulaire)
        if p_visitor is not null and char_length(p_visitor) between 8 and 64 then
          perform public.learner_attach_visitor(p_ws, p_visitor, l.id, true);
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'center', jsonb_build_object(
      'title', coalesce(c.published ->> 'title', ''),
      'intro', coalesce(c.published ->> 'intro', ''),
      'brand', c.published ->> 'brand', 'accent', c.published ->> 'accent',
      'style', coalesce(c.published ->> 'style', 'workspace'),
      'logoPath', c.published ->> 'logoPath',
      'help', coalesce(c.published ->> 'help', ''),
      'a11y', coalesce(c.published ->> 'a11y', 'non_evalue'),
      'a11yUrl', coalesce(c.published ->> 'a11yUrl', ''),
      'privacyUrl', coalesce(c.published ->> 'privacyUrl', ''),
      'indexable', coalesce((c.published ->> 'indexable')::boolean, false),
      'workspace', (select name from public.workspaces where id = p_ws),
      -- A8 : type de centre, héros et bouton « Nous contacter » (Demo Center)
      'kind', coalesce(c.published ->> 'kind', 'training'),
      'heroTitle', coalesce(c.published ->> 'heroTitle', ''),
      'heroSubtitle', coalesce(c.published ->> 'heroSubtitle', ''),
      'cta', case when jsonb_typeof(c.published -> 'cta') = 'object' then c.published -> 'cta' end),
    -- A8 : Demo Center : démos publiées ouvertes (sans compte ni progression), sinon null
    'demos', case when c.published ->> 'kind' = 'demo' then public.center_demos(p_ws) end,
    'visitor', case when v_learner is not null then jsonb_build_object(
        'firstName', left(coalesce(v_first, ''), 60),
        -- Nom connu pour l'attestation (même règle qu'issue_certificate) : booléen seul, aucun nom ne sort
        'hasName', nullif(btrim(l.full_name), '') is not null
                   or nullif(btrim(concat_ws(' ', nullif(btrim(v_link.variables ->> 'first_name'), ''),
                                                  nullif(btrim(v_link.variables ->> 'last_name'), ''))), '') is not null) end,
    'paths', case when c.published ->> 'kind' = 'demo' then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title, 'description', p.description, 'ordered', p.ordered,
        'isNew', coalesce((c.path_first_published ->> p.id::text)::timestamptz > now() - interval '30 days', false),
        'tags', (select coalesce(jsonb_agg(distinct jsonb_build_object('name', t.name, 'color', t.color)), '[]'::jsonb)
                 from public.path_modules m join public.demos d on d.id = m.demo_id
                 join public.demo_tags dt on dt.demo_id = d.id join public.tags t on t.id = dt.tag_id
                 where m.path_id = p.id and d.status = 'published' and d.deleted_at is null),
        'modules', (select coalesce(jsonb_agg(jsonb_build_object(
            'demoId', d.id, 'title', d.title, 'required', m.required,
            'steps', coalesce(jsonb_array_length(v.manifest -> 'steps'), 0),
            'hasQuiz', jsonb_typeof(v.manifest -> 'quiz') = 'object' and v.manifest -> 'quiz' ->> 'mode' is distinct from 'survey',
            'access', case when a.expires_at is not null and a.expires_at <= now() then 'expired'
                           when a.mode = 'password' then 'password'
                           when a.mode in ('invite', 'domain') then 'password'
                           else 'open' end,
            -- Couverture : capture de l'étape 1, seulement pour un module ouvert (signée par open-center)
            'cover', case when (a.demo_id is null or (a.mode = 'link' and (a.expires_at is null or a.expires_at > now())))
                               and (v.manifest -> 'steps' -> 0 -> 'image' ->> 'url') ~ '^assets/[\w.-]+$'
                          then v.manifest -> 'steps' -> 0 -> 'image' ->> 'url' end,
            -- Date d'expiration L11 (« plus disponible depuis le … ») et meilleur score de l'apprenant
            'expiredAt', case when a.expires_at is not null and a.expires_at <= now() then a.expires_at end,
            'best', case when lm.has_quiz then lm.best_score end,
            'status', lm.status, 'seen', lm.steps_seen, 'total', lm.total_steps
          ) order by m.position), '[]'::jsonb)
          from public.path_modules m
          join public.demos d on d.id = m.demo_id and d.status = 'published' and d.deleted_at is null
          left join public.demo_versions v on v.id = d.current_version_id
          left join public.demo_access a on a.demo_id = d.id
          left join public.learner_modules(p_ws) lm on v_learner is not null and lm.learner_id = v_learner and lm.demo_id = d.id
          where m.path_id = p.id)
      ) order by vp.ord), '[]'::jsonb)
      from public.center_visible_paths(p_ws, c.published) vp
      join public.paths p on p.id = vp.path_id) end
  );
end $$;
revoke all on function public.center_payload(uuid, text, text) from public, anon, authenticated;

-- publish_center redéfinie à l'identique de 20261118120000_centre_formation.sql : un Demo Center
-- se publie avec au moins une démo ouverte (et non une formation) ; formulaire du bouton pris dans
-- le workspace.
create or replace function public.publish_center(p_ws uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  c public.training_centers;
  seen jsonb;
begin
  if not public.has_role(p_ws, 'admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into c from public.training_centers where workspace_id = p_ws for update;
  if not found then raise exception 'NO_VISIBLE_PATH' using errcode = 'P0001'; end if;
  if not (select public_links_enabled from public.workspaces where id = p_ws) then
    raise exception 'PUBLIC_DISABLED' using errcode = 'P0001';
  end if;
  if c.draft ->> 'kind' = 'demo' then
    if jsonb_array_length(public.center_demos(p_ws)) = 0 then
      raise exception 'NO_VISIBLE_DEMO' using errcode = 'P0001';
    end if;
    if (c.draft -> 'cta' ->> 'formId') is not null and not exists (
      select 1 from public.forms f where f.id::text = c.draft -> 'cta' ->> 'formId' and f.workspace_id = p_ws) then
      raise exception 'CTA_FORM' using errcode = 'P0001';
    end if;
  elsif not exists (select 1 from public.center_visible_paths(p_ws, c.draft)) then
    raise exception 'NO_VISIBLE_PATH' using errcode = 'P0001';
  end if;
  seen := c.path_first_published || coalesce((
    select jsonb_object_agg(v.path_id::text, to_jsonb(now()))
    from public.center_visible_paths(p_ws, c.draft) v
    where not c.path_first_published ? v.path_id::text), '{}'::jsonb);
  update public.training_centers
     set published = c.draft, published_at = now(), path_first_published = seen,
         updated_at = now(), updated_by = (select auth.uid())
   where workspace_id = p_ws;
  return now();
end $$;
