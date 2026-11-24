-- Prise en main (L26-01) : l'étape « Inviter un membre de l'équipe » se coche dès qu'une invitation est
-- envoyée, sans attendre qu'elle soit acceptée (retour client du 24/11 : deux invitations envoyées,
-- étape toujours à faire).
-- workspace_onboarding redéfinie à l'identique de 20261122090000_marque_regles.sql, sauf « invite ».
-- Lecture seule de public.invitations depuis une fonction security definer (search_path vide), réservée
-- aux éditeurs de l'espace par has_role : aucune ligne d'invitation n'est renvoyée, seulement un booléen.
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
    -- Une invitation envoyée suffit (en attente, acceptée ou expirée) : l'étape n'attend pas l'acceptation
    'invite', (select count(*) from public.members m where m.workspace_id = p_ws) >= 2
              or exists (select 1 from public.invitations i where i.workspace_id = p_ws),
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
