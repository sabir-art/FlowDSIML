-- Tests pgTAP : page publique de l'espace (20261201190000_page_publique_catalogue.sql).
-- Données fictives.
begin;
set search_path = public, extensions;
select plan(31);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000350a1', 'olga-pp@acme.example'),
  ('00000000-0000-0000-0000-0000000350a2', 'camille-pp@acme.example'),
  ('00000000-0000-0000-0000-0000000350a3', 'vera-pp@autre.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000350a1');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to authenticated, anon, service_role;
select pg_temp.login('00000000-0000-0000-0000-0000000350a3');
create temp table ctx2 as select (public.create_workspace('Autre')).id as ws;
grant all on ctx2 to authenticated, anon, service_role;
reset role;
update public.workspaces set public_links_enabled = true where id in ((select ws from ctx), (select ws from ctx2));
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000350a2', 'editor');

-- Démos d'Acme : D1, D2, D3 publiées ouvertes ; D4 protégée par mot de passe ; D5 brouillon. D9 : autre espace.
insert into public.demos (id, workspace_id, title, created_by, status) values
  ('00000000-0000-0000-0000-0000000350d1', (select ws from ctx), 'Créer un rendez-vous', '00000000-0000-0000-0000-0000000350a1', 'published'),
  ('00000000-0000-0000-0000-0000000350d2', (select ws from ctx), 'Saisir une fiche', '00000000-0000-0000-0000-0000000350a1', 'published'),
  ('00000000-0000-0000-0000-0000000350d3', (select ws from ctx), 'Facturer', '00000000-0000-0000-0000-0000000350a1', 'published'),
  ('00000000-0000-0000-0000-0000000350d4', (select ws from ctx), 'Fiches protégées', '00000000-0000-0000-0000-0000000350a1', 'published'),
  ('00000000-0000-0000-0000-0000000350d5', (select ws from ctx), 'Brouillon', '00000000-0000-0000-0000-0000000350a1', 'draft'),
  ('00000000-0000-0000-0000-0000000350d9', (select ws from ctx2), 'Démo d''un autre espace', '00000000-0000-0000-0000-0000000350a3', 'published');
insert into public.demo_versions (id, demo_id, workspace_id, number, manifest)
select ('00000000-0000-0000-0000-0000000350e' || n)::uuid, ('00000000-0000-0000-0000-0000000350d' || n)::uuid,
       (select workspace_id from public.demos where id = ('00000000-0000-0000-0000-0000000350d' || n)::uuid), 1, '{"steps":[{},{}]}'::jsonb
from unnest(array[1, 2, 3, 4, 5, 9]) n;
update public.demos set current_version_id = ('00000000-0000-0000-0000-0000000350e' || right(id::text, 1))::uuid
 where id::text like '00000000-0000-0000-0000-0000000350d%';
insert into public.demo_access (demo_id, workspace_id, mode, password_hash) values
  ('00000000-0000-0000-0000-0000000350d4', (select ws from ctx), 'password', extensions.crypt('secret-module', extensions.gen_salt('bf', 4)));
