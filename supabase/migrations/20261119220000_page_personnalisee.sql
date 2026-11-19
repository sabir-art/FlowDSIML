-- L25-13 à L25-15 : page personnalisée par lien (schéma validé par le chef, avec ses conditions).
--  * share_links : page_enabled, page_title (90), page_message (400), signed_by (membre du workspace),
--    dataset_row, cta_label / cta_url (https), page_code (12 caractères base62, tirés au hasard) ;
--  * personal_page(p_demo, p_code) : gabarit de public_page + contenu du lien. Jamais l'e-mail ni
--    l'id du signataire ; variables sans email ; token du lien seulement si la démo n'est pas
--    protégée (mot de passe, invitation, domaine) : sinon le lecteur passe par l'écran habituel ;
--  * même réponse not_found pour un code inconnu, une démo supprimée ou une page publique coupée ;
--  * resolve_share_link renvoie aussi datasetRow (ligne du jeu de données choisie pour le lien).

alter table public.share_links
  add column if not exists page_enabled boolean not null default false,
  add column if not exists page_title text not null default '' check (char_length(page_title) <= 90),
  add column if not exists page_message text not null default '' check (char_length(page_message) <= 400),
  add column if not exists signed_by uuid references auth.users (id) on delete set null,
  add column if not exists dataset_row int check (dataset_row is null or dataset_row between 0 and 999),
  add column if not exists cta_label text check (cta_label is null or char_length(cta_label) between 1 and 40),
  add column if not exists cta_url text check (cta_url is null or cta_url ~ '^https://\S+$'),
  add column if not exists page_code text unique check (page_code is null or page_code ~ '^[0-9A-Za-z]{12}$');

-- Code non devinable : 12 caractères base62 (16 octets aléatoires, biais négligeable)
create or replace function public.random_code62(n int)
returns text language plpgsql volatile set search_path = '' as $$
declare
  a constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  b bytea := extensions.gen_random_bytes(n * 2);
  r text := '';
begin
  for i in 0 .. n - 1 loop
    r := r || substr(a, ((get_byte(b, 2 * i) * 256 + get_byte(b, 2 * i + 1)) % 62) + 1, 1);
  end loop;
  return r;
end $$;
revoke all on function public.random_code62(int) from public, anon, authenticated;

-- Signataire membre du workspace ; code tiré quand la page est activée (jamais modifiable ensuite)
create or replace function public.share_links_page_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.signed_by is not null and not exists (
    select 1 from public.members m where m.workspace_id = new.workspace_id and m.user_id = new.signed_by
  ) then
    raise exception 'SIGNER_NOT_MEMBER' using errcode = '23514';
  end if;
  -- Le code n'est jamais choisi par le client : tiré ici, puis figé
  if tg_op = 'INSERT' then
    new.page_code := case when new.page_enabled then public.random_code62(12) end;
  elsif old.page_code is not null then
    new.page_code := old.page_code;
  elsif new.page_enabled then
    new.page_code := public.random_code62(12);
  else
    new.page_code := null;
  end if;
  return new;
end $$;
revoke all on function public.share_links_page_check() from public, anon, authenticated;
drop trigger if exists share_links_page_check on public.share_links;
create trigger share_links_page_check before insert or update on public.share_links
  for each row execute function public.share_links_page_check();

-- Initiales d'un nom (« Camille Martin » → « CM »)
create or replace function public.name_initials(p text)
returns text language sql immutable set search_path = '' as $$
  select upper(coalesce(string_agg(left(w, 1), '' order by o), ''))
  from (select w, o from regexp_split_to_table(btrim(coalesce(p, '')), '\s+') with ordinality t(w, o)
        where w <> '' order by o limit 2) x;
$$;

create or replace function public.personal_page(p_demo uuid, p_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  l public.share_links;
  v_page jsonb;
  v_mode text;
  v_name text;
begin
  if p_code is null or p_code !~ '^[0-9A-Za-z]{12}$' then
    return jsonb_build_object('status', 'not_found');
  end if;
  select s.* into l from public.share_links s
    join public.demos d on d.id = s.demo_id
   where s.demo_id = p_demo and s.page_code = p_code and s.page_enabled
     and d.deleted_at is null and d.status = 'published';
  -- Code inconnu, démo supprimée ou dépubliée : même réponse
  if l.id is null then return jsonb_build_object('status', 'not_found'); end if;
  v_page := public.public_page(p_demo);
  if v_page is null then return jsonb_build_object('status', 'not_found'); end if;
  if not l.is_active or (l.expires_at is not null and l.expires_at <= now()) then
    return jsonb_build_object('status', 'inactive', 'publicPage', true, 'demoId', p_demo);
  end if;
  select mode into v_mode from public.demo_access where demo_id = p_demo;
  select nullif(btrim(p.full_name), '') into v_name
    from public.profiles p
   where p.id = l.signed_by
     and exists (select 1 from public.members m where m.workspace_id = l.workspace_id and m.user_id = l.signed_by);
  return jsonb_build_object(
    'status', 'ok',
    'page', v_page || jsonb_build_object('indexable', false),
    'personal', jsonb_build_object(
      'title', l.page_title,
      'message', l.page_message,
      -- Signature : nom et initiales seulement (jamais l'e-mail ni l'id)
      'signer', case when v_name is not null
        then jsonb_build_object('name', left(v_name, 120), 'initials', public.name_initials(v_name)) end,
      'cta', case when l.cta_url is not null
        then jsonb_build_object('label', coalesce(l.cta_label, v_page -> 'cta' ->> 'label'), 'url', l.cta_url)
        else v_page -> 'cta' end,
      -- Variables du lien pour le titre et le badge, sans l'e-mail (jamais affiché)
      'variables', coalesce(l.variables, '{}'::jsonb) - 'email',
      'datasetRow', l.dataset_row,
      -- Démo protégée : pas de token, le lecteur passe par l'écran mot de passe habituel
      'token', case when coalesce(v_mode, 'link') = 'link' then l.token end
    )
  );
end $$;
revoke all on function public.personal_page(uuid, text) from public;
grant execute on function public.personal_page(uuid, text) to anon, authenticated;

-- Lien personnalisé : ligne du jeu de données choisie
create or replace function public.resolve_share_link(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('demoId', l.demo_id, 'linkId', l.id, 'variables', l.variables,
                            'datasetRow', l.dataset_row)
  from public.share_links l join public.demos d on d.id = l.demo_id
  where l.token = p_token and l.is_active and (l.expires_at is null or l.expires_at > now())
    and d.status = 'published' and d.deleted_at is null;
$$;
