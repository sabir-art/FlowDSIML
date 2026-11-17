-- FlowDSIML — F2 : quiz de validation (et sondages simples, même moteur). Idempotent, additif.
--  * quiz_questions : questions d'un module (choix unique, multiples, vrai/faux), réponses en jsonb
--    [{id, label, correct}] (2 à 6), explication, étape liée à revoir, points.
--  * demos.settings.quiz : {mode: quiz | survey, threshold 0–100, attempts 0 (illimité) – 5,
--    feedback: each | end, shuffle, required}.
--  * quiz_attempts : tentatives des visiteurs, score CALCULÉ CÔTÉ SERVEUR à partir du manifeste
--    publié (submit_quiz_attempt), nombre de tentatives contrôlé par visiteur.
--  * quiz_stats : statistiques par question (agrégats, lisibles par tout membre).
--  * publish_demo : ajoute « quiz » au manifeste et bloque la publication si une question est
--    invalide (QUIZ_INVALID:n). Corps identique à 20261117131100 sinon.
--  * duplicate_demo : copie les questions (étapes liées remappées). Corps identique à 131000 sinon.

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  demo_id uuid not null references public.demos (id) on delete cascade,
  position int not null default 0,
  type text not null default 'single' check (type in ('single', 'multiple', 'truefalse')),
  prompt text not null default '' check (char_length(prompt) <= 200),
  answers jsonb not null default '[]'::jsonb check (
    jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) <= 6 and pg_column_size(answers) < 4000),
  explanation text not null default '' check (char_length(explanation) <= 1000),
  step_id uuid references public.steps (id) on delete set null,
  points int not null default 1 check (points between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quiz_questions_demo_idx on public.quiz_questions (demo_id, position);

drop trigger if exists inherit_ws on public.quiz_questions;
create trigger inherit_ws before insert or update of demo_id on public.quiz_questions
  for each row execute function public.inherit_workspace_from_demo();
drop trigger if exists set_updated_at on public.quiz_questions;
create trigger set_updated_at before update on public.quiz_questions
  for each row execute function public.set_updated_at();

-- L'étape liée doit appartenir au même module
create or replace function public.quiz_questions_check_step() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.step_id is not null and not exists (select 1 from public.steps s where s.id = new.step_id and s.demo_id = new.demo_id) then
    raise exception 'STEP_NOT_IN_DEMO';
  end if;
  return new;
end $$;
revoke all on function public.quiz_questions_check_step() from public, anon, authenticated;
drop trigger if exists quiz_questions_check_step on public.quiz_questions;
create trigger quiz_questions_check_step before insert or update on public.quiz_questions
  for each row execute function public.quiz_questions_check_step();

alter table public.quiz_questions enable row level security;
revoke all on public.quiz_questions from anon;
grant select, insert, update, delete on public.quiz_questions to authenticated;
drop policy if exists quiz_questions_select on public.quiz_questions;
create policy quiz_questions_select on public.quiz_questions for select to authenticated
  using (public.has_role(workspace_id, 'viewer'));
drop policy if exists quiz_questions_insert on public.quiz_questions;
create policy quiz_questions_insert on public.quiz_questions for insert to authenticated
  with check (public.has_role(workspace_id, 'editor'));
drop policy if exists quiz_questions_update on public.quiz_questions;
create policy quiz_questions_update on public.quiz_questions for update to authenticated
  using (public.has_role(workspace_id, 'editor')) with check (public.has_role(workspace_id, 'editor'));
drop policy if exists quiz_questions_delete on public.quiz_questions;
create policy quiz_questions_delete on public.quiz_questions for delete to authenticated
  using (public.has_role(workspace_id, 'editor'));

-- Tentatives : données d'apprenants → lecture éditeur et plus ; écriture par submit_quiz_attempt.
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  demo_id uuid not null references public.demos (id) on delete cascade,
  version_id uuid not null references public.demo_versions (id) on delete cascade,
  link_id uuid references public.share_links (id) on delete set null,
  visitor_id text not null check (char_length(visitor_id) between 8 and 64),
  session_id text check (char_length(session_id) between 8 and 64),
  answers jsonb not null,
  correct int not null,
  total int not null,
  score int not null check (score between 0 and 100),
  passed boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists quiz_attempts_demo_idx on public.quiz_attempts (demo_id, created_at);
create index if not exists quiz_attempts_visitor_idx on public.quiz_attempts (demo_id, visitor_id);

alter table public.quiz_attempts enable row level security;
revoke all on public.quiz_attempts from anon, authenticated;
grant select on public.quiz_attempts to authenticated;
drop policy if exists quiz_attempts_select on public.quiz_attempts;
create policy quiz_attempts_select on public.quiz_attempts for select to authenticated
  using (public.has_role(workspace_id, 'editor'));

/**
 * Enregistre une tentative : le score est recalculé ici à partir du quiz de la version publiée
 * (le client n'est pas cru). Choix multiples : tout ou rien. Tentatives limitées par visiteur.
 * p_batch = {demoId, versionId, visitorId, sessionId?, linkToken?, answers: [{questionId, answerIds[]}]}
 */
create or replace function public.submit_quiz_attempt(p_batch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_demo uuid;
  v_version uuid;
  v_ws uuid;
  v_quiz jsonb;
  v_link uuid;
  v_visitor text := p_batch ->> 'visitorId';
  v_attempts int;
  v_used int;
  q jsonb;
  v_given jsonb;
  v_ok boolean;
  v_correct int := 0;
  v_points int := 0;
  v_total int := 0;
  v_score int;
  v_passed boolean;
  v_detail jsonb := '[]'::jsonb;
begin
  begin
    v_demo := (p_batch ->> 'demoId')::uuid;
    v_version := (p_batch ->> 'versionId')::uuid;
  exception when others then
    raise exception 'BAD_BATCH';
  end;
  if char_length(coalesce(v_visitor, '')) not between 8 and 64
     or jsonb_typeof(p_batch -> 'answers') <> 'array' or jsonb_array_length(p_batch -> 'answers') > 200 then
    raise exception 'BAD_BATCH';
  end if;

  select v.workspace_id, v.manifest -> 'quiz' into v_ws, v_quiz from public.demo_versions v
    join public.demos d on d.id = v.demo_id
    where v.id = v_version and v.demo_id = v_demo and d.status = 'published' and d.deleted_at is null;
  if v_ws is null or v_quiz is null or jsonb_typeof(v_quiz) <> 'object' then raise exception 'QUIZ_NOT_FOUND'; end if;

  -- Tentatives : 0 = illimitées (plafond anti-abus de 50 par jour et par visiteur)
  v_attempts := coalesce((v_quiz ->> 'attempts')::int, 3);
  select count(*) into v_used from public.quiz_attempts where demo_id = v_demo and visitor_id = v_visitor
    and (v_attempts > 0 or created_at > now() - interval '1 day');
  if (v_attempts > 0 and v_used >= v_attempts) or (v_attempts = 0 and v_used >= 50) then
    raise exception 'NO_ATTEMPTS_LEFT' using errcode = 'P0001';
  end if;

  for q in select * from jsonb_array_elements(v_quiz -> 'questions') loop
    v_total := v_total + coalesce((q ->> 'points')::int, 1);
    select coalesce(a -> 'answerIds', '[]'::jsonb) into v_given
      from jsonb_array_elements(p_batch -> 'answers') a where a ->> 'questionId' = q ->> 'id' limit 1;
    v_given := coalesce(v_given, '[]'::jsonb);
    -- Juste si l'ensemble coché = l'ensemble des bonnes réponses
    v_ok := jsonb_array_length(v_given) > 0 and not exists (
      select 1 from jsonb_array_elements(q -> 'answers') ans
      where coalesce((ans ->> 'correct')::boolean, false) <> (v_given ? (ans ->> 'id')))
      and not exists (
      select 1 from jsonb_array_elements_text(v_given) g
      where not exists (select 1 from jsonb_array_elements(q -> 'answers') ans where ans ->> 'id' = g));
    if v_ok then
      v_correct := v_correct + 1;
      v_points := v_points + coalesce((q ->> 'points')::int, 1);
    end if;
    v_detail := v_detail || jsonb_build_object('questionId', q ->> 'id', 'answerIds', v_given, 'correct', v_ok);
  end loop;

  v_score := case when v_total > 0 then round(100.0 * v_points / v_total)::int else 0 end;
  v_passed := v_quiz ->> 'mode' = 'survey' or v_score >= coalesce((v_quiz ->> 'threshold')::int, 70);

  if p_batch ->> 'linkToken' is not null then
    select id into v_link from public.share_links where token = p_batch ->> 'linkToken' and demo_id = v_demo;
  end if;
  insert into public.quiz_attempts (workspace_id, demo_id, version_id, link_id, visitor_id, session_id,
                                    answers, correct, total, score, passed)
  values (v_ws, v_demo, v_version, v_link, v_visitor, nullif(left(p_batch ->> 'sessionId', 64), ''),
          v_detail, v_correct, jsonb_array_length(v_quiz -> 'questions'), v_score, v_passed);

  return jsonb_build_object('score', v_score, 'correct', v_correct,
    'total', jsonb_array_length(v_quiz -> 'questions'), 'passed', v_passed,
    'attemptsLeft', case when v_attempts > 0 then v_attempts - v_used - 1 end, 'questions', v_detail);
end $$;
revoke all on function public.submit_quiz_attempt(jsonb) from public;
grant execute on function public.submit_quiz_attempt(jsonb) to anon, authenticated;

/** Statistiques du quiz d'un module (agrégats, aucune donnée nominative) : tout membre. */
create or replace function public.quiz_stats(p_demo uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws uuid;
  v_out jsonb;
begin
  select workspace_id into v_ws from public.demos where id = p_demo;
  if v_ws is null or not public.has_role(v_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  select jsonb_build_object(
    'attempts', (select count(*) from public.quiz_attempts where demo_id = p_demo),
    'visitors', (select count(distinct visitor_id) from public.quiz_attempts where demo_id = p_demo),
    'passRate', (select coalesce(avg(case when passed then 1.0 else 0 end), 0) from public.quiz_attempts where demo_id = p_demo),
    'avgScore', (select coalesce(round(avg(score)), 0) from public.quiz_attempts where demo_id = p_demo),
    'questions', coalesce((
      with per as (
        select a ->> 'questionId' as qid, coalesce((a ->> 'correct')::boolean, false) as ok, a -> 'answerIds' as ids
        from public.quiz_attempts t, jsonb_array_elements(t.answers) a where t.demo_id = p_demo
      ), q as (
        select qid, count(*) as answered, avg(case when ok then 1.0 else 0 end) as rate from per group by qid
      ), ch as (
        select qid, jsonb_object_agg(id, n) as choices
        from (select qid, g as id, count(*) as n from per, jsonb_array_elements_text(ids) g group by qid, g) z
        group by qid
      )
      select jsonb_agg(jsonb_build_object('questionId', q.qid, 'answered', q.answered, 'correctRate', q.rate,
                                          'choices', coalesce(ch.choices, '{}'::jsonb)) order by q.qid)
      from q left join ch on ch.qid = q.qid), '[]'::jsonb))
  into v_out;
  return v_out;
end $$;
revoke all on function public.quiz_stats(uuid) from public, anon;
grant execute on function public.quiz_stats(uuid) to authenticated;

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
    select row_number() over (order by s.position, s.created_at) as n, s.blurs, s.element_meta -> 'pii' as pii
    from public.steps s where s.demo_id = p_demo
  )
  select jsonb_build_object(
    'by', (select auth.uid()),
    'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'reviewed', true,
    'fictional', true,
    'blurred', coalesce(sum(
      case when jsonb_typeof(st.blurs) = 'array' then jsonb_array_length(st.blurs) else 0 end
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
      'options', s.options,
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
    'trackUrl', null
  );

  insert into public.demo_versions (id, demo_id, workspace_id, number, manifest, published_by, public_ack)
  values (v_id, p_demo, d.workspace_id, v_number, v_manifest, (select auth.uid()), v_ack);

  return jsonb_build_object('versionId', v_id, 'number', v_number, 'manifest', v_manifest, 'copies', v_copies);
end $$;

revoke all on function public.publish_demo(uuid, jsonb) from public, anon;
grant execute on function public.publish_demo(uuid, jsonb) to authenticated;

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
                            snapshot_path, title, body, zoom, blurs, gate_form_id, cta, page_url, page_title, element_meta, options)
    select m.new_id, v_new, d.workspace_id, s.position, mc.new_id, s.kind, s.image_path, s.image_width, s.image_height,
           s.snapshot_path, s.title, s.body, s.zoom, s.blurs, mf.new_id, s.cta, s.page_url, s.page_title, s.element_meta,
           -- les choix de parcours (F1) pointent vers les nouvelles étapes et les nouveaux chapitres
           case when jsonb_typeof(s.options -> 'choices') = 'array' then jsonb_set(s.options, '{choices}', coalesce((
             select jsonb_agg(case
               when c -> 'action' ->> 'type' = 'goto' then jsonb_set(c, '{action,stepId}', to_jsonb(coalesce(
                 (select g.new_id::text from _map g where g.old_id::text = c -> 'action' ->> 'stepId'), c -> 'action' ->> 'stepId')))
               when c -> 'action' ->> 'type' = 'chapter' then jsonb_set(c, '{action,chapterId}', to_jsonb(coalesce(
                 (select g.new_id::text from _map g where g.old_id::text = c -> 'action' ->> 'chapterId'), c -> 'action' ->> 'chapterId')))
               else c end order by ord)
             from jsonb_array_elements(s.options -> 'choices') with ordinality as x(c, ord)), '[]'::jsonb))
           else s.options end
    from public.steps s join _map m on m.old_id = s.id
    left join _map mc on mc.old_id = s.chapter_id
    left join _map mf on mf.old_id = s.gate_form_id;

  insert into public.hotspots (step_id, demo_id, workspace_id, x, y, w, h, title, body, placement, action, cta, pulse, position, style)
    select m.new_id, v_new, d.workspace_id, h.x, h.y, h.w, h.h, h.title, h.body, h.placement,
           -- les cibles "goto" pointent vers les nouvelles étapes
           case when h.action ->> 'type' = 'goto'
             then jsonb_build_object('type', 'goto', 'stepId', coalesce((select g.new_id::text from _map g where g.old_id::text = h.action ->> 'stepId'), h.action ->> 'stepId'))
             else h.action end,
           h.cta, h.pulse, h.position, h.style
    from public.hotspots h join _map m on m.old_id = h.step_id;

  -- F2 : questions du quiz, étapes liées remappées
  insert into public.quiz_questions (demo_id, workspace_id, position, type, prompt, answers, explanation, step_id, points)
    select v_new, d.workspace_id, q.position, q.type, q.prompt, q.answers, q.explanation, ms.new_id, q.points
    from public.quiz_questions q left join _map ms on ms.old_id = q.step_id
    where q.demo_id = p_demo;

  return v_new;
end $$;
