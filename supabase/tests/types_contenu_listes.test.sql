-- Tests pgTAP : L48-G, demo_step_counts (type de contenu dans Analytics et Parcours).
begin;
set search_path = public, extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000095a1', 'types-listes@example.com'),
  ('00000000-0000-0000-0000-0000000095a2', 'types-listes-autre@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000095a1');
create temp table ctx as select (public.create_workspace('Types listes')).id as ws;
grant all on ctx to authenticated, service_role;
reset role;
insert into public.demos (id, workspace_id, title) values
  ('00000000-0000-0000-0000-0000000095d1', (select ws from ctx), 'Captures'),
  ('00000000-0000-0000-0000-0000000095d2', (select ws from ctx), 'Pages HTML');
insert into public.demos (id, workspace_id, title, deleted_at) values
  ('00000000-0000-0000-0000-0000000095d3', (select ws from ctx), 'Supprimée', now());
insert into public.steps (id, demo_id, workspace_id, position, kind) values
  ('00000000-0000-0000-0000-0000000095b1', '00000000-0000-0000-0000-0000000095d1', (select ws from ctx), 0, 'image'),
  ('00000000-0000-0000-0000-0000000095b2', '00000000-0000-0000-0000-0000000095d2', (select ws from ctx), 0, 'html'),
  ('00000000-0000-0000-0000-0000000095b3', '00000000-0000-0000-0000-0000000095d2', (select ws from ctx), 1, 'html'),
  ('00000000-0000-0000-0000-0000000095b4', '00000000-0000-0000-0000-0000000095d2', (select ws from ctx), 2, 'image'),
  ('00000000-0000-0000-0000-0000000095b5', '00000000-0000-0000-0000-0000000095d3', (select ws from ctx), 0, 'html');

select pg_temp.login('00000000-0000-0000-0000-0000000095a1');
create temp table c as select public.demo_step_counts((select ws from ctx)) as j;
select is((select j -> '00000000-0000-0000-0000-0000000095d2' from c), '{"n": 3, "html": 2}'::jsonb, 'démo HTML : 3 étapes dont 2 html');
select is((select j -> '00000000-0000-0000-0000-0000000095d1' from c), '{"n": 1, "html": 0}'::jsonb, 'démo par captures : 0 html');
select ok(not ((select j from c) ? '00000000-0000-0000-0000-0000000095d3'), 'démo supprimée : absente');

-- Un autre compte, hors de l'espace : rien (RLS)
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000095a2');
select is(public.demo_step_counts((select ws from ctx)), '{}'::jsonb, 'hors de l''espace : objet vide');
reset role;
set local role anon;
select throws_ok($$ select public.demo_step_counts('00000000-0000-0000-0000-000000000000') $$, '42501', null, 'anon : refusé');

select * from finish();
rollback;
