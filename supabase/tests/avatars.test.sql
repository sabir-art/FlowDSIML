-- Tests pgTAP : photo de profil (bucket avatars), lecture entre membres d'un espace commun, écriture par
-- la personne seule, chemin contrôlé, bucket borné (2 Mo, JPG/PNG/WebP), orphelins à la suppression.
begin;
set search_path = public, extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000320a1', 'olga-av@acme.example'),
  ('00000000-0000-0000-0000-0000000320a2', 'eddie-av@acme.example'),
  ('00000000-0000-0000-0000-0000000320a3', 'xavier-av@nordline.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000320a1');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to authenticated;
reset role;
update public.workspaces set plan_code = 'enterprise' where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000320a2', 'viewer');

select is((select file_size_limit::int from storage.buckets where id = 'avatars'), 2097152, 'bucket : 2 Mo au plus');
select is((select allowed_mime_types from storage.buckets where id = 'avatars'),
  array['image/jpeg', 'image/png', 'image/webp'], 'bucket : JPG, PNG, WebP');
select is((select public from storage.buckets where id = 'avatars'), false, 'bucket privé (URL signées)');

-- Écriture : dans son propre dossier seulement
select pg_temp.login('00000000-0000-0000-0000-0000000320a1');
insert into storage.objects (bucket_id, name, owner)
  values ('avatars', '00000000-0000-0000-0000-0000000320a1/photo.webp', auth.uid());
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 1, 'dépôt dans son dossier');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner)
  values ('avatars', '00000000-0000-0000-0000-0000000320a2/photo.webp', auth.uid()) $$,
  '42501', null, 'dépôt dans le dossier d''un autre : refusé');
update public.profiles set avatar_path = '00000000-0000-0000-0000-0000000320a1/photo.webp' where id = auth.uid();
select is((select avatar_path from public.profiles where id = auth.uid()),
  '00000000-0000-0000-0000-0000000320a1/photo.webp', 'chemin enregistré dans le profil');
select throws_ok($$ update public.profiles set avatar_path = '00000000-0000-0000-0000-0000000320a2/photo.webp'
  where id = auth.uid() $$, '23514', null, 'chemin vers le dossier d''un autre : refusé');
select throws_ok($$ update public.profiles set avatar_path = '00000000-0000-0000-0000-0000000320a1/x.svg'
  where id = auth.uid() $$, '23514', null, 'extension hors liste : refusée');

-- Lecture : membres d'un espace commun ; personne d'autre
select pg_temp.login('00000000-0000-0000-0000-0000000320a2');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 1, 'membre d''un espace commun : lit la photo');
delete from storage.objects where bucket_id = 'avatars';
reset role;
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 1, 'un autre membre ne peut pas la supprimer');
select pg_temp.login('00000000-0000-0000-0000-0000000320a3');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 0, 'hors de l''espace : rien');
reset role;

-- RGPD : photo restée au bucket à la suppression du compte, inscrite pour la purge
-- Comme delete_my_account : l'espace dont elle est seule propriétaire part d'abord
delete from public.workspaces where id = (select ws from ctx);
delete from auth.users where id = '00000000-0000-0000-0000-0000000320a1';
select is((select path from public.storage_orphans where bucket = 'avatars'),
  '00000000-0000-0000-0000-0000000320a1/photo.webp', 'compte supprimé : photo inscrite pour la purge');

select * from finish();
rollback;
