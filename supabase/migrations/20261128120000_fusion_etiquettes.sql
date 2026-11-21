-- L52 P3 : fusion de deux étiquettes d'un même espace. Transactionnelle (une seule fonction).
--  * p_to est ajoutée à chaque démo de p_from qui ne l'a pas encore, puis p_from est supprimée ;
--  * le lien vers p_from est retiré avant d'ajouter p_to : une démo n'a jamais plus d'étiquettes
--    qu'avant (la limite de 5 de demo_tags_guard n'est pas franchie) ;
--  * les deux étiquettes sont du même espace ; l'appelant y a le rôle Éditeur ou plus.
-- Renvoie le nombre de démos qui portaient p_from (le compte du toast).

create or replace function public.merge_tags(p_from uuid, p_to uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_ws uuid;
  v_demos uuid[];
begin
  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'TAG_MERGE_SAME' using errcode = '22023';
  end if;
  select f.workspace_id into v_ws
    from public.tags f join public.tags t on t.id = p_to and t.workspace_id = f.workspace_id
   where f.id = p_from;
  if v_ws is null then raise exception 'TAG_WORKSPACE' using errcode = 'P0001'; end if;
  if not public.has_role(v_ws, 'editor') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select coalesce(array_agg(dt.demo_id), '{}'::uuid[]) into v_demos
    from public.demo_tags dt where dt.tag_id = p_from;
  delete from public.demo_tags where tag_id = p_from;
  insert into public.demo_tags (demo_id, tag_id, workspace_id)
  select d, p_to, v_ws from unnest(v_demos) d
   where not exists (select 1 from public.demo_tags x where x.demo_id = d and x.tag_id = p_to);
  delete from public.tags where id = p_from;
  return coalesce(array_length(v_demos, 1), 0);
end $$;

revoke all on function public.merge_tags(uuid, uuid) from public, anon;
grant execute on function public.merge_tags(uuid, uuid) to authenticated;
