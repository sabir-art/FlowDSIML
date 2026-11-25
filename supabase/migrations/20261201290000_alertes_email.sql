-- ALERT-01 (docs/ux/specs/alertes-canaux.md) : canal « E-mail » des alertes analytics. Nouveau fichier,
-- rien n'est retiré ; idempotent.
--  * alerts.channels accepte « email », toujours avec « app » (l'alerte reste visible dans l'app).
--  * Une alerte avec « email » pose sa notification marquée email_forced : elle part au résumé par
--    e-mail de sa créatrice même si elle n'a pas activé le résumé général, au plus un e-mail par heure,
--    dans le budget commun du jour. Destinataire : l'adresse du compte, jamais une adresse libre.
--  * Le résumé général (au fil de l'eau ou quotidien à 9 h) garde son propre rythme : un envoi dû aux
--    seules alertes ne décale pas le résumé quotidien.
--  * « Ne plus recevoir ces e-mails » retire aussi « email » des alertes de la personne ; l'app le lui
--    dit une fois (notification_settings.alert_email_cleared_at).
-- RLS inchangée : alerts (membres de l'espace, écriture par la créatrice ou un admin),
-- notification_settings (chacun sa ligne), notifications (email_forced n'est écrit que par le serveur).

alter table public.alerts drop constraint if exists alerts_channels_check;
alter table public.alerts add constraint alerts_channels_check check (
  cardinality(channels) between 1 and 3
  and channels <@ array['app', 'webhook', 'email']
  and (not ('email' = any (channels)) or 'app' = any (channels))
);

alter table public.notifications add column if not exists email_forced boolean not null default false;
alter table public.notification_settings add column if not exists alert_email_cleared_at timestamptz;
alter table private.email_digest_state add column if not exists forced_at timestamptz;
create index if not exists notifications_email_forced_idx on public.notifications (user_id)
  where email_forced and emailed_at is null and read_at is null;

/** Déclenchement : notification dans l'app (toujours quand « email » est choisi), webhook. */
create or replace function private.alert_fire(a public.alerts, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_mail boolean := 'email' = any (a.channels);
begin
  if v_mail or ('app' = any (a.channels) and public.notification_wanted(a.created_by, 'alert')) then
    insert into public.notifications (workspace_id, user_id, kind, demo_id, alert_id, data, email_forced)
    values (a.workspace_id, a.created_by, 'alert', a.demo_id, a.id, p_data, v_mail);
  end if;
  if 'webhook' = any (a.channels) then
    perform public.enqueue_webhook_event(a.workspace_id, 'alert.triggered',
      p_data || jsonb_build_object('alert_id', a.id, 'demo_id', a.demo_id, 'frequency', a.frequency, 'at', now()));
  end if;
end $$;
revoke all on function private.alert_fire(public.alerts, jsonb) from public, anon, authenticated;

/** Le résumé général de p_user peut-il partir maintenant ? (option active et rythme atteint) */
create or replace function private.digest_regular_ready(p_user uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.notification_settings s
      left join private.email_digest_state st on st.user_id = s.user_id
     where s.user_id = p_user and s.email
       and private.digest_ready(s.email_frequency, s.timezone, st.last_at, now()));
$$;

/** Un e-mail d'alerte peut-il partir maintenant ? Au plus un e-mail par heure, tous envois confondus. */
create or replace function private.digest_forced_ready(p_user uuid)
returns boolean language sql stable set search_path = '' as $$
  select coalesce((select greatest(st.last_at, st.forced_at) <= now() - interval '60 minutes'
                     from private.email_digest_state st where st.user_id = p_user), true);
$$;

/**
 * Notifications à mettre dans le prochain e-mail de p_user (non lues, pas encore envoyées, 30 jours) :
 *  - celles du résumé général, s'il est dû (option, réglage par événement, fenêtre du quotidien) ;
 *  - les alertes dont le canal « E-mail » est choisi, dès que le rythme d'une heure le permet.
 */
create or replace function private.digest_due(p_user uuid)
returns setof public.notifications language sql stable set search_path = '' as $$
  select n.* from public.notifications n
   where n.user_id = p_user and n.read_at is null and n.emailed_at is null
     and private.digest_kind(n.kind) and n.created_at > now() - interval '30 days'
     and (
       (n.email_forced and private.digest_forced_ready(p_user))
       or (private.digest_regular_ready(p_user)
           -- Réglage par événement : un événement coupé par e-mail reste dans l'app, sans partir au résumé
           and private.email_kind_wanted(p_user, n.kind)
           and (not exists (select 1 from public.notification_settings s
                             where s.user_id = p_user and s.email_frequency = 'daily')
                or n.created_at > least(now() - interval '24 hours',
                                        coalesce((select st.last_at from private.email_digest_state st
                                                   where st.user_id = p_user), now() - interval '24 hours'))))
     )
     -- Accès perdu à l'espace : plus rien de cet espace (l'invitation, elle, vient d'un autre espace)
     and (n.kind = 'invite' or exists (select 1 from public.members m
                                        where m.workspace_id = n.workspace_id and m.user_id = p_user))
$$;

/** Personnes qui peuvent avoir un e-mail dû : option du résumé active, ou alerte par e-mail en attente. */
create or replace function private.digest_candidates()
returns table (user_id uuid) language sql stable set search_path = '' as $$
  select s.user_id from public.notification_settings s where s.email
  union
  select n.user_id from public.notifications n
   where n.email_forced and n.emailed_at is null and n.read_at is null
     and n.created_at > now() - interval '30 days';
$$;

/** Y a-t-il un e-mail dû ? (la tâche planifiée n'appelle la fonction que dans ce cas) */
create or replace function private.digest_pending() returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from private.digest_candidates() c
                  where exists (select 1 from private.digest_due(c.user_id)));
$$;

/**
 * Réserve les e-mails dus (notify-email, service_role), au plus p_limit personnes. Même contrat qu'avant
 * (budget du jour, notifications marquées envoyées, jeton de désinscription, 10 lignes les plus
 * récentes, aucun texte de commentaire, « frequency » pour l'objet). Un envoi dû aux seules alertes
 * note forced_at et laisse last_at : le résumé général garde son rythme.
 */
create or replace function public.digest_claim(p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u record;
  ids uuid[];
  prev timestamptz;
  tok text;
  v_regular boolean;
  res jsonb := '[]'::jsonb;
begin
  for u in
    select c.user_id, au.email, coalesce(s.email_frequency, 'hourly') as email_frequency
      from private.digest_candidates() c
      join auth.users au on au.id = c.user_id
      left join public.notification_settings s on s.user_id = c.user_id
      left join private.email_digest_state st on st.user_id = c.user_id
     where coalesce(au.email, '') <> ''
       and exists (select 1 from private.digest_due(c.user_id))
     order by st.last_at nulls first
     limit least(greatest(coalesce(p_limit, 50), 1), 100)
  loop
    -- Deux tâches en même temps : une seule réserve la personne
    if not pg_try_advisory_xact_lock(hashtextextended('fd.digest.' || u.user_id::text, 0)) then continue; end if;
    select array_agg(d.id) into ids from private.digest_due(u.user_id) d;
    if ids is null then continue; end if;
    if not public.email_budget_take() then exit; end if;
    v_regular := private.digest_regular_ready(u.user_id);
    select last_at into prev from private.email_digest_state where user_id = u.user_id;
    if v_regular then
      insert into private.email_digest_state (user_id, last_at) values (u.user_id, now())
        on conflict (user_id) do update set last_at = excluded.last_at;
    else
      -- Alertes seules : last_at est créé ancien (jamais de résumé général) ou laissé tel quel
      insert into private.email_digest_state (user_id, last_at, forced_at)
        values (u.user_id, '-infinity', now())
        on conflict (user_id) do update set forced_at = excluded.forced_at;
    end if;
    update public.notifications set emailed_at = now() where id = any (ids);
    tok := encode(extensions.gen_random_bytes(24), 'hex');
    insert into private.email_unsubscribe (token_hash, user_id, expires_at)
      values (encode(extensions.digest(tok, 'sha256'), 'hex'), u.user_id, now() + interval '90 days');
    res := res || jsonb_build_object(
      'user', u.user_id, 'email', u.email, 'ids', to_jsonb(ids), 'previous', prev,
      'total', cardinality(ids), 'token', tok,
      'frequency', case when v_regular then u.email_frequency else 'hourly' end,
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

/** L'e-mail n'est pas parti : notifications, rythme et budget rendus (elles repartiront à l'envoi suivant). */
create or replace function public.digest_undo(p_user uuid, p_ids uuid[], p_previous timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.notifications set emailed_at = null where id = any (p_ids) and user_id = p_user;
  if p_previous is null then
    delete from private.email_digest_state where user_id = p_user;
  else
    update private.email_digest_state set last_at = p_previous, forced_at = null where user_id = p_user;
  end if;
  perform public.email_budget_release();
end $$;

/**
 * « Ne plus recevoir ces e-mails » et List-Unsubscribe (sans connexion, via notify-email) : désactive le
 * résumé et retire « email » des alertes de la personne. Jeton à usage unique : un second usage ne
 * change rien et répond comme le premier ; inconnu ou expiré : false.
 */
create or replace function public.email_unsubscribe(p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  r private.email_unsubscribe;
  v_alerts int;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then return false; end if;
  select * into r from private.email_unsubscribe
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and expires_at > now()
   for update;
  if r.token_hash is null then return false; end if;
  if r.used_at is null then
    update private.email_unsubscribe set used_at = now() where token_hash = r.token_hash;
    update public.notification_settings set email = false, updated_at = now() where user_id = r.user_id;
    update public.alerts set channels = array_remove(channels, 'email'), updated_at = now()
     where created_by = r.user_id and 'email' = any (channels);
    get diagnostics v_alerts = row_count;
    -- Les alertes déjà déclenchées ne partent plus
    update public.notifications set email_forced = false
     where user_id = r.user_id and email_forced and emailed_at is null;
    if v_alerts > 0 then
      insert into public.notification_settings (user_id, alert_email_cleared_at) values (r.user_id, now())
        on conflict (user_id) do update set alert_email_cleared_at = excluded.alert_email_cleared_at;
    end if;
  end if;
  return true;
end $$;

revoke all on function public.digest_claim(int) from public, anon, authenticated;
revoke all on function public.digest_undo(uuid, uuid[], timestamptz) from public, anon, authenticated;
revoke all on function public.email_unsubscribe(text) from public, anon, authenticated;
grant execute on function public.digest_claim(int) to service_role;
grant execute on function public.digest_undo(uuid, uuid[], timestamptz) to service_role;
grant execute on function public.email_unsubscribe(text) to service_role;
revoke all on function private.digest_regular_ready(uuid), private.digest_forced_ready(uuid),
  private.digest_due(uuid), private.digest_candidates(), private.digest_pending()
  from public, anon, authenticated;
