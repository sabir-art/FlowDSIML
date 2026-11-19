-- L18 (A2 éditeur avancé) : test A/B et médiathèque. Schéma validé par le chef d'équipe, avec ses
-- conditions : médiathèque limitée par le bucket (5 Mo, types), quota calculé depuis storage.objects,
-- suppression de l'objet avec la ligne (par la fonction media, rôle service) ; SVG assaini côté serveur
-- (Edge Function media) et affiché seulement en <img> ou en fond CSS ; variante B rendue et échappée
-- comme la bulle A (même chemin dans le lecteur). Les styles prédéfinis n'ont pas de migration.

-- ===== 1. Test A/B =====
create table if not exists public.ab_tests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  demo_id uuid not null references public.demos (id) on delete cascade,
  step_id uuid not null references public.steps (id) on delete cascade,
  hotspot_id uuid references public.hotspots (id) on delete set null,
  status text not null default 'running' check (status in ('running', 'ended', 'stopped')),
  split_b int not null default 50 check (split_b between 10 and 90 and split_b % 10 = 0),
  goal text not null default 'completion' check (goal in ('completion', 'cta', 'lead')),
  label_b text not null default '' check (char_length(label_b) <= 40),
  variant_b jsonb not null default '{}'::jsonb check (
    jsonb_typeof(variant_b) = 'object'
    and char_length(coalesce(variant_b ->> 'title', '')) <= 200
    and char_length(coalesce(variant_b ->> 'body', '')) <= 4000
    and (not variant_b ? 'cta' or jsonb_typeof(variant_b -> 'cta') in ('object', 'null'))
    and pg_column_size(variant_b) <= 16384),
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array' and jsonb_array_length(history) <= 100),
  kept text check (kept in ('A', 'B')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid()
);
create unique index if not exists ab_tests_running_uq on public.ab_tests (demo_id) where status = 'running';
create index if not exists ab_tests_demo_idx on public.ab_tests (demo_id, started_at desc);

alter table public.ab_tests enable row level security;
drop policy if exists ab_select on public.ab_tests;
create policy ab_select on public.ab_tests for select to authenticated using (public.has_role(workspace_id, 'viewer'));
revoke insert, update, delete on public.ab_tests from authenticated, anon;
grant select on public.ab_tests to authenticated;

-- Créer la variante B d'une bulle : titre, texte et bouton copiés ; capture partagée
create or replace function public.ab_start(p_hotspot uuid, p_label text default 'Variante B')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  h public.hotspots;
  s public.steps;
  v_n int;
  v_id uuid;
begin
  select * into h from public.hotspots where id = p_hotspot;
  if h.id is null or not public.has_role(h.workspace_id, 'editor') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  select * into s from public.steps where id = h.step_id;
  if s.kind <> 'image' or s.image_path is null then raise exception 'AB_STEP_KIND' using errcode = 'P0001'; end if;
  perform 1 from public.demos where id = s.demo_id for update;
  select n into v_n from (
    select row_number() over (order by st.position, st.created_at) as n, st.id
    from public.steps st where st.demo_id = s.demo_id
  ) x join public.ab_tests t on t.step_id = x.id and t.status = 'running';
  if v_n is not null then raise exception 'AB_ALREADY_RUNNING:%', v_n using errcode = 'P0001'; end if;
  insert into public.ab_tests (workspace_id, demo_id, step_id, hotspot_id, label_b, variant_b)
  values (h.workspace_id, s.demo_id, s.id, h.id, left(coalesce(nullif(btrim(p_label), ''), 'Variante B'), 40),
          jsonb_build_object('title', h.title, 'body', h.body, 'cta', h.cta))
  returning id into v_id;
  update public.demos set updated_at = now() where id = s.demo_id;
  return v_id;
end $$;

