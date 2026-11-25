-- Tests pgTAP : une démo ajoutée ou retirée de la page publique de l'espace (20261201250000_page_publique_demo.sql).
-- Données fictives.
begin;
set search_path = public, extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000360a1', 'olga-ppd@acme.example'),
  ('00000000-0000-0000-0000-0000000360a2', 'camille-ppd@acme.example'),
  ('00000000-0000-0000-0000-0000000360a3', 'vera-ppd@autre.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000360a1');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to authenticated, anon, service_role;
select pg_temp.login('00000000-0000-0000-0000-0000000360a3');
create temp table ctx2 as select (public.create_workspace('Autre')).id as ws;
grant all on ctx2 to authenticated, anon, service_role;
reset role;
update public.workspaces set public_links_enabled = true where id in ((select ws from ctx), (select ws from ctx2));
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000360a2', 'editor');

-- Démos d'Acme : D1, D2, D3 publiées ouvertes ; D4 protégée par mot de passe ; D5 brouillon. D9 : autre espace.
insert into public.demos (id, workspace_id, title, created_by, status) values
  ('00000000-0000-0000-0000-0000000360d1', (select ws from ctx), 'Créer un rendez-vous', '00000000-0000-0000-0000-0000000360a1', 'published'),
  ('00000000-0000-0000-0000-0000000360d2', (select ws from ctx), 'Saisir une fiche', '00000000-0000-0000-0000-0000000360a1', 'published'),
  ('00000000-0000-0000-0000-0000000360d3', (select ws from ctx), 'Facturer', '00000000-0000-0000-0000-0000000360a1', 'published'),
  ('00000000-0000-0000-0000-0000000360d4', (select ws from ctx), 'Fiches protégées', '00000000-0000-0000-0000-0000000360a1', 'published'),
  ('00000000-0000-0000-0000-0000000360d5', (select ws from ctx), 'Brouillon', '00000000-0000-0000-0000-0000000360a1', 'draft'),
  ('00000000-0000-0000-0000-0000000360d9', (select ws from ctx2), 'Démo d''un autre espace', '00000000-0000-0000-0000-0000000360a3', 'published');
insert into public.demo_versions (id, demo_id, workspace_id, number, manifest)
select ('00000000-0000-0000-0000-0000000360e' || n)::uuid, ('00000000-0000-0000-0000-0000000360d' || n)::uuid,
       (select workspace_id from public.demos where id = ('00000000-0000-0000-0000-0000000360d' || n)::uuid), 1, '{"steps":[{},{}]}'::jsonb
from unnest(array[1, 2, 3, 4, 5, 9]) n;
update public.demos set current_version_id = ('00000000-0000-0000-0000-0000000360e' || right(id::text, 1))::uuid
 where id::text like '00000000-0000-0000-0000-0000000360d%';
insert into public.demo_access (demo_id, workspace_id, mode, password_hash) values
  ('00000000-0000-0000-0000-0000000360d4', (select ws from ctx), 'password', extensions.crypt('secret-module', extensions.gen_salt('bf', 4)));

-- Page publique hors ligne : état lisible, changement refusé
select pg_temp.login('00000000-0000-0000-0000-0000000360a1');
select is((select public.public_page_demo('00000000-0000-0000-0000-0000000360d1') ->> 'reason'), 'off',
  'page hors ligne : la démo n''y est pas visible (off)');
select throws_ok($$ select public.set_public_page_demo('00000000-0000-0000-0000-0000000360d1', false) $$, 'P0001', 'PAGE_OFF',
  'page hors ligne : rien à changer');
select lives_ok($$ select public.save_public_page((select ws from ctx), 'acme-ppd', '{}', true) $$, 'page publique mise en ligne, toutes les démos');
select is((select public.public_page_demo('00000000-0000-0000-0000-0000000360d1') - 'listed'),
  '{"enabled": true, "shown": true, "canEdit": true, "reason": null}'::jsonb, 'démo publiée ouverte : affichée, modifiable par l''administratrice');
select is((select public.public_page_demo('00000000-0000-0000-0000-0000000360d4') ->> 'reason'), 'restricted', 'démo protégée : accès restreint');
select is((select public.public_page_demo('00000000-0000-0000-0000-0000000360d5') ->> 'reason'), 'unpublished', 'brouillon : à publier d''abord');
select throws_ok($$ select public.set_public_page_demo('00000000-0000-0000-0000-0000000360d4', true) $$, 'P0001', 'DEMO_NOT_PUBLIC',
  'démo protégée : ne peut pas être ajoutée');

-- Retirer une démo de « toutes les démos » : la liste devient choisie, avec les autres
select is((select public.set_public_page_demo('00000000-0000-0000-0000-0000000360d2', false) ->> 'shown'), 'false', 'démo retirée de la page');
select is((select jsonb_array_length(public_page -> 'demos') from public.training_centers where workspace_id = (select ws from ctx)), 2,
  'la liste devient « démos choisies » : les deux autres démos ouvertes');
select ok((select not (public_page -> 'demos') ? '00000000-0000-0000-0000-0000000360d2'
             and (public_page -> 'demos') ? '00000000-0000-0000-0000-0000000360d1' from public.training_centers where workspace_id = (select ws from ctx)),
  'la démo retirée n''y est plus, les autres y restent');
select is((select public.set_public_page_demo('00000000-0000-0000-0000-0000000360d2', true) ->> 'shown'), 'true', 'démo remise sur la page');
select is((select public_page -> 'demos' ->> 2 from public.training_centers where workspace_id = (select ws from ctx)),
  '00000000-0000-0000-0000-0000000360d2', 'elle est ajoutée en fin de liste');

-- Rôles : l'éditrice lit l'état mais ne change rien ; un autre espace ne voit rien
select pg_temp.login('00000000-0000-0000-0000-0000000360a2');
select is((select public.public_page_demo('00000000-0000-0000-0000-0000000360d1') ->> 'canEdit'), 'false', 'éditrice : état lisible, non modifiable');
select throws_ok($$ select public.set_public_page_demo('00000000-0000-0000-0000-0000000360d1', false) $$, '42501', null, 'éditrice : changement refusé');
select pg_temp.login('00000000-0000-0000-0000-0000000360a3');
select throws_ok($$ select public.public_page_demo('00000000-0000-0000-0000-0000000360d1') $$, '42501', null, 'autre espace : état refusé');
select throws_ok($$ select public.set_public_page_demo('00000000-0000-0000-0000-0000000360d1', false) $$, '42501', null, 'autre espace : changement refusé');

select * from finish();
rollback;
