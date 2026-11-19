-- L27 120 et 123 : marque de l'espace, styles des démos et règles de partage
-- (spec docs/ux/specs/l27-marque-regles.md). Idempotent. L'accès par dossier (L27-09) est à part.
--  * workspaces : couleurs de la marque (centre de formation, pages publiques,
--    en-tête). Écriture réservée aux admins (politique ws_update existante), comme logo_path.
--  * builtin_styles : les 6 styles livrés (identiques à apps/web/src/pages/editor/styles/presets.ts,
--    vérifié par un test). Lecture pour les membres.
--  * themes (styles de l'espace) : auteur (created_by) et ligne « style livré par défaut » (builtin_key).
--    Le style par défaut reste la ligne is_default, lue par publish_demo (inchangée) : quand c'est un
--    style livré, une ligne masquée en porte les valeurs. Un seul défaut par espace, noms uniques.
--    Droits (§2) : créer = éditeur ; modifier = admin, ou éditeur pour ses propres styles ;
--    supprimer = admin, jamais le style par défaut ; choisir le défaut = admin (set_default_style).
--  * Appliquer un style copie ses valeurs dans la démo (L18) : modifier un style ne change pas les démos.
--    Le défaut s'applique aux démos sans style choisi, à leur prochaine publication.
--  * workspace_onboarding : étape « Marque » (logo, couleur ou style par défaut changé).
--  * help_tours supprimée (visites guidées = démos statiques embarquées, arbitrage du chef).

-- ===== Marque de l'espace =====
alter table public.workspaces add column if not exists brand_primary text;
alter table public.workspaces add column if not exists brand_accent text;
do $$ begin
  alter table public.workspaces add constraint workspaces_brand_check check (
    (brand_primary is null or brand_primary ~ '^#[0-9A-Fa-f]{6}$')
    and (brand_accent is null or brand_accent ~ '^#[0-9A-Fa-f]{6}$'));
exception when duplicate_object then null; end $$;
grant update (brand_primary, brand_accent) on public.workspaces to authenticated;

-- ===== Styles livrés =====
create table if not exists public.builtin_styles (
  key text primary key check (key ~ '^[a-z]{2,20}$'),
  sort int not null,
  tokens jsonb not null
);
alter table public.builtin_styles enable row level security;
revoke all on public.builtin_styles from anon, authenticated;
grant select on public.builtin_styles to authenticated;
drop policy if exists builtin_styles_select on public.builtin_styles;
create policy builtin_styles_select on public.builtin_styles for select to authenticated using (true);

insert into public.builtin_styles (key, sort, tokens) values
  ('dsi', 0, '{"primary":"#A3195B","onPrimary":"#FFFFFF","hotspot":"#D60B52","background":"#EEF2F6","surface":"#FFFFFF","text":"#080808","radius":20,"buttonRadius":999,"fontFamily":"''Plus Jakarta Sans'', system-ui, sans-serif"}'),
  ('blue', 1, '{"primary":"#217BAC","onPrimary":"#FFFFFF","hotspot":"#2897D5","background":"#FFFFFF","surface":"#FFFFFF","text":"#161A20","radius":12,"buttonRadius":8,"fontFamily":"''Plus Jakarta Sans'', system-ui, sans-serif"}'),
  ('green', 2, '{"primary":"#95C11F","onPrimary":"#080808","hotspot":"#557014","background":"#F5F9E8","surface":"#FFFFFF","text":"#080808","radius":20,"buttonRadius":999,"fontFamily":"''Plus Jakarta Sans'', system-ui, sans-serif"}'),
  ('night', 3, '{"primary":"#CF86A9","onPrimary":"#080808","hotspot":"#E35889","background":"#0B0D10","surface":"#1C2128","text":"#F3F5F8","radius":16,"buttonRadius":999,"fontFamily":"''Plus Jakarta Sans'', system-ui, sans-serif"}'),
  ('minimal', 4, '{"primary":"#080808","onPrimary":"#FFFFFF","hotspot":"#080808","background":"#F6F8FA","surface":"#FFFFFF","text":"#080808","radius":6,"buttonRadius":6,"fontFamily":"system-ui, sans-serif"}'),
  ('contrast', 5, '{"primary":"#FFFFFF","onPrimary":"#080808","hotspot":"#D60B52","background":"#FFFFFF","surface":"#080808","text":"#FFFFFF","radius":8,"buttonRadius":8,"fontFamily":"''Plus Jakarta Sans'', system-ui, sans-serif"}')
on conflict (key) do update set sort = excluded.sort, tokens = excluded.tokens;

-- ===== Styles de l'espace =====
alter table public.themes add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.themes alter column created_by set default auth.uid();
alter table public.themes add column if not exists builtin_key text references public.builtin_styles (key);

-- Ligne « Par défaut » vide (créée avec l'espace) = style livré « dsi »
update public.themes t set builtin_key = 'dsi', tokens = b.tokens
  from public.builtin_styles b
 where b.key = 'dsi' and t.is_default and t.builtin_key is null and t.tokens = '{}'::jsonb;
-- Un seul défaut par espace (le plus ancien), et un défaut partout
with r as (
  select id, row_number() over (partition by workspace_id order by created_at, id) n
    from public.themes where is_default
)
update public.themes t set is_default = false from r where r.id = t.id and r.n > 1;
delete from public.themes where builtin_key is not null and not is_default;
insert into public.themes (workspace_id, name, tokens, is_default, builtin_key, created_by)
select w.id, 'Par défaut', b.tokens, true, 'dsi', null
  from public.workspaces w join public.builtin_styles b on b.key = 'dsi'
 where not exists (select 1 from public.themes t where t.workspace_id = w.id and t.is_default);
-- Noms uniques (sans tenir compte de la casse) : les doublons existants sont numérotés
with r as (
  select id, name, row_number() over (partition by workspace_id, lower(btrim(name)) order by created_at, id) n
    from public.themes where builtin_key is null
)
update public.themes t set name = left(btrim(r.name), 34) || ' (' || r.n || ')'
  from r where r.id = t.id and r.n > 1;

create unique index if not exists themes_one_default on public.themes (workspace_id) where is_default;
create unique index if not exists themes_one_builtin on public.themes (workspace_id) where builtin_key is not null;
create unique index if not exists themes_name_uniq on public.themes (workspace_id, lower(btrim(name)))
  where builtin_key is null;

-- Nom : 1 à 40 caractères (à la création et au renommage) ; ligne vide créée avec l'espace = « dsi »
create or replace function public.themes_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.is_default and new.builtin_key is null and new.tokens = '{}'::jsonb then
    new.builtin_key := 'dsi';
    new.tokens := (select b.tokens from public.builtin_styles b where b.key = 'dsi');
  end if;
  new.name := btrim(new.name);
  if new.builtin_key is null and (tg_op = 'INSERT' or new.name is distinct from old.name)
     and char_length(new.name) not between 1 and 40 then
    raise exception 'STYLE_NAME_INVALID' using errcode = 'P0001';
  end if;
  if new.builtin_key is null and exists (
    select 1 from public.themes t
     where t.workspace_id = new.workspace_id and t.id <> new.id and t.builtin_key is null
       and lower(t.name) = lower(new.name)
  ) then
    raise exception 'STYLE_NAME_TAKEN' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists themes_guard on public.themes;
create trigger themes_guard before insert or update on public.themes
  for each row execute function public.themes_guard();

-- Droits (§2), vérifiés par la base
revoke insert, update, delete on public.themes from authenticated;
grant insert (id, workspace_id, name, tokens, created_by) on public.themes to authenticated;
grant update (name, tokens, updated_at) on public.themes to authenticated;
grant delete on public.themes to authenticated;
drop policy if exists themes_insert on public.themes;
create policy themes_insert on public.themes for insert to authenticated
  with check (
    public.has_role(workspace_id, 'editor') and not is_default and builtin_key is null
    and (created_by = (select auth.uid()) or public.has_role(workspace_id, 'admin'))
  );
drop policy if exists themes_update on public.themes;
create policy themes_update on public.themes for update to authenticated
  using (
    builtin_key is null and (public.has_role(workspace_id, 'admin')
      or (public.has_role(workspace_id, 'editor') and created_by = (select auth.uid())))
  )
  with check (builtin_key is null and public.has_role(workspace_id, 'editor'));
drop policy if exists themes_delete on public.themes;
create policy themes_delete on public.themes for delete to authenticated
  using (public.has_role(workspace_id, 'admin') and not is_default and builtin_key is null);

-- Choisir le style par défaut : un style livré (p_builtin) ou un style de l'espace (p_theme)
create or replace function public.set_default_style(p_ws uuid, p_builtin text default null, p_theme uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_tokens jsonb;
begin
  if not public.has_role(p_ws, 'admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if (p_builtin is null) = (p_theme is null) then
    raise exception 'INVALID' using errcode = 'P0001';
  end if;
  if p_theme is not null then
    if not exists (select 1 from public.themes where id = p_theme and workspace_id = p_ws and builtin_key is null) then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    update public.themes set is_default = false where workspace_id = p_ws and is_default and id <> p_theme;
    delete from public.themes where workspace_id = p_ws and builtin_key is not null;
    update public.themes set is_default = true, updated_at = now() where id = p_theme;
  else
    select tokens into v_tokens from public.builtin_styles where key = p_builtin;
    if v_tokens is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    update public.themes set is_default = false where workspace_id = p_ws and is_default and builtin_key is null;
    update public.themes set builtin_key = p_builtin, tokens = v_tokens, is_default = true, updated_at = now()
     where workspace_id = p_ws and builtin_key is not null;
    if not found then
      insert into public.themes (workspace_id, name, tokens, is_default, builtin_key, created_by)
      values (p_ws, 'Par défaut', v_tokens, true, p_builtin, null);
    end if;
  end if;
end $$;
revoke all on function public.set_default_style(uuid, text, uuid) from public, anon;
grant execute on function public.set_default_style(uuid, text, uuid) to authenticated;

-- Démos concernées par le style par défaut : sans style choisi (aucune couleur dans settings.theme)
create or replace function public.default_style_impact(p_ws uuid)
returns int language sql stable security definer set search_path = '' as $$
  select case when public.has_role(p_ws, 'viewer') then (
    select count(*)::int from public.demos d
     where d.workspace_id = p_ws and d.deleted_at is null and d.theme_id is null
       and not coalesce(d.settings -> 'theme' ? 'primary', false)
  ) end;
$$;
revoke all on function public.default_style_impact(uuid) from public, anon;
grant execute on function public.default_style_impact(uuid) to authenticated;

-- ===== Prise en main (L26-01) : l'étape « Marque » suit les nouveaux réglages =====
-- workspace_onboarding redéfinie à l'identique de 20261121110000_prise_en_main.sql, sauf « brand » :
-- logo ou couleur de la marque, ou style par défaut autre que le style livré d'origine.
create or replace function public.workspace_onboarding(p_ws uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s jsonb;
  v_done timestamptz;
begin
  if not public.has_role(p_ws, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  s := jsonb_build_object(
    'brand', exists (select 1 from public.workspaces w where w.id = p_ws
                     and (w.logo_path is not null or w.brand_primary is not null))
             or exists (select 1 from public.themes t where t.workspace_id = p_ws and t.is_default
                        and t.builtin_key is distinct from 'dsi'),
    'extension', exists (select 1 from public.members m join public.profiles p on p.id = m.user_id
                         where m.workspace_id = p_ws and p.extension_seen_at is not null),
    'capture', exists (select 1 from public.steps st join public.demos d on d.id = st.demo_id
                       where st.workspace_id = p_ws and d.deleted_at is null and st.image_path is not null),
    -- Capture passée par l'écran de vérification des données de l'extension (F1 §1)
    'pii', exists (select 1 from public.steps st join public.demos d on d.id = st.demo_id
                   where st.workspace_id = p_ws and d.deleted_at is null and st.element_meta ? 'pii'),
    'publish', exists (select 1 from public.demos d where d.workspace_id = p_ws and d.deleted_at is null and d.status = 'published'),
    'invite', (select count(*) from public.members m where m.workspace_id = p_ws) >= 2,
    'distribute', exists (select 1 from public.share_links l where l.workspace_id = p_ws and l.variables <> '{}'::jsonb)
                  or exists (select 1 from public.diffusions x where x.workspace_id = p_ws)
                  or exists (select 1 from public.demo_pages pg where pg.workspace_id = p_ws and pg.enabled)
  );
  select done_at into v_done from public.onboarding_done where workspace_id = p_ws;
  if v_done is null and not exists (select 1 from jsonb_each(s) e where e.value = 'false'::jsonb) then
    insert into public.onboarding_done (workspace_id) values (p_ws) on conflict do nothing
      returning done_at into v_done;
  end if;
  return jsonb_build_object(
    'steps', s,
    'doneAt', v_done,
    'hiddenAt', (select hidden_at from public.onboarding_prefs where user_id = (select auth.uid()) and workspace_id = p_ws)
  );
end $$;
revoke all on function public.workspace_onboarding(uuid) from public, anon;
grant execute on function public.workspace_onboarding(uuid) to authenticated;

-- ===== Règles de partage (123, Enterprise) =====
-- Modes d'accès autorisés, durée maximale des liens, rôle qui publie et diffuse, exports hors de l'app.
-- Lecture : membres (Partager affiche les règles) ; écriture : set_share_rules (admin, plan Enterprise).
-- Contrôles côté serveur par triggers (demo_access, share_links, demo_versions, diffusions, demo_pages),
-- sans redéfinir les RPC existantes. Limite connue (dettes.md) : les fichiers d'export (PDF, MP4, HTML,
-- paquet SCORM) sont produits dans le navigateur à partir de données déjà lisibles par le membre ; le
-- serveur refuse l'enregistrement d'une diffusion SCORM, l'interface désactive les exports.
update public.plans set limits = limits || jsonb_build_object('share_rules', code = 'enterprise')
 where not (limits ? 'share_rules');

create table if not exists public.share_rules (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  modes text[] not null default array['link', 'password']
    check (modes <@ array['link', 'password'] and cardinality(modes) between 1 and 2),
  max_link_days int check (max_link_days in (7, 30, 90)),
  publish_role text not null default 'editor' check (publish_role in ('editor', 'admin')),
  exports_allowed boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.share_rules enable row level security;
revoke all on public.share_rules from anon, authenticated;
grant select on public.share_rules to authenticated;
drop policy if exists share_rules_select on public.share_rules;
create policy share_rules_select on public.share_rules for select to authenticated
  using (public.has_role(workspace_id, 'viewer'));

-- Règles en vigueur (valeurs par défaut sans ligne)
create or replace function public.share_rules_of(p_ws uuid)
returns public.share_rules language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select r from public.share_rules r where r.workspace_id = p_ws),
    row(p_ws, array['link', 'password'], null, 'editor', true, now(), null)::public.share_rules
  );
$$;
revoke all on function public.share_rules_of(uuid) from public, anon, authenticated;

-- Démo bloquée par les règles (mot de passe exigé, aucun mot de passe défini) : badge « Accès à régler »
alter table public.demo_access add column if not exists locked_by_rules boolean not null default false;
grant select (locked_by_rules) on public.demo_access to authenticated;

-- Accès d'une démo : mode autorisé ; expiration au plus égale à la limite (posée d'office si absente)
create or replace function public.demo_access_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r public.share_rules := public.share_rules_of(new.workspace_id);
  v_max timestamptz := case when r.max_link_days is not null then now() + make_interval(days => r.max_link_days) end;
begin
  -- Mise en conformité par set_share_rules (valeurs déjà calculées sur les nouvelles règles). Réglage
  -- local à la transaction ; set_config n'est pas exposé par l'API (schéma public seulement).
  if current_setting('fd.rules_fix', true) = '1' then return new; end if;
  -- Tout nouveau réglage respecte les règles ; un lien gardé tel quel n'est pas touché
  if not (new.mode = any (r.modes)) then
    raise exception 'RULE_MODE' using errcode = 'P0001';
  end if;
  if v_max is not null then
    -- Sans expiration (« Jamais ») : ramenée à la limite ; au-delà de la limite : refusée
    if new.expires_at is null then
      new.expires_at := v_max;
    elsif (tg_op = 'INSERT' or new.expires_at is distinct from old.expires_at)
          and new.expires_at > v_max + interval '1 minute' then
      raise exception 'RULE_EXPIRY:%', r.max_link_days using errcode = 'P0001';
    end if;
  end if;
  -- Mot de passe défini dans un mode autorisé : la démo n'est plus bloquée
  if new.locked_by_rules and new.mode = any (r.modes) and new.mode = 'password' and new.password_hash is not null
     and (tg_op = 'INSERT' or new.password_hash is distinct from old.password_hash or new.mode is distinct from old.mode) then
    new.locked_by_rules := false;
  end if;
  return new;
end $$;
drop trigger if exists demo_access_rules on public.demo_access;
create trigger demo_access_rules before insert or update on public.demo_access
  for each row execute function public.demo_access_rules();

-- Liens personnalisés : même limite de durée
create or replace function public.share_links_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r public.share_rules := public.share_rules_of(new.workspace_id);
  v_max timestamptz := case when r.max_link_days is not null then now() + make_interval(days => r.max_link_days) end;
begin
  if v_max is null or current_setting('fd.rules_fix', true) = '1' then return new; end if;
  if new.expires_at is null then
    new.expires_at := v_max;
  elsif (tg_op = 'INSERT' or new.expires_at is distinct from old.expires_at)
        and new.expires_at > v_max + interval '1 minute' then
    raise exception 'RULE_EXPIRY:%', r.max_link_days using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists share_links_rules on public.share_links;
create trigger share_links_rules before insert or update on public.share_links
  for each row execute function public.share_links_rules();

-- Publier et diffuser : rôle exigé par les règles (seulement pour un membre connecté)
create or replace function public.publish_rules_check(p_ws uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and (public.share_rules_of(p_ws)).publish_role = 'admin'
     and not public.has_role(p_ws, 'admin') then
    raise exception 'RULE_PUBLISH' using errcode = '42501';
  end if;
end $$;
revoke all on function public.publish_rules_check(uuid) from public, anon, authenticated;

create or replace function public.publish_rules_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Champs propres à une table lus par to_jsonb (plpgsql résout tous les champs d'une condition)
  if tg_table_name = 'demo_pages' and (to_jsonb(new) ->> 'enabled') = 'false' then return new; end if;
  perform public.publish_rules_check(new.workspace_id);
  if tg_table_name = 'diffusions' and (to_jsonb(new) ->> 'kind') = 'scorm'
     and not (public.share_rules_of(new.workspace_id)).exports_allowed then
    raise exception 'RULE_EXPORTS' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists demo_versions_publish_rules on public.demo_versions;
create trigger demo_versions_publish_rules before insert on public.demo_versions
  for each row execute function public.publish_rules_trigger();
drop trigger if exists diffusions_publish_rules on public.diffusions;
create trigger diffusions_publish_rules before insert or update on public.diffusions
  for each row execute function public.publish_rules_trigger();
drop trigger if exists demo_pages_publish_rules on public.demo_pages;
create trigger demo_pages_publish_rules before insert or update on public.demo_pages
  for each row execute function public.publish_rules_trigger();

-- Liens actifs qui ne respectent pas des règles (L27-07) : démos publiées et liens personnalisés
create or replace function public.share_rules_conflicts(p_ws uuid, p_modes text[], p_max_days int)
returns table (demo_id uuid, title text, kind text, mode text, link_id uuid, has_password boolean)
language sql stable security definer set search_path = '' as $$
  with pub as (
    select d.id, d.title, coalesce(a.mode, 'link') as mode, a.expires_at, a.password_hash is not null as pw,
           coalesce(a.locked_by_rules, false) as locked
      from public.demos d left join public.demo_access a on a.demo_id = d.id
     where d.workspace_id = p_ws and d.deleted_at is null and d.status = 'published'
  )
  select id, title, 'mode', mode, null::uuid, pw from pub
   where not locked and not (mode = any (p_modes))
  union all
  select id, title, 'expiry', mode, null::uuid, pw from pub
   where not locked and p_max_days is not null and mode = any (p_modes)
     and (expires_at is null or expires_at > now() + make_interval(days => p_max_days))
  union all
  select l.demo_id, d.title, 'custom', null, l.id, false
    from public.share_links l join public.demos d on d.id = l.demo_id
   where l.workspace_id = p_ws and l.is_active and d.deleted_at is null and p_max_days is not null
     and (l.expires_at is null or l.expires_at > now() + make_interval(days => p_max_days));
$$;
revoke all on function public.share_rules_conflicts(uuid, text[], int) from public, anon, authenticated;

create or replace function public.share_rules_preview(p_ws uuid, p_modes text[], p_max_days int)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return (
    select jsonb_build_object(
      'count', count(*),
      -- Démos qui seront bloquées : mot de passe exigé, aucun mot de passe, lien public interdit
      'locked', count(*) filter (where c.kind = 'mode' and not ('link' = any (p_modes))
                                   and not ('password' = any (p_modes) and c.has_password)),
      'items', coalesce((select jsonb_agg(jsonb_build_object('title', x.title, 'kind', x.kind, 'mode', x.mode))
                           from (select * from public.share_rules_conflicts(p_ws, p_modes, p_max_days)
                                 order by title, kind limit 5) x), '[]'::jsonb))
      from public.share_rules_conflicts(p_ws, p_modes, p_max_days) c
  );
end $$;
revoke all on function public.share_rules_preview(uuid, text[], int) from public, anon;
grant execute on function public.share_rules_preview(uuid, text[], int) to authenticated;

-- Enregistrer les règles (admin, Enterprise). p_fix : mettre les liens existants en conformité
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
  if not (p_modes <@ array['link', 'password']) then raise exception 'NOT_AVAILABLE' using errcode = 'P0001'; end if;

  if p_fix then
    perform set_config('fd.rules_fix', '1', true);
    for c in select * from public.share_rules_conflicts(p_ws, p_modes, p_max_days) loop
      if c.kind = 'mode' then
        -- Mot de passe exigé : la démo garde son mot de passe ; sans mot de passe, elle est bloquée
        insert into public.demo_access (demo_id, workspace_id, mode) values (c.demo_id, p_ws, 'link')
          on conflict (demo_id) do nothing;
        if 'password' = any (p_modes) and c.has_password then
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

-- set_demo_access redéfinie (correctif) : en mode mot de passe, l'ancien « insert … on conflict » échouait
-- sur la contrainte demo_access_check (la ligne proposée n'a pas de mot de passe), par exemple pour
-- changer l'expiration d'une démo protégée. Mise à jour si la ligne existe, insertion sinon.
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

-- demo_gate redéfinie à l'identique de 20261118090000_partage_securise.sql, avec le blocage par les règles.
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
  -- L27-07 : démo bloquée par les règles de partage (mot de passe exigé mais absent)
  if found and a.locked_by_rules then
    return jsonb_build_object('status', 'not_found');
  end if;
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

-- ===== Visites guidées : table remplacée par les démos statiques embarquées =====
drop table if exists public.help_tours;
