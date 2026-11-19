-- Tests pgTAP : L25 purge des vidéos orphelines (liste réservée au service, 24 h, étapes citées).
begin;
set search_path = public, extensions;
select plan(6);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000025a1', 'editrice@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000025a1');
create temp table ctx as select (public.create_workspace('Purge')).id as ws;
grant all on ctx to authenticated, service_role;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000025d1', (select ws from ctx), 'Vidéo', auth.uid());
reset role;
create temp table v as select
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000025d1/00000000-0000-0000-0000-0000000025f1.webm' as used,
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000025d1/00000000-0000-0000-0000-0000000025f2.webm' as orphan_old,
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000025d1/00000000-0000-0000-0000-0000000025f3.webm' as orphan_new;
grant all on v to authenticated, service_role;
insert into storage.objects (bucket_id, name, metadata, created_at) values
  ('videos', (select used from v), '{"size": 1000}', now() - interval '3 days'),
  ('videos', (select orphan_old from v), '{"size": 1000}', now() - interval '2 days'),
  ('videos', (select orphan_new from v), '{"size": 1000}', now() - interval '2 hours'),
  ('captures', (select ws from ctx)::text || '/x.webp', '{"size": 10}', now() - interval '5 days');
insert into public.steps (demo_id, workspace_id, position, kind, title, video_path, video_duration_ms)
  values ('00000000-0000-0000-0000-0000000025d1', (select ws from ctx), 0, 'video', 'Saisie', (select used from v), 9000);

select pg_temp.login('00000000-0000-0000-0000-0000000025a1');
select throws_ok($$ select * from public.orphan_videos() $$, '42501', null, 'un membre ne liste pas les orphelins');
select throws_ok($$ select public.videos_purge_tick() $$, '42501', null, 'un membre ne lance pas la purge');
reset role;
set local role service_role;
select is((select array_agg(name) from public.orphan_videos()), array[(select orphan_old from v)],
  'orphelin de plus de 24 h listé, seul');
select is((select count(*)::int from public.orphan_videos() o where o.name = (select used from v)), 0,
  'vidéo citée par une étape jamais listée');
select is((select count(*)::int from public.orphan_videos() o where o.name like '%.webp'), 0, 'autres buckets ignorés');
reset role;
select lives_ok($$ select public.videos_purge_tick() $$, 'purge planifiée sans Vault : rien, sans erreur');

select * from finish();
rollback;
