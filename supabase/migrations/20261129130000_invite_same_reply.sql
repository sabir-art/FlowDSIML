-- E-mails P1, confidentialité (demande du chef) : l'admin ne doit pas pouvoir savoir si une adresse a
-- déjà un compte. Le compte existant (notification dans l'app) suit donc le même chemin que l'e-mail :
-- même plafond horaire, même prise sur le budget du jour (« n sur 150 » avance pareil), même refus
-- quand le budget est épuisé. invite-email répond « sent » dans les deux cas. Idempotent.

create or replace function public.invite_send_reserve(p_invitation uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations;
  ws public.workspaces;
  account uuid;
  inviter text;
begin
  select * into inv from public.invitations where id = p_invitation;
  if inv.id is null or inv.accepted_at is not null or inv.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not exists (select 1 from public.members where workspace_id = inv.workspace_id and user_id = p_user
                   and role in ('owner', 'admin')) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  select * into ws from public.workspaces where id = inv.workspace_id for update;
  -- Relu sous le verrou : deux envois simultanés de la même invitation n'en font qu'un
  select * into inv from public.invitations where id = p_invitation;
  if inv.sent_at is not null then return jsonb_build_object('ok', false, 'reason', 'sent'); end if;
  if (select count(*) from public.invitations where workspace_id = inv.workspace_id
        and sent_at > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limit');
  end if;
  -- Avant de savoir s'il y a un compte : le budget ne révèle rien
  if not public.email_budget_take() then return jsonb_build_object('ok', false, 'reason', 'budget'); end if;
  update public.invitations set sent_at = now() where id = inv.id;
  -- Nom affiché seulement : jamais l'adresse de l'invitant
  inviter := nullif(left(coalesce((select full_name from public.profiles where id = p_user), ''), 80), '');
  -- Compte déjà utilisé (connexion ou mot de passe) : Supabase Auth ne lui enverrait pas d'invitation
  select u.id into account from auth.users u
   where lower(u.email) = inv.email and (u.last_sign_in_at is not null or coalesce(u.encrypted_password, '') <> '')
   limit 1;
  if account is not null then
    insert into public.notifications (workspace_id, user_id, kind, actor_id, data)
    values (inv.workspace_id, account, 'invite', p_user,
            jsonb_build_object('invitation', inv.id, 'workspace', left(ws.name, 80), 'actor', inviter));
    return jsonb_build_object('ok', true, 'mode', 'notify');
  end if;
  return jsonb_build_object('ok', true, 'mode', 'email', 'email', inv.email, 'token', inv.token,
                            'workspace_name', left(ws.name, 80), 'inviter_name', inviter);
end $$;
revoke all on function public.invite_send_reserve(uuid, uuid) from public, anon, authenticated;
grant execute on function public.invite_send_reserve(uuid, uuid) to service_role;
