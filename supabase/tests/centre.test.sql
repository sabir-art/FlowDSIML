-- Tests pgTAP : L14 centre de formation (réglages admin, publication, contenu public sans brouillon,
-- modules protégés ou expirés, visiteur identifié, mot de passe du centre, réponses identiques).
begin;
set search_path = public, extensions;
select plan(33);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000002a1', 'admin-centre@example.com'),
  ('00000000-0000-0000-0000-0000000002a2', 'editeur-centre@example.com'),
  ('00000000-0000-0000-0000-0000000002a3', 'autre-centre@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000002a1');
create temp table ctx as select (public.create_workspace('Mission Locale Exemple')).id as ws;
grant all on ctx to authenticated, anon, service_role;
select pg_temp.login('00000000-0000-0000-0000-0000000002a3');
create temp table ctx2 as select (public.create_workspace('Autre')).id as ws;
grant all on ctx2 to authenticated, anon, service_role;
reset role;
update public.workspaces set public_links_enabled = true where id in ((select ws from ctx), (select ws from ctx2));
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000002a2', 'editor');

-- Démos : D1 ouverte, D2 mot de passe, D3 expirée, D4 brouillon, D5 supprimée
insert into public.demos (id, workspace_id, title, created_by, status, deleted_at) values
  ('00000000-0000-0000-0000-0000000002d1', (select ws from ctx), 'Prise en main', '00000000-0000-0000-0000-0000000002a1', 'published', null),
  ('00000000-0000-0000-0000-0000000002d2', (select ws from ctx), 'Fiches protégées', '00000000-0000-0000-0000-0000000002a1', 'published', null),
  ('00000000-0000-0000-0000-0000000002d3', (select ws from ctx), 'Ancienne démo', '00000000-0000-0000-0000-0000000002a1', 'published', null),
  ('00000000-0000-0000-0000-0000000002d4', (select ws from ctx), 'Brouillon secret', '00000000-0000-0000-0000-0000000002a1', 'draft', null),
  ('00000000-0000-0000-0000-0000000002d5', (select ws from ctx), 'Démo supprimée', '00000000-0000-0000-0000-0000000002a1', 'published', now());
insert into public.demo_versions (id, demo_id, workspace_id, number, manifest)
select ('00000000-0000-0000-0000-0000000002e' || n)::uuid, ('00000000-0000-0000-0000-0000000002d' || n)::uuid,
       (select ws from ctx), 1,
       '{"steps":[{"image":{"url":"assets/s1-abc.webp","width":1280,"height":800}},{}]}'::jsonb
from generate_series(1, 5) n;
update public.demos set current_version_id = ('00000000-0000-0000-0000-0000000002e' || right(id::text, 1))::uuid
 where workspace_id = (select ws from ctx);
insert into public.demo_access (demo_id, workspace_id, mode, password_hash, expires_at) values
  ('00000000-0000-0000-0000-0000000002d2', (select ws from ctx), 'password', extensions.crypt('secret-module', extensions.gen_salt('bf', 4)), null),
  ('00000000-0000-0000-0000-0000000002d3', (select ws from ctx), 'link', null, now() - interval '1 day');
-- Formations : P1 (modules de tous les états), P2 (brouillon seul), P3 (masquée)
insert into public.paths (id, workspace_id, title, description, ordered) values
  ('00000000-0000-0000-0000-0000000002f1', (select ws from ctx), 'Logiciel métier', 'Les bases', true),
  ('00000000-0000-0000-0000-0000000002f2', (select ws from ctx), 'Formation en préparation', '', false),
  ('00000000-0000-0000-0000-0000000002f3', (select ws from ctx), 'Formation masquée', '', false);
insert into public.path_modules (path_id, demo_id, position) values
  ('00000000-0000-0000-0000-0000000002f1', '00000000-0000-0000-0000-0000000002d1', 0),
  ('00000000-0000-0000-0000-0000000002f1', '00000000-0000-0000-0000-0000000002d2', 1),
  ('00000000-0000-0000-0000-0000000002f1', '00000000-0000-0000-0000-0000000002d3', 2),
  ('00000000-0000-0000-0000-0000000002f1', '00000000-0000-0000-0000-0000000002d4', 3),
  ('00000000-0000-0000-0000-0000000002f1', '00000000-0000-0000-0000-0000000002d5', 4),
  ('00000000-0000-0000-0000-0000000002f2', '00000000-0000-0000-0000-0000000002d4', 0),
  ('00000000-0000-0000-0000-0000000002f3', '00000000-0000-0000-0000-0000000002d1', 0);
-- Étiquettes : une sur D1 (visible), une sur le brouillon D4 (ne doit pas sortir)
insert into public.tags (id, workspace_id, name, color) values
  ('00000000-0000-0000-0000-0000000002b1', (select ws from ctx), 'Logiciel', 'blue'),
  ('00000000-0000-0000-0000-0000000002b2', (select ws from ctx), 'Étiquette brouillon', 'green');
