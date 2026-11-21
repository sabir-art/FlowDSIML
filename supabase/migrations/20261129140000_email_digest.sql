-- E-mails P2 (spec docs/ux/specs/emails-notifications-invitations.md §3) : résumé des notifications par
-- e-mail. Idempotent.
-- - Opt-in par personne (notification_settings.email, désactivé par défaut).
-- - Une tâche planifiée (15 min) appelle la fonction notify-email quand un résumé est dû : option active,
--   au moins une notification non lue et pas encore envoyée, dernier résumé il y a 60 min au moins.
-- - Chaque résumé prend une place dans le budget commun du jour (P1, 150 par jour) ; budget atteint :
--   le résumé attend la tâche suivante, rien n'est perdu.
-- - Désinscription sans connexion : jeton propre à la personne, à usage unique, valable 90 jours, rangé
--   haché (sha256) dans le schéma private.
-- Sans BREVO_API_KEY, notify-email ne fait rien et l'option reste « Bientôt » dans l'app.

create schema if not exists private;

alter table public.notification_settings add column if not exists email boolean not null default false;
alter table public.notifications add column if not exists emailed_at timestamptz;

-- Dernier résumé envoyé, hors de portée de l'utilisateur (le rythme d'une heure ne se contourne pas)
create table if not exists private.email_digest_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_at timestamptz not null
);
create table if not exists private.email_unsubscribe (
  token_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists email_unsubscribe_user_idx on private.email_unsubscribe (user_id);
revoke all on private.email_digest_state, private.email_unsubscribe from public, anon, authenticated;

-- Genres repris dans le résumé : ceux que la personne reçoit déjà dans l'app (spec §3.1) et l'invitation
create or replace function private.digest_kind(p_kind text) returns boolean language sql immutable as $$
  select p_kind in ('mention', 'reply', 'comment', 'resolved', 'alert', 'invite')
$$;

/** Notifications à mettre dans le prochain résumé de p_user (non lues, pas encore envoyées, 30 jours). */
create or replace function private.digest_due(p_user uuid)
returns setof public.notifications language sql stable as $$
  select n.* from public.notifications n
   where n.user_id = p_user and n.read_at is null and n.emailed_at is null
     and private.digest_kind(n.kind) and n.created_at > now() - interval '30 days'
     -- Accès perdu à l'espace : plus rien de cet espace (l'invitation, elle, vient d'un autre espace)
     and (n.kind = 'invite' or exists (select 1 from public.members m
                                        where m.workspace_id = n.workspace_id and m.user_id = p_user))
$$;

/** Y a-t-il un résumé dû ? (la tâche planifiée n'appelle la fonction que dans ce cas) */
create or replace function private.digest_pending() returns boolean language sql stable as $$
  select exists (
    select 1 from public.notification_settings s
      left join private.email_digest_state st on st.user_id = s.user_id
     where s.email and (st.last_at is null or st.last_at <= now() - interval '60 minutes')
       and exists (select 1 from private.digest_due(s.user_id)))
$$;

/**
 * Réserve les résumés dus (notify-email, service_role), au plus p_limit personnes. Pour chacune : une
 * place dans le budget du jour (sinon arrêt, la suite attend), les notifications marquées envoyées, un
 * jeton de désinscription. Renvoie les 10 lignes les plus récentes, le total, et de quoi annuler.
 * Aucun texte de commentaire : auteur, démo et étape seulement (spec §3.3).
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
    select s.user_id, au.email from public.notification_settings s
      join auth.users au on au.id = s.user_id
      left join private.email_digest_state st on st.user_id = s.user_id
     where s.email and coalesce(au.email, '') <> ''
       and (st.last_at is null or st.last_at <= now() - interval '60 minutes')
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
      'total', cardinality(ids), 'token', tok,
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

/** L'e-mail n'est pas parti : notifications, rythme et budget rendus (elles repartiront au résumé suivant). */
create or replace function public.digest_undo(p_user uuid, p_ids uuid[], p_previous timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.notifications set emailed_at = null where id = any (p_ids) and user_id = p_user;
  if p_previous is null then
    delete from private.email_digest_state where user_id = p_user;
  else
    update private.email_digest_state set last_at = p_previous where user_id = p_user;
  end if;
  perform public.email_budget_release();
end $$;

/**
 * « Ne plus recevoir ces e-mails » et List-Unsubscribe (sans connexion, via notify-email) : désactive
 * l'option. Jeton à usage unique : un second usage ne change rien et répond comme le premier ; inconnu
 * ou expiré : false.
 */
create or replace function public.email_unsubscribe(p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r private.email_unsubscribe;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then return false; end if;
  select * into r from private.email_unsubscribe
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and expires_at > now()
   for update;
  if r.token_hash is null then return false; end if;
  if r.used_at is null then
    update private.email_unsubscribe set used_at = now() where token_hash = r.token_hash;
    update public.notification_settings set email = false, updated_at = now() where user_id = r.user_id;
  end if;
  return true;
end $$;

/** Purge quotidienne des jetons expirés. */
create or replace function private.purge_email_unsubscribe() returns void language sql as $$
  delete from private.email_unsubscribe where expires_at < now() - interval '1 day';
$$;

/**
 * Tâche planifiée : appelle notify-email seulement si un résumé est dû. Même accès que les autres tâches
 * (Vault : adresse de webhooks-dispatch, dont on déduit celle de notify-email, et secret partagé).
 */
create or replace function public.email_digest_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  if not private.digest_pending() then return; end if;
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then
    raise notice 'résumés : Vault ou pg_net indisponible, envoi différé';
    return;
  end if;
  execute 'select (select decrypted_secret from vault.decrypted_secrets where name = $1),
                  (select decrypted_secret from vault.decrypted_secrets where name = $2)'
    into v_url, v_secret using 'webhooks_dispatch_url', 'webhooks_dispatch_secret';
  if v_url is null or v_secret is null then
    raise notice 'résumés : secret ou URL absents de Vault, envoi différé';
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
    using replace(v_url, '/webhooks-dispatch', '/notify-email'), '{"action":"run"}'::jsonb,
          jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json');
end $$;

revoke all on function public.digest_claim(int) from public, anon, authenticated;
revoke all on function public.digest_undo(uuid, uuid[], timestamptz) from public, anon, authenticated;
revoke all on function public.email_unsubscribe(text) from public, anon, authenticated;
revoke all on function public.email_digest_tick() from public, anon, authenticated;
grant execute on function public.digest_claim(int) to service_role;
grant execute on function public.digest_undo(uuid, uuid[], timestamptz) to service_role;
grant execute on function public.email_unsubscribe(text) to service_role;
revoke all on function private.digest_kind(text), private.digest_due(uuid), private.digest_pending(),
  private.purge_email_unsubscribe() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('fd_email_digest', '*/15 * * * *', 'select public.email_digest_tick()');
    perform cron.schedule('fd_email_unsubscribe_purge', '23 4 * * *', 'select private.purge_email_unsubscribe()');
  else
    raise notice 'pg_cron indisponible : résumés par e-mail non planifiés';
  end if;
end $$;
