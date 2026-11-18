-- Tests pgTAP : L13 suivi des apprenants (identification, identité déclarative, statuts calculés,
-- tentatives accordées, droits, agrégats masqués, reprise, effacement RGPD, purge selon le plan).
begin;
set search_path = public, extensions;
select plan(30);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000001a1', 'admin-suivi@example.com'),
  ('00000000-0000-0000-0000-0000000001a2', 'editeur-suivi@example.com'),
  ('00000000-0000-0000-0000-0000000001a3', 'lecteur-suivi@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000001a1');
create temp table ctx as select (public.create_workspace('Suivi')).id as ws;
grant all on ctx to authenticated, anon, service_role;
reset role;
update public.workspaces set plan_code = 'pro', public_links_enabled = true where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000001a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000001a3', 'viewer');

-- Deux modules publiés : D1 (3 étapes, sans quiz), D2 (2 étapes, quiz : 1 tentative, seuil 70)
insert into public.demos (id, workspace_id, title, created_by, status) values
  ('00000000-0000-0000-0000-0000000001d1', (select ws from ctx), 'Créer une fiche', '00000000-0000-0000-0000-0000000001a1', 'published'),
  ('00000000-0000-0000-0000-0000000001d2', (select ws from ctx), 'Agenda', '00000000-0000-0000-0000-0000000001a1', 'published');
insert into public.demo_versions (id, demo_id, workspace_id, number, manifest) values
  ('00000000-0000-0000-0000-0000000001e1', '00000000-0000-0000-0000-0000000001d1', (select ws from ctx), 1,
   '{"steps":[{},{},{}]}'),
  ('00000000-0000-0000-0000-0000000001e2', '00000000-0000-0000-0000-0000000001d2', (select ws from ctx), 1,
   '{"steps":[{},{}],"quiz":{"mode":"quiz","attempts":1,"threshold":70,"questions":[{"id":"q1","answers":[{"id":"a","correct":true},{"id":"b","correct":false}]}]}}');
update public.demos set current_version_id = '00000000-0000-0000-0000-0000000001e1' where id = '00000000-0000-0000-0000-0000000001d1';
update public.demos set current_version_id = '00000000-0000-0000-0000-0000000001e2' where id = '00000000-0000-0000-0000-0000000001d2';
insert into public.paths (id, workspace_id, title) values ('00000000-0000-0000-0000-0000000001f1', (select ws from ctx), 'Accueil');
insert into public.path_modules (path_id, demo_id, position) values
  ('00000000-0000-0000-0000-0000000001f1', '00000000-0000-0000-0000-0000000001d1', 0),
  ('00000000-0000-0000-0000-0000000001f1', '00000000-0000-0000-0000-0000000001d2', 1);
insert into public.structures (id, workspace_id, name, domains) values
  ('00000000-0000-0000-0000-0000000001c1', (select ws from ctx), 'Mission locale Nord', '{nord.example}');
insert into public.share_links (id, demo_id, workspace_id, token, name, variables) values
  ('00000000-0000-0000-0000-0000000001b1', '00000000-0000-0000-0000-0000000001d2', (select ws from ctx), 'tok-paul', 'Paul',
   '{"first_name":"Paul","last_name":"Robert","email":"paul@nord.example"}'),
  ('00000000-0000-0000-0000-0000000001b2', '00000000-0000-0000-0000-0000000001d2', (select ws from ctx), 'tok-marc', 'Marc',
   '{"first_name":"Marc","email":"marc@sud.example"}');

-- ===== Player (anon) =====
set local role anon;
select public.submit_lead('00000000-0000-0000-0000-0000000001d1', '00000000-0000-0000-0000-0000000001e1',
  'Lea@Nord.example', '{"full_name":"Léa Martin"}', true, 'visitor-lea-0001');
select public.track_events(jsonb_build_object('demoId', '00000000-0000-0000-0000-0000000001d1',
  'versionId', '00000000-0000-0000-0000-0000000001e1', 'visitorId', 'visitor-lea-0001', 'sessionId', 'session-lea-01',
  'events', jsonb_build_array(jsonb_build_object('type', 'step_view', 'stepIndex', 0),
    jsonb_build_object('type', 'step_view', 'stepIndex', 1), jsonb_build_object('type', 'step_view', 'stepIndex', 2))));
