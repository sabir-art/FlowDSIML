-- Tests pgTAP : L28 082 (adresse personnalisée d'une démo). Format et mots réservés, une seule adresse
-- courante, redirection 90 jours, démo non publiée ou supprimée, droits, dossier restreint, non-fuite.
begin;
set search_path = public, extensions;
select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000082a1', 'admin-adresse@example.com'),
  ('00000000-0000-0000-0000-0000000082a2', 'lecteur-adresse@example.com'),
  ('00000000-0000-0000-0000-0000000082a3', 'editeur-exclu@example.com'),
  ('00000000-0000-0000-0000-0000000082a4', 'autre-espace@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000082a1');
create temp table ctx as select (public.create_workspace('Adresses')).id as ws;
grant all on ctx to authenticated, anon, service_role;
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000082a4');
create temp table ws2 as select (public.create_workspace('Autre')).id as ws;
grant all on ws2 to authenticated, anon, service_role;
reset role;
update public.workspaces set plan_code = 'enterprise' where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000082a2', 'viewer'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000082a3', 'editor');
insert into public.folders (id, workspace_id, name, restricted) values
  ('00000000-0000-0000-0000-0000000082f1', (select ws from ctx), 'RH', true);
insert into public.demos (id, workspace_id, folder_id, title, status) values
  ('00000000-0000-0000-0000-0000000082d1', (select ws from ctx), null, 'Accueil', 'published'),
  ('00000000-0000-0000-0000-0000000082d2', (select ws from ctx), null, 'Brouillon', 'draft'),
  ('00000000-0000-0000-0000-0000000082d3', (select ws from ctx), '00000000-0000-0000-0000-0000000082f1', 'Paie', 'published');
insert into public.demos (id, workspace_id, title, status) values
  ('00000000-0000-0000-0000-0000000082d9', (select ws from ws2), 'Autre', 'published');

-- ===== Écriture =====
select pg_temp.login('00000000-0000-0000-0000-0000000082a1');
create temp table a1 as select public.set_demo_address('00000000-0000-0000-0000-0000000082d1', 'Accueil-RH') as v;
grant all on a1 to authenticated, anon;
select matches((select v from a1), '^accueil-rh-[A-Za-z0-9]{6}$', 'adresse : partie lisible en minuscules + suffixe base62');
select throws_ok($$ select public.set_demo_address('00000000-0000-0000-0000-0000000082d1', 'a') $$,
  'P0001', 'ADDRESS_FORMAT', 'trop court : ADDRESS_FORMAT');
select throws_ok($$ select public.set_demo_address('00000000-0000-0000-0000-0000000082d1', '-accueil') $$,
  'P0001', 'ADDRESS_FORMAT', 'tiret au début : ADDRESS_FORMAT');
select throws_ok($$ select public.set_demo_address('00000000-0000-0000-0000-0000000082d1', 'accueil_rh') $$,
  'P0001', 'ADDRESS_FORMAT', 'caractère hors liste : ADDRESS_FORMAT');
select throws_ok($$ select public.set_demo_address('00000000-0000-0000-0000-0000000082d1', repeat('a', 49)) $$,
  'P0001', 'ADDRESS_FORMAT', '49 caractères : ADDRESS_FORMAT');
select throws_ok($$ select public.set_demo_address('00000000-0000-0000-0000-0000000082d1', 'admin') $$,
  'P0001', 'ADDRESS_RESERVED', 'mot réservé : ADDRESS_RESERVED');
create temp table a2 as select public.set_demo_address('00000000-0000-0000-0000-0000000082d1', 'accueil') as v;
grant all on a2 to authenticated, anon;
select is((select count(*)::int from public.demo_addresses
            where demo_id = '00000000-0000-0000-0000-0000000082d1' and retired_at is null), 1,
  'une seule adresse courante par démo');
select isnt((select v from a1), (select v from a2), 'changement : nouvelle adresse');
-- Même partie lisible dans un autre espace : accepté, aucune erreur
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000082a4');
select matches(public.set_demo_address('00000000-0000-0000-0000-0000000082d9', 'accueil'),
  '^accueil-[A-Za-z0-9]{6}$', 'même partie lisible dans un autre espace : acceptée sans rien révéler');
select is((select count(*)::int from public.demo_addresses), 1, 'autre espace : ne voit que sa propre adresse');
reset role;

-- ===== Droits =====
select pg_temp.login('00000000-0000-0000-0000-0000000082a2');
select throws_ok($$ select public.set_demo_address('00000000-0000-0000-0000-0000000082d1', 'lecteur') $$,
  '42501', 'FORBIDDEN', 'lecteur : FORBIDDEN');
select is((select count(*)::int from public.demo_addresses where retired_at is null), 1, 'lecteur : voit l’adresse courante');
select throws_ok($$ insert into public.demo_addresses (address, demo_id, workspace_id)
  values ('direct-abcdef', '00000000-0000-0000-0000-0000000082d1', (select ws from ctx)) $$,
  '42501', null, 'aucune écriture directe');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000082a1');
create temp table a3 as select public.set_demo_address('00000000-0000-0000-0000-0000000082d3', 'paie') as v;
grant all on a3 to authenticated, anon;
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000082a3');
select is((select count(*)::int from public.demo_addresses where demo_id = '00000000-0000-0000-0000-0000000082d3'), 0,
  'dossier restreint : adresse invisible pour un membre non autorisé');
select throws_ok($$ select public.set_demo_address('00000000-0000-0000-0000-0000000082d3', 'pirate') $$,
  '42501', 'FORBIDDEN', 'dossier restreint : écriture refusée');
reset role;

-- ===== Résolution publique =====
select pg_temp.anon();
select is(public.resolve_demo_address((select v from a2)), '00000000-0000-0000-0000-0000000082d1'::uuid,
  'anon : adresse courante résolue');
select is(public.resolve_demo_address((select v from a1)), '00000000-0000-0000-0000-0000000082d1'::uuid,
  'anon : ancienne adresse redirigée (moins de 90 jours)');
select is(public.resolve_demo_address('inconnue-abcdef'), null, 'anon : adresse inconnue : null');
select throws_ok($$ select count(*) from public.demo_addresses $$, '42501', null, 'anon : table illisible');
reset role;
update public.demo_addresses set retired_at = now() - interval '91 days' where address = (select v from a1);
select pg_temp.anon();
select is(public.resolve_demo_address((select v from a1)), null, 'ancienne adresse après 90 jours : null');
reset role;
update public.demos set status = 'draft' where id = '00000000-0000-0000-0000-0000000082d1';
select pg_temp.anon();
select is(public.resolve_demo_address((select v from a2)), null, 'démo dépubliée : null');
reset role;
update public.demos set status = 'published', deleted_at = now() where id = '00000000-0000-0000-0000-0000000082d1';
select pg_temp.anon();
select is(public.resolve_demo_address((select v from a2)), null, 'démo supprimée : null');
reset role;

select * from finish();
rollback;
