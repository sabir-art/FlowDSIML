-- Images ajoutées (retours du 24/11 §1) et format des écrans : les images suivent le changement de format.
--  * steps.original admet « layout », la disposition appliquée par le dernier changement de format
--    (cadre de sortie et place de l'image d'origine dans ce cadre, en pixels) ;
--  * restore_original_sizes ramène aussi les images ajoutées à leur place sur l'image d'origine.
-- Le reste est repris à l'identique de 20261123110000.

create or replace function public.step_original_ok(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select v is null or (
    jsonb_typeof(v) = 'object' and pg_column_size(v) <= 262144
    and not exists (select 1 from jsonb_object_keys(v) k
                    where k not in ('image_path', 'image_width', 'image_height', 'blurs', 'zoom', 'crop', 'hotspots', 'layout'))
    and jsonb_typeof(v -> 'image_path') = 'string'
    and jsonb_typeof(v -> 'image_width') = 'number' and jsonb_typeof(v -> 'image_height') = 'number'
    and (v -> 'blurs' is null or jsonb_typeof(v -> 'blurs') = 'array')
    and (v -> 'layout' is null or (
         jsonb_typeof(v -> 'layout') = 'object'
         and not exists (select 1 from jsonb_object_keys(v -> 'layout') k
                         where k not in ('tw', 'th', 'ox', 'oy', 'dw', 'dh'))
         and jsonb_typeof(v #> '{layout,tw}') = 'number' and jsonb_typeof(v #> '{layout,th}') = 'number'
         and jsonb_typeof(v #> '{layout,ox}') = 'number' and jsonb_typeof(v #> '{layout,oy}') = 'number'
         and jsonb_typeof(v #> '{layout,dw}') = 'number' and jsonb_typeof(v #> '{layout,dh}') = 'number'
         and (v #>> '{layout,tw}')::numeric > 0 and (v #>> '{layout,th}')::numeric > 0
         and (v #>> '{layout,dw}')::numeric > 0 and (v #>> '{layout,dh}')::numeric > 0))
    and (v -> 'hotspots' is null or (jsonb_typeof(v -> 'hotspots') = 'array'
         and not exists (select 1 from jsonb_array_elements(v -> 'hotspots') h
                          where jsonb_typeof(h -> 'id') <> 'string'
                             or jsonb_typeof(h -> 'x') <> 'number' or jsonb_typeof(h -> 'y') <> 'number'
                             or jsonb_typeof(h -> 'w') <> 'number' or jsonb_typeof(h -> 'h') <> 'number'))));
$$;

-- Images ajoutées ramenées du cadre mis au format vers l'image d'origine (inverse de la disposition).
-- Sans disposition connue ou sans image ajoutée, les options sont rendues telles quelles.
create or replace function private.images_unformat(p_options jsonb, p_layout jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(p_layout) <> 'object' or p_layout is null
      or jsonb_typeof(p_options -> 'images') <> 'array' or p_options -> 'images' is null then p_options
    else jsonb_set(p_options, '{images}', (
      select coalesce(jsonb_agg(i || jsonb_build_object(
          'x', round(least(1 - m.w, greatest(0, m.x)), 4),
          'y', round(least(1 - m.h, greatest(0, m.y)), 4),
          'w', round(m.w, 4), 'h', round(m.h, 4)) order by o), '[]'::jsonb)
      from jsonb_array_elements(p_options -> 'images') with ordinality as e(i, o)
      cross join lateral (
        select ((i ->> 'x')::numeric * l.tw - l.ox) / l.dw as x0,
               ((i ->> 'y')::numeric * l.th - l.oy) / l.dh as y0,
               (i ->> 'w')::numeric * l.tw / l.dw as w0,
               (i ->> 'h')::numeric * l.th / l.dh as h0
        from (select (p_layout ->> 'tw')::numeric as tw, (p_layout ->> 'th')::numeric as th,
                     (p_layout ->> 'ox')::numeric as ox, (p_layout ->> 'oy')::numeric as oy,
                     (p_layout ->> 'dw')::numeric as dw, (p_layout ->> 'dh')::numeric as dh) l
      ) r
      cross join lateral (
        -- image plus grande que le cadre : réduite en gardant ses proportions
        select r.x0 as x, r.y0 as y,
               r.w0 * least(1, 1 / r.w0, 1 / r.h0) as w, r.h0 * least(1, 1 / r.w0, 1 / r.h0) as h
      ) m))
  end
$$;
revoke all on function private.images_unformat(jsonb, jsonb) from public, anon, authenticated;

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
                     then private.images_unformat(coalesce(s.options, '{}'::jsonb), s.original -> 'layout')
                          || jsonb_build_object('crop', s.original -> 'crop')
                     else private.images_unformat(coalesce(s.options, '{}'::jsonb), s.original -> 'layout') - 'crop' end,
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
