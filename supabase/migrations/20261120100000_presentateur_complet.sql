-- FlowDSIML — L26-09 à L26-12 : mode présentateur complet. Idempotent, additif. Schéma soumis au chef.
--  * demos.presenter_notes : notes de la démo (2 000 caractères), mêmes règles que steps.presenter_notes
--    (jamais publiées : publish_demo ne lit pas cette colonne).
--  * present_remotes : télécommande sur téléphone. Code à 8 chiffres à usage unique (5 min, 5 essais),
--    jeton (haché) limité à cette présentation, expirant à la fin et au plus tard après 4 h ; un seul
--    téléphone à la fois (nouvel appairage = nouvelle clé de canal). Lecture par le présentateur seul,
--    aucune écriture directe : RPC seulement.
--  * Appairage sans p_id (code saisi) : plafond global, plus de 30 échecs en 10 min = appairage par code
--    seul refusé pendant 10 min (retour du chef d'équipe : force brute sur toutes les télécommandes).
--  * Synchronisation : canal Realtime broadcast « present-remote:<channel_key> » (clé aléatoire de 128 bits).
--  * present_reports : bilan de fin, visible par la seule personne qui a présenté, 30 jours. Rien dans
--    events ni dans Analytics.

-- ===== 1. Notes de la démo =====
alter table public.demos add column if not exists presenter_notes text not null default '';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'demos_presenter_notes_len') then
    alter table public.demos add constraint demos_presenter_notes_len check (char_length(presenter_notes) <= 2000);
  end if;
end $$;

-- ===== 2. Télécommande =====
create table if not exists public.present_remotes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  demo_id uuid not null references public.demos (id) on delete cascade,
  owner uuid not null references auth.users (id) on delete cascade,
  code_hash text,
  code_expires_at timestamptz,
  failures int not null default 0,
  token_hash text,
  channel_key text not null,
  paired_at timestamptz,
  expires_at timestamptz not null default now() + interval '4 hours',
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists present_remotes_owner_idx on public.present_remotes (owner, demo_id);
create index if not exists present_remotes_code_idx on public.present_remotes (code_hash) where code_hash is not null;
alter table public.present_remotes enable row level security;
revoke all on public.present_remotes from anon, authenticated;
grant select (id, demo_id, paired_at, expires_at, ended_at, created_at) on public.present_remotes to authenticated;
drop policy if exists present_remotes_owner on public.present_remotes;
create policy present_remotes_owner on public.present_remotes for select to authenticated
  using (owner = (select auth.uid()));

create or replace function private.remote_code() returns text language sql volatile set search_path = '' as $$
  select lpad(((('x' || encode(extensions.gen_random_bytes(5), 'hex'))::bit(40)::bigint) % 100000000)::text, 8, '0');
$$;

-- Plafond global des échecs d'appairage sans p_id (une seule ligne)
create table if not exists private.present_pair_throttle (
  id int primary key default 1 check (id = 1),
  window_start timestamptz not null default now(),
  failures int not null default 0,
  blocked_until timestamptz
);
insert into private.present_pair_throttle (id) values (1) on conflict do nothing;
revoke all on private.present_pair_throttle from public;
revoke all on function private.remote_code() from public;

create or replace function private.sha(p text) returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p, 'sha256'), 'hex');
$$;
revoke all on function private.sha(text) from public;

