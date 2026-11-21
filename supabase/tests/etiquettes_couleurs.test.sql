-- Tests pgTAP : L52 P1, 8 couleurs d'étiquettes.
begin;
set search_path = public, extensions;
select plan(3);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000052a1', 'couleurs@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000052a1');
create temp table ctx as select (public.create_workspace('Couleurs')).id as ws;
grant all on ctx to authenticated;

select lives_ok($$
  insert into public.tags (workspace_id, name, color)
  select (select ws from ctx), c, c from unnest(array['blue','green','orange','raspberry','plum','slate','teal','violet']) c
$$, 'les 8 couleurs sont acceptées');
select is((select count(*)::int from public.tags where workspace_id = (select ws from ctx)), 8, '8 étiquettes créées');
select throws_ok($$ insert into public.tags (workspace_id, name, color) values ((select ws from ctx), 'Rouge', 'red') $$,
  '23514', null, 'couleur hors palette refusée');

select * from finish();
rollback;
