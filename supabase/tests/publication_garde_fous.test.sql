-- Tests pgTAP : garde-fous de publication et de dossier à l'écriture (migration 20261130090000).
-- Création d'une démo toujours en brouillon, contrôles de finalize_publication, dossiers restreints à
-- l'insertion et à la modification. Données fictives.
begin;
set search_path = public, extensions;
select plan(28);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000091a1', 'admin-garde@example.com'),
  ('00000000-0000-0000-0000-0000000091a2', 'editrice-autorisee-garde@example.com'),
  ('00000000-0000-0000-0000-0000000091a3', 'editeur-exclu-garde@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000091a1');
create temp table ctx as select (public.create_workspace('Garde-fous')).id as ws;
grant all on ctx to authenticated, service_role;
reset role;
update public.workspaces set plan_code = 'enterprise', public_links_enabled = true where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000091a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000091a3', 'editor');
insert into public.folders (id, workspace_id, name) values
  ('00000000-0000-0000-0000-0000000091f1', (select ws from ctx), 'RH');
-- d1 : dans le dossier (bientôt restreint), publiée puis dépubliée ; d2 : à la racine, deux versions
insert into public.demos (id, workspace_id, folder_id, title) values
  ('00000000-0000-0000-0000-0000000091d1', (select ws from ctx), '00000000-0000-0000-0000-0000000091f1', 'Entretiens'),
  ('00000000-0000-0000-0000-0000000091d2', (select ws from ctx), null, 'Accueil'),
  ('00000000-0000-0000-0000-0000000091d3', (select ws from ctx), null, 'Supprimée');
update public.demos set deleted_at = now() where id = '00000000-0000-0000-0000-0000000091d3';
insert into public.demo_versions (id, demo_id, workspace_id, number, manifest) values
  ('00000000-0000-0000-0000-0000000091e1', '00000000-0000-0000-0000-0000000091d1', (select ws from ctx), 1, '{}'),
  ('00000000-0000-0000-0000-0000000091e2', '00000000-0000-0000-0000-0000000091d2', (select ws from ctx), 1, '{}'),
  ('00000000-0000-0000-0000-0000000091e3', '00000000-0000-0000-0000-0000000091d2', (select ws from ctx), 2, '{}'),
  ('00000000-0000-0000-0000-0000000091e4', '00000000-0000-0000-0000-0000000091d3', (select ws from ctx), 1, '{}');
insert into public.steps (id, demo_id, workspace_id, position, image_path) values
  ('00000000-0000-0000-0000-0000000091b1', '00000000-0000-0000-0000-0000000091d1', (select ws from ctx), 0, 'x/1.webp'),
  ('00000000-0000-0000-0000-0000000091b2', '00000000-0000-0000-0000-0000000091d2', (select ws from ctx), 0, 'x/2.webp');

-- ===== 1. Création directe : toujours en brouillon =====
select pg_temp.login('00000000-0000-0000-0000-0000000091a2');
select throws_ok($$ insert into public.demos (workspace_id, title, status) values ((select ws from ctx), 'Directe', 'published') $$,
  '42501', null, 'création directe avec le statut « publiée » : refusée');
select throws_ok($$ insert into public.demos (workspace_id, title, current_version_id)
                    values ((select ws from ctx), 'Directe', '00000000-0000-0000-0000-0000000091e2') $$,
  '42501', null, 'création directe avec une version en ligne : refusée');
select lives_ok($$ insert into public.demos (id, workspace_id, title)
                   values ('00000000-0000-0000-0000-0000000091d9', (select ws from ctx), 'Brouillon') $$,
  'création directe en brouillon : acceptée');
select is((select status::text from public.demos where id = '00000000-0000-0000-0000-0000000091d9'), 'draft',
  'la démo créée est un brouillon');
select lives_ok($$ select public.duplicate_demo('00000000-0000-0000-0000-0000000091d2') $$,
  'dupliquer une démo fonctionne toujours');

-- ===== 2. finalize_publication =====
select throws_ok($$ select public.finalize_publication('00000000-0000-0000-0000-0000000091e2') $$,
  'P0001', 'VERSION_OUTDATED', 'une ancienne version ne peut pas être remise en ligne');
select throws_ok($$ select public.finalize_publication('00000000-0000-0000-0000-0000000091e4') $$,
  null, 'DEMO_NOT_FOUND', 'démo supprimée : refusée');
select lives_ok($$ select public.finalize_publication('00000000-0000-0000-0000-0000000091e3') $$,
  'dernière version, règle par défaut : une éditrice met en ligne');
select is((select status::text || ':' || current_version_id from public.demos where id = '00000000-0000-0000-0000-0000000091d2'),
  'published:00000000-0000-0000-0000-0000000091e3', 'la démo est publiée sur sa dernière version');

-- Règle « seuls les administrateurs publient », puis dépublication par l'admin
select pg_temp.login('00000000-0000-0000-0000-0000000091a1');
select public.set_share_rules((select ws from ctx), array['link', 'password'], null, 'admin', true);
select public.unpublish_demo('00000000-0000-0000-0000-0000000091d2');
select pg_temp.login('00000000-0000-0000-0000-0000000091a2');
select throws_ok($$ select public.finalize_publication('00000000-0000-0000-0000-0000000091e3') $$,
  '42501', 'RULE_PUBLISH', 'règle admin : une éditrice ne remet pas en ligne une démo dépubliée');
select is((select status::text from public.demos where id = '00000000-0000-0000-0000-0000000091d2'), 'draft',
  'la démo reste dépubliée');
