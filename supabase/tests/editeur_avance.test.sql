-- Tests pgTAP : L18 (test A/B, médiathèque).
begin;
set search_path = public, extensions;
select plan(27);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a1', 'olga-ab@example.com'),
  ('00000000-0000-0000-0000-0000000008a2', 'eddie-ab@example.com'),
  ('00000000-0000-0000-0000-0000000008a3', 'vera-ab@example.com'),
  ('00000000-0000-0000-0000-0000000008a4', 'autre-ab@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000008a1');
create temp table ctx as select (public.create_workspace('Éditeur avancé')).id as ws;
grant all on ctx to authenticated;
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000008a4');
create temp table ctx2 as select (public.create_workspace('Autre AB')).id as ws;
grant all on ctx2 to authenticated;
select pg_temp.logout();
update public.workspaces set plan_code = 'pro', public_links_enabled = true where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000008a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000008a3', 'viewer');
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-0000000008d1', (select ws from ctx), 'Démo testée', '00000000-0000-0000-0000-0000000008a1');
insert into public.steps (id, demo_id, workspace_id, position, kind, title, image_path, image_width, image_height) values
  ('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008d1', (select ws from ctx), 0, 'image',
   'Accueil', (select ws from ctx)::text || '/d/e1.png', 1100, 750),
  ('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008d1', (select ws from ctx), 1, 'image',
   'Rapports', (select ws from ctx)::text || '/d/e2.png', 1100, 750),
  ('00000000-0000-0000-0000-0000000008e3', '00000000-0000-0000-0000-0000000008d1', (select ws from ctx), 2, 'text',
   'Fin', null, null, null);
insert into public.hotspots (id, step_id, demo_id, workspace_id, x, y, w, h, title, body, cta) values
  ('00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008d1',
   (select ws from ctx), 0.1, 0.1, 0.1, 0.1, 'Cliquez ici', 'Texte A', '{"label": "Essai", "url": "https://acme.example"}'),
  ('00000000-0000-0000-0000-0000000008f2', '00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008d1',
   (select ws from ctx), 0.1, 0.1, 0.1, 0.1, 'Ouvrez Rapports', 'Texte', null);

-- ===== Test A/B : création =====
select pg_temp.login('00000000-0000-0000-0000-0000000008a3');
select throws_ok($$ select public.ab_start('00000000-0000-0000-0000-0000000008f1') $$, '42501', null, 'lectrice : création refusée');
select is((select count(*)::int from public.hotspots), 2, 'lectrice : lit les bulles');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000008a2');
create temp table t1 as select public.ab_start('00000000-0000-0000-0000-0000000008f1', 'Bouton en haut') as id;
select ok((select variant_b = '{"title": "Cliquez ici", "body": "Texte A", "cta": {"label": "Essai", "url": "https://acme.example"}}'::jsonb
             and split_b = 50 and goal = 'completion' and status = 'running' and label_b = 'Bouton en haut'
           from public.ab_tests where id = (select id from t1)),
  'éditeur : variante B créée (titre, texte et bouton copiés)');
select throws_ok($$ select public.ab_start('00000000-0000-0000-0000-0000000008f2') $$, 'P0001',
  'AB_ALREADY_RUNNING:1', 'un seul test par démo (étape 1)');
select throws_ok($$ insert into public.ab_tests (workspace_id, demo_id, step_id) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000008d1', '00000000-0000-0000-0000-0000000008e2') $$,
  '42501', null, 'aucune écriture directe dans ab_tests');

-- ===== Modification et historique =====
select public.ab_update((select id from t1), null, '{"title": "Nouveau rapport", "body": "En haut à droite."}', 30, 'cta');
select ok((select variant_b ->> 'title' = 'Nouveau rapport' and variant_b ->> 'body' = 'En haut à droite.'
             and variant_b -> 'cta' ->> 'label' = 'Essai' and split_b = 30 and goal = 'cta'
             and jsonb_array_length(history) = 1 and history -> 0 -> 'fields' = '["title", "body"]'::jsonb
           from public.ab_tests where id = (select id from t1)),
  'modification de B horodatée dans l''historique ; répartition et objectif');
select throws_ok(format($$ select public.ab_update('%s', null, null, 35) $$, (select id from t1)),
  '23514', null, 'répartition par pas de 10');
select throws_ok(format($$ select public.ab_update('%s', null, jsonb_build_object('body', repeat('x', 4001))) $$, (select id from t1)),
  '23514', null, 'texte de B limité à 4 000 caractères');

-- ===== Publication =====
create temp table pub as select public.publish_demo('00000000-0000-0000-0000-0000000008d1',
  '{"reviewed": true, "fictional": true}') as r;
select ok((select r -> 'manifest' -> 'ab' @> jsonb_build_object('testId', (select id from t1)::text,
             'hotspotId', '00000000-0000-0000-0000-0000000008f1', 'splitB', 30,
             'b', jsonb_build_object('title', 'Nouveau rapport', 'body', 'En haut à droite.')) from pub),
  'manifeste : test en cours publié');
select pg_temp.logout();

-- ===== Résultats =====
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type, props)
select (select ws from ctx), '00000000-0000-0000-0000-0000000008d1', 'v' || g, 's' || g, ty,
       jsonb_build_object('abt', (select id from t1)::text, 'abv', case when g % 2 = 0 then 'A' else 'B' end)
