-- Tests pgTAP : EXT-02 §6.4, réglages de la voix off pour toute la démo dans le manifeste publié
-- (sous-titres affichés par défaut, lecteur dans la bulle ou dans la barre).
begin;
set search_path = public, extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000097a1', 'voix-reglages@example.com'),
  ('00000000-0000-0000-0000-0000000097a2', 'voix-reglages-lecteur@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000097a1');
create temp table ctx as select (public.create_workspace('Voix réglages')).id as ws;
grant all on ctx to anon, authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-0000000097d1', (select ws from ctx), 'Saisir un congé', auth.uid());
insert into public.steps (id, demo_id, workspace_id, position, kind, title, body) values
  ('00000000-0000-0000-0000-0000000097b1', '00000000-0000-0000-0000-0000000097d1', (select ws from ctx), 0, 'text', 'Bienvenue', 'Texte de la bulle'),
  ('00000000-0000-0000-0000-0000000097b2', '00000000-0000-0000-0000-0000000097d1', (select ws from ctx), 1, 'text', 'Fin', 'Merci');
create temp table p as select
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000097d1/00000000-0000-0000-0000-0000000097f1.webm' as voice,
  '00000000-0000-0000-0000-0000000000ff/00000000-0000-0000-0000-0000000097d1/00000000-0000-0000-0000-0000000097f2.webm' as other;
grant all on p to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000097a2', 'viewer');

select pg_temp.login('00000000-0000-0000-0000-0000000097a1');
select throws_ok($$ update public.steps set voice_path = (select voice from p) where id = '00000000-0000-0000-0000-0000000097b1' $$,
  'P0001', 'VOICE_OBJECT_MISSING', 'piste absente du stockage : refusée');
select throws_ok($$ update public.steps set voice_path = (select other from p) where id = '00000000-0000-0000-0000-0000000097b1' $$,
  '23514', 'VOICE_PATH', 'piste rangée hors du dossier de l’espace : refusée');
reset role;
insert into storage.objects (bucket_id, name, metadata) values ('voices', (select voice from p), '{"size": 180000}');
insert into storage.objects (bucket_id, name, metadata)
  values ('voices', (select ws from ctx)::text || '/x/y.ogg', '{"size": 10}');
select pg_temp.login('00000000-0000-0000-0000-0000000097a1');
select throws_ok($$ update public.steps set voice_path = (select ws from ctx)::text || '/x/y.ogg' where id = '00000000-0000-0000-0000-0000000097b1' $$,
  '23514', null, 'format de chemin contrôlé');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000097a1');
select throws_ok($$ update public.steps set voice_duration_ms = 120001 where id = '00000000-0000-0000-0000-0000000097b1' $$,
  '23514', null, 'durée : 2 minutes au plus');
select lives_ok($$ update public.steps set voice_path = (select voice from p), voice_duration_ms = 12000
  where id = '00000000-0000-0000-0000-0000000097b1' $$, 'piste enregistrée sur l’étape');

-- Publication : transcription obligatoire
select throws_ok($$ select public.publish_demo('00000000-0000-0000-0000-0000000097d1', '{"reviewed": true, "fictional": true}') $$,
  'P0001', 'VOICE_TRANSCRIPT:1', 'publication bloquée sans transcription (étape 1)');
update public.steps set voice_transcript = '  ' where id = '00000000-0000-0000-0000-0000000097b1';
select throws_ok($$ select public.publish_demo('00000000-0000-0000-0000-0000000097d1', '{"reviewed": true, "fictional": true}') $$,
  'P0001', 'VOICE_TRANSCRIPT:1', 'transcription vide : bloquée aussi');
update public.steps set voice_transcript = 'Bienvenue dans le module.', voice_autoplay = false
 where id = '00000000-0000-0000-0000-0000000097b1';
create temp table pub as select public.publish_demo('00000000-0000-0000-0000-0000000097d1', '{"reviewed": true, "fictional": true}') as r;
reset role;
create temp table man as select v.manifest as m from public.demo_versions v
  where v.id = ((select r from pub) ->> 'versionId')::uuid;
select is((select m -> 'voice' from man), '{"captions": true, "player": "bubble"}'::jsonb,
  'sans réglage : sous-titres affichés, lecteur dans la bulle');
select is((select m -> 'steps' -> 0 -> 'voice' ->> 'autoplay' from man), 'false',
  'la lecture automatique reste celle de l’étape');

-- Réglages choisis dans l'éditeur
update public.demos set settings = settings || '{"voice": {"captions": false, "player": "bar", "autoplay": false}}'::jsonb
 where id = '00000000-0000-0000-0000-0000000097d1';
select pg_temp.login('00000000-0000-0000-0000-0000000097a1');
create temp table pub2 as select public.publish_demo('00000000-0000-0000-0000-0000000097d1', '{"reviewed": true, "fictional": true}') as r;
reset role;
select is((select v.manifest -> 'voice' from public.demo_versions v where v.id = ((select r from pub2) ->> 'versionId')::uuid),
  '{"captions": false, "player": "bar"}'::jsonb, 'réglages de la démo repris dans le manifeste');

-- Valeurs inattendues : défauts, sans erreur
update public.demos set settings = settings || '{"voice": {"captions": "peut-être", "player": "caché"}}'::jsonb
 where id = '00000000-0000-0000-0000-0000000097d1';
select pg_temp.login('00000000-0000-0000-0000-0000000097a1');
create temp table pub3 as select public.publish_demo('00000000-0000-0000-0000-0000000097d1', '{"reviewed": true, "fictional": true}') as r;
reset role;
select is((select v.manifest -> 'voice' from public.demo_versions v where v.id = ((select r from pub3) ->> 'versionId')::uuid),
  '{"captions": true, "player": "bubble"}'::jsonb, 'valeurs inattendues : défauts, publication sans erreur');

-- Démo sans voix : pas de clé « voice »
select pg_temp.login('00000000-0000-0000-0000-0000000097a1');
update public.steps set voice_path = null, voice_duration_ms = null where id = '00000000-0000-0000-0000-0000000097b1';
create temp table pub4 as select public.publish_demo('00000000-0000-0000-0000-0000000097d1', '{"reviewed": true, "fictional": true}') as r;
reset role;
select is((select v.manifest -> 'voice' from public.demo_versions v where v.id = ((select r from pub4) ->> 'versionId')::uuid),
  null, 'démo sans voix : pas de réglage dans le manifeste');

select * from finish();
rollback;
