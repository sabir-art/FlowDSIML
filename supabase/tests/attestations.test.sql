-- Tests pgTAP : L15 attestation de suivi (issue_certificate, learner_certificates).
begin;
set search_path = public, extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000003a1', 'admin-attestation@example.com'),
  ('00000000-0000-0000-0000-0000000003a2', 'editeur-attestation@example.com'),
  ('00000000-0000-0000-0000-0000000003a3', 'lecteur-attestation@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000003a1');
create temp table ctx as select (public.create_workspace('Mission Locale Exemple')).id as ws;
grant all on ctx to authenticated, anon, service_role;
reset role;
update public.workspaces set public_links_enabled = true where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000003a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000003a3', 'viewer');

-- D1 démo sans quiz (2 étapes), D2 démo à quiz, D3 obligatoire mais expirée, D4 facultative non suivie
insert into public.demos (id, workspace_id, title, created_by, status) values
  ('00000000-0000-0000-0000-0000000003d1', (select ws from ctx), 'Prise en main', '00000000-0000-0000-0000-0000000003a1', 'published'),
  ('00000000-0000-0000-0000-0000000003d2', (select ws from ctx), 'Fiches usagers', '00000000-0000-0000-0000-0000000003a1', 'published'),
  ('00000000-0000-0000-0000-0000000003d3', (select ws from ctx), 'Ancien module', '00000000-0000-0000-0000-0000000003a1', 'published'),
  ('00000000-0000-0000-0000-0000000003d4', (select ws from ctx), 'Pour aller plus loin', '00000000-0000-0000-0000-0000000003a1', 'published');
insert into public.demo_versions (id, demo_id, workspace_id, number, manifest)
select ('00000000-0000-0000-0000-0000000003e' || n)::uuid, ('00000000-0000-0000-0000-0000000003d' || n)::uuid, (select ws from ctx), 1,
       case when n = 2 then '{"steps":[{},{}],"quiz":{"mode":"graded","questions":[]}}'::jsonb
            else '{"steps":[{},{}]}'::jsonb end
from generate_series(1, 4) n;
update public.demos set current_version_id = ('00000000-0000-0000-0000-0000000003e' || right(id::text, 1))::uuid
 where workspace_id = (select ws from ctx);
insert into public.demo_access (demo_id, workspace_id, mode, expires_at) values
  ('00000000-0000-0000-0000-0000000003d3', (select ws from ctx), 'link', now() - interval '1 day');
insert into public.paths (id, workspace_id, title) values
  ('00000000-0000-0000-0000-0000000003f1', (select ws from ctx), 'Logiciel métier'),
  ('00000000-0000-0000-0000-0000000003f2', (select ws from ctx), 'Formation masquée');
insert into public.path_modules (path_id, demo_id, position, required) values
  ('00000000-0000-0000-0000-0000000003f1', '00000000-0000-0000-0000-0000000003d1', 0, true),
  ('00000000-0000-0000-0000-0000000003f1', '00000000-0000-0000-0000-0000000003d2', 1, true),
  ('00000000-0000-0000-0000-0000000003f1', '00000000-0000-0000-0000-0000000003d3', 2, true),
  ('00000000-0000-0000-0000-0000000003f1', '00000000-0000-0000-0000-0000000003d4', 3, false),
  ('00000000-0000-0000-0000-0000000003f2', '00000000-0000-0000-0000-0000000003d1', 0, true);
insert into public.share_links (id, demo_id, workspace_id, token, name, variables) values
  ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003d1', (select ws from ctx), 'jeton-alex-0003', 'Alex',
   '{"first_name":"Alex","last_name":"Martin","email":"alex@exemple.example"}'),
  ('00000000-0000-0000-0000-0000000003c2', '00000000-0000-0000-0000-0000000003d1', (select ws from ctx), 'jeton-camille-03', 'Camille',
   '{"first_name":"Camille","last_name":"Bernard"}');
insert into public.learners (id, workspace_id, email, full_name, source, share_link_id) values
  ('00000000-0000-0000-0000-0000000003b1', (select ws from ctx), 'alex@exemple.example', '', 'link', '00000000-0000-0000-0000-0000000003c1'),
  ('00000000-0000-0000-0000-0000000003b2', (select ws from ctx), null, '', 'link', '00000000-0000-0000-0000-0000000003c2');
insert into public.learner_visitors (workspace_id, visitor_id, learner_id) values
  ((select ws from ctx), 'visiteur-alex-03', '00000000-0000-0000-0000-0000000003b1'),
  ((select ws from ctx), 'visiteur-cam-003', '00000000-0000-0000-0000-0000000003b2');
insert into public.training_centers (workspace_id, slug, draft, published, published_at, access_mode) values
  ((select ws from ctx), 'ml-attestation', '{}',
   jsonb_build_object('paths', jsonb_build_array(
     jsonb_build_object('id', '00000000-0000-0000-0000-0000000003f1', 'visible', true),
     jsonb_build_object('id', '00000000-0000-0000-0000-0000000003f2', 'visible', false))),
   now(), 'link');

-- ===== Formation non terminée =====
-- Alex : D1 vue jusqu'à la dernière étape, quiz D2 pas encore réussi
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type, step_index, occurred_at) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000003d1', 'visiteur-alex-03', 'session-alex-1', 'step_view', 0, '2026-11-02T09:00:00Z'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000003d1', 'visiteur-alex-03', 'session-alex-1', 'step_view', 1, '2026-11-02T09:05:00Z');
insert into public.quiz_attempts (workspace_id, demo_id, version_id, visitor_id, answers, correct, total, score, passed, created_at) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-0000000003e2', 'visiteur-alex-03',
   '[]', 1, 4, 25, false, '2026-11-03T10:00:00Z');
