-- Tests pgTAP : F7 (L21) étape vidéo, démo mobile, bucket videos, publication, logo de la page publique.
begin;
set search_path = public, extensions;
select plan(21);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'editrice@example.com'),
  ('00000000-0000-0000-0000-0000000000a8', 'lecteur@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000a7');
create temp table ctx as select (public.create_workspace('Vidéos')).id as ws;
grant all on ctx to anon, authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by, device, viewport) values
  ('00000000-0000-0000-0000-00000000a701', (select ws from ctx), 'Saisir une fiche', auth.uid(), 'mobile', '{"w":390,"h":844}');
create temp table p as select
  (select ws from ctx)::text || '/00000000-0000-0000-0000-00000000a701/00000000-0000-0000-0000-00000000a7f1.webm' as video,
  (select ws from ctx)::text || '/00000000-0000-0000-0000-00000000a701/frame-p1.webp' as frame;
grant all on p to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role) values ((select ws from ctx), '00000000-0000-0000-0000-0000000000a8', 'viewer');

-- ===== Démo mobile =====
select pg_temp.login('00000000-0000-0000-0000-0000000000a7');
select is((select device from public.demos where id = '00000000-0000-0000-0000-00000000a701'), 'mobile', 'démo marquée mobile');
select throws_ok($$ update public.demos set device = 'montre' $$, '23514', null, 'appareil inconnu refusé');
select throws_ok($$ update public.demos set viewport = '{"w":390,"h":844,"x":1}' $$, '23514', null, 'viewport : clés en trop refusées');
select throws_ok($$ update public.demos set viewport = '{"w":100,"h":844}' $$, '23514', null, 'viewport : taille hors bornes refusée');

-- ===== Étape vidéo =====
insert into public.steps (id, demo_id, workspace_id, position, kind, title)
  values ('00000000-0000-0000-0000-00000000a711', '00000000-0000-0000-0000-00000000a701', (select ws from ctx), 0, 'video', 'Saisie');
select throws_ok($$ update public.steps set video_path = (select video from p), video_duration_ms = 90000 $$,
  'P0001', 'VIDEO_OBJECT_MISSING', 'vidéo absente du stockage refusée');
select throws_ok($$ update public.steps set video_path = '00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-00000000a701/00000000-0000-0000-0000-00000000a7f1.webm' $$,
  '23514', 'VIDEO_PATH', 'vidéo hors du dossier du workspace refusée');
select throws_ok($$ update public.steps set video_duration_ms = 600001 $$, '23514', null, 'plus de 10 minutes refusé');
select throws_ok($$ update public.steps set video = '{"cuts":[{"from":5000,"to":1000}]}' $$, '23514', null, 'coupe inversée refusée');
select throws_ok($$ update public.steps set video = jsonb_build_object('captions', jsonb_build_array(jsonb_build_object('from', 0, 'to', 1000, 'text', repeat('x', 201)))) $$,
  '23514', null, 'sous-titre de 201 caractères refusé');
select throws_ok($$ update public.steps set video = '{"pauses":[{"id":"p1","t":1000}],"autre":1}' $$, '23514', null, 'clé inconnue refusée');
select throws_ok($$ update public.steps set video = '{"frames":{"p1":"00000000-0000-0000-0000-000000000000/x.webp"}}' $$,
  '23514', 'VIDEO_PATH', 'image de pause hors du workspace refusée');

-- Publication bloquée sans fichier
select throws_ok($$ select public.publish_demo('00000000-0000-0000-0000-00000000a701', '{"reviewed": true, "fictional": true}') $$,
  'P0001', 'VIDEO_MISSING:1', 'publication : vidéo manquante');

-- Fichier déposé (le stockage tient la taille réelle), puis étape complète
reset role;
insert into storage.objects (bucket_id, name, metadata) values
  ('videos', (select video from p), '{"size": 30000000}'),
  ('captures', (select frame from p), '{"size": 40000}');
select pg_temp.login('00000000-0000-0000-0000-0000000000a7');
select lives_ok($$ update public.steps set video_path = (select video from p), video_duration_ms = 90000,
  video = jsonb_build_object('cuts', '[{"from":10000,"to":20000}]'::jsonb,
    'pauses', '[{"id":"p1","t":42000,"title":"Le formulaire","body":"Remplissez les champs."}]'::jsonb,
    'captions', '[{"from":0,"to":3000,"text":"Ouvrez la fiche."}]'::jsonb, 'hasVoice', true,
    'frames', jsonb_build_object('p1', (select frame from p))) $$, 'éditrice : étape vidéo complète');

create temp table pub as select public.publish_demo('00000000-0000-0000-0000-00000000a701', '{"reviewed": true, "fictional": true}') as r;
select is((select r -> 'manifest' ->> 'device' from pub), 'mobile', 'manifeste : device');
select is((select r -> 'manifest' -> 'viewport' ->> 'w' from pub), '390', 'manifeste : viewport');
select is((select (r -> 'manifest' -> 'steps' -> 0 -> 'video' ->> 'durationMs')::int from pub), 90000, 'manifeste : durée');
select is((select r -> 'manifest' -> 'steps' -> 0 -> 'video' ->> 'captionsDefault' from pub), 'true', 'sous-titres par défaut si voix');
select ok((select r -> 'manifest' -> 'steps' -> 0 -> 'video' -> 'frames' ->> 'p1' like 'assets/%.webp' from pub), 'image de pause publiée');
select is((select count(*)::int from pub, jsonb_array_elements(r -> 'copies') c where c ->> 'bucket' = 'videos'), 1,
  'copie de la vidéo depuis le bucket videos');

-- Quota partagé avec la médiathèque (500 Mo)
reset role;
insert into storage.objects (bucket_id, name, metadata) values
  ('media', (select ws from ctx)::text || '/gros.png', '{"size": 480000000}'),
  ('videos', (select ws from ctx)::text || '/00000000-0000-0000-0000-00000000a701/00000000-0000-0000-0000-00000000a7f2.webm', '{"size": 30000000}');
select pg_temp.login('00000000-0000-0000-0000-0000000000a7');
select throws_ok($$ update public.steps set video_path = (select ws from ctx)::text || '/00000000-0000-0000-0000-00000000a701/00000000-0000-0000-0000-00000000a7f2.webm' $$,
  'P0001', 'MEDIA_QUOTA', 'quota médiathèque + vidéos dépassé');

-- Page publique : logo du workspace
reset role;
update public.workspaces set logo_path = (select ws from ctx)::text || '/logo.png';
update public.demos set status = 'published', current_version_id = (select (r ->> 'versionId')::uuid from pub);
insert into public.demo_pages (demo_id, enabled) values ('00000000-0000-0000-0000-00000000a701', true);
set local role anon;
select is(public.public_page('00000000-0000-0000-0000-00000000a701') ->> 'logoPath', (select ws from ctx)::text || '/logo.png',
  'page publique : chemin public du logo');

select * from finish();
rollback;
