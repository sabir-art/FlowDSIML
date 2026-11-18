-- FlowDSIML — L13 : suivi des apprenants (F3). Idempotent, additif.
-- Schéma approuvé par le chef d'équipe (formation = parcours, audit_log, learner_reminders).
--  * Un apprenant est un visiteur IDENTIFIÉ : par l'e-mail d'un formulaire de lead (source 'lead') ou
--    par un lien personnalisé (source 'link'). Les visiteurs anonymes ne sont jamais suivis.
--  * Identification par déclencheurs sur leads et events (le player et ses RPC ne changent pas) ;
--    learner_visitors rattache les visitor_id du player à l'apprenant.
--  * Identité déclarative : un formulaire ne fusionne ni n'écrase jamais un apprenant identifié par
--    lien personnalisé ; un lien personnalisé l'emporte sur un formulaire.
--  * Progression CALCULÉE à la lecture depuis events (step_view, demo_complete) et quiz_attempts.
--  * Données personnelles : lecture editor+ ; agrégats par structure dès viewer, groupes < 5 masqués.
--  * RGPD : erase_learner (owner/admin, confirmation par e-mail, trace sans e-mail en clair dans
--    audit_log) ; purge_learners selon analytics_retention_days du plan (pg_cron si présent).
--  * submit_quiz_attempt est recréée (corps de 20261117131200) : tentatives comptées par apprenant
--    (tous ses visitor_id) et tentatives accordées (learner_overrides).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.structures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  domains text[] not null default '{}' check (cardinality(domains) <= 20),
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

/** Formation = parcours : suite de modules (démos), ordre libre ou imposé, objectif en %. */
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
  email text check (email is null or (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254)),
  full_name text not null default '' check (char_length(full_name) <= 120),
  structure_id uuid references public.structures (id) on delete set null,
  source text not null check (source in ('lead', 'link')),
  share_link_id uuid unique references public.share_links (id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  check (email is not null or share_link_id is not null or source = 'link')
);
create unique index if not exists learners_ws_email_idx on public.learners (workspace_id, email) where email is not null;
create index if not exists learners_ws_idx on public.learners (workspace_id);

create table if not exists public.learner_visitors (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  visitor_id text not null check (char_length(visitor_id) between 8 and 64),
  learner_id uuid not null references public.learners (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, visitor_id)
);
create index if not exists learner_visitors_learner_idx on public.learner_visitors (learner_id);

