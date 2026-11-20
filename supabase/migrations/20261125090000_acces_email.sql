-- FlowDSIML — L39 (086, 088) : accès à une démo « Sur invitation » et « Par domaine e-mail ».
-- Idempotent. Schéma validé par le chef de projet (conditions a à e).
--  * demo_access.domains : domaines e-mail autorisés (20 au plus, minuscules, messageries grand public
--    refusées). demo_access_invites : adresses invitées par démo (lecture : éditeurs de l'espace).
--  * L'adresse du visiteur est prouvée par un lien envoyé par Supabase Auth (Edge Function access-email) :
--    open-demo vérifie le jeton reçu au retour du lien (auth.getUser) et passe l'adresse vérifiée à
--    demo_gate (p_email), qui délivre un accès de 7 jours (demo_access_grants.email). Le lecteur ne garde
--    jamais le jeton Supabase, seulement cet accès. Retirer l'invité, le domaine ou changer de mode le
--    révoque (vérifié à chaque ouverture).
--  * access_email_sends : envois des 60 dernières minutes pour les plafonds (20 par heure en tout, sur les
--    30 du SMTP ; 10 par espace ; 1 par adresse toutes les 10 minutes ; 3 par client et par heure pour les
--    demandes anonymes). L'IP (empreinte HMAC) n'est jamais le seul garde-fou. Purge à 7 jours.
--  * Comptes visiteurs (app_metadata.kind = 'visitor') : supprimés après 90 jours sans connexion ni accès
--    actif, s'ils ne sont membres d'aucun espace (pg_cron).
--  * Règles de partage (L27) : les modes « invite » et « domain » deviennent autorisables ; un espace qui
--    autorisait les deux modes existants les autorise tous. Une démo restreinte en conflit avec les
--    règles est bloquée, jamais rouverte en lien public.

-- ===== Domaines =====
create or replace function public.mail_domain_ok(p text)
returns boolean language sql immutable set search_path = '' as $$
  select p ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' and char_length(p) <= 253
     and p <> all (array['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.fr', 'hotmail.com', 'hotmail.fr',
       'outlook.com', 'outlook.fr', 'live.com', 'live.fr', 'msn.com', 'icloud.com', 'me.com', 'aol.com',
       'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'neuf.fr', 'laposte.net', 'bbox.fr', 'gmx.fr', 'gmx.com',
       'protonmail.com', 'proton.me', 'yandex.com']);
$$;

create or replace function public.mail_domains_ok(p text[])
returns boolean language sql immutable set search_path = '' as $$
  select cardinality(p) <= 20 and coalesce(bool_and(public.mail_domain_ok(d)), true) from unnest(p) d;
$$;

alter table public.demo_access add column if not exists domains text[] not null default '{}';
alter table public.demo_access drop constraint if exists demo_access_domains_check;
alter table public.demo_access add constraint demo_access_domains_check check (public.mail_domains_ok(domains));
grant select (domains) on public.demo_access to authenticated;

-- ===== Invités =====
create table if not exists public.demo_access_invites (
  demo_id uuid not null references public.demos (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) <= 254
                             and email ~ '^[^@\s]+@[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  invited_by uuid references auth.users (id) on delete set null,
  invited_at timestamptz not null default now(),
  last_sent_at timestamptz,
  opened_at timestamptz,
  primary key (demo_id, email)
);
create index if not exists demo_access_invites_ws_idx on public.demo_access_invites (workspace_id);
alter table public.demo_access_invites enable row level security;
revoke all on public.demo_access_invites from anon, authenticated;
grant select on public.demo_access_invites to authenticated;
drop policy if exists demo_access_invites_select on public.demo_access_invites;
create policy demo_access_invites_select on public.demo_access_invites for select to authenticated
  using (public.has_role(workspace_id, 'editor'));

-- ===== Accès délivrés par e-mail =====
alter table public.demo_access_grants add column if not exists email text;

-- ===== Plafonds d'envoi =====
create table if not exists public.access_email_sends (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  demo_id uuid references public.demos (id) on delete set null,
  kind text not null check (kind in ('invite', 'request')),
  email_hash text not null check (char_length(email_hash) = 64),
  client_key text check (client_key is null or char_length(client_key) between 16 and 128),
  sent_at timestamptz not null default now()
);
create index if not exists access_email_sends_at_idx on public.access_email_sends (sent_at);
create index if not exists access_email_sends_email_idx on public.access_email_sends (email_hash, sent_at);
alter table public.access_email_sends enable row level security;
revoke all on public.access_email_sends from anon, authenticated;

-- ===== Règles de partage : quatre modes =====
alter table public.share_rules drop constraint if exists share_rules_modes_check;
alter table public.share_rules alter column modes set default array['link', 'password', 'invite', 'domain'];
alter table public.share_rules add constraint share_rules_modes_check
  check (modes <@ array['link', 'password', 'invite', 'domain'] and cardinality(modes) between 1 and 4);
update public.share_rules set modes = modes || array['invite', 'domain']
 where modes @> array['link', 'password'] and cardinality(modes) = 2;

create or replace function public.share_rules_of(p_ws uuid)
returns public.share_rules language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select r from public.share_rules r where r.workspace_id = p_ws),
    row(p_ws, array['link', 'password', 'invite', 'domain'], null, 'editor', true, now(), null)::public.share_rules
  );
