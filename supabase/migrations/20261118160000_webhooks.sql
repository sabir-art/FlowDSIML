-- FlowDSIML — L23 Intégrations : webhooks sortants signés (spec A5 §2). Idempotent, additif.
-- Schéma approuvé par le chef d'équipe (secrets en schéma private, secret de dispatch en Vault).
--  * webhooks : URL https (adresses privées, internes et IP réservées refusées), événements abonnés,
--    état actif / en pause / en pause automatique. Lecture et écriture : admin du workspace seulement.
--  * private.webhook_secrets : secret de signature (« tcsec_… »), ancien secret valable 24 h après un
--    renouvellement. Aucun droit pour anon ni authenticated ; montré une seule fois (création ou
--    renouvellement), jamais relisible ensuite ; lu par la fonction de dispatch via RPC (rôle service).
--  * webhook_deliveries : journal des envois (7 jours), un identifiant d'événement stable (idempotence),
--    essais à 1 min, 5 min, 30 min, 2 h, 6 h ; au 6e échec, envoi « dead » et webhook en pause auto.
--  * Événements créés côté serveur uniquement (déclencheurs) : lead.created (seul à porter l'e-mail et
--    les champs, et seulement vers les webhooks abonnés à lead.created), demo.completed, demo.published,
--    quiz.passed ; « ping » pour le test.
--  * Envoi par l'Edge Function webhooks-dispatch, appelée chaque minute par pg_cron + pg_net. L'URL de la
--    fonction et le secret partagé sont lus dans Vault (webhooks_dispatch_url, webhooks_dispatch_secret) :
--    absents, le job ne fait rien (notice). Rien de tout cela n'est dans le dépôt.

