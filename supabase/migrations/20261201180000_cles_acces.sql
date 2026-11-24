-- Clés d'accès et API publique v1 en lecture seule (retours client du 24/11 §6.2 et §6.2.1).
-- Nouveau fichier ; idempotent.
--  * api_keys : une clé appartient à un espace et à la personne qui l'a créée. Seul un condensé
--    (sha-256) est stocké : la clé n'est renvoyée qu'une fois, par create_api_key. Les 4 derniers
--    caractères servent à la reconnaître dans la liste.
--  * Accès (scopes) parmi demos, stats, leads ; fixés à la création.
--  * Propriétaires et administrateurs seulement : lecture par RLS, sans la colonne du condensé ;
--    aucune écriture directe, tout passe par les fonctions ci-dessous.
--  * Révocation immédiate et définitive ; expiration facultative.
--  * api_key_use (service_role, fonction Edge « api ») : vérifie la clé, applique la limite de débit
--    par clé et met à jour last_used_at.
--  * api_demos, api_demo_stats, api_demo_leads (service_role) : toujours bornées à l'espace de la clé.
--    Jamais de nom ni d'adresse d'un membre.

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  scopes text[] not null check (cardinality(scopes) between 1 and 3
                                and scopes <@ array['demos', 'stats', 'leads']::text[]),
  last4 text not null check (char_length(last4) = 4),
  key_hash text not null unique check (char_length(key_hash) = 64),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz
);
create index if not exists api_keys_ws_idx on public.api_keys (workspace_id, created_at desc);

alter table public.api_keys enable row level security;
revoke all on public.api_keys from public, anon, authenticated;
-- Lecture sans le condensé : il ne quitte jamais la base
grant select (id, workspace_id, created_by, name, scopes, last4, created_at, expires_at, revoked_at, last_used_at)
  on public.api_keys to authenticated;
drop policy if exists api_keys_select on public.api_keys;
create policy api_keys_select on public.api_keys for select to authenticated
  using (public.has_role(workspace_id, 'admin'));

-- Journal : création et révocation d'une clé (aucun secret dans le journal)
alter table public.audit_log drop constraint if exists audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check check (action in
  ('learners.export', 'learner.erase', 'learners.purge', 'webhook.secret_revealed', 'webhook.secret_rotated',
   'settings.html_capture', 'leads.purge', 'api_key.create', 'api_key.revoke'));

/**
 * Crée une clé et la renvoie UNE fois : {id, key}. p_expires_days : null (jamais), 30, 90 ou 365.
 * Propriétaires et administrateurs ; 20 clés actives au plus par espace.
 */
create or replace function public.create_api_key(p_workspace uuid, p_name text, p_scopes text[], p_expires_days int default 90)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_key text;
  v_id uuid;
  v_scopes text[];
begin
  if not public.has_role(p_workspace, 'admin') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_expires_days is not null and p_expires_days not in (30, 90, 365) then
    raise exception 'EXPIRATION_INVALIDE' using errcode = '22023';
  end if;
  select array_agg(distinct s order by s) into v_scopes from unnest(coalesce(p_scopes, '{}')) s;
  if v_scopes is null or not v_scopes <@ array['demos', 'stats', 'leads']::text[] then
    raise exception 'ACCES_INVALIDE' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'NOM_INVALIDE' using errcode = '22023';
  end if;
  -- Sérialisé par espace : le plafond ne se contourne pas par des appels simultanés
  perform pg_advisory_xact_lock(hashtextextended('api_keys:' || p_workspace::text, 0));
  if (select count(*) from public.api_keys k
       where k.workspace_id = p_workspace and k.revoked_at is null
         and (k.expires_at is null or k.expires_at > now())) >= 20 then
    raise exception 'TROP_DE_CLES' using errcode = '53400';
  end if;
  v_key := 'tc_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.api_keys (workspace_id, created_by, name, scopes, last4, key_hash, expires_at)
  values (p_workspace, (select auth.uid()), btrim(p_name), v_scopes, right(v_key, 4),
          encode(extensions.digest(v_key, 'sha256'), 'hex'),
          case when p_expires_days is null then null else now() + make_interval(days => p_expires_days) end)
  returning id into v_id;
  insert into public.audit_log (workspace_id, actor_id, action, target_ref, meta)
  values (p_workspace, (select auth.uid()), 'api_key.create', v_id::text, jsonb_build_object('scopes', v_scopes));
  return jsonb_build_object('id', v_id, 'key', v_key);
end $$;
revoke all on function public.create_api_key(uuid, text, text[], int) from public, anon;
grant execute on function public.create_api_key(uuid, text, text[], int) to authenticated;

