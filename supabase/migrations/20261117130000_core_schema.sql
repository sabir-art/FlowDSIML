-- FlowDSIML — schéma principal (MVP)
-- Non destructif : uniquement des CREATE ... IF NOT EXISTS / CREATE OR REPLACE.
-- Convention : toute table tenant porte workspace_id ; RLS activée partout.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
do $$ begin
  -- L'ordre de déclaration définit la hiérarchie (viewer < editor < admin < owner).
  create type public.workspace_role as enum ('viewer', 'editor', 'admin', 'owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.demo_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.step_kind as enum ('image', 'text', 'html');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Plans (limites modélisées en base ; Stripe plus tard)
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  code text primary key,
  name text not null,
  sort int not null default 0,
  limits jsonb not null default '{}'::jsonb
);

insert into public.plans (code, name, sort, limits) values
  ('free', 'Free', 0, '{"published_demos":3,"members":2,"steps_per_demo":30,"remove_branding":false,"lead_forms":false,"analytics_retention_days":30}'),
  ('pro', 'Pro', 1, '{"published_demos":25,"members":5,"steps_per_demo":100,"remove_branding":true,"lead_forms":true,"analytics_retention_days":365}'),
  ('business', 'Business', 2, '{"published_demos":null,"members":25,"steps_per_demo":null,"remove_branding":true,"lead_forms":true,"analytics_retention_days":730}'),
  ('enterprise', 'Enterprise', 3, '{"published_demos":null,"members":null,"steps_per_demo":null,"remove_branding":true,"lead_forms":true,"analytics_retention_days":1095}')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Profils (1–1 avec auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  avatar_url text,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'fr' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Workspaces, membres, invitations
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  plan_code text not null default 'free' references public.plans (code),
  logo_path text,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists members_user_idx on public.members (user_id, workspace_id);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (email = lower(email) and email like '%@%'),
  role public.workspace_role not null default 'editor',
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz
);
create unique index if not exists invitations_pending_uniq
  on public.invitations (workspace_id, email) where accepted_at is null;

-- Vérification de rôle — utilisée par toutes les politiques RLS.
create or replace function public.has_role(ws uuid, min_role public.workspace_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role >= min_role
  );
$$;

create or replace function public.my_role(ws uuid)
returns public.workspace_role language sql stable security definer set search_path = '' as $$
  select m.role from public.members m where m.workspace_id = ws and m.user_id = (select auth.uid());
$$;

