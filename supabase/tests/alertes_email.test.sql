-- Tests pgTAP : ALERT-01, canal « E-mail » des alertes analytics (toujours avec « Dans l'app », envoi par
-- le résumé même sans option générale, rythme d'une heure, résumé quotidien non décalé, désinscription).
-- Données fictives ; heures ancrées sur date_trunc('day', now()) plus une heure fixe.
begin;
set search_path = public, extensions;
select plan(27);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000a1e01', 'olga-al@acme.example'),
  ('00000000-0000-0000-0000-0000000a1e02', 'camille-al@acme.example'),
  ('00000000-0000-0000-0000-0000000a1e03', 'vera-al@acme.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000a1e01');
create temp table ctx as select (public.create_workspace('Acme alertes')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000a1ed1', (select ws from ctx), 'Créer un rendez-vous', auth.uid());
insert into public.steps (id, demo_id, workspace_id, position, title) values
  ('00000000-0000-0000-0000-0000000a1ee1', '00000000-0000-0000-0000-0000000a1ed1', (select ws from ctx), 0, 'Étape 1');
reset role;
update public.workspaces set plan_code = 'enterprise' where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000a1e02', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000a1e03', 'editor');

-- ===== Règles du canal =====
select pg_temp.login('00000000-0000-0000-0000-0000000a1e01');
select throws_ok($$ insert into public.alerts (workspace_id, trigger, channels)
  values ((select ws from ctx), 'cta', array['email']) $$, '23514', null, 'e-mail seul refusé : toujours avec « Dans l''app »');
select throws_ok($$ insert into public.alerts (workspace_id, trigger, channels)
  values ((select ws from ctx), 'cta', array['app', 'sms']) $$, '23514', null, 'canal inconnu refusé');
select lives_ok($$ insert into public.alerts (id, workspace_id, trigger, demo_id, channels) values
  ('00000000-0000-0000-0000-0000000a1ea1', (select ws from ctx), 'lead', '00000000-0000-0000-0000-0000000a1ed1',
   array['app', 'email']) $$, 'alerte avec « Dans l''app » et « E-mail »');
select throws_ok($$ update public.notifications set email_forced = true $$, '42501', null,
  'email_forced : jamais écrit par une personne');
select throws_ok($$ select private.digest_candidates() $$, '42501', null, 'fonctions internes fermées');
-- Olga coupe les alertes dans l'app : avec « E-mail », la notification est posée quand même
insert into public.notification_settings (user_id, prefs) values (auth.uid(), '{"alert": false}'::jsonb);
select pg_temp.login('00000000-0000-0000-0000-0000000a1e02');
insert into public.alerts (id, workspace_id, trigger, demo_id, channels) values
  ('00000000-0000-0000-0000-0000000a1ea2', (select ws from ctx), 'cta', '00000000-0000-0000-0000-0000000a1ed1', array['app']);
reset role;

-- ===== Déclenchement =====
select private.alert_fire((select a from public.alerts a where a.id = '00000000-0000-0000-0000-0000000a1ea1'),
                          '{"trigger": "lead", "count": 2}'::jsonb);
select private.alert_fire((select a from public.alerts a where a.id = '00000000-0000-0000-0000-0000000a1ea2'),
                          '{"trigger": "cta", "count": 1}'::jsonb);
select is((select count(*)::int from public.notifications
            where user_id = '00000000-0000-0000-0000-0000000a1e01' and kind = 'alert' and email_forced), 1,
  'alerte par e-mail : notification posée et marquée, même si la personne a coupé les alertes dans l''app');
select is((select email_forced from public.notifications where user_id = '00000000-0000-0000-0000-0000000a1e02'), false,
  'alerte sans e-mail : notification ordinaire');

-- ===== Envoi : sans option générale, l'alerte part ; l'autre personne ne reçoit rien =====
select is((select email from public.notification_settings where user_id = '00000000-0000-0000-0000-0000000a1e01'), false,
  'Olga n''a pas activé le résumé général');
select is(private.digest_pending(), true, 'un e-mail est dû');
create temp table c1 as select public.digest_claim(50) as r;
select is(jsonb_array_length((select r from c1)), 1, 'un seul e-mail : Olga (Camille n''a ni option ni alerte par e-mail)');
select is((select r -> 0 ->> 'email' from c1), 'olga-al@acme.example', 'adresse du compte de la créatrice');
select is((select ((r -> 0 -> 'lines' -> 0) - 'at') from c1),
  '{"kind": "alert", "actor": "", "demo": "Créer un rendez-vous", "step": null, "data": {"trigger": "lead", "count": 2}}'::jsonb,
  'ligne : déclencheur, nombre et démo, aucune donnée de visiteur');
select is((select r -> 0 ->> 'frequency' from c1), 'hourly', 'objet de l''e-mail : au fil de l''eau');
select is((select sent from private.email_budget where day = private.email_day()), 1, 'compté dans le budget du jour');
select ok((select forced_at is not null and last_at = '-infinity' from private.email_digest_state
            where user_id = '00000000-0000-0000-0000-0000000a1e01'),
  'envoi d''alerte noté à part : le résumé général n''est pas compté comme parti');

-- ===== Rythme : au plus un e-mail par heure =====
select private.alert_fire((select a from public.alerts a where a.id = '00000000-0000-0000-0000-0000000a1ea1'),
                          '{"trigger": "lead", "count": 3}'::jsonb);
select is(jsonb_array_length(public.digest_claim(50)), 0, 'moins d''une heure après : rien');
update private.email_digest_state set forced_at = now() - interval '61 minutes';
select is(jsonb_array_length(public.digest_claim(50)), 1, 'une heure après : l''alerte suivante part');

-- ===== Échec d'envoi : tout est rendu =====
select private.alert_fire((select a from public.alerts a where a.id = '00000000-0000-0000-0000-0000000a1ea1'),
                          '{"trigger": "lead", "count": 4}'::jsonb);
update private.email_digest_state set forced_at = now() - interval '61 minutes';
create temp table c2 as select public.digest_claim(50) as r;
select public.digest_undo((select (r -> 0 ->> 'user')::uuid from c2),
  (select array(select jsonb_array_elements_text(r -> 0 -> 'ids'))::uuid[] from c2),
  (select (r -> 0 ->> 'previous')::timestamptz from c2));
select is(jsonb_array_length(public.digest_claim(50)), 1, 'envoi annulé : l''alerte repart à la tâche suivante');

-- ===== Résumé quotidien : un envoi d'alerte ne le décale pas =====
insert into public.notification_settings (user_id, email, email_frequency, timezone)
  values ('00000000-0000-0000-0000-0000000a1e03', true, 'daily', 'Europe/Paris');
select pg_temp.login('00000000-0000-0000-0000-0000000a1e03');
insert into public.alerts (id, workspace_id, trigger, demo_id, channels) values
  ('00000000-0000-0000-0000-0000000a1ea3', (select ws from ctx), 'lead', '00000000-0000-0000-0000-0000000a1ed1',
   array['app', 'email']);
reset role;
-- Résumé quotidien déjà parti aujourd'hui (9 h 05, heure de Paris) : seul l'e-mail d'alerte peut partir
insert into private.email_digest_state (user_id, last_at)
  values ('00000000-0000-0000-0000-0000000a1e03',
          least(now() - interval '2 hours',
                (date_trunc('day', now() at time zone 'Europe/Paris') + interval '9 hours 5 minutes') at time zone 'Europe/Paris'));
insert into public.notifications (workspace_id, user_id, kind, demo_id, step_id, actor_id)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000a1e03', 'comment',
          '00000000-0000-0000-0000-0000000a1ed1', '00000000-0000-0000-0000-0000000a1ee1',
          '00000000-0000-0000-0000-0000000a1e01');
