-- Tests pgTAP : EXT-02 §4.1, vidéo importée en MP4 (chemin, types des buckets, publication).
begin;
set search_path = public, extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000097a1', 'video-mp4@example.com'),
  ('00000000-0000-0000-0000-0000000097a2', 'video-mp4-lecteur@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000097a1');
create temp table ctx as select (public.create_workspace('Vidéo importée')).id as ws;
grant all on ctx to anon, authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-0000000097d1', (select ws from ctx), 'Vidéo importée', auth.uid());
create temp table p as select
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000097d1/00000000-0000-0000-0000-0000000097f1.mp4' as mp4,
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000097d1/00000000-0000-0000-0000-0000000097f2.webm' as webm,
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000097d1/00000000-0000-0000-0000-0000000097f3.mov' as mov;
grant all on p to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000097a2', 'viewer');

-- Types acceptés par les buckets, taille par fichier inchangée
select ok((select 'video/mp4' = any (allowed_mime_types) and 'video/webm' = any (allowed_mime_types)
             from storage.buckets where id = 'videos'), 'bucket videos : MP4 et WebM');
select is((select file_size_limit from storage.buckets where id = 'videos'), 52428800::bigint,
  'bucket videos : 50 Mo par fichier, comme les vidéos enregistrées');
select ok((select 'video/mp4' = any (allowed_mime_types) and 'text/html' = any (allowed_mime_types)
             from storage.buckets where id = 'published'), 'bucket published : MP4 ajouté, le reste conservé');

insert into storage.objects (bucket_id, name, metadata) values
  ('videos', (select mp4 from p), '{"size": 20000000}'),
  ('videos', (select webm from p), '{"size": 20000000}'),
  ('videos', (select mov from p), '{"size": 20000000}'),
  ('videos', (select mp4 from p) || '.exe', '{"size": 20000000}');

select pg_temp.login('00000000-0000-0000-0000-0000000097a1');
insert into public.steps (id, demo_id, workspace_id, position, kind, title) values
  ('00000000-0000-0000-0000-0000000097b1', '00000000-0000-0000-0000-0000000097d1', (select ws from ctx), 0, 'video', 'Importée'),
  ('00000000-0000-0000-0000-0000000097b2', '00000000-0000-0000-0000-0000000097d1', (select ws from ctx), 1, 'video', 'Enregistrée');
select throws_ok($$ update public.steps set video_path = (select mov from p)
                     where id = '00000000-0000-0000-0000-0000000097b1' $$, '23514', null, 'autre extension refusée');
select throws_ok($$ update public.steps set video_path = (select mp4 from p) || '.exe'
                     where id = '00000000-0000-0000-0000-0000000097b1' $$, '23514', null, 'suffixe après .mp4 refusé');
select throws_ok($$ update public.steps set video_path = '00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-0000000097d1/00000000-0000-0000-0000-0000000097f1.mp4'
                     where id = '00000000-0000-0000-0000-0000000097b1' $$, '23514', 'VIDEO_PATH', 'MP4 hors du dossier de l''espace refusé');
select lives_ok($$ update public.steps set video_path = (select mp4 from p), video_duration_ms = 60000
                    where id = '00000000-0000-0000-0000-0000000097b1' $$, 'éditrice : vidéo MP4 acceptée');
update public.steps set video_path = (select webm from p), video_duration_ms = 30000
 where id = '00000000-0000-0000-0000-0000000097b2';

-- Lecteur de l'espace : pas d'écriture (RLS)
select pg_temp.login('00000000-0000-0000-0000-0000000097a2');
update public.steps set video_duration_ms = 1 where id = '00000000-0000-0000-0000-0000000097b1';
reset role;
select is((select video_duration_ms from public.steps where id = '00000000-0000-0000-0000-0000000097b1'), 60000,
  'lecteur : la vidéo n''est pas modifiable');

-- Publication : la copie garde l'extension de la source
select pg_temp.login('00000000-0000-0000-0000-0000000097a1');
create temp table pub as select public.publish_demo('00000000-0000-0000-0000-0000000097d1', '{"reviewed": true, "fictional": true}') as r;
select ok((select r -> 'manifest' -> 'steps' -> 0 -> 'video' ->> 'url' ~ '^assets/.+\.mp4$' from pub),
  'manifeste : vidéo importée publiée en .mp4');
select ok((select r -> 'manifest' -> 'steps' -> 1 -> 'video' ->> 'url' ~ '^assets/.+\.webm$' from pub),
  'manifeste : vidéo enregistrée toujours en .webm');

select * from finish();
rollback;