$$;
revoke all on function public.share_rules_of(uuid) from public, anon, authenticated;

create or replace function public.share_rules_preview(p_ws uuid, p_modes text[], p_max_days int)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return (
    select jsonb_build_object(
      'count', count(*),
      -- Démos qui seront bloquées : accès restreint non autorisé, ou mot de passe exigé sans mot de passe
      'locked', count(*) filter (where c.kind = 'mode' and (c.mode in ('invite', 'domain') or (
                                   not ('link' = any (p_modes))
                                   and not ('password' = any (p_modes) and c.has_password)))),
      'items', coalesce((select jsonb_agg(jsonb_build_object('title', x.title, 'kind', x.kind, 'mode', x.mode))
                           from (select * from public.share_rules_conflicts(p_ws, p_modes, p_max_days)
                                 order by title, kind limit 5) x), '[]'::jsonb))
      from public.share_rules_conflicts(p_ws, p_modes, p_max_days) c
  );
end $$;
revoke all on function public.share_rules_preview(uuid, text[], int) from public, anon;
grant execute on function public.share_rules_preview(uuid, text[], int) to authenticated;

create or replace function public.set_share_rules(
  p_ws uuid, p_modes text[], p_max_days int, p_publish_role text, p_exports boolean, p_fix boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c record;
  v_fixed int := 0;
  v_locked int := 0;
  v_until timestamptz := case when p_max_days is not null then now() + make_interval(days => p_max_days) end;
begin
  if not public.has_role(p_ws, 'admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not coalesce((public.plan_limit(p_ws, 'share_rules') #>> '{}')::boolean, false) then
    raise exception 'PLAN_REQUIRED:share_rules' using errcode = 'P0001';
  end if;
  if p_modes is null or cardinality(p_modes) = 0 then raise exception 'RULE_MODES_EMPTY' using errcode = 'P0001'; end if;
  if not (p_modes <@ array['link', 'password', 'invite', 'domain']) then
    raise exception 'NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  if p_fix then
    perform set_config('fd.rules_fix', '1', true);
    for c in select * from public.share_rules_conflicts(p_ws, p_modes, p_max_days) loop
      if c.kind = 'mode' then
        insert into public.demo_access (demo_id, workspace_id, mode) values (c.demo_id, p_ws, 'link')
          on conflict (demo_id) do nothing;
        if c.mode in ('invite', 'domain') then
          -- Accès restreint non autorisé : bloqué, jamais rouvert en lien public
          update public.demo_access set locked_by_rules = true, updated_at = now() where demo_id = c.demo_id;
          v_locked := v_locked + 1;
        elsif 'password' = any (p_modes) and c.has_password then
          update public.demo_access set mode = 'password', updated_at = now(), updated_by = (select auth.uid())
           where demo_id = c.demo_id;
          v_fixed := v_fixed + 1;
        elsif 'link' = any (p_modes) then
          update public.demo_access set mode = 'link', updated_at = now(), updated_by = (select auth.uid())
           where demo_id = c.demo_id;
          v_fixed := v_fixed + 1;
        else
          update public.demo_access set locked_by_rules = true, updated_at = now() where demo_id = c.demo_id;
          v_locked := v_locked + 1;
        end if;
      elsif c.kind = 'expiry' then
        insert into public.demo_access (demo_id, workspace_id, mode, expires_at)
          values (c.demo_id, p_ws, 'link', v_until)
          on conflict (demo_id) do update set expires_at = v_until, updated_at = now();
        v_fixed := v_fixed + 1;
      else
        update public.share_links set expires_at = v_until where id = c.link_id;
        v_fixed := v_fixed + 1;
      end if;
    end loop;
    perform set_config('fd.rules_fix', '0', true);
  end if;

  insert into public.share_rules (workspace_id, modes, max_link_days, publish_role, exports_allowed, updated_at, updated_by)
  values (p_ws, p_modes, p_max_days, p_publish_role, p_exports, now(), (select auth.uid()))
  on conflict (workspace_id) do update
    set modes = excluded.modes, max_link_days = excluded.max_link_days, publish_role = excluded.publish_role,
        exports_allowed = excluded.exports_allowed, updated_at = now(), updated_by = excluded.updated_by;
  return jsonb_build_object('fixed', v_fixed, 'locked', v_locked);
end $$;
revoke all on function public.set_share_rules(uuid, text[], int, text, boolean, boolean) from public, anon;
grant execute on function public.set_share_rules(uuid, text[], int, text, boolean, boolean) to authenticated;

-- Débloque une démo bloquée par les règles quand elle repasse dans un mode autorisé (invitation, domaine)
create or replace function public.demo_access_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r public.share_rules := public.share_rules_of(new.workspace_id);
  v_max timestamptz := case when r.max_link_days is not null then now() + make_interval(days => r.max_link_days) end;
begin
  if current_setting('fd.rules_fix', true) = '1' then return new; end if;
  if not (new.mode = any (r.modes)) then
    raise exception 'RULE_MODE' using errcode = 'P0001';
  end if;
  if v_max is not null then
    if new.expires_at is null then
      new.expires_at := v_max;
    elsif (tg_op = 'INSERT' or new.expires_at is distinct from old.expires_at)
          and new.expires_at > v_max + interval '1 minute' then
      raise exception 'RULE_EXPIRY:%', r.max_link_days using errcode = 'P0001';
    end if;
  end if;
  if new.locked_by_rules and new.mode = any (r.modes)
     and (tg_op = 'INSERT' or new.mode is distinct from old.mode
          or new.password_hash is distinct from old.password_hash)
     and (new.mode in ('invite', 'domain') or (new.mode = 'password' and new.password_hash is not null)) then
    new.locked_by_rules := false;
  end if;
  return new;
end $$;

-- ===== Réglages (éditeur et plus) =====
-- Adresse déjà invitée, ou domaine autorisé, selon le mode courant
create or replace function public.access_email_allowed(p_demo uuid, p_email text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case a.mode
             when 'invite' then exists (select 1 from public.demo_access_invites i
                                         where i.demo_id = p_demo and i.email = lower(p_email))
             when 'domain' then split_part(lower(p_email), '@', 2) = any (a.domains)
             else false end
      from public.demo_access a where a.demo_id = p_demo), false);
$$;
revoke all on function public.access_email_allowed(uuid, text) from public, anon, authenticated;

create or replace function public.set_demo_access(
  p_demo uuid, p_mode text, p_ask_email boolean, p_expires_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := public.demo_workspace(p_demo);
begin
  if ws is null or not public.has_role(ws, 'editor') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_mode not in ('link', 'password', 'invite', 'domain') then
    raise exception 'NOT_AVAILABLE' using errcode = 'P0001';
  end if;
  if p_mode = 'password' and not exists (
    select 1 from public.demo_access where demo_id = p_demo and password_hash is not null
  ) then
    raise exception 'PASSWORD_REQUIRED' using errcode = 'P0001';
  end if;
  if p_mode = 'invite' and not exists (select 1 from public.demo_access_invites where demo_id = p_demo) then
    raise exception 'INVITES_REQUIRED' using errcode = 'P0001';
  end if;
  if p_mode = 'domain' and not exists (
    select 1 from public.demo_access where demo_id = p_demo and cardinality(domains) > 0
  ) then
    raise exception 'DOMAINS_REQUIRED' using errcode = 'P0001';
  end if;
  update public.demo_access
     set mode = p_mode, ask_email = coalesce(p_ask_email, false), expires_at = p_expires_at,
         updated_at = now(), updated_by = (select auth.uid())
   where demo_id = p_demo;
  if not found then
    insert into public.demo_access (demo_id, workspace_id, mode, ask_email, expires_at, updated_by)
    values (p_demo, ws, p_mode, coalesce(p_ask_email, false), p_expires_at, (select auth.uid()));
  end if;
end $$;
revoke all on function public.set_demo_access(uuid, text, boolean, timestamptz) from public, anon;
grant execute on function public.set_demo_access(uuid, text, boolean, timestamptz) to authenticated;

-- Domaines autorisés (remplace la liste) ; un domaine retiré révoque les accès qu'il donnait
create or replace function public.set_demo_domains(p_demo uuid, p_domains text[])
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := public.demo_workspace(p_demo);
  v text[];
begin
  if ws is null or not public.has_role(ws, 'editor') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct d order by d), '{}') into v
    from (select lower(trim(both from regexp_replace(x, '^@', ''))) d from unnest(coalesce(p_domains, '{}')) x) s
   where d <> '';
  if not public.mail_domains_ok(v) then raise exception 'DOMAIN_INVALID' using errcode = 'P0001'; end if;
  update public.demo_access set domains = v, updated_at = now(), updated_by = (select auth.uid())
   where demo_id = p_demo;
  if not found then
    insert into public.demo_access (demo_id, workspace_id, mode, domains, updated_by)
    values (p_demo, ws, 'link', v, (select auth.uid()));
  end if;
  if cardinality(v) = 0 and exists (select 1 from public.demo_access where demo_id = p_demo and mode = 'domain') then
    raise exception 'DOMAINS_REQUIRED' using errcode = 'P0001';
  end if;
  return v;
