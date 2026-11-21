-- Tests pgTAP : A8, guide optionnel du Sandbox (hotspots.sel, sandbox.guideSteps, événements guide_*).
begin;
set search_path = public, extensions;
select plan(13);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000099a1', 'guide@acme.example');
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

-- ===== Schéma de sandbox.guideSteps =====
select ok(public.sandbox_ok('{"guide": true, "guideSteps": []}'), 'guide vide accepté');
select ok(public.sandbox_ok('{"guideSteps": [{"page": "00000000-0000-4000-8000-0000000000a1", "hotspot": "00000000-0000-4000-8000-0000000000b1", "advance": "next"}]}'),
  'étape avec page, bulle et avance');
select ok(not public.sandbox_ok('{"guideSteps": [{"page": "00000000-0000-4000-8000-0000000000a1", "hotspot": "00000000-0000-4000-8000-0000000000b1", "advance": "auto"}]}'),
  'avance inconnue refusée');
select ok(not public.sandbox_ok('{"guideSteps": [{"page": "x", "hotspot": "00000000-0000-4000-8000-0000000000b1"}]}'),
  'page invalide refusée');
select ok(not public.sandbox_ok('{"guideSteps": [{"page": "00000000-0000-4000-8000-0000000000a1", "hotspot": "00000000-0000-4000-8000-0000000000b1", "html": "<b>"}]}'),
  'clé inconnue refusée');
select ok(not public.sandbox_ok(jsonb_build_object('guideSteps', (select jsonb_agg(jsonb_build_object(
    'page', '00000000-0000-4000-8000-0000000000a1', 'hotspot', '00000000-0000-4000-8000-0000000000b1')) from generate_series(1, 31)))),
  'plus de 30 étapes refusé');

-- ===== Données : Sandbox de deux pages, trois bulles =====
select pg_temp.login('00000000-0000-0000-0000-0000000099a1');
create temp table ctx as select (public.create_workspace('Guide')).id as ws;
grant all on ctx to anon, authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by, kind) values
  ('00000000-0000-0000-0000-0000000099d1', (select ws from ctx), 'Rendez-vous', auth.uid(), 'sandbox');
insert into public.steps (id, demo_id, workspace_id, position, kind, title) values
  ('00000000-0000-0000-0000-0000000099e1', '00000000-0000-0000-0000-0000000099d1', (select ws from ctx), 0, 'html', 'Accueil'),
  ('00000000-0000-0000-0000-0000000099e2', '00000000-0000-0000-0000-0000000099d1', (select ws from ctx), 1, 'html', 'Agenda');
select throws_ok($$ insert into public.hotspots (step_id, demo_id, workspace_id, x, y, sel)
  values ('00000000-0000-0000-0000-0000000099e1', '00000000-0000-0000-0000-0000000099d1', (select ws from ctx), 0.1, 0.1, repeat('x', 501)) $$,
  '23514', null, 'sélecteur de plus de 500 caractères refusé');
insert into public.hotspots (id, step_id, demo_id, workspace_id, x, y, title, sel, position) values
  ('00000000-0000-0000-0000-0000000099b1', '00000000-0000-0000-0000-0000000099e1', '00000000-0000-0000-0000-0000000099d1', (select ws from ctx), 0.1, 0.1, 'Menu', '#menu > a:nth-of-type(2)', 0),
  ('00000000-0000-0000-0000-0000000099b2', '00000000-0000-0000-0000-0000000099e2', '00000000-0000-0000-0000-0000000099d1', (select ws from ctx), 0.5, 0.5, 'Créer', null, 0);
update public.demos set sandbox = jsonb_build_object('guide', true, 'guideSteps', jsonb_build_array(
  jsonb_build_object('page', '00000000-0000-0000-0000-0000000099e1', 'hotspot', '00000000-0000-0000-0000-0000000099b1'),
  -- bulle supprimée : retirée à la publication
  jsonb_build_object('page', '00000000-0000-0000-0000-0000000099e1', 'hotspot', '00000000-0000-0000-0000-0000000099b9'),
  -- bulle d'une autre page : retirée aussi
  jsonb_build_object('page', '00000000-0000-0000-0000-0000000099e1', 'hotspot', '00000000-0000-0000-0000-0000000099b2'),
  jsonb_build_object('page', '00000000-0000-0000-0000-0000000099e2', 'hotspot', '00000000-0000-0000-0000-0000000099b2', 'advance', 'next')))
  where id = '00000000-0000-0000-0000-0000000099d1';

-- Pages déposées (comme par html-ingest, clé de service)
create temp table p as select
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000099d1/00000000-0000-0000-0000-0000000099f1.html' as p1,
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000099d1/00000000-0000-0000-0000-0000000099f2.html' as p2;
grant all on p to authenticated;
reset role;
insert into storage.objects (bucket_id, name, metadata) values
  ('html', (select p1 from p), '{"size": 1000}'), ('html', (select p2 from p), '{"size": 1000}');
select pg_temp.login('00000000-0000-0000-0000-0000000099a1');
update public.steps set html_path = (select p1 from p) where id = '00000000-0000-0000-0000-0000000099e1';
update public.steps set html_path = (select p2 from p) where id = '00000000-0000-0000-0000-0000000099e2';

create temp table pub as select public.publish_demo('00000000-0000-0000-0000-0000000099d1', '{"reviewed": true, "fictional": true}') as r;
grant all on pub to anon;
select is((select r -> 'manifest' -> 'sandbox' -> 'guideSteps' from pub),
  '[{"page": "00000000-0000-0000-0000-0000000099e1", "hotspot": "00000000-0000-0000-0000-0000000099b1", "advance": "click"},
    {"page": "00000000-0000-0000-0000-0000000099e2", "hotspot": "00000000-0000-0000-0000-0000000099b2", "advance": "next"}]'::jsonb,
  'publication : étapes valides seulement, dans l’ordre, avance par défaut « click »');
select is((select r -> 'manifest' -> 'steps' -> 0 -> 'hotspots' -> 0 ->> 'sel' from pub), '#menu > a:nth-of-type(2)',
  'publication : sélecteur de la bulle');
select ok((select r -> 'manifest' -> 'steps' -> 1 -> 'hotspots' -> 0 -> 'sel' = 'null'::jsonb from pub),
  'publication : bulle sans sélecteur (rect seul)');
select is((select (r -> 'manifest' -> 'sandbox' ->> 'guide')::boolean from pub), true, 'publication : guide activé');

-- ===== Événements du guide =====
reset role;
update public.demos set status = 'published', current_version_id = (select (r ->> 'versionId')::uuid from pub)
  where id = '00000000-0000-0000-0000-0000000099d1';
select pg_temp.anon();
select is(public.track_events(jsonb_build_object(
  'demoId', '00000000-0000-0000-0000-0000000099d1', 'versionId', (select r ->> 'versionId' from pub),
  'visitorId', 'visiteur-g001', 'sessionId', 'session-g001',
  'events', '[{"type":"guide_step","props":{"index":0}},{"type":"guide_skip","props":{"at":"skip"}},{"type":"guide_done"},{"type":"guide_autre"}]'::jsonb)),
  3, 'guide_step, guide_skip et guide_done acceptés ; type inconnu ignoré');
reset role;
select is((select count(*)::int from public.events where session_id = 'session-g001' and type like 'guide_%'), 3,
  'événements du guide enregistrés');

select * from finish();
rollback;
