-- Imitation minimale de l'environnement Supabase pour tester les migrations
-- sur un Postgres nu (CI sans Docker). NE PAS appliquer sur un vrai projet Supabase.
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgtap with schema extensions;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id), name text, owner uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;

grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
grant select on auth.users to service_role;
grant all on storage.objects to authenticated, service_role;
grant select on storage.buckets to anon, authenticated;
-- Supabase accorde par défaut tous les droits sur public à anon/authenticated (RLS fait le tri).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- Publication Realtime (créée par Supabase ; les migrations y ajoutent des tables).
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Realtime Authorization (fourni par Supabase) : table des messages et sujet du canal courant.
create schema if not exists realtime;
create table if not exists realtime.messages (
  id bigint generated always as identity primary key,
  topic text not null, extension text not null, payload jsonb, event text,
  private boolean default true, inserted_at timestamptz default now()
);
alter table realtime.messages enable row level security;
create or replace function realtime.topic() returns text language sql stable as $$
  select nullif(current_setting('realtime.topic', true), '')
$$;
grant usage on schema realtime to anon, authenticated, service_role;
grant select, insert on realtime.messages to anon, authenticated;
grant execute on function realtime.topic() to anon, authenticated;
