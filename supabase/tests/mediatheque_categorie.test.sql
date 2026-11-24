-- Tests pgTAP : renommer un fichier de la médiathèque et changer sa catégorie
-- (20261201200000_mediatheque_categorie.sql). Données fictives.
begin;
set search_path = public, extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000360a1', 'olga-md@acme.example'),
  ('00000000-0000-0000-0000-0000000360a2', 'camille-md@acme.example'),
  ('00000000-0000-0000-0000-0000000360a3', 'vera-md@acme.example'),
  ('00000000-0000-0000-0000-0000000360a4', 'ines-md@autre.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000360a1');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000360a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000360a3', 'viewer');
insert into storage.objects (bucket_id, name, metadata) values
  ('media', (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000360f1.png', '{"size": 1000}'),
  ('media', (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000360f2.woff2', '{"size": 1000}');
insert into public.media_files (id, workspace_id, kind, name, path, mime) values
  ('00000000-0000-0000-0000-0000000360f1', (select ws from ctx), 'image', 'logo-acme-blanc.png',
   (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000360f1.png', 'image/png'),
  ('00000000-0000-0000-0000-0000000360f2', (select ws from ctx), 'font', 'Marianne',
   (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000360f2.woff2', 'font/woff2');
create function pg_temp.f(p_col text) returns text language sql as $$
  select case p_col when 'kind' then kind else name end from public.media_files
   where id = '00000000-0000-0000-0000-0000000360f1';
$$;

-- ===== Droits =====
select pg_temp.login('00000000-0000-0000-0000-0000000360a3');
select throws_ok($$ select public.set_media_kind('00000000-0000-0000-0000-0000000360f1', 'logo') $$, '42501', null,
  'rôle viewer : catégorie refusée');
select throws_ok($$ select public.rename_media_file('00000000-0000-0000-0000-0000000360f1', 'Autre') $$, '42501', null,
  'rôle viewer : renommage refusé');
select pg_temp.login('00000000-0000-0000-0000-0000000360a4');
select throws_ok($$ select public.set_media_kind('00000000-0000-0000-0000-0000000360f1', 'logo') $$, '42501', null,
  'autre espace : catégorie refusée');
select throws_ok($$ select public.rename_media_file('00000000-0000-0000-0000-0000000360f1', 'Autre') $$, '42501', null,
  'autre espace : renommage refusé');
select pg_temp.login('00000000-0000-0000-0000-0000000360a2');
select throws_ok($$ update public.media_files set kind = 'logo' $$, '42501', null, 'aucune écriture directe dans la table');

-- ===== Catégorie =====
select lives_ok($$ select public.set_media_kind('00000000-0000-0000-0000-0000000360f1', 'logo') $$, 'rôle editor : image rangée avec les logos');
select is(pg_temp.f('kind'), 'logo', 'catégorie enregistrée');
select lives_ok($$ select public.set_media_kind('00000000-0000-0000-0000-0000000360f1', 'image') $$, 'retour à Image');
select throws_ok($$ select public.set_media_kind('00000000-0000-0000-0000-0000000360f1', 'font') $$, '22023', null,
  'une image ne devient pas une police');
select throws_ok($$ select public.set_media_kind('00000000-0000-0000-0000-0000000360f2', 'logo') $$, '22023', null,
  'une police reste une police');
select throws_ok($$ select public.set_media_kind('00000000-0000-0000-0000-0000000360f1', 'autre') $$, '22023', null,
  'catégorie inconnue refusée');

-- ===== Nom =====
select lives_ok($$ select public.rename_media_file('00000000-0000-0000-0000-0000000360f1', '  Logo Acme blanc  ') $$, 'renommage par un éditeur');
select is(pg_temp.f('name'), 'Logo Acme blanc', 'nom enregistré sans espaces autour');
select throws_ok($$ select public.rename_media_file('00000000-0000-0000-0000-0000000360f1', '   ') $$, '22023', null, 'nom vide refusé');

-- ===== Démos qui utilisent le fichier (20261201210000_mediatheque_usages.sql) =====
reset role;
insert into public.demos (id, workspace_id, title, created_by, settings) values
  ('00000000-0000-0000-0000-0000000360d1', (select ws from ctx), 'Démo CRM', '00000000-0000-0000-0000-0000000360a1',
   jsonb_build_object('theme', jsonb_build_object('logoUrl', 'https://x.example/storage/v1/object/public/media/' || (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000360f1.png'))),
  ('00000000-0000-0000-0000-0000000360d2', (select ws from ctx), 'Sans logo', '00000000-0000-0000-0000-0000000360a1', '{}'),
  ('00000000-0000-0000-0000-0000000360d3', (select ws from ctx), 'Supprimée', '00000000-0000-0000-0000-0000000360a1',
   jsonb_build_object('logo', (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000360f1.png'));
update public.demos set deleted_at = now() where id = '00000000-0000-0000-0000-0000000360d3';
select pg_temp.login('00000000-0000-0000-0000-0000000360a3');
select is(public.media_file_demos('00000000-0000-0000-0000-0000000360f1'),
  '[{"id": "00000000-0000-0000-0000-0000000360d1", "title": "Démo CRM"}]'::jsonb,
  'démos qui utilisent le fichier : la démo concernée, pas la supprimée, lisible par un lecteur');
select is(public.media_file_demos('00000000-0000-0000-0000-0000000360f2'), '[]'::jsonb, 'fichier non utilisé : liste vide');
select is((select (x ->> 'demos')::int from jsonb_array_elements(public.media_usage((select ws from ctx))) x
            where x ->> 'id' = '00000000-0000-0000-0000-0000000360f1'), 1, 'même décompte que media_usage');
select pg_temp.login('00000000-0000-0000-0000-0000000360a4');
select throws_ok($$ select public.media_file_demos('00000000-0000-0000-0000-0000000360f1') $$, '42501', null,
  'autre espace : refusé');

select * from finish();
rollback;