create or replace function public.rename_api_key(p_id uuid, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  select workspace_id into ws from public.api_keys where id = p_id;
  if ws is null or not public.has_role(ws, 'admin') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'NOM_INVALIDE' using errcode = '22023';
  end if;
  update public.api_keys set name = btrim(p_name) where id = p_id;
end $$;
revoke all on function public.rename_api_key(uuid, text) from public, anon;
grant execute on function public.rename_api_key(uuid, text) to authenticated;

/** Révocation définitive, effet immédiat (api_key_use refuse la clé dès le prochain appel). */
create or replace function public.revoke_api_key(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  select workspace_id into ws from public.api_keys where id = p_id;
  if ws is null or not public.has_role(ws, 'admin') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  update public.api_keys set revoked_at = now() where id = p_id and revoked_at is null;
  if found then
    insert into public.audit_log (workspace_id, actor_id, action, target_ref)
    values (ws, (select auth.uid()), 'api_key.revoke', p_id::text);
  end if;
end $$;
revoke all on function public.revoke_api_key(uuid) from public, anon;
grant execute on function public.revoke_api_key(uuid) to authenticated;

-- ===== Côté API (service_role seulement) =====
create schema if not exists private;
create table if not exists private.api_key_hits (
  key_id uuid not null references public.api_keys (id) on delete cascade,
  minute timestamptz not null,
  hits int not null default 0,
  primary key (key_id, minute)
);
revoke all on private.api_key_hits from public, anon, authenticated;

/**
 * Vérifie une clé par son condensé et compte l'appel. Réponses :
 *  {ok: true, key_id, workspace_id, scopes} ; {ok: false, reason: 'invalid'} (inconnue, révoquée,
 *  expirée : même réponse) ; {ok: false, reason: 'rate'} au-delà de 60 appels par minute et par clé.
 */
create or replace function public.api_key_use(p_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  k public.api_keys;
  v_minute timestamptz := date_trunc('minute', now());
  v_hits int;
begin
  select * into k from public.api_keys where key_hash = p_hash;
  if k.id is null or k.revoked_at is not null or (k.expires_at is not null and k.expires_at <= now()) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  insert into private.api_key_hits as h (key_id, minute, hits) values (k.id, v_minute, 1)
  on conflict (key_id, minute) do update set hits = h.hits + 1
  returning hits into v_hits;
  if v_hits = 1 then
    delete from private.api_key_hits where key_id = k.id and minute < v_minute - interval '10 minutes';
  end if;
  if v_hits > 60 then
    return jsonb_build_object('ok', false, 'reason', 'rate');
  end if;
  -- Une écriture par minute au plus
  update public.api_keys set last_used_at = now()
   where id = k.id and (last_used_at is null or last_used_at < v_minute);
  return jsonb_build_object('ok', true, 'key_id', k.id, 'workspace_id', k.workspace_id, 'scopes', to_jsonb(k.scopes));
end $$;
revoke all on function public.api_key_use(text) from public, anon, authenticated;
grant execute on function public.api_key_use(text) to service_role;

/** Démos de l'espace (ni supprimées, ni archivées) : identifiant, titre, statut, dates. */
create or replace function public.api_demos(p_workspace uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'title', d.title, 'status', d.status,
           'created_at', d.created_at, 'updated_at', d.updated_at) order by d.updated_at desc, d.id), '[]'::jsonb)
    from public.demos d
   where d.workspace_id = p_workspace and d.deleted_at is null and d.status in ('draft', 'published');
$$;
revoke all on function public.api_demos(uuid) from public, anon, authenticated;
grant execute on function public.api_demos(uuid) to service_role;

/** Statistiques d'une démo de l'espace sur p_days jours (1 à 365) ; null si la démo n'est pas de l'espace. */
create or replace function public.api_demo_stats(p_workspace uuid, p_demo uuid, p_days int default 30)
returns jsonb language sql stable security definer set search_path = '' as $$
  with d as (
    select id from public.demos
     where id = p_demo and workspace_id = p_workspace and deleted_at is null
  ), w as (
    select now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365)) as since
  ), e as (
    select ev.type, ev.visitor_id, ev.session_id from public.events ev, w
     where ev.demo_id = (select id from d) and ev.workspace_id = p_workspace and ev.occurred_at >= w.since
  )
  select case when exists (select 1 from d) then jsonb_build_object(
    'demo_id', p_demo,
    'from', (select since from w), 'to', now(),
    'views', (select count(*) from e where type = 'demo_view'),
    'visitors', (select count(distinct visitor_id) from e where type = 'demo_view'),
    'completions', (select count(distinct session_id) from e where type = 'demo_complete')) end;
$$;
revoke all on function public.api_demo_stats(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.api_demo_stats(uuid, uuid, int) to service_role;

/**
 * Leads d'une démo de l'espace, du plus récent au plus ancien, par pages (curseur : date et identifiant
 * du dernier lead reçu). Adresse et date seulement. null si la démo n'est pas de l'espace. Un lead purgé
 * selon la durée de conservation n'existe plus : il n'est plus renvoyé.
 */
create or replace function public.api_demo_leads(p_workspace uuid, p_demo uuid, p_limit int default 100,
                                                 p_before timestamptz default null, p_before_id uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  with d as (
    select id from public.demos
     where id = p_demo and workspace_id = p_workspace and deleted_at is null
  ), page as (
    select l.id, l.email, l.created_at from public.leads l
     where l.demo_id = (select id from d) and l.workspace_id = p_workspace
       and (p_before is null or (l.created_at, l.id) < (p_before, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
     order by l.created_at desc, l.id desc
     limit least(greatest(coalesce(p_limit, 100), 1), 500) + 1
  )
  select case when exists (select 1 from d) then
    coalesce((select jsonb_agg(jsonb_build_object('id', id, 'email', email, 'created_at', created_at)
                               order by created_at desc, id desc) from page), '[]'::jsonb) end;
$$;
revoke all on function public.api_demo_leads(uuid, uuid, int, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.api_demo_leads(uuid, uuid, int, timestamptz, uuid) to service_role;