create table if not exists public.learner_overrides (
  learner_id uuid not null references public.learners (id) on delete cascade,
  demo_id uuid not null references public.demos (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  extra_attempts int not null default 0 check (extra_attempts between 0 and 20),
  primary key (learner_id, demo_id)
);

create table if not exists public.learner_reminders (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists learner_reminders_learner_idx on public.learner_reminders (learner_id, created_at desc);

/** Journal du workspace : exports et suppressions RGPD. target_ref = empreinte, jamais l'e-mail en clair. */
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('learners.export', 'learner.erase', 'learners.purge')),
  target_ref text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_ws_idx on public.audit_log (workspace_id, created_at desc);

-- Lecture de la progression : événements par visiteur et par démo
create index if not exists events_ws_visitor_idx on public.events (workspace_id, visitor_id, demo_id, occurred_at);
create index if not exists quiz_attempts_ws_visitor_idx on public.quiz_attempts (workspace_id, visitor_id, demo_id);

-- ---------------------------------------------------------------------------
-- Cohérence (même workspace)
-- ---------------------------------------------------------------------------
create or replace function public.path_modules_context() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select p.workspace_id into new.workspace_id from public.paths p where p.id = new.path_id;
  if new.workspace_id is null or not exists (
       select 1 from public.demos d where d.id = new.demo_id and d.workspace_id = new.workspace_id) then
    raise exception 'DEMO_NOT_IN_WORKSPACE' using errcode = 'P0001';
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
  if new.structure_id is not null and not exists (
       select 1 from public.structures s where s.id = new.structure_id and s.workspace_id = new.workspace_id) then
    raise exception 'STRUCTURE_NOT_IN_WORKSPACE' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.learners_check_structure() from public, anon, authenticated;
drop trigger if exists learners_check_structure on public.learners;
create trigger learners_check_structure before insert or update on public.learners
  for each row execute function public.learners_check_structure();

drop trigger if exists set_updated_at on public.paths;
create trigger set_updated_at before update on public.paths for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.structures enable row level security;
alter table public.paths enable row level security;
alter table public.path_modules enable row level security;
alter table public.learners enable row level security;
alter table public.learner_visitors enable row level security;
alter table public.learner_overrides enable row level security;
alter table public.learner_reminders enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.structures, public.paths, public.path_modules, public.learners, public.learner_visitors,
  public.learner_overrides, public.learner_reminders, public.audit_log from anon, authenticated;
grant select, insert, update, delete on public.structures, public.paths, public.path_modules to authenticated;
grant select on public.learners, public.learner_visitors, public.learner_overrides, public.learner_reminders,
  public.audit_log to authenticated;
grant update (full_name, structure_id) on public.learners to authenticated;

do $$
declare t text;
begin
  -- Structures et formations : lisibles par tout membre (pilotage agrégé), modifiables editor+
  foreach t in array array['structures', 'paths', 'path_modules'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.has_role(workspace_id, ''viewer''))', t);
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_write on public.%1$s for all to authenticated using (public.has_role(workspace_id, ''editor'')) with check (public.has_role(workspace_id, ''editor''))', t);
  end loop;
  -- Données nominatives : editor+
  foreach t in array array['learners', 'learner_visitors', 'learner_overrides', 'learner_reminders'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.has_role(workspace_id, ''editor''))', t);
  end loop;
end $$;
drop policy if exists learners_update on public.learners;
create policy learners_update on public.learners for update to authenticated
  using (public.has_role(workspace_id, 'editor')) with check (public.has_role(workspace_id, 'editor'));
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated using (public.has_role(workspace_id, 'admin'));

-- ---------------------------------------------------------------------------
-- Identification (déclencheurs)
-- ---------------------------------------------------------------------------
create or replace function public.learner_structure_for(p_ws uuid, p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select s.id from public.structures s
  where s.workspace_id = p_ws and p_email is not null and lower(split_part(p_email, '@', 2)) = any (s.domains)
  order by s.name limit 1;
$$;
revoke all on function public.learner_structure_for(uuid, text) from public, anon, authenticated;

/** Rattache un visiteur à un apprenant. Un lien personnalisé l'emporte sur un formulaire, jamais l'inverse. */
create or replace function public.learner_attach_visitor(p_ws uuid, p_visitor text, p_learner uuid, p_from_link boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_visitor is null or char_length(p_visitor) not between 8 and 64 then return; end if;
  if p_from_link then
    insert into public.learner_visitors (workspace_id, visitor_id, learner_id) values (p_ws, p_visitor, p_learner)
    on conflict (workspace_id, visitor_id) do update set learner_id = excluded.learner_id
      where (select source from public.learners where id = public.learner_visitors.learner_id) = 'lead';
  else
    insert into public.learner_visitors (workspace_id, visitor_id, learner_id) values (p_ws, p_visitor, p_learner)
    on conflict (workspace_id, visitor_id) do nothing;
  end if;
  update public.learners set last_seen_at = now() where id = p_learner;
end $$;
revoke all on function public.learner_attach_visitor(uuid, text, uuid, boolean) from public, anon, authenticated;

/** Formulaire de lead : apprenant identifié par son e-mail (source 'lead'). */
create or replace function public.learners_from_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(new.email));
  v_learner public.learners;
  v_name text;
begin
  if new.visitor_id is null then return new; end if;
  -- Visiteur déjà identifié par un lien personnalisé : le formulaire ne change rien
  if exists (select 1 from public.learner_visitors lv join public.learners l on l.id = lv.learner_id
             where lv.workspace_id = new.workspace_id and lv.visitor_id = new.visitor_id and l.source = 'link') then
    return new;
  end if;
  select * into v_learner from public.learners where workspace_id = new.workspace_id and email = v_email;
  if found and v_learner.source = 'link' then
    -- Identité déclarative : un formulaire ne se rattache jamais à un apprenant identifié par lien
    return new;
  end if;
  if not found then
    v_name := left(btrim(coalesce(nullif(new.fields ->> 'full_name', ''),
                  concat_ws(' ', nullif(new.fields ->> 'first_name', ''), nullif(new.fields ->> 'last_name', '')), '')), 120);
    insert into public.learners (workspace_id, email, full_name, source, structure_id)
    values (new.workspace_id, v_email, coalesce(v_name, ''), 'lead', public.learner_structure_for(new.workspace_id, v_email))
    on conflict (workspace_id, email) where email is not null do nothing
    returning * into v_learner;
    if v_learner.id is null then
      select * into v_learner from public.learners where workspace_id = new.workspace_id and email = v_email;
      if v_learner.source = 'link' then return new; end if;
    end if;
  end if;
  perform public.learner_attach_visitor(new.workspace_id, new.visitor_id, v_learner.id, false);
  return new;
end $$;
revoke all on function public.learners_from_lead() from public, anon, authenticated;
drop trigger if exists learners_from_lead on public.leads;
create trigger learners_from_lead after insert on public.leads for each row execute function public.learners_from_lead();

/** Lien personnalisé : apprenant identifié par le lien (source 'link'), fusionné par e-mail le cas échéant. */
create or replace function public.learners_from_link_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.share_links;
  v_learner public.learners;
  v_email text;
  v_name text;
begin
  select * into v_link from public.share_links where id = new.link_id;
  if not found then return new; end if;
  select * into v_learner from public.learners where share_link_id = v_link.id;
  if not found then
    v_email := lower(btrim(v_link.variables ->> 'email'));
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then v_email := null; end if;
    v_name := left(btrim(coalesce(
      nullif(concat_ws(' ', nullif(v_link.variables ->> 'first_name', ''), nullif(v_link.variables ->> 'last_name', '')), ''),
      nullif(v_link.variables ->> 'full_name', ''), v_link.name, '')), 120);
    -- Même e-mail qu'un apprenant identifié par formulaire : c'est la même personne, le lien l'emporte
    if v_email is not null then
      select * into v_learner from public.learners
        where workspace_id = new.workspace_id and email = v_email and share_link_id is null;
      if found then
        update public.learners set share_link_id = v_link.id, source = 'link',
          full_name = case when v_name <> '' then v_name else full_name end
          where id = v_learner.id returning * into v_learner;
      elsif exists (select 1 from public.learners where workspace_id = new.workspace_id and email = v_email) then
        v_email := null; -- e-mail déjà porté par un autre lien : pas de fusion
      end if;
    end if;
    if v_learner.id is null then
      insert into public.learners (workspace_id, email, full_name, source, share_link_id, structure_id)
      values (new.workspace_id, v_email, v_name, 'link', v_link.id, public.learner_structure_for(new.workspace_id, v_email))
      on conflict (share_link_id) do nothing
      returning * into v_learner;
      if v_learner.id is null then
        select * into v_learner from public.learners where share_link_id = v_link.id;
      end if;
    end if;
  end if;
  perform public.learner_attach_visitor(new.workspace_id, new.visitor_id, v_learner.id, true);
  return new;
end $$;
revoke all on function public.learners_from_link_event() from public, anon, authenticated;
drop trigger if exists learners_from_link_event on public.events;
create trigger learners_from_link_event after insert on public.events
  for each row when (new.link_id is not null) execute function public.learners_from_link_event();

-- ---------------------------------------------------------------------------
-- Progression (calculée) : une ligne par apprenant × module des formations du workspace
-- ---------------------------------------------------------------------------
create or replace function public.learner_modules(p_ws uuid)
returns table (
  learner_id uuid, demo_id uuid, total_steps int, steps_seen int, completed boolean, has_quiz boolean,
  best_score int, attempts_used int, attempts_max int, passed boolean, last_activity timestamptz, status text
) language sql stable security definer set search_path = '' as $$
  with mods as (
    select distinct m.demo_id from public.path_modules m join public.demos d on d.id = m.demo_id
    where m.workspace_id = p_ws and d.deleted_at is null
  ), ver as (
    select d.id as demo_id,
           coalesce(jsonb_array_length(v.manifest -> 'steps'), 0) as total,
           jsonb_typeof(v.manifest -> 'quiz') = 'object' and v.manifest -> 'quiz' ->> 'mode' is distinct from 'survey' as quiz,
           coalesce((v.manifest -> 'quiz' ->> 'attempts')::int, 3) as attempts
    from public.demos d join mods on mods.demo_id = d.id left join public.demo_versions v on v.id = d.current_version_id
  ), lv as (
    select lv.learner_id, lv.visitor_id from public.learner_visitors lv where lv.workspace_id = p_ws
  ), ev as (
    select lv.learner_id, e.demo_id,
           max(e.step_index) filter (where e.type = 'step_view') as max_idx,
           bool_or(e.type = 'demo_complete') as completed,
           max(e.occurred_at) as last_at
    from lv join public.events e on e.workspace_id = p_ws and e.visitor_id = lv.visitor_id
    where e.demo_id in (select demo_id from mods)
    group by lv.learner_id, e.demo_id
  ), qa as (
    select lv.learner_id, q.demo_id, max(q.score) as best, count(*)::int as used, bool_or(q.passed) as passed,
           max(q.created_at) as last_at
    from lv join public.quiz_attempts q on q.workspace_id = p_ws and q.visitor_id = lv.visitor_id
    group by lv.learner_id, q.demo_id
  )
  select l.id, ver.demo_id, ver.total,
         least(coalesce(ev.max_idx + 1, 0), ver.total),
         coalesce(ev.completed, false), coalesce(ver.quiz, false),
         qa.best, coalesce(qa.used, 0),
         case when ver.attempts > 0 then ver.attempts + coalesce(o.extra_attempts, 0) end,
         coalesce(qa.passed, false),
         greatest(ev.last_at, qa.last_at),
         case
           when coalesce(ver.quiz, false) and coalesce(qa.passed, false) then 'validated'
           when not coalesce(ver.quiz, false) and (coalesce(ev.completed, false) or (ver.total > 0 and ev.max_idx + 1 >= ver.total)) then 'validated'
           when coalesce(ver.quiz, false) and ver.attempts > 0 and coalesce(qa.used, 0) >= ver.attempts + coalesce(o.extra_attempts, 0) then 'failed'
           when ev.learner_id is not null or qa.learner_id is not null then 'in_progress'
           else 'not_started'
         end
  from public.learners l
  cross join ver
  left join ev on ev.learner_id = l.id and ev.demo_id = ver.demo_id
  left join qa on qa.learner_id = l.id and qa.demo_id = ver.demo_id
  left join public.learner_overrides o on o.learner_id = l.id and o.demo_id = ver.demo_id
  where l.workspace_id = p_ws;
$$;
revoke all on function public.learner_modules(uuid) from public, anon, authenticated;

/** Liste des apprenants avec leur progression par module (données nominatives : editor+). */
create or replace function public.learners_progress(p_workspace uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_workspace, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return jsonb_build_object(
    'paths', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title, 'ordered', p.ordered, 'goal', p.goal,
        'modules', (select coalesce(jsonb_agg(jsonb_build_object('demoId', m.demo_id, 'title', d.title, 'required', m.required,
                       'hasQuiz', jsonb_typeof(v.manifest -> 'quiz') = 'object',
                       'threshold', coalesce((v.manifest -> 'quiz' ->> 'threshold')::int, 70)) order by m.position), '[]'::jsonb)
                    from public.path_modules m join public.demos d on d.id = m.demo_id and d.deleted_at is null
                    left join public.demo_versions v on v.id = d.current_version_id
                    where m.path_id = p.id)) order by p.created_at), '[]'::jsonb)
      from public.paths p where p.workspace_id = p_workspace),
    'structures', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name), '[]'::jsonb)
      from public.structures s where s.workspace_id = p_workspace),
    'learners', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'email', l.email, 'name', l.full_name, 'source', l.source, 'structureId', l.structure_id,
        'createdAt', l.created_at,
        'lastReminder', (select max(r.created_at) from public.learner_reminders r where r.learner_id = l.id),
        'modules', (select coalesce(jsonb_agg(jsonb_build_object(
            'demoId', lm.demo_id, 'total', lm.total_steps, 'seen', lm.steps_seen, 'completed', lm.completed,
            'hasQuiz', lm.has_quiz, 'best', lm.best_score, 'used', lm.attempts_used, 'max', lm.attempts_max,
            'status', lm.status, 'lastActivity', lm.last_activity)), '[]'::jsonb)
          from public.learner_modules(p_workspace) lm where lm.learner_id = l.id)
      ) order by l.created_at desc), '[]'::jsonb)
      from public.learners l where l.workspace_id = p_workspace)
  );
