-- L66 §3 : bilan de présentation et historique. Nouveau fichier, rien n'est retiré ; idempotent.
--  * Les bilans sont gardés 90 jours (au lieu de 30), toujours visibles par la seule personne qui a
--    présenté. Aucune donnée du public.
--  * Affichage de la présentation (« two » : deux fenêtres, « one » : un seul écran), pour le sous-titre
--    du bilan. Les étapes dont les notes ont changé sont marquées dans steps ({ ..., "noted": true }).

alter table public.present_reports add column if not exists mode text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'present_reports_mode_ok') then
    alter table public.present_reports
      add constraint present_reports_mode_ok check (mode is null or mode in ('two', 'one'));
  end if;
end $$;

drop policy if exists present_reports_select on public.present_reports;
create policy present_reports_select on public.present_reports for select to authenticated
  using (owner = (select auth.uid()) and created_at > now() - interval '90 days');

create or replace function public.purge_present()
returns void language sql security definer set search_path = '' as $$
  update private.present_pair_throttle set failures = 0, window_start = now()
    where window_start < now() - interval '10 minutes' and (blocked_until is null or blocked_until < now());
  delete from public.present_remotes where ended_at < now() - interval '1 day' or expires_at < now() - interval '1 day';
  delete from public.present_reports where created_at < now() - interval '90 days';
$$;
revoke all on function public.purge_present() from public, anon, authenticated;