-- Paul par lien personnalisé (D2)
select public.track_events(jsonb_build_object('demoId', '00000000-0000-0000-0000-0000000001d2',
  'versionId', '00000000-0000-0000-0000-0000000001e2', 'visitorId', 'visitor-paul-001', 'sessionId', 'session-paul-1',
  'linkToken', 'tok-paul', 'events', jsonb_build_array(jsonb_build_object('type', 'demo_view'))));
-- Un intrus tape l'e-mail de Paul dans un formulaire
select public.submit_lead('00000000-0000-0000-0000-0000000001d1', '00000000-0000-0000-0000-0000000001e1',
  'paul@nord.example', '{"full_name":"Intrus"}', true, 'visitor-intrus-1');
-- Marc : d'abord par formulaire, puis par lien avec le même e-mail
select public.submit_lead('00000000-0000-0000-0000-0000000001d1', '00000000-0000-0000-0000-0000000001e1',
  'marc@sud.example', '{}', true, 'visitor-marc-001');
select public.track_events(jsonb_build_object('demoId', '00000000-0000-0000-0000-0000000001d2',
  'versionId', '00000000-0000-0000-0000-0000000001e2', 'visitorId', 'visitor-marc-002', 'sessionId', 'session-marc-2',
  'linkToken', 'tok-marc', 'events', jsonb_build_array(jsonb_build_object('type', 'demo_view'))));
-- Un formulaire anonyme ne peut pas changer l'apprenant d'un visiteur identifié par lien
select public.submit_lead('00000000-0000-0000-0000-0000000001d1', '00000000-0000-0000-0000-0000000001e1',
  'autre@nord.example', '{}', true, 'visitor-paul-001');
-- Quiz de Paul : échec (1 tentative)
select public.submit_quiz_attempt(jsonb_build_object('demoId', '00000000-0000-0000-0000-0000000001d2',
  'versionId', '00000000-0000-0000-0000-0000000001e2', 'visitorId', 'visitor-paul-001',
  'answers', jsonb_build_array(jsonb_build_object('questionId', 'q1', 'answerIds', jsonb_build_array('b')))));
select throws_ok($$ select count(*) from public.learners $$, '42501', null, 'anon ne lit pas les apprenants');
select is(public.learner_resume('tok-paul', '00000000-0000-0000-0000-0000000001d2') ->> 'firstName', 'Paul',
  'reprise : prénom seulement');
select ok(public.learner_resume('tok-paul', '00000000-0000-0000-0000-0000000001d2')::text !~ '(Robert|@)',
  'reprise : ni nom complet ni e-mail');
select is(public.learner_resume('mauvais', '00000000-0000-0000-0000-0000000001d2'), '{}'::jsonb, 'reprise : jeton inconnu');
select is(public.learner_resume('tok-paul', '00000000-0000-0000-0000-0000000001d1'), '{}'::jsonb, 'reprise : jeton d''une autre démo');
reset role;
update public.share_links set expires_at = now() - interval '1 day' where token = 'tok-marc';
set local role anon;
select is(public.learner_resume('tok-marc', '00000000-0000-0000-0000-0000000001d2'), '{}'::jsonb, 'reprise : lien expiré');
reset role;

-- ===== Identification =====
select is((select source || ' ' || full_name || ' ' || coalesce((select name from public.structures s where s.id = structure_id), '-')
           from public.learners where email = 'lea@nord.example'), 'lead Léa Martin Mission locale Nord',
  'formulaire : apprenant identifié par e-mail, structure par domaine');
select is((select source from public.learners where email = 'paul@nord.example'), 'link', 'lien personnalisé : source link');
select is((select count(*)::int from public.learner_visitors where visitor_id = 'visitor-intrus-1'), 0,
  'identité déclarative : un formulaire ne se rattache pas à un apprenant identifié par lien');
select is((select full_name from public.learners where email = 'paul@nord.example'), 'Paul Robert',
  'identité déclarative : le nom de l''apprenant par lien n''est pas écrasé');
select is((select l.email from public.learner_visitors lv join public.learners l on l.id = lv.learner_id
           where lv.visitor_id = 'visitor-paul-001'), 'paul@nord.example',
  'un formulaire anonyme ne change pas l''apprenant d''un visiteur identifié par lien');
select is((select count(*)::int from public.learners where email = 'marc@sud.example'), 1, 'fusion par e-mail (formulaire puis lien)');
select is((select source from public.learners where email = 'marc@sud.example'), 'link', 'fusion : le lien l''emporte');
select is((select count(*)::int from public.learner_visitors lv join public.learners l on l.id = lv.learner_id
           where l.email = 'marc@sud.example'), 2, 'fusion : les deux visiteurs rattachés');