insert into storage.objects (bucket_id, name, metadata) values
  ('media', (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000350f1.png', '{"size": 1000}'),
  ('media', (select ws from ctx2)::text || '/00000000-0000-0000-0000-0000000350f9.png', '{"size": 1000}');
insert into public.media_files (id, workspace_id, kind, name, path, mime) values
  ('00000000-0000-0000-0000-0000000350f1', (select ws from ctx), 'logo', 'Logo Acme',
   (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000350f1.png', 'image/png'),
  ('00000000-0000-0000-0000-0000000350f9', (select ws from ctx2), 'logo', 'Logo Autre',
   (select ws from ctx2)::text || '/00000000-0000-0000-0000-0000000350f9.png', 'image/png');
-- Comme la fonction Edge open-center (service) : center_open n'est pas ouverte aux membres
create function pg_temp.open(p_slug text) returns jsonb language sql security definer as $$
  select public.center_open(p_slug);
$$;
create function pg_temp.titles(p jsonb) returns text language sql as $$
  select string_agg(d ->> 'title', ' | ') from jsonb_array_elements(p -> 'demos') with ordinality as x(d, n);
$$;

-- ===== Réglages : forme acceptée =====
select ok(public.public_page_valid('{"title":"Les démos d''Acme","tagline":"À votre rythme.","logo":null,"demos":"all","contact":"formation@acme.example","madeWith":false}'),
  'réglages complets acceptés');
select ok(not public.public_page_valid('{"autre":1}'), 'clé inconnue refusée');
select ok(not public.public_page_valid(jsonb_build_object('tagline', repeat('a', 161))), 'phrase d''accueil : 160 caractères au plus');
select ok(not public.public_page_valid('{"contact":"http://acme.example"}') and not public.public_page_valid('{"contact":"javascript:alert(1)"}')
          and public.public_page_valid('{"contact":"https://acme.example/contact"}'), 'contact : e-mail ou https seulement');
select ok(not public.public_page_valid('{"demos":["pas-un-uuid"]}') and not public.public_page_valid('{"demos":"aucune"}'),
  'démos : « all » ou une liste d''identifiants');
select ok(not public.public_page_valid('{"logo":"https://ailleurs.example/logo.png"}'), 'logo : un chemin de la médiathèque, jamais une adresse');

-- ===== Droits =====
select pg_temp.login('00000000-0000-0000-0000-0000000350a2');
select throws_ok($$ select public.save_public_page((select ws from ctx), 'acme', '{}', false) $$, '42501', null, 'rôle editor : refusé');
select throws_ok($$ select public.public_page_info((select ws from ctx)) $$, '42501', null, 'rôle editor : pas d''information');
select pg_temp.login('00000000-0000-0000-0000-0000000350a3');
select throws_ok($$ select public.save_public_page((select ws from ctx), 'acme', '{}', false) $$, '42501', null, 'autre espace : refusé');
select lives_ok($$ select public.save_public_page((select ws from ctx2), 'autre', '{}', false) $$, 'autre espace : sa propre page');

-- ===== Enregistrement et validations =====
select pg_temp.login('00000000-0000-0000-0000-0000000350a1');
select throws_ok($$ select public.save_public_page((select ws from ctx), 'Acme!', '{}', false) $$, 'P0001', 'SLUG_INVALID', 'adresse invalide');
select throws_ok($$ select public.save_public_page((select ws from ctx), 'autre', '{}', false) $$, 'P0001', 'SLUG_TAKEN', 'adresse déjà prise');
select throws_ok($$ select public.save_public_page((select ws from ctx), 'acme',
  jsonb_build_object('demos', jsonb_build_array('00000000-0000-0000-0000-0000000350d9')), false) $$,
  'P0001', 'PAGE_INVALID', 'démo d''un autre espace refusée');
select throws_ok($$ select public.save_public_page((select ws from ctx), 'acme',
  jsonb_build_object('logo', (select ws from ctx2)::text || '/00000000-0000-0000-0000-0000000350f9.png'), false) $$,
  'P0001', 'PAGE_INVALID', 'logo d''un autre espace refusé');
select lives_ok($$ select public.save_public_page((select ws from ctx), 'acme', '{"title":"Les démos d''Acme"}', false) $$,
  'enregistrée, page coupée');
select is(pg_temp.open('acme') ->> 'status', 'not_found', 'page coupée : l''adresse ne répond pas');
select is((public.public_page_info((select ws from ctx)) -> 'demos')::jsonb @> '[{"title":"Saisir une fiche"}]'::jsonb
          and jsonb_array_length(public.public_page_info((select ws from ctx)) -> 'demos') = 3, true,
  'information : les trois démos publiées en accès ouvert, pas la protégée ni le brouillon');

-- ===== Activation : toutes les démos =====
select lives_ok($$ select public.save_public_page((select ws from ctx), 'acme',
  '{"title":"Les démos d''Acme","tagline":"À votre rythme.","demos":"all","contact":"formation@acme.example"}', true) $$, 'activée');
select is(pg_temp.titles(pg_temp.open('acme')), 'Créer un rendez-vous | Facturer | Saisir une fiche',
  'toutes les démos publiées ouvertes, par titre ; ni protégée, ni brouillon, ni autre espace');
select ok((select o ->> 'status' = 'ok' and o -> 'center' ->> 'kind' = 'demo' and o -> 'center' ->> 'heroTitle' = 'Les démos d''Acme'
             and o -> 'center' ->> 'heroSubtitle' = 'À votre rythme.' and o -> 'center' ->> 'help' = 'formation@acme.example'
             and (o -> 'center' ->> 'madeWith')::boolean and o -> 'paths' = '[]'::jsonb and o -> 'visitor' = 'null'::jsonb
           from (select pg_temp.open('acme') o) x),
  'contenu public : titre, phrase, contact, « Fait avec » affiché par défaut, ni parcours ni visiteur');
select ok(pg_temp.open('acme')::text !~ 'acme\.example"?,"?email|olga|created_by|password', 'aucune donnée de membre dans le contenu public');

-- ===== Démos choisies, dans l'ordre =====
select public.save_public_page((select ws from ctx), 'acme', jsonb_build_object('madeWith', false,
  'logo', (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000350f1.png',
  'demos', jsonb_build_array('00000000-0000-0000-0000-0000000350d3', '00000000-0000-0000-0000-0000000350d1',
                             '00000000-0000-0000-0000-0000000350d4', '00000000-0000-0000-0000-0000000350d5')), true);
select is(pg_temp.titles(pg_temp.open('acme')), 'Facturer | Créer un rendez-vous',
  'démos choisies : dans l''ordre choisi ; la protégée et le brouillon ne sortent pas');
select ok((select not (o -> 'center' ->> 'madeWith')::boolean and o -> 'center' ->> 'logoMedia' like '%350f1.png'
           from (select pg_temp.open('acme') o) x), '« Fait avec » masqué, logo de la médiathèque');
reset role;
update public.demos set status = 'draft' where id = '00000000-0000-0000-0000-0000000350d3';
select is(pg_temp.titles(pg_temp.open('acme')), 'Créer un rendez-vous', 'une démo dépubliée quitte la page d''elle-même');
update public.demos set status = 'published' where id = '00000000-0000-0000-0000-0000000350d3';

-- ===== Refus d'activation =====
select pg_temp.login('00000000-0000-0000-0000-0000000350a1');
select throws_ok($$ select public.save_public_page((select ws from ctx), 'acme',
  jsonb_build_object('demos', jsonb_build_array('00000000-0000-0000-0000-0000000350d4')), true) $$,
  'P0001', 'NO_VISIBLE_DEMO', 'aucune démo affichable : activation refusée');
reset role;
update public.workspaces set public_links_enabled = false where id = (select ws from ctx);
select is(pg_temp.open('acme') ->> 'status', 'not_found', 'liens publics coupés : l''adresse ne répond plus');
select pg_temp.login('00000000-0000-0000-0000-0000000350a1');
select throws_ok($$ select public.save_public_page((select ws from ctx), 'acme', '{"demos":"all"}', true) $$,
  'P0001', 'PUBLIC_DISABLED', 'liens publics coupés : activation refusée');
reset role;
update public.workspaces set public_links_enabled = true where id = (select ws from ctx);

-- ===== Centre de formation à la même adresse : jamais écrasé =====
select pg_temp.login('00000000-0000-0000-0000-0000000350a1');
select public.save_public_page((select ws from ctx), 'acme', '{"demos":"all"}', false);
reset role;
insert into public.paths (id, workspace_id, title, description, ordered)
  values ('00000000-0000-0000-0000-0000000350c1', (select ws from ctx), 'Logiciel métier', 'Les bases', true);
insert into public.path_modules (path_id, demo_id, position)
  values ('00000000-0000-0000-0000-0000000350c1', '00000000-0000-0000-0000-0000000350d1', 0);
select pg_temp.login('00000000-0000-0000-0000-0000000350a1');
select public.save_center_draft((select ws from ctx), 'acme',
  '{"title":"Centre Acme","paths":[{"id":"00000000-0000-0000-0000-0000000350c1","visible":true}]}'::jsonb);
select public.publish_center((select ws from ctx));
select ok((select o -> 'center' ->> 'kind' = 'training' and jsonb_array_length(o -> 'paths') = 1
           from (select pg_temp.open('acme') o) x), 'page coupée : l''adresse affiche le centre de formation, comme avant');
select throws_ok($$ select public.save_public_page((select ws from ctx), 'acme', '{"demos":"all"}', true) $$,
  'P0001', 'CENTER_PUBLISHED', 'centre de formation en ligne : confirmation exigée');
select public.save_public_page((select ws from ctx), 'acme', '{"demos":"all"}', true, true);
select ok((select o -> 'center' ->> 'kind' = 'demo' and jsonb_array_length(o -> 'demos') = 3
           from (select pg_temp.open('acme') o) x)
          and (select published ->> 'title' = 'Centre Acme' and draft ->> 'title' = 'Centre Acme'
                 from public.training_centers where workspace_id = (select ws from ctx)),
  'remplacement confirmé : la page publique répond, les réglages du centre sont intacts');
select public.save_public_page((select ws from ctx), 'acme', '{"demos":"all"}', false);
select ok((select o -> 'center' ->> 'kind' = 'training' and o ->> 'title' = 'Centre Acme'
           from (select pg_temp.open('acme') o) x), 'page coupée de nouveau : le centre de formation revient tel quel');

select * from finish();
rollback;
