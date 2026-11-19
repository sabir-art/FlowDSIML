-- Tests pgTAP : L17 (étape Avant / Après, glossaire du workspace).
begin;
set search_path = public, extensions;
select plan(29);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000007a1', 'olga-gl@example.com'),
  ('00000000-0000-0000-0000-0000000007a2', 'eddie-gl@example.com'),
  ('00000000-0000-0000-0000-0000000007a3', 'vera-gl@example.com'),
  ('00000000-0000-0000-0000-0000000007a4', 'autre-gl@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Olga (owner), Eddie (éditeur), Vera (lectrice) ; « autre » est owner d'un autre workspace
select pg_temp.login('00000000-0000-0000-0000-0000000007a1');
create temp table ctx as select (public.create_workspace('Formation plus')).id as ws;
grant all on ctx to authenticated;
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000007a4');
create temp table ctx2 as select (public.create_workspace('Autre glossaire')).id as ws;
grant all on ctx2 to authenticated;
select pg_temp.logout();
update public.workspaces set plan_code = 'pro', public_links_enabled = true where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000007a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000007a3', 'viewer');
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-0000000007d1', (select ws from ctx), 'Nouvel outil', '00000000-0000-0000-0000-0000000007a1');
insert into public.steps (id, demo_id, workspace_id, position, title, body, image_path, image_width, image_height) values
  ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007d1', (select ws from ctx), 0,
   'Accueil', 'Le tableau de bord se met à jour.', (select ws from ctx)::text || '/d/e1.png', 1100, 750);

-- ===== Avant / Après : chemins, forme =====
select throws_ok(format($$ update public.steps set before_image_path = '%s/d/x.png'
  where id = '00000000-0000-0000-0000-0000000007e1' $$, (select ws from ctx2)),
  '23514', null, 'capture « Avant » d''un autre workspace refusée');
select throws_ok(format($$ update public.steps set image_path = '%s/d/x.png'
  where id = '00000000-0000-0000-0000-0000000007e1' $$, (select ws from ctx2)),
  '23514', null, 'image_path : même contrôle de chemin');
select throws_ok($$ update public.steps set options = '{"beforeAfter": {"layout": "grille"}}'
  where id = '00000000-0000-0000-0000-0000000007e1' $$, '23514', null, 'disposition inconnue refusée');
select throws_ok(format($$ update public.steps set options = jsonb_build_object('beforeAfter',
  jsonb_build_object('notes', jsonb_build_object('before', '%s'))) where id = '00000000-0000-0000-0000-0000000007e1' $$,
  repeat('x', 141)), '23514', null, 'note de plus de 140 caractères refusée');

insert into public.steps (id, demo_id, workspace_id, position, kind, title, image_path, image_width, image_height, blurs, options) values
  ('00000000-0000-0000-0000-0000000007e2', '00000000-0000-0000-0000-0000000007d1', (select ws from ctx), 1, 'before_after',
   'Avant / Après', (select ws from ctx)::text || '/d/e2.png', 1100, 750, '[]',
   '{"beforeAfter": {"layout": "slider", "labels": {"before": "", "after": "Nouvel outil"},
     "notes": {"before": "Rapports, puis Exporter.", "after": "Bouton « Nouveau rapport »."},
     "sources": {"before": {"kind": "upload", "name": "ancien-ecran.png"}}}}');

select pg_temp.login('00000000-0000-0000-0000-0000000007a2');
select throws_ok($$ select public.publish_demo('00000000-0000-0000-0000-0000000007d1', '{"reviewed": true, "fictional": true}') $$,
  'P0001', 'BEFORE_AFTER_INCOMPLETE:2', 'publication bloquée sans capture « Avant » (étape 2)');
select pg_temp.logout();
update public.steps set before_image_path = (select ws from ctx)::text || '/d/e2-before.png',
  before_image_width = 800, before_image_height = 500,
  before_blurs = '[{"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.1, "style": "blur"}]'
  where id = '00000000-0000-0000-0000-0000000007e2';