-- ===== Droits et statuts =====
select pg_temp.login('00000000-0000-0000-0000-0000000001a3');
select throws_ok($$ select public.learners_progress((select ws from ctx)) $$, '42501', null, 'un lecteur ne voit pas la liste nominative');
select is((select count(*)::int from public.learners), 0, 'un lecteur ne lit pas la table des apprenants');
select is((public.structure_overview('00000000-0000-0000-0000-0000000001f1') ->> 'learners')::int, 3,
  'un lecteur voit les agrégats');
select is(public.structure_overview('00000000-0000-0000-0000-0000000001f1') -> 'structures' -> 0 -> 'cells'
          ->> '00000000-0000-0000-0000-0000000001d1', null, 'agrégats : groupe de moins de 5 personnes masqué');

select pg_temp.login('00000000-0000-0000-0000-0000000001a2');
create temp table lp as select public.learners_progress((select ws from ctx)) as r;
create temp table mods as
  select l ->> 'email' as email, m ->> 'demoId' as demo, m ->> 'status' as status
  from lp, jsonb_array_elements(r -> 'learners') l, jsonb_array_elements(l -> 'modules') m;
select is((select status from mods where email = 'lea@nord.example' and demo = '00000000-0000-0000-0000-0000000001d1'), 'validated',
  'module sans quiz : validé à la dernière étape vue');
select is((select status from mods where email = 'paul@nord.example' and demo = '00000000-0000-0000-0000-0000000001d2'), 'failed',
  'quiz échoué sans tentative restante : non validé');
select is(public.grant_quiz_attempt((select id from public.learners where email = 'paul@nord.example'),
  '00000000-0000-0000-0000-0000000001d2'), 1, 'tentative accordée');
reset role;
set local role anon;
select is((public.submit_quiz_attempt(jsonb_build_object('demoId', '00000000-0000-0000-0000-0000000001d2',
  'versionId', '00000000-0000-0000-0000-0000000001e2', 'visitorId', 'visitor-paul-001',
  'answers', jsonb_build_array(jsonb_build_object('questionId', 'q1', 'answerIds', jsonb_build_array('a'))))) ->> 'passed')::boolean,
  true, 'nouvelle tentative réussie');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000001a2');
select is((select m ->> 'status' from jsonb_array_elements(public.learners_progress((select ws from ctx)) -> 'learners') l,
           jsonb_array_elements(l -> 'modules') m
           where l ->> 'email' = 'paul@nord.example' and m ->> 'demoId' = '00000000-0000-0000-0000-0000000001d2'), 'validated',
  'quiz : la meilleure tentative fait foi');

-- ===== Effacement RGPD =====
select throws_ok($$ select public.erase_learner((select id from public.learners where email = 'lea@nord.example'), 'lea@nord.example') $$,
  '42501', null, 'un éditeur ne supprime pas un apprenant');
select pg_temp.login('00000000-0000-0000-0000-0000000001a1');
select throws_ok($$ select public.erase_learner((select id from public.learners where email = 'lea@nord.example'), 'autre@nord.example') $$,
  'P0001', 'CONFIRMATION_MISMATCH', 'confirmation par saisie de l''e-mail');
select lives_ok($$ select public.erase_learner((select id from public.learners where email = 'lea@nord.example'), 'LEA@nord.example ') $$,
  'suppression par un admin');
reset role;
select is((select count(*)::int from public.learners where email = 'lea@nord.example')
        + (select count(*)::int from public.leads where email = 'lea@nord.example')
        + (select count(*)::int from public.events where visitor_id = 'visitor-lea-0001'), 0,
  'apprenant, leads et rattachement des événements supprimés');
select ok((select count(*) = 1 and bool_and(target_ref !~ '@' and target_ref is not null) from public.audit_log where action = 'learner.erase'),
  'suppression tracée sans e-mail en clair');

-- ===== Purge selon le plan (Free : 30 jours) =====
update public.workspaces set plan_code = 'free' where id = (select ws from ctx);
-- (Événements vieillis d'abord : le déplacement de partition rejoue l'insertion, donc l'identification)
update public.events set occurred_at = now() - interval '40 days'
  where visitor_id in ('visitor-marc-001', 'visitor-marc-002');
update public.learners set last_seen_at = now() - interval '40 days' where email = 'marc@sud.example';
select is(public.purge_learners(), 1, 'purge : apprenant inactif au-delà de la durée du plan');
select is(public.purge_learners(), 0, 'purge idempotente');

select * from finish();
rollback;