set local role anon;
select is(public.issue_certificate('jeton-alex-0003', '00000000-0000-0000-0000-0000000003f1'), '{}'::jsonb,
  'module obligatoire non validé : aucune attestation');
reset role;
select is((select count(*)::int from public.learner_certificates), 0, 'rien n''est enregistré');

-- ===== Formation terminée =====
insert into public.quiz_attempts (workspace_id, demo_id, version_id, visitor_id, answers, correct, total, score, passed, created_at) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-0000000003e2', 'visiteur-alex-03',
   '[]', 4, 4, 100, true, '2026-11-04T11:00:00Z'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-0000000003e2', 'visiteur-alex-03',
   '[]', 3, 4, 75, true, '2026-11-05T11:00:00Z');
set local role anon;
create temp table r1 as select public.issue_certificate('jeton-alex-0003', '00000000-0000-0000-0000-0000000003f1') as j;
reset role;
select is((select j ->> 'learner' from r1), 'Alex Martin', 'nom : prénom et nom des variables du lien');
select ok((select j::text !~ 'alex@exemple' from r1), 'jamais l''e-mail');
select is((select (j ->> 'validatedAt')::timestamptz from r1), '2026-11-04T11:00:00Z'::timestamptz,
  'date de validation : dernier module obligatoire validé (première réussite du quiz)');
select is((select j -> 'modules' from r1),
  '[{"title": "Prise en main", "best": null}, {"title": "Fiches usagers", "best": 100}]'::jsonb,
  'modules obligatoires non expirés, meilleur score pour le quiz seulement');
select ok((select j ->> 'path' = 'Logiciel métier' and j ->> 'workspace' = 'Mission Locale Exemple'
           and j ->> 'certificateId' ~ '^\d{6,}$' from r1), 'formation, workspace et numéro');
set local role anon;
create temp table r2 as select public.issue_certificate('jeton-alex-0003', '00000000-0000-0000-0000-0000000003f1') as j;
reset role;
select ok((select r2.j ->> 'certificateId' = r1.j ->> 'certificateId' and r2.j ->> 'issuedAt' = r1.j ->> 'issuedAt' from r1, r2),
  'deuxième demande : même numéro, date de première délivrance');

-- full_name prime sur les variables
update public.learners set full_name = 'Alexandra Martin' where id = '00000000-0000-0000-0000-0000000003b1';
set local role anon;
select is(public.issue_certificate('jeton-alex-0003', '00000000-0000-0000-0000-0000000003f1') ->> 'learner', 'Alexandra Martin',
  'nom complet de l''apprenant en priorité');
-- ===== Refus =====
select is(public.issue_certificate('jeton-inconnu-99', '00000000-0000-0000-0000-0000000003f1'), '{}'::jsonb, 'lien inconnu');
select is(public.issue_certificate('jeton-alex-0003', '00000000-0000-0000-0000-0000000003f2'), '{}'::jsonb, 'formation masquée du centre');
reset role;

-- Deuxième apprenante (nom tiré des variables first_name + last_name)
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type, step_index, occurred_at) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000003d1', 'visiteur-cam-003', 'session-cam-01', 'step_view', 1, '2026-11-06T09:00:00Z');
insert into public.quiz_attempts (workspace_id, demo_id, version_id, visitor_id, answers, correct, total, score, passed, created_at) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-0000000003e2', 'visiteur-cam-003',
   '[]', 4, 4, 100, true, '2026-11-07T09:00:00Z');
set local role anon;
select is(public.issue_certificate('jeton-camille-03', '00000000-0000-0000-0000-0000000003f1') ->> 'learner', 'Camille Bernard',
  'deuxième apprenante : attestation');
reset role;

-- Lien désactivé après la validation
update public.share_links set is_active = false where id = '00000000-0000-0000-0000-0000000003c1';
set local role anon;
select is(public.issue_certificate('jeton-alex-0003', '00000000-0000-0000-0000-0000000003f1'), '{}'::jsonb,
  'lien désactivé après la validation : refusé');
reset role;
update public.share_links set is_active = true where id = '00000000-0000-0000-0000-0000000003c1';
-- Liens publics du workspace désactivés
update public.workspaces set public_links_enabled = false where id = (select ws from ctx);
set local role anon;
select is(public.issue_certificate('jeton-alex-0003', '00000000-0000-0000-0000-0000000003f1'), '{}'::jsonb,
  'liens publics désactivés : refusé');
reset role;
update public.workspaces set public_links_enabled = true where id = (select ws from ctx);

-- ===== Lecture : editor+ seulement, pas d'écriture directe =====
select pg_temp.login('00000000-0000-0000-0000-0000000003a3');
select is((select count(*)::int from public.learner_certificates), 0, 'un lecteur ne voit pas les attestations');
select pg_temp.login('00000000-0000-0000-0000-0000000003a2');
select ok((select count(*)::int from public.learner_certificates) = 2
      , 'un éditeur voit les attestations');
select throws_ok($$ insert into public.learner_certificates (workspace_id, learner_id, path_id)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000003b2', '00000000-0000-0000-0000-0000000003f2') $$,
  '42501', null, 'aucune écriture directe');
reset role;
-- Effacement RGPD : l'attestation disparaît avec l'apprenant
delete from public.learners where id = '00000000-0000-0000-0000-0000000003b1';
select is((select count(*)::int from public.learner_certificates where learner_id = '00000000-0000-0000-0000-0000000003b1'), 0,
  'effacement de l''apprenant : attestation supprimée');

select * from finish();
rollback;
