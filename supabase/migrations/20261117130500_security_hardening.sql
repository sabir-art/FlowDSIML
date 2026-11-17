-- FlowDSIML — durcissement sécurité (reproduit le hotfix appliqué en prod, de façon idempotente)
-- 1. Les partitions de public.events sont des tables à part entière : sans RLS ni revoke, elles
--    étaient lisibles directement via PostgREST (anon/authenticated). La RLS du parent ne les protège pas.
-- 2. Les fonctions trigger et utilitaires internes ne doivent pas être exécutables via l'API.

-- Verrouille une partition : RLS activée (aucune politique = aucun accès) + aucun privilège client.
create or replace function public.lock_events_partition(p_table regclass)
returns void language plpgsql security definer set search_path = '' as $$
begin
  execute format('alter table %s enable row level security', p_table);
  execute format('revoke all on %s from anon, authenticated', p_table);
end $$;

-- Partitions existantes
do $$
declare r record;
begin
  for r in
    select c.oid::regclass as rel
    from pg_inherits i join pg_class c on c.oid = i.inhrelid
    where i.inhparent = 'public.events'::regclass
  loop
    perform public.lock_events_partition(r.rel);
  end loop;
end $$;

-- Partitions futures : ensure_events_partitions verrouille chaque partition qu'elle crée.
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
    perform public.lock_events_partition(('public.' || quote_ident(name))::regclass);
  end loop;
  perform public.lock_events_partition('public.events_default'::regclass);
end $$;

-- Ceinture et bretelles : tout CREATE TABLE … PARTITION OF events est verrouillé (event trigger).
create or replace function public.lock_new_events_partitions()
returns event_trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select * from pg_event_trigger_ddl_commands() where command_tag = 'CREATE TABLE' and schema_name = 'public' loop
    if exists (select 1 from pg_inherits where inhrelid = r.objid and inhparent = 'public.events'::regclass) then
      perform public.lock_events_partition(r.objid::regclass);
    end if;
  end loop;
end $$;

do $$
begin
  -- Les event triggers exigent un superutilisateur ; sur Supabase le rôle postgres peut ne pas l'être.
  if not exists (select 1 from pg_event_trigger where evtname = 'fd_lock_events_partitions') then
    begin
      create event trigger fd_lock_events_partitions on ddl_command_end
        when tag in ('CREATE TABLE') execute function public.lock_new_events_partitions();
    exception when insufficient_privilege then
      raise notice 'event trigger non créé (privilèges insuffisants) : ensure_events_partitions reste le garde-fou';
    end;
  end if;
end $$;

-- Fonctions internes : pas d'exécution via l'API.
do $$
declare f text;
begin
  foreach f in array array[
    'public.set_updated_at()', 'public.handle_new_user()', 'public.inherit_workspace_from_demo()',
    'public.inherit_from_step()', 'public.forms_check_demo()', 'public.enforce_step_limit()',
    'public.guard_members()', 'public.ensure_events_partitions(int)', 'public.purge_old_events()',
    'public.lock_events_partition(regclass)', 'public.lock_new_events_partitions()',
    'public.limit_reached(uuid, text, bigint)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

select public.ensure_events_partitions(2);
