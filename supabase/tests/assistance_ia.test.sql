-- Tests pgTAP : L30, Assistance IA (réglage, protection de settings.ai, quotas, droits).
begin;
set search_path = public, extensions;
select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000300a1', 'olga-ia@acme.example'),
  ('00000000-0000-0000-0000-0000000300a2', 'eddie-ia@acme.example'),
  ('00000000-0000-0000-0000-0000000300a3', 'vera-ia@acme.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000300a1');
create temp table ctx as select (public.create_workspace('IA')).id as ws;
grant all on ctx to authenticated;
reset role;
update public.workspaces set plan_code = 'pro' where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000300a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000300a3', 'viewer');

-- Désactivé par défaut
select is(public.ai_enabled((select ws from ctx)), false, 'désactivé par défaut');
select throws_ok($$ select public.ai_reserve((select ws from ctx), '00000000-0000-0000-0000-0000000300a2', 'write') $$,
  'P0001', 'AI_DISABLED', 'réservation refusée tant que désactivé');

-- Écriture directe de settings.ai refusée, même par l'owner
select pg_temp.login('00000000-0000-0000-0000-0000000300a1');
select throws_ok($$ update public.workspaces set settings = settings || '{"ai":{"enabled":true}}' where id = (select ws from ctx) $$,
  '42501', 'AI_SETTINGS_RPC_ONLY', 'settings.ai : écriture directe refusée');
select lives_ok($$ update public.workspaces set settings = settings || '{"locale":"fr"}' where id = (select ws from ctx) $$,
  'autres clés de settings : toujours modifiables');

-- Éditeur : ne peut pas régler
select pg_temp.login('00000000-0000-0000-0000-0000000300a2');
select throws_ok($$ select public.set_ai_settings((select ws from ctx), true) $$, '42501', 'FORBIDDEN', 'éditeur : réglage refusé');
select throws_ok($$ select public.ai_reserve((select ws from ctx), '00000000-0000-0000-0000-0000000300a2', 'write') $$,
  '42501', null, 'ai_reserve : pas exécutable par un client');
select throws_ok($$ insert into public.ai_usage (workspace_id, user_id, day, requests)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000300a2', current_date, 0) $$,
  '42501', null, 'ai_usage : aucune écriture client');

-- Owner : activation, quotas bornés par le plan
select pg_temp.login('00000000-0000-0000-0000-0000000300a1');
select throws_ok($$ select public.set_ai_settings((select ws from ctx), true, null, 100000) $$,
  '22023', 'AI_QUOTA_OUT_OF_PLAN', 'quota au-delà du plan refusé');
select throws_ok($$ select public.set_ai_settings((select ws from ctx), true, '{"images":true}') $$,
  '22023', 'INVALID_FEATURES', 'fonction inconnue refusée');
select is((public.set_ai_settings((select ws from ctx), true, '{"chart":false}', 3, 2)) ->> 'quota', '3', 'activé, quota 3');
reset role;
select is(public.ai_enabled((select ws from ctx)), true, 'activé');

-- Réservations (service_role)
select throws_ok($$ select public.ai_reserve((select ws from ctx), '00000000-0000-0000-0000-0000000300a2', 'chart') $$,
  'P0001', 'AI_DISABLED', 'fonction décochée : refusée');
select throws_ok($$ select public.ai_reserve((select ws from ctx), '00000000-0000-0000-0000-0000000300a3', 'write') $$,
  '42501', 'FORBIDDEN', 'lecteur : refusé');
select public.ai_reserve((select ws from ctx), '00000000-0000-0000-0000-0000000300a2', 'write');
select public.ai_reserve((select ws from ctx), '00000000-0000-0000-0000-0000000300a2', 'write');
select throws_ok($$ select public.ai_reserve((select ws from ctx), '00000000-0000-0000-0000-0000000300a2', 'write') $$,
  'P0001', 'AI_QUOTA_USER', 'limite par utilisateur et par jour');
select public.ai_reserve((select ws from ctx), '00000000-0000-0000-0000-0000000300a1', 'translate');
select throws_ok($$ select public.ai_reserve((select ws from ctx), '00000000-0000-0000-0000-0000000300a1', 'translate') $$,
  'P0001', 'AI_QUOTA_WORKSPACE', 'quota mensuel de l''espace');
select public.ai_commit((select ws from ctx), '00000000-0000-0000-0000-0000000300a2', 120, 80);
select is((select input_tokens + output_tokens from public.ai_usage where user_id = '00000000-0000-0000-0000-0000000300a2'),
  200::bigint, 'jetons comptés');

-- Lecture : l'éditeur voit ses lignes seulement, l'état signale le quota
select pg_temp.login('00000000-0000-0000-0000-0000000300a2');
select is((select count(*)::int from public.ai_usage), 1, 'éditeur : ses propres compteurs');
select is((public.ai_status((select ws from ctx)) ->> 'workspaceQuotaReached'), 'true', 'état : quota atteint, sans appel au fournisseur');

reset role;
select public.ai_commit((select ws from ctx), '00000000-0000-0000-0000-0000000300a2', 0, 0, true);
select is((select requests from public.ai_usage where user_id = '00000000-0000-0000-0000-0000000300a2'), 1,
  'erreur du fournisseur : demande rendue');

select * from finish();
rollback;