-- Modifier B (horodaté dans l'historique), la répartition, l'objectif ou le libellé
create or replace function public.ab_update(p_test uuid, p_label text default null, p_b jsonb default null,
                                            p_split int default null, p_goal text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  t public.ab_tests;
  v_fields text[] := '{}';
  v_b jsonb;
begin
  select * into t from public.ab_tests where id = p_test for update;
  if t.id is null or not public.has_role(t.workspace_id, 'editor') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if t.status <> 'running' then raise exception 'AB_NOT_RUNNING' using errcode = 'P0001'; end if;
  if p_b is not null then
    if jsonb_typeof(p_b) <> 'object' then raise exception 'AB_BAD_VARIANT' using errcode = 'P0001'; end if;
    v_b := t.variant_b;
    if p_b ? 'title' then v_b := jsonb_set(v_b, '{title}', to_jsonb(coalesce(p_b ->> 'title', ''))); v_fields := array_append(v_fields, 'title'); end if;
    if p_b ? 'body' then v_b := jsonb_set(v_b, '{body}', to_jsonb(coalesce(p_b ->> 'body', ''))); v_fields := array_append(v_fields, 'body'); end if;
    if p_b ? 'cta' then v_b := jsonb_set(v_b, '{cta}', coalesce(p_b -> 'cta', 'null'::jsonb)); v_fields := array_append(v_fields, 'cta'); end if;
  end if;
  update public.ab_tests set
    variant_b = coalesce(v_b, variant_b),
    label_b = coalesce(left(nullif(btrim(p_label), ''), 40), label_b),
    split_b = coalesce(p_split, split_b),
    goal = coalesce(p_goal, goal),
    -- 100 entrées au plus : les plus anciennes sortent
    history = case when cardinality(v_fields) > 0 then
      (select jsonb_agg(x.e order by x.i) from jsonb_array_elements(
         history || jsonb_build_array(jsonb_build_object('at', now(), 'by', (select auth.uid()), 'fields', to_jsonb(v_fields))))
         with ordinality as x(e, i)
       where x.i > jsonb_array_length(history) + 1 - 100)
      else history end
  where id = p_test;
  if v_b is not null or p_split is not null then
    update public.demos set updated_at = now() where id = t.demo_id;
  end if;
end $$;

-- Terminer : garder B (recopié dans la bulle) ou A ; sans choix, arrêter (les visiteurs revoient A)
create or replace function public.ab_end(p_test uuid, p_keep text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  t public.ab_tests;
begin
  select * into t from public.ab_tests where id = p_test for update;
  if t.id is null or not public.has_role(t.workspace_id, 'editor') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if t.status <> 'running' then raise exception 'AB_NOT_RUNNING' using errcode = 'P0001'; end if;
  if p_keep is not null and p_keep not in ('A', 'B') then raise exception 'AB_BAD_KEEP' using errcode = 'P0001'; end if;
  if p_keep = 'B' and t.hotspot_id is not null then
    update public.hotspots set
      title = left(coalesce(t.variant_b ->> 'title', ''), 200),
      body = left(coalesce(t.variant_b ->> 'body', ''), 4000),
      cta = case when jsonb_typeof(t.variant_b -> 'cta') = 'object' then t.variant_b -> 'cta' end
    where id = t.hotspot_id;
  end if;
  update public.ab_tests set status = case when p_keep is null then 'stopped' else 'ended' end,
    kept = p_keep, ended_at = now() where id = p_test;
  update public.demos set updated_at = now() where id = t.demo_id;
end $$;

-- Résultats par variante : visiteurs distincts et valeur de l'objectif (événements marqués abt / abv)
create or replace function public.ab_results(p_test uuid, p_goal text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  t public.ab_tests;
  v_goal text;
begin
  select * into t from public.ab_tests where id = p_test;
  if t.id is null or not public.has_role(t.workspace_id, 'viewer') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  v_goal := coalesce(p_goal, t.goal);
  if v_goal not in ('completion', 'cta', 'lead') then raise exception 'AB_BAD_GOAL' using errcode = 'P0001'; end if;
  return (
    with ev as (
      select e.visitor_id, e.props ->> 'abv' as v, e.type
      from public.events e
      where e.demo_id = t.demo_id and e.props ->> 'abt' = t.id::text and e.props ->> 'abv' in ('A', 'B')
        and e.occurred_at >= t.started_at and (t.ended_at is null or e.occurred_at <= t.ended_at)
    ), per as (
      select v, count(distinct visitor_id) as visitors,
        count(distinct visitor_id) filter (where type = case v_goal
          when 'completion' then 'demo_complete' when 'cta' then 'cta_click' else 'form_submit' end) as reached
      from ev group by v
    )
    select jsonb_build_object('goal', v_goal,
      'A', coalesce((select jsonb_build_object('visitors', visitors, 'reached', reached) from per where v = 'A'),
                    '{"visitors": 0, "reached": 0}'::jsonb),
      'B', coalesce((select jsonb_build_object('visitors', visitors, 'reached', reached) from per where v = 'B'),
                    '{"visitors": 0, "reached": 0}'::jsonb))
  );
end $$;

revoke all on function public.ab_start(uuid, text) from public, anon;
revoke all on function public.ab_update(uuid, text, jsonb, int, text) from public, anon;
revoke all on function public.ab_end(uuid, text) from public, anon;
revoke all on function public.ab_results(uuid, text) from public, anon;
grant execute on function public.ab_start(uuid, text) to authenticated;
grant execute on function public.ab_update(uuid, text, jsonb, int, text) to authenticated;
grant execute on function public.ab_end(uuid, text) to authenticated;
grant execute on function public.ab_results(uuid, text) to authenticated;

-- ===== 2. Médiathèque =====
-- Bucket public en lecture (logos et polices lus par le lecteur publié), chemins non devinables
-- <workspace>/<uuid>.<ext>. Aucune écriture directe : la fonction media (rôle service) contrôle le type
-- réel, assainit les SVG, applique le quota et supprime l'objet avec sa ligne.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/png', 'image/jpeg', 'image/svg+xml', 'font/woff2'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.media_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('logo', 'image', 'font')),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  path text not null unique,
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/svg+xml', 'font/woff2')),
  size_bytes bigint not null default 0,
  width int check (width is null or width between 1 and 20000),
  height int check (height is null or height between 1 and 20000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (public.path_uuid(path, 1) = workspace_id),
  check ((kind = 'font') = (mime = 'font/woff2'))
);
create index if not exists media_files_ws_idx on public.media_files (workspace_id, created_at desc);

alter table public.media_files enable row level security;
drop policy if exists media_select on public.media_files;
create policy media_select on public.media_files for select to authenticated using (public.has_role(workspace_id, 'viewer'));
revoke insert, update, delete on public.media_files from authenticated, anon;
grant select on public.media_files to authenticated;

-- Taille réelle lue dans storage.objects (jamais celle annoncée par le client) et quota de 500 Mo
create or replace function public.media_files_check()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_size bigint;
  v_total bigint;
begin
  -- Chemin sous le dossier du workspace (contrôlé avant de lire le stockage)
  if public.path_uuid(new.path, 1) is distinct from new.workspace_id then
    raise exception 'MEDIA_PATH' using errcode = '23514';
  end if;
  select (o.metadata ->> 'size')::bigint into v_size
    from storage.objects o where o.bucket_id = 'media' and o.name = new.path;
  if v_size is null then raise exception 'MEDIA_OBJECT_MISSING' using errcode = 'P0001'; end if;
  new.size_bytes := v_size;
  perform 1 from public.workspaces where id = new.workspace_id for update;
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0) into v_total
    from storage.objects o where o.bucket_id = 'media' and o.name like new.workspace_id::text || '/%';
  if v_total > 524288000 then raise exception 'MEDIA_QUOTA' using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists media_files_check on public.media_files;
create trigger media_files_check before insert on public.media_files
  for each row execute function public.media_files_check();

-- Occupation de la médiathèque (octets réels) : pied de la modale « n Mo sur 500 Mo »
create or replace function public.media_used(p_ws uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o
          where o.bucket_id = 'media' and o.name like p_ws::text || '/%');
end $$;

-- « Utilisé dans n démos » : démos (non supprimées) dont les réglages ou les étapes citent le fichier
create or replace function public.media_usage(p_ws uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'demos', (
      select count(*) from public.demos d
      where d.workspace_id = p_ws and d.deleted_at is null
        and (strpos(d.settings::text, m.path) > 0
             or exists (select 1 from public.steps s where s.demo_id = d.id and strpos(s.options::text, m.path) > 0)))))
    from public.media_files m where m.workspace_id = p_ws), '[]'::jsonb);
