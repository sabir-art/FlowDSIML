-- FlowDSIML — L11 : partage sécurisé (mot de passe, date d'expiration), vérifiés côté serveur.
-- Idempotent.
--  * demo_access : règle d'accès d'une démo (mode, mot de passe bcrypt, expiration). Le hash n'est
--    jamais lisible par un client (privilèges de colonne). Écriture uniquement par les RPC ci-dessous.
--    Modes « invite » et « domain » : réservés, refusés tant que l'envoi d'e-mails n'existe pas.
--  * demo_access_attempts : essais de mot de passe par démo et par client : 5 échecs, puis 1 minute
--    d'attente. client_key = HMAC-SHA256 salé (IP + démo) calculé par open-demo : l'IP n'est jamais
--    stockée ni transmise en clair. Purge après 24 h (pg_cron). Plafond global par démo, indépendant
--    du client (ligne client_key = 'global:demo-limit') : au-delà de 50 échecs en 1 h, la démo refuse
--    tout essai pendant 15 minutes.
--  * demo_access_grants : jetons d'accès de 12 h remis après un bon mot de passe. Seul le SHA-256 du
--    jeton est stocké. Changer le mot de passe les révoque. Purge des jetons expirés (pg_cron).
--  * Réponse identique (« not_found ») pour une démo inexistante, dépubliée ou dont le workspace
--    interdit les liens publics. Démos déjà publiées : aucune ligne demo_access = mode « link »,
--    sans expiration (rien ne change pour elles).
--  * demo_gate(...) : décision d'accès appelée par l'Edge Function open-demo (service_role seulement).
--  * Bucket « published » rendu privé : le lecteur passe par open-demo, qui sert le manifeste et des
--    URL d'images signées. Les règles s'appliquent donc sans republier, au lien, à l'intégration et
--    aux liens personnalisés. Les écritures des éditeurs (policies existantes) sont inchangées.

create table if not exists public.demo_access (
  demo_id uuid primary key references public.demos (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  mode text not null default 'link' check (mode in ('link', 'password', 'invite', 'domain')),
  password_hash text,
  password_changed_at timestamptz,
  ask_email boolean not null default false,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  check (mode <> 'password' or password_hash is not null)
);
alter table public.demo_access enable row level security;
revoke all on public.demo_access from anon, authenticated;
grant select (demo_id, workspace_id, mode, password_changed_at, ask_email, expires_at, updated_at)
  on public.demo_access to authenticated;
drop policy if exists demo_access_select on public.demo_access;
create policy demo_access_select on public.demo_access for select to authenticated
  using (public.has_role(workspace_id, 'viewer'));

create table if not exists public.demo_access_attempts (
  demo_id uuid not null references public.demos (id) on delete cascade,
  client_key text not null check (char_length(client_key) between 16 and 128),
  failures int not null default 0,
  locked_until timestamptz,
  window_start timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (demo_id, client_key)
);
alter table public.demo_access_attempts enable row level security;
revoke all on public.demo_access_attempts from anon, authenticated;

create table if not exists public.demo_access_grants (
  token_hash text primary key check (char_length(token_hash) = 64),
  demo_id uuid not null references public.demos (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);
create index if not exists demo_access_grants_demo_idx on public.demo_access_grants (demo_id);
alter table public.demo_access_grants enable row level security;
revoke all on public.demo_access_grants from anon, authenticated;

-- Réglage du mode, de la demande d'e-mail et de l'expiration (éditeur et plus).
create or replace function public.set_demo_access(
  p_demo uuid, p_mode text, p_ask_email boolean, p_expires_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := public.demo_workspace(p_demo);
begin
  if ws is null or not public.has_role(ws, 'editor') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_mode not in ('link', 'password') then
    raise exception 'NOT_AVAILABLE' using errcode = 'P0001';
  end if;
  if p_mode = 'password' and not exists (
    select 1 from public.demo_access where demo_id = p_demo and password_hash is not null
  ) then
    raise exception 'PASSWORD_REQUIRED' using errcode = 'P0001';
  end if;
  insert into public.demo_access (demo_id, workspace_id, mode, ask_email, expires_at, updated_by)
  values (p_demo, ws, p_mode, coalesce(p_ask_email, false), p_expires_at, (select auth.uid()))
  on conflict (demo_id) do update
    set mode = excluded.mode, ask_email = excluded.ask_email, expires_at = excluded.expires_at,
        updated_at = now(), updated_by = excluded.updated_by;
end $$;
revoke all on function public.set_demo_access(uuid, text, boolean, timestamptz) from public, anon;
grant execute on function public.set_demo_access(uuid, text, boolean, timestamptz) to authenticated;

-- Nouveau mot de passe (8 à 200 caractères) : passe la démo en mode mot de passe et révoque les accès donnés.
create or replace function public.set_demo_password(p_demo uuid, p_password text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := public.demo_workspace(p_demo);
  h text;
begin
  if ws is null or not public.has_role(ws, 'editor') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_password is null or char_length(p_password) < 8 or char_length(p_password) > 200 then
    raise exception 'PASSWORD_LENGTH' using errcode = 'P0001';
  end if;
  h := extensions.crypt(p_password, extensions.gen_salt('bf', 10));
  insert into public.demo_access (demo_id, workspace_id, mode, password_hash, password_changed_at, updated_by)
  values (p_demo, ws, 'password', h, now(), (select auth.uid()))
  on conflict (demo_id) do update
    set mode = 'password', password_hash = h, password_changed_at = now(),
        updated_at = now(), updated_by = excluded.updated_by;
  delete from public.demo_access_grants where demo_id = p_demo;
  delete from public.demo_access_attempts where demo_id = p_demo;
end $$;
revoke all on function public.set_demo_password(uuid, text) from public, anon;
grant execute on function public.set_demo_password(uuid, text) to authenticated;

-- Décision d'accès (Edge Function open-demo, service_role). Ne révèle jamais le mot de passe ni le hash.
-- Statuts : ok | not_found | expired | password_required | password_wrong | locked.
create or replace function public.demo_gate(
  p_demo uuid, p_password text default null, p_grant text default null, p_client text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d record;
  a public.demo_access;
  att public.demo_access_attempts;
  glob public.demo_access_attempts;
  global_key constant text := 'global:demo-limit';
  info jsonb;
  tok text;
begin
  select dm.id, dm.title, dm.status, dm.current_version_id, dm.deleted_at,
         w.name as ws_name, w.settings as ws_settings, w.public_links_enabled
    into d
    from public.demos dm join public.workspaces w on w.id = dm.workspace_id
   where dm.id = p_demo;
  -- Inexistante, dépubliée ou liens publics interdits : même réponse, sans aucune information
  if not found or d.deleted_at is not null or d.status <> 'published' or d.current_version_id is null
     or not d.public_links_enabled then
    return jsonb_build_object('status', 'not_found');
  end if;
  info := jsonb_build_object(
    'title', d.title,
    'workspace', d.ws_name,
    'website', case when coalesce(d.ws_settings ->> 'websiteUrl', '') ~ '^https://\S+$'
                    then d.ws_settings ->> 'websiteUrl' end);
  select * into a from public.demo_access where demo_id = p_demo;
  if found and a.expires_at is not null and a.expires_at <= now() then
    return info || jsonb_build_object('status', 'expired', 'expiredAt', a.expires_at);
  end if;
  if not found or a.mode = 'link' then
    return info || jsonb_build_object('status', 'ok');
  end if;
  if a.mode <> 'password' then
    -- Modes réservés (invitation, domaine) : jamais ouverts sans vérification
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Mot de passe : jeton déjà remis ?
  if p_grant is not null and exists (
    select 1 from public.demo_access_grants g
     where g.token_hash = encode(extensions.digest(p_grant, 'sha256'), 'hex')
       and g.demo_id = p_demo and g.expires_at > now()
  ) then
    return info || jsonb_build_object('status', 'ok', 'askEmail', a.ask_email);
  end if;
  if p_password is null or p_password = '' then
    return info || jsonb_build_object('status', 'password_required', 'askEmail', a.ask_email);
  end if;
  if p_client is null or char_length(p_client) < 16 then
    raise exception 'CLIENT_REQUIRED' using errcode = 'P0001';
  end if;

  -- Plafond global de la démo (essais répartis sur des clients différents)
  select * into glob from public.demo_access_attempts where demo_id = p_demo and client_key = global_key;
  if found and glob.locked_until is not null and glob.locked_until > now() then
    return info || jsonb_build_object('status', 'locked',
      'retryIn', ceil(extract(epoch from glob.locked_until - now()))::int);
  end if;

  select * into att from public.demo_access_attempts where demo_id = p_demo and client_key = p_client;
  if found and att.locked_until is not null and att.locked_until > now() then
    return info || jsonb_build_object('status', 'locked',
      'retryIn', ceil(extract(epoch from att.locked_until - now()))::int);
  end if;

  if extensions.crypt(p_password, a.password_hash) = a.password_hash then
    delete from public.demo_access_attempts where demo_id = p_demo and client_key = p_client;
    delete from public.demo_access_grants where demo_id = p_demo and expires_at <= now();
    tok := encode(extensions.gen_random_bytes(24), 'hex');
    insert into public.demo_access_grants (token_hash, demo_id)
      values (encode(extensions.digest(tok, 'sha256'), 'hex'), p_demo);
    return info || jsonb_build_object('status', 'ok', 'grant', tok, 'askEmail', a.ask_email);
  end if;

  insert into public.demo_access_attempts as t (demo_id, client_key, failures, locked_until, window_start)
  values (p_demo, global_key, 1, null, now())
  on conflict (demo_id, client_key) do update
    set failures = case when t.window_start < now() - interval '1 hour' or t.locked_until is not null
                        then 1 else t.failures + 1 end,
        window_start = case when t.window_start < now() - interval '1 hour' or t.locked_until is not null
                            then now() else t.window_start end,
        locked_until = null, updated_at = now()
  returning * into glob;
  if glob.failures >= 50 then
    update public.demo_access_attempts
       set failures = 0, locked_until = now() + interval '15 minutes', window_start = now(), updated_at = now()
     where demo_id = p_demo and client_key = global_key;
    return info || jsonb_build_object('status', 'locked', 'retryIn', 900);
  end if;

  insert into public.demo_access_attempts as t (demo_id, client_key, failures, locked_until)
  values (p_demo, p_client, 1, null)
  on conflict (demo_id, client_key) do update
    set failures = case when t.locked_until is not null then 1 else t.failures + 1 end,
        locked_until = null, updated_at = now()
  returning * into att;
  if att.failures >= 5 then
    update public.demo_access_attempts
       set failures = 0, locked_until = now() + interval '1 minute', updated_at = now()
     where demo_id = p_demo and client_key = p_client;
    return info || jsonb_build_object('status', 'locked', 'retryIn', 60);
  end if;
  return info || jsonb_build_object('status', 'password_wrong', 'remaining', 5 - att.failures);
end $$;
revoke all on function public.demo_gate(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.demo_gate(uuid, text, text, text) to service_role;

-- Purge : essais de plus de 24 h et jetons expirés (pg_cron, toutes les heures)
create or replace function public.purge_demo_access()
returns void language sql security definer set search_path = '' as $$
  delete from public.demo_access_attempts where updated_at < now() - interval '24 hours';
  delete from public.demo_access_grants where expires_at <= now();
$$;
revoke all on function public.purge_demo_access() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('fd_purge_demo_access', '17 * * * *', 'select public.purge_demo_access()');
  else
    raise notice 'pg_cron indisponible : purge des accès non planifiée';
  end if;
end $$;

-- Bucket privé : le lecteur ne lit plus le stockage directement (open-demo signe les URL).
update storage.buckets set public = false where id = 'published';
