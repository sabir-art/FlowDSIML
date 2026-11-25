-- Tests pgTAP : résumé quotidien des notifications à 9 h (retours du 24/11, 2e série §4). Fréquence et
-- fuseau par personne, 9 h dans SON fuseau, une fois par jour, rien à envoyer : pas d'e-mail, RLS.
-- Les heures sont ancrées sur date_trunc('day', now()) plus une heure fixe : aucun résultat ne dépend de
-- l'heure du lancement.
begin;
set search_path = public, extensions;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000326a1', 'olga-rq@acme.example'),
  ('00000000-0000-0000-0000-0000000326a2', 'camille-rq@acme.example');
insert into public.profiles (id, full_name) values ('00000000-0000-0000-0000-0000000326a2', 'Camille Exemple')
  on conflict (id) do update set full_name = excluded.full_name;
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
-- Minuit UTC du jour, base de toutes les heures du test
create function pg_temp.at(p_hours numeric) returns timestamptz language sql stable as $$
  select (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') + make_interval(secs => p_hours * 3600);
$$;

-- ===== Réglages : valeurs par défaut, contraintes, RLS =====
select pg_temp.login('00000000-0000-0000-0000-0000000326a1');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000326d1', (select ws from ctx), 'Créer un rendez-vous', auth.uid());
insert into public.steps (id, demo_id, workspace_id, position, title) values
  ('00000000-0000-0000-0000-0000000326e1', '00000000-0000-0000-0000-0000000326d1', (select ws from ctx), 0, 'Étape 1');
insert into public.notification_settings (user_id, email) values (auth.uid(), true);
select is((select email_frequency from public.notification_settings where user_id = auth.uid()), 'hourly',
  'fréquence par défaut : au fil de l’eau (comportement inchangé)');
select is((select timezone from public.notification_settings where user_id = auth.uid()), null,
  'fuseau absent par défaut');
update public.notification_settings set email_frequency = 'daily', timezone = 'America/Montreal'
 where user_id = auth.uid();
select is((select email_frequency || ' ' || timezone from public.notification_settings where user_id = auth.uid()),
  'daily America/Montreal', 'la personne choisit le résumé quotidien et son fuseau');
select throws_ok($$ update public.notification_settings set email_frequency = 'weekly' where user_id = auth.uid() $$,
  '23514', null, 'fréquence inconnue refusée');
select throws_ok($$ update public.notification_settings set timezone = 'Europe/Paris; drop' where user_id = auth.uid() $$,
  '23514', null, 'fuseau mal formé refusé');
select throws_ok($$ select private.digest_ready('daily', 'UTC', null, now()) $$, '42501', null,
  'fonctions internes hors de portée des comptes');

-- Une autre personne ne lit ni ne change ce réglage
select pg_temp.login('00000000-0000-0000-0000-0000000326a2');
select is((select count(*)::int from public.notification_settings
            where user_id = '00000000-0000-0000-0000-0000000326a1'), 0, 'RLS : réglage d’autrui illisible');
update public.notification_settings set email_frequency = 'hourly'
 where user_id = '00000000-0000-0000-0000-0000000326a1';
reset role;
select is((select email_frequency from public.notification_settings
            where user_id = '00000000-0000-0000-0000-0000000326a1'), 'daily', 'RLS : réglage d’autrui non modifiable');

-- ===== Fuseau =====
select is(private.user_tz('America/Montreal'), 'America/Montreal', 'fuseau connu gardé');
select is(private.user_tz(null), 'Europe/Paris', 'fuseau absent : Europe/Paris');
select is(private.user_tz('Mars/Olympus'), 'Europe/Paris', 'fuseau inconnu : Europe/Paris');

-- ===== Moment de l'envoi (heures fixes, fuseau UTC puis fuseau décalé) =====
select is(private.digest_ready('daily', 'UTC', null, pg_temp.at(8.9)), false, 'quotidien : avant 9 h, rien ne part');
select is(private.digest_ready('daily', 'UTC', null, pg_temp.at(9)), true, 'quotidien : à 9 h, le résumé part');
select is(private.digest_ready('daily', 'UTC', pg_temp.at(9.1), pg_temp.at(15)), false,
  'quotidien : déjà parti aujourd’hui, pas de second résumé');
select is(private.digest_ready('daily', 'UTC', pg_temp.at(9.1), pg_temp.at(24 + 8.5)), false,
  'quotidien : le lendemain avant 9 h, pas encore');
select is(private.digest_ready('daily', 'UTC', pg_temp.at(9.1), pg_temp.at(24 + 9.2)), true,
  'quotidien : le lendemain à 9 h passées, il repart');
-- Etc/GMT-5 = UTC+5 : 9 h chez la personne à 4 h UTC
select is(private.digest_ready('daily', 'Etc/GMT-5', null, pg_temp.at(3.9)), false,
  'quotidien : 9 h comptée dans le fuseau de la personne (pas encore)');
select is(private.digest_ready('daily', 'Etc/GMT-5', null, pg_temp.at(4.1)), true,
  'quotidien : 9 h comptée dans le fuseau de la personne (c’est l’heure)');
select is(private.digest_ready('hourly', 'UTC', pg_temp.at(10), pg_temp.at(10.5)), false,
  'au fil de l’eau : moins de 60 min, rien ne part');
select is(private.digest_ready('hourly', 'UTC', pg_temp.at(10), pg_temp.at(11.1)), true,
  'au fil de l’eau : 60 min passées, le résumé part');

-- ===== Réservation réelle =====
-- Fuseau où il est 9 h passées maintenant, quel que soit l'instant du lancement (UTC, ou UTC+14 le matin)
create temp table tz as
  select case when extract(hour from now() at time zone 'UTC') >= 9 then 'UTC' else 'Etc/GMT-14' end as name;
update public.notification_settings set timezone = (select name from tz)
 where user_id = '00000000-0000-0000-0000-0000000326a1';
select is(jsonb_array_length(public.digest_claim(50)), 0, 'rien à envoyer : pas d’e-mail');
create function pg_temp.notif(p_age interval) returns void language sql as $$
  insert into public.notifications (workspace_id, user_id, kind, demo_id, step_id, actor_id, created_at)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000326a1', 'comment',
          '00000000-0000-0000-0000-0000000326d1', '00000000-0000-0000-0000-0000000326e1',
          '00000000-0000-0000-0000-0000000326a2', now() - p_age);
$$;
-- Deux événements des 24 dernières heures, un plus ancien (hors du résumé quotidien)
select pg_temp.notif(interval '2 hours');
select pg_temp.notif(interval '20 hours');
select pg_temp.notif(interval '3 days');
create temp table c1 as select public.digest_claim(50) as r;
select is((select (r -> 0 ->> 'total')::int from c1), 2, 'quotidien : les événements des 24 dernières heures seulement');
select is((select r -> 0 ->> 'frequency' from c1), 'daily', 'la réservation dit que c’est un résumé quotidien');
-- Un nouvel événement le même jour attend le lendemain
select pg_temp.notif(interval '1 minute');
select is(jsonb_array_length(public.digest_claim(50)), 0, 'quotidien : un seul e-mail par jour');

select * from finish();
rollback;
