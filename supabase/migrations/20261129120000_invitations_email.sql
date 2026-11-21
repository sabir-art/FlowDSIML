-- E-mails P1 (spec docs/ux/specs/emails-notifications-invitations.md §2 et §4) : invitations d'équipe
-- par e-mail. Idempotent.
-- - Budget d'envoi commun de l'app : 150 e-mails par jour (heure de Paris), le reste du quota Brevo
--   restant à l'authentification. Compteur dans le schéma private, jamais exposé.
-- - Au plus 20 invitations envoyées par heure et par espace (e-mail ou notification dans l'app).
-- - Compte existant : pas d'e-mail, une notification « invite » dans l'app avec Accepter et Refuser.
-- L'envoi lui-même est fait par la fonction invite-email (service_role) ; les fonctions d'envoi ne
-- sont exécutables que par service_role.

create schema if not exists private;

-- ===== Budget journalier commun =====
create table if not exists private.email_budget (
  day date primary key,
  sent int not null default 0 check (sent >= 0)
);
revoke all on private.email_budget from public, anon, authenticated;

create or replace function private.email_day() returns date language sql stable as $$
  select (now() at time zone 'Europe/Paris')::date
$$;

/** Réserve un envoi dans le budget du jour ; false si les 150 sont atteints. */
create or replace function public.email_budget_take()
returns boolean language plpgsql security definer set search_path = '' as $$
declare ok boolean;
begin
  insert into private.email_budget (day) values (private.email_day()) on conflict (day) do nothing;
  update private.email_budget set sent = sent + 1
   where day = private.email_day() and sent < 150
  returning true into ok;
  return coalesce(ok, false);
end $$;

/** Rend un envoi réservé qui n'est pas parti (échec du fournisseur). */
create or replace function public.email_budget_release()
returns void language sql security definer set search_path = '' as $$
  update private.email_budget set sent = greatest(sent - 1, 0) where day = private.email_day();
$$;

/** Ligne « E-mails envoyés aujourd'hui : n sur 150 » (Paramètres › Utilisation), admins seulement. */
create or replace function public.email_budget_today(p_workspace uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_workspace, 'admin') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return jsonb_build_object('sent', coalesce((select sent from private.email_budget where day = private.email_day()), 0),
                            'cap', 150);
end $$;

-- ===== Invitations envoyées =====
-- sent_at : envoi par e-mail ou notification dans l'app (compte pour le plafond horaire).
alter table public.invitations add column if not exists sent_at timestamptz;
create index if not exists invitations_sent_idx on public.invitations (workspace_id, sent_at)
  where sent_at is not null;

/** Plafond horaire de l'espace : envois restants dans l'heure glissante et heure de la prochaine place. */
create or replace function public.invite_quota(p_workspace uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare n int; first_at timestamptz;
begin
  if not public.has_role(p_workspace, 'admin') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  select count(*), min(sent_at) into n, first_at from public.invitations
   where workspace_id = p_workspace and sent_at > now() - interval '1 hour';
  return jsonb_build_object('left', greatest(20 - n, 0),
                            'next_at', case when n >= 20 then first_at + interval '1 hour' end);
end $$;

-- ===== Notification « invite » =====
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('mention', 'comment', 'reply', 'resolved', 'alert', 'webhook_paused', 'invite'));
alter table public.notifications drop constraint if exists notifications_kind_refs;
alter table public.notifications add constraint notifications_kind_refs check (case
  when kind = 'alert' then alert_id is not null and comment_id is null
  -- Webhook en pause et invitation : ni démo, ni étape, ni commentaire ; le reste est dans data
  when kind in ('webhook_paused', 'invite') then alert_id is null and comment_id is null and demo_id is null and step_id is null
  else demo_id is not null and step_id is not null and alert_id is null end);

-- La personne invitée n'est pas encore membre de l'espace : elle lit ses invitations sans ce rôle.
drop policy if exists notifications_select_invite on public.notifications;
create policy notifications_select_invite on public.notifications for select to authenticated
  using (kind = 'invite' and user_id = (select auth.uid()));

/**
 * Réservation d'un envoi par invite-email (service_role), pour l'invitation p_invitation créée par
 * l'admin p_user. Sérialisée par espace. Réponses :
 * - {ok, mode: 'email', email, token, workspace_name, inviter_name} : budget pris, e-mail à envoyer ;
 * - {ok, mode: 'notify'} : compte déjà utilisé, notification posée dans l'app (aucun e-mail) ;
 * - {ok: false, reason: forbidden | not_found | sent | rate_limit | budget}.
 */
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
    update public.invitations set sent_at = now() where id = inv.id;
    return jsonb_build_object('ok', true, 'mode', 'notify');
  end if;
  if not public.email_budget_take() then return jsonb_build_object('ok', false, 'reason', 'budget'); end if;
  update public.invitations set sent_at = now() where id = inv.id;
  return jsonb_build_object('ok', true, 'mode', 'email', 'email', inv.email, 'token', inv.token,
                            'workspace_name', left(ws.name, 80), 'inviter_name', inviter);
end $$;

/** L'e-mail réservé n'est pas parti : l'envoi est rendu au budget et au plafond horaire. */
create or replace function public.invite_send_undo(p_invitation uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.invitations set sent_at = null where id = p_invitation and sent_at is not null;
  if found then perform public.email_budget_release(); end if;
end $$;

/**
 * Accepter ou Refuser depuis la notification « invite » (personne invitée, connectée avec l'adresse
 * invitée). Accepter : comme le lien (accept_invitation). Refuser : l'invitation est supprimée.
 * Dans les deux cas la notification est marquée lue avec la réponse. Renvoie l'espace rejoint.
 */
create or replace function public.answer_invitation(p_invitation uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  my_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  inv public.invitations;
  ws uuid;
begin
  if uid is null then raise exception 'Non authentifié' using errcode = '42501'; end if;
  select * into inv from public.invitations where id = p_invitation;
  if inv.id is null then raise exception 'INVITATION_NOT_FOUND'; end if;
  if inv.email <> my_email then raise exception 'INVITATION_EMAIL_MISMATCH'; end if;
  if p_accept then
    ws := public.accept_invitation(inv.token);
  else
    if inv.accepted_at is not null then raise exception 'INVITATION_ALREADY_USED'; end if;
    delete from public.invitations where id = inv.id;
  end if;
  update public.notifications
     set read_at = coalesce(read_at, now()),
         data = data || jsonb_build_object('answer', case when p_accept then 'accepted' else 'declined' end)
   where user_id = uid and kind = 'invite' and data ->> 'invitation' = p_invitation::text;
  return ws;
end $$;

revoke all on function public.email_budget_take() from public, anon, authenticated;
revoke all on function public.email_budget_release() from public, anon, authenticated;
revoke all on function public.invite_send_reserve(uuid, uuid) from public, anon, authenticated;
revoke all on function public.invite_send_undo(uuid) from public, anon, authenticated;
grant execute on function public.email_budget_take() to service_role;
grant execute on function public.email_budget_release() to service_role;
grant execute on function public.invite_send_reserve(uuid, uuid) to service_role;
grant execute on function public.invite_send_undo(uuid) to service_role;
revoke all on function public.email_budget_today(uuid) from public, anon;
revoke all on function public.invite_quota(uuid) from public, anon;
revoke all on function public.answer_invitation(uuid, boolean) from public, anon;
grant execute on function public.email_budget_today(uuid) to authenticated;
grant execute on function public.invite_quota(uuid) to authenticated;
grant execute on function public.answer_invitation(uuid, boolean) to authenticated;
revoke all on function private.email_day() from public, anon, authenticated;
