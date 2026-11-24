-- Paramètres › Marque › Page publique (retours client du 24/11 §6.1) : le catalogue public de l'espace,
-- servi par le lecteur à /c/{adresse}. Nouveau fichier ; idempotent.
--  * Un espace garde UNE adresse publique. Elle affiche le centre de formation (comme avant) ou, quand
--    la page publique est activée, le catalogue de démos réglé ici.
--  * Les réglages de la page publique vivent dans deux colonnes à part (public_page,
--    public_page_enabled) : activer la page ne touche ni au brouillon ni à la publication du centre de
--    formation. La couper remet l'adresse dans son état précédent.
--  * Rétrocompatible : sans page publique activée, center_open répond exactement comme avant (centre
--    de formation ou ancien « Catalogue de démos » publié depuis Parcours de formation).
--  * Page publique : sans mot de passe (« visible par toute personne qui a l'adresse ») ; toujours
--    soumise au réglage de l'espace « liens publics ». Seules des démos publiées en accès ouvert sortent.
--  * Écriture par save_public_page seulement (propriétaires et administrateurs).

alter table public.training_centers
  add column if not exists public_page jsonb not null default '{}'::jsonb,
  add column if not exists public_page_enabled boolean not null default false;

/**
 * Réglages de la page publique : { title ≤ 120, tagline ≤ 160, logo (fichier de la médiathèque ou null :
 * logo de l'espace), demos ('all' ou liste ordonnée d'identifiants, 100 au plus), contact ('' , e-mail
 * ou https, ≤ 200), madeWith (booléen) }. Toute autre clé est refusée.
 */
create or replace function public.public_page_valid(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and not exists (select 1 from jsonb_object_keys(p) k
                     where k not in ('title', 'tagline', 'logo', 'demos', 'contact', 'madeWith'))
    and (not p ? 'title' or (jsonb_typeof(p -> 'title') = 'string' and char_length(p ->> 'title') <= 120))
    and (not p ? 'tagline' or (jsonb_typeof(p -> 'tagline') = 'string' and char_length(p ->> 'tagline') <= 160))
    and (not p ? 'logo' or jsonb_typeof(p -> 'logo') = 'null'
         or (jsonb_typeof(p -> 'logo') = 'string'
             and (p ->> 'logo') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}\.(png|jpe?g|svg)$'))
    and (not p ? 'demos' or p -> 'demos' = '"all"'::jsonb
         or (jsonb_typeof(p -> 'demos') = 'array' and jsonb_array_length(p -> 'demos') <= 100
             and not exists (select 1 from jsonb_array_elements(p -> 'demos') d
                              where jsonb_typeof(d) <> 'string'
                                 or (d #>> '{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')))
    and (not p ? 'contact' or (jsonb_typeof(p -> 'contact') = 'string' and char_length(p ->> 'contact') <= 200
         and ((p ->> 'contact') = '' or (p ->> 'contact') ~ '^https://[^\s<>"]+$'
              or (p ->> 'contact') ~ '^[^@\s<>"]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$')))
    and (not p ? 'madeWith' or jsonb_typeof(p -> 'madeWith') = 'boolean');
$$;
alter table public.training_centers drop constraint if exists training_centers_public_page_check;
alter table public.training_centers add constraint training_centers_public_page_check
  check (public.public_page_valid(public_page));

-- Lecture par les propriétaires et administrateurs (policy training_centers_read inchangée)
grant select (public_page, public_page_enabled) on public.training_centers to authenticated;

/**
 * Démos affichées par la page publique : celles de center_demos (publiées, accès ouvert). « all » :
 * toutes, rangées par dossier puis titre, comme avant. Liste choisie : dans l'ordre de la liste, sans
 * rubrique ; une démo dépubliée ou protégée depuis disparaît d'elle-même.
 */
create or replace function public.public_page_demos(p_ws uuid, p_page jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when jsonb_typeof(p_page -> 'demos') = 'array' then
    coalesce((select jsonb_agg((d.item - 'section') || jsonb_build_object('section', null) order by pick.ord)
                from jsonb_array_elements_text(p_page -> 'demos') with ordinality as pick(id, ord)
                join jsonb_array_elements(public.center_demos(p_ws)) as d(item) on d.item ->> 'demoId' = pick.id),
             '[]'::jsonb)
    else public.center_demos(p_ws) end;
$$;
revoke all on function public.public_page_demos(uuid, jsonb) from public, anon, authenticated;

/**
 * Ce que l'écran doit savoir pour régler la page (propriétaires et administrateurs) :
 * liens publics autorisés, démos publiées en accès ouvert, centre de formation publié à cette adresse.
 */
create or replace function public.public_page_info(p_ws uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.training_centers;
begin
  if not public.has_role(p_ws, 'admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into c from public.training_centers where workspace_id = p_ws;
  return jsonb_build_object(
    'publicLinks', coalesce((select public_links_enabled from public.workspaces where id = p_ws), false),
    'demos', (select coalesce(jsonb_agg(jsonb_build_object('id', d ->> 'demoId', 'title', d ->> 'title', 'kind', d ->> 'kind')), '[]'::jsonb)
                from jsonb_array_elements(public.center_demos(p_ws)) d),
    -- Centre de formation en ligne à cette adresse (un ancien catalogue publié n'en est pas un)
    'centre', case when c.published is not null and coalesce(c.published ->> 'kind', 'training') <> 'demo'
                   then jsonb_build_object('title', coalesce(nullif(c.published ->> 'title', ''),
                                                             (select name from public.workspaces where id = p_ws))) end);
end $$;
revoke all on function public.public_page_info(uuid) from public, anon;
grant execute on function public.public_page_info(uuid) to authenticated;

/**
 * Enregistre l'adresse et les réglages de la page publique, et l'active ou la coupe.
 * Activer exige : liens publics autorisés (PUBLIC_DISABLED), au moins une démo affichable
 * (NO_VISIBLE_DEMO) et, si un centre de formation est en ligne à cette adresse, p_replace
 * (CENTER_PUBLISHED sinon). Les réglages du centre de formation ne sont jamais modifiés.
 */
create or replace function public.save_public_page(p_ws uuid, p_slug text, p_page jsonb, p_enabled boolean,
                                                   p_replace boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.training_centers;
  v_page jsonb := coalesce(p_page, '{}'::jsonb);
begin
  if not public.has_role(p_ws, 'admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if coalesce(p_slug, '') !~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$' or public.center_slug_reserved(p_slug) then
    raise exception 'SLUG_INVALID' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.training_centers where slug = p_slug and workspace_id <> p_ws) then
    raise exception 'SLUG_TAKEN' using errcode = 'P0001';
  end if;
  if not public.public_page_valid(v_page) then raise exception 'PAGE_INVALID' using errcode = 'P0001'; end if;
  -- Logo : un fichier image de la médiathèque de cet espace
  if (v_page ->> 'logo') is not null and not exists (
    select 1 from public.media_files m
     where m.workspace_id = p_ws and m.path = v_page ->> 'logo' and m.kind in ('logo', 'image')) then
    raise exception 'PAGE_INVALID' using errcode = 'P0001';
  end if;
  -- Démos choisies : toutes de cet espace
  if jsonb_typeof(v_page -> 'demos') = 'array' and exists (
    select 1 from jsonb_array_elements_text(v_page -> 'demos') x(id)
     where not exists (select 1 from public.demos d where d.id = x.id::uuid and d.workspace_id = p_ws)) then
    raise exception 'PAGE_INVALID' using errcode = 'P0001';
  end if;
  select * into c from public.training_centers where workspace_id = p_ws;
  if coalesce(p_enabled, false) then
    if not coalesce((select public_links_enabled from public.workspaces where id = p_ws), false) then
      raise exception 'PUBLIC_DISABLED' using errcode = 'P0001';
    end if;
    if jsonb_array_length(public.public_page_demos(p_ws, v_page)) = 0 then
      raise exception 'NO_VISIBLE_DEMO' using errcode = 'P0001';
    end if;
    if not coalesce(c.public_page_enabled, false) and not coalesce(p_replace, false)
       and c.published is not null and coalesce(c.published ->> 'kind', 'training') <> 'demo' then
      raise exception 'CENTER_PUBLISHED' using errcode = 'P0001';
    end if;
  end if;
  insert into public.training_centers (workspace_id, slug, public_page, public_page_enabled, updated_by)
  values (p_ws, p_slug, v_page, coalesce(p_enabled, false), (select auth.uid()))
  on conflict (workspace_id) do update
    set slug = excluded.slug, public_page = excluded.public_page,
        public_page_enabled = excluded.public_page_enabled, updated_at = now(), updated_by = excluded.updated_by;
end $$;
revoke all on function public.save_public_page(uuid, text, jsonb, boolean, boolean) from public, anon;
grant execute on function public.save_public_page(uuid, text, jsonb, boolean, boolean) to authenticated;

-- ===== Ouverture publique =====
-- L'ouverture existante (centre de formation, mot de passe, ancien catalogue) est gardée telle quelle
-- sous un autre nom ; center_open sert la page publique quand elle est activée, sinon délègue.
do $$
begin
  if to_regprocedure('public.center_open_centre(text, text, text, text, text, text)') is null then
    alter function public.center_open(text, text, text, text, text, text) rename to center_open_centre;
  end if;
end $$;
revoke all on function public.center_open_centre(text, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.center_open(
  p_slug text, p_password text default null, p_grant text default null, p_client text default null,
  p_link_token text default null, p_visitor text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.training_centers;
  w public.workspaces;
  pg jsonb;
begin
  select * into c from public.training_centers where slug = p_slug;
  if not found or not c.public_page_enabled then
    return public.center_open_centre(p_slug, p_password, p_grant, p_client, p_link_token, p_visitor);
  end if;
  select * into w from public.workspaces where id = c.workspace_id;
  -- Liens publics interdits : même réponse qu'une adresse inconnue
  if not coalesce(w.public_links_enabled, false) then
    return jsonb_build_object('status', 'not_found');
  end if;
  pg := c.public_page;
  return jsonb_build_object(
    'status', 'ok',
    'title', coalesce(nullif(pg ->> 'title', ''), w.name),
    'workspace', w.name,
    'center', jsonb_build_object(
      'title', coalesce(nullif(pg ->> 'title', ''), w.name),
      'intro', '', 'brand', null, 'accent', null, 'style', 'workspace',
      -- Logo choisi dans la médiathèque, sinon celui de l'espace
      'logoMedia', pg ->> 'logo',
      'logoPath', case when (pg ->> 'logo') is null and public.path_uuid(w.logo_path, 1) = w.id then w.logo_path end,
      'help', coalesce(pg ->> 'contact', ''),
      'a11y', 'non_evalue', 'a11yUrl', '', 'privacyUrl', '', 'indexable', false,
      'workspace', w.name,
      'kind', 'demo',
      'heroTitle', coalesce(pg ->> 'title', ''),
      'heroSubtitle', coalesce(pg ->> 'tagline', ''),
      'cta', null,
      'madeWith', coalesce((pg ->> 'madeWith')::boolean, true)),
    'demos', public.public_page_demos(c.workspace_id, pg),
    'visitor', null,
    'paths', '[]'::jsonb);
end $$;
revoke all on function public.center_open(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.center_open(text, text, text, text, text, text) to service_role;