end $$;
revoke all on function public.set_demo_domains(uuid, text[]) from public, anon;
grant execute on function public.set_demo_domains(uuid, text[]) to authenticated;

-- Ajout d'invités (50 adresses au plus par appel, 500 par démo) ; renvoie les adresses ajoutées
create or replace function public.add_demo_invites(p_demo uuid, p_emails text[])
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := public.demo_workspace(p_demo);
  v text[];
  bad text;
  added text[];
begin
  if ws is null or not public.has_role(ws, 'editor') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct e), '{}') into v
    from (select lower(trim(both from x)) e from unnest(coalesce(p_emails, '{}')) x) s where e <> '';
  if cardinality(v) = 0 or cardinality(v) > 50 then raise exception 'INVITES_COUNT' using errcode = 'P0001'; end if;
  select e into bad from unnest(v) e where not (e ~ '^[^@\s]+@[a-z0-9-]+(\.[a-z0-9-]+)+$' and char_length(e) <= 254) limit 1;
  if bad is not null then raise exception 'EMAIL_INVALID:%', bad using errcode = 'P0001'; end if;
  if (select count(*) from public.demo_access_invites where demo_id = p_demo) + cardinality(v) > 500 then
    raise exception 'INVITES_LIMIT' using errcode = 'P0001';
  end if;
  with ins as (
    insert into public.demo_access_invites (demo_id, workspace_id, email, invited_by)
    select p_demo, ws, e, (select auth.uid()) from unnest(v) e
    on conflict (demo_id, email) do nothing
    returning email)
  select coalesce(array_agg(email order by email), '{}') into added from ins;
  return added;
