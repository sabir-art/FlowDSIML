-- Tests pgTAP : L52 P3, merge_tags (droits, autre espace refusé, doublons, limite de 5).
begin;
set search_path = public, extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000053a1', 'fusion-editrice@example.com'),
  ('00000000-0000-0000-0000-0000000053a2', 'fusion-lecteur@example.com'),
  ('00000000-0000-0000-0000-0000000053a3', 'fusion-autre@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000053a1');
create temp table ctx as select (public.create_workspace('Fusion')).id as ws;
grant all on ctx to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000053a3');
create temp table ctx2 as select (public.create_workspace('Autre espace')).id as ws;
grant all on ctx2 to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000053a2', 'viewer');
insert into public.demos (id, workspace_id, title) values
  ('00000000-0000-0000-0000-0000000053d1', (select ws from ctx), 'A'),
  ('00000000-0000-0000-0000-0000000053d2', (select ws from ctx), 'B'),
  ('00000000-0000-0000-0000-0000000053d3', (select ws from ctx), 'C');
insert into public.tags (id, workspace_id, name, color) values
  ('00000000-0000-0000-0000-0000000053f1', (select ws from ctx), 'Outil métier', 'orange'),
  ('00000000-0000-0000-0000-0000000053f2', (select ws from ctx), 'Outil CRM', 'violet'),
  ('00000000-0000-0000-0000-0000000053f3', (select ws from ctx), 'T3', 'blue'),
  ('00000000-0000-0000-0000-0000000053f4', (select ws from ctx), 'T4', 'blue'),
  ('00000000-0000-0000-0000-0000000053f5', (select ws from ctx), 'T5', 'blue'),
  ('00000000-0000-0000-0000-0000000053f6', (select ws from ctx2), 'Ailleurs', 'blue');
-- A : Outil métier seul ; B : les deux (doublon) ; C : 5 étiquettes dont Outil métier, sans Outil CRM
insert into public.demo_tags (demo_id, tag_id, workspace_id) values
  ('00000000-0000-0000-0000-0000000053d1', '00000000-0000-0000-0000-0000000053f1', (select ws from ctx)),
  ('00000000-0000-0000-0000-0000000053d2', '00000000-0000-0000-0000-0000000053f1', (select ws from ctx)),
  ('00000000-0000-0000-0000-0000000053d2', '00000000-0000-0000-0000-0000000053f2', (select ws from ctx)),
  ('00000000-0000-0000-0000-0000000053d3', '00000000-0000-0000-0000-0000000053f1', (select ws from ctx)),
  ('00000000-0000-0000-0000-0000000053d3', '00000000-0000-0000-0000-0000000053f3', (select ws from ctx)),
  ('00000000-0000-0000-0000-0000000053d3', '00000000-0000-0000-0000-0000000053f4', (select ws from ctx)),
  ('00000000-0000-0000-0000-0000000053d3', '00000000-0000-0000-0000-0000000053f5', (select ws from ctx));
insert into public.tags (id, workspace_id, name, color) values
  ('00000000-0000-0000-0000-0000000053f7', (select ws from ctx), 'T6', 'blue');
insert into public.demo_tags (demo_id, tag_id, workspace_id) values
  ('00000000-0000-0000-0000-0000000053d3', '00000000-0000-0000-0000-0000000053f7', (select ws from ctx));

-- Droits
select pg_temp.login('00000000-0000-0000-0000-0000000053a2');
select throws_ok($$ select public.merge_tags('00000000-0000-0000-0000-0000000053f1', '00000000-0000-0000-0000-0000000053f2') $$,
  '42501', null, 'un lecteur ne fusionne pas');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000053a3');
select throws_ok($$ select public.merge_tags('00000000-0000-0000-0000-0000000053f1', '00000000-0000-0000-0000-0000000053f2') $$,
  '42501', null, 'hors de l''espace : refusé');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000053a1');
select throws_ok($$ select public.merge_tags('00000000-0000-0000-0000-0000000053f1', '00000000-0000-0000-0000-0000000053f6') $$,
  'P0001', 'TAG_WORKSPACE', 'étiquette d''un autre espace : refusé');
select throws_ok($$ select public.merge_tags('00000000-0000-0000-0000-0000000053f1', '00000000-0000-0000-0000-0000000053f1') $$,
  '22023', 'TAG_MERGE_SAME', 'fusion avec elle-même : refusée');

-- Fusion
select is(public.merge_tags('00000000-0000-0000-0000-0000000053f1', '00000000-0000-0000-0000-0000000053f2'), 3,
  'renvoie le nombre de démos de l''étiquette fusionnée');
select ok(not exists (select 1 from public.tags where id = '00000000-0000-0000-0000-0000000053f1'), '« Outil métier » supprimée');
select is((select count(*)::int from public.demo_tags where tag_id = '00000000-0000-0000-0000-0000000053f2'), 3,
  'les 3 démos ont « Outil CRM »');
select is((select count(*)::int from public.demo_tags where demo_id = '00000000-0000-0000-0000-0000000053d2'), 1,
  'doublon : la démo B n''a qu''une fois « Outil CRM »');
select is((select count(*)::int from public.demo_tags where demo_id = '00000000-0000-0000-0000-0000000053d3'), 5,
  'démo à 5 étiquettes : toujours 5 (remplacement, pas d''ajout)');
reset role;
select is((select count(*)::int from public.tags where workspace_id = (select ws from ctx2)), 1, 'l''autre espace est intact');

select * from finish();
rollback;
