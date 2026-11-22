-- Résoudre ou rouvrir un commentaire : le filtre de dossier restreint s'applique (même réponse que pour un
-- commentaire inconnu). Définition identique à la précédente, sauf ce contrôle.
create or replace function public.set_comment_resolved(p_comment uuid, p_resolved boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.step_comments;
begin
  select * into c from public.step_comments where id = p_comment;
  if c.id is null or not public.demo_visible(c.demo_id) then raise exception 'COMMENT_NOT_FOUND'; end if;
  if not (public.has_role(c.workspace_id, 'editor')
          or (c.author_id = (select auth.uid()) and public.has_role(c.workspace_id, 'viewer'))) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  update public.step_comments
    set resolved_at = case when p_resolved then now() end,
        resolved_by = case when p_resolved then (select auth.uid()) end
    where id = p_comment;
end $$;
revoke all on function public.set_comment_resolved(uuid, boolean) from public, anon;
grant execute on function public.set_comment_resolved(uuid, boolean) to authenticated;
