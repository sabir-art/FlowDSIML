-- Tests pgTAP : L30 065/066, quota mensuel en secondes d'audio (voix de synthèse, sous-titres automatiques).
begin;
set search_path = public, extensions;
select plan(9);

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
select is((public.ai_config((select ws from ctx)) ->> 'monthlyTtsSeconds')::int, 300, 'plan free : 300 secondes de voix par mois');
select is(public.ai_config((select ws from ctx)) -> 'features' ->> 'voice', 'false', 'voix : décochée par défaut même si l''IA est active');
select throws_ok($$ select public.ai_reserve((select ws from ctx), '00000000-0000-0000-0000-0000000301a2', 'voice', 10) $$,
  'P0001', 'AI_DISABLED', 'voix non activée : refusée');
select pg_temp.login('00000000-0000-0000-0000-0000000301a1');
select public.set_ai_settings((select ws from ctx), true, '{"voice":true,"captions":true}');
reset role;
select lives_ok($$ select public.ai_reserve((select ws from ctx), '00000000-0000-0000-0000-0000000301a2', 'voice', 200) $$,
  'réservation de 200 secondes');
select public.ai_commit((select ws from ctx), '00000000-0000-0000-0000-0000000301a2', 0, 0, false, 200, 0);
select throws_ok($$ select public.ai_reserve((select ws from ctx), '00000000-0000-0000-0000-0000000301a2', 'voice', 120) $$,
  'P0001', 'AI_QUOTA_AUDIO', 'au-delà du quota de voix : refusé');
select lives_ok($$ select public.ai_reserve((select ws from ctx), '00000000-0000-0000-0000-0000000301a2', 'captions', 120) $$,
  'sous-titres : quota séparé');
select throws_ok($$ select public.ai_commit((select ws from ctx), '00000000-0000-0000-0000-0000000301a2', 0, 0, false, -5, 0) $$,
  '22023', null, 'secondes négatives refusées');
select pg_temp.login('00000000-0000-0000-0000-0000000301a2');
select is((public.ai_status((select ws from ctx)) ->> 'ttsUsed')::int, 200, 'état : secondes de voix utilisées');

select * from finish();
rollback;
