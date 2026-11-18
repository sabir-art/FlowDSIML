-- L23 : la purge du journal des webhooks ne supprime plus d'envoi jamais parti.
-- Statuts finaux (success, failed, dead) : 7 jours. En attente ou en cours (pending, sending) : 30 jours,
-- pour couvrir un tick inactif (secrets pas encore créés) ou un webhook resté en pause automatique.
-- Par lots de 5 000 lignes, 200 000 au plus par exécution : la suite part au passage suivant (quotidien).
-- Les envois d'un webhook supprimé restent supprimés en cascade (clé étrangère, inchangée).

create or replace function public.purge_webhook_deliveries()
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_batch constant int := 5000;
  v_max_batches constant int := 40;
  v_n int;
  v_total int := 0;
begin
  for i in 1 .. v_max_batches loop
    delete from public.webhook_deliveries d
     where d.id in (
       select x.id from public.webhook_deliveries x
        where (x.status in ('success', 'failed', 'dead') and x.created_at < now() - interval '7 days')
           or (x.status in ('pending', 'sending') and x.created_at < now() - interval '30 days')
        limit v_batch
     );
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
    exit when v_n < v_batch;
  end loop;
  return v_total;
end $$;

revoke all on function public.purge_webhook_deliveries() from public, anon, authenticated;
