-- L19 (A4, analytics avancées) partie 1 : collecte et sondages. Schéma validé par le chef d'équipe.
--  * events : appareil décrit par le lecteur (type, familles de navigateur et de système, langue), pays
--    lu par la fonction track dans l'en-tête cf-ipcountry (code à 2 lettres, jamais l'IP) ;
--  * quiz en mode Sondage : note de 0 à 10 (nps) et réponse écrite (text, 500 caractères), rangée dans
--    survey_text_answers, lisible par les éditeurs seulement, effacée avec la démo et l'apprenant ;
--  * survey_results (viewer) et survey_texts (editor) ; choice_results (menus de choix).

-- ===== 1. Appareil et pays =====
alter table public.events add column if not exists device text;
alter table public.events add column if not exists browser text;
alter table public.events add column if not exists os text;
alter table public.events add column if not exists lang text;
alter table public.events add column if not exists country text;

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
                             device, browser, os, lang, country)
  select v_ws, v_demo, v_version, v_link,
         p_batch ->> 'visitorId', p_batch ->> 'sessionId', e ->> 'type',
         left(e ->> 'stepId', 64), nullif(e ->> 'stepIndex', '')::int, left(e ->> 'hotspotId', 64),
         case when jsonb_typeof(e -> 'props') = 'object' and pg_column_size(e -> 'props') < 2000 then e -> 'props' else '{}'::jsonb end,
         left(substring(p_batch ->> 'referrer' from '^[a-z]+://([^/:?#]+)'), 200),
         left(p_batch ->> 'embedOrigin', 300),
         v_device, v_browser, v_os, v_lang, v_country
  from jsonb_array_elements(p_batch -> 'events') e
  where e ->> 'type' = any (allowed);
  get diagnostics n = row_count;
  return n;
end $$;

-- ===== 2. Sondages : note de 0 à 10 et réponse écrite =====
alter table public.quiz_questions drop constraint if exists quiz_questions_type_check;
alter table public.quiz_questions add constraint quiz_questions_type_check
  check (type in ('single', 'multiple', 'truefalse', 'nps', 'text'));

create table if not exists public.survey_text_answers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  demo_id uuid not null references public.demos (id) on delete cascade,
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id text not null,
  visitor_id text not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists survey_text_demo_idx on public.survey_text_answers (demo_id, created_at desc);
create index if not exists survey_text_visitor_idx on public.survey_text_answers (workspace_id, visitor_id);
alter table public.survey_text_answers enable row level security;
drop policy if exists survey_text_select on public.survey_text_answers;
create policy survey_text_select on public.survey_text_answers for select to authenticated
  using (public.has_role(workspace_id, 'editor'));
revoke all on public.survey_text_answers from anon;
revoke insert, update, delete on public.survey_text_answers from authenticated;
grant select on public.survey_text_answers to authenticated;

-- Effacement d'un apprenant (erase_learner, cascade sur learner_visitors) : ses réponses écrites partent aussi
create or replace function public.survey_text_erase_visitor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.survey_text_answers where workspace_id = old.workspace_id and visitor_id = old.visitor_id;
  return old;
end $$;
drop trigger if exists survey_text_erase_visitor on public.learner_visitors;
create trigger survey_text_erase_visitor after delete on public.learner_visitors
  for each row execute function public.survey_text_erase_visitor();
revoke all on function public.survey_text_erase_visitor() from public, anon, authenticated;