-- Présentateur : nouvelle télécommande (les précédentes de cette démo sont terminées)
create or replace function public.present_remote_start(p_demo uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ws uuid;
  v_code text := private.remote_code();
  r public.present_remotes;
begin
  select workspace_id into v_ws from public.demos where id = p_demo and deleted_at is null;
  if v_ws is null or not public.has_role(v_ws, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  update public.present_remotes set ended_at = now(), code_hash = null, token_hash = null
    where owner = auth.uid() and demo_id = p_demo and ended_at is null;
  insert into public.present_remotes (workspace_id, demo_id, owner, code_hash, code_expires_at, channel_key)
  values (v_ws, p_demo, auth.uid(), private.sha(v_code), now() + interval '5 minutes',
          encode(extensions.gen_random_bytes(16), 'hex'))
  returning * into r;
  return jsonb_build_object('id', r.id, 'code', v_code, 'codeExpiresAt', r.code_expires_at,
                            'channel', r.channel_key, 'expiresAt', r.expires_at);
end $$;

-- Présentateur : nouveau code (après expiration ou 5 essais), sans couper le téléphone appairé
create or replace function public.present_remote_new_code(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_code text := private.remote_code();
begin
  update public.present_remotes set code_hash = private.sha(v_code), code_expires_at = now() + interval '5 minutes',
    failures = 0
    where id = p_id and owner = auth.uid() and ended_at is null and expires_at > now();
  if not found then raise exception 'REMOTE_NOT_FOUND' using errcode = 'P0002'; end if;
  return jsonb_build_object('code', v_code, 'codeExpiresAt', now() + interval '5 minutes');
end $$;

create or replace function public.present_remote_status(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('paired', r.paired_at is not null and r.token_hash is not null,
                            'channel', r.channel_key, 'active', r.ended_at is null and r.expires_at > now(),
                            'codeExpiresAt', r.code_expires_at, 'failures', r.failures)
  from public.present_remotes r where r.id = p_id and r.owner = auth.uid();
$$;

create or replace function public.present_remote_end(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.present_remotes set ended_at = now(), code_hash = null, token_hash = null
  where id = p_id and owner = auth.uid() and ended_at is null;
$$;

-- Contenu de la présentation pour le téléphone : cette démo seulement
create or replace function private.remote_payload(r public.present_remotes)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'title', d.title,
    'notes', d.presenter_notes,
    'steps', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'notes', s.presenter_notes) order by s.position)
                       from public.steps s where s.demo_id = d.id), '[]'::jsonb))
  from public.demos d where d.id = r.demo_id and d.deleted_at is null;
$$;
revoke all on function private.remote_payload(public.present_remotes) from public;