end $$;
revoke all on function public.media_used(uuid) from public, anon;
revoke all on function public.media_usage(uuid) from public, anon;
grant execute on function public.media_used(uuid) to authenticated;
grant execute on function public.media_usage(uuid) to authenticated;
revoke all on function public.media_files_check() from public, anon, authenticated;

-- ===== 3. Publication : test A/B en cours =====
-- publish_demo redéfinie à l'identique de 20261119110100_formation_plus.sql, avec « ab ».
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

  -- F2 : quiz du module (après la dernière étape). Publication bloquée tant qu'une question est invalide.
  select min(n) into v_bad from (
    select row_number() over (order by q.position, q.created_at) as n, q.*
    from public.quiz_questions q where q.demo_id = p_demo
  ) x
  where btrim(x.prompt) = '' or jsonb_array_length(x.answers) < 2
     or exists (select 1 from jsonb_array_elements(x.answers) a where btrim(coalesce(a ->> 'label', '')) = '')
     or (coalesce(d.settings -> 'quiz' ->> 'mode', 'quiz') = 'quiz'
         and not exists (select 1 from jsonb_array_elements(x.answers) a where coalesce((a ->> 'correct')::boolean, false)));
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
        then 'assets/' || st.id || '-b-' || md5(st.before_image_path) || '.webp' end as before_pub_path
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