-- ===== Glossaire : droits, unicité, limite =====
select pg_temp.login('00000000-0000-0000-0000-0000000007a2');
insert into public.glossary_terms (workspace_id, term, old_term, definition, forms) values
  ((select ws from ctx), 'Tableau de bord', 'synthèse mensuelle', 'Page d''accueil des indicateurs.', '{TDB}'),
  ((select ws from ctx), 'Dossier usager', 'fiche bénéficiaire', 'Toutes les informations d''une personne.', '{}');
select is((select created_by from public.glossary_terms where term = 'Tableau de bord'),
  '00000000-0000-0000-0000-0000000007a2'::uuid, 'éditeur : terme ajouté (auteur enregistré)');
select throws_ok(format($$ insert into public.glossary_terms (workspace_id, term, definition)
  values ('%s', 'TABLEAU DE BÓRD', 'Doublon.') $$, (select ws from ctx)),
  '23505', null, 'terme unique, sans casse ni accents');
select throws_ok(format($$ insert into public.glossary_terms (workspace_id, term, definition)
  values ('%s', 'Long', '%s') $$, (select ws from ctx), repeat('x', 141)),
  '23514', null, 'définition de plus de 140 caractères refusée');
select throws_ok(format($$ insert into public.glossary_terms (workspace_id, term, definition, forms)
  values ('%s', 'Formes', 'Trop de formes.', '%s') $$, (select ws from ctx),
  (select array_agg('f' || g)::text from generate_series(1, 11) g)),
  '23514', null, 'plus de 10 autres formes refusées');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000007a3');
select is((select count(*)::int from public.glossary_terms), 2, 'lectrice : lit le glossaire');
select throws_ok(format($$ insert into public.glossary_terms (workspace_id, term, definition)
  values ('%s', 'Rendez-vous', 'Rencontre.') $$, (select ws from ctx)),
  '42501', null, 'lectrice : ajout refusé');
update public.glossary_terms set definition = 'Modifié.';
select is((select count(*)::int from public.glossary_terms where definition = 'Modifié.'), 0,
  'lectrice : modification sans effet (RLS)');
select throws_ok($$ select public.glossary_set_underline((select ws from ctx), false) $$,
  '42501', null, 'lectrice : réglage refusé');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000007a4');
select is((select count(*)::int from public.glossary_terms), 0, 'autre workspace : glossaire invisible');
select throws_ok($$ select public.glossary_usage((select ws from ctx)) $$, '42501', null,
  'autre workspace : usage refusé');
select throws_ok($$ select public.glossary_import((select ws from ctx), '[]') $$, '42501', null,
  'autre workspace : import refusé');
select pg_temp.logout();

-- Limite de 500 termes
insert into public.glossary_terms (workspace_id, term, definition)
  select (select ws from ctx2), 'terme ' || g, 'déf' from generate_series(1, 500) g;
select throws_ok(format($$ insert into public.glossary_terms (workspace_id, term, definition)
  values ('%s', 'un de trop', 'déf') $$, (select ws from ctx2)), 'P0001', 'GLOSSARY_LIMIT', '500 termes au plus');
delete from public.glossary_terms where workspace_id = (select ws from ctx2);

-- ===== Import =====
select pg_temp.login('00000000-0000-0000-0000-0000000007a2');
select is(public.glossary_import((select ws from ctx), ('[
    {"term": "dossier USAGER", "old_term": "fiche", "definition": "Mis à jour.", "forms": []},
    {"term": "Rendez-vous", "definition": "Rencontre prévue.", "forms": ["RDV"]},
    {"term": "", "definition": "Sans terme."},
    {"term": "Long", "definition": "' || repeat('x', 141) || '"},
    {"term": "rendez-vous", "definition": "Doublon dans le fichier."}
  ]')::jsonb),
  '{"added": 1, "updated": 1, "skipped": 3, "errors": [{"line": 3, "code": "term"},
    {"line": 4, "code": "definition"}, {"line": 5, "code": "duplicate"}]}'::jsonb,
  'import : ajout, mise à jour (jamais de doublon), lignes en erreur');
