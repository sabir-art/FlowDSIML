-- Invitations d'équipe, retour du client (25/11). Idempotent.
-- Une invitation refaite pour une adresse déjà invitée n'envoyait plus d'e-mail :
-- - un compte créé par une première invitation, jamais confirmé, est traité comme une nouvelle
--   adresse (seul un compte CONFIRMÉ compte comme compte existant) ;
-- - un compte existant reçoit la notification dans l'app ET un e-mail : invite_send_reserve rend donc
--   aussi, en mode « notify », de quoi écrire cet e-mail. La fonction invite-email (service_role,
--   seule à pouvoir appeler invite_send_reserve) répond toujours la même chose à l'admin.

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
  -- Compte existant : adresse confirmée (ou déjà connectée). Un compte né d'une invitation jamais
  -- ouverte, ou d'une inscription jamais confirmée, ne peut pas lire une notification.
  select u.id into account from auth.users u
   where lower(u.email) = inv.email and (u.email_confirmed_at is not null or u.last_sign_in_at is not null)
   limit 1;
  if account is not null then
    insert into public.notifications (workspace_id, user_id, kind, actor_id, data)
    values (inv.workspace_id, account, 'invite', p_user,
            jsonb_build_object('invitation', inv.id, 'workspace', left(ws.name, 80), 'actor', inviter));
  end if;
  return jsonb_build_object('ok', true, 'mode', case when account is null then 'email' else 'notify' end,
                            'email', inv.email, 'token', inv.token,
                            'workspace_name', left(ws.name, 80), 'inviter_name', inviter);
end $$;
revoke all on function public.invite_send_reserve(uuid, uuid) from public, anon, authenticated;
grant execute on function public.invite_send_reserve(uuid, uuid) to service_role;
