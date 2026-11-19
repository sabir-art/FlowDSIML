-- Tests pgTAP : L19 partie 1 (appareil et pays des événements, sondage : note de 0 à 10 et réponse écrite).
begin;
set search_path = public, extensions;
select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'editrice@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'lecteur@example.com');
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

select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
create temp table ctx as select (public.create_workspace('Sondages')).id as ws;
grant all on ctx to anon, authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by, settings)
  values ('00000000-0000-0000-0000-00000000cc01', (select ws from ctx), 'Satisfaction', auth.uid(),
          '{"quiz": {"mode": "quiz"}}');
insert into public.steps (id, demo_id, workspace_id, position, kind, title)
  values ('00000000-0000-0000-0000-00000000c501', '00000000-0000-0000-0000-00000000cc01', (select ws from ctx), 0, 'text', 'Intro');
insert into public.quiz_questions (id, demo_id, position, type, prompt, answers) values
  ('00000000-0000-0000-0000-00000000c601', '00000000-0000-0000-0000-00000000cc01', 0, 'nps', 'Recommanderiez-vous ?', '[]'),
  ('00000000-0000-0000-0000-00000000c602', '00000000-0000-0000-0000-00000000cc01', 1, 'text', 'Une suggestion ?', '[]'),
  ('00000000-0000-0000-0000-00000000c603', '00000000-0000-0000-0000-00000000cc01', 2, 'single', 'Format préféré',
   '[{"id":"a","label":"Vidéo"},{"id":"b","label":"Démo"}]');

select throws_ok($$ insert into public.quiz_questions (demo_id, type) values ('00000000-0000-0000-0000-00000000cc01', 'echelle') $$,
  '23514', null, 'type inconnu toujours refusé');
select throws_ok($$ select public.publish_demo('00000000-0000-0000-0000-00000000cc01', '{"reviewed": true, "fictional": true}') $$,
  'P0001', 'QUIZ_INVALID:1', 'nps refusé en mode Quiz');
update public.demos set settings = '{"quiz": {"mode": "survey"}}' where id = '00000000-0000-0000-0000-00000000cc01';
create temp table pub as select public.publish_demo('00000000-0000-0000-0000-00000000cc01', '{"reviewed": true, "fictional": true}') as r;
grant all on pub to anon, authenticated;
select is((select r -> 'manifest' -> 'quiz' -> 'questions' -> 0 ->> 'type' from pub), 'nps', 'nps et text publiés en mode Sondage');
reset role;
update public.demos set status = 'published', current_version_id = (select (r ->> 'versionId')::uuid from pub)
  where id = '00000000-0000-0000-0000-00000000cc01';
insert into public.members (workspace_id, user_id, role) values ((select ws from ctx), '00000000-0000-0000-0000-0000000000c2', 'viewer');

-- ===== Appareil et pays =====
select pg_temp.anon();
select is(public.track_events(jsonb_build_object(
  'demoId', '00000000-0000-0000-0000-00000000cc01', 'versionId', (select r ->> 'versionId' from pub),
  'visitorId', 'visiteur-c001', 'sessionId', 'session-c001', 'country', 'FR',
  'device', '{"type":"mobile","browser":"firefox","os":"android","lang":"fr"}'::jsonb,
  'events', '[{"type":"demo_view"},{"type":"hotspot_click","stepId":"s1","props":{"choice":"Je découvre"}}]'::jsonb)), 2, 'lot accepté');
select is(public.track_events(jsonb_build_object(
  'demoId', '00000000-0000-0000-0000-00000000cc01', 'versionId', (select r ->> 'versionId' from pub),
  'visitorId', 'visiteur-c002', 'sessionId', 'session-c002', 'country', 'fr; ip=1.2.3.4',
  'device', '{"type":"montre","browser":"<script>","os":"amiga","lang":"FRA"}'::jsonb,
  'events', '[{"type":"demo_view"},{"type":"demo_complete"}]'::jsonb)), 2, 'valeurs inconnues : lot accepté quand même');
reset role;
select results_eq($$ select device, browser, os, lang, country from public.events where visitor_id = 'visiteur-c001' limit 1 $$,
  $$ values ('mobile'::text, 'firefox'::text, 'android'::text, 'fr'::text, 'FR'::text) $$, 'appareil, langue et pays enregistrés');
select results_eq($$ select device, browser, os, lang, country from public.events where visitor_id = 'visiteur-c002' limit 1 $$,
  $$ values (null::text, null::text, null::text, null::text, null::text) $$, 'listes fermées : hors liste = null');
