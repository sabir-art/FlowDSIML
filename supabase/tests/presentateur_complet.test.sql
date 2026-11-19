-- Tests pgTAP : L26-09 à L26-12 (notes de la démo, télécommande, bilan de fin).
begin;
set search_path = public, extensions;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000030a1', 'presentatrice@example.com'),
  ('00000000-0000-0000-0000-0000000030a2', 'lecteur-pres@example.com'),
  ('00000000-0000-0000-0000-0000000030a3', 'collegue-pres@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000030a1');
create temp table ctx as select (public.create_workspace('Présentation')).id as ws;
grant all on ctx to anon, authenticated;
insert into public.demos (id, workspace_id, title, created_by, presenter_notes)
  values ('00000000-0000-0000-0000-0000000030d1', (select ws from ctx), 'Créer un rapport', auth.uid(), 'Introduction');
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000030d2', (select ws from ctx), 'Autre démo', auth.uid());
insert into public.steps (demo_id, workspace_id, position, kind, title, presenter_notes) values
  ('00000000-0000-0000-0000-0000000030d1', (select ws from ctx), 0, 'text', 'Bienvenue', 'Saluer'),
  ('00000000-0000-0000-0000-0000000030d1', (select ws from ctx), 1, 'text', 'Rapports', 'Insister');
reset role;
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000030a2', 'viewer'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000030a3', 'editor');

select throws_ok($$ update public.demos set presenter_notes = repeat('x', 2001) where id = '00000000-0000-0000-0000-0000000030d1' $$,
  '23514', null, 'notes de la démo : 2 000 caractères au plus');

-- ===== Télécommande =====
select pg_temp.login('00000000-0000-0000-0000-0000000030a2');
select throws_ok($$ select public.present_remote_start('00000000-0000-0000-0000-0000000030d1') $$, '42501', null,
  'lecteur : pas de télécommande');
select pg_temp.login('00000000-0000-0000-0000-0000000030a1');
create temp table rs as select public.present_remote_start('00000000-0000-0000-0000-0000000030d1') as r;
grant all on rs to anon, authenticated;
select ok((select r ->> 'code' from rs) ~ '^\d{8}$', 'code à 8 chiffres');
select is((select count(*)::int from public.present_remotes), 1, 'présentatrice : sa télécommande');
select throws_ok($$ select code_hash from public.present_remotes $$, '42501', null, 'hachages jamais lisibles');
select pg_temp.login('00000000-0000-0000-0000-0000000030a3');
select is((select count(*)::int from public.present_remotes), 0, 'collègue : ne voit pas la télécommande');
select is(public.present_remote_status((select (r ->> 'id')::uuid from rs)), null, 'collègue : pas de statut');

-- Téléphone : mauvais code (avec l'id du QR), compté
select pg_temp.anon();
select is(public.present_remote_pair((select (r ->> 'id')::uuid from rs),
  lpad(((select (r ->> 'code')::bigint from rs) + 1) % 100000000 || '', 8, '0')) ->> 'status', 'invalid', 'mauvais code refusé');
-- Bon code, sans l'id (saisie)
create temp table pr as select public.present_remote_pair(null, (select r ->> 'code' from rs)) as r;
grant all on pr to anon, authenticated;
select is((select r ->> 'status' from pr), 'ok', 'appairage par code saisi');
select is((select jsonb_array_length(r -> 'steps') from pr), 2, 'téléphone : étapes de cette démo');
select is((select r -> 'steps' -> 1 ->> 'notes' from pr), 'Insister', 'téléphone : notes de l’étape');
select is((select r ->> 'notes' from pr), 'Introduction', 'téléphone : notes de la démo');
select ok((select r::text from pr) !~ 'Autre démo', 'rien d’autre de l’espace');
select is(public.present_remote_pair(null, (select r ->> 'code' from rs)) ->> 'status', 'invalid', 'code à usage unique');
select is(public.present_remote_state((select r ->> 'token' from pr)) ->> 'status', 'ok', 'jeton valide');

-- Un seul téléphone : nouveau code puis nouvel appairage = ancien jeton coupé
select pg_temp.login('00000000-0000-0000-0000-0000000030a1');
create temp table nc as select public.present_remote_new_code((select (r ->> 'id')::uuid from rs)) as r;
grant all on nc to anon, authenticated;
select pg_temp.anon();
create temp table pr2 as select public.present_remote_pair((select (r ->> 'id')::uuid from rs), (select r ->> 'code' from nc)) as r;
grant all on pr2 to anon, authenticated;
select is(public.present_remote_state((select r ->> 'token' from pr)) ->> 'status', 'ended', 'un seul téléphone : l’ancien est coupé');
select isnt((select r ->> 'channel' from pr2), (select r ->> 'channel' from pr), 'nouvelle clé de canal');

-- 5 essais puis code invalidé
select pg_temp.login('00000000-0000-0000-0000-0000000030a1');
create temp table nc2 as select public.present_remote_new_code((select (r ->> 'id')::uuid from rs)) as r;
grant all on nc2 to anon, authenticated;
select pg_temp.anon();
select public.present_remote_pair((select (r ->> 'id')::uuid from rs), '00000000') from generate_series(1, 5)
  where (select r ->> 'code' from nc2) <> '00000000';
select is(public.present_remote_pair((select (r ->> 'id')::uuid from rs), (select r ->> 'code' from nc2)) ->> 'status',
  'expired', '5 essais : code invalidé');

-- Plafond global : plus de 30 échecs sans p_id en 10 min = appairage par code seul refusé
select pg_temp.login('00000000-0000-0000-0000-0000000030a1');
create temp table nc3 as select public.present_remote_new_code((select (r ->> 'id')::uuid from rs)) as r;
grant all on nc3 to anon, authenticated;
select pg_temp.anon();
select public.present_remote_pair(null, lpad(g::text, 8, '9')) from generate_series(1, 31) g;
select is(public.present_remote_pair(null, (select r ->> 'code' from nc3)) ->> 'status', 'busy',
  'plafond global : code saisi refusé 10 min');
select is(public.present_remote_pair((select (r ->> 'id')::uuid from rs), (select r ->> 'code' from nc3)) ->> 'status', 'ok',
  'avec l’id du QR : toujours possible');

-- Fin de présentation : jeton expiré
select pg_temp.login('00000000-0000-0000-0000-0000000030a1');
select public.present_remote_end((select (r ->> 'id')::uuid from rs));
select pg_temp.anon();
select is(public.present_remote_state((select r ->> 'token' from pr2)) ->> 'status', 'ended', 'fin : jeton expiré');

-- ===== Bilan =====
select pg_temp.login('00000000-0000-0000-0000-0000000030a1');
select lives_ok($$ insert into public.present_reports (workspace_id, demo_id, started_at, duration_s, target_min, steps, notes_changed)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000030d1', now() - interval '15 minutes', 845, 15,
          '[{"index":0,"title":"Bienvenue","seconds":72},{"index":1,"title":"Rapports","seconds":348}]', 1) $$,
  'bilan enregistré');
select pg_temp.login('00000000-0000-0000-0000-0000000030a3');
select is((select count(*)::int from public.present_reports), 0, 'bilan : visible par la seule présentatrice');
reset role;
select is((select count(*)::int from public.events), 0, 'rien dans les statistiques');

select * from finish();
rollback;