end $$;
revoke all on function public.add_demo_invites(uuid, text[]) from public, anon;
grant execute on function public.add_demo_invites(uuid, text[]) to authenticated;

-- Retrait d'un invité : ses accès en cours sont révoqués ; le mode invitation garde au moins un invité
create or replace function public.remove_demo_invite(p_demo uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := public.demo_workspace(p_demo);
begin
  if ws is null or not public.has_role(ws, 'editor') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  delete from public.demo_access_invites where demo_id = p_demo and email = lower(p_email);
  delete from public.demo_access_grants where demo_id = p_demo and email = lower(p_email);
  if exists (select 1 from public.demo_access where demo_id = p_demo and mode = 'invite')
     and not exists (select 1 from public.demo_access_invites where demo_id = p_demo) then
    raise exception 'INVITES_REQUIRED' using errcode = 'P0001';
  end if;
end $$;
revoke all on function public.remove_demo_invite(uuid, text) from public, anon;
grant execute on function public.remove_demo_invite(uuid, text) to authenticated;

-- ===== Envois (Edge Function access-email, service_role) =====
-- Réserve un envoi : contrôle des droits, de l'adresse et des plafonds, puis trace. Rend ok, ou la raison
-- du refus : forbidden | not_found | not_allowed (adresse ni invitée ni du domaine) | domain_refused |
-- rate_limited. p_user : l'admin qui envoie une invitation ; null pour une demande d'un visiteur.
create or replace function public.access_email_reserve(
  p_kind text, p_demo uuid, p_email text, p_user uuid default null, p_client text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d record;
  a public.demo_access;
  e text := lower(trim(both from coalesce(p_email, '')));
  h text;
begin
  select dm.id, dm.title, dm.workspace_id, dm.status, dm.deleted_at, w.name as ws_name, w.public_links_enabled
    into d from public.demos dm join public.workspaces w on w.id = dm.workspace_id where dm.id = p_demo;
  if not found or d.deleted_at is not null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if e !~ '^[^@\s]+@[a-z0-9-]+(\.[a-z0-9-]+)+$' then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  select * into a from public.demo_access where demo_id = p_demo;
  if p_kind = 'invite' then
    if p_user is null or not exists (select 1 from public.members m where m.workspace_id = d.workspace_id
                                       and m.user_id = p_user and m.role >= 'admin') then
      return jsonb_build_object('ok', false, 'reason', 'forbidden');
    end if;
    if not exists (select 1 from public.demo_access_invites where demo_id = p_demo and email = e) then
      return jsonb_build_object('ok', false, 'reason', 'not_allowed');
    end if;
  elsif p_kind = 'request' then
    if d.status <> 'published' or not d.public_links_enabled or a.demo_id is null
       or a.mode not in ('invite', 'domain') or a.locked_by_rules
       or (a.expires_at is not null and a.expires_at <= now()) then
      return jsonb_build_object('ok', false, 'reason', 'not_found');
    end if;
    if a.mode = 'domain' and not (split_part(e, '@', 2) = any (a.domains)) then
      return jsonb_build_object('ok', false, 'reason', 'domain_refused');
    end if;
    if not public.access_email_allowed(p_demo, e) then
      return jsonb_build_object('ok', false, 'reason', 'not_allowed');
    end if;
  else
    raise exception 'KIND' using errcode = 'P0001';
  end if;

  h := encode(extensions.digest(e, 'sha256'), 'hex');
  -- Plafonds : 20 par heure en tout (le SMTP en permet 30), 10 par espace, 1 par adresse et 10 minutes,
  -- et 3 par client et par heure pour les demandes anonymes. Verrou : une réservation à la fois.
  perform pg_advisory_xact_lock(hashtext('fd.access_email_sends'));
  if (select count(*) from public.access_email_sends where sent_at > now() - interval '1 hour') >= 20
     or (select count(*) from public.access_email_sends
          where workspace_id = d.workspace_id and sent_at > now() - interval '1 hour') >= 10
     or exists (select 1 from public.access_email_sends
                 where email_hash = h and sent_at > now() - interval '10 minutes')
     or (p_kind = 'request' and p_client is not null and (
           select count(*) from public.access_email_sends
            where client_key = p_client and sent_at > now() - interval '1 hour') >= 3) then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  insert into public.access_email_sends (workspace_id, demo_id, kind, email_hash, client_key)
  values (d.workspace_id, p_demo, p_kind, h,
          case when p_client is not null and char_length(p_client) between 16 and 128 then p_client end);
  update public.demo_access_invites set last_sent_at = now() where demo_id = p_demo and email = e;
  return jsonb_build_object('ok', true, 'email', e, 'demoTitle', d.title, 'workspace', d.ws_name);
end $$;
revoke all on function public.access_email_reserve(text, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.access_email_reserve(text, uuid, text, uuid, text) to service_role;

-- Lien d'accès à copier (sans envoi) : éditeur de l'espace, adresse invitée
create or replace function public.access_link_check(p_demo uuid, p_email text, p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  ws uuid := public.demo_workspace(p_demo);
begin
  if ws is null or not exists (select 1 from public.members m where m.workspace_id = ws
                                 and m.user_id = p_user and m.role >= 'editor') then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if not exists (select 1 from public.demo_access_invites where demo_id = p_demo and email = lower(p_email)) then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  return jsonb_build_object('ok', true, 'email', lower(p_email),
    'demoTitle', (select title from public.demos where id = p_demo),
    'workspace', (select name from public.workspaces where id = ws));
end $$;
revoke all on function public.access_link_check(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.access_link_check(uuid, text, uuid) to service_role;

-- Compte existant pour une adresse (Edge Function, service_role) : identifiant et nature (visiteur ou non)
create or replace function public.access_account_of(p_email text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', u.id, 'visitor', coalesce(u.raw_app_meta_data ->> 'kind', '') = 'visitor')
    from auth.users u where lower(u.email) = lower(p_email) limit 1;
$$;
revoke all on function public.access_account_of(text) from public, anon, authenticated;
grant execute on function public.access_account_of(text) to service_role;

-- ===== Décision d'accès (open-demo) =====
drop function if exists public.demo_gate(uuid, text, text, text);
create or replace function public.demo_gate(
  p_demo uuid, p_password text default null, p_grant text default null, p_client text default null,
  p_email text default null
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
  if found and a.locked_by_rules then
    return jsonb_build_object('status', 'not_found');
  end if;
  if found and a.expires_at is not null and a.expires_at <= now() then
    return info || jsonb_build_object('status', 'expired', 'expiredAt', a.expires_at);
  end if;
  if not found or a.mode = 'link' then
    return info || jsonb_build_object('status', 'ok');
  end if;

  -- L39 : invitation ou domaine. Accès en cours encore valable, ou adresse vérifiée par open-demo.
  if a.mode in ('invite', 'domain') then
    if p_grant is not null and exists (
      select 1 from public.demo_access_grants g
       where g.token_hash = encode(extensions.digest(p_grant, 'sha256'), 'hex')
         and g.demo_id = p_demo and g.expires_at > now() and g.email is not null
         and public.access_email_allowed(p_demo, g.email)
    ) then
      return info || jsonb_build_object('status', 'ok', 'mode', a.mode);
    end if;
    if p_email is not null then
      if not public.access_email_allowed(p_demo, p_email) then
        return info || jsonb_build_object('status', 'email_not_allowed', 'mode', a.mode)
          || case when a.mode = 'domain' then jsonb_build_object('domains', to_jsonb(a.domains)) else '{}'::jsonb end;
      end if;
      delete from public.demo_access_grants where demo_id = p_demo and expires_at <= now();
      tok := encode(extensions.gen_random_bytes(24), 'hex');
      insert into public.demo_access_grants (token_hash, demo_id, email, expires_at)
        values (encode(extensions.digest(tok, 'sha256'), 'hex'), p_demo, lower(p_email), now() + interval '7 days');
      update public.demo_access_invites set opened_at = coalesce(opened_at, now())
       where demo_id = p_demo and email = lower(p_email);
      return info || jsonb_build_object('status', 'ok', 'mode', a.mode, 'grant', tok, 'grantDays', 7);
    end if;
    -- Domaine : les domaines autorisés sont montrés au visiteur (écran « Réservé au réseau »)
    return info || jsonb_build_object('status', 'email_required', 'mode', a.mode)
      || case when a.mode = 'domain' then jsonb_build_object('domains', to_jsonb(a.domains)) else '{}'::jsonb end;
  end if;

  -- Mot de passe : jeton déjà remis (jamais un accès obtenu par e-mail)
  if p_grant is not null and exists (
    select 1 from public.demo_access_grants g
     where g.token_hash = encode(extensions.digest(p_grant, 'sha256'), 'hex')
       and g.demo_id = p_demo and g.expires_at > now() and g.email is null
  ) then
    return info || jsonb_build_object('status', 'ok', 'askEmail', a.ask_email);
  end if;
  if p_password is null or p_password = '' then
    return info || jsonb_build_object('status', 'password_required', 'askEmail', a.ask_email);
  end if;
  if p_client is null or char_length(p_client) < 16 then
    raise exception 'CLIENT_REQUIRED' using errcode = 'P0001';
  end if;

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
revoke all on function public.demo_gate(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.demo_gate(uuid, text, text, text, text) to service_role;

-- ===== Purge (pg_cron) : comptes visiteurs inactifs, traces d'envoi =====
create or replace function public.purge_access_email()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  n_users int;
  n_sends int;
begin
  delete from public.access_email_sends where sent_at < now() - interval '7 days';
  get diagnostics n_sends = row_count;
  -- Visiteur (créé par une invitation ou un lien d'accès) : 90 jours sans connexion ni accès actif,
  -- membre d'aucun espace
  delete from auth.users u
   where u.raw_app_meta_data ->> 'kind' = 'visitor'
     and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '90 days'
     and not exists (select 1 from public.members m where m.user_id = u.id)
     and not exists (select 1 from public.demo_access_grants g
                      where g.email = lower(u.email) and g.expires_at > now());
  get diagnostics n_users = row_count;
  return jsonb_build_object('visitors', n_users, 'sends', n_sends);
end $$;
revoke all on function public.purge_access_email() from public, anon, authenticated;
grant execute on function public.purge_access_email() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('fd_access_email_purge', '40 3 * * *', 'select public.purge_access_email()');
  else
    raise notice 'pg_cron indisponible : purge des visiteurs et des envois non planifiée';
  end if;
end $$;
