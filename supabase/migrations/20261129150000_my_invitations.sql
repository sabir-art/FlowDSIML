-- E-mails P1, arbitrage du chef (lien de l'e-mail valable 1 heure) : après ce délai, la personne ouvre
-- TutoClick, se connecte avec l'adresse invitée et doit retrouver son invitation. Un compte créé par
-- l'invitation n'a pas encore d'espace : la prise en main liste ses invitations en attente, avec Accepter
-- et Refuser (answer_invitation). Seulement celles de l'adresse du JWT ; jamais le jeton. Idempotent.

create or replace function public.my_invitations()
returns table (id uuid, workspace_name text, inviter_name text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, w.name, nullif(left(coalesce(p.full_name, ''), 80), ''), i.expires_at
    from public.invitations i
    join public.workspaces w on w.id = i.workspace_id
    left join public.profiles p on p.id = i.invited_by
   where i.email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
     and i.accepted_at is null and i.expires_at > now()
     and (select auth.uid()) is not null
   order by i.created_at desc
   limit 20;
$$;
revoke all on function public.my_invitations() from public, anon;
grant execute on function public.my_invitations() to authenticated;
