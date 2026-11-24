-- Tests pgTAP : réglage des notifications par événement, dans l'app et par e-mail
-- (20261201160000_notifications_par_evenement.sql). Données fictives, aucun envoi.
begin;
set search_path = public, extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000320a1', 'olga-ev@acme.example'),
  ('00000000-0000-0000-0000-0000000320a2', 'camille-ev@acme.example'),
  ('00000000-0000-0000-0000-0000000320a3', 'vera-ev@acme.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000320a1');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000320d1', (select ws from ctx), 'Créer un rendez-vous', auth.uid());
insert into public.steps (id, demo_id, workspace_id, position, title) values
  ('00000000-0000-0000-0000-0000000320e1', '00000000-0000-0000-0000-0000000320d1', (select ws from ctx), 0, 'Étape 1');

-- ===== Préférences : valeurs acceptées =====
insert into public.notification_settings (user_id) values (auth.uid());
select is((select email_prefs from public.notification_settings where user_id = auth.uid()), '{}'::jsonb,
  'email_prefs vide par défaut');
select lives_ok($$ update public.notification_settings set prefs = '{"alert": false, "reply": true}' where user_id = auth.uid() $$,
  'dans l''app : la clé « alert » est acceptée');
select throws_ok($$ update public.notification_settings set prefs = '{"lead": true}' where user_id = auth.uid() $$,
  '23514', null, 'dans l''app : clé inconnue refusée');
select lives_ok($$ update public.notification_settings set email_prefs = '{"comment": false, "mention": true}' where user_id = auth.uid() $$,
  'e-mail : préférence par événement enregistrée');
select throws_ok($$ update public.notification_settings set email_prefs = '{"comment": "non"}' where user_id = auth.uid() $$,
  '23514', null, 'e-mail : valeur non booléenne refusée');
select throws_ok($$ update public.notification_settings set email_prefs = '{"autre": true}' where user_id = auth.uid() $$,
  '23514', null, 'e-mail : clé inconnue refusée');
select throws_ok($$ update public.notification_settings set email_prefs = '[]' where user_id = auth.uid() $$,
  '23514', null, 'e-mail : un objet seulement');

-- ===== RLS : chacun sa ligne =====
select pg_temp.login('00000000-0000-0000-0000-0000000320a2');
select is((select count(*)::int from public.notification_settings), 0, 'une autre personne ne lit pas ces préférences');
update public.notification_settings set email_prefs = '{"mention": false}'
  where user_id = '00000000-0000-0000-0000-0000000320a1';
reset role;
select is(public.notification_wanted('00000000-0000-0000-0000-0000000320a1', 'alert'), false,
  'alerte coupée dans l''app : prise en compte par notification_wanted');
select is((select email_prefs from public.notification_settings where user_id = '00000000-0000-0000-0000-0000000320a1'),
  '{"comment": false, "mention": true}'::jsonb, 'une autre personne ne modifie pas ces préférences');

-- ===== Résumé e-mail : seulement les événements voulus =====
update public.workspaces set plan_code = 'enterprise' where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000320a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000320a3', 'editor');
create function pg_temp.notif(uid uuid, k text) returns void language sql as $$
  insert into public.notifications (workspace_id, user_id, kind, demo_id, step_id, actor_id)
  values ((select ws from ctx), uid, k, '00000000-0000-0000-0000-0000000320d1',
          '00000000-0000-0000-0000-0000000320e1', '00000000-0000-0000-0000-0000000320a2');
$$;
-- Olga : accord global donné, commentaires coupés par e-mail, mentions voulues, réponses non réglées
update public.notification_settings set email = true where user_id = '00000000-0000-0000-0000-0000000320a1';
select pg_temp.notif('00000000-0000-0000-0000-0000000320a1', 'comment');
select pg_temp.notif('00000000-0000-0000-0000-0000000320a1', 'mention');
select pg_temp.notif('00000000-0000-0000-0000-0000000320a1', 'reply');
select is((select array_agg(kind order by kind) from private.digest_due('00000000-0000-0000-0000-0000000320a1')),
  array['mention', 'reply'], 'résumé : le commentaire coupé par e-mail n''y est pas ; mention et réponse oui');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000320a1'), 3,
  'dans l''app : les trois notifications existent toujours');
create temp table c1 as select public.digest_claim(50) as r;
select is((select (r -> 0 ->> 'total')::int from c1), 2, 'réservation : deux lignes dans le résumé');
select is((select count(*)::int from public.notifications
            where user_id = '00000000-0000-0000-0000-0000000320a1' and kind = 'comment' and emailed_at is null), 1,
  'le commentaire n''est pas marqué envoyé');

-- Vera : accord global donné avant ce réglage, aucune préférence par événement : elle reçoit tout
insert into public.notification_settings (user_id, email) values ('00000000-0000-0000-0000-0000000320a3', true);
select pg_temp.notif('00000000-0000-0000-0000-0000000320a3', 'comment');
select is((select count(*)::int from private.digest_due('00000000-0000-0000-0000-0000000320a3')), 1,
  'compte sans préférence par événement : comportement d''avant gardé');

-- Camille : aucun accord global, même avec des préférences par événement : rien ne part
insert into public.notification_settings (user_id, email, email_prefs)
  values ('00000000-0000-0000-0000-0000000320a2', false, '{"mention": true}');
insert into public.notifications (workspace_id, user_id, kind, demo_id, step_id, actor_id)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000320a2', 'mention',
          '00000000-0000-0000-0000-0000000320d1', '00000000-0000-0000-0000-0000000320e1',
          '00000000-0000-0000-0000-0000000320a1');
update private.email_digest_state set last_at = now() - interval '61 minutes';
select ok(not exists (select 1 from jsonb_array_elements(public.digest_claim(50)) e
                      where e ->> 'user' = '00000000-0000-0000-0000-0000000320a2'),
  'sans accord global : aucun e-mail, quelles que soient les préférences par événement');

select * from finish();
rollback;
