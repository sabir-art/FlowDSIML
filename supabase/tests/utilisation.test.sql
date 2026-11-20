-- Tests pgTAP : L48-A §6 workspace_usage (page Utilisation), stockage réel par type.
begin;
set search_path = public, extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'admin@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'autre@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
create temp table ctx as select (public.create_workspace('Utilisation')).id as ws;
grant all on ctx to authenticated;

reset role;
insert into storage.objects (bucket_id, name, metadata) values
  ('media', (select ws from ctx)::text || '/a.png', '{"size": 1000}'),
  ('media', (select ws from ctx)::text || '/b.png', '{"size": 500}'),
  ('videos', (select ws from ctx)::text || '/c.mp4', '{"size": 2000}'),
  ('voices', (select ws from ctx)::text || '/d.mp3', '{"size": 300}'),
  ('media', '00000000-0000-0000-0000-00000000ffff/e.png', '{"size": 9999}');

select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
create temp table u as select public.workspace_usage((select ws from ctx)) as j;
select is(((select j from u)->'storage'->>'media')::bigint, 1500::bigint, 'médiathèque : fichiers de l''espace seulement');
select is(((select j from u)->'storage'->>'videos')::bigint, 2000::bigint, 'vidéos');
select is(((select j from u)->'storage'->>'voices')::bigint, 300::bigint, 'voix off');
select is(((select j from u)->'storage'->>'limit')::bigint, 524288000::bigint, 'limite de 500 Mo');
select is(((select j from u)->>'members')::int, 1, 'membres toujours comptés');

select pg_temp.login('00000000-0000-0000-0000-0000000000c2');
select throws_ok($$ select public.workspace_usage((select ws from ctx)) $$, '42501', 'Accès refusé', 'hors de l''espace : refusé');

select * from finish();
rollback;
