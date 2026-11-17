-- FlowDSIML — tâches planifiées (pg_cron), uniquement si l'extension est disponible.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    -- Partitions des événements : le 1er de chaque mois, 3 h UTC
    perform cron.schedule('fd_events_partitions', '0 3 1 * *', 'select public.ensure_events_partitions(2)');
    -- Rétention : chaque nuit, 3 h 30 UTC
    perform cron.schedule('fd_purge_events', '30 3 * * *', 'select public.purge_old_events()');
  else
    raise notice 'pg_cron indisponible : tâches planifiées non créées';
  end if;
end $$;