select private.alert_fire((select a from public.alerts a where a.id = '00000000-0000-0000-0000-0000000a1ea3'),
                          '{"trigger": "lead", "count": 1}'::jsonb);
create temp table before_daily as select last_at from private.email_digest_state
  where user_id = '00000000-0000-0000-0000-0000000a1e03';
create temp table c3 as select public.digest_claim(50) as r;
select is((select count(*)::int from jsonb_array_elements((select r from c3)) e
            where e ->> 'user' = '00000000-0000-0000-0000-0000000a1e03'
              and (e ->> 'total')::int = 1 and e -> 'lines' -> 0 ->> 'kind' = 'alert'), 1,
  'résumé quotidien déjà parti : l''alerte part seule, le commentaire attend le prochain résumé');
select is((select last_at from private.email_digest_state where user_id = '00000000-0000-0000-0000-0000000a1e03'),
  (select last_at from before_daily), 'le rythme du résumé quotidien n''a pas bougé');
select is((select count(*)::int from public.notifications
            where user_id = '00000000-0000-0000-0000-0000000a1e03' and kind = 'comment' and emailed_at is null), 1,
  'le commentaire reste à envoyer');

-- ===== Désinscription : le lien retire aussi « E-mail » des alertes =====
create temp table tok as select (r -> 0 ->> 'token') as t, (r -> 0 ->> 'user')::uuid as u from c3;
select private.alert_fire((select a from public.alerts a where a.id = '00000000-0000-0000-0000-0000000a1ea3'),
                          '{"trigger": "lead", "count": 2}'::jsonb);
select is(public.email_unsubscribe((select t from tok)), true, 'désinscription acceptée');
select is((select channels from public.alerts where id = '00000000-0000-0000-0000-0000000a1ea3'), array['app'],
  '« E-mail » retiré de l''alerte de la personne, « Dans l''app » gardé');
select is((select channels from public.alerts where id = '00000000-0000-0000-0000-0000000a1ea1'), array['app', 'email'],
  'les alertes des autres personnes ne changent pas');
select ok((select alert_email_cleared_at is not null and not email from public.notification_settings
            where user_id = '00000000-0000-0000-0000-0000000a1e03'),
  'résumé désactivé, et l''app saura le dire une fois');
select is((select count(*)::int from public.notifications
            where user_id = '00000000-0000-0000-0000-0000000a1e03' and email_forced and emailed_at is null), 0,
  'l''alerte déjà déclenchée ne partira plus par e-mail');
select pg_temp.login('00000000-0000-0000-0000-0000000a1e03');
select lives_ok($$ update public.notification_settings set alert_email_cleared_at = null where user_id = auth.uid() $$,
  'la personne acquitte le message dans l''app');
reset role;

select * from finish();
rollback;
