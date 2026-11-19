-- L17 (F1 formation) : étape Avant / Après et glossaire du workspace. Schéma validé par le chef
-- d'équipe, avec ses trois conditions : chemin de la capture « Avant » contrôlé comme image_path et ses
-- flous traités comme blurs (rendu et bilan RGPD) ; import plafonné avant tout traitement ; réglage de
-- soulignement écrit par jsonb_set sur la seule clé settings.glossary.underline.

-- ===== 1. Étape Avant / Après =====
alter table public.steps add column if not exists before_image_path text;
alter table public.steps add column if not exists before_image_width int;
alter table public.steps add column if not exists before_image_height int;
alter table public.steps add column if not exists before_blurs jsonb not null default '[]'::jsonb;

do $$ begin
  -- Chemin d'une capture : toujours sous le dossier du workspace de l'étape (même règle que le
  -- stockage, policies captures_*). Ajoutée NOT VALID pour image_path : vérifiée à chaque écriture,
  -- sans relire l'existant ; valide d'emblée pour la colonne nouvelle.
  if not exists (select 1 from pg_constraint where conname = 'steps_image_path_ws') then
    alter table public.steps add constraint steps_image_path_ws
      check (image_path is null or public.path_uuid(image_path, 1) = workspace_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'steps_before_image_path_ws') then
    alter table public.steps add constraint steps_before_image_path_ws
      check (before_image_path is null or public.path_uuid(before_image_path, 1) = workspace_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'steps_before_dims') then
    alter table public.steps add constraint steps_before_dims check (
      (before_image_width is null or before_image_width between 1 and 20000)
      and (before_image_height is null or before_image_height between 1 and 20000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'steps_before_blurs_array') then
    alter table public.steps add constraint steps_before_blurs_array check (
      jsonb_typeof(before_blurs) = 'array' and jsonb_array_length(before_blurs) <= 100);
  end if;
  -- Réglages de l'étape (options.beforeAfter) : forme et longueurs
  if not exists (select 1 from pg_constraint where conname = 'steps_before_after_shape') then
    alter table public.steps add constraint steps_before_after_shape check (
      not options ? 'beforeAfter' or (
        jsonb_typeof(options -> 'beforeAfter') = 'object'
        and coalesce(options #>> '{beforeAfter,layout}', 'side') in ('side', 'slider', 'toggle')
        and char_length(coalesce(options #>> '{beforeAfter,labels,before}', '')) <= 20
        and char_length(coalesce(options #>> '{beforeAfter,labels,after}', '')) <= 20
        and char_length(coalesce(options #>> '{beforeAfter,notes,before}', '')) <= 140
        and char_length(coalesce(options #>> '{beforeAfter,notes,after}', '')) <= 140
        and pg_column_size(options -> 'beforeAfter') <= 4096));
  end if;
end $$;

-- ===== 2. Glossaire =====
-- Repli d'un terme : minuscules, sans accents, espaces simples (unicité et repérage)
create or replace function public.glossary_fold(p text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select btrim(regexp_replace(lower(translate(coalesce(p, ''),
    'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñÝýÿ',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy')), '\s+', ' ', 'g'))
$$;

create or replace function public.glossary_forms_ok(p text[])
returns boolean language sql immutable parallel safe set search_path = '' as $$
  select cardinality(p) <= 10 and coalesce((select bool_and(char_length(btrim(f)) between 1 and 60) from unnest(p) f), true)
$$;

create table if not exists public.glossary_terms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  term text not null check (char_length(btrim(term)) between 1 and 60),
  old_term text check (old_term is null or char_length(old_term) <= 60),
  definition text not null check (char_length(btrim(definition)) between 1 and 140),
  forms text[] not null default '{}' check (public.glossary_forms_ok(forms)),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists glossary_terms_term_uq on public.glossary_terms (workspace_id, public.glossary_fold(term));

drop trigger if exists set_updated_at on public.glossary_terms;
create trigger set_updated_at before update on public.glossary_terms
  for each row execute function public.set_updated_at();

-- 500 termes au plus par workspace (verrou sur le workspace : pas de dépassement concurrent)
create or replace function public.glossary_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.workspaces where id = new.workspace_id for update;
  if (select count(*) from public.glossary_terms where workspace_id = new.workspace_id) >= 500 then
    raise exception 'GLOSSARY_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists glossary_limit on public.glossary_terms;
create trigger glossary_limit before insert on public.glossary_terms
  for each row execute function public.glossary_limit();

alter table public.glossary_terms enable row level security;
drop policy if exists glossary_select on public.glossary_terms;
create policy glossary_select on public.glossary_terms for select to authenticated
  using (public.has_role(workspace_id, 'viewer'));
drop policy if exists glossary_insert on public.glossary_terms;
create policy glossary_insert on public.glossary_terms for insert to authenticated
  with check (public.has_role(workspace_id, 'editor'));
drop policy if exists glossary_update on public.glossary_terms;
create policy glossary_update on public.glossary_terms for update to authenticated
  using (public.has_role(workspace_id, 'editor')) with check (public.has_role(workspace_id, 'editor'));
drop policy if exists glossary_delete on public.glossary_terms;
create policy glossary_delete on public.glossary_terms for delete to authenticated
  using (public.has_role(workspace_id, 'editor'));
revoke all on public.glossary_terms from anon;
grant select, insert, update, delete on public.glossary_terms to authenticated;

-- Texte d'une démo (titres, corps, bulles, notes Avant / Après), replié pour le repérage
create or replace function public.demo_text(p_demo uuid)
returns text language sql stable security definer set search_path = '' as $$
  select ' ' || public.glossary_fold(concat_ws(' ',
    (select string_agg(concat_ws(' ', s.title, s.body, s.options #>> '{beforeAfter,notes,before}',
                                 s.options #>> '{beforeAfter,notes,after}'), ' ')
       from public.steps s where s.demo_id = p_demo),
    (select string_agg(concat_ws(' ', h.title, h.body), ' ') from public.hotspots h where h.demo_id = p_demo))) || ' '
$$;
revoke all on function public.demo_text(uuid) from public, anon, authenticated;

-- Un terme (ou une de ses formes) apparaît-il dans un texte replié ? Mot entier, pluriel simple
-- (s ou x), comme le repérage du lecteur.
create or replace function public.glossary_in_text(p_text text, p_term text, p_forms text[])
returns boolean language sql immutable parallel safe set search_path = '' as $$
  select exists (
    select 1 from unnest(array_prepend(p_term, coalesce(p_forms, '{}'))) f
    where public.glossary_fold(f) <> ''
      and p_text ~ ('\m' || regexp_replace(public.glossary_fold(f), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '[sx]?\M'))
$$;

-- Colonne « Modules » : nombre de démos publiées (non supprimées) qui contiennent le terme
create or replace function public.glossary_usage(p_ws uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return coalesce((
    with dm as (
      select public.demo_text(d.id) as txt from public.demos d
      where d.workspace_id = p_ws and d.deleted_at is null and d.status = 'published'
    )
    select jsonb_agg(jsonb_build_object('id', g.id,
             'modules', (select count(*) from dm where public.glossary_in_text(dm.txt, g.term, g.forms))))
    from public.glossary_terms g where g.workspace_id = p_ws), '[]'::jsonb);
end $$;
revoke all on function public.glossary_usage(uuid) from public, anon;
grant execute on function public.glossary_usage(uuid) to authenticated;

-- Import CSV : une transaction, upsert sur le terme replié (jamais de doublon). Entrée plafonnée
-- avant tout traitement : 500 lignes et 256 Ko au plus.
create or replace function public.glossary_import(p_ws uuid, p_rows jsonb, p_replace boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  i int := 0;
  v_term text;
  v_def text;
  v_old text;
  v_forms text[];
  v_new boolean;
  added int := 0;
  updated int := 0;
  errors jsonb := '[]'::jsonb;
  seen text[] := '{}';
begin
  if not public.has_role(p_ws, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'GLOSSARY_IMPORT_INVALID' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_rows) > 500 or octet_length(p_rows::text) > 262144 then
    raise exception 'GLOSSARY_IMPORT_TOO_BIG' using errcode = 'P0001';
  end if;

  perform 1 from public.workspaces where id = p_ws for update;
  if p_replace then delete from public.glossary_terms where workspace_id = p_ws; end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    i := i + 1;
    v_term := btrim(coalesce(r ->> 'term', ''));
    v_def := btrim(coalesce(r ->> 'definition', ''));
    v_old := nullif(btrim(coalesce(r ->> 'old_term', '')), '');
    if jsonb_typeof(r) <> 'object' or v_term = '' or char_length(v_term) > 60 then
      errors := errors || jsonb_build_object('line', i, 'code', 'term'); continue;
    end if;
    if v_def = '' or char_length(v_def) > 140 then
      errors := errors || jsonb_build_object('line', i, 'code', 'definition'); continue;
    end if;
    if public.glossary_fold(v_term) = any (seen) then
      errors := errors || jsonb_build_object('line', i, 'code', 'duplicate'); continue;
    end if;
    seen := seen || public.glossary_fold(v_term);
    select coalesce(array_agg(left(btrim(f), 60)) filter (where btrim(f) <> ''), '{}')
      into v_forms
      from (select jsonb_array_elements_text(case when jsonb_typeof(r -> 'forms') = 'array' then r -> 'forms' else '[]' end) f limit 10) x;
    v_old := left(v_old, 60);
    v_new := not exists (select 1 from public.glossary_terms
                         where workspace_id = p_ws and public.glossary_fold(term) = public.glossary_fold(v_term));
    if v_new and (select count(*) from public.glossary_terms where workspace_id = p_ws) >= 500 then
      errors := errors || jsonb_build_object('line', i, 'code', 'limit'); continue;
    end if;
    insert into public.glossary_terms (workspace_id, term, old_term, definition, forms)
      values (p_ws, v_term, v_old, v_def, v_forms)
      on conflict (workspace_id, public.glossary_fold(term)) do update
        set term = excluded.term, old_term = excluded.old_term, definition = excluded.definition, forms = excluded.forms;
    if v_new then added := added + 1; else updated := updated + 1; end if;
  end loop;
  return jsonb_build_object('added', added, 'updated', updated, 'skipped', jsonb_array_length(errors), 'errors', errors);
end $$;
revoke all on function public.glossary_import(uuid, jsonb, boolean) from public, anon;
grant execute on function public.glossary_import(uuid, jsonb, boolean) to authenticated;

-- Réglage « Souligner les termes dans le lecteur » : seule la clé settings.glossary.underline change
create or replace function public.glossary_set_underline(p_ws uuid, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  update public.workspaces
    set settings = jsonb_set(
      case when jsonb_typeof(settings -> 'glossary') = 'object' then settings
           else jsonb_set(settings, '{glossary}', '{}'::jsonb) end,
      '{glossary,underline}', to_jsonb(coalesce(p_on, true)))
    where id = p_ws;
end $$;
revoke all on function public.glossary_set_underline(uuid, boolean) from public, anon;
grant execute on function public.glossary_set_underline(uuid, boolean) to authenticated;

-- ===== 3. Publication : capture « Avant », flous, glossaire =====
-- publish_demo redéfinie à l'identique de 20261117131500_manifest_workspace.sql, avec : blocage
-- BEFORE_AFTER_INCOMPLETE, step.beforeAfter (sans les noms de fichiers importés), copie de la capture
-- « Avant », before_blurs dans le bilan RGPD, et glossary.
create or replace function public.publish_demo(p_demo uuid, p_ack jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d public.demos;
  ws public.workspaces;
  lim jsonb;
  n_published bigint;
  v_number int;
  v_id uuid := gen_random_uuid();
  v_theme jsonb;
  v_steps jsonb;
  v_copies jsonb;
  v_forms jsonb;
  v_manifest jsonb;
  lead_forms boolean;
  v_ack jsonb;
  v_quiz jsonb;
  v_bad int;
  v_ba int;
  v_glossary jsonb;
begin
  select * into d from public.demos where id = p_demo and deleted_at is null;
  if d.id is null then raise exception 'DEMO_NOT_FOUND'; end if;
  if not public.has_role(d.workspace_id, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  select * into ws from public.workspaces where id = d.workspace_id;
  select limits into lim from public.plans where code = ws.plan_code;

  if d.status <> 'published' then
    select count(*) into n_published from public.demos
      where workspace_id = d.workspace_id and status = 'published' and deleted_at is null;
    if public.limit_reached(d.workspace_id, 'published_demos', n_published) then
      raise exception 'PLAN_LIMIT:published_demos' using errcode = 'P0001';
    end if;
  end if;

  if not exists (select 1 from public.steps where demo_id = p_demo) then
    raise exception 'DEMO_EMPTY';
  end if;

  -- L17 : une étape Avant / Après n'est publiable qu'avec ses deux captures
  select min(n) into v_ba from (
    select row_number() over (order by s.position, s.created_at) as n, s.*
    from public.steps s where s.demo_id = p_demo
  ) x
  where x.kind::text = 'before_after' and (x.image_path is null or x.before_image_path is null);
  if v_ba is not null then
    raise exception 'BEFORE_AFTER_INCOMPLETE:%', v_ba using errcode = 'P0001';
  end if;

  -- F2 : quiz du module (après la dernière étape). Publication bloquée tant qu'une question est invalide.
  select min(n) into v_bad from (
    select row_number() over (order by q.position, q.created_at) as n, q.*
    from public.quiz_questions q where q.demo_id = p_demo
  ) x
  where btrim(x.prompt) = '' or jsonb_array_length(x.answers) < 2
     or exists (select 1 from jsonb_array_elements(x.answers) a where btrim(coalesce(a ->> 'label', '')) = '')
     or (coalesce(d.settings -> 'quiz' ->> 'mode', 'quiz') = 'quiz'
         and not exists (select 1 from jsonb_array_elements(x.answers) a where coalesce((a ->> 'correct')::boolean, false)));
  if v_bad is not null then
    raise exception 'QUIZ_INVALID:%', v_bad using errcode = 'P0001';
  end if;
  select case when count(*) = 0 then null else jsonb_build_object(
      'mode', case when d.settings -> 'quiz' ->> 'mode' = 'survey' then 'survey' else 'quiz' end,
      'threshold', least(greatest(coalesce((d.settings -> 'quiz' ->> 'threshold')::int, 70), 0), 100),
      'attempts', least(greatest(coalesce((d.settings -> 'quiz' ->> 'attempts')::int, 3), 0), 5),
      'feedback', case when d.settings -> 'quiz' ->> 'feedback' = 'end' then 'end' else 'each' end,
      'shuffle', coalesce((d.settings -> 'quiz' ->> 'shuffle')::boolean, true),
      'required', coalesce((d.settings -> 'quiz' ->> 'required')::boolean, true),
      'questions', jsonb_agg(jsonb_build_object(
        'id', q.id::text, 'type', q.type, 'prompt', q.prompt, 'answers', q.answers,
        'explanation', q.explanation, 'stepId', q.step_id::text, 'points', q.points
      ) order by q.position, q.created_at)) end
  into v_quiz from public.quiz_questions q where q.demo_id = p_demo;

  -- F1 : liens publics désactivables par workspace (désactivés par défaut pour les nouveaux).
  -- Toute publication est publique tant que les modes restreints (F3) n'existent pas.
  if not ws.public_links_enabled then
    raise exception 'PUBLIC_DISABLED' using errcode = 'P0001';
  end if;
  -- F1 : avertissement RGPD confirmé à chaque publication publique (deux cases), journalisé
  if p_ack is null or not coalesce((p_ack ->> 'reviewed')::boolean, false)
     or not coalesce((p_ack ->> 'fictional')::boolean, false) then
    raise exception 'GDPR_ACK_REQUIRED' using errcode = 'P0001';
  end if;
  -- Bilan calculé côté serveur (zones floutées, détections laissées non floutées par étape)
  with st as (
    select row_number() over (order by s.position, s.created_at) as n, s.blurs, s.before_blurs, s.element_meta -> 'pii' as pii
    from public.steps s where s.demo_id = p_demo
  )
  select jsonb_build_object(
    'by', (select auth.uid()),
    'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'reviewed', true,
    'fictional', true,
    'blurred', coalesce(sum(
      case when jsonb_typeof(st.blurs) = 'array' then jsonb_array_length(st.blurs) else 0 end
      -- L17 : zones floutées de la capture « Avant », comptées comme celles de l'étape
      + case when jsonb_typeof(st.before_blurs) = 'array' then jsonb_array_length(st.before_blurs) else 0 end
      + case when jsonb_typeof(st.pii) = 'array'
          then (select count(*) from jsonb_array_elements(st.pii) p where coalesce((p ->> 'blurred')::boolean, false))
          else 0 end), 0),
    'pendingSteps', coalesce(jsonb_agg(st.n order by st.n) filter (where jsonb_typeof(st.pii) = 'array'
      and exists (select 1 from jsonb_array_elements(st.pii) p where not coalesce((p ->> 'blurred')::boolean, false))), '[]'::jsonb))
  into v_ack from st;

  lead_forms := coalesce((lim ->> 'lead_forms')::boolean, false);

  select coalesce(max(number), 0) + 1 into v_number from public.demo_versions where demo_id = p_demo;

  -- Thème : thème choisi (ou défaut du workspace) + surcharges de la démo
  select coalesce(t.tokens, '{}'::jsonb) into v_theme from public.themes t
    where t.id = coalesce(d.theme_id, (select id from public.themes where workspace_id = d.workspace_id and is_default limit 1));
  v_theme := coalesce(v_theme, '{}'::jsonb) || coalesce(d.settings -> 'theme', '{}'::jsonb);
  v_theme := v_theme || jsonb_build_object(
    'showBranding', not coalesce((lim ->> 'remove_branding')::boolean, false) or coalesce((v_theme ->> 'showBranding')::boolean, true)
  );

  with s as (
    select st.*, row_number() over (order by st.position, st.created_at) - 1 as idx,
      case when st.image_path is not null
        then 'assets/' || st.id || '-' || md5(st.image_path) || '.webp' end as pub_path,
      case when st.kind::text = 'before_after' and st.before_image_path is not null
        then 'assets/' || st.id || '-b-' || md5(st.before_image_path) || '.webp' end as before_pub_path
    from public.steps st where st.demo_id = p_demo
  )
  select
    jsonb_agg(jsonb_build_object(
      'id', s.id::text,
      'chapterId', s.chapter_id::text,
      'kind', s.kind,
      'image', case when s.pub_path is not null then jsonb_build_object(
        'url', s.pub_path, 'width', coalesce(s.image_width, 1280), 'height', coalesce(s.image_height, 800)) end,
      'snapshotUrl', null,
      'title', s.title,
      'body', s.body,
      'blurs', s.blurs,
      -- L17 : capture « Avant » et ses zones floutées (traitées comme blurs : incrustées à la publication)
      'beforeAfter', case when s.before_pub_path is not null then jsonb_build_object(
        'layout', coalesce(s.options #>> '{beforeAfter,layout}', 'side'),
        'labels', jsonb_build_object(
          'before', left(coalesce(s.options #>> '{beforeAfter,labels,before}', ''), 20),
          'after', left(coalesce(s.options #>> '{beforeAfter,labels,after}', ''), 20)),
        'notes', jsonb_build_object(
          'before', left(coalesce(s.options #>> '{beforeAfter,notes,before}', ''), 140),
          'after', left(coalesce(s.options #>> '{beforeAfter,notes,after}', ''), 140)),
        'before', jsonb_build_object('url', s.before_pub_path,
          'width', coalesce(s.before_image_width, 1280), 'height', coalesce(s.before_image_height, 800)),
        'beforeBlurs', s.before_blurs) end,
      'zoom', s.zoom,
      'cta', s.cta,
      'options', s.options - 'beforeAfter',
      'gateFormId', case when lead_forms then s.gate_form_id::text end,
      'hotspots', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', h.id::text, 'x', h.x, 'y', h.y, 'w', h.w, 'h', h.h,
          'title', h.title, 'body', h.body, 'placement', h.placement,
          'action', h.action, 'cta', h.cta, 'pulse', h.pulse,
          -- mode Spotlight réglé pour toute la démo : il s'impose à chaque hotspot
          'style', case when d.settings ->> 'mode' = 'spotlight' then 'spotlight' else h.style end
        ) order by h.position, h.created_at)
        from public.hotspots h where h.step_id = s.id), '[]'::jsonb)
    ) order by s.idx),
    coalesce(jsonb_agg(jsonb_build_object('from', s.image_path, 'to', p_demo::text || '/' || s.pub_path))
      filter (where s.pub_path is not null), '[]'::jsonb)
    || coalesce(jsonb_agg(jsonb_build_object('from', s.before_image_path, 'to', p_demo::text || '/' || s.before_pub_path))
      filter (where s.before_pub_path is not null), '[]'::jsonb)
  into v_steps, v_copies
  from s;

  if lead_forms then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id::text, 'title', f.title, 'description', f.description, 'submitLabel', f.submit_label,
      'fields', f.fields, 'consentText', f.consent_text, 'skippable', f.skippable)), '[]'::jsonb)
    into v_forms from public.forms f where f.demo_id = p_demo;
  else
    v_forms := '[]'::jsonb;
  end if;

  -- L17 : glossaire (termes présents dans la démo), null si le soulignement est désactivé
  if coalesce((ws.settings #>> '{glossary,underline}')::boolean, true)
     and coalesce((d.settings ->> 'glossary')::boolean, true) then
    select coalesce(jsonb_agg(jsonb_build_object(
        'term', g.term, 'oldTerm', g.old_term, 'definition', g.definition, 'forms', to_jsonb(g.forms))
        order by g.term), '[]'::jsonb)
      into v_glossary
    from public.glossary_terms g
    where g.workspace_id = d.workspace_id
      and public.glossary_in_text(public.demo_text(p_demo), g.term, g.forms);
  end if;

  v_manifest := jsonb_build_object(
    'schemaVersion', 1,
    'demoId', p_demo::text,
    'versionId', v_id::text,
    'workspaceId', d.workspace_id::text,
    -- PLY-01 : nom du workspace (en-tête du lecteur, « Données traitées par … »)
    'workspaceName', left(coalesce(ws.name, ''), 120),
    'title', d.title,
    'locale', coalesce(d.settings ->> 'locale', 'fr'),
    'publishedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'theme', v_theme,
    'variables', coalesce((select jsonb_agg(jsonb_build_object('key', v.key, 'label', v.label, 'default', v.default_value))
                           from public.variables v where v.workspace_id = d.workspace_id), '[]'::jsonb),
    'chapters', coalesce((select jsonb_agg(jsonb_build_object('id', c.id::text, 'title', c.title) order by c.position)
                          from public.chapters c where c.demo_id = p_demo), '[]'::jsonb),
    'steps', v_steps,
    'forms', v_forms,
    'allowedEmbedOrigins', coalesce(d.settings -> 'allowedEmbedOrigins', '[]'::jsonb),
    -- P6 : bouton d'action du client affiché en permanence dans le player (ex. « Réserver une démo »)
    'cta', case when jsonb_typeof(d.settings -> 'cta') = 'object' and d.settings -> 'cta' ? 'url' then d.settings -> 'cta' end,
    -- P13 : lien « Confidentialité » du workspace sous les formulaires de lead (https uniquement)
    'privacyUrl', case when (ws.settings ->> 'privacyUrl') ~ '^https://[^\s]+$' then ws.settings ->> 'privacyUrl' end,
    -- F1 : checklist de progression et lecture automatique (réglages de la démo)
    'checklist', case when jsonb_typeof(d.settings -> 'checklist') = 'object'
                       and coalesce((d.settings -> 'checklist' ->> 'enabled')::boolean, false)
                  then jsonb_build_object(
                    'title', left(coalesce(d.settings -> 'checklist' ->> 'title', ''), 80),
                    'position', case when d.settings -> 'checklist' ->> 'position' in ('left', 'right', 'collapsed')
                                     then d.settings -> 'checklist' ->> 'position' else 'right' end)
                  end,
    'autoplay', case when jsonb_typeof(d.settings -> 'autoplay') = 'object'
                      and coalesce((d.settings -> 'autoplay' ->> 'enabled')::boolean, false)
                 then jsonb_build_object('enabled', true,
                        'delayMs', least(greatest(coalesce((d.settings -> 'autoplay' ->> 'delayMs')::int, 4000), 1500), 30000))
                 end,
    -- F2 : quiz de validation (ou sondage) après la dernière étape
    'quiz', v_quiz,
    'glossary', v_glossary,
    'trackUrl', null
  );

  insert into public.demo_versions (id, demo_id, workspace_id, number, manifest, published_by, public_ack)
  values (v_id, p_demo, d.workspace_id, v_number, v_manifest, (select auth.uid()), v_ack);

  return jsonb_build_object('versionId', v_id, 'number', v_number, 'manifest', v_manifest, 'copies', v_copies);
end $$;

revoke all on function public.publish_demo(uuid, jsonb) from public, anon;
grant execute on function public.publish_demo(uuid, jsonb) to authenticated;

-- ===== 4. Copie d'une démo : colonnes before_* =====
-- duplicate_demo redéfinie à l'identique de 20261117131200_quiz.sql, avec les colonnes before_* et la
-- source « étape » d'un Avant / Après remappée vers la nouvelle étape.
create or replace function public.duplicate_demo(p_demo uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  d public.demos;
  v_new uuid := gen_random_uuid();
begin
  select * into d from public.demos where id = p_demo and deleted_at is null;
  if d.id is null or not public.has_role(d.workspace_id, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;

  insert into public.demos (id, workspace_id, folder_id, title, theme_id, settings, cover_path, created_by)
  values (v_new, d.workspace_id, d.folder_id, left(d.title || ' (copie)', 160), d.theme_id, d.settings, d.cover_path, (select auth.uid()));

  drop table if exists pg_temp._map;
  create temp table _map (old_id uuid primary key, new_id uuid not null) on commit drop;

  insert into _map select id, gen_random_uuid() from public.chapters where demo_id = p_demo;
  insert into public.chapters (id, demo_id, workspace_id, title, position)
    select m.new_id, v_new, d.workspace_id, c.title, c.position from public.chapters c join _map m on m.old_id = c.id;

  insert into _map select id, gen_random_uuid() from public.forms where demo_id = p_demo;
  insert into public.forms (id, workspace_id, demo_id, title, description, submit_label, fields, consent_text, skippable)
    select m.new_id, f.workspace_id, v_new, f.title, f.description, f.submit_label, f.fields, f.consent_text, f.skippable
    from public.forms f join _map m on m.old_id = f.id;

  insert into _map select id, gen_random_uuid() from public.steps where demo_id = p_demo;
  insert into public.steps (id, demo_id, workspace_id, position, chapter_id, kind, image_path, image_width, image_height,
                            snapshot_path, title, body, zoom, blurs, gate_form_id, cta, page_url, page_title, element_meta, options,
                            before_image_path, before_image_width, before_image_height, before_blurs)
    select m.new_id, v_new, d.workspace_id, s.position, mc.new_id, s.kind, s.image_path, s.image_width, s.image_height,
           s.snapshot_path, s.title, s.body, s.zoom, s.blurs, mf.new_id, s.cta, s.page_url, s.page_title, s.element_meta,
           -- les choix de parcours (F1) pointent vers les nouvelles étapes et les nouveaux chapitres
           case when jsonb_typeof(s.options -> 'choices') = 'array' then jsonb_set(s.options, '{choices}', coalesce((
             select jsonb_agg(case
               when c -> 'action' ->> 'type' = 'goto' then jsonb_set(c, '{action,stepId}', to_jsonb(coalesce(
                 (select g.new_id::text from _map g where g.old_id::text = c -> 'action' ->> 'stepId'), c -> 'action' ->> 'stepId')))
               when c -> 'action' ->> 'type' = 'chapter' then jsonb_set(c, '{action,chapterId}', to_jsonb(coalesce(
                 (select g.new_id::text from _map g where g.old_id::text = c -> 'action' ->> 'chapterId'), c -> 'action' ->> 'chapterId')))
               else c end order by ord)
             from jsonb_array_elements(s.options -> 'choices') with ordinality as x(c, ord)), '[]'::jsonb))
           else s.options end,
           -- L17 : capture « Avant » (même fichier, comme image_path)
           s.before_image_path, s.before_image_width, s.before_image_height, s.before_blurs
    from public.steps s join _map m on m.old_id = s.id
    left join _map mc on mc.old_id = s.chapter_id
    left join _map mf on mf.old_id = s.gate_form_id;

  -- L17 : origine « Étape n » d'une capture Avant / Après : vers la nouvelle étape
  update public.steps ns set options = jsonb_set(ns.options, array['beforeAfter', 'sources', k, 'stepId'], to_jsonb(g.new_id::text))
    from (values ('before'), ('after')) as side(k), _map g
    where ns.demo_id = v_new and ns.options #>> array['beforeAfter', 'sources', side.k, 'kind'] = 'step'
      and g.old_id::text = ns.options #>> array['beforeAfter', 'sources', side.k, 'stepId'];

  insert into public.hotspots (step_id, demo_id, workspace_id, x, y, w, h, title, body, placement, action, cta, pulse, position, style)
    select m.new_id, v_new, d.workspace_id, h.x, h.y, h.w, h.h, h.title, h.body, h.placement,
           -- les cibles "goto" pointent vers les nouvelles étapes
           case when h.action ->> 'type' = 'goto'
             then jsonb_build_object('type', 'goto', 'stepId', coalesce((select g.new_id::text from _map g where g.old_id::text = h.action ->> 'stepId'), h.action ->> 'stepId'))
             else h.action end,
           h.cta, h.pulse, h.position, h.style
    from public.hotspots h join _map m on m.old_id = h.step_id;

  -- F2 : questions du quiz, étapes liées remappées
  insert into public.quiz_questions (demo_id, workspace_id, position, type, prompt, answers, explanation, step_id, points)
    select v_new, d.workspace_id, q.position, q.type, q.prompt, q.answers, q.explanation, ms.new_id, q.points
    from public.quiz_questions q left join _map ms on ms.old_id = q.step_id
    where q.demo_id = p_demo;

  return v_new;
end $$;
