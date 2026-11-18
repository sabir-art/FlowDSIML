-- Tests pgTAP : L12-07 étiquettes des démos (droits, limites, cohérence de workspace).
begin;
set search_path = public, extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'editrice@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'lecteur2@example.com'),
  ('00000000-0000-0000-0000-0000000000a3', 'autre@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
create temp table ctx as select (public.create_workspace('Étiquettes')).id as ws;
grant all on ctx to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
create temp table ctx2 as select (public.create_workspace('Autre')).id as ws;
grant all on ctx2 to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000000a2', 'viewer');
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-0000000000e7', (select ws from ctx), 'Fiche usager', '00000000-0000-0000-0000-0000000000a1');

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
insert into public.tags (id, workspace_id, name, color) values
  ('00000000-0000-0000-0000-00000000aa01', (select ws from ctx), 'Logiciel métier', 'blue');
select throws_ok($$ insert into public.tags (workspace_id, name) values ((select ws from ctx), 'logiciel MÉTIER ') $$,
  '23505', null, 'nom unique sans tenir compte de la casse ni des espaces');
select throws_ok($$ insert into public.tags (workspace_id, name, color) values ((select ws from ctx), 'Rouge', 'red') $$,
  '23514', null, 'couleur limitée à la palette DSI');
insert into public.demo_tags (demo_id, tag_id, workspace_id)
  values ('00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-00000000aa01', (select ws from ctx));
select is((select count(*)::int from public.demo_tags), 1, 'une éditrice étiquette une démo');

-- Lecteur : pas de création (vérifié avant d'atteindre les limites)
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$ insert into public.tags (workspace_id, name) values ((select ws from ctx), 'Lecteur') $$,
  '42501', null, 'un lecteur ne crée pas d''étiquette');
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

-- 5 étiquettes au plus par démo
insert into public.tags (workspace_id, name) select (select ws from ctx), 'T' || i from generate_series(1, 5) i;
insert into public.demo_tags (demo_id, tag_id, workspace_id)
  select '00000000-0000-0000-0000-0000000000e7', id, workspace_id from public.tags where name in ('T1', 'T2', 'T3', 'T4');
select throws_ok($$ insert into public.demo_tags (demo_id, tag_id, workspace_id)
  select '00000000-0000-0000-0000-0000000000e7', id, workspace_id from public.tags where name = 'T5' $$,
  'P0001', 'DEMO_TAG_LIMIT', '5 étiquettes au plus par démo');

-- 20 au plus par workspace
insert into public.tags (workspace_id, name) select (select ws from ctx), 'U' || i from generate_series(1, 14) i;
select throws_ok($$ insert into public.tags (workspace_id, name) values ((select ws from ctx), 'Une de trop') $$,
  'P0001', 'TAG_LIMIT', '20 étiquettes au plus par workspace');

-- Lecteur : lit, n'écrit pas
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.tags), 20, 'un lecteur voit les étiquettes');
update public.tags set name = 'Renommée' where id = '00000000-0000-0000-0000-00000000aa01';
reset role;
select is((select name from public.tags where id = '00000000-0000-0000-0000-00000000aa01'), 'Logiciel métier',
  'un lecteur ne renomme pas');

-- Autre workspace : rien de visible, pas d'association croisée
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from public.tags where workspace_id = (select ws from ctx)), 0,
  'étiquettes invisibles hors du workspace');
insert into public.tags (id, workspace_id, name) values ('00000000-0000-0000-0000-00000000aa99', (select ws from ctx2), 'Ailleurs');
select throws_ok($$ insert into public.demo_tags (demo_id, tag_id, workspace_id)
  values ('00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-00000000aa99', (select ws from ctx2)) $$,
  'P0001', 'TAG_WORKSPACE', 'pas d''étiquette d''un autre workspace sur une démo');
reset role;

select * from finish();
rollback;
