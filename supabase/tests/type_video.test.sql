-- Tests pgTAP : EXT-02 §4.1, demo_step_counts compte aussi les étapes vidéo (type de contenu « Vidéo »).
begin;
set search_path = public, extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000096a1', 'type-video@example.com'),
  ('00000000-0000-0000-0000-0000000096a2', 'type-video-autre@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000096a1');
create temp table ctx as select (public.create_workspace('Type vidéo')).id as ws;
grant all on ctx to authenticated, service_role;
reset role;
insert into public.demos (id, workspace_id, title) values
  ('00000000-0000-0000-0000-0000000096d1', (select ws from ctx), 'Vidéo'),
  ('00000000-0000-0000-0000-0000000096d2', (select ws from ctx), 'Captures et une vidéo');
insert into public.demos (id, workspace_id, title, deleted_at) values
  ('00000000-0000-0000-0000-0000000096d3', (select ws from ctx), 'Supprimée', now());
insert into public.steps (id, demo_id, workspace_id, position, kind) values
  ('00000000-0000-0000-0000-0000000096b1', '00000000-0000-0000-0000-0000000096d1', (select ws from ctx), 0, 'video'),
  ('00000000-0000-0000-0000-0000000096b2', '00000000-0000-0000-0000-0000000096d2', (select ws from ctx), 0, 'image'),
  ('00000000-0000-0000-0000-0000000096b3', '00000000-0000-0000-0000-0000000096d2', (select ws from ctx), 1, 'image'),
  ('00000000-0000-0000-0000-0000000096b4', '00000000-0000-0000-0000-0000000096d2', (select ws from ctx), 2, 'video'),
  ('00000000-0000-0000-0000-0000000096b5', '00000000-0000-0000-0000-0000000096d3', (select ws from ctx), 0, 'video');

select pg_temp.login('00000000-0000-0000-0000-0000000096a1');
create temp table c as select public.demo_step_counts((select ws from ctx)) as j;
select is((select j -> '00000000-0000-0000-0000-0000000096d1' from c), '{"n": 1, "html": 0, "video": 1}'::jsonb, 'démo vidéo : 1 étape, 1 vidéo');
select is((select j -> '00000000-0000-0000-0000-0000000096d2' from c), '{"n": 3, "html": 0, "video": 1}'::jsonb, 'démo par captures avec une vidéo : 1 vidéo sur 3');
select ok(not ((select j from c) ? '00000000-0000-0000-0000-0000000096d3'), 'démo supprimée : absente');

-- Un autre compte, hors de l'espace : rien (RLS)
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000096a2');
select is(public.demo_step_counts((select ws from ctx)), '{}'::jsonb, 'hors de l''espace : objet vide');
reset role;
set local role anon;
select throws_ok($$ select public.demo_step_counts('00000000-0000-0000-0000-000000000000') $$, '42501', null, 'anon : refusé');

select * from finish();
rollback;