select pg_temp.login('00000000-0000-0000-0000-0000000091a1');
select lives_ok($$ select public.finalize_publication('00000000-0000-0000-0000-0000000091e3') $$,
  'règle admin : l''admin met en ligne');
select public.set_share_rules((select ws from ctx), array['link', 'password'], null, 'editor', true);

-- Limite du plan : 3 démos publiées en Free
reset role;
update public.workspaces set plan_code = 'free' where id = (select ws from ctx);
insert into public.demos (workspace_id, title, status) values
  ((select ws from ctx), 'Publiée 2', 'published'), ((select ws from ctx), 'Publiée 3', 'published');
select pg_temp.login('00000000-0000-0000-0000-0000000091a2');
select throws_ok($$ select public.finalize_publication('00000000-0000-0000-0000-0000000091e1') $$,
  'P0001', 'PLAN_LIMIT:published_demos', 'limite du plan atteinte : refusée');
reset role;
update public.workspaces set plan_code = 'enterprise' where id = (select ws from ctx);

-- ===== 3. Dossier restreint : l'éditeur exclu n'écrit pas dedans =====
select pg_temp.login('00000000-0000-0000-0000-0000000091a1');
select public.set_folder_access('00000000-0000-0000-0000-0000000091f1', true,
  array['00000000-0000-0000-0000-0000000091a2']::uuid[]);
select pg_temp.login('00000000-0000-0000-0000-0000000091a3');
select throws_ok($$ select public.finalize_publication('00000000-0000-0000-0000-0000000091e1') $$,
  null, 'DEMO_NOT_FOUND', 'éditeur exclu : ne met pas en ligne une démo du dossier');
select throws_ok($$ insert into public.steps (demo_id, workspace_id, position, image_path)
                    values ('00000000-0000-0000-0000-0000000091d1', (select ws from ctx), 5, 'x/9.webp') $$,
  '42501', null, 'éditeur exclu : pas d''étape dans une démo du dossier');
select throws_ok($$ insert into public.share_links (demo_id, workspace_id, name, token)
                    values ('00000000-0000-0000-0000-0000000091d1', (select ws from ctx), 'Lien', 'jeton-fictif-0001') $$,
  '42501', null, 'éditeur exclu : pas de lien de partage sur une démo du dossier');
select throws_ok($$ insert into public.chapters (demo_id, workspace_id, title, position)
                    values ('00000000-0000-0000-0000-0000000091d1', (select ws from ctx), 'Chapitre', 0) $$,
  '42501', null, 'éditeur exclu : pas de chapitre dans une démo du dossier');
select throws_ok($$ insert into public.quiz_questions (demo_id, workspace_id, prompt)
                    values ('00000000-0000-0000-0000-0000000091d1', (select ws from ctx), 'Question ?') $$,
  '42501', null, 'éditeur exclu : pas de question de quiz dans une démo du dossier');
select throws_ok($$ update public.steps set demo_id = '00000000-0000-0000-0000-0000000091d1'
                     where id = '00000000-0000-0000-0000-0000000091b2' $$,
  '42501', null, 'éditeur exclu : ne déplace pas une étape vers une démo du dossier');
select throws_ok($$ insert into public.demos (workspace_id, folder_id, title)
                    values ((select ws from ctx), '00000000-0000-0000-0000-0000000091f1', 'Intruse') $$,
  '42501', null, 'éditeur exclu : pas de démo créée dans le dossier');
select throws_ok($$ update public.demos set folder_id = '00000000-0000-0000-0000-0000000091f1'
                     where id = '00000000-0000-0000-0000-0000000091d9' $$,
  '42501', null, 'éditeur exclu : ne range pas une démo dans le dossier');
select throws_ok($$ insert into public.folders (workspace_id, parent_id, name)
                    values ((select ws from ctx), '00000000-0000-0000-0000-0000000091f1', 'Sous-dossier') $$,
  '42501', null, 'éditeur exclu : pas de sous-dossier dans le dossier');

-- L'éditrice autorisée écrit toujours
select pg_temp.login('00000000-0000-0000-0000-0000000091a2');
select lives_ok($$ insert into public.steps (demo_id, workspace_id, position, image_path)
                   values ('00000000-0000-0000-0000-0000000091d1', (select ws from ctx), 5, 'x/9.webp') $$,
  'éditrice autorisée : ajoute une étape dans le dossier');
select lives_ok($$ insert into public.demos (workspace_id, folder_id, title)
                   values ((select ws from ctx), '00000000-0000-0000-0000-0000000091f1', 'Légitime') $$,
  'éditrice autorisée : crée une démo dans le dossier');

-- ===== 4. Rôle de service (Edge Functions html-ingest, html-recheck) : visibilité par membre =====
reset role;
select ok(has_function_privilege('service_role', 'public.demo_visible_to(uuid, uuid)', 'execute'),
  'service : demo_visible_to est appelable');
select ok(not has_function_privilege('authenticated', 'public.demo_visible_to(uuid, uuid)', 'execute'),
  'membre : demo_visible_to reste fermée');
set local role service_role;
select is(public.demo_visible_to('00000000-0000-0000-0000-0000000091d1', '00000000-0000-0000-0000-0000000091a3'), false,
  'éditeur exclu : la démo du dossier restreint ne lui est pas visible');
select is(public.demo_visible_to('00000000-0000-0000-0000-0000000091d1', '00000000-0000-0000-0000-0000000091a2'), true,
  'éditrice autorisée : la démo lui est visible');
reset role;

select * from finish();
rollback;
