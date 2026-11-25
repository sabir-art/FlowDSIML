-- ALERT-01 (docs/ux/specs/alertes-canaux.md §7-8) : canal « Slack » des alertes analytics, par webhook
-- entrant. Nouveau fichier, rien n'est retiré ; idempotent.
--  * Une adresse de webhook par espace, saisie par un propriétaire ou un admin. C'est un secret : elle
--    est rangée dans le schéma private et n'est jamais relue par l'app (état « Connecté » seulement).
--  * Seul l'hôte hooks.slack.com est accepté, en https.
--  * alerts.channels accepte « slack ». Sans webhook enregistré, l'alerte ne part pas sur Slack.
--  * La base ne fait aucun appel : elle range le message (texte et chemin de la page à ouvrir) dans
--    private.slack_outbox. La fonction webhooks-dispatch l'envoie et ajoute le lien « Voir dans
--    Analytics » à partir de son réglage APP_URL (absent : le message part sans lien).
--  * Message d'une ligne : déclencheur, nombre et démo. Jamais de donnée de visiteur.
--  * Trois essais au plus par message, trace de 7 jours.

create schema if not exists private;

create table if not exists private.slack_webhooks (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  url text not null check (url ~ '^https://hooks\.slack\.com/services/[A-Za-z0-9_/-]{8,200}$'),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists private.slack_outbox (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('alert', 'test')),
  body text not null,
  -- Page de l'app à ouvrir (« /#/analytics ») ; l'adresse de l'app est ajoutée par la fonction
  path text check (path is null or path ~ '^/#/[a-z0-9/_-]{0,80}$'),
  attempts int not null default 0,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists slack_outbox_due_idx on private.slack_outbox (created_at) where sent_at is null;
create index if not exists slack_outbox_ws_idx on private.slack_outbox (workspace_id, created_at desc);
revoke all on private.slack_webhooks, private.slack_outbox from public, anon, authenticated;

alter table public.alerts drop constraint if exists alerts_channels_check;
alter table public.alerts add constraint alerts_channels_check check (
  cardinality(channels) between 1 and 4
  and channels <@ array['app', 'webhook', 'email', 'slack']
  and (not ('email' = any (channels)) or 'app' = any (channels))
);

/** Texte sans les caractères que Slack interprète (liens, mentions). */
create or replace function private.slack_escape(p text)
returns text language sql immutable set search_path = '' as $$
  select replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
$$;

/** Range un message pour l'espace (rien si aucun webhook). Renvoie son numéro. */
create or replace function private.slack_enqueue(p_ws uuid, p_kind text, p_text text, p_path text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if not exists (select 1 from private.slack_webhooks where workspace_id = p_ws) then return null; end if;
  delete from private.slack_outbox where created_at < now() - interval '7 days';
  insert into private.slack_outbox (workspace_id, kind, body, path)
    values (p_ws, p_kind, p_text, p_path) returning id into v_id;
  return v_id;
end $$;

/** Ligne d'une alerte : « TutoClick · {déclencheur} : {nombre} sur « {démo} » » (le lien est ajouté à l'envoi). */
create or replace function private.slack_alert_text(a public.alerts, p_data jsonb)
returns text language sql stable set search_path = '' as $$
  select 'TutoClick · '
    || case a.trigger
         when 'lead' then 'Nouveau lead'
         when 'cta' then 'Clic sur le bouton d’action'
         when 'link_opened' then 'Lien personnalisé ouvert'
         when 'completion_below' then 'Taux de complétion sous ' || coalesce(p_data ->> 'threshold', '?') || ' %'
         when 'views_above' then 'Vues au-dessus de ' || coalesce(p_data ->> 'threshold', '?') || ' en 24 h'
         when 'quiz_failed_last' then 'Apprenant en échec au quiz (dernière tentative)'
         when 'structure_below_goal' then 'Structure sous l’objectif de formation'
         else 'Alerte' end
    || ' : '
    || case when p_data ? 'count' then p_data ->> 'count'
            when a.trigger in ('completion_below', 'structure_below_goal') then coalesce(p_data ->> 'value', '?') || ' %'
            else coalesce(p_data ->> 'value', '?') end
    || ' sur « '
    || private.slack_escape(coalesce(
         (select d.title from public.demos d where d.id = a.demo_id),
         (select p.title from public.paths p where p.id = a.path_id),
         'toutes les démos'))
    || ' »';
$$;

/** Déclenchement : notification dans l'app (toujours quand « email » est choisi), webhook, Slack. */
create or replace function private.alert_fire(a public.alerts, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_mail boolean := 'email' = any (a.channels);
begin
  if v_mail or ('app' = any (a.channels) and public.notification_wanted(a.created_by, 'alert')) then
    insert into public.notifications (workspace_id, user_id, kind, demo_id, alert_id, data, email_forced)
    values (a.workspace_id, a.created_by, 'alert', a.demo_id, a.id, p_data, v_mail);
  end if;
  if 'webhook' = any (a.channels) then
    perform public.enqueue_webhook_event(a.workspace_id, 'alert.triggered',
      p_data || jsonb_build_object('alert_id', a.id, 'demo_id', a.demo_id, 'frequency', a.frequency, 'at', now()));
  end if;
  if 'slack' = any (a.channels) then
    perform private.slack_enqueue(a.workspace_id, 'alert', private.slack_alert_text(a, p_data), '/#/analytics');
  end if;
end $$;

/** L'espace a-t-il un webhook Slack ? (membres de l'espace ; l'adresse n'est jamais renvoyée) */
create or replace function public.slack_webhook_connected(p_ws uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'viewer') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return exists (select 1 from private.slack_webhooks where workspace_id = p_ws);
end $$;

/** Enregistre (ou remplace) le webhook Slack de l'espace. Propriétaires et admins. */
create or replace function public.slack_webhook_set(p_ws uuid, p_url text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_url is null or p_url !~ '^https://hooks\.slack\.com/services/[A-Za-z0-9_/-]{8,200}$' then
    raise exception 'SLACK_URL' using errcode = '22023';
  end if;
  insert into private.slack_webhooks (workspace_id, url, created_by)
    values (p_ws, p_url, (select auth.uid()))
    on conflict (workspace_id) do update
      set url = excluded.url, created_by = excluded.created_by, updated_at = now();
end $$;

/** Retire le webhook Slack de l'espace. Propriétaires et admins. Les alertes gardent leur réglage. */
create or replace function public.slack_webhook_remove(p_ws uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  delete from private.slack_webhooks where workspace_id = p_ws;
  -- Les messages en attente ne partiront plus
  delete from private.slack_outbox where workspace_id = p_ws and sent_at is null;
end $$;

/**
 * « Envoyer un test » : range un message de test et renvoie son numéro (l'app demande ensuite son envoi
 * immédiat à webhooks-dispatch). Propriétaires et admins ; 5 tests par minute au plus. null : aucun
 * webhook enregistré.
 */
create or replace function public.slack_webhook_test(p_ws uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if (select count(*) from private.slack_outbox
       where workspace_id = p_ws and kind = 'test' and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'SLACK_RATE' using errcode = '54000';
  end if;
  return private.slack_enqueue(p_ws, 'test',
    'TutoClick · Test de connexion réussi pour l''espace « '
    || private.slack_escape((select name from public.workspaces where id = p_ws)) || ' ».', null);
end $$;

/**
 * Messages à envoyer (webhooks-dispatch, service_role) : pas encore partis, moins de 3 essais, pas déjà
 * en cours (bail de 2 min), de moins d'un jour. Chaque message rendu compte un essai.
 */
create or replace function public.slack_claim_due(p_limit int default 25)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare res jsonb;
begin
  with due as (
    select o.id from private.slack_outbox o
     where o.sent_at is null and o.attempts < 3 and o.created_at > now() - interval '1 day'
       and (o.lease_until is null or o.lease_until <= now())
     order by o.id
     limit least(greatest(coalesce(p_limit, 25), 1), 100)
     for update skip locked
  ), upd as (
    update private.slack_outbox o set attempts = o.attempts + 1, lease_until = now() + interval '2 minutes'
      from due where o.id = due.id
    returning o.id, o.workspace_id, o.body, o.path
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'url', w.url, 'text', u.body, 'path', u.path) order by u.id), '[]'::jsonb)
    into res
    from upd u join private.slack_webhooks w on w.workspace_id = u.workspace_id;
  return res;
end $$;

/**
 * Envoi immédiat d'un test (webhooks-dispatch, service_role, pour le compte de p_user) : le message n'est
 * rendu que s'il est un test en attente et que p_user est admin de son espace ; sinon null, comme pour
 * un message inexistant.
 */
create or replace function public.slack_claim_test(p_id bigint, p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare res jsonb;
begin
  with upd as (
    update private.slack_outbox o set attempts = o.attempts + 1, lease_until = now() + interval '2 minutes'
     where o.id = p_id and o.kind = 'test' and o.sent_at is null and o.attempts < 3
       and (o.lease_until is null or o.lease_until <= now())
       and exists (select 1 from public.members m
                    where m.workspace_id = o.workspace_id and m.user_id = p_user and m.role >= 'admin')
    returning o.id, o.workspace_id, o.body, o.path
  )
  select jsonb_build_object('id', u.id, 'url', w.url, 'text', u.body, 'path', u.path) into res
    from upd u join private.slack_webhooks w on w.workspace_id = u.workspace_id;
  return res;
end $$;

/** Résultat d'un envoi (webhooks-dispatch, service_role) : parti, ou à réessayer à la tâche suivante. */
create or replace function public.slack_record_result(p_id bigint, p_ok boolean)
returns void language sql security definer set search_path = '' as $$
  update private.slack_outbox
     set sent_at = case when p_ok then now() end, lease_until = null
   where id = p_id and sent_at is null;
$$;

/** Tâche de chaque minute : appelle webhooks-dispatch seulement si un message Slack attend. */
create or replace function public.slack_dispatch_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from private.slack_outbox o
                  where o.sent_at is null and o.attempts < 3 and o.created_at > now() - interval '1 day'
                    and (o.lease_until is null or o.lease_until <= now())) then
    return;
  end if;
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then
    raise notice 'Slack : Vault ou pg_net indisponible, envoi différé';
    return;
  end if;
  execute 'select (select decrypted_secret from vault.decrypted_secrets where name = $1),
                  (select decrypted_secret from vault.decrypted_secrets where name = $2)'
    into v_url, v_secret using 'webhooks_dispatch_url', 'webhooks_dispatch_secret';
  if v_url is null or v_secret is null then
    raise notice 'Slack : secret ou URL de dispatch absents de Vault, envoi différé';
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
    using v_url, '{"task":"slack"}'::jsonb,
          jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json');
end $$;

revoke all on function private.slack_escape(text), private.slack_enqueue(uuid, text, text, text),
  private.slack_alert_text(public.alerts, jsonb), private.alert_fire(public.alerts, jsonb)
  from public, anon, authenticated;
revoke all on function public.slack_claim_due(int), public.slack_claim_test(bigint, uuid),
  public.slack_record_result(bigint, boolean), public.slack_dispatch_tick() from public, anon, authenticated;
grant execute on function public.slack_claim_due(int), public.slack_claim_test(bigint, uuid),
  public.slack_record_result(bigint, boolean) to service_role;
revoke all on function public.slack_webhook_connected(uuid), public.slack_webhook_set(uuid, text),
  public.slack_webhook_remove(uuid), public.slack_webhook_test(uuid) from public, anon;
grant execute on function public.slack_webhook_connected(uuid), public.slack_webhook_set(uuid, text),
  public.slack_webhook_remove(uuid), public.slack_webhook_test(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('fd_slack_dispatch', '* * * * *', 'select public.slack_dispatch_tick()');
  else
    raise notice 'pg_cron indisponible : messages Slack non planifiés';
  end if;
end $$;
