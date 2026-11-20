-- Tests pgTAP : L30 065/066, quota mensuel en secondes d'audio (voix de synthèse, sous-titres automatiques).
begin;
set search_path = public, extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000301a1', 'olga-au@acme.example'),
  ('00000000-0000-0000-0000-0000000301a2', 'eddie-au@acme.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000301a1');
create temp table ctx as select (public.create_workspace('Audio')).id as ws;
grant all on ctx to authenticated;
select public.set_ai_settings((select ws from ctx), true);
reset role;
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000301a2', 'editor');

select ok('voice' = any (public.ai_features()) and 'captions' = any (public.ai_features()), 'fonctions voice et captions');
select is((public.ai_config((select ws from ctx)) ->> 'monthlyAudioSeconds')::int, 300, 'plan free : 300 secondes par mois');
select lives_ok($$ select public.ai_reserve((select ws from ctx), '00000000-0000-0000-0000-0000000301a2', 'voice', 200) $$,
  'réservation de 200 secondes');
select public.ai_commit((select ws from ctx), '00000000-0000-0000-0000-0000000301a2', 0, 0, false, 200);
select throws_ok($$ select public.ai_reserve((select ws from ctx), '00000000-0000-0000-0000-0000000301a2', 'captions', 120) $$,
  'P0001', 'AI_QUOTA_WORKSPACE', 'au-delà du quota audio : refusé');
select lives_ok($$ select public.ai_reserve((select ws from ctx), '00000000-0000-0000-0000-0000000301a2', 'write') $$,
  'fonctions texte : non concernées par le quota audio');
select throws_ok($$ select public.ai_commit((select ws from ctx), '00000000-0000-0000-0000-0000000301a2', 0, 0, false, -5) $$,
  '22023', null, 'secondes négatives refusées');
select pg_temp.login('00000000-0000-0000-0000-0000000301a2');
select is((public.ai_status((select ws from ctx)) ->> 'audioUsed')::int, 200, 'état : secondes utilisées');

select * from finish();
rollback;