create or replace function public.submit_quiz_attempt(p_batch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_demo uuid;
  v_version uuid;
  v_ws uuid;
  v_quiz jsonb;
  v_link uuid;
  v_visitor text := p_batch ->> 'visitorId';
  v_learner uuid;
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
  v_texts jsonb := '[]'::jsonb;
  v_val int;
  v_txt text;
  v_attempt uuid := gen_random_uuid();
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

  -- Tentatives : 0 = illimitées (plafond anti-abus de 50 par jour et par visiteur).
  -- L13 : pour un apprenant identifié, tentatives comptées sur tous ses visiteurs, plus celles accordées.
  v_attempts := coalesce((v_quiz ->> 'attempts')::int, 3);
  select learner_id into v_learner from public.learner_visitors where workspace_id = v_ws and visitor_id = v_visitor;
  if v_learner is not null and v_attempts > 0 then
    v_attempts := v_attempts + coalesce((select extra_attempts from public.learner_overrides
                                         where learner_id = v_learner and demo_id = v_demo), 0);
    select count(*) into v_used from public.quiz_attempts q
      join public.learner_visitors lv on lv.workspace_id = q.workspace_id and lv.visitor_id = q.visitor_id
      where q.demo_id = v_demo and lv.learner_id = v_learner;
  else
    select count(*) into v_used from public.quiz_attempts where demo_id = v_demo and visitor_id = v_visitor
      and (v_attempts > 0 or created_at > now() - interval '1 day');
  end if;
  if (v_attempts > 0 and v_used >= v_attempts) or (v_attempts = 0 and v_used >= 50) then
    raise exception 'NO_ATTEMPTS_LEFT' using errcode = 'P0001';
  end if;

  for q in select * from jsonb_array_elements(v_quiz -> 'questions') loop
    -- L19 : note de 0 à 10 (nps) et réponse écrite (text) : jamais notées ; le texte est rangé à part
    -- (lisible par les éditeurs seulement), jamais dans quiz_attempts
    if q ->> 'type' = 'nps' then
      select case when (a ->> 'value') ~ '^\d{1,2}$' and (a ->> 'value')::int between 0 and 10 then (a ->> 'value')::int end
        into v_val from jsonb_array_elements(p_batch -> 'answers') a where a ->> 'questionId' = q ->> 'id' limit 1;
      v_detail := v_detail || jsonb_build_object('questionId', q ->> 'id', 'value', v_val);
      v_val := null;
      continue;
    end if;
    if q ->> 'type' = 'text' then
      select left(btrim(a ->> 'text'), 500) into v_txt
        from jsonb_array_elements(p_batch -> 'answers') a where a ->> 'questionId' = q ->> 'id' limit 1;
      if coalesce(v_txt, '') <> '' then
        v_texts := v_texts || jsonb_build_object('questionId', q ->> 'id', 'text', v_txt);
      end if;
      v_detail := v_detail || jsonb_build_object('questionId', q ->> 'id', 'answered', coalesce(v_txt, '') <> '');
      v_txt := null;
      continue;
    end if;
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
  insert into public.quiz_attempts (id, workspace_id, demo_id, version_id, link_id, visitor_id, session_id,
                                    answers, correct, total, score, passed)
  values (v_attempt, v_ws, v_demo, v_version, v_link, v_visitor, nullif(left(p_batch ->> 'sessionId', 64), ''),
          v_detail, v_correct, jsonb_array_length(v_quiz -> 'questions'), v_score, v_passed);
  insert into public.survey_text_answers (workspace_id, demo_id, attempt_id, question_id, visitor_id, body)
  select v_ws, v_demo, v_attempt, t ->> 'questionId', v_visitor, t ->> 'text' from jsonb_array_elements(v_texts) t;

  return jsonb_build_object('score', v_score, 'correct', v_correct,
    'total', jsonb_array_length(v_quiz -> 'questions'), 'passed', v_passed,
    'attemptsLeft', case when v_attempts > 0 then v_attempts - v_used - 1 end, 'questions', v_detail);
end $$;
revoke all on function public.submit_quiz_attempt(jsonb) from public;
grant execute on function public.submit_quiz_attempt(jsonb) to anon, authenticated;

-- Résultats des sondages (viewer) : note de 0 à 10 (score calculé à partir de 20 réponses), choix,
-- nombre de réponses écrites ; dernière réponse de chaque visiteur par question
create or replace function public.survey_results(p_demo uuid, p_from timestamptz default now() - interval '30 days',
                                                 p_to timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.demos where id = p_demo;
  if v_ws is null or not public.has_role(v_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return coalesce((
    with qs as (
      select q.id, q.type, q.prompt, q.answers, q.position from public.quiz_questions q where q.demo_id = p_demo
    ), last as (
      select distinct on (a.visitor_id, d ->> 'questionId') a.visitor_id, d
      from public.quiz_attempts a, jsonb_array_elements(a.answers) d
      where a.demo_id = p_demo and a.created_at between p_from and p_to
      order by a.visitor_id, d ->> 'questionId', a.created_at desc
    )
    select jsonb_agg(jsonb_build_object('id', qs.id, 'type', qs.type, 'prompt', qs.prompt,
      'responses', (select count(*) from last where last.d ->> 'questionId' = qs.id::text
                      and (qs.type <> 'nps' or last.d ->> 'value' is not null)
                      and (qs.type <> 'text' or coalesce((last.d ->> 'answered')::boolean, false))),
      'nps', case when qs.type = 'nps' then (
        select jsonb_build_object('histogram', (select jsonb_agg(coalesce(c.n, 0) order by g.v) from generate_series(0, 10) g(v)
                 left join (select (last.d ->> 'value')::int as v, count(*) n from last
                            where last.d ->> 'questionId' = qs.id::text and last.d ->> 'value' is not null group by 1) c on c.v = g.v),
          'score', case when count(*) >= 20 then round(100.0 * (count(*) filter (where (last.d ->> 'value')::int >= 9)
                                                 - count(*) filter (where (last.d ->> 'value')::int <= 6)) / count(*))::int end)
        from last where last.d ->> 'questionId' = qs.id::text and last.d ->> 'value' is not null) end,
      'choices', case when qs.type in ('single', 'multiple', 'truefalse') then (
        select jsonb_agg(jsonb_build_object('id', ans ->> 'id', 'label', ans ->> 'label',
                 'n', (select count(*) from last where last.d ->> 'questionId' = qs.id::text
                        and coalesce(last.d -> 'answerIds', '[]'::jsonb) ? (ans ->> 'id'))))
        from jsonb_array_elements(qs.answers) ans) end)
      order by qs.position)
    from qs), '[]'::jsonb);
end $$;

-- Réponses écrites (editor et plus) : date et texte ; identité de l'apprenant identifié seulement
create or replace function public.survey_texts(p_demo uuid, p_question text default null, p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.demos where id = p_demo;
  if v_ws is null or not public.has_role(v_ws, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('at', t.created_at, 'questionId', t.question_id, 'text', t.body,
                                        'learner', l.full_name) order by t.created_at desc)
    from (select * from public.survey_text_answers where demo_id = p_demo
            and (p_question is null or question_id = p_question)
          order by created_at desc limit least(greatest(coalesce(p_limit, 200), 1), 500)) t
    left join public.learner_visitors lv on lv.workspace_id = t.workspace_id and lv.visitor_id = t.visitor_id
    left join public.learners l on l.id = lv.learner_id), '[]'::jsonb);
end $$;

-- Menus de choix (viewer) : part de chaque choix et complétion après le choix
create or replace function public.choice_results(p_demo uuid, p_from timestamptz default now() - interval '30 days',
                                                 p_to timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.demos where id = p_demo;
  if v_ws is null or not public.has_role(v_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return coalesce((
    with c as (
      select e.step_id, e.props ->> 'choice' as label, e.visitor_id
      from public.events e
      where e.demo_id = p_demo and e.type = 'hotspot_click' and e.props ? 'choice'
        and e.occurred_at between p_from and p_to
    ), done as (
      select distinct visitor_id from public.events
      where demo_id = p_demo and type = 'demo_complete' and occurred_at between p_from and p_to
    )
    select jsonb_agg(jsonb_build_object('stepId', step_id, 'choices', choices))
    from (select step_id, jsonb_agg(jsonb_build_object('label', label, 'visitors', n, 'completed', k) order by n desc) as choices
          from (select c.step_id, c.label, count(distinct c.visitor_id) as n,
                       count(distinct c.visitor_id) filter (where c.visitor_id in (select visitor_id from done)) as k
                from c group by 1, 2) x
          group by step_id) y), '[]'::jsonb);
end $$;

revoke all on function public.survey_results(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.survey_texts(uuid, text, int) from public, anon;
revoke all on function public.choice_results(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.survey_results(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.survey_texts(uuid, text, int) to authenticated;
grant execute on function public.choice_results(uuid, timestamptz, timestamptz) to authenticated;

-- ===== 3. Publication : nps et text acceptés en mode Sondage =====
-- publish_demo redéfinie à l'identique de 20261119120000_editeur_avance.sql, avec ce seul changement.
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
