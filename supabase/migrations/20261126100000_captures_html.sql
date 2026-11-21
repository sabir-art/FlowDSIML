-- L49 P1 (docs/ux/specs/l49-securite-html.md §2) : réglage « Captures HTML » de l'espace.
--  * workspaces.settings.htmlCapture = { mode: 'allowed' | 'domains' | 'disabled', domains: text[] },
--    lisible par les membres, écrit UNIQUEMENT par set_html_capture (admin ou propriétaire) ; un
--    déclencheur refuse toute autre écriture de la clé (même modèle que settings.ai).
--  * Chaque changement est noté dans audit_log (action settings.html_capture, ancienne et nouvelle valeur).
--  * html_capture_allows : règle appliquée par html-ingest (service_role) sur l'hôte de html_meta.url.

-- ===== Domaine valide : minuscules, sans protocole ni chemin ; joker de sous-domaine « *. » en tête =====
create or replace function public.html_capture_domain_ok(p text)
returns boolean language sql immutable set search_path = '' as $$
  select p is not null and length(p) <= 253
    and p ~ '^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$';
$$;

-- Hôte couvert par la liste : égalité exacte, ou sous-domaine pour « *.x » (qui ne couvre pas x lui-même)
create or replace function public.html_capture_host_in(p_host text, p_domains text[])
returns boolean language sql immutable set search_path = '' as $$
  select exists (
    select 1 from unnest(coalesce(p_domains, '{}'::text[])) d
     where lower(p_host) = d
        or (d like '*.%' and lower(p_host) like '%.' || substr(d, 3) and lower(p_host) <> substr(d, 3))
  );
$$;

-- Réglage effectif (défaut : autorisées partout)
create or replace function public.html_capture_config(p_ws uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'mode', coalesce(w.settings -> 'htmlCapture' ->> 'mode', 'allowed'),
    'domains', coalesce(w.settings -> 'htmlCapture' -> 'domains', '[]'::jsonb)
  ) from public.workspaces w where w.id = p_ws;
$$;
revoke all on function public.html_capture_config(uuid) from public, anon, authenticated;

/** 'ok', 'HTML_CAPTURE_DISABLED' ou 'HTML_CAPTURE_DOMAIN' pour une page de cet hôte. Appelée par html-ingest. */
create or replace function public.html_capture_allows(p_ws uuid, p_host text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := public.html_capture_config(p_ws);
  v_domains text[];
begin
  if v ->> 'mode' = 'disabled' then return 'HTML_CAPTURE_DISABLED'; end if;
  if v ->> 'mode' = 'domains' then
    select coalesce(array_agg(x), '{}'::text[]) into v_domains from jsonb_array_elements_text(v -> 'domains') x;
    if p_host is null or not public.html_capture_host_in(p_host, v_domains) then return 'HTML_CAPTURE_DOMAIN'; end if;
  end if;
  return 'ok';
end $$;
revoke all on function public.html_capture_allows(uuid, text) from public, anon, authenticated;
grant execute on function public.html_capture_allows(uuid, text) to service_role;

-- ===== Seule set_html_capture écrit settings.htmlCapture =====
create or replace function public.workspaces_html_capture_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('fd.html_capture_set', true), '') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    if new.settings ? 'htmlCapture' then raise exception 'HTML_CAPTURE_RPC_ONLY' using errcode = '42501'; end if;
  elsif (new.settings -> 'htmlCapture') is distinct from (old.settings -> 'htmlCapture') then
    raise exception 'HTML_CAPTURE_RPC_ONLY' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.workspaces_html_capture_guard() from public, anon, authenticated;
drop trigger if exists workspaces_html_capture_guard on public.workspaces;
create trigger workspaces_html_capture_guard before insert or update of settings on public.workspaces
  for each row execute function public.workspaces_html_capture_guard();

-- ===== Journal =====
alter table public.audit_log drop constraint if exists audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check check (action in
  ('learners.export', 'learner.erase', 'learners.purge', 'webhook.secret_revealed', 'webhook.secret_rotated',
   'settings.html_capture'));

-- ===== Écriture (admin ou propriétaire) =====
create or replace function public.set_html_capture(p_ws uuid, p_mode text, p_domains text[] default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb;
  v_domains text[];
  v_new jsonb;
begin
  if not public.has_role(p_ws, 'admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_mode is null or p_mode not in ('allowed', 'domains', 'disabled') then
    raise exception 'INVALID_MODE' using errcode = '22023';
  end if;
  -- Minuscules, espaces retirés, doublons retirés ; l'ordre de saisie est gardé
  select coalesce(array_agg(d order by first_at), '{}'::text[]) into v_domains
    from (select lower(btrim(d)) as d, min(o) as first_at
            from unnest(coalesce(p_domains, '{}'::text[])) with ordinality as t(d, o)
           where btrim(d) <> '' group by lower(btrim(d))) x;
  if cardinality(v_domains) > 50 then raise exception 'HTML_CAPTURE_DOMAIN_MAX' using errcode = '22023'; end if;
  if exists (select 1 from unnest(v_domains) d where not public.html_capture_domain_ok(d)) then
    raise exception 'HTML_CAPTURE_DOMAIN_INVALID' using errcode = '22023';
  end if;
  if p_mode = 'domains' and cardinality(v_domains) = 0 then
    raise exception 'HTML_CAPTURE_DOMAIN_REQUIRED' using errcode = '22023';
  end if;
  v_old := public.html_capture_config(p_ws);
  v_new := jsonb_build_object('mode', p_mode, 'domains', to_jsonb(v_domains));
  perform set_config('fd.html_capture_set', '1', true);
  update public.workspaces set settings = settings || jsonb_build_object('htmlCapture', v_new), updated_at = now()
   where id = p_ws;
  perform set_config('fd.html_capture_set', '0', true);
  if v_old is distinct from v_new then
    insert into public.audit_log (workspace_id, actor_id, action, meta)
    values (p_ws, (select auth.uid()), 'settings.html_capture', jsonb_build_object('old', v_old, 'new', v_new));
  end if;
  return v_new;
end $$;
revoke all on function public.set_html_capture(uuid, text, text[]) from public, anon;
grant execute on function public.set_html_capture(uuid, text, text[]) to authenticated;

-- ===== Même règle sur l'adresse enregistrée : une nouvelle page HTML (html_path posé ou changé) doit venir
--       d'un hôte autorisé. Les pages existantes restent modifiables (textes, liens, flou). =====
create or replace function public.html_url_host(p_url text)
returns text language sql immutable set search_path = '' as $$
  select lower(substring(p_url from '^[hH][tT][tT][pP][sS]?://(?:[^/?#@]*@)?([^/?#:\[\]]+)'));
$$;

create or replace function public.steps_html_capture_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v text;
begin
  if new.kind <> 'html' or new.html_path is null then return new; end if;
  if tg_op = 'UPDATE' and new.html_path is not distinct from old.html_path then return new; end if;
  v := public.html_capture_allows(new.workspace_id, public.html_url_host(new.html_meta ->> 'url'));
  if v <> 'ok' then raise exception '%', v using errcode = '42501'; end if;
  return new;
end $$;
revoke all on function public.steps_html_capture_guard() from public, anon, authenticated;
drop trigger if exists steps_html_capture_guard on public.steps;
create trigger steps_html_capture_guard before insert or update of html_path on public.steps
  for each row execute function public.steps_html_capture_guard();
