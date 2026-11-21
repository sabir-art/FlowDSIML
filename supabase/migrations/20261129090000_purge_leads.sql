-- RGPD (171) : purge automatique des leads au-delà de la durée de conservation du plan.
-- Durée : plans.limits.analytics_retention_days (30 jours par défaut), la même que pour les événements et
-- les apprenants ; il n'existe pas de durée dédiée aux leads. Trace par espace dans audit_log
-- (« leads.purge », nombre supprimé, aucune donnée nominative). Planifiée chaque nuit par pg_cron.

alter table public.audit_log drop constraint if exists audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check check (action in
  ('learners.export', 'learner.erase', 'learners.purge', 'webhook.secret_revealed', 'webhook.secret_rotated',
   'settings.html_capture', 'leads.purge'));

create schema if not exists private;

/** Supprime les leads plus vieux que la durée du plan de leur espace ; renvoie le nombre supprimé. Idempotent. */
create or replace function private.purge_leads()
returns int language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  with gone as (
    delete from public.leads l
    using public.workspaces w, public.plans p
    where w.id = l.workspace_id and p.code = w.plan_code
      and l.created_at < now() - make_interval(days => coalesce((p.limits ->> 'analytics_retention_days')::int, 30))
    returning l.workspace_id
  ), counts as (
    select workspace_id, count(*)::int as c from gone group by workspace_id
  ), logged as (
    insert into public.audit_log (workspace_id, action, meta)
    select workspace_id, 'leads.purge', jsonb_build_object('count', c) from counts
    returning 1
  )
  select coalesce(sum(c), 0)::int into n from counts;
  return n;
end $$;
revoke all on function private.purge_leads() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('fd_purge_leads', '47 3 * * *', 'select private.purge_leads()');
  else
    raise notice 'pg_cron indisponible : purge des leads non planifiée';
  end if;
end $$;
