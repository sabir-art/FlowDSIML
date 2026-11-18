-- FlowDSIML — L14 : centre de formation (F4). Idempotent, additif. Schéma approuvé par le chef d'équipe.
--  * Un centre par workspace (training_centers) : brouillon (draft) et instantané publié (published).
--    La page publique ne lit QUE published, via l'Edge Function open-center (service_role).
--  * Accès comme L11 : lien ou mot de passe (essais limités, jetons sha256) ; invitation et domaine
--    restent « Bientôt » et n'existent pas en base.
--  * Contenu public : uniquement les démos publiées et non supprimées. Aucun titre de brouillon ne sort ;
--    une formation sans module publié disparaît. Modules en mot de passe ou expirés : listés avec leur
--    état (badge), sans couverture ni contenu.
--  * Visiteur identifié par son lien personnel (même règle que learner_resume) : prénom seul et états
--    des modules ; sinon visitor = null.
--  * Étiquettes d'une formation : union des étiquettes L12-07 de ses modules publiés (pas de table).
--  * Logo : bucket public « branding » (<workspace>/center-logo.<ext>, écriture admin), jamais « published ».

-- ---------------------------------------------------------------------------
-- Formations : description (recherche, intro de la page d'une formation)
-- ---------------------------------------------------------------------------
alter table public.paths add column if not exists description text not null default '';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'paths_description_len') then
    alter table public.paths add constraint paths_description_len check (char_length(description) <= 600);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Validation du brouillon (clés connues, tailles, formats)
