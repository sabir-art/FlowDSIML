-- Retours client, planche 4 (fenêtre Slack). Nouveau fichier, rien n'est retiré ; idempotent.
--  * « Alertes analytics » devient un interrupteur : une colonne alerts (vrai par défaut) sur le webhook.
--    Coupé, les alertes ne partent plus sur Slack ; le test, si.
--  * État connecté : l'adresse s'affiche masquée (« hooks.slack.com/services/T000…/•••• ») : les
--    4 premiers caractères de l'identifiant de l'espace Slack seulement. La partie secrète (la fin) n'est
--    jamais renvoyée.

alter table private.slack_webhooks add column if not exists alerts boolean not null default true;

/** Range un message pour l'espace (rien si aucun webhook, ni pour une alerte si l'interrupteur est coupé). */
create or replace function private.slack_enqueue(p_ws uuid, p_kind text, p_text text, p_path text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if not exists (
    select 1 from private.slack_webhooks
    where workspace_id = p_ws and (p_kind <> 'alert' or alerts)
  ) then
    return null;
  end if;
  delete from private.slack_outbox where created_at < now() - interval '7 days';
  insert into private.slack_outbox (workspace_id, kind, body, path)
    values (p_ws, p_kind, p_text, p_path) returning id into v_id;
  return v_id;
end $$;

/** État du webhook Slack de l'espace : connecté, adresse masquée, alertes. Membres de l'espace. */
create or replace function public.slack_webhook_info(p_ws uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_url text; v_alerts boolean;
begin
  if not public.has_role(p_ws, 'viewer') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select url, alerts into v_url, v_alerts from private.slack_webhooks where workspace_id = p_ws;
  if v_url is null then
    return jsonb_build_object('connected', false);
  end if;
  return jsonb_build_object(
    'connected', true,
    'alerts', v_alerts,
    'masked', 'hooks.slack.com/services/'
      || left(split_part(substr(v_url, length('https://hooks.slack.com/services/') + 1), '/', 1), 4)
      || '…/••••'
  );
end $$;

/** Interrupteur « Alertes analytics » du canal Slack. Propriétaires et admins. */
create or replace function public.slack_webhook_alerts(p_ws uuid, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update private.slack_webhooks set alerts = coalesce(p_on, true), updated_at = now()
    where workspace_id = p_ws;
end $$;

revoke all on function private.slack_enqueue(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.slack_webhook_info(uuid), public.slack_webhook_alerts(uuid, boolean)
  from public, anon;
grant execute on function public.slack_webhook_info(uuid), public.slack_webhook_alerts(uuid, boolean)
  to authenticated;
