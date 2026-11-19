-- L27 120 : marque de l'espace et styles des démos (spec docs/ux/specs/l27-marque-regles.md). Idempotent.
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

-- ===== Visites guidées : table remplacée par les démos statiques embarquées =====
drop table if exists public.help_tours;
