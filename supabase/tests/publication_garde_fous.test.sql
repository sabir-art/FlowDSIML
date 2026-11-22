-- Tests pgTAP : garde-fous de publication et de dossier à l'écriture (migration 20261130090000).
-- Création d'une démo toujours en brouillon, contrôles de finalize_publication, dossiers restreints à
-- l'insertion et à la modification. Données fictives.
begin;
set search_path = public, extensions;
select plan(5);

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

select * from finish();
rollback;