insert into public.demo_tags (demo_id, tag_id, workspace_id) values
  ('00000000-0000-0000-0000-0000000002d1', '00000000-0000-0000-0000-0000000002b1', (select ws from ctx)),
  ('00000000-0000-0000-0000-0000000002d4', '00000000-0000-0000-0000-0000000002b2', (select ws from ctx));
-- Lien personnel d'Alex (apprenant identifié par lien), et un lien expiré
insert into public.share_links (id, demo_id, workspace_id, token, name, variables, expires_at) values
  ('00000000-0000-0000-0000-0000000002c1', '00000000-0000-0000-0000-0000000002d1', (select ws from ctx), 'jeton-alex-0001', 'Alex',
   '{"first_name":"Alex","last_name":"Dupont","email":"alex@exemple.example"}', null),
  ('00000000-0000-0000-0000-0000000002c2', '00000000-0000-0000-0000-0000000002d1', (select ws from ctx), 'jeton-expire-01', 'Sam',
   '{"first_name":"Sam"}', now() - interval '1 day');
insert into public.learners (workspace_id, email, full_name, source, share_link_id) values
  ((select ws from ctx), 'alex@exemple.example', 'Alex Dupont', 'link', '00000000-0000-0000-0000-0000000002c1'),
  ((select ws from ctx), null, 'Sam', 'link', '00000000-0000-0000-0000-0000000002c2');

