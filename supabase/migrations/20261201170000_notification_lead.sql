-- Notification « Nouveau lead » (retours client du 24/11 §6.3, second lot). Nouveau fichier ; idempotent.
--  * Quand un visiteur laisse son adresse sur une démo, la personne qui a créé la démo est prévenue
--    dans l'app, et par e-mail si elle l'a demandé (résumé horaire).
--  * La notification ne porte que la démo : ni l'adresse du visiteur, ni ses réponses, ni l'identifiant
--    du lead. Le lien de l'app mène aux leads de la démo, lus sous la RLS de la table leads.
--  * Prévenue seulement si elle peut lire les leads (membre de l'espace, rôle editor ou plus) et voit
--    encore la démo (dossier restreint), si elle n'a coupé ni l'événement, ni cette démo.
--  * Une seule notification non lue par démo : un nouveau lead remplace la précédente non lue. Les
--    leads viennent de visiteurs anonymes ; la cloche ne doit pas pouvoir être remplie de l'extérieur.
--  * Réglages : la clé « lead » est acceptée dans prefs et email_prefs (RLS inchangée, chacun sa ligne).

create or replace function public.notification_prefs_valid(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and not exists (select 1 from jsonb_each(p) e
                    where e.key not in ('mention', 'reply', 'comment', 'resolved', 'alert', 'lead')
                       or jsonb_typeof(e.value) <> 'boolean');
$$;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('mention', 'comment', 'reply', 'resolved', 'alert', 'webhook_paused', 'invite', 'lead'));
alter table public.notifications drop constraint if exists notifications_kind_refs;
alter table public.notifications add constraint notifications_kind_refs check (case
  when kind = 'alert' then alert_id is not null and comment_id is null
  when kind in ('webhook_paused', 'invite') then alert_id is null and comment_id is null and demo_id is null and step_id is null
  -- Nouveau lead : la démo seule
  when kind = 'lead' then demo_id is not null and step_id is null and comment_id is null and alert_id is null
  else demo_id is not null and step_id is not null and alert_id is null end);

-- Le résumé par e-mail reprend l'événement (filtré ensuite par email_kind_wanted)
create or replace function private.digest_kind(p_kind text) returns boolean language sql immutable as $$
  select p_kind in ('mention', 'reply', 'comment', 'resolved', 'alert', 'invite', 'lead')
$$;
revoke all on function private.digest_kind(text) from public, anon, authenticated;

create or replace function private.notify_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  if new.demo_id is null then return new; end if;
  select d.created_by into v_user from public.demos d
   where d.id = new.demo_id and d.workspace_id = new.workspace_id;
  if v_user is null
     or not exists (select 1 from public.members m
                     where m.workspace_id = new.workspace_id and m.user_id = v_user and m.role >= 'editor')
     or not public.demo_visible_to(new.demo_id, v_user)
     or not public.notification_wanted(v_user, 'lead')
     or exists (select 1 from public.notification_mutes nm
                 where nm.user_id = v_user and nm.demo_id = new.demo_id) then
    return new;
  end if;
  delete from public.notifications n
   where n.user_id = v_user and n.kind = 'lead' and n.demo_id = new.demo_id and n.read_at is null;
  insert into public.notifications (workspace_id, user_id, kind, demo_id)
  values (new.workspace_id, v_user, 'lead', new.demo_id);
  return new;
exception when others then
  -- L'enregistrement du lead passe avant sa notification
  return new;
end $$;
revoke all on function private.notify_lead() from public, anon, authenticated;

drop trigger if exists leads_notify on public.leads;
create trigger leads_notify after insert on public.leads
  for each row execute function private.notify_lead();
