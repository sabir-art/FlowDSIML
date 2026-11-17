-- Tests pgTAP : F3a suivi des apprenants (jeton personnel, progression, quiz par apprenant, agrégats).
begin;
set search_path = public, extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'formatrice@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'lecteur@example.com');
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

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
create temp table ctx as select (public.create_workspace('Suivi')).id as ws;
grant all on ctx to anon, authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.structures (id, workspace_id, name) values
  ('00000000-0000-0000-0000-00000000c001', (select ws from ctx), 'Structure Nord'),
  ('00000000-0000-0000-0000-00000000c002', (select ws from ctx), 'Structure Sud');
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-00000000d001', (select ws from ctx), 'Module sans quiz', auth.uid()),
  ('00000000-0000-0000-0000-00000000d002', (select ws from ctx), 'Module avec quiz', auth.uid());
insert into public.demos (id, workspace_id, title, created_by, settings) values
  ('00000000-0000-0000-0000-00000000d003', (select ws from ctx), 'Autre', auth.uid(), '{}')
  on conflict do nothing;
update public.demos set settings = '{"quiz": {"threshold": 100, "attempts": 1}}' where id = '00000000-0000-0000-0000-00000000d002';
insert into public.steps (demo_id, position, kind, title) values
  ('00000000-0000-0000-0000-00000000d001', 0, 'text', 'A'), ('00000000-0000-0000-0000-00000000d001', 1, 'text', 'B'),
  ('00000000-0000-0000-0000-00000000d002', 0, 'text', 'A');
insert into public.quiz_questions (id, demo_id, prompt, answers) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000d002', 'Q',
   '[{"id":"a","label":"Oui","correct":true},{"id":"b","label":"Non","correct":false}]');
create temp table pub as select
  public.publish_demo('00000000-0000-0000-0000-00000000d001', '{"reviewed": true, "fictional": true}') as r1,
  public.publish_demo('00000000-0000-0000-0000-00000000d002', '{"reviewed": true, "fictional": true}') as r2;
grant all on pub to anon;
insert into public.paths (id, workspace_id, title, goal) values ('00000000-0000-0000-0000-00000000f001', (select ws from ctx), 'Parcours', 80);
insert into public.path_modules (path_id, demo_id, position, required) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000d001', 0, true),
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000d002', 1, true);
select is((select workspace_id from public.path_modules limit 1), (select ws from ctx), 'module rattaché au workspace du parcours');
insert into public.learners (id, workspace_id, email, full_name, structure_id) values
  ('00000000-0000-0000-0000-0000000000a1', (select ws from ctx), 'Camille.Martin@Example.com', 'Camille Martin', '00000000-0000-0000-0000-00000000c001');
select is((select email from public.learners where id = '00000000-0000-0000-0000-0000000000a1'), 'camille.martin@example.com', 'e-mail normalisé');
create temp table tok as select token from public.learners where id = '00000000-0000-0000-0000-0000000000a1';
grant all on tok to anon;
-- 6 autres apprenants à Nord (groupe ≥ 5), 2 au Sud (groupe < 5 → masqué)
insert into public.learners (workspace_id, email, structure_id)
  select (select ws from ctx), 'n' || i || '@example.com', '00000000-0000-0000-0000-00000000c001' from generate_series(1, 5) i;
insert into public.learners (workspace_id, email, structure_id)
  select (select ws from ctx), 's' || i || '@example.com', '00000000-0000-0000-0000-00000000c002' from generate_series(1, 2) i;

-- Mise en ligne
reset role;
update public.demos d set status = 'published', current_version_id = v.id
  from public.demo_versions v where v.demo_id = d.id;

-- Player (anon) : suivi par jeton
select pg_temp.anon();
select is(public.learner_resume('jeton-inconnu-000000', '00000000-0000-0000-0000-00000000d001'), null, 'jeton inconnu : rien');
select public.learner_track((select token from tok), '00000000-0000-0000-0000-00000000d001', 0, 2);
select is((public.learner_resume((select token from tok), '00000000-0000-0000-0000-00000000d001') -> 'progress' ->> 'status'), 'in_progress', 'module en cours');
select is((public.learner_resume((select token from tok), '00000000-0000-0000-0000-00000000d001') ->> 'firstName'), 'Camille', 'prénom pour « Bon retour »');
select public.learner_track((select token from tok), '00000000-0000-0000-0000-00000000d001', 1, 2);
select is((public.learner_resume((select token from tok), '00000000-0000-0000-0000-00000000d001') -> 'progress' ->> 'status'), 'validated',
  'module sans quiz : validé à la dernière étape');