create or replace function public.plan_limit(ws uuid, key text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select p.limits -> key from public.workspaces w join public.plans p on p.code = w.plan_code where w.id = ws;
$$;

-- Une limite numérique est-elle atteinte ? (null = illimité)
create or replace function public.limit_reached(ws uuid, key text, current_count bigint)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  v := public.plan_limit(ws, key);
  if v is null or jsonb_typeof(v) = 'null' then return false; end if;
  return current_count >= (v #>> '{}')::bigint;
end $$;

-- ---------------------------------------------------------------------------
-- Contenu
-- ---------------------------------------------------------------------------
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  parent_id uuid references public.folders (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
create index if not exists folders_ws_idx on public.folders (workspace_id);

create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null default 'Thème',
  tokens jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists themes_ws_idx on public.themes (workspace_id);

create table if not exists public.variables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label text not null default '',
  default_value text not null default '',
  unique (workspace_id, key)
);

create table if not exists public.demos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null default 'Nouvelle démo' check (char_length(title) between 1 and 160),
  status public.demo_status not null default 'draft',
  theme_id uuid references public.themes (id) on delete set null,
  -- settings : { locale, allowedEmbedOrigins[], variables[] (clés locales), theme (surcharges) }
  settings jsonb not null default '{}'::jsonb,
  cover_path text,
  current_version_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists demos_ws_idx on public.demos (workspace_id, updated_at desc);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references public.demos (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  position int not null default 0
);
create index if not exists chapters_demo_idx on public.chapters (demo_id, position);

create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  demo_id uuid references public.demos (id) on delete cascade,
  title text not null default 'Accédez à la démo',
  description text not null default '',
  submit_label text not null default 'Continuer',
  fields jsonb not null default '[{"key":"email","label":"Email professionnel","type":"email","required":true}]'::jsonb,
  consent_text text not null default '',
  skippable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists forms_demo_idx on public.forms (demo_id);

create table if not exists public.steps (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references public.demos (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  position int not null default 0,
  chapter_id uuid references public.chapters (id) on delete set null,
  kind public.step_kind not null default 'image',
  image_path text,
  image_width int,
  image_height int,
  snapshot_path text,
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 4000),
  zoom jsonb,
  blurs jsonb not null default '[]'::jsonb,
  gate_form_id uuid references public.forms (id) on delete set null,
  cta jsonb,
  page_url text,
  page_title text,
  element_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists steps_demo_idx on public.steps (demo_id, position);

create table if not exists public.hotspots (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.steps (id) on delete cascade,
  demo_id uuid not null references public.demos (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  x real not null check (x between 0 and 1),
  y real not null check (y between 0 and 1),
  w real not null default 0.04 check (w between 0 and 1),
  h real not null default 0.04 check (h between 0 and 1),
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 4000),
  placement text not null default 'auto' check (placement in ('auto', 'top', 'bottom', 'left', 'right')),
  action jsonb not null default '{"type":"next"}'::jsonb,
  cta jsonb,
  pulse boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hotspots_step_idx on public.hotspots (step_id, position);

create table if not exists public.demo_versions (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references public.demos (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  number int not null,
  manifest jsonb not null,
  published_by uuid references auth.users (id) on delete set null,
  published_at timestamptz not null default now(),
  unique (demo_id, number)
);

do $$ begin
  alter table public.demos
    add constraint demos_current_version_fk foreign key (current_version_id)
    references public.demo_versions (id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references public.demos (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  name text not null default '' check (char_length(name) <= 120),
  variables jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists share_links_demo_idx on public.share_links (demo_id);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  demo_id uuid references public.demos (id) on delete set null,
  version_id uuid references public.demo_versions (id) on delete set null,
  link_id uuid references public.share_links (id) on delete set null,
  visitor_id text,
  email text not null check (char_length(email) <= 254 and email like '%@%'),
  fields jsonb not null default '{}'::jsonb,
  consent boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists leads_ws_idx on public.leads (workspace_id, created_at desc);
create index if not exists leads_demo_idx on public.leads (demo_id, created_at desc);

create table if not exists public.subscriptions (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  plan_code text not null references public.plans (code),
  status text not null default 'active' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  provider text,           -- 'stripe' plus tard ; null = attribué manuellement
  provider_ref text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Événements analytics (partitionnés par mois)
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id bigint generated always as identity,
  workspace_id uuid not null,
  demo_id uuid not null,
  version_id uuid,
  link_id uuid,
  visitor_id text not null,
  session_id text not null,
  type text not null,
  step_id text,
  step_index int,
  hotspot_id text,
  props jsonb not null default '{}'::jsonb,
  referrer_host text,
  embed_origin text,
  occurred_at timestamptz not null default now(),
  primary key (id, occurred_at)
) partition by range (occurred_at);

create table if not exists public.events_default partition of public.events default;
create index if not exists events_demo_time_idx on public.events (demo_id, occurred_at);
create index if not exists events_ws_time_idx on public.events (workspace_id, occurred_at);

create or replace function public.ensure_events_partitions(months_ahead int default 2)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m date;
  name text;
begin
  for i in 0..months_ahead loop
    m := (date_trunc('month', now()) + make_interval(months => i))::date;
    name := 'events_' || to_char(m, 'YYYY_MM');
    if to_regclass('public.' || name) is null then
      execute format(
        'create table public.%I partition of public.events for values from (%L) to (%L)',
        name, m, (m + interval '1 month')::date
      );
    end if;
  end loop;
end $$;

select public.ensure_events_partitions(2);

-- ---------------------------------------------------------------------------
-- Triggers d'intégrité
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'workspaces', 'themes', 'demos', 'forms', 'steps', 'hotspots'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- workspace_id des enfants dérivé du parent (empêche un rattachement croisé entre workspaces).
create or replace function public.inherit_workspace_from_demo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select d.workspace_id into new.workspace_id from public.demos d where d.id = new.demo_id;
  if new.workspace_id is null then raise exception 'demo % introuvable', new.demo_id; end if;
  return new;
end $$;

create or replace function public.inherit_from_step() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select s.demo_id, s.workspace_id into new.demo_id, new.workspace_id from public.steps s where s.id = new.step_id;
  if new.demo_id is null then raise exception 'step % introuvable', new.step_id; end if;
  return new;
end $$;

drop trigger if exists inherit_ws on public.chapters;
create trigger inherit_ws before insert or update of demo_id on public.chapters
  for each row execute function public.inherit_workspace_from_demo();
drop trigger if exists inherit_ws on public.steps;
create trigger inherit_ws before insert or update of demo_id on public.steps
  for each row execute function public.inherit_workspace_from_demo();
drop trigger if exists inherit_ws on public.share_links;
create trigger inherit_ws before insert or update of demo_id on public.share_links
  for each row execute function public.inherit_workspace_from_demo();
drop trigger if exists inherit_ws on public.hotspots;
create trigger inherit_ws before insert or update of step_id on public.hotspots
  for each row execute function public.inherit_from_step();

create or replace function public.forms_check_demo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.demo_id is not null and not exists (
    select 1 from public.demos d where d.id = new.demo_id and d.workspace_id = new.workspace_id
  ) then
    raise exception 'formulaire et démo de workspaces différents';
  end if;
  return new;
end $$;
drop trigger if exists forms_check_demo on public.forms;
create trigger forms_check_demo before insert or update on public.forms
  for each row execute function public.forms_check_demo();

-- Limite d'étapes par démo selon le plan.
create or replace function public.enforce_step_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
  select count(*) into n from public.steps where demo_id = new.demo_id;
  if public.limit_reached(new.workspace_id, 'steps_per_demo', n) then
    raise exception 'PLAN_LIMIT:steps_per_demo' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists enforce_step_limit on public.steps;
create trigger enforce_step_limit before insert on public.steps
  for each row execute function public.enforce_step_limit();

-- Garde-fous sur les membres : rôle owner réservé aux owners, dernier owner protégé.
create or replace function public.guard_members() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor public.workspace_role;
  owners bigint;
begin
  -- Les appels internes (fonctions security definer, service_role) passent sans acteur.
  if (select auth.uid()) is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  -- Suppression en cascade du workspace : rien à protéger.
  if tg_op = 'DELETE' and not exists (select 1 from public.workspaces where id = old.workspace_id) then
    return old;
  end if;
  -- Premier membre d'un workspace (create_workspace) : owner autorisé.
  if tg_op = 'INSERT' and not exists (select 1 from public.members where workspace_id = new.workspace_id) then
    return new;
  end if;
  actor := public.my_role(coalesce(new.workspace_id, old.workspace_id));

  if tg_op in ('INSERT', 'UPDATE') and new.role = 'owner' and actor is distinct from 'owner' then
    raise exception 'Seul un owner peut attribuer le rôle owner';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and actor is distinct from 'owner' then
    raise exception 'Seul un owner peut modifier un owner';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner') then
    select count(*) into owners from public.members where workspace_id = old.workspace_id and role = 'owner';
    if owners <= 1 then raise exception 'Le workspace doit garder au moins un owner'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists guard_members on public.members;
create trigger guard_members before insert or update or delete on public.members
  for each row execute function public.guard_members();
