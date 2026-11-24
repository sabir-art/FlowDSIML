-- Retours client du 24/11 (2e série) §1 : « Afficher sur la page publique » depuis le menu d'une démo.
-- La page publique de l'espace (catalogue, 20261201190000) liste toutes les démos publiées à accès
-- ouvert, ou une liste choisie. Ces deux fonctions lisent et changent la place d'UNE démo dans cette
-- liste, sans repasser par l'écran des Paramètres. Rien d'autre ne change.

-- État d'une démo vis-à-vis de la page publique de son espace (membres de l'espace qui voient la démo).
--  enabled : la page publique est en ligne ; shown : la démo y figure ; canEdit : administrateur ;
--  reason : pourquoi la démo ne peut pas y figurer (unpublished, restricted) ou n'y est pas visible (off).
create or replace function public.public_page_demo(p_demo uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  d public.demos;
  c public.training_centers;
  v_open boolean;
  v_listed boolean;
begin
  select * into d from public.demos where id = p_demo and deleted_at is null;
  if d.id is null or not public.has_role(d.workspace_id, 'viewer') or not public.demo_visible(p_demo) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into c from public.training_centers where workspace_id = d.workspace_id;
  v_open := exists (select 1 from jsonb_array_elements(public.center_demos(d.workspace_id)) x
                    where x ->> 'demoId' = p_demo::text);
  v_listed := coalesce(jsonb_typeof(c.public_page -> 'demos'), '') <> 'array'
              or (c.public_page -> 'demos') ? p_demo::text;
  return jsonb_build_object(
    'enabled', coalesce(c.public_page_enabled, false),
    'shown', v_open and v_listed and coalesce(c.public_page_enabled, false),
    'listed', v_listed,
    'canEdit', public.has_role(d.workspace_id, 'admin'),
    'reason', case when d.status::text <> 'published' then 'unpublished'
                   when not v_open then 'restricted'
                   when not coalesce(c.public_page_enabled, false) then 'off' end);
end $$;
revoke all on function public.public_page_demo(uuid) from public, anon;
grant execute on function public.public_page_demo(uuid) to authenticated;

-- Ajoute ou retire une démo de la page publique de l'espace (administrateurs). Une démo n'y entre que
-- publiée et à accès ouvert. Page réglée sur « toutes les démos » : retirer une démo fait passer la
-- liste en « démos choisies » (toutes les autres, dans l'ordre affiché). 100 démos au plus.
create or replace function public.set_public_page_demo(p_demo uuid, p_shown boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d public.demos;
  c public.training_centers;
  v_all jsonb;
  v_list jsonb;
begin
  select * into d from public.demos where id = p_demo and deleted_at is null;
  if d.id is null or not public.has_role(d.workspace_id, 'admin') or not public.demo_visible(p_demo) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into c from public.training_centers where workspace_id = d.workspace_id for update;
  if c.workspace_id is null or not coalesce(c.public_page_enabled, false) then
    raise exception 'PAGE_OFF' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(x ->> 'demoId' order by o), '[]'::jsonb) into v_all
    from jsonb_array_elements(public.center_demos(d.workspace_id)) with ordinality as e(x, o);
  if p_shown and not v_all ? p_demo::text then
    raise exception 'DEMO_NOT_PUBLIC' using errcode = 'P0001';
  end if;
  if coalesce(jsonb_typeof(c.public_page -> 'demos'), '') = 'array' then
    v_list := c.public_page -> 'demos';
  elsif p_shown then
    return public.public_page_demo(p_demo); -- « toutes les démos » : elle y est déjà
  else
    v_list := v_all;
  end if;
  if p_shown then
    if not v_list ? p_demo::text then
      if jsonb_array_length(v_list) >= 100 then raise exception 'PAGE_FULL' using errcode = 'P0001'; end if;
      v_list := v_list || to_jsonb(p_demo::text);
    end if;
  else
    select coalesce(jsonb_agg(i order by o), '[]'::jsonb) into v_list
      from jsonb_array_elements(v_list) with ordinality as e(i, o) where i #>> '{}' <> p_demo::text;
  end if;
  update public.training_centers
     set public_page = coalesce(public_page, '{}'::jsonb) || jsonb_build_object('demos', v_list)
   where workspace_id = d.workspace_id;
  return public.public_page_demo(p_demo);
end $$;
revoke all on function public.set_public_page_demo(uuid, boolean) from public, anon;
grant execute on function public.set_public_page_demo(uuid, boolean) to authenticated;
