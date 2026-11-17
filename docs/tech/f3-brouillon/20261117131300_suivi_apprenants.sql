-- FlowDSIML — F3a : suivi des apprenants (structures, parcours, apprenants, progression).
-- Idempotent, additif. Identification par LIEN PERSONNEL à jeton (#/d/<demo>?a=<jeton>) ; les
-- visiteurs anonymes ne sont pas suivis. L'accès restreint réel (bucket privé) et l'accès par
-- domaine e-mail (OTP) relèvent de F3b.
--  * structures : « structure » ou « équipe » (libellé : workspaces.settings.structureLabel), domaines.
--  * paths / path_modules : parcours = modules (démos) ordonnés, obligatoires ou non, objectif en %.
--  * learners : apprenants (données personnelles) → lecture et écriture editor+ uniquement.
--  * learner_progress : progression par module ; écrite par learner_track et submit_quiz_attempt.
--  * learner_resume / learner_track : RPC du player (jeton) ; structure_overview : agrégats (viewer+),
--    groupes de moins de 5 personnes masqués ; anonymize_learners : conservation (12 mois par défaut).
--  * submit_quiz_attempt : recréée (corps de 131200) — tentatives comptées par apprenant, tentatives
--    accordées, rattachement de la tentative et mise à jour de la progression.

create table if not exists public.structures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  domains text[] not null default '{}' check (cardinality(domains) <= 20),
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.paths (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 160),
  ordered boolean not null default false,
  goal int not null default 80 check (goal between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.path_modules (
  path_id uuid not null references public.paths (id) on delete cascade,
  demo_id uuid not null references public.demos (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  position int not null default 0,
  required boolean not null default true,
  primary key (path_id, demo_id)
);

create table if not exists public.learners (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  full_name text not null default '' check (char_length(full_name) <= 120),
  structure_id uuid references public.structures (id) on delete set null,
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  invited_at timestamptz not null default now(),
  last_reminded_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table if not exists public.learner_progress (
  learner_id uuid not null references public.learners (id) on delete cascade,
  demo_id uuid not null references public.demos (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  last_step int not null default 0 check (last_step >= 0),
  steps_seen int not null default 0 check (steps_seen >= 0),
  total_steps int not null default 0 check (total_steps >= 0),
  status text not null default 'in_progress' check (status in ('not_started', 'in_progress', 'validated', 'failed')),
  best_score int check (best_score between 0 and 100),
  attempts_used int not null default 0,
  extra_attempts int not null default 0 check (extra_attempts between 0 and 20),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  validated_at timestamptz,
  primary key (learner_id, demo_id)
);
create index if not exists learner_progress_demo_idx on public.learner_progress (demo_id);

alter table public.quiz_attempts add column if not exists learner_id uuid references public.learners (id) on delete set null;
create index if not exists quiz_attempts_learner_idx on public.quiz_attempts (demo_id, learner_id);

-- Cohérence : modules, structures et apprenants du même workspace
create or replace function public.path_modules_context() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select p.workspace_id into new.workspace_id from public.paths p where p.id = new.path_id;
  if new.workspace_id is null or not exists (
       select 1 from public.demos d where d.id = new.demo_id and d.workspace_id = new.workspace_id) then
    raise exception 'DEMO_NOT_IN_WORKSPACE';
  end if;
  return new;
end $$;
revoke all on function public.path_modules_context() from public, anon, authenticated;
drop trigger if exists path_modules_context on public.path_modules;
create trigger path_modules_context before insert or update on public.path_modules
  for each row execute function public.path_modules_context();

create or replace function public.learners_check_structure() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.email := lower(btrim(new.email));
  if new.structure_id is not null and not exists (
       select 1 from public.structures s where s.id = new.structure_id and s.workspace_id = new.workspace_id) then
    raise exception 'STRUCTURE_NOT_IN_WORKSPACE';
  end if;
  return new;
end $$;
revoke all on function public.learners_check_structure() from public, anon, authenticated;
drop trigger if exists learners_check_structure on public.learners;
create trigger learners_check_structure before insert or update on public.learners
  for each row execute function public.learners_check_structure();

drop trigger if exists set_updated_at on public.paths;
create trigger set_updated_at before update on public.paths for each row execute function public.set_updated_at();

-- RLS : structures et parcours lisibles par tout membre (pilotage agrégé), modifiables editor+ ;
-- apprenants et progression nominative : editor+ uniquement ; écriture de la progression par RPC.
alter table public.structures enable row level security;
alter table public.paths enable row level security;
alter table public.path_modules enable row level security;
alter table public.learners enable row level security;
alter table public.learner_progress enable row level security;
revoke all on public.structures, public.paths, public.path_modules, public.learners, public.learner_progress from anon;
grant select, insert, update, delete on public.structures, public.paths, public.path_modules, public.learners to authenticated;
revoke all on public.learner_progress from authenticated;
grant select on public.learner_progress to authenticated;
grant update (extra_attempts) on public.learner_progress to authenticated;
revoke update on public.learners from authenticated;
grant update (full_name, structure_id, removed_at, last_reminded_at) on public.learners to authenticated;

do $$
declare t text;
begin
  foreach t in array array['structures', 'paths', 'path_modules'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.has_role(workspace_id, ''viewer''))', t);
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_write on public.%1$s for all to authenticated using (public.has_role(workspace_id, ''editor'')) with check (public.has_role(workspace_id, ''editor''))', t);
  end loop;
  foreach t in array array['learners', 'learner_progress'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.has_role(workspace_id, ''editor''))', t);
  end loop;
end $$;
drop policy if exists learners_write on public.learners;
create policy learners_write on public.learners for all to authenticated
  using (public.has_role(workspace_id, 'editor')) with check (public.has_role(workspace_id, 'editor'));
drop policy if exists learner_progress_update on public.learner_progress;
create policy learner_progress_update on public.learner_progress for update to authenticated
  using (public.has_role(workspace_id, 'editor')) with check (public.has_role(workspace_id, 'editor'));

/** Player : reprise d'un apprenant (jeton personnel). Ne renvoie que SA progression. */
create or replace function public.learner_resume(p_token text, p_demo uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  l public.learners;
  d public.demos;
  v_path public.paths;
begin
  if char_length(coalesce(p_token, '')) not between 16 and 64 then return null; end if;
  select * into d from public.demos where id = p_demo and status = 'published' and deleted_at is null;
  if d.id is null then return null; end if;
  select * into l from public.learners where token = p_token and workspace_id = d.workspace_id and removed_at is null;
  if l.id is null then return null; end if;
  select p.* into v_path from public.paths p join public.path_modules m on m.path_id = p.id
    where m.demo_id = p_demo order by p.created_at limit 1;
  return jsonb_build_object(
    'firstName', split_part(btrim(l.full_name), ' ', 1),
    'progress', (select jsonb_build_object('lastStep', lp.last_step, 'totalSteps', lp.total_steps, 'status', lp.status,
                                           'bestScore', lp.best_score)
                 from public.learner_progress lp where lp.learner_id = l.id and lp.demo_id = p_demo),
    'path', case when v_path.id is null then null else jsonb_build_object(
      'title', v_path.title, 'ordered', v_path.ordered,
      'modules', (select coalesce(jsonb_agg(jsonb_build_object(
          'demoId', m.demo_id, 'title', dm.title, 'required', m.required,
          'status', coalesce(lp.status, 'not_started'), 'lastStep', coalesce(lp.last_step, 0),
          'totalSteps', coalesce(lp.total_steps, 0)) order by m.position), '[]'::jsonb)
        from public.path_modules m join public.demos dm on dm.id = m.demo_id
        left join public.learner_progress lp on lp.learner_id = l.id and lp.demo_id = m.demo_id
        where m.path_id = v_path.id and dm.deleted_at is null)) end);
end $$;
revoke all on function public.learner_resume(text, uuid) from public;
grant execute on function public.learner_resume(text, uuid) to anon, authenticated;

/**
 * Player : position et étapes vues d'un apprenant. Un module sans quiz obligatoire est validé quand
 * sa dernière étape est vue ; avec quiz, c'est submit_quiz_attempt qui valide.
 */
create or replace function public.learner_track(p_token text, p_demo uuid, p_step int, p_total int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  l public.learners;
  d public.demos;
  v_quiz_required boolean;
  v_done boolean;
begin
  if char_length(coalesce(p_token, '')) not between 16 and 64 or p_step < 0 or p_total < 1 or p_step >= p_total
     or p_total > 1000 then
    return;
  end if;
  select * into d from public.demos where id = p_demo and status = 'published' and deleted_at is null;
  if d.id is null then return; end if;
  select * into l from public.learners where token = p_token and workspace_id = d.workspace_id and removed_at is null;
  if l.id is null then return; end if;
  select coalesce((v.manifest -> 'quiz' ->> 'required')::boolean, true) and v.manifest -> 'quiz' is not null
         and jsonb_typeof(v.manifest -> 'quiz') = 'object'
    into v_quiz_required from public.demo_versions v where v.id = d.current_version_id;
  v_done := p_step = p_total - 1 and not coalesce(v_quiz_required, false);
  insert into public.learner_progress as p (learner_id, demo_id, workspace_id, last_step, steps_seen, total_steps,
                                            status, validated_at)
  values (l.id, p_demo, d.workspace_id, p_step, p_step + 1, p_total,
          case when v_done then 'validated' else 'in_progress' end, case when v_done then now() end)
  on conflict (learner_id, demo_id) do update set
    last_step = p_step,
    steps_seen = greatest(p.steps_seen, p_step + 1),
    total_steps = p_total,
    status = case when p.status in ('validated', 'failed') then p.status when v_done then 'validated' else 'in_progress' end,
    validated_at = coalesce(p.validated_at, case when v_done then now() end),
    updated_at = now();
end $$;
revoke all on function public.learner_track(text, uuid, int, int) from public;
grant execute on function public.learner_track(text, uuid, int, int) to anon, authenticated;

/**
 * Pilotage par structure (agrégats, aucun nom) : viewer+. Un groupe de moins de 5 personnes est
 * masqué (valeur null). « Formée » = tous les modules obligatoires validés.
 */
create or replace function public.structure_overview(p_path uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws uuid;
  v_out jsonb;
begin
  select workspace_id into v_ws from public.paths where id = p_path;
  if v_ws is null or not public.has_role(v_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  with mods as (
    select m.demo_id, m.required, m.position, d.title from public.path_modules m
    join public.demos d on d.id = m.demo_id and d.deleted_at is null where m.path_id = p_path
  ), lrn as (
    select l.id, l.structure_id from public.learners l where l.workspace_id = v_ws and l.removed_at is null
  ), cell as (
    select lrn.structure_id, mods.demo_id, count(*) as n,
           count(*) filter (where lp.status = 'validated') as ok
    from lrn cross join mods
    left join public.learner_progress lp on lp.learner_id = lrn.id and lp.demo_id = mods.demo_id
    group by lrn.structure_id, mods.demo_id
  ), trained as (
    select lrn.id, lrn.structure_id,
           case when count(*) filter (where mods.required) = count(*) filter (where mods.required and lp.status = 'validated')
                     and count(*) filter (where mods.required) > 0
                then max(lp.validated_at) filter (where mods.required) end as trained_at
    from lrn cross join mods
    left join public.learner_progress lp on lp.learner_id = lrn.id and lp.demo_id = mods.demo_id
    group by lrn.id, lrn.structure_id
  )
  select jsonb_build_object(
    'goal', (select goal from public.paths where id = p_path),
    'learners', (select count(*) from lrn),
    'trained', (select count(*) from trained where trained_at is not null),
    'modules', (select coalesce(jsonb_agg(jsonb_build_object('demoId', demo_id, 'title', title, 'required', required) order by position), '[]'::jsonb) from mods),
    'structures', (select coalesce(jsonb_agg(x order by x ->> 'name'), '[]'::jsonb) from (
      select jsonb_build_object(
        'id', s.id, 'name', coalesce(s.name, ''),
        'learners', (select count(*) from lrn where lrn.structure_id is not distinct from s.id),
        'trainedRate', (select case when count(*) < 5 then null else round(avg(case when t.trained_at is not null then 1.0 else 0 end), 4) end
                        from trained t where t.structure_id is not distinct from s.id),
        'cells', (select coalesce(jsonb_object_agg(c.demo_id, case when c.n < 5 then null else round(c.ok::numeric / c.n, 4) end), '{}'::jsonb)
                  from cell c where c.structure_id is not distinct from s.id)) as x
      from (select id, name from public.structures where workspace_id = v_ws
            union all select null::uuid, null::text where exists (select 1 from lrn where structure_id is null)) s) y),
    'weekly', (select coalesce(jsonb_agg(jsonb_build_object('week', w, 'trained', (select count(*) from trained where trained_at < w + interval '7 days')) order by w), '[]'::jsonb)
               from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') w)
  ) into v_out;
  return v_out;
end $$;
revoke all on function public.structure_overview(uuid) from public, anon;
grant execute on function public.structure_overview(uuid) to authenticated;

/** Relance : n'accepte qu'une relance par personne toutes les 72 h ; renvoie les apprenants marqués. */
create or replace function public.mark_learners_reminded(p_learners uuid[])
returns setof uuid language plpgsql security definer set search_path = '' as $$
begin
  return query
    update public.learners l set last_reminded_at = now()
    where l.id = any(p_learners) and l.removed_at is null and public.has_role(l.workspace_id, 'editor')
      and (l.last_reminded_at is null or l.last_reminded_at < now() - interval '72 hours')
    returning l.id;
end $$;
revoke all on function public.mark_learners_reminded(uuid[]) from public, anon;
grant execute on function public.mark_learners_reminded(uuid[]) to authenticated;

/** Conservation : au-delà de N mois sans activité (workspaces.settings.learnerRetentionMonths, 12 par défaut), anonymisation. */
create or replace function public.anonymize_learners()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with stale as (
    select l.id from public.learners l join public.workspaces w on w.id = l.workspace_id
    where l.email not like 'anonyme-%@invalid'
      and greatest(l.invited_at, coalesce((select max(updated_at) from public.learner_progress p where p.learner_id = l.id), l.invited_at))
          < now() - make_interval(months => least(greatest(coalesce((w.settings ->> 'learnerRetentionMonths')::int, 12), 1), 60))
  )
  update public.learners l set email = 'anonyme-' || l.id || '@invalid', full_name = '',
         token = encode(extensions.gen_random_bytes(18), 'hex'), removed_at = coalesce(l.removed_at, now())
  from stale where stale.id = l.id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.anonymize_learners() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('fd_anonymize_learners', '45 3 * * *', 'select public.anonymize_learners()');
  end if;
end $$;

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
  v_learner public.learners;
  v_extra int := 0;
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

  -- F3 : apprenant identifié par son lien personnel (sinon visiteur anonyme, non suivi)
  if p_batch ->> 'learnerToken' is not null then
    select l.* into v_learner from public.learners l
      where l.token = p_batch ->> 'learnerToken' and l.workspace_id = v_ws and l.removed_at is null;
  end if;

  -- Tentatives : 0 = illimitées (plafond anti-abus de 50 par jour). Comptées par apprenant s'il est
  -- identifié (avec les tentatives accordées par le formateur), sinon par visiteur.
  v_attempts := coalesce((v_quiz ->> 'attempts')::int, 3);
  if v_learner.id is not null then
    select coalesce(extra_attempts, 0) into v_extra from public.learner_progress
      where learner_id = v_learner.id and demo_id = v_demo;
    v_extra := coalesce(v_extra, 0);
    select count(*) into v_used from public.quiz_attempts where demo_id = v_demo and learner_id = v_learner.id
      and (v_attempts > 0 or created_at > now() - interval '1 day');
  else
    select count(*) into v_used from public.quiz_attempts where demo_id = v_demo and visitor_id = v_visitor
      and (v_attempts > 0 or created_at > now() - interval '1 day');
  end if;
  if v_attempts > 0 then v_attempts := v_attempts + v_extra; end if;
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
                                    answers, correct, total, score, passed, learner_id)
  values (v_ws, v_demo, v_version, v_link, v_visitor, nullif(left(p_batch ->> 'sessionId', 64), ''),
          v_detail, v_correct, jsonb_array_length(v_quiz -> 'questions'), v_score, v_passed, v_learner.id);

  -- F3 : progression de l'apprenant (la meilleure tentative fait foi ; « validé » est définitif)
  if v_learner.id is not null then
    insert into public.learner_progress as p (learner_id, demo_id, workspace_id, status, best_score, attempts_used,
                                              validated_at, started_at, updated_at)
    values (v_learner.id, v_demo, v_ws, case when v_passed then 'validated' else 'failed' end, v_score, 1,
            case when v_passed then now() end, now(), now())
    on conflict (learner_id, demo_id) do update set
      attempts_used = p.attempts_used + 1,
      best_score = greatest(coalesce(p.best_score, 0), excluded.best_score),
      status = case when p.status = 'validated' or v_passed then 'validated' else 'failed' end,
      validated_at = case when p.validated_at is not null then p.validated_at when v_passed then now() end,
      updated_at = now();
  end if;

  return jsonb_build_object('score', v_score, 'correct', v_correct,
    'total', jsonb_array_length(v_quiz -> 'questions'), 'passed', v_passed,
    'attemptsLeft', case when v_attempts > 0 then v_attempts - v_used - 1 end, 'questions', v_detail);
end $$;
revoke all on function public.submit_quiz_attempt(jsonb) from public;
grant execute on function public.submit_quiz_attempt(jsonb) to anon, authenticated;
