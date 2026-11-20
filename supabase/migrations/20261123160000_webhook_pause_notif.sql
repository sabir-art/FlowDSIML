-- L29 dette L23 (docs/tech/dettes.md) : notification dans l'app quand un webhook passe en pause
-- automatique après 6 échecs. Destinataires : propriétaires et admins de l'espace (ceux qui voient
-- l'écran des webhooks). Aucun droit nouveau : l'insertion se fait par un déclencheur (security
-- definer), la lecture reste celle des notifications (chacun les siennes). Idempotent.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('mention', 'comment', 'reply', 'resolved', 'alert', 'webhook_paused'));
alter table public.notifications drop constraint if exists notifications_kind_refs;
alter table public.notifications add constraint notifications_kind_refs check (case
  when kind = 'alert' then alert_id is not null and comment_id is null
  -- Webhook en pause : ni démo, ni étape, ni commentaire ; l'adresse (hôte seul) est dans data
  when kind = 'webhook_paused' then alert_id is null and comment_id is null and demo_id is null and step_id is null
  else demo_id is not null and step_id is not null and alert_id is null end);

create or replace function public.notify_webhook_paused()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.state = 'paused_auto' and old.state is distinct from 'paused_auto' then
    insert into public.notifications (workspace_id, user_id, kind, data)
    select new.workspace_id, m.user_id, 'webhook_paused',
           jsonb_build_object('webhookId', new.id,
                              -- Hôte seul : jamais le chemin ni les paramètres de l'adresse
                              'host', left(coalesce(substring(new.url from '^https://([^/:?#]+)'), ''), 200),
                              'name', left(new.name, 60))
      from public.members m
     where m.workspace_id = new.workspace_id and m.role in ('owner', 'admin');
  end if;
  return new;
end $$;
revoke execute on function public.notify_webhook_paused() from public, anon, authenticated;
drop trigger if exists webhooks_notify_paused on public.webhooks;
create trigger webhooks_notify_paused after update of state on public.webhooks
  for each row execute function public.notify_webhook_paused();
