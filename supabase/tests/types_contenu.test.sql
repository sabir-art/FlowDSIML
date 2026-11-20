-- Tests pgTAP : L48-G (types de contenu). dashboard_home compte les étapes HTML de chaque démo.
begin;
set search_path = public, extensions;
select plan(3);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000094a1', 'types-contenu@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000094a1');
create temp table ctx as select (public.create_workspace('Types')).id as ws;
grant all on ctx to authenticated, service_role;
reset role;
insert into public.demos (id, workspace_id, title) values
  ('00000000-0000-0000-0000-0000000094d1', (select ws from ctx), 'Captures'),
  ('00000000-0000-0000-0000-0000000094d2', (select ws from ctx), 'Pages HTML');
insert into public.steps (id, demo_id, workspace_id, position, kind) values
  ('00000000-0000-0000-0000-0000000094b1', '00000000-0000-0000-0000-0000000094d1', (select ws from ctx), 0, 'image'),
  ('00000000-0000-0000-0000-0000000094b2', '00000000-0000-0000-0000-0000000094d2', (select ws from ctx), 0, 'html'),
  ('00000000-0000-0000-0000-0000000094b3', '00000000-0000-0000-0000-0000000094d2', (select ws from ctx), 1, 'html'),
  ('00000000-0000-0000-0000-0000000094b4', '00000000-0000-0000-0000-0000000094d2', (select ws from ctx), 2, 'image');

select pg_temp.login('00000000-0000-0000-0000-0000000094a1');
create temp table h as select public.dashboard_home((select ws from ctx)) as j;
select is((select (j -> 'htmlCounts' ->> '00000000-0000-0000-0000-0000000094d2')::int from h), 2, 'démo HTML : 2 étapes html');
select ok(not ((select j -> 'htmlCounts' from h) ? '00000000-0000-0000-0000-0000000094d1'), 'démo par captures : absente');
select is((select (j -> 'stepCounts' ->> '00000000-0000-0000-0000-0000000094d2')::int from h), 3, 'stepCounts inchangé');

select * from finish();
rollback;
