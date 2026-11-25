-- Retours client du 24/11 (2e série) §4 : résumé quotidien des notifications par e-mail, à 9 h.
-- Nouveau fichier, rien n'est retiré ; idempotent.
--  * notification_settings.email_frequency : « hourly » (au fil de l'eau, au plus un e-mail par heure,
--    comportement actuel et valeur par défaut) ou « daily » (un résumé par jour à 9 h).
--  * notification_settings.timezone : fuseau de la personne (celui de son navigateur, nom IANA). Absent ou
--    inconnu : Europe/Paris.
--  * Le résumé quotidien part à la première tâche planifiée à partir de 9 h, heure de la personne, une
--    fois par jour au plus ; il reprend les événements voulus par e-mail depuis le résumé précédent
--    (24 h au moins). Rien à envoyer : pas d'e-mail.
-- RLS inchangée : chacun ne lit et n'écrit que sa ligne (notification_settings_own). Le budget du jour,
-- la désinscription et l'annulation d'un envoi (digest_undo) ne changent pas.

alter table public.notification_settings
  add column if not exists email_frequency text not null default 'hourly',
  add column if not exists timezone text;
alter table public.notification_settings drop constraint if exists notification_settings_email_frequency_check;
alter table public.notification_settings add constraint notification_settings_email_frequency_check
  check (email_frequency in ('hourly', 'daily'));
alter table public.notification_settings drop constraint if exists notification_settings_timezone_check;
alter table public.notification_settings add constraint notification_settings_timezone_check
  check (timezone is null or (char_length(timezone) <= 64 and timezone ~ '^[A-Za-z0-9_+/-]+$'));

/** Fuseau utilisable : celui de la personne s'il existe, sinon Europe/Paris. */
create or replace function private.user_tz(p_tz text)
returns text language sql stable set search_path = '' as $$
  select coalesce((select z.name from pg_catalog.pg_timezone_names z where z.name = p_tz), 'Europe/Paris');
$$;

/**
 * Un résumé peut-il partir à p_now ? Au fil de l'eau : 60 min depuis le précédent. Quotidien : il est
 * 9 h passées chez la personne et aucun résumé n'est parti aujourd'hui (jour compté dans son fuseau).
 */
create or replace function private.digest_ready(p_frequency text, p_tz text, p_last timestamptz, p_now timestamptz)
returns boolean language sql stable set search_path = '' as $$
  select case
    when p_frequency = 'daily' then
      extract(hour from p_now at time zone private.user_tz(p_tz)) >= 9
      and (p_last is null
           or (p_last at time zone private.user_tz(p_tz))::date < (p_now at time zone private.user_tz(p_tz))::date)
    else p_last is null or p_last <= p_now - interval '60 minutes'
  end;
$$;

/**
 * Notifications à mettre dans le prochain résumé de p_user (non lues, pas encore envoyées, 30 jours).
 * Résumé quotidien : seulement depuis le résumé précédent, 24 h au moins.
 */
create or replace function private.digest_due(p_user uuid)
returns setof public.notifications language sql stable set search_path = '' as $$
  select n.* from public.notifications n
   where n.user_id = p_user and n.read_at is null and n.emailed_at is null
     and private.digest_kind(n.kind) and n.created_at > now() - interval '30 days'
     -- Réglage par événement : un événement coupé par e-mail reste dans l'app, sans partir au résumé
     and private.email_kind_wanted(p_user, n.kind)
     and (not exists (select 1 from public.notification_settings s
                       where s.user_id = p_user and s.email_frequency = 'daily')
          or n.created_at > least(now() - interval '24 hours',
                                  coalesce((select st.last_at from private.email_digest_state st
                                             where st.user_id = p_user), now() - interval '24 hours')))
     -- Accès perdu à l'espace : plus rien de cet espace (l'invitation, elle, vient d'un autre espace)
     and (n.kind = 'invite' or exists (select 1 from public.members m
                                        where m.workspace_id = n.workspace_id and m.user_id = p_user))
$$;

/** Y a-t-il un résumé dû ? (la tâche planifiée n'appelle la fonction que dans ce cas) */
create or replace function private.digest_pending() returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.notification_settings s
      left join private.email_digest_state st on st.user_id = s.user_id
     where s.email and private.digest_ready(s.email_frequency, s.timezone, st.last_at, now())
       and exists (select 1 from private.digest_due(s.user_id)))
$$;

/**
 * Réserve les résumés dus (notify-email, service_role), au plus p_limit personnes. Même contrat qu'avant
 * (budget du jour, notifications marquées envoyées, jeton de désinscription, 10 lignes les plus
 * récentes, aucun texte de commentaire) ; s'y ajoute « frequency », pour l'objet de l'e-mail.
 */
create or replace function public.digest_claim(p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u record;
  ids uuid[];
  prev timestamptz;
  tok text;
  res jsonb := '[]'::jsonb;
begin
  for u in
    select s.user_id, au.email, s.email_frequency from public.notification_settings s
      join auth.users au on au.id = s.user_id
      left join private.email_digest_state st on st.user_id = s.user_id
     where s.email and coalesce(au.email, '') <> ''
       and private.digest_ready(s.email_frequency, s.timezone, st.last_at, now())
       and exists (select 1 from private.digest_due(s.user_id))
     order by st.last_at nulls first
     limit least(greatest(coalesce(p_limit, 50), 1), 100)
     for update of s skip locked
  loop
    if not public.email_budget_take() then exit; end if;
    select array_agg(d.id) into ids from private.digest_due(u.user_id) d;
    select last_at into prev from private.email_digest_state where user_id = u.user_id;
    insert into private.email_digest_state (user_id, last_at) values (u.user_id, now())
      on conflict (user_id) do update set last_at = excluded.last_at;
    update public.notifications set emailed_at = now() where id = any (ids);
    tok := encode(extensions.gen_random_bytes(24), 'hex');
    insert into private.email_unsubscribe (token_hash, user_id, expires_at)
      values (encode(extensions.digest(tok, 'sha256'), 'hex'), u.user_id, now() + interval '90 days');
    res := res || jsonb_build_object(
      'user', u.user_id, 'email', u.email, 'ids', to_jsonb(ids), 'previous', prev,
      'total', cardinality(ids), 'token', tok, 'frequency', u.email_frequency,
      'lines', (select coalesce(jsonb_agg(l order by l.at desc), '[]'::jsonb) from (
        select n.created_at as at, n.kind,
               coalesce(nullif(p.full_name, ''), '') as actor,
               coalesce(dm.title, '') as demo,
               st.position + 1 as step,
               n.data
          from public.notifications n
          left join public.profiles p on p.id = n.actor_id
          left join public.demos dm on dm.id = n.demo_id
          left join public.steps st on st.id = n.step_id
         where n.id = any (ids)
         order by n.created_at desc limit 10) l));
  end loop;
  return res;
end $$;

revoke all on function public.digest_claim(int) from public, anon, authenticated;
grant execute on function public.digest_claim(int) to service_role;
revoke all on function private.user_tz(text), private.digest_ready(text, text, timestamptz, timestamptz),
  private.digest_due(uuid), private.digest_pending() from public, anon, authenticated;
