-- Tests pgTAP : L28 035 (voix off). Chemin et fichier contrôlés, durée, transcription obligatoire pour
-- publier, piste ajoutée au manifeste publié, lecteur sans écriture.
begin;
set search_path = public, extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000035a1', 'editrice-voix@example.com'),
  ('00000000-0000-0000-0000-0000000035a2', 'lecteur-voix@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000035a1');
create temp table ctx as select (public.create_workspace('Voix')).id as ws;
grant all on ctx to anon, authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-0000000035d1', (select ws from ctx), 'Saisir un congé', auth.uid());
insert into public.steps (id, demo_id, workspace_id, position, kind, title, body) values
  ('00000000-0000-0000-0000-0000000035b1', '00000000-0000-0000-0000-0000000035d1', (select ws from ctx), 0, 'text', 'Bienvenue', 'Texte de la bulle'),
  ('00000000-0000-0000-0000-0000000035b2', '00000000-0000-0000-0000-0000000035d1', (select ws from ctx), 1, 'text', 'Fin', 'Merci');
create temp table p as select
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000035d1/00000000-0000-0000-0000-0000000035f1.webm' as voice,
  '00000000-0000-0000-0000-0000000000ff/00000000-0000-0000-0000-0000000035d1/00000000-0000-0000-0000-0000000035f2.webm' as other;
grant all on p to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000035a2', 'viewer');

select pg_temp.login('00000000-0000-0000-0000-0000000035a1');
select throws_ok($$ update public.steps set voice_path = (select voice from p) where id = '00000000-0000-0000-0000-0000000035b1' $$,
  'P0001', 'VOICE_OBJECT_MISSING', 'piste absente du stockage : refusée');
select throws_ok($$ update public.steps set voice_path = (select other from p) where id = '00000000-0000-0000-0000-0000000035b1' $$,
  '23514', 'VOICE_PATH', 'piste rangée hors du dossier de l’espace : refusée');
reset role;
insert into storage.objects (bucket_id, name, metadata) values ('voices', (select voice from p), '{"size": 180000}');
insert into storage.objects (bucket_id, name, metadata)
  values ('voices', (select ws from ctx)::text || '/x/y.ogg', '{"size": 10}');
select pg_temp.login('00000000-0000-0000-0000-0000000035a1');
select throws_ok($$ update public.steps set voice_path = (select ws from ctx)::text || '/x/y.ogg' where id = '00000000-0000-0000-0000-0000000035b1' $$,
  '23514', null, 'format de chemin contrôlé');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000035a1');
select throws_ok($$ update public.steps set voice_duration_ms = 120001 where id = '00000000-0000-0000-0000-0000000035b1' $$,
  '23514', null, 'durée : 2 minutes au plus');
select lives_ok($$ update public.steps set voice_path = (select voice from p), voice_duration_ms = 12000
  where id = '00000000-0000-0000-0000-0000000035b1' $$, 'piste enregistrée sur l’étape');

-- Publication : transcription obligatoire
select throws_ok($$ select public.publish_demo('00000000-0000-0000-0000-0000000035d1', '{"reviewed": true, "fictional": true}') $$,
  'P0001', 'VOICE_TRANSCRIPT:1', 'publication bloquée sans transcription (étape 1)');
update public.steps set voice_transcript = '  ' where id = '00000000-0000-0000-0000-0000000035b1';
select throws_ok($$ select public.publish_demo('00000000-0000-0000-0000-0000000035d1', '{"reviewed": true, "fictional": true}') $$,
  'P0001', 'VOICE_TRANSCRIPT:1', 'transcription vide : bloquée aussi');
update public.steps set voice_transcript = 'Bienvenue dans le module.', voice_autoplay = false
 where id = '00000000-0000-0000-0000-0000000035b1';
create temp table pub as select public.publish_demo('00000000-0000-0000-0000-0000000035d1', '{"reviewed": true, "fictional": true}') as r;
reset role;
create temp table man as select v.manifest as m from public.demo_versions v
  where v.id = ((select r from pub) ->> 'versionId')::uuid;
select is((select m -> 'steps' -> 0 -> 'voice' from man),
  jsonb_build_object('src', 'assets/voice-00000000-0000-0000-0000-0000000035f1.webm', 'durationMs', 12000,
                     'transcript', 'Bienvenue dans le module.', 'autoplay', false),
  'manifeste publié : step.voice (chemin publié, durée, transcription, lancement)');
select is((select m -> 'steps' -> 1 -> 'voice' from man), null, 'étape sans voix : pas de step.voice');
select is((select jsonb_array_length(m -> 'steps') from man), 2, 'ordre et nombre des étapes conservés');

-- Lecteur : aucune écriture
select pg_temp.login('00000000-0000-0000-0000-0000000035a2');
update public.steps set voice_transcript = 'pirate' where id = '00000000-0000-0000-0000-0000000035b1';
reset role;
select is((select voice_transcript from public.steps where id = '00000000-0000-0000-0000-0000000035b1'),
  'Bienvenue dans le module.', 'lecteur : transcription non modifiable');

select * from finish();
rollback;
