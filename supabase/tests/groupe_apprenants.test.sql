-- Tests pgTAP : L38 paquet 2, groupe (session) d'un lien personnalisé, renvoyé par learners_progress.
begin;
set search_path = public, extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000003a1', 'admin-groupe@example.com'),
  ('00000000-0000-0000-0000-0000000003a2', 'editeur-groupe@example.com'),
  ('00000000-0000-0000-0000-0000000003a3', 'lecteur-groupe@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000003a1');
create temp table ctx as select (public.create_workspace('Groupes')).id as ws;
grant all on ctx to authenticated, anon, service_role;
reset role;
update public.workspaces set plan_code = 'pro', public_links_enabled = true where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000003a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000003a3', 'viewer');
insert into public.demos (id, workspace_id, title, created_by, status) values
  ('00000000-0000-0000-0000-0000000003d1', (select ws from ctx), 'Créer une fiche', '00000000-0000-0000-0000-0000000003a1', 'published');
insert into public.demo_versions (id, demo_id, workspace_id, number, manifest) values
  ('00000000-0000-0000-0000-0000000003e1', '00000000-0000-0000-0000-0000000003d1', (select ws from ctx), 1, '{"steps":[{},{}]}');
update public.demos set current_version_id = '00000000-0000-0000-0000-0000000003e1' where id = '00000000-0000-0000-0000-0000000003d1';

-- Création d'un lien avec groupe par un éditeur, et d'un lien sans groupe
select pg_temp.login('00000000-0000-0000-0000-0000000003a2');
insert into public.share_links (id, demo_id, workspace_id, token, name, variables, cohort) values
  ('00000000-0000-0000-0000-0000000003b1', '00000000-0000-0000-0000-0000000003d1', (select ws from ctx), 'tok-groupe-alex', 'Alex',
   '{"first_name":"Alex","last_name":"Exemple","email":"alex@nord.example"}', 'Session du 12 novembre');
insert into public.share_links (id, demo_id, workspace_id, token, name, variables) values
  ('00000000-0000-0000-0000-0000000003b2', '00000000-0000-0000-0000-0000000003d1', (select ws from ctx), 'tok-groupe-sami', 'Sami',
   '{"first_name":"Sami","email":"sami@nord.example"}');
reset role;
select is((select cohort from public.share_links where id = '00000000-0000-0000-0000-0000000003b2'), '',
  'sans groupe : chaîne vide par défaut');

-- Les deux apprenants ouvrent leur lien
set local role anon;
select public.track_events(jsonb_build_object('demoId', '00000000-0000-0000-0000-0000000003d1',
  'versionId', '00000000-0000-0000-0000-0000000003e1', 'visitorId', 'visitor-alex-0001', 'sessionId', 'session-alex-1',
  'linkToken', 'tok-groupe-alex', 'events', jsonb_build_array(jsonb_build_object('type', 'demo_view'))));
select public.track_events(jsonb_build_object('demoId', '00000000-0000-0000-0000-0000000003d1',
  'versionId', '00000000-0000-0000-0000-0000000003e1', 'visitorId', 'visitor-sami-0001', 'sessionId', 'session-sami-1',
  'linkToken', 'tok-groupe-sami', 'events', jsonb_build_array(jsonb_build_object('type', 'demo_view'))));
reset role;

select pg_temp.login('00000000-0000-0000-0000-0000000003a2');
select is((select l ->> 'group' from jsonb_array_elements(public.learners_progress((select ws from ctx)) -> 'learners') l
           where l ->> 'email' = 'alex@nord.example'), 'Session du 12 novembre',
  'learners_progress : groupe du lien de l''apprenant');
select is((select l ->> 'group' from jsonb_array_elements(public.learners_progress((select ws from ctx)) -> 'learners') l
           where l ->> 'email' = 'sami@nord.example'), '',
  'learners_progress : groupe vide sans groupe');
select is((select l ->> 'linkId' from jsonb_array_elements(public.learners_progress((select ws from ctx)) -> 'learners') l
           where l ->> 'email' = 'alex@nord.example'), '00000000-0000-0000-0000-0000000003b1',
  'learners_progress : lien de l''apprenant (pour modifier son groupe depuis la fiche)');

-- Modification depuis la fiche (éditeur), refusée à un lecteur
update public.share_links set cohort = 'Session du 19 novembre' where id = '00000000-0000-0000-0000-0000000003b2';
select is((select cohort from public.share_links where id = '00000000-0000-0000-0000-0000000003b2'), 'Session du 19 novembre',
  'un éditeur change le groupe d''un lien');
select throws_ok($$ update public.share_links set cohort = repeat('x', 81) where id = '00000000-0000-0000-0000-0000000003b2' $$,
  '23514', null, 'groupe limité à 80 caractères');
select throws_ok($$ update public.share_links set cohort = ' Session ' where id = '00000000-0000-0000-0000-0000000003b2' $$,
  '23514', null, 'groupe sans espaces autour');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000003a3');
update public.share_links set cohort = 'Intrus' where id = '00000000-0000-0000-0000-0000000003b1';
reset role;
select is((select cohort from public.share_links where id = '00000000-0000-0000-0000-0000000003b1'), 'Session du 12 novembre',
  'un lecteur ne change pas le groupe');

select * from finish();
rollback;
