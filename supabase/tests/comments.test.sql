-- Tests pgTAP : commentaires internes par étape (step_comments).
begin;
set search_path = public, extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'olga@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'eddie@example.com'),
  ('00000000-0000-0000-0000-0000000000c3', 'vera@example.com'),
  ('00000000-0000-0000-0000-0000000000c4', 'xavier@example.com');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Olga (owner) crée un workspace, une démo et deux étapes ; Eddie éditeur, Vera lectrice.
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
create temp table ctx as select (public.create_workspace('Commentaires')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-00000000cd01', (select ws from ctx), 'Démo', auth.uid());
insert into public.steps (id, demo_id, workspace_id, position, title) values
  ('00000000-0000-0000-0000-00000000c501', '00000000-0000-0000-0000-00000000cd01', (select ws from ctx), 0, 'Étape 1'),
  ('00000000-0000-0000-0000-00000000c502', '00000000-0000-0000-0000-00000000cd01', (select ws from ctx), 1, 'Étape 2');
select pg_temp.logout();
update public.workspaces set plan_code = 'pro' where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000000c2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000000c3', 'viewer');

-- Vera (viewer) commente : contexte dérivé de l'étape, auteur forcé à elle-même
select pg_temp.login('00000000-0000-0000-0000-0000000000c3');
insert into public.step_comments (id, step_id, body, author_id, workspace_id, demo_id)
  values ('00000000-0000-0000-0000-00000000cc01', '00000000-0000-0000-0000-00000000c501', 'Texte confidentiel à revoir',
          '00000000-0000-0000-0000-0000000000c1', gen_random_uuid(), gen_random_uuid());
select is((select author_id from public.step_comments where id = '00000000-0000-0000-0000-00000000cc01'),
  '00000000-0000-0000-0000-0000000000c3'::uuid, 'un lecteur peut commenter, en son nom (auteur non usurpable)');
select is((select workspace_id from public.step_comments where id = '00000000-0000-0000-0000-00000000cc01'),
  (select ws from ctx), 'workspace_id dérivé de l''étape');
select is((select demo_id from public.step_comments where id = '00000000-0000-0000-0000-00000000cc01'),
  '00000000-0000-0000-0000-00000000cd01'::uuid, 'demo_id dérivé de l''étape');
select throws_ok($$ insert into public.step_comments (step_id, body) values ('00000000-0000-0000-0000-00000000c501', '   ') $$,
  '23514', null, 'commentaire vide refusé');
select lives_ok($$ update public.step_comments set body = 'Texte confidentiel (modifié)' where id = '00000000-0000-0000-0000-00000000cc01' $$,
  'l''auteur modifie son commentaire');
select throws_ok($$ update public.step_comments set resolved_at = now() where id = '00000000-0000-0000-0000-00000000cc01' $$,
  '42501', null, 'resolved_at ne se modifie pas directement');
select throws_ok($$ update public.step_comments set step_id = '00000000-0000-0000-0000-00000000c502' where id = '00000000-0000-0000-0000-00000000cc01' $$,
  '42501', null, 'un commentaire ne change pas d''étape');
select lives_ok($$ select public.set_comment_resolved('00000000-0000-0000-0000-00000000cc01', true) $$, 'l''auteur (lecteur) résout son commentaire');

-- Eddie (éditeur) : lit, rouvre, mais ne modifie ni ne supprime le commentaire de Vera
select pg_temp.login('00000000-0000-0000-0000-0000000000c2');
select is((select count(*)::int from public.step_comments), 1, 'un éditeur lit les commentaires');
select lives_ok($$ select public.set_comment_resolved('00000000-0000-0000-0000-00000000cc01', false) $$, 'un éditeur rouvre un commentaire');
update public.step_comments set body = 'piraté' where id = '00000000-0000-0000-0000-00000000cc01';
delete from public.step_comments where id = '00000000-0000-0000-0000-00000000cc01';
select is((select body from public.step_comments where id = '00000000-0000-0000-0000-00000000cc01'),
  'Texte confidentiel (modifié)', 'un éditeur ne modifie ni ne supprime le commentaire d''un autre');

-- Xavier (hors workspace) : aucun accès
select pg_temp.login('00000000-0000-0000-0000-0000000000c4');
select is((select count(*)::int from public.step_comments), 0, 'un non-membre ne lit rien');
select throws_ok($$ insert into public.step_comments (step_id, body) values ('00000000-0000-0000-0000-00000000c501', 'intrus') $$,
  '42501', null, 'un non-membre ne commente pas');
select throws_ok($$ select public.set_comment_resolved('00000000-0000-0000-0000-00000000cc01', true) $$,
  '42501', null, 'un non-membre ne résout pas');

-- Jamais dans le manifeste publié
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select ok(position('confidentiel' in public.publish_demo('00000000-0000-0000-0000-00000000cd01')::text) = 0,
  'les commentaires ne sont jamais publiés dans le manifeste');

-- Owner : supprime le commentaire d'un autre ; suppression de l'étape → commentaires supprimés
select lives_ok($$ delete from public.step_comments where id = '00000000-0000-0000-0000-00000000cc01' $$, 'l''owner supprime le commentaire d''un autre');
insert into public.step_comments (step_id, body) values ('00000000-0000-0000-0000-00000000c502', 'à supprimer avec l''étape');
delete from public.steps where id = '00000000-0000-0000-0000-00000000c502';
select is((select count(*)::int from public.step_comments), 0, 'commentaires supprimés avec leur étape');

select pg_temp.logout();
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'step_comments'),
  'table publiée pour Supabase Realtime');

select * from finish();
rollback;