from generate_series(1, 6) g, (values ('demo_view'), ('cta_click')) as x(ty)
where ty = 'demo_view' or g in (1, 3, 4);
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type, props)
values ((select ws from ctx), '00000000-0000-0000-0000-0000000008d1', 'autre', 's', 'demo_view', '{"abt": "x", "abv": "A"}');
select pg_temp.login('00000000-0000-0000-0000-0000000008a3');
select is(public.ab_results((select id from t1)),
  '{"goal": "cta", "A": {"visitors": 3, "reached": 1}, "B": {"visitors": 3, "reached": 2}}'::jsonb,
  'résultats par variante (objectif du test : clics)');
select is(public.ab_results((select id from t1), 'completion') -> 'B' ->> 'reached', '0',
  'changer d''objectif recalcule sans redémarrer');
select throws_ok(format($$ select public.ab_end('%s', 'B') $$, (select id from t1)), '42501', null,
  'lectrice : fin du test refusée');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000008a4');
select throws_ok(format($$ select public.ab_results('%s') $$, (select id from t1)), '42501', null,
  'autre workspace : résultats refusés');
select pg_temp.logout();

-- ===== Fin du test =====
select pg_temp.login('00000000-0000-0000-0000-0000000008a2');
select public.ab_end((select id from t1), 'B');
select ok((select title = 'Nouveau rapport' and body = 'En haut à droite.' and cta ->> 'label' = 'Essai'
           from public.hotspots where id = '00000000-0000-0000-0000-0000000008f1'),
  'garder B : B remplace A dans la bulle');
select ok((select status = 'ended' and kept = 'B' and ended_at is not null from public.ab_tests where id = (select id from t1)),
  'test archivé');
create temp table pub2 as select public.publish_demo('00000000-0000-0000-0000-0000000008d1',
  '{"reviewed": true, "fictional": true}') as r;
select is((select r -> 'manifest' -> 'ab' from pub2), 'null'::jsonb, 'test terminé : plus de variante publiée');
create temp table t2 as select public.ab_start('00000000-0000-0000-0000-0000000008f2') as id;
select public.ab_end((select id from t2));
select ok((select status = 'stopped' and kept is null from public.ab_tests where id = (select id from t2))
          and (select title from public.hotspots where id = '00000000-0000-0000-0000-0000000008f2') = 'Ouvrez Rapports',
  'arrêter le test : A inchangé, résultats conservés');
select throws_ok(format($$ select public.ab_update('%s', null, '{"title": "x"}') $$, (select id from t2)),
  'P0001', 'AB_NOT_RUNNING', 'test arrêté : plus modifiable');
select pg_temp.logout();

-- ===== Médiathèque =====
select ok((select public and file_size_limit = 5242880
             and allowed_mime_types @> array['image/png', 'image/jpeg', 'image/svg+xml', 'font/woff2']
           from storage.buckets where id = 'media'), 'bucket media : 5 Mo, types limités');
insert into storage.objects (bucket_id, name, metadata) values
  ('media', (select ws from ctx)::text || '/a.png', '{"size": 300000000}');
insert into public.media_files (workspace_id, kind, name, path, mime, size_bytes)
  values ((select ws from ctx), 'logo', 'Logo Acme', (select ws from ctx)::text || '/a.png', 'image/png', 1);
insert into storage.objects (bucket_id, name, metadata) values
  ('media', (select ws from ctx)::text || '/b.png', '{"size": 300000000}');
select is((select size_bytes from public.media_files where name = 'Logo Acme'), 300000000::bigint,
  'taille lue dans le stockage, jamais celle annoncée');
select throws_ok(format($$ insert into public.media_files (workspace_id, kind, name, path, mime)
  values ('%s', 'image', 'Trop', '%s/b.png', 'image/png') $$, (select ws from ctx), (select ws from ctx)),
  'P0001', 'MEDIA_QUOTA', 'quota de 500 Mo par workspace');
select throws_ok(format($$ insert into public.media_files (workspace_id, kind, name, path, mime)
  values ('%s', 'image', 'Fantôme', '%s/absent.png', 'image/png') $$, (select ws from ctx), (select ws from ctx)),
  'P0001', 'MEDIA_OBJECT_MISSING', 'ligne sans fichier refusée');
select throws_ok(format($$ insert into public.media_files (workspace_id, kind, name, path, mime)
  values ('%s', 'image', 'Ailleurs', '%s/a.png', 'image/png') $$, (select ws from ctx), (select ws from ctx2)),
  '23514', null, 'chemin hors du workspace refusé');

update public.demos set settings = jsonb_build_object('theme', jsonb_build_object('logoUrl',
  'https://x.example/storage/v1/object/public/media/' || (select ws from ctx)::text || '/a.png'))
  where id = '00000000-0000-0000-0000-0000000008d1';
select pg_temp.login('00000000-0000-0000-0000-0000000008a3');
select is((select count(*)::int from public.media_files), 1, 'lectrice : lit la médiathèque');
select is(public.media_used((select ws from ctx)), 600000000::bigint, 'occupation réelle du workspace');
select is((public.media_usage((select ws from ctx)) -> 0 ->> 'demos')::int, 1, 'fichier utilisé dans 1 démo');
select throws_ok(format($$ insert into public.media_files (workspace_id, kind, name, path, mime)
  values ('%s', 'image', 'Direct', '%s/b.png', 'image/png') $$, (select ws from ctx), (select ws from ctx)),
  '42501', null, 'aucune écriture directe dans media_files (fonction media seulement)');
select pg_temp.logout();

select * from finish();
rollback;
