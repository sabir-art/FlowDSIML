-- Tests pgTAP : F2 quiz (questions, publication, score calculé côté serveur, tentatives, statistiques).
begin;
set search_path = public, extensions;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'formatrice@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'lecteur@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
create temp table ctx as select (public.create_workspace('Quiz')).id as ws;
grant all on ctx to anon, authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by, settings)
  values ('00000000-0000-0000-0000-00000000aa01', (select ws from ctx), 'Module 1', auth.uid(),
          '{"quiz": {"threshold": 50, "attempts": 2}}');
insert into public.steps (id, demo_id, workspace_id, position, kind, title)
  values ('00000000-0000-0000-0000-00000000a501', '00000000-0000-0000-0000-00000000aa01', (select ws from ctx), 0, 'text', 'Intro');
insert into public.quiz_questions (id, demo_id, workspace_id, position, type, prompt, answers, step_id, points) values
  ('00000000-0000-0000-0000-00000000a601', '00000000-0000-0000-0000-00000000aa01', (select ws from ctx), 0, 'single', 'Q1',
   '[{"id":"a","label":"Oui","correct":true},{"id":"b","label":"Non","correct":false}]', '00000000-0000-0000-0000-00000000a501', 1),
  ('00000000-0000-0000-0000-00000000a602', '00000000-0000-0000-0000-00000000aa01', (select ws from ctx), 1, 'multiple', 'Q2',
   '[{"id":"a","label":"A","correct":true},{"id":"b","label":"B","correct":true},{"id":"c","label":"C","correct":false}]', null, 3);

select is((select workspace_id from public.quiz_questions limit 1), (select ws from ctx), 'workspace hérité du module');
select throws_ok($$ insert into public.quiz_questions (demo_id, type) values ('00000000-0000-0000-0000-00000000aa01', 'ouverte') $$,
  '23514', null, 'type de question inconnu refusé');

-- Publication bloquée si une question est invalide
insert into public.quiz_questions (id, demo_id, position, prompt, answers) values
  ('00000000-0000-0000-0000-00000000a603', '00000000-0000-0000-0000-00000000aa01', 2, 'Q3', '[{"id":"a","label":"Seule","correct":true}]');
select throws_ok($$ select public.publish_demo('00000000-0000-0000-0000-00000000aa01', '{"reviewed": true, "fictional": true}') $$,
  'P0001', 'QUIZ_INVALID:3', 'publication bloquée : question 3 invalide');
delete from public.quiz_questions where id = '00000000-0000-0000-0000-00000000a603';

create temp table pub as select public.publish_demo('00000000-0000-0000-0000-00000000aa01', '{"reviewed": true, "fictional": true}') as r;
grant all on pub to anon;
select is((select jsonb_array_length(r -> 'manifest' -> 'quiz' -> 'questions') from pub), 2, 'quiz dans le manifeste');
select is((select r -> 'manifest' -> 'quiz' ->> 'threshold' from pub), '50', 'seuil dans le manifeste');
select is((select r -> 'manifest' -> 'quiz' -> 'questions' -> 0 ->> 'stepId' from pub), '00000000-0000-0000-0000-00000000a501', 'étape liée');
-- La version doit être en ligne pour accepter des tentatives
reset role;
update public.demos set status = 'published', current_version_id = (select (r ->> 'versionId')::uuid from pub)
  where id = '00000000-0000-0000-0000-00000000aa01';

select pg_temp.anon();
create temp table t1 as select public.submit_quiz_attempt(jsonb_build_object(
  'demoId', '00000000-0000-0000-0000-00000000aa01', 'versionId', (select r ->> 'versionId' from pub),
  'visitorId', 'visiteur-0001',
  'answers', '[{"questionId":"00000000-0000-0000-0000-00000000a601","answerIds":["a"]},
               {"questionId":"00000000-0000-0000-0000-00000000a602","answerIds":["a"]}]'::jsonb)) as r;
select is((select (r ->> 'score')::int from t1), 25, 'score serveur : 1 point sur 4 (multiple incomplet = faux)');
select is((select (r ->> 'passed')::boolean from t1), false, 'sous le seuil : non validé');
select is((select (r ->> 'attemptsLeft')::int from t1), 1, 'tentatives restantes');
create temp table t2 as select public.submit_quiz_attempt(jsonb_build_object(
  'demoId', '00000000-0000-0000-0000-00000000aa01', 'versionId', (select r ->> 'versionId' from pub),
  'visitorId', 'visiteur-0001',
  'answers', '[{"questionId":"00000000-0000-0000-0000-00000000a601","answerIds":["b"]},
               {"questionId":"00000000-0000-0000-0000-00000000a602","answerIds":["b","a"]}]'::jsonb)) as r;
select is((select (r ->> 'score')::int from t2), 75, 'choix multiples exacts : 3 points sur 4');
select is((select (r ->> 'passed')::boolean from t2), true, 'seuil atteint : validé');
select throws_ok($$ select public.submit_quiz_attempt(jsonb_build_object(
  'demoId', '00000000-0000-0000-0000-00000000aa01', 'versionId', (select r ->> 'versionId' from pub),
  'visitorId', 'visiteur-0001', 'answers', '[]'::jsonb)) $$, 'P0001', 'NO_ATTEMPTS_LEFT', 'tentatives épuisées');
select throws_ok($$ select public.submit_quiz_attempt('{"demoId": "x"}') $$, 'P0001', 'BAD_BATCH', 'lot invalide refusé');
select throws_ok($$ select * from public.quiz_attempts $$, '42501', null, 'anon ne lit pas les tentatives');

-- Statistiques : agrégats pour tout membre ; tentatives nominatives réservées aux éditeurs
reset role;
insert into public.members (workspace_id, user_id, role) values ((select ws from ctx), '00000000-0000-0000-0000-0000000000a2', 'viewer');
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
create temp table st as select public.quiz_stats('00000000-0000-0000-0000-00000000aa01') as s;
select is((select (s ->> 'attempts')::int from st), 2, 'stats : 2 tentatives');
select is((select (q ->> 'correctRate')::numeric from st, jsonb_array_elements(s -> 'questions') q
           where q ->> 'questionId' = '00000000-0000-0000-0000-00000000a601'), 0.5, 'stats par question : taux de réussite');
select is((select count(*)::int from public.quiz_attempts), 0, 'un lecteur ne voit pas les tentatives nominatives');

select * from finish();
rollback;