-- Téléphone (sans compte) : appairage par code
create or replace function public.present_remote_pair(p_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.present_remotes;
  v_tok text;
  v_key text := encode(extensions.gen_random_bytes(16), 'hex');
begin
  if p_code is null or p_code !~ '^\d{8}$' then
    perform pg_sleep(0.3);
    return jsonb_build_object('status', 'invalid');
  end if;
  if p_id is not null then
    select * into r from public.present_remotes where id = p_id for update;
    if not found or r.ended_at is not null or r.expires_at <= now() then
      perform pg_sleep(0.3);
      return jsonb_build_object('status', 'invalid');
    end if;
    if r.code_hash is null or r.code_expires_at <= now() or r.failures >= 5 then
      return jsonb_build_object('status', 'expired');
    end if;
    if r.code_hash <> private.sha(p_code) then
      update public.present_remotes set failures = failures + 1,
        code_hash = case when failures + 1 >= 5 then null else code_hash end
        where id = r.id;
      perform pg_sleep(0.3);
      return jsonb_build_object('status', case when r.failures + 1 >= 5 then 'expired' else 'invalid' end);
    end if;
  else
    if exists (select 1 from private.present_pair_throttle where blocked_until > now()) then
      return jsonb_build_object('status', 'busy');
    end if;
    select * into r from public.present_remotes
      where code_hash = private.sha(p_code) and code_expires_at > now() and failures < 5
        and ended_at is null and expires_at > now()
      for update;
    if not found then
      update private.present_pair_throttle set
        failures = case when window_start < now() - interval '10 minutes' then 1 else failures + 1 end,
        window_start = case when window_start < now() - interval '10 minutes' then now() else window_start end,
        blocked_until = case when window_start >= now() - interval '10 minutes' and failures + 1 > 30
                             then now() + interval '10 minutes' else blocked_until end
        where id = 1;
      perform pg_sleep(0.3);
      return jsonb_build_object('status', 'invalid');
    end if;
  end if;
  v_tok := encode(extensions.gen_random_bytes(32), 'hex');
  update public.present_remotes set code_hash = null, code_expires_at = null, failures = 0,
    token_hash = private.sha(v_tok), channel_key = v_key, paired_at = now()
    where id = r.id returning * into r;
  return jsonb_build_object('status', 'ok', 'id', r.id, 'token', v_tok, 'channel', v_key, 'expiresAt', r.expires_at)
         || private.remote_payload(r);
end $$;

-- Téléphone : relecture (notes modifiées pendant la présentation)
create or replace function public.present_remote_state(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r public.present_remotes;
begin
  if p_token is null or char_length(p_token) <> 64 then return jsonb_build_object('status', 'ended'); end if;
  select * into r from public.present_remotes where token_hash = private.sha(p_token);
  if not found or r.ended_at is not null or r.expires_at <= now() then
    return jsonb_build_object('status', 'ended');
  end if;
  return jsonb_build_object('status', 'ok', 'channel', r.channel_key) || private.remote_payload(r);
end $$;

revoke all on function public.present_remote_start(uuid) from public, anon;
revoke all on function public.present_remote_new_code(uuid) from public, anon;
revoke all on function public.present_remote_status(uuid) from public, anon;
revoke all on function public.present_remote_end(uuid) from public, anon;
grant execute on function public.present_remote_start(uuid) to authenticated;
grant execute on function public.present_remote_new_code(uuid) to authenticated;
grant execute on function public.present_remote_status(uuid) to authenticated;
grant execute on function public.present_remote_end(uuid) to authenticated;
revoke all on function public.present_remote_pair(uuid, text) from public;
revoke all on function public.present_remote_state(text) from public;
grant execute on function public.present_remote_pair(uuid, text) to anon, authenticated;
grant execute on function public.present_remote_state(text) to anon, authenticated;

-- ===== 3. Bilan de fin =====
create or replace function public.present_report_steps_ok(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= 500
    and not exists (select 1 from jsonb_array_elements(p) x
                    where jsonb_typeof(x) <> 'object' or jsonb_typeof(x -> 'index') <> 'number'
                       or jsonb_typeof(x -> 'seconds') <> 'number' or char_length(coalesce(x ->> 'title', '')) > 200);
$$;
create table if not exists public.present_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  demo_id uuid not null references public.demos (id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  duration_s int not null check (duration_s between 0 and 86400),
  target_min int check (target_min between 1 and 180),
  steps jsonb not null default '[]'::jsonb check (public.present_report_steps_ok(steps)),
  notes_changed int not null default 0 check (notes_changed between 0 and 500),
  created_at timestamptz not null default now()
);
create index if not exists present_reports_owner_idx on public.present_reports (owner, created_at desc);
alter table public.present_reports enable row level security;
revoke all on public.present_reports from anon;
grant select, insert on public.present_reports to authenticated;
drop policy if exists present_reports_select on public.present_reports;
create policy present_reports_select on public.present_reports for select to authenticated
  using (owner = (select auth.uid()) and created_at > now() - interval '30 days');
drop policy if exists present_reports_insert on public.present_reports;
create policy present_reports_insert on public.present_reports for insert to authenticated
  with check (owner = (select auth.uid()) and public.has_role(workspace_id, 'editor')
              and exists (select 1 from public.demos d where d.id = demo_id and d.workspace_id = present_reports.workspace_id));

-- ===== 4. Purge (pg_cron, toutes les heures) =====
create or replace function public.purge_present()
returns void language sql security definer set search_path = '' as $$
  update private.present_pair_throttle set failures = 0, window_start = now()
    where window_start < now() - interval '10 minutes' and (blocked_until is null or blocked_until < now());
  delete from public.present_remotes where ended_at < now() - interval '1 day' or expires_at < now() - interval '1 day';
  delete from public.present_reports where created_at < now() - interval '30 days';
$$;
revoke all on function public.purge_present() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('fd_purge_present', '29 * * * *', 'select public.purge_present()');
  else
    raise notice 'pg_cron indisponible : purge du mode présentateur non planifiée';
  end if;
end $$;