select is((select count(*)::int from public.glossary_terms where workspace_id = (select ws from ctx)), 3,
  'import : 3 termes en tout');
select throws_ok(format($$ select public.glossary_import('%s',
  (select jsonb_agg(jsonb_build_object('term', 't' || g, 'definition', 'd')) from generate_series(1, 501) g)) $$,
  (select ws from ctx)), 'P0001', 'GLOSSARY_IMPORT_TOO_BIG', 'import : plus de 500 lignes refusé');
select throws_ok(format($$ select public.glossary_import('%s',
  jsonb_build_array(jsonb_build_object('term', 'x', 'definition', repeat('y', 300000)))) $$,
  (select ws from ctx)), 'P0001', 'GLOSSARY_IMPORT_TOO_BIG', 'import : plus de 256 Ko refusé');

-- ===== Réglage et usage =====
select pg_temp.logout();
update public.workspaces set settings = '{"privacyUrl": "https://acme.example/rgpd"}' where id = (select ws from ctx);
select pg_temp.login('00000000-0000-0000-0000-0000000007a2');
select public.glossary_set_underline((select ws from ctx), false);
select pg_temp.logout();
select is((select settings from public.workspaces where id = (select ws from ctx)),
  '{"privacyUrl": "https://acme.example/rgpd", "glossary": {"underline": false}}'::jsonb,
  'réglage : seule la clé glossary.underline change');

-- ===== Publication =====
select pg_temp.login('00000000-0000-0000-0000-0000000007a2');
create temp table pub1 as select public.publish_demo('00000000-0000-0000-0000-0000000007d1',
  '{"reviewed": true, "fictional": true}') as r;
select is((select r -> 'manifest' -> 'glossary' from pub1), 'null'::jsonb, 'soulignement désactivé : glossary null');
select public.glossary_set_underline((select ws from ctx), true);
create temp table pub2 as select public.publish_demo('00000000-0000-0000-0000-0000000007d1',
  '{"reviewed": true, "fictional": true}') as r;
select is((select jsonb_agg(g ->> 'term') from pub2, jsonb_array_elements(r -> 'manifest' -> 'glossary') g),
  '["Tableau de bord"]'::jsonb, 'manifeste : seuls les termes présents dans la démo');
select ok((select (r -> 'manifest' -> 'steps' -> 1 -> 'beforeAfter') @> jsonb_build_object(
    'layout', 'slider', 'labels', jsonb_build_object('after', 'Nouvel outil'),
    'before', jsonb_build_object('width', 800, 'height', 500)) from pub2)
  and (select jsonb_array_length(r -> 'manifest' -> 'steps' -> 1 -> 'beforeAfter' -> 'beforeBlurs') = 1 from pub2),
  'manifeste : beforeAfter (disposition, libellés, capture, flous)');
select ok((select position('ancien-ecran.png' in (r -> 'manifest')::text) = 0 from pub2),
  'manifeste : nom du fichier importé jamais publié');
select ok((select exists (select 1 from jsonb_array_elements(r -> 'copies') c
                          where c ->> 'from' like '%/d/e2-before.png') from pub2),
  'publication : capture « Avant » copiée');
select is((select (public_ack ->> 'blurred')::int from public.demo_versions
           where id = (select (r ->> 'versionId')::uuid from pub2)), 1,
  'bilan RGPD : flous de la capture « Avant » comptés');
select pg_temp.logout();
update public.demos set status = 'published' where id = '00000000-0000-0000-0000-0000000007d1';
select pg_temp.login('00000000-0000-0000-0000-0000000007a3');
select is((select jsonb_object_agg(g.term, (u ->> 'modules')::int)
           from jsonb_array_elements(public.glossary_usage((select ws from ctx))) u
           join public.glossary_terms g on g.id = (u ->> 'id')::uuid),
  '{"Tableau de bord": 1, "dossier USAGER": 0, "Rendez-vous": 0}'::jsonb, 'usage (lectrice) : modules publiés qui contiennent le terme');
select pg_temp.logout();

select * from finish();
rollback;
