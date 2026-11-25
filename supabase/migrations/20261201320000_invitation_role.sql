-- Invitations d'équipe, retour du client (25/11). Idempotent.
-- Le rôle d'une invitation en attente se change (set_invitation_role) : admin de l'espace seulement,
-- jamais « owner », et une invitation « owner » ne se modifie que par un propriétaire. Pas de politique
-- UPDATE sur public.invitations : seul le rôle change, et seulement par cette fonction.

/** Change le rôle d'une invitation en attente (Paramètres › Équipe, menu de l'invitation). */
create or replace function public.set_invitation_role(p_invitation uuid, p_role public.workspace_role)
returns void language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations;
begin
  if (select auth.uid()) is null then raise exception 'Non authentifié' using errcode = '42501'; end if;
  select * into inv from public.invitations where id = p_invitation for update;
  -- Même refus pour une invitation inconnue et pour celle d'un autre espace : rien n'est révélé
  if inv.id is null or not public.has_role(inv.workspace_id, 'admin') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if inv.accepted_at is not null then raise exception 'INVITATION_ALREADY_USED'; end if;
  -- Propriétaire : jamais par ce chemin (transfert de propriété à part)
  if p_role is null or p_role = 'owner' then raise exception 'INVITATION_ROLE_FORBIDDEN'; end if;
  if inv.role = 'owner' and not public.has_role(inv.workspace_id, 'owner') then
    raise exception 'INVITATION_ROLE_FORBIDDEN';
  end if;
  update public.invitations set role = p_role where id = inv.id;
end $$;
revoke all on function public.set_invitation_role(uuid, public.workspace_role) from public, anon;
grant execute on function public.set_invitation_role(uuid, public.workspace_role) to authenticated;
