-- L41 étape 5 (docs/tech/ia-fournisseurs.md §7, spec UX §5) : modèles de l'assistant gardés par l'espace.
--  * workspaces.settings.ai.models : liste des modèles cochés par l'espace ; absente = tous les modèles
--    proposés par la Console. Une fois enregistrée, elle est explicite : un modèle que TutoClick ajoute
--    ensuite arrive décoché.
--  * Écriture par les propriétaires seulement. Retrait seulement : tout modèle non proposé par la Console
--    est refusé (NOT_PROPOSED) ; au moins un modèle (LAST_MODEL). Auto reste toujours proposé.
--  * Lecture et filtre du menu : Edge Function `ai` (action assistant_models), seule à connaître les clés.

create or replace function public.set_ai_models(p_ws uuid, p_models text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_list text[];
begin
  if not public.has_role(p_ws, 'owner') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct m), '{}') into v_list from unnest(coalesce(p_models, '{}')) m where m is not null;
  if cardinality(v_list) = 0 then raise exception 'LAST_MODEL' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(v_list) m
              where not exists (select 1 from public.ai_assistant_models a where a.model = m and a.proposed)) then
    raise exception 'NOT_PROPOSED' using errcode = 'P0001';
  end if;
  -- Ordre de la Console
  select array_agg(a.model order by a.position) into v_list
    from public.ai_assistant_models a where a.model = any (v_list);
  perform set_config('fd.ai_set', '1', true);
  update public.workspaces
     set settings = settings || jsonb_build_object('ai',
           coalesce(settings -> 'ai', '{}'::jsonb) || jsonb_build_object('models', to_jsonb(v_list))),
         updated_at = now()
   where id = p_ws;
  perform set_config('fd.ai_set', '0', true);
  return jsonb_build_object('models', to_jsonb(v_list));
end $$;
revoke all on function public.set_ai_models(uuid, text[]) from public, anon;
grant execute on function public.set_ai_models(uuid, text[]) to authenticated;
