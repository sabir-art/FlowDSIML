-- L28 082 : adresse personnalisée d'une démo (spec docs/ux/specs/l28-complements.md §2, format arrêté par le
-- chef d'équipe). Idempotent.
--  * #/l/<partie lisible>-<6 caractères base62 tirés par le serveur> : unique sur toute la plateforme grâce
--    au suffixe, sans nom d'espace ; une partie lisible déjà utilisée ailleurs ne révèle rien (collision du
--    suffixe gérée en silence).
--  * #/d/<id> reste toujours valable ; l'ancienne adresse redirige pendant 90 jours après un changement.
--  * Les jetons des liens personnalisés (#/l/<24 hexadécimaux>) n'ont jamais de tiret : pas d'ambiguïté.

create table if not exists public.demo_addresses (
  address text primary key
    check (address ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]-[A-Za-z0-9]{6}$'),
  demo_id uuid not null references public.demos (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  retired_at timestamptz
);
create unique index if not exists demo_addresses_current_idx on public.demo_addresses (demo_id)
  where retired_at is null;
create index if not exists demo_addresses_demo_idx on public.demo_addresses (demo_id, retired_at);

alter table public.demo_addresses enable row level security;
revoke all on public.demo_addresses from anon, authenticated;
grant select on public.demo_addresses to authenticated;
drop policy if exists demo_addresses_select on public.demo_addresses;
-- Membres de l'espace, sans les démos d'un dossier restreint (L27)
create policy demo_addresses_select on public.demo_addresses for select to authenticated
  using (public.has_role(workspace_id, 'viewer')
         and not (demo_id = any ((select public.my_hidden_demos())::uuid[])));

-- Partie lisible : règles et mots réservés du centre de formation (L14)
create or replace function public.set_demo_address(p_demo uuid, p_label text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_ws uuid;
  v_label text := lower(trim(coalesce(p_label, '')));
  v_alpha constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  v_bytes bytea;
  v_addr text;
  v_try int := 0;
begin
  select workspace_id into v_ws from public.demos where id = p_demo and deleted_at is null;
  if v_ws is null or not public.has_role(v_ws, 'editor') or not public.demo_visible(p_demo) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_label !~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$' then
    raise exception 'ADDRESS_FORMAT' using errcode = 'P0001';
  end if;
  if public.center_slug_reserved(v_label) then
    raise exception 'ADDRESS_RESERVED' using errcode = 'P0001';
  end if;
  -- Une seule écriture à la fois par démo
  perform 1 from public.demos where id = p_demo for update;
  update public.demo_addresses set retired_at = now() where demo_id = p_demo and retired_at is null;
  delete from public.demo_addresses where demo_id = p_demo and retired_at < now() - interval '90 days';
  loop
    v_try := v_try + 1;
    v_bytes := extensions.gen_random_bytes(6);
    v_addr := v_label || '-' || (
      select string_agg(substr(v_alpha, (get_byte(v_bytes, i) % 62) + 1, 1), '' order by i)
      from generate_series(0, 5) i);
    begin
      insert into public.demo_addresses (address, demo_id, workspace_id) values (v_addr, p_demo, v_ws);
      return v_addr;
    exception when unique_violation then
      -- Suffixe déjà tiré (ici ou dans un autre espace) : nouvel essai, sans rien révéler
      if v_try >= 5 then raise exception 'ADDRESS_RETRY' using errcode = 'P0001'; end if;
    end;
  end loop;
end $$;
revoke all on function public.set_demo_address(uuid, text) from public, anon;
grant execute on function public.set_demo_address(uuid, text) to authenticated;

-- Lecteur public : identifiant de la démo publiée seulement (adresse courante, ou retirée depuis moins
-- de 90 jours) ; null sinon. Mot de passe, expiration et règles de partage restent ceux de la démo.
create or replace function public.resolve_demo_address(p_address text)
returns uuid language sql stable security definer set search_path = '' as $$
  select d.id
    from public.demo_addresses a
    join public.demos d on d.id = a.demo_id
   where a.address = p_address
     and (a.retired_at is null or a.retired_at > now() - interval '90 days')
     and d.status = 'published' and d.deleted_at is null
   limit 1;
$$;
revoke all on function public.resolve_demo_address(text) from public;
grant execute on function public.resolve_demo_address(text) to anon, authenticated;