create temp table conf as select jsonb_build_object(
  'title', 'Centre de formation', 'intro', 'Bienvenue', 'brand', '#A3195B', 'accent', '#97C11F', 'style', 'workspace',
  'a11y', 'non_evalue', 'indexable', false,
  'paths', jsonb_build_array(
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000002f1', 'visible', true),
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000002f2', 'visible', true),
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000002f3', 'visible', false))) as d;
grant all on conf to authenticated, anon;

-- ===== Réglages : droits et validation =====
select pg_temp.login('00000000-0000-0000-0000-0000000002a2');
select throws_ok($$ select public.save_center_draft((select ws from ctx), 'ml-exemple', '{}') $$, '42501', null,
  'un éditeur ne règle pas le centre');
select pg_temp.login('00000000-0000-0000-0000-0000000002a3');
select lives_ok($$ select public.save_center_draft((select ws from ctx2), 'autre-centre', '{}') $$, 'autre workspace : brouillon enregistré');
select pg_temp.login('00000000-0000-0000-0000-0000000002a1');
select throws_ok($$ select public.save_center_draft((select ws from ctx), 'admin', '{}') $$, 'P0001', 'SLUG_INVALID', 'adresse réservée refusée');
select throws_ok($$ select public.save_center_draft((select ws from ctx), 'Majuscules', '{}') $$, 'P0001', 'SLUG_INVALID', 'format d''adresse');
select throws_ok($$ select public.save_center_draft((select ws from ctx), 'autre-centre', '{}') $$, 'P0001', 'SLUG_TAKEN', 'adresse déjà prise');
select throws_ok($$ select public.save_center_draft((select ws from ctx), 'ml-exemple', '{"script":"x"}') $$, 'P0001', 'CENTER_INVALID',
  'clé inconnue refusée');
select throws_ok($$ select public.save_center_draft((select ws from ctx), 'ml-exemple', '{"brand":"red"}') $$, 'P0001', 'CENTER_INVALID',
  'couleur au format hexadécimal');
select throws_ok($$ select public.save_center_draft((select ws from ctx), 'ml-exemple',
  jsonb_build_object('logoPath', (select ws from ctx2)::text || '/center-logo-abcd.png')) $$, 'P0001', 'CENTER_INVALID',
  'logo d''un autre workspace refusé');
select throws_ok($$ select public.save_center_draft((select ws from ctx), 'ml-exemple',
  '{"paths":[{"id":"00000000-0000-0000-0000-000000000999","visible":true}]}') $$, 'P0001', 'PATH_WORKSPACE',
  'formation d''un autre workspace refusée');
select is(public.center_slug_available('autre-centre', (select ws from ctx)), false, 'disponibilité : adresse prise');
select is(public.center_slug_available('ml-exemple', (select ws from ctx)), true, 'disponibilité : adresse libre');
select public.save_center_draft((select ws from ctx), 'ml-exemple',
  (select d from conf) || '{"paths":[{"id":"00000000-0000-0000-0000-0000000002f2","visible":true}]}');
select throws_ok($$ select public.publish_center((select ws from ctx)) $$, 'P0001', 'NO_VISIBLE_PATH',
  'publication refusée sans formation visible publiée (brouillon seul)');
select public.save_center_draft((select ws from ctx), 'ml-exemple', (select d from conf));
select lives_ok($$ select public.publish_center((select ws from ctx)) $$, 'publication par un admin');
select pg_temp.login('00000000-0000-0000-0000-0000000002a2');
select is((select count(*)::int from public.training_centers), 0, 'un éditeur ne lit pas les réglages du centre');
select throws_ok($$ select public.publish_center((select ws from ctx)) $$, '42501', null, 'un éditeur ne publie pas');
set local role anon;
select throws_ok($$ select count(*) from public.training_centers $$, '42501', null, 'anon ne lit aucune table du centre');
select throws_ok($$ select public.center_open('ml-exemple') $$, '42501', null, 'anon n''appelle pas center_open');
reset role;

-- ===== Contenu public (service_role) =====
select is(public.center_open('inconnu-xyz'), '{"status":"not_found"}'::jsonb, 'adresse inconnue : not_found');
select is(public.center_open('autre-centre'), '{"status":"not_found"}'::jsonb, 'centre non publié : même réponse');
create temp table r as select public.center_open('ml-exemple') as j;
select is((select j ->> 'status' from r), 'ok', 'centre publié en mode lien : ok');
select is((select jsonb_array_length(j -> 'paths') from r), 1,
  'seule la formation visible ayant un module publié sort (brouillon seul et masquée absentes)');
select ok((select j::text !~ '(Brouillon secret|Démo supprimée|Formation en préparation|Formation masquée|Étiquette brouillon)' from r),
  'aucun titre de brouillon, de démo supprimée ni de formation masquée');
select is((select jsonb_agg(m ->> 'access' order by m ->> 'title') from r, jsonb_array_elements(j -> 'paths' -> 0 -> 'modules') m),
  '["expired", "password", "open"]'::jsonb, 'modules : expiré et mot de passe signalés');
select ok((select (m ->> 'expiredAt') is not null from r, jsonb_array_elements(j -> 'paths' -> 0 -> 'modules') m
           where m ->> 'access' = 'expired'), 'module expiré : date d''expiration renvoyée');
select pg_temp.login('00000000-0000-0000-0000-0000000002a1');
select throws_ok($$ select public.save_center_draft((select ws from ctx), 'ml-exemple', '{"privacyUrl":"javascript:alert(1)"}') $$,
  'P0001', 'CENTER_INVALID', 'liens du pied de page en https uniquement');
reset role;
select is((select jsonb_agg(m -> 'cover') from r, jsonb_array_elements(j -> 'paths' -> 0 -> 'modules') m),
  '["assets/s1-abc.webp", null, null]'::jsonb, 'aucune couverture pour un module protégé ou expiré');
select is((select j -> 'paths' -> 0 -> 'tags' from r), '[{"name": "Logiciel", "color": "blue"}]'::jsonb,
  'étiquettes : union des modules publiés');
select ok((select (j -> 'paths' -> 0 ->> 'isNew')::boolean and j -> 'visitor' = 'null'::jsonb from r),
  'formation nouvelle ; sans jeton, aucun visiteur');
select is(public.center_open('ml-exemple', p_link_token => 'jeton-expire-01') -> 'visitor', 'null'::jsonb,
  'lien personnel expiré : aucun visiteur');
select ok((select v = '{"firstName":"Alex"}'::jsonb
           from (select public.center_open('ml-exemple', p_link_token => 'jeton-alex-0001', p_visitor => 'visitor-alex-01') -> 'visitor' as v) x),
  'lien personnel valide : prénom seul');
select is((select count(*)::int from public.learner_visitors where visitor_id = 'visitor-alex-01'), 1,
  'visiteur du centre rattaché à l''apprenant');

-- Liens publics désactivés : même réponse qu'un centre inconnu
update public.workspaces set public_links_enabled = false where id = (select ws from ctx);
select is(public.center_open('ml-exemple'), '{"status":"not_found"}'::jsonb, 'liens publics désactivés : même réponse');
update public.workspaces set public_links_enabled = true where id = (select ws from ctx);

-- ===== Mot de passe du centre =====
select pg_temp.login('00000000-0000-0000-0000-0000000002a1');
select public.set_center_password((select ws from ctx), 'mot-de-passe-centre');
reset role;
select ok((select j ->> 'status' = 'password_required' and j -> 'paths' is null
           from (select public.center_open('ml-exemple') as j) x)
      and (select j ->> 'status' = 'password_wrong'
           from (select public.center_open('ml-exemple', 'mauvais', null, repeat('c', 32)) as j) x)
      and (select j ->> 'status' = 'ok' and j ? 'grant' and j ? 'paths'
           from (select public.center_open('ml-exemple', 'mot-de-passe-centre', null, repeat('c', 32)) as j) x),
  'mot de passe : requis, refusé, puis accepté avec un jeton');

select * from finish();
rollback;
