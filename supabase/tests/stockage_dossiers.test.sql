-- Tests pgTAP : L29 schéma E, accès restreint par dossier appliqué aux fichiers (captures, published).
-- Un chemin mal formé n'ouvre jamais plus que le has_role existant.
begin;
set search_path = public, extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000e00a1', 'olga-st@acme.example'),
  ('00000000-0000-0000-0000-0000000e00a2', 'eddie-st@acme.example'),
  ('00000000-0000-0000-0000-0000000e00a3', 'vera-st@acme.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.seen(b text) returns setof text language sql as $$
  select name from storage.objects where bucket_id = b order by name;
$$;

-- Olga (propriétaire) : « Acme » ; Vera : son propre espace « Autre »
select pg_temp.login('00000000-0000-0000-0000-0000000e00a1');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-0000000e00d1', (select ws from ctx), 'Paie', auth.uid()),
  ('00000000-0000-0000-0000-0000000e00d2', (select ws from ctx), 'Accueil', auth.uid());
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000e00a3');
create temp table autre as select (public.create_workspace('Autre')).id as ws;
grant all on autre to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000e00a2', 'editor');
insert into public.folders (id, workspace_id, name, restricted)
  values ('00000000-0000-0000-0000-0000000e00f1', (select ws from ctx), 'RH', true);
update public.demos set folder_id = '00000000-0000-0000-0000-0000000e00f1' where id = '00000000-0000-0000-0000-0000000e00d1';

insert into storage.objects (bucket_id, name) values
  ('captures', (select ws from ctx) || '/00000000-0000-0000-0000-0000000e00d1/paie.webp'),
  ('captures', (select ws from ctx) || '/00000000-0000-0000-0000-0000000e00d2/accueil.webp'),
  ('captures', (select ws from ctx) || '/pas-un-uuid/vrac.webp'),
  ('captures', (select ws from autre) || '/pas-un-uuid/autre.webp'),
  ('captures', 'pas-un-espace/00000000-0000-0000-0000-0000000e00d1/x.webp'),
  ('published', '00000000-0000-0000-0000-0000000e00d1/latest.json'),
  ('published', '00000000-0000-0000-0000-0000000e00d2/latest.json');
create temp table names as select (select ws from ctx)::text as w;
grant all on names to authenticated;

-- Eddie, éditeur hors du dossier « RH »
select pg_temp.login('00000000-0000-0000-0000-0000000e00a2');
select is((select count(*)::int from pg_temp.seen('captures') n where n like '%paie.webp'), 0,
  'captures : démo d’un dossier restreint ni listée ni lisible');
select is((select count(*)::int from pg_temp.seen('captures') n where n like '%accueil.webp'), 1,
  'captures : démo hors dossier restreint lisible');
select is((select count(*)::int from pg_temp.seen('published') n where n like '00000000-0000-0000-0000-0000000e00d1/%'), 0,
  'published : démo du dossier restreint invisible');
select throws_ok($$ insert into storage.objects (bucket_id, name)
  values ('captures', (select w from names) || '/00000000-0000-0000-0000-0000000e00d1/ajout.webp') $$,
  '42501', null, 'captures : écriture refusée dans une démo du dossier restreint');
-- Chemins mal formés : jamais plus que has_role
select is((select count(*)::int from pg_temp.seen('captures') n where n like '%vrac.webp'), 1,
  'chemin sans démo dans son espace : has_role seul (inchangé)');
select is((select count(*)::int from pg_temp.seen('captures') n where n like '%autre.webp' or n like 'pas-un-espace/%'), 0,
  'chemin mal formé hors de ses espaces : aucun droit');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('captures', 'pas-un-espace/x/y.webp') $$,
  '42501', null, 'chemin mal formé : aucune écriture');
reset role;

-- Eddie ajouté au dossier ; Olga (propriétaire) voit tout
insert into public.folder_members (folder_id, user_id, workspace_id)
  values ('00000000-0000-0000-0000-0000000e00f1', '00000000-0000-0000-0000-0000000e00a2', (select ws from ctx));
select pg_temp.login('00000000-0000-0000-0000-0000000e00a2');
select is((select count(*)::int from pg_temp.seen('captures') n where n like '%paie.webp'), 1, 'membre choisi du dossier : lisible');
select is((select count(*)::int from pg_temp.seen('published') n where n like '00000000-0000-0000-0000-0000000e00d1/%'), 1,
  'membre choisi : published lisible');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000e00a1');
select is((select count(*)::int from pg_temp.seen('captures') n where n like (select w from names) || '/%'), 3,
  'propriétaire : tous les fichiers de son espace');
reset role;

select * from finish();
rollback;