end $$;
revoke all on function public.learners_progress(uuid) from public, anon;
grant execute on function public.learners_progress(uuid) to authenticated;

/** Fiche d'un apprenant : activité récente et tentatives de quiz (editor+). */
create or replace function public.learner_detail(p_learner uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_ws uuid;
begin
  select workspace_id into v_ws from public.learners where id = p_learner;
  if v_ws is null or not public.has_role(v_ws, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return jsonb_build_object(
    'events', (select coalesce(jsonb_agg(x order by x ->> 'at' desc), '[]'::jsonb) from (
      select jsonb_build_object('type', e.type, 'demoId', e.demo_id, 'stepIndex', e.step_index, 'at', e.occurred_at) as x
      from public.events e join public.learner_visitors lv on lv.workspace_id = e.workspace_id and lv.visitor_id = e.visitor_id
      where lv.learner_id = p_learner and e.type in ('demo_view', 'demo_complete', 'form_submit')
      order by e.occurred_at desc limit 100) t),
    'attempts', (select coalesce(jsonb_agg(jsonb_build_object('demoId', q.demo_id, 'score', q.score, 'passed', q.passed,
        'correct', q.correct, 'total', q.total, 'answers', q.answers, 'at', q.created_at) order by q.created_at desc), '[]'::jsonb)
      from public.quiz_attempts q join public.learner_visitors lv on lv.workspace_id = q.workspace_id and lv.visitor_id = q.visitor_id
      where lv.learner_id = p_learner),
    'reminders', (select coalesce(jsonb_agg(r.created_at order by r.created_at desc), '[]'::jsonb)
      from public.learner_reminders r where r.learner_id = p_learner)
  );
end $$;
revoke all on function public.learner_detail(uuid) from public, anon;
grant execute on function public.learner_detail(uuid) to authenticated;

/** Pilotage par structure (viewer+) : agrégats seulement, groupes de moins de 5 personnes masqués. */
create or replace function public.structure_overview(p_path uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_ws uuid;
begin
  select workspace_id into v_ws from public.paths where id = p_path;
  if v_ws is null or not public.has_role(v_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return (
    with mods as (
      select m.demo_id, m.required, m.position, d.title from public.path_modules m
      join public.demos d on d.id = m.demo_id and d.deleted_at is null where m.path_id = p_path
    ), lm as (
      select lm.* from public.learner_modules(v_ws) lm where lm.demo_id in (select demo_id from mods)
    ), lrn as (
      select l.id, l.structure_id from public.learners l where l.workspace_id = v_ws
        and exists (select 1 from lm where lm.learner_id = l.id and lm.status <> 'not_started')
    ), trained as (
      select lrn.id, lrn.structure_id,
             bool_and(lm.status = 'validated') filter (where mods.required) as ok
      from lrn join lm on lm.learner_id = lrn.id join mods on mods.demo_id = lm.demo_id
      group by lrn.id, lrn.structure_id
    )
    select jsonb_build_object(
      'goal', (select goal from public.paths where id = p_path),
      'learners', (select count(*) from lrn),
      'trained', (select count(*) from trained where ok),
      'modules', (select coalesce(jsonb_agg(jsonb_build_object('demoId', demo_id, 'title', title, 'required', required) order by position), '[]'::jsonb) from mods),
      'structures', (select coalesce(jsonb_agg(x order by x ->> 'name'), '[]'::jsonb) from (
        select jsonb_build_object(
          'id', s.id, 'name', s.name,
          'learners', (select count(*) from lrn where lrn.structure_id is not distinct from s.id),
          'trainedRate', (select case when count(*) < 5 then null else round(avg(case when t.ok then 1.0 else 0 end), 4) end
                          from trained t where t.structure_id is not distinct from s.id),
          'cells', (select coalesce(jsonb_object_agg(c.demo_id, case when c.n < 5 then null else round(c.ok::numeric / c.n, 4) end), '{}'::jsonb)
                    from (select lm.demo_id, count(*) as n, count(*) filter (where lm.status = 'validated') as ok
                          from lrn join lm on lm.learner_id = lrn.id
                          where lrn.structure_id is not distinct from s.id group by lm.demo_id) c)) as x
        from (select id, name from public.structures where workspace_id = v_ws
              union all select null::uuid, null::text where exists (select 1 from lrn where structure_id is null)) s) y)
    )
  );
end $$;
revoke all on function public.structure_overview(uuid) from public, anon;
grant execute on function public.structure_overview(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------
create or replace function public.grant_quiz_attempt(p_learner uuid, p_demo uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare v_ws uuid; n int;
begin
  select workspace_id into v_ws from public.learners where id = p_learner;
  if v_ws is null or not public.has_role(v_ws, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if not exists (select 1 from public.demos where id = p_demo and workspace_id = v_ws) then raise exception 'DEMO_NOT_FOUND'; end if;
  insert into public.learner_overrides (learner_id, demo_id, workspace_id, extra_attempts) values (p_learner, p_demo, v_ws, 1)
  on conflict (learner_id, demo_id) do update set extra_attempts = least(public.learner_overrides.extra_attempts + 1, 20)
  returning extra_attempts into n;
  return n;
end $$;
revoke all on function public.grant_quiz_attempt(uuid, uuid) from public, anon;
grant execute on function public.grant_quiz_attempt(uuid, uuid) to authenticated;

/** Relance préparée (mailto) : au plus une par personne toutes les 72 h ; renvoie les apprenants retenus. */
create or replace function public.record_reminders(p_learners uuid[])
returns uuid[] language plpgsql security definer set search_path = '' as $$
declare v_out uuid[];
begin
  if exists (select 1 from public.learners l where l.id = any (p_learners) and not public.has_role(l.workspace_id, 'editor')) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  with ok as (
    select l.id, l.workspace_id from public.learners l
    where l.id = any (p_learners) and l.email is not null
      and not exists (select 1 from public.learner_reminders r where r.learner_id = l.id and r.created_at > now() - interval '72 hours')
  ), ins as (
    insert into public.learner_reminders (learner_id, workspace_id, created_by)
    select id, workspace_id, (select auth.uid()) from ok returning learner_id
  )
  select coalesce(array_agg(learner_id), '{}') into v_out from ins;
  return v_out;
end $$;
revoke all on function public.record_reminders(uuid[]) from public, anon;
grant execute on function public.record_reminders(uuid[]) to authenticated;

/** Export CSV (fait par le navigateur) : tracé dans le journal du workspace. */
create or replace function public.log_learners_export(p_workspace uuid, p_rows int, p_columns text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_workspace, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  insert into public.audit_log (workspace_id, actor_id, action, meta)
  values (p_workspace, (select auth.uid()), 'learners.export',
          jsonb_build_object('rows', greatest(p_rows, 0), 'columns', to_jsonb(p_columns[1:20])));
end $$;
revoke all on function public.log_learners_export(uuid, int, text[]) from public, anon;
grant execute on function public.log_learners_export(uuid, int, text[]) to authenticated;

/** Effacement des données d'un apprenant (interne : utilisé par erase_learner et purge_learners). */
create or replace function public.learner_erase_data(p_learner uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  l public.learners;
  v record;
begin
  select * into l from public.learners where id = p_learner;
  if not found then return; end if;
  for v in select visitor_id from public.learner_visitors where learner_id = p_learner loop
    delete from public.quiz_attempts where workspace_id = l.workspace_id and visitor_id = v.visitor_id;
    delete from public.leads where workspace_id = l.workspace_id and visitor_id = v.visitor_id;
    -- Statistiques agrégées conservées : le visiteur devient anonyme et non rattachable
    update public.events set visitor_id = 'erased-' || encode(extensions.gen_random_bytes(8), 'hex')
      where workspace_id = l.workspace_id and visitor_id = v.visitor_id;
  end loop;
  if l.email is not null then
    delete from public.leads where workspace_id = l.workspace_id and email = l.email;
  end if;
  -- Accès personnel : le lien est désactivé et ses variables nominatives effacées
  if l.share_link_id is not null then
    update public.share_links set is_active = false, variables = '{}'::jsonb, name = '' where id = l.share_link_id;
  end if;
  delete from public.learners where id = p_learner;
end $$;
revoke all on function public.learner_erase_data(uuid) from public, anon, authenticated;

/** Suppression RGPD (owner/admin) : confirmation par l'e-mail (ou le nom à défaut), trace sans e-mail. */
create or replace function public.erase_learner(p_learner uuid, p_confirm text)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.learners;
begin
  select * into l from public.learners where id = p_learner;
  if not found or not public.has_role(l.workspace_id, 'admin') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if lower(btrim(coalesce(p_confirm, ''))) <> lower(btrim(coalesce(l.email, l.full_name))) or btrim(coalesce(p_confirm, '')) = '' then
    raise exception 'CONFIRMATION_MISMATCH' using errcode = 'P0001';
  end if;
  insert into public.audit_log (workspace_id, actor_id, action, target_ref, meta)
  values (l.workspace_id, (select auth.uid()), 'learner.erase',
          encode(extensions.digest(l.workspace_id::text || '|' || coalesce(l.email, l.id::text), 'sha256'), 'hex'),
          jsonb_build_object('source', l.source));
  perform public.learner_erase_data(p_learner);
end $$;
revoke all on function public.erase_learner(uuid, text) from public, anon;
grant execute on function public.erase_learner(uuid, text) to authenticated;

/** Conservation : apprenants inactifs au-delà de la durée du plan (plans.limits.analytics_retention_days). Idempotent. */
create or replace function public.purge_learners()
returns int language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
  counts jsonb := '{}'::jsonb;
begin
  for r in
    select l.id, l.workspace_id from public.learners l
    join public.workspaces w on w.id = l.workspace_id
    join public.plans p on p.code = w.plan_code
    where greatest(l.last_seen_at,
            coalesce((select max(e.occurred_at) from public.learner_visitors lv
                      join public.events e on e.workspace_id = lv.workspace_id and e.visitor_id = lv.visitor_id
                      where lv.learner_id = l.id), l.last_seen_at))
          < now() - make_interval(days => coalesce((p.limits ->> 'analytics_retention_days')::int, 30))
  loop
    perform public.learner_erase_data(r.id);
    n := n + 1;
    counts := jsonb_set(counts, array[r.workspace_id::text],
                        to_jsonb(coalesce((counts ->> r.workspace_id::text)::int, 0) + 1));
  end loop;
  -- Trace par workspace : nombre d'apprenants purgés, sans aucune donnée nominative
  insert into public.audit_log (workspace_id, action, meta)
  select key::uuid, 'learners.purge', jsonb_build_object('count', value::int) from jsonb_each_text(counts);
  return n;
end $$;
revoke all on function public.purge_learners() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('fd_purge_learners', '41 3 * * *', 'select public.purge_learners()');
  else
    raise notice 'pg_cron indisponible : purge des apprenants non planifiée';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Reprise « Bon retour » (player, anon) : lien personnalisé valide sur une démo publiée.
-- Ne renvoie que le prénom et la progression ; '{}' dans tous les autres cas.
-- ---------------------------------------------------------------------------
create or replace function public.learner_resume(p_link_token text, p_demo uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_link public.share_links;
  l public.learners;
  v_first text;
  v_out jsonb;
begin
  select sl.* into v_link from public.share_links sl join public.demos d on d.id = sl.demo_id
   where sl.token = p_link_token and sl.demo_id = p_demo and sl.is_active
     and (sl.expires_at is null or sl.expires_at > now())
     and d.status = 'published' and d.deleted_at is null;
  if not found then return '{}'::jsonb; end if;
  select * into l from public.learners where share_link_id = v_link.id;
  if not found then return '{}'::jsonb; end if;
  v_first := coalesce(nullif(btrim(v_link.variables ->> 'first_name'), ''), split_part(btrim(l.full_name), ' ', 1));
  select jsonb_build_object(
    'firstName', left(coalesce(v_first, ''), 60),
    'module', (select jsonb_build_object('demoId', lm.demo_id, 'seen', lm.steps_seen, 'total', lm.total_steps, 'status', lm.status)
               from public.learner_modules(l.workspace_id) lm where lm.learner_id = l.id and lm.demo_id = p_demo),
    'path', (select jsonb_build_object('title', p.title, 'ordered', p.ordered,
                'modules', (select coalesce(jsonb_agg(jsonb_build_object('title', d.title, 'status', lm.status,
                               'seen', lm.steps_seen, 'total', lm.total_steps, 'current', m.demo_id = p_demo) order by m.position), '[]'::jsonb)
                            from public.path_modules m
                            -- Seulement les modules publiés : aucun titre de brouillon ni de démo supprimée
                            join public.demos d on d.id = m.demo_id and d.status = 'published' and d.deleted_at is null
                            left join public.learner_modules(l.workspace_id) lm on lm.learner_id = l.id and lm.demo_id = m.demo_id
                            where m.path_id = p.id))
             from public.paths p join public.path_modules pm on pm.path_id = p.id and pm.demo_id = p_demo
             order by p.created_at limit 1)
  ) into v_out;
  return v_out;
end $$;
revoke all on function public.learner_resume(text, uuid) from public;
grant execute on function public.learner_resume(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Quiz : tentatives comptées par apprenant (tous ses visiteurs) + tentatives accordées.
-- Corps identique à 20261117131200, seul le calcul de v_attempts / v_used change.
-- ---------------------------------------------------------------------------
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
