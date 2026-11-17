-- Tests pgTAP : durcissement (partitions d'events, fonctions internes).
begin;
set search_path = public, extensions;
select plan(7);

select ok(
  (select bool_and(c.relrowsecurity) from pg_inherits i join pg_class c on c.oid = i.inhrelid where i.inhparent = 'public.events'::regclass),
  'toutes les partitions d''events ont la RLS activée');
select ok(
  not exists (
    select 1 from pg_inherits i join pg_class c on c.oid = i.inhrelid
    where i.inhparent = 'public.events'::regclass
      and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select'))),
  'aucune partition lisible directement par anon/authenticated');

-- Nouvelle partition créée par la tâche planifiée (simulée 14 mois plus tard)
select public.ensure_events_partitions(14);
select ok(
  (select bool_and(c.relrowsecurity) and not bool_or(has_table_privilege('anon', c.oid, 'select'))
   from pg_inherits i join pg_class c on c.oid = i.inhrelid where i.inhparent = 'public.events'::regclass),
  'les partitions futures sont verrouillées automatiquement');

select ok(not has_function_privilege('anon', 'public.handle_new_user()', 'execute'), 'trigger handle_new_user non exécutable par anon');
select ok(not has_function_privilege('authenticated', 'public.ensure_events_partitions(int)', 'execute'), 'ensure_events_partitions non exécutable par authenticated');
select ok(not has_function_privilege('anon', 'public.purge_old_events()', 'execute'), 'purge_old_events non exécutable par anon');
select ok(has_function_privilege('anon', 'public.track_events(jsonb)', 'execute'), 'track_events reste exécutable par anon (voulu)');

select * from finish();
rollback;
