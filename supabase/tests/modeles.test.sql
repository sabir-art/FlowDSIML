-- Tests pgTAP : L26-04 / L26-05 (bibliothèque de modèles, étapes « À capturer »).
begin;
set search_path = public, extensions;
select plan(27);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000040a1', 'editrice-modeles@example.com'),
  ('00000000-0000-0000-0000-0000000040a2', 'lecteur-modeles@example.com'),
  ('00000000-0000-0000-0000-0000000040a3', 'autre-espace@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000040a1');
create temp table ctx as select (public.create_workspace('Modèles')).id as ws;
grant all on ctx to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000040a2', 'viewer');
select pg_temp.login('00000000-0000-0000-0000-0000000040a3');
create temp table ctx2 as select (public.create_workspace('Autre')).id as ws;
grant all on ctx2 to authenticated;

-- Modèles livrés : visibles de tous les membres connectés
select is((select count(*)::int from public.demo_templates where workspace_id is null), 6, '6 modèles livrés');
select pg_temp.login('00000000-0000-0000-0000-0000000040a2');
select throws_ok($$ select public.create_demo_from_template(
  (select id from public.demo_templates where builtin_key = 'prise-en-main'), (select ws from ctx)) $$,
  '42501', null, 'lecteur : pas de création depuis un modèle');
update public.demo_templates set name = 'x' where builtin_key = 'prise-en-main';
select is((select name from public.demo_templates where builtin_key = 'prise-en-main'), 'Prise en main d’un logiciel',
  'modèles livrés : non modifiables');

-- Création depuis « Prise en main d'un logiciel »
select pg_temp.login('00000000-0000-0000-0000-0000000040a1');
create temp table d1 as select public.create_demo_from_template(
  (select id from public.demo_templates where builtin_key = 'prise-en-main'), (select ws from ctx)) as id;
grant all on d1 to authenticated;
select is((select status::text from public.demos where id = (select id from d1)), 'draft', 'démo brouillon');
select is((select title from public.demos where id = (select id from d1)), 'Prise en main d’un logiciel', 'titre du modèle');
select is((select count(*)::int from public.chapters where demo_id = (select id from d1)), 3, '3 chapitres');
select is((select count(*)::int from public.steps where demo_id = (select id from d1)), 8, '8 étapes (le quiz est à part)');
select is((select count(*)::int from public.steps where demo_id = (select id from d1) and to_capture), 6, '6 étapes « À capturer »');
select is((select count(*)::int from public.quiz_questions where demo_id = (select id from d1)), 3, 'questions du quiz');
select is((select options -> 'animation' ->> 'type' from public.steps where demo_id = (select id from d1) and title = 'Remplir le formulaire'),
  'typing', 'saisie animée');
select is((select options ->> 'display' from public.steps where demo_id = (select id from d1) and title = 'Récapitulatif'),
  'popup', 'pop-up');
select ok((select h.title from public.hotspots h join public.steps s on s.id = h.step_id
  where s.demo_id = (select id from d1) and s.title = 'Se connecter') like '%{{first_name}}%', 'bulle avec variable');

-- Publication bloquée tant qu'il reste des étapes à capturer
reset role;
select throws_like($$ insert into public.demo_versions (demo_id, workspace_id, number, manifest)
  values ((select id from d1), (select ws from ctx), 1, '{}') $$, 'TO_CAPTURE:6', 'publication bloquée (6 étapes)');
select pg_temp.login('00000000-0000-0000-0000-0000000040a1');
update public.steps set image_path = (select ws from ctx)::text || '/' || (select id from d1)::text || '/s.webp',
  image_width = 1280, image_height = 800
  where demo_id = (select id from d1) and title = 'Se connecter';
select is((select count(*)::int from public.steps where demo_id = (select id from d1) and to_capture), 5, 'image posée : étape capturée');

-- Enregistrer comme modèle : sans les captures, rien de la démo d'origine
create temp table t1 as select public.save_demo_as_template((select id from d1), 'Procédure DSI',
  'Structure commune', 'procedure', false) as id;
grant all on t1 to authenticated;
select ok((select structure::text from public.demo_templates where id = (select id from t1)) !~ '\.webp',
  'sans les captures : aucune image copiée');
create temp table d2 as select public.create_demo_from_template((select id from t1), (select ws from ctx)) as id;
grant all on d2 to authenticated;
select is((select count(*)::int from public.steps where demo_id = (select id from d2) and to_capture), 6,
  'depuis le modèle de l’espace : toutes les captures à refaire');
-- Avec les captures, comme exemple : bilan RGPD obligatoire, aucun chemin partagé
select throws_like($$ select public.save_demo_as_template((select id from d1), 'Exemple', '', 'logiciel', true) $$,
  'GDPR_ACK_REQUIRED', 'avec les captures : bilan RGPD obligatoire');
create temp table t2 as select public.save_demo_as_template((select id from d1), 'Exemple', '', 'logiciel', true, true) as id;
grant all on t2 to authenticated;
create temp table r3 as select public.create_demo_from_template((select id from t2), (select ws from ctx)) as r;
grant all on r3 to authenticated;
select is((select count(*)::int from public.steps where demo_id = (select r from r3) and image_path is not null), 0,
  'avec les captures : aucun chemin d’image partagé');
select is((select count(*)::int from public.steps where demo_id = (select r from r3) and options ? 'templateImage'), 1,
  'avec les captures : une image à copier');
-- Images du modèle rangées dans son dossier
select throws_like($$ select public.template_set_images((select id from t2),
  jsonb_build_object((select ws from ctx)::text || '/' || (select id from d1)::text || '/s.webp', 'ailleurs/x.webp')) $$,
  'MAP_INVALID', 'images du modèle : dossier contrôlé');
select lives_ok($$ select public.template_set_images((select id from t2),
  jsonb_build_object((select ws from ctx)::text || '/' || (select id from d1)::text || '/s.webp',
                     (select ws from ctx)::text || '/templates/' || (select id from t2)::text || '/1.webp')) $$,
  'images du modèle : chemin remplacé');
select ok((select structure::text from public.demo_templates where id = (select id from t2)) ~ '/templates/',
  'images du modèle : dans son dossier');

-- Lecteur : voit le modèle de l'espace, ne le supprime pas
select pg_temp.login('00000000-0000-0000-0000-0000000040a2');
select is((select count(*)::int from public.demo_templates where workspace_id is not null), 2, 'lecteur : modèles de l’espace visibles');
delete from public.demo_templates where id = (select id from t1);
select is((select count(*)::int from public.demo_templates where id = (select id from t1)), 1, 'lecteur : suppression sans effet');

-- Autre espace : ni lecture ni usage
select pg_temp.login('00000000-0000-0000-0000-0000000040a3');
select is((select count(*)::int from public.demo_templates where workspace_id is not null), 0, 'autre espace : rien');
select throws_ok($$ select public.create_demo_from_template((select id from t1), (select ws from ctx2)) $$,
  'P0001', 'TEMPLATE_NOT_FOUND', 'autre espace : modèle introuvable');

-- Éditrice : renomme puis supprime
select pg_temp.login('00000000-0000-0000-0000-0000000040a1');
update public.demo_templates set name = 'Procédure DSI (v2)' where id = (select id from t1);
delete from public.demo_templates where id = (select id from t2);
select is((select string_agg(name, ',') from public.demo_templates where workspace_id = (select ws from ctx)),
  'Procédure DSI (v2)', 'éditrice : renommer et supprimer');

select * from finish();
rollback;
