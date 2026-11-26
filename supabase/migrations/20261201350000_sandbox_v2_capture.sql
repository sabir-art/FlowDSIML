-- Sandbox v2, étape 3 (docs/tech/sandbox-v2.md §3.5, §3.6 et §8) : données de la capture « vivante ».
--  * Bucket « html_live » (privé, JSON) : un enregistrement rejouable par page (document à marques,
--    scripts, réponses GET), déposé par html-ingest seulement. La copie inerte reste dans « html ».
--  * steps.html_live_path : enregistrement de la page, dans le dossier de son espace.
--  * html_meta.live : fiches des scripts (gardé ou bloqué, rétablissable sans recapture) et compteurs.
--  * demos.sandbox.live : réglage par démo (décision du chef : activable par un éditeur, autorisé par
--    défaut) ; workspaces.settings.sandboxLive : garde-fou d'espace qu'un administrateur peut fermer.
-- Les migrations en place ne changent pas : les fonctions de contrôle sont redéfinies ici, à l'identique
-- de leur dernière version plus les nouvelles clés.

-- ===== 1. Stockage =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('html_live', 'html_live', false, 31457280, array['application/json'])
on conflict (id) do update set public = false, file_size_limit = 31457280, allowed_mime_types = array['application/json'];

drop policy if exists html_live_select on storage.objects;
create policy html_live_select on storage.objects for select to authenticated
  using (bucket_id = 'html_live' and public.has_role(public.path_uuid(name, 1), 'viewer'));
drop policy if exists html_live_delete on storage.objects;
create policy html_live_delete on storage.objects for delete to authenticated
  using (bucket_id = 'html_live' and public.has_role(public.path_uuid(name, 1), 'editor'));

