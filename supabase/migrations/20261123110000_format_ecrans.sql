-- L28 021 : format des écrans après capture (spec docs/ux/specs/l28-complements.md §4, schéma B validé par le
-- chef d'équipe). Idempotent.
--  * steps.original : sauvegarde de l'étape avant le premier changement de format (image, taille, flous,
--    zoom, recadrage, coordonnées des repères). Les images d'origine restent dans le stockage.
--  * Le redimensionnement est fait dans le navigateur (canvas) ; les coordonnées relatives sont recalculées
--    pour rester sur le même pixel de l'image.
--  * restore_original_sizes(p_demo) : « Revenir aux images d'origine », en une transaction.

create or replace function public.step_original_ok(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select v is null or (
    jsonb_typeof(v) = 'object' and pg_column_size(v) <= 262144
    and not exists (select 1 from jsonb_object_keys(v) k
                    where k not in ('image_path', 'image_width', 'image_height', 'blurs', 'zoom', 'crop', 'hotspots'))
    and jsonb_typeof(v -> 'image_path') = 'string'
    and jsonb_typeof(v -> 'image_width') = 'number' and jsonb_typeof(v -> 'image_height') = 'number'
    and (v -> 'blurs' is null or jsonb_typeof(v -> 'blurs') = 'array')
    and (v -> 'hotspots' is null or (jsonb_typeof(v -> 'hotspots') = 'array'
         and not exists (select 1 from jsonb_array_elements(v -> 'hotspots') h
                          where jsonb_typeof(h -> 'id') <> 'string'
                             or jsonb_typeof(h -> 'x') <> 'number' or jsonb_typeof(h -> 'y') <> 'number'
                             or jsonb_typeof(h -> 'w') <> 'number' or jsonb_typeof(h -> 'h') <> 'number'))));
$$;

alter table public.steps add column if not exists original jsonb;
alter table public.steps drop constraint if exists steps_original_ok;
alter table public.steps add constraint steps_original_ok check (public.step_original_ok(original));

-- L'image d'origine appartient au même espace (pas de chemin d'un autre workspace)
create or replace function public.steps_original_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.original is not null
     and public.path_uuid(new.original ->> 'image_path', 1) is distinct from new.workspace_id then
    raise exception 'ORIGINAL_PATH' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.steps_original_check() from public, anon, authenticated;
drop trigger if exists steps_original_check on public.steps;
create trigger steps_original_check before insert or update of original on public.steps
  for each row execute function public.steps_original_check();

create or replace function public.restore_original_sizes(p_demo uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_ws uuid;
  v_n int := 0;
  s record;
begin
  select workspace_id into v_ws from public.demos where id = p_demo and deleted_at is null;
  if v_ws is null or not public.has_role(v_ws, 'editor') or not public.demo_visible(p_demo) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  for s in select id, original, options from public.steps where demo_id = p_demo and original is not null loop
    update public.steps set
      image_path = s.original ->> 'image_path',
      image_width = (s.original ->> 'image_width')::int,
      image_height = (s.original ->> 'image_height')::int,
      blurs = coalesce(s.original -> 'blurs', '[]'::jsonb),
      zoom = case when jsonb_typeof(s.original -> 'zoom') = 'object' then s.original -> 'zoom' end,
      options = case when jsonb_typeof(s.original -> 'crop') = 'object'
                     then coalesce(s.options, '{}'::jsonb) || jsonb_build_object('crop', s.original -> 'crop')
                     else coalesce(s.options, '{}'::jsonb) - 'crop' end,
      original = null
    where id = s.id;
    update public.hotspots h set
      x = (o ->> 'x')::real, y = (o ->> 'y')::real, w = (o ->> 'w')::real, h = (o ->> 'h')::real
    from jsonb_array_elements(coalesce(s.original -> 'hotspots', '[]'::jsonb)) o
    where h.step_id = s.id and h.id::text = o ->> 'id';
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.restore_original_sizes(uuid) from public, anon;
grant execute on function public.restore_original_sizes(uuid) to authenticated;
