-- Paramètres › Notifications (retours client du 24/11 §6.3) : un réglage par événement, « dans l'app »
-- et « par e-mail ». Nouveau fichier, rien n'est retiré ; idempotent.
--  * prefs (dans l'app) : la clé « alert » devient réglable (les alertes d'Analytics consultaient déjà
--    notification_wanted(…, 'alert'), sans qu'on puisse l'enregistrer). La mention reste toujours envoyée.
--  * email_prefs : préférence e-mail par événement. L'option « email » reste l'accord de la personne
--    (désactivée par défaut) ; un événement absent de email_prefs suit cette option, ce qui garde le
--    comportement des comptes qui avaient déjà activé le résumé (ils recevaient tout).
--  * Le résumé horaire ne reprend que les événements voulus par e-mail (private.digest_due).
-- RLS inchangée : chacun ne lit et n'écrit que sa ligne (notification_settings_own).

create or replace function public.notification_prefs_valid(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and not exists (select 1 from jsonb_each(p) e
                    where e.key not in ('mention', 'reply', 'comment', 'resolved', 'alert')
                       or jsonb_typeof(e.value) <> 'boolean');
$$;

alter table public.notification_settings
  add column if not exists email_prefs jsonb not null default '{}'::jsonb;
alter table public.notification_settings drop constraint if exists notification_settings_email_prefs_check;
alter table public.notification_settings add constraint notification_settings_email_prefs_check
  check (public.notification_prefs_valid(email_prefs));

/** L'événement p_kind part-il dans le résumé e-mail de p_user ? (l'accord global est vérifié à part) */
create or replace function private.email_kind_wanted(p_user uuid, p_kind text)
returns boolean language sql stable set search_path = '' as $$
  select coalesce((select (s.email_prefs ->> p_kind)::boolean
                     from public.notification_settings s where s.user_id = p_user), true);
$$;
revoke all on function private.email_kind_wanted(uuid, text) from public, anon, authenticated;

/** Notifications à mettre dans le prochain résumé de p_user (non lues, pas encore envoyées, 30 jours). */
create or replace function private.digest_due(p_user uuid)
returns setof public.notifications language sql stable set search_path = '' as $$
  select n.* from public.notifications n
   where n.user_id = p_user and n.read_at is null and n.emailed_at is null
     and private.digest_kind(n.kind) and n.created_at > now() - interval '30 days'
     -- Réglage par événement : un événement coupé par e-mail reste dans l'app, sans partir au résumé
     and private.email_kind_wanted(p_user, n.kind)
     -- Accès perdu à l'espace : plus rien de cet espace (l'invitation, elle, vient d'un autre espace)
     and (n.kind = 'invite' or exists (select 1 from public.members m
                                        where m.workspace_id = n.workspace_id and m.user_id = p_user))
$$;
revoke all on function private.digest_due(uuid) from public, anon, authenticated;