select pg_temp.anon();
select is(public.track_events(jsonb_build_object(
  'demoId', '00000000-0000-0000-0000-00000000cc01', 'versionId', (select r ->> 'versionId' from pub),
  'visitorId', 'visiteur-c003', 'sessionId', 'session-c003', 'country', 'XX',
  'events', '[{"type":"demo_view"}]'::jsonb)), 1, 'lot sans appareil accepté');
reset role;
select is((select country from public.events where visitor_id = 'visiteur-c003'), null, 'pays inconnu (XX) : null');

-- ===== Réponses de sondage =====
select pg_temp.anon();
create temp table a1 as select public.submit_quiz_attempt(jsonb_build_object(
  'demoId', '00000000-0000-0000-0000-00000000cc01', 'versionId', (select r ->> 'versionId' from pub),
  'visitorId', 'visiteur-c001',
  'answers', jsonb_build_array(
    jsonb_build_object('questionId', '00000000-0000-0000-0000-00000000c601', 'value', 9),
    jsonb_build_object('questionId', '00000000-0000-0000-0000-00000000c602', 'text', '  ' || repeat('é', 600)),
    jsonb_build_object('questionId', '00000000-0000-0000-0000-00000000c603', 'answerIds', '["b"]'::jsonb)))) as r;
grant all on a1 to authenticated;
select is((select (r ->> 'passed')::boolean from a1), true, 'sondage : toujours validé');
select is((select r -> 'questions' -> 1 ->> 'answered' from a1), 'true', 'réponse écrite signalée sans son texte');
select ok((select r::text not like '%ééé%' from a1), 'le texte n''est pas renvoyé');
create temp table a2 as select public.submit_quiz_attempt(jsonb_build_object(
  'demoId', '00000000-0000-0000-0000-00000000cc01', 'versionId', (select r ->> 'versionId' from pub),
  'visitorId', 'visiteur-c002',
  'answers', jsonb_build_array(
    jsonb_build_object('questionId', '00000000-0000-0000-0000-00000000c601', 'value', 11),
    jsonb_build_object('questionId', '00000000-0000-0000-0000-00000000c602', 'text', '   ')))) as r;
reset role;
select is((select char_length(body) from public.survey_text_answers), 500, 'réponse écrite coupée à 500 caractères');
select is((select count(*)::int from public.survey_text_answers), 1, 'réponse vide non rangée');
select ok((select answers::text not like '%ééé%' from public.quiz_attempts where visitor_id = 'visiteur-c001'),
  'texte jamais copié dans quiz_attempts');

-- Résultats : lecteur
select pg_temp.login('00000000-0000-0000-0000-0000000000c2');
create temp table sr as select public.survey_results('00000000-0000-0000-0000-00000000cc01') as r;
select is((select (r -> 0 ->> 'responses')::int from sr), 1, 'nps : note hors bornes ignorée');
select is((select r -> 0 -> 'nps' -> 'histogram' ->> 9 from sr), '1', 'histogramme 0 à 10');
select is((select r -> 0 -> 'nps' ->> 'score' from sr), null, 'score masqué sous 20 réponses');
select is((select (r -> 2 -> 'choices' -> 1 ->> 'n')::int from sr), 1, 'choix comptés');
select is((select (r -> 1 ->> 'responses')::int from sr), 1, 'nombre de réponses écrites');
select is((select count(*)::int from public.survey_text_answers), 0, 'lecteur : aucune réponse écrite visible');
select throws_ok($$ select public.survey_texts('00000000-0000-0000-0000-00000000cc01') $$, '42501', null, 'lecteur : survey_texts refusé');
select is((select public.choice_results('00000000-0000-0000-0000-00000000cc01') -> 0 -> 'choices' -> 0 ->> 'label'), 'Je découvre',
  'menus de choix : libellé du choix');

-- Éditrice, puis effacement de l'apprenant
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select is(jsonb_array_length(public.survey_texts('00000000-0000-0000-0000-00000000cc01')), 1, 'éditrice : réponses écrites lisibles');
reset role;
insert into public.learners (id, workspace_id, email, source) values
  ('00000000-0000-0000-0000-00000000c701', (select ws from ctx), 'lea@acme.example', 'lead');
insert into public.learner_visitors (workspace_id, visitor_id, learner_id)
  values ((select ws from ctx), 'visiteur-c001', '00000000-0000-0000-0000-00000000c701');
delete from public.learners where id = '00000000-0000-0000-0000-00000000c701';
select is((select count(*)::int from public.survey_text_answers), 0, 'apprenant effacé : ses réponses écrites aussi');

select * from finish();
rollback;