-- ===== 2. Étapes =====
alter table public.steps add column if not exists html_live_path text;
alter table public.steps drop constraint if exists steps_html_live_path_ok;
alter table public.steps add constraint steps_html_live_path_ok check (
  html_live_path is null
  or (html_path is not null and html_live_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.json$'));

-- Enregistrement rangé sous le dossier de l'espace et déposé par html-ingest
create or replace function public.steps_html_live_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.html_live_path is null then return new; end if;
  if public.path_uuid(new.html_live_path, 1) is distinct from new.workspace_id then
    raise exception 'HTML_PATH' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' or new.html_live_path is distinct from old.html_live_path then
    if not exists (select 1 from storage.objects o where o.bucket_id = 'html_live' and o.name = new.html_live_path) then
      raise exception 'HTML_OBJECT_MISSING' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.steps_html_live_check() from public, anon, authenticated;
drop trigger if exists steps_html_live_check on public.steps;
create trigger steps_html_live_check before insert or update of html_live_path on public.steps
  for each row execute function public.steps_html_live_check();

-- Fiches des scripts : { id, source, category, keep, bytes } ; compteurs de la capture
create or replace function public.html_live_meta_ok(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'object'
    and not exists (select 1 from jsonb_object_keys(v) k where k not in ('scripts', 'responses', 'unreplayed'))
    and (v -> 'responses' is null or (jsonb_typeof(v -> 'responses') = 'number' and (v ->> 'responses')::numeric between 0 and 300))
    and (v -> 'unreplayed' is null or (jsonb_typeof(v -> 'unreplayed') = 'number' and (v ->> 'unreplayed')::numeric between 0 and 100000))
    and (v -> 'scripts' is null or (jsonb_typeof(v -> 'scripts') = 'array' and jsonb_array_length(v -> 'scripts') <= 200
         and not exists (select 1 from jsonb_array_elements(v -> 'scripts') s
                         where jsonb_typeof(s) <> 'object'
                            or exists (select 1 from jsonb_object_keys(s) k where k not in ('id', 'source', 'category', 'keep', 'bytes'))
                            or coalesce(s ->> 'id', '') !~ '^s[0-9]{1,4}$'
                            or jsonb_typeof(s -> 'keep') <> 'boolean'
                            or coalesce(s ->> 'category', '') not in ('page', 'third', 'tracking')
                            or (s -> 'source' is not null and (jsonb_typeof(s -> 'source') <> 'string' or char_length(s ->> 'source') > 200))
                            or (s -> 'bytes' is not null and (jsonb_typeof(s -> 'bytes') <> 'number' or (s ->> 'bytes')::numeric not between 0 and 3145728)))));
$$;

-- html_meta : dernière version (20261127100000_html_securite_rapport.sql) plus « live »
create or replace function public.html_meta_ok(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'object'
    and not exists (select 1 from jsonb_object_keys(v) k
                    where k not in ('title', 'url', 'bytes', 'viewport', 'links', 'blurred', 'canvases', 'security', 'live'))
    and (v -> 'title' is null or (jsonb_typeof(v -> 'title') = 'string' and char_length(v ->> 'title') <= 200))
    and (v -> 'url' is null or (jsonb_typeof(v -> 'url') = 'string' and char_length(v ->> 'url') <= 2000))
    and (v -> 'bytes' is null or (jsonb_typeof(v -> 'bytes') = 'number' and (v ->> 'bytes')::numeric between 0 and 10485760))
    and (v -> 'blurred' is null or jsonb_typeof(v -> 'blurred') = 'number')
    and (v -> 'canvases' is null or jsonb_typeof(v -> 'canvases') = 'number')
    and (v -> 'viewport' is null or (jsonb_typeof(v -> 'viewport') = 'object'
         and jsonb_typeof(v -> 'viewport' -> 'w') = 'number' and jsonb_typeof(v -> 'viewport' -> 'h') = 'number'
         and (v -> 'viewport') - 'w' - 'h' = '{}'::jsonb))
    and (v -> 'links' is null or (jsonb_typeof(v -> 'links') = 'array' and jsonb_array_length(v -> 'links') <= 300
         and not exists (select 1 from jsonb_array_elements(v -> 'links') l
                         where jsonb_typeof(l) <> 'object'
                            or exists (select 1 from jsonb_object_keys(l) k where k not in ('sel', 'href', 'label'))
                            or jsonb_typeof(l -> 'sel') <> 'string' or char_length(l ->> 'sel') not between 1 and 500
                            or coalesce(l ->> 'href', '') !~ '^https?://' or char_length(l ->> 'href') > 2000
                            or (l -> 'label' is not null and (jsonb_typeof(l -> 'label') <> 'string' or char_length(l ->> 'label') > 120)))))
    and (v -> 'security' is null or public.html_security_ok(v -> 'security'))
    and (v -> 'live' is null or public.html_live_meta_ok(v -> 'live'));
$$;

-- ===== 3. Réglage par démo : demos.sandbox.live (dernière version de sandbox_ok plus « live ») =====
create or replace function public.sandbox_ok(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select v is null or (jsonb_typeof(v) = 'object'
    and not exists (select 1 from jsonb_object_keys(v) k
                    where k not in ('start', 'autoLink', 'unlinked', 'guide', 'keyPages', 'ignoredLinks', 'guideSteps', 'live'))
    and (v -> 'start' is null or jsonb_typeof(v -> 'start') = 'null'
         or (v ->> 'start') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    and (v -> 'autoLink' is null or jsonb_typeof(v -> 'autoLink') = 'boolean')
    and (v -> 'guide' is null or jsonb_typeof(v -> 'guide') = 'boolean')
    and (v -> 'live' is null or jsonb_typeof(v -> 'live') = 'boolean')
    and (v -> 'unlinked' is null or (v ->> 'unlinked') in ('toast', 'none', 'highlight'))
    and (v -> 'keyPages' is null or (jsonb_typeof(v -> 'keyPages') = 'array' and jsonb_array_length(v -> 'keyPages') <= 200
         and not exists (select 1 from jsonb_array_elements(v -> 'keyPages') k
                         where coalesce(k #>> '{}', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')))
    and (v -> 'ignoredLinks' is null or (jsonb_typeof(v -> 'ignoredLinks') = 'array'
         and jsonb_array_length(v -> 'ignoredLinks') <= 500
         and not exists (select 1 from jsonb_array_elements(v -> 'ignoredLinks') x
                         where jsonb_typeof(x) <> 'object'
                            or exists (select 1 from jsonb_object_keys(x) k where k not in ('url', 'from'))
                            or coalesce(x ->> 'url', '') !~ '^https?://\S+$'
                            or length(x ->> 'url') > 2048
                            or coalesce(x ->> 'from', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')))
    and (v -> 'guideSteps' is null or (jsonb_typeof(v -> 'guideSteps') = 'array'
         and jsonb_array_length(v -> 'guideSteps') <= 30
         and not exists (select 1 from jsonb_array_elements(v -> 'guideSteps') g
                         where jsonb_typeof(g) <> 'object'
                            or exists (select 1 from jsonb_object_keys(g) k where k not in ('page', 'hotspot', 'advance'))
                            or coalesce(g ->> 'page', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                            or coalesce(g ->> 'hotspot', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                            or (g -> 'advance' is not null and (g ->> 'advance') not in ('click', 'next'))))));
$$;

-- ===== 4. Garde-fou d'espace : settings.sandboxLive (autorisé par défaut) =====
create or replace function public.sandbox_live_allowed(p_ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((w.settings ->> 'sandboxLive')::boolean, true) from public.workspaces w where w.id = p_ws;
$$;
revoke all on function public.sandbox_live_allowed(uuid) from public, anon;
grant execute on function public.sandbox_live_allowed(uuid) to authenticated, service_role;

create or replace function public.workspaces_sandbox_live_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('fd.sandbox_live_set', true), '') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    if new.settings ? 'sandboxLive' then raise exception 'SANDBOX_LIVE_RPC_ONLY' using errcode = '42501'; end if;
  elsif (new.settings -> 'sandboxLive') is distinct from (old.settings -> 'sandboxLive') then
    raise exception 'SANDBOX_LIVE_RPC_ONLY' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.workspaces_sandbox_live_guard() from public, anon, authenticated;
drop trigger if exists workspaces_sandbox_live_guard on public.workspaces;
create trigger workspaces_sandbox_live_guard before insert or update of settings on public.workspaces
  for each row execute function public.workspaces_sandbox_live_guard();

alter table public.audit_log drop constraint if exists audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check check (action in
  ('learners.export', 'learner.erase', 'learners.purge', 'webhook.secret_revealed', 'webhook.secret_rotated',
   'settings.html_capture', 'leads.purge', 'api_key.create', 'api_key.revoke', 'settings.sandbox_live'));

/** Admin ou propriétaire : autorise ou interdit le mode Sandbox v2 dans l'espace (journalisé). */
create or replace function public.set_sandbox_live(p_ws uuid, p_on boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_old boolean;
begin
  if not public.has_role(p_ws, 'admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_on is null then raise exception 'INVALID' using errcode = '22023'; end if;
  v_old := public.sandbox_live_allowed(p_ws);
  perform set_config('fd.sandbox_live_set', '1', true);
  update public.workspaces set settings = settings || jsonb_build_object('sandboxLive', p_on), updated_at = now()
   where id = p_ws;
  perform set_config('fd.sandbox_live_set', '0', true);
  if v_old is distinct from p_on then
    insert into public.audit_log (workspace_id, actor_id, action, meta)
    values (p_ws, (select auth.uid()), 'settings.sandbox_live', jsonb_build_object('old', v_old, 'new', p_on));
  end if;
  return p_on;
end $$;
revoke all on function public.set_sandbox_live(uuid, boolean) from public, anon;
grant execute on function public.set_sandbox_live(uuid, boolean) to authenticated;

-- Un enregistrement vivant n'est accepté que si l'espace l'autorise
create or replace function public.steps_sandbox_live_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.html_live_path is null then return new; end if;
  if tg_op = 'UPDATE' and new.html_live_path is not distinct from old.html_live_path then return new; end if;
  if not public.sandbox_live_allowed(new.workspace_id) then
    raise exception 'SANDBOX_LIVE_DISABLED' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.steps_sandbox_live_guard() from public, anon, authenticated;
drop trigger if exists steps_sandbox_live_guard on public.steps;
create trigger steps_sandbox_live_guard before insert or update of html_live_path on public.steps
  for each row execute function public.steps_sandbox_live_guard();