select public.learner_track((select token from tok), '00000000-0000-0000-0000-00000000d002', 0, 1);
select is((public.learner_resume((select token from tok), '00000000-0000-0000-0000-00000000d002') -> 'progress' ->> 'status'), 'in_progress',
  'module avec quiz : pas validé à la dernière étape');
select is(jsonb_array_length(public.learner_resume((select token from tok), '00000000-0000-0000-0000-00000000d002') -> 'path' -> 'modules'), 2,
  'parcours et modules dans la reprise');

-- Quiz : tentative de l'apprenant (1 tentative), échec puis tentative accordée, puis réussite
create temp table a1 as select public.submit_quiz_attempt(jsonb_build_object(
  'demoId', '00000000-0000-0000-0000-00000000d002', 'versionId', (select r2 ->> 'versionId' from pub),
  'visitorId', 'visiteur-a1', 'learnerToken', (select token from tok),
  'answers', '[{"questionId":"00000000-0000-0000-0000-00000000e001","answerIds":["b"]}]'::jsonb)) as r;
select throws_ok($$ select public.submit_quiz_attempt(jsonb_build_object(
  'demoId', '00000000-0000-0000-0000-00000000d002', 'versionId', (select r2 ->> 'versionId' from pub),
  'visitorId', 'autre-visiteur', 'learnerToken', (select token from tok), 'answers', '[]'::jsonb)) $$,
  'P0001', 'NO_ATTEMPTS_LEFT', 'tentatives comptées par apprenant (même depuis un autre navigateur)');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select status from public.learner_progress where learner_id = '00000000-0000-0000-0000-0000000000a1'
           and demo_id = '00000000-0000-0000-0000-00000000d002'), 'failed', 'échec : non validé');
update public.learner_progress set extra_attempts = extra_attempts + 1
  where learner_id = '00000000-0000-0000-0000-0000000000a1' and demo_id = '00000000-0000-0000-0000-00000000d002';
select pg_temp.anon();
create temp table a2 as select public.submit_quiz_attempt(jsonb_build_object(
  'demoId', '00000000-0000-0000-0000-00000000d002', 'versionId', (select r2 ->> 'versionId' from pub),
  'visitorId', 'visiteur-a1', 'learnerToken', (select token from tok),
  'answers', '[{"questionId":"00000000-0000-0000-0000-00000000e001","answerIds":["a"]}]'::jsonb)) as r;
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select status || ':' || best_score || ':' || attempts_used from public.learner_progress
           where learner_id = '00000000-0000-0000-0000-0000000000a1' and demo_id = '00000000-0000-0000-0000-00000000d002'),
  'validated:100:2', 'tentative accordée puis réussite : validé, meilleur score, 2 tentatives');
select is((select count(*)::int from public.quiz_attempts where learner_id = '00000000-0000-0000-0000-0000000000a1'), 2, 'tentatives rattachées à l''apprenant');

-- Agrégats : viewer+, groupes < 5 masqués
create temp table ov as select public.structure_overview('00000000-0000-0000-0000-00000000f001') as o;
select is((select (o ->> 'trained')::int from ov), 1, 'personnes formées : tous les modules obligatoires validés');
select is((select (s ->> 'trainedRate')::numeric from ov, jsonb_array_elements(o -> 'structures') s where s ->> 'name' = 'Structure Nord'), 0.1667,
  'taux de personnes formées par structure');
select is((select s -> 'trainedRate' from ov, jsonb_array_elements(o -> 'structures') s where s ->> 'name' = 'Structure Sud'), 'null'::jsonb,
  'structure de moins de 5 personnes : valeur masquée');

-- Droits : un lecteur ne voit pas les apprenants, mais voit les agrégats
reset role;
insert into public.members (workspace_id, user_id, role) values ((select ws from ctx), '00000000-0000-0000-0000-0000000000b2', 'viewer');
select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.learners), 0, 'lecteur : pas de données nominatives');
select ok((public.structure_overview('00000000-0000-0000-0000-00000000f001') ->> 'learners')::int = 8, 'lecteur : agrégats visibles');

-- Retrait d'accès : le jeton ne fonctionne plus
reset role;
update public.learners set removed_at = now() where id = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.anon();
select is(public.learner_resume((select token from tok), '00000000-0000-0000-0000-00000000d001'), null, 'accès retiré : jeton refusé');

select * from finish();
rollback;