-- ---------------------------------------------------------------------------
create or replace function public.center_draft_valid(d jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(d) = 'object'
    and not exists (
      select 1 from jsonb_object_keys(d) k
      where k not in ('title', 'intro', 'brand', 'accent', 'style', 'logoPath', 'help', 'indexable', 'a11y', 'a11yUrl',
                    'privacyUrl', 'paths'))
    and (d -> 'title' is null or (jsonb_typeof(d -> 'title') = 'string' and char_length(d ->> 'title') <= 120))
    and (d -> 'intro' is null or (jsonb_typeof(d -> 'intro') = 'string' and char_length(d ->> 'intro') <= 600))
    and (d -> 'brand' is null or (d ->> 'brand') ~ '^#[0-9a-fA-F]{6}$')
    and (d -> 'accent' is null or (d ->> 'accent') ~ '^#[0-9a-fA-F]{6}$')
    and (d -> 'style' is null or (d ->> 'style') in ('workspace', 'sober', 'dark', 'contrast'))
    and (d -> 'logoPath' is null or jsonb_typeof(d -> 'logoPath') = 'null'
         or (d ->> 'logoPath') ~ '^[0-9a-f-]{36}/center-logo-[0-9a-z]{4,24}\.(png|svg|webp)$')
    and (d -> 'help' is null or (jsonb_typeof(d -> 'help') = 'string' and char_length(d ->> 'help') <= 200
         and ((d ->> 'help') = '' or (d ->> 'help') ~ '^https://\S+$' or (d ->> 'help') ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')))
    and (d -> 'a11yUrl' is null or (jsonb_typeof(d -> 'a11yUrl') = 'string' and char_length(d ->> 'a11yUrl') <= 300
         and ((d ->> 'a11yUrl') = '' or (d ->> 'a11yUrl') ~ '^https://\S+$')))
    and (d -> 'privacyUrl' is null or (jsonb_typeof(d -> 'privacyUrl') = 'string' and char_length(d ->> 'privacyUrl') <= 300
         and ((d ->> 'privacyUrl') = '' or (d ->> 'privacyUrl') ~ '^https://\S+$')))
    and (d -> 'indexable' is null or jsonb_typeof(d -> 'indexable') = 'boolean')
    and (d -> 'a11y' is null or (d ->> 'a11y') in ('non_evalue', 'partiel', 'total'))
    and (d -> 'paths' is null or (
      jsonb_typeof(d -> 'paths') = 'array' and jsonb_array_length(d -> 'paths') <= 50
      and not exists (
        select 1 from jsonb_array_elements(d -> 'paths') p
        where jsonb_typeof(p) <> 'object'
           or (p ->> 'id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           or jsonb_typeof(p -> 'visible') <> 'boolean')));
$$;

/** Adresses refusées (routes de l'app et termes ambigus). */
create or replace function public.center_slug_reserved(s text)
returns boolean language sql immutable set search_path = '' as $$
  select s = any (array['admin', 'api', 'app', 'auth', 'c', 'd', 'l', 'login', 'logout', 'signup', 'settings',
                        'preview', 'demo', 'demos', 'centre', 'center', 'formation', 'formations', 'aide', 'help',
                        'support', 'static', 'assets', 'www', 'tutoclick', 'flowdsiml', 'invite', 'legal']);
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.training_centers (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$' and not public.center_slug_reserved(slug)),
  draft jsonb not null default '{}'::jsonb check (public.center_draft_valid(draft)),
  published jsonb check (published is null or public.center_draft_valid(published)),
  published_at timestamptz,
  /** Première publication de chaque formation dans le centre ({pathId: date}) : badge « Nouveau ». */
  path_first_published jsonb not null default '{}'::jsonb,
  access_mode text not null default 'link' check (access_mode in ('link', 'password')),
  password_hash text,
  password_changed_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  check (access_mode <> 'password' or password_hash is not null)
);
alter table public.training_centers enable row level security;
revoke all on public.training_centers from anon, authenticated;
grant select (workspace_id, slug, draft, published, published_at, access_mode, password_changed_at, updated_at)
  on public.training_centers to authenticated;
drop policy if exists training_centers_read on public.training_centers;
create policy training_centers_read on public.training_centers for select to authenticated
  using (public.has_role(workspace_id, 'admin'));

create table if not exists public.center_access_attempts (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_key text not null check (char_length(client_key) between 16 and 128),
  failures int not null default 0,
  locked_until timestamptz,
  window_start timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, client_key)
);
alter table public.center_access_attempts enable row level security;
revoke all on public.center_access_attempts from anon, authenticated;

create table if not exists public.center_access_grants (
  token_hash text primary key check (char_length(token_hash) = 64),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);
create index if not exists center_access_grants_ws_idx on public.center_access_grants (workspace_id);
alter table public.center_access_grants enable row level security;
revoke all on public.center_access_grants from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Réglages (admin et plus)
-- ---------------------------------------------------------------------------
/** Adresse libre ? (format, mots réservés, pas déjà prise par un autre workspace). */
create or replace function public.center_slug_available(p_slug text, p_ws uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return coalesce(p_slug, '') ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'
     and not public.center_slug_reserved(p_slug)
     and not exists (select 1 from public.training_centers where slug = p_slug and workspace_id <> p_ws);
end $$;
revoke all on function public.center_slug_available(text, uuid) from public, anon;
grant execute on function public.center_slug_available(text, uuid) to authenticated;

/** Enregistre l'adresse et le brouillon (la page publique ne change qu'à la publication). */
create or replace function public.save_center_draft(p_ws uuid, p_slug text, p_draft jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if coalesce(p_slug, '') !~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$' or public.center_slug_reserved(p_slug) then
    raise exception 'SLUG_INVALID' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.training_centers where slug = p_slug and workspace_id <> p_ws) then
    raise exception 'SLUG_TAKEN' using errcode = 'P0001';
  end if;
  if not public.center_draft_valid(coalesce(p_draft, '{}'::jsonb)) then
    raise exception 'CENTER_INVALID' using errcode = 'P0001';
  end if;
  if (p_draft ->> 'logoPath') is not null and split_part(p_draft ->> 'logoPath', '/', 1) <> p_ws::text then
    raise exception 'CENTER_INVALID' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_draft -> 'paths', '[]'::jsonb)) p
    where not exists (select 1 from public.paths x where x.id = (p ->> 'id')::uuid and x.workspace_id = p_ws)
  ) then
    raise exception 'PATH_WORKSPACE' using errcode = 'P0001';
  end if;
  insert into public.training_centers (workspace_id, slug, draft, updated_by)
  values (p_ws, p_slug, coalesce(p_draft, '{}'::jsonb), (select auth.uid()))
  on conflict (workspace_id) do update
    set slug = excluded.slug, draft = excluded.draft, updated_at = now(), updated_by = excluded.updated_by;
end $$;
revoke all on function public.save_center_draft(uuid, text, jsonb) from public, anon;
grant execute on function public.save_center_draft(uuid, text, jsonb) to authenticated;

/** Formations visibles d'un réglage qui ont au moins un module publié et non supprimé. */
create or replace function public.center_visible_paths(p_ws uuid, p_conf jsonb)
returns table (path_id uuid, ord int) language sql stable security definer set search_path = '' as $$
  select (e.v ->> 'id')::uuid, e.ord::int
  from jsonb_array_elements(coalesce(p_conf -> 'paths', '[]'::jsonb)) with ordinality as e(v, ord)
  join public.paths p on p.id = (e.v ->> 'id')::uuid and p.workspace_id = p_ws
  where (e.v ->> 'visible')::boolean
    and exists (select 1 from public.path_modules m join public.demos d on d.id = m.demo_id
                where m.path_id = p.id and d.status = 'published' and d.deleted_at is null);
$$;
revoke all on function public.center_visible_paths(uuid, jsonb) from public, anon, authenticated;

create or replace function public.publish_center(p_ws uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  c public.training_centers;
  seen jsonb;
begin
  if not public.has_role(p_ws, 'admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into c from public.training_centers where workspace_id = p_ws for update;
  if not found then raise exception 'NO_VISIBLE_PATH' using errcode = 'P0001'; end if;
  if not (select public_links_enabled from public.workspaces where id = p_ws) then
    raise exception 'PUBLIC_DISABLED' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.center_visible_paths(p_ws, c.draft)) then
    raise exception 'NO_VISIBLE_PATH' using errcode = 'P0001';
  end if;
  seen := c.path_first_published || coalesce((
    select jsonb_object_agg(v.path_id::text, to_jsonb(now()))
    from public.center_visible_paths(p_ws, c.draft) v
    where not c.path_first_published ? v.path_id::text), '{}'::jsonb);
  update public.training_centers
     set published = c.draft, published_at = now(), path_first_published = seen,
         updated_at = now(), updated_by = (select auth.uid())
   where workspace_id = p_ws;
  return now();
end $$;
revoke all on function public.publish_center(uuid) from public, anon;
grant execute on function public.publish_center(uuid) to authenticated;

create or replace function public.unpublish_center(p_ws uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.training_centers set published = null, published_at = null, updated_at = now(),
         updated_by = (select auth.uid())
   where workspace_id = p_ws;
  delete from public.center_access_grants where workspace_id = p_ws;
end $$;
revoke all on function public.unpublish_center(uuid) from public, anon;
grant execute on function public.unpublish_center(uuid) to authenticated;

create or replace function public.set_center_access(p_ws uuid, p_mode text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_mode not in ('link', 'password') then raise exception 'NOT_AVAILABLE' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.training_centers where workspace_id = p_ws) then
    raise exception 'CENTER_MISSING' using errcode = 'P0001';
  end if;
  if p_mode = 'password' and not exists (
    select 1 from public.training_centers where workspace_id = p_ws and password_hash is not null) then
    raise exception 'PASSWORD_REQUIRED' using errcode = 'P0001';
  end if;
  update public.training_centers set access_mode = p_mode, updated_at = now(), updated_by = (select auth.uid())
   where workspace_id = p_ws;
end $$;
revoke all on function public.set_center_access(uuid, text) from public, anon;
grant execute on function public.set_center_access(uuid, text) to authenticated;

/** Nouveau mot de passe (8 à 200 caractères) : mode mot de passe, accès déjà donnés révoqués. */
create or replace function public.set_center_password(p_ws uuid, p_password text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_password is null or char_length(p_password) < 8 or char_length(p_password) > 200 then
    raise exception 'PASSWORD_LENGTH' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.training_centers where workspace_id = p_ws) then
    raise exception 'CENTER_MISSING' using errcode = 'P0001';
  end if;
  update public.training_centers
     set access_mode = 'password', password_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
         password_changed_at = now(), updated_at = now(), updated_by = (select auth.uid())
   where workspace_id = p_ws;
  delete from public.center_access_grants where workspace_id = p_ws;
  delete from public.center_access_attempts where workspace_id = p_ws;
end $$;
revoke all on function public.set_center_password(uuid, text) from public, anon;
grant execute on function public.set_center_password(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Contenu public (interne : appelé par center_open)
-- ---------------------------------------------------------------------------
create or replace function public.center_payload(p_ws uuid, p_link_token text, p_visitor text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.training_centers;
  v_link public.share_links;
  l public.learners;
  v_first text;
  v_learner uuid;
begin
  select * into c from public.training_centers where workspace_id = p_ws;
  -- Visiteur identifié : lien personnel actif, non expiré, sur une démo publiée du workspace
  if p_link_token is not null and char_length(p_link_token) between 8 and 128 then
    select sl.* into v_link from public.share_links sl join public.demos d on d.id = sl.demo_id
     where sl.token = p_link_token and sl.workspace_id = p_ws and sl.is_active
       and (sl.expires_at is null or sl.expires_at > now())
       and d.status = 'published' and d.deleted_at is null;
    if found then
      select * into l from public.learners where share_link_id = v_link.id;
      if found then
        v_learner := l.id;
        v_first := coalesce(nullif(btrim(v_link.variables ->> 'first_name'), ''), split_part(btrim(l.full_name), ' ', 1));
        -- Les modules ouverts depuis le centre comptent pour cet apprenant (le lien prime sur un formulaire)
        if p_visitor is not null and char_length(p_visitor) between 8 and 64 then
          perform public.learner_attach_visitor(p_ws, p_visitor, l.id, true);
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'center', jsonb_build_object(
      'title', coalesce(c.published ->> 'title', ''),
      'intro', coalesce(c.published ->> 'intro', ''),
      'brand', c.published ->> 'brand', 'accent', c.published ->> 'accent',
      'style', coalesce(c.published ->> 'style', 'workspace'),
      'logoPath', c.published ->> 'logoPath',
      'help', coalesce(c.published ->> 'help', ''),
      'a11y', coalesce(c.published ->> 'a11y', 'non_evalue'),
      'a11yUrl', coalesce(c.published ->> 'a11yUrl', ''),
      'privacyUrl', coalesce(c.published ->> 'privacyUrl', ''),
      'indexable', coalesce((c.published ->> 'indexable')::boolean, false),
      'workspace', (select name from public.workspaces where id = p_ws)),
    'visitor', case when v_learner is not null then jsonb_build_object('firstName', left(coalesce(v_first, ''), 60)) end,
    'paths', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title, 'description', p.description, 'ordered', p.ordered,
        'isNew', coalesce((c.path_first_published ->> p.id::text)::timestamptz > now() - interval '30 days', false),
        'tags', (select coalesce(jsonb_agg(distinct jsonb_build_object('name', t.name, 'color', t.color)), '[]'::jsonb)
                 from public.path_modules m join public.demos d on d.id = m.demo_id
                 join public.demo_tags dt on dt.demo_id = d.id join public.tags t on t.id = dt.tag_id
                 where m.path_id = p.id and d.status = 'published' and d.deleted_at is null),
        'modules', (select coalesce(jsonb_agg(jsonb_build_object(
            'demoId', d.id, 'title', d.title, 'required', m.required,
            'steps', coalesce(jsonb_array_length(v.manifest -> 'steps'), 0),
            'hasQuiz', jsonb_typeof(v.manifest -> 'quiz') = 'object' and v.manifest -> 'quiz' ->> 'mode' is distinct from 'survey',
            'access', case when a.expires_at is not null and a.expires_at <= now() then 'expired'
                           when a.mode = 'password' then 'password'
                           when a.mode in ('invite', 'domain') then 'password'
                           else 'open' end,
            -- Couverture : capture de l'étape 1, seulement pour un module ouvert (signée par open-center)
            'cover', case when (a.demo_id is null or (a.mode = 'link' and (a.expires_at is null or a.expires_at > now())))
                               and (v.manifest -> 'steps' -> 0 -> 'image' ->> 'url') ~ '^assets/[\w.-]+$'
                          then v.manifest -> 'steps' -> 0 -> 'image' ->> 'url' end,
            -- Date d'expiration L11 (« plus disponible depuis le … ») et meilleur score de l'apprenant
            'expiredAt', case when a.expires_at is not null and a.expires_at <= now() then a.expires_at end,
            'best', case when lm.has_quiz then lm.best_score end,
            'status', lm.status, 'seen', lm.steps_seen, 'total', lm.total_steps
          ) order by m.position), '[]'::jsonb)
          from public.path_modules m
          join public.demos d on d.id = m.demo_id and d.status = 'published' and d.deleted_at is null
          left join public.demo_versions v on v.id = d.current_version_id
          left join public.demo_access a on a.demo_id = d.id
          left join public.learner_modules(p_ws) lm on v_learner is not null and lm.learner_id = v_learner and lm.demo_id = d.id
          where m.path_id = p.id)
      ) order by vp.ord), '[]'::jsonb)
      from public.center_visible_paths(p_ws, c.published) vp
      join public.paths p on p.id = vp.path_id)
  );
end $$;
revoke all on function public.center_payload(uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ouverture du centre (Edge Function open-center, service_role)
-- Statuts : ok | not_found | password_required | password_wrong | locked.
-- ---------------------------------------------------------------------------
create or replace function public.center_open(
  p_slug text, p_password text default null, p_grant text default null, p_client text default null,
  p_link_token text default null, p_visitor text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.training_centers;
  v_name text;
  v_public boolean := false;
  att public.center_access_attempts;
  glob public.center_access_attempts;
  global_key constant text := 'global:center-limit';
  info jsonb;
  tok text;
begin
  select * into c from public.training_centers where slug = p_slug;
  if found then
    select name, public_links_enabled into v_name, v_public from public.workspaces where id = c.workspace_id;
  end if;
  -- Inconnu, non publié ou liens publics interdits : même réponse
  if c.workspace_id is null or c.published is null or not coalesce(v_public, false) then
    return jsonb_build_object('status', 'not_found');
  end if;
  info := jsonb_build_object('title', coalesce(nullif(c.published ->> 'title', ''), v_name), 'workspace', v_name);
  if c.access_mode = 'link' then
    return info || jsonb_build_object('status', 'ok') || public.center_payload(c.workspace_id, p_link_token, p_visitor);
  end if;

  if p_grant is not null and exists (
    select 1 from public.center_access_grants g
     where g.token_hash = encode(extensions.digest(p_grant, 'sha256'), 'hex')
       and g.workspace_id = c.workspace_id and g.expires_at > now()
  ) then
    return info || jsonb_build_object('status', 'ok') || public.center_payload(c.workspace_id, p_link_token, p_visitor);
  end if;
  if p_password is null or p_password = '' then
    return info || jsonb_build_object('status', 'password_required');
  end if;
  if p_client is null or char_length(p_client) < 16 then
    raise exception 'CLIENT_REQUIRED' using errcode = 'P0001';
  end if;

  select * into glob from public.center_access_attempts where workspace_id = c.workspace_id and client_key = global_key;
  if found and glob.locked_until is not null and glob.locked_until > now() then
    return info || jsonb_build_object('status', 'locked', 'retryIn', ceil(extract(epoch from glob.locked_until - now()))::int);
  end if;
  select * into att from public.center_access_attempts where workspace_id = c.workspace_id and client_key = p_client;
  if found and att.locked_until is not null and att.locked_until > now() then
    return info || jsonb_build_object('status', 'locked', 'retryIn', ceil(extract(epoch from att.locked_until - now()))::int);
  end if;

  if extensions.crypt(p_password, c.password_hash) = c.password_hash then
    delete from public.center_access_attempts where workspace_id = c.workspace_id and client_key = p_client;
    delete from public.center_access_grants where workspace_id = c.workspace_id and expires_at <= now();
    tok := encode(extensions.gen_random_bytes(24), 'hex');
    insert into public.center_access_grants (token_hash, workspace_id)
      values (encode(extensions.digest(tok, 'sha256'), 'hex'), c.workspace_id);
    return info || jsonb_build_object('status', 'ok', 'grant', tok)
           || public.center_payload(c.workspace_id, p_link_token, p_visitor);
  end if;

  insert into public.center_access_attempts as t (workspace_id, client_key, failures, locked_until, window_start)
  values (c.workspace_id, global_key, 1, null, now())
  on conflict (workspace_id, client_key) do update
    set failures = case when t.window_start < now() - interval '1 hour' or t.locked_until is not null
                        then 1 else t.failures + 1 end,
        window_start = case when t.window_start < now() - interval '1 hour' or t.locked_until is not null
                            then now() else t.window_start end,
        locked_until = null, updated_at = now()
  returning * into glob;
  if glob.failures >= 50 then
    update public.center_access_attempts
       set failures = 0, locked_until = now() + interval '15 minutes', window_start = now(), updated_at = now()
     where workspace_id = c.workspace_id and client_key = global_key;
    return info || jsonb_build_object('status', 'locked', 'retryIn', 900);
  end if;

  insert into public.center_access_attempts as t (workspace_id, client_key, failures, locked_until)
  values (c.workspace_id, p_client, 1, null)
  on conflict (workspace_id, client_key) do update
    set failures = case when t.locked_until is not null then 1 else t.failures + 1 end,
        locked_until = null, updated_at = now()
  returning * into att;
  if att.failures >= 5 then
    update public.center_access_attempts
       set failures = 0, locked_until = now() + interval '1 minute', updated_at = now()
     where workspace_id = c.workspace_id and client_key = p_client;
    return info || jsonb_build_object('status', 'locked', 'retryIn', 60);
  end if;
  return info || jsonb_build_object('status', 'password_wrong', 'remaining', 5 - att.failures);
end $$;
revoke all on function public.center_open(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.center_open(text, text, text, text, text, text) to service_role;

-- Purge : essais de plus de 24 h et jetons expirés (pg_cron, toutes les heures)
create or replace function public.purge_center_access()
returns void language sql security definer set search_path = '' as $$
  delete from public.center_access_attempts where updated_at < now() - interval '24 hours';
  delete from public.center_access_grants where expires_at <= now();
$$;
revoke all on function public.purge_center_access() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('fd_purge_center_access', '23 * * * *', 'select public.purge_center_access()');
  else
    raise notice 'pg_cron indisponible : purge des accès au centre non planifiée';
  end if;
end $$;