-- ===== Extensions (pg_net absent en prod jusqu'ici ; absent aussi des Postgres de test) =====
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  else
    raise notice 'pg_net indisponible : envoi des webhooks non planifié';
  end if;
end $$;

create schema if not exists private;
revoke all on schema private from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema private from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema private from authenticated';
  end if;
end $$;

-- ===== Limites du plan (lues dans plans.limits, jamais en dur ailleurs) =====
update public.plans set limits = limits || jsonb_build_object('webhooks',
    case code when 'free' then to_jsonb(0) when 'pro' then to_jsonb(3) when 'business' then to_jsonb(20) else 'null'::jsonb end)
  where not (limits ? 'webhooks');

-- ===== Journal : affichage et renouvellement d'un secret =====
alter table public.audit_log drop constraint if exists audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check check (action in
  ('learners.export', 'learner.erase', 'learners.purge', 'webhook.secret_revealed', 'webhook.secret_rotated'));

-- ===== Règles =====
create or replace function public.webhook_event_types()
returns text[] language sql immutable set search_path = '' as $$
  select array['lead.created', 'demo.completed', 'demo.published', 'quiz.passed'];
$$;

/**
 * URL acceptable à l'enregistrement : https, 2 048 caractères, ni identifiants, ni port exotique, ni nom
 * local ou interne, ni IP littérale privée ou réservée (IPv6 littérale refusée). La fonction de dispatch
 * revérifie après résolution DNS (contre le rebinding).
 */
create or replace function public.webhook_url_ok(p_url text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  v_auth text;
  v_host text;
  v_port text;
  v_ip inet;
begin
  if p_url is null or char_length(p_url) > 2048 or p_url !~ '^https://[^/?#\s]+([/?#][^\s]*)?$' then return false; end if;
  v_auth := lower(substring(p_url from '^https://([^/?#]+)'));
  if v_auth like '%@%' or v_auth like '[%' then return false; end if;
  v_host := split_part(v_auth, ':', 1);
  v_port := nullif(split_part(v_auth, ':', 2), '');
  if v_auth ~ ':.*:' or (v_port is not null and v_port not in ('443', '8443')) then return false; end if;
  v_host := rtrim(v_host, '.');
  if v_host = '' or v_host !~ '^[a-z0-9.-]+$' or position('.' in v_host) = 0 then return false; end if;
  if v_host = 'localhost' or v_host ~ '\.(localhost|local|internal|intranet|lan|home\.arpa|corp)$' then return false; end if;
  -- Formes numériques détournées (décimal, hexadécimal, octal) : refusées
  -- (seul un hôte entièrement numérique ou hexadécimal est concerné ; « a.05shop.example » reste valide)
  if v_host ~ '^[0-9.]+$' and v_host !~ '^(0|[1-9][0-9]{0,2})(\.(0|[1-9][0-9]{0,2})){3}$' then return false; end if;
  if v_host ~ '^(0x[0-9a-f]*|[0-9]+)(\.(0x[0-9a-f]*|[0-9]+))*$' then
    if v_host !~ '^[0-9.]+$' then return false; end if;
  end if;
  if v_host ~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' then
    begin
      v_ip := v_host::inet;
    exception when others then
      return false;
    end;
    if v_ip << '0.0.0.0/8' or v_ip << '10.0.0.0/8' or v_ip << '100.64.0.0/10' or v_ip << '127.0.0.0/8'
       or v_ip << '169.254.0.0/16' or v_ip << '172.16.0.0/12' or v_ip << '192.0.0.0/24' or v_ip << '192.0.2.0/24'
       or v_ip << '192.168.0.0/16' or v_ip << '198.18.0.0/15' or v_ip << '198.51.100.0/24' or v_ip << '203.0.113.0/24'
       or v_ip << '224.0.0.0/4' or v_ip << '240.0.0.0/4' then
      return false;
    end if;
  end if;
  return true;
end $$;

-- ===== Tables =====
create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  url text not null constraint webhooks_url_ok check (public.webhook_url_ok(url)),
  events text[] not null constraint webhooks_events_ok
    check (cardinality(events) between 1 and 4 and events <@ public.webhook_event_types()),
  state text not null default 'active' check (state in ('active', 'paused', 'paused_auto')),
  failures int not null default 0 check (failures >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists webhooks_ws_idx on public.webhooks (workspace_id) where state = 'active';

create table if not exists private.webhook_secrets (
  webhook_id uuid primary key references public.webhooks (id) on delete cascade,
  secret text not null,
  previous_secret text,
  previous_until timestamptz
);
revoke all on private.webhook_secrets from public;

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  webhook_id uuid not null references public.webhooks (id) on delete cascade,
  event_id uuid not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'success', 'failed', 'dead')),
  attempt int not null default 1 check (attempt between 1 and 6),
  next_attempt_at timestamptz not null default now(),
  response_status int,
  response_body text check (char_length(response_body) <= 2048),
  duration_ms int,
  error text check (char_length(error) <= 500),
  replay_of uuid references public.webhook_deliveries (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists webhook_deliveries_due_idx on public.webhook_deliveries (next_attempt_at)
  where status in ('pending', 'sending');
create index if not exists webhook_deliveries_hook_idx on public.webhook_deliveries (webhook_id, created_at desc);
create index if not exists webhook_deliveries_created_idx on public.webhook_deliveries (created_at);

alter table public.webhooks enable row level security;
alter table public.webhook_deliveries enable row level security;
revoke all on public.webhooks, public.webhook_deliveries from anon, authenticated;
-- Création par RPC (secret, limite du plan) ; un admin modifie l'URL et les événements, ou supprime.
grant select, delete on public.webhooks to authenticated;
grant update (url, events) on public.webhooks to authenticated;
grant select on public.webhook_deliveries to authenticated;
drop policy if exists webhooks_admin_select on public.webhooks;
create policy webhooks_admin_select on public.webhooks for select to authenticated
  using (public.has_role(workspace_id, 'admin'));
drop policy if exists webhooks_admin_update on public.webhooks;
create policy webhooks_admin_update on public.webhooks for update to authenticated
  using (public.has_role(workspace_id, 'admin')) with check (public.has_role(workspace_id, 'admin'));
drop policy if exists webhooks_admin_delete on public.webhooks;
create policy webhooks_admin_delete on public.webhooks for delete to authenticated
  using (public.has_role(workspace_id, 'admin'));
drop policy if exists webhook_deliveries_admin_select on public.webhook_deliveries;
create policy webhook_deliveries_admin_select on public.webhook_deliveries for select to authenticated
  using (public.has_role(workspace_id, 'admin'));

create or replace function public.webhooks_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists webhooks_touch on public.webhooks;
create trigger webhooks_touch before update on public.webhooks for each row execute function public.webhooks_touch();

-- ===== Émission =====
create or replace function private.new_webhook_secret()
returns text language sql volatile set search_path = '' as $$
  select 'tcsec_' || rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
$$;

/**
 * Une livraison par webhook actif abonné au type (même event_id pour tous). « ping » ne vise que
 * p_only, quel que soit son état. Aucun webhook concerné : rien n'est écrit.
 */
create or replace function public.enqueue_webhook_event(p_ws uuid, p_type text, p_data jsonb, p_only uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_event uuid := gen_random_uuid();
  v_n int;
begin
  insert into public.webhook_deliveries (workspace_id, webhook_id, event_id, event_type, payload)
  select p_ws, w.id, v_event, p_type,
         jsonb_build_object('id', v_event, 'type', p_type, 'created_at', now(), 'data', p_data)
    from public.webhooks w
   where w.workspace_id = p_ws
     and (case when p_type = 'ping' then w.id = p_only
               else w.state = 'active' and p_type = any (w.events) and (p_only is null or w.id = p_only) end);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.enqueue_webhook_event(uuid, text, jsonb, uuid) from public, anon, authenticated;

create or replace function public.webhooks_on_lead()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Données personnelles : seulement vers les webhooks abonnés explicitement à lead.created
  perform public.enqueue_webhook_event(new.workspace_id, 'lead.created', jsonb_build_object(
    'lead_id', new.id, 'email', new.email, 'fields', new.fields, 'consent', new.consent,
    'demo_id', new.demo_id, 'link_id', new.link_id, 'created_at', new.created_at));
  return null;
end $$;
drop trigger if exists webhooks_on_lead on public.leads;
create trigger webhooks_on_lead after insert on public.leads for each row execute function public.webhooks_on_lead();

create or replace function public.webhooks_on_quiz()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enqueue_webhook_event(new.workspace_id, 'quiz.passed', jsonb_build_object(
    'attempt_id', new.id, 'demo_id', new.demo_id, 'version_id', new.version_id, 'link_id', new.link_id,
    'visitor_id', new.visitor_id, 'score', new.score, 'correct', new.correct, 'total', new.total,
    'created_at', new.created_at));
  return null;
end $$;
drop trigger if exists webhooks_on_quiz on public.quiz_attempts;
create trigger webhooks_on_quiz after insert on public.quiz_attempts for each row when (new.passed)
  execute function public.webhooks_on_quiz();

create or replace function public.webhooks_on_complete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enqueue_webhook_event(new.workspace_id, 'demo.completed', jsonb_build_object(
    'demo_id', new.demo_id, 'version_id', new.version_id, 'link_id', new.link_id,
    'visitor_id', new.visitor_id, 'session_id', new.session_id, 'occurred_at', new.occurred_at));
  return null;
end $$;
drop trigger if exists webhooks_on_complete on public.events;
create trigger webhooks_on_complete after insert on public.events for each row when (new.type = 'demo_complete')
  execute function public.webhooks_on_complete();

create or replace function public.webhooks_on_publish()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enqueue_webhook_event(new.workspace_id, 'demo.published', jsonb_build_object(
    'demo_id', new.id, 'version_id', new.current_version_id, 'title', new.title,
    'number', (select v.number from public.demo_versions v where v.id = new.current_version_id)));
  return null;
end $$;
drop trigger if exists webhooks_on_publish on public.demos;
create trigger webhooks_on_publish after update of current_version_id on public.demos for each row
  when (new.status = 'published' and new.current_version_id is not null
        and new.current_version_id is distinct from old.current_version_id)
  execute function public.webhooks_on_publish();

-- ===== RPC admin =====
create or replace function public.webhook_create(p_ws uuid, p_url text, p_events text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_lim jsonb;
  v_id uuid;
  v_secret text;
begin
  if not public.has_role(p_ws, 'admin') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if not public.webhook_url_ok(p_url) then raise exception 'INVALID_URL' using errcode = '22023'; end if;
  if p_events is null or cardinality(p_events) = 0 or not (p_events <@ public.webhook_event_types()) then
    raise exception 'INVALID_EVENTS' using errcode = '22023';
  end if;
  -- Limite du plan : clé absente = aucun webhook ; null = illimité
  v_lim := public.plan_limit(p_ws, 'webhooks');
  if v_lim is null or (jsonb_typeof(v_lim) = 'number'
      and (select count(*) from public.webhooks where workspace_id = p_ws) >= (v_lim #>> '{}')::int) then
    raise exception 'PLAN_LIMIT' using errcode = 'P0001';
  end if;
  insert into public.webhooks (workspace_id, url, events, created_by)
    values (p_ws, p_url, (select array_agg(distinct e order by e) from unnest(p_events) e), auth.uid())
    returning id into v_id;
  v_secret := private.new_webhook_secret();
  insert into private.webhook_secrets (webhook_id, secret) values (v_id, v_secret);
  return jsonb_build_object('id', v_id, 'secret', v_secret);
end $$;

create or replace function private.webhook_admin(p_id uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_ws uuid;
begin
  select workspace_id into v_ws from public.webhooks where id = p_id;
  if v_ws is null or not public.has_role(v_ws, 'admin') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return v_ws;
end $$;

create or replace function public.webhook_rotate_secret(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_ws uuid := private.webhook_admin(p_id);
  v_secret text := private.new_webhook_secret();
begin
  update private.webhook_secrets
     set previous_secret = secret, previous_until = now() + interval '24 hours', secret = v_secret
   where webhook_id = p_id;
  insert into public.audit_log (workspace_id, actor_id, action, target_ref)
    values (v_ws, auth.uid(), 'webhook.secret_rotated', p_id::text);
  return v_secret;
end $$;

create or replace function public.webhook_send_test(p_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare v_ws uuid := private.webhook_admin(p_id);
begin
  return public.enqueue_webhook_event(v_ws, 'ping', jsonb_build_object('webhook_id', p_id), p_id);
end $$;

create or replace function public.webhook_replay(p_delivery uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  d public.webhook_deliveries;
  v_id uuid;
begin
  select * into d from public.webhook_deliveries where id = p_delivery;
  if d.id is null or not public.has_role(d.workspace_id, 'admin') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  insert into public.webhook_deliveries (workspace_id, webhook_id, event_id, event_type, payload, replay_of)
    values (d.workspace_id, d.webhook_id, d.event_id, d.event_type, d.payload, d.id)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.webhook_set_state(p_id uuid, p_state text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ws uuid := private.webhook_admin(p_id);
begin
  if p_state not in ('active', 'paused') then raise exception 'INVALID_STATE' using errcode = '22023'; end if;
  update public.webhooks set state = p_state, failures = case when p_state = 'active' then 0 else failures end
   where id = p_id and workspace_id = v_ws;
end $$;

-- ===== RPC du dispatch (rôle service uniquement) =====
/** Réserve les envois dus (bail de 2 min) ; renvoie le corps exact à signer et les secrets valides. */
create or replace function public.webhook_claim_due(p_limit int default 25)
returns table (id uuid, url text, event_id uuid, event_type text, attempt int, body text, secrets text[])
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with due as (
    select d.id from public.webhook_deliveries d
     where d.status in ('pending', 'sending') and d.next_attempt_at <= now()
     order by d.next_attempt_at
     limit greatest(1, least(coalesce(p_limit, 25), 100))
     for update skip locked
  ), claimed as (
    update public.webhook_deliveries d
       set status = 'sending', next_attempt_at = now() + interval '2 minutes'
      from due where d.id = due.id
    returning d.*
  )
  select c.id, w.url, c.event_id, c.event_type, c.attempt, c.payload::text,
         array_remove(array[s.secret, case when s.previous_until > now() then s.previous_secret end], null)
    from claimed c
    join public.webhooks w on w.id = c.webhook_id
    join private.webhook_secrets s on s.webhook_id = c.webhook_id;
end $$;

/** Résultat d'un envoi : succès, nouvel essai (1 min, 5 min, 30 min, 2 h, 6 h) ou abandon et pause auto. */
create or replace function public.webhook_record_result(p_id uuid, p_status int, p_body text, p_duration int, p_error text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  d public.webhook_deliveries;
  v_delays interval[] := array[interval '1 minute', interval '5 minutes', interval '30 minutes',
                               interval '2 hours', interval '6 hours'];
  v_out text;
begin
  select * into d from public.webhook_deliveries where id = p_id for update;
  if d.id is null then return null; end if;
  if p_status between 200 and 299 then
    v_out := 'success';
    update public.webhook_deliveries
       set status = v_out, response_status = p_status, response_body = left(p_body, 2048),
           duration_ms = p_duration, error = null, finished_at = now()
     where id = p_id;
    update public.webhooks set failures = 0 where id = d.webhook_id;
  elsif d.attempt >= 6 then
    v_out := 'dead';
    update public.webhook_deliveries
       set status = v_out, response_status = p_status, response_body = left(p_body, 2048),
           duration_ms = p_duration, error = left(p_error, 500), finished_at = now()
     where id = p_id;
    update public.webhooks set failures = failures + 1, state = 'paused_auto' where id = d.webhook_id;
  else
    v_out := 'pending';
    update public.webhook_deliveries
       set status = v_out, attempt = d.attempt + 1, next_attempt_at = now() + v_delays[d.attempt],
           response_status = p_status, response_body = left(p_body, 2048), duration_ms = p_duration,
           error = left(p_error, 500)
     where id = p_id;
    update public.webhooks set failures = failures + 1 where id = d.webhook_id;
  end if;
  return v_out;
end $$;

-- ===== Planification (pg_cron + pg_net), purge à 7 jours =====
create or replace function public.purge_webhook_deliveries()
returns int language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  delete from public.webhook_deliveries where created_at < now() - interval '7 days';
  get diagnostics v_n = row_count;
  return v_n;
end $$;

/** Appel de la fonction de dispatch s'il y a des envois dus ; secret ou URL absents de Vault : rien. */
create or replace function public.webhooks_dispatch_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.webhook_deliveries
                  where status in ('pending', 'sending') and next_attempt_at <= now()) then
    return;
  end if;
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then
    raise notice 'webhooks : Vault ou pg_net indisponible, envoi différé';
    return;
  end if;
  execute 'select (select decrypted_secret from vault.decrypted_secrets where name = $1),
                  (select decrypted_secret from vault.decrypted_secrets where name = $2)'
    into v_url, v_secret using 'webhooks_dispatch_url', 'webhooks_dispatch_secret';
  if v_url is null or v_secret is null then
    raise notice 'webhooks : secret ou URL de dispatch absents de Vault, envoi différé';
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
    using v_url, '{}'::jsonb,
          jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json');
end $$;

revoke all on function public.webhook_claim_due(int), public.webhook_record_result(uuid, int, text, int, text),
  public.purge_webhook_deliveries(), public.webhooks_dispatch_tick(),
  public.webhooks_on_lead(), public.webhooks_on_quiz(), public.webhooks_on_complete(), public.webhooks_on_publish(),
  private.new_webhook_secret(), private.webhook_admin(uuid)
  from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant usage on schema private to service_role';
    execute 'grant execute on function public.webhook_claim_due(int), public.webhook_record_result(uuid, int, text, int, text) to service_role';
  end if;
end $$;
revoke all on function public.webhook_create(uuid, text, text[]),
  public.webhook_rotate_secret(uuid), public.webhook_send_test(uuid), public.webhook_replay(uuid),
  public.webhook_set_state(uuid, text) from public, anon;
grant execute on function public.webhook_create(uuid, text, text[]),
  public.webhook_rotate_secret(uuid), public.webhook_send_test(uuid), public.webhook_replay(uuid),
  public.webhook_set_state(uuid, text), public.webhook_url_ok(text), public.webhook_event_types() to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('fd_webhooks_dispatch', '* * * * *', 'select public.webhooks_dispatch_tick()');
    perform cron.schedule('fd_webhooks_purge', '15 4 * * *', 'select public.purge_webhook_deliveries()');
  else
    raise notice 'pg_cron indisponible : dispatch et purge des webhooks non planifiés';
  end if;
end $$;
