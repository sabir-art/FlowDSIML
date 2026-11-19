-- Tests pgTAP : L25 étape 3, opérations style et chart, jeu de données d'une démo (RLS, tailles,
-- refus des données personnelles, publication). Données fictives.
begin;
set search_path = public, extensions;
select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000027a1', 'editrice-donnees@example.com'),
  ('00000000-0000-0000-0000-0000000027a2', 'lecteur-donnees@example.com'),
  ('00000000-0000-0000-0000-0000000027a3', 'autre-donnees@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000027a1');
create temp table ctx as select (public.create_workspace('Données')).id as ws;
grant all on ctx to authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000027d1', (select ws from ctx), 'Tableau de bord', auth.uid());
insert into public.steps (id, demo_id, workspace_id, position, kind, title)
  values ('00000000-0000-0000-0000-0000000027e1', '00000000-0000-0000-0000-0000000027d1', (select ws from ctx), 0, 'text', 'Accueil');
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000027a2', 'viewer');

-- ===== Opérations style et chart =====
select ok(public.html_ops_ok('[{"id":"s1","sel":"b.value","sels":["b.value","td b"],"op":"style","value":{"color":"#1E6A95","fontSize":24,"fontWeight":"700"},"scope":"step"}]'),
  'style : plusieurs éléments, propriétés en liste blanche');
select ok(not public.html_ops_ok('[{"id":"s1","sel":"b","op":"style","value":{"position":"fixed"},"scope":"step"}]'),
  'style : propriété hors liste refusée');
select ok(not public.html_ops_ok('[{"id":"s1","sel":"b","op":"style","value":{"color":"red; background:url(x)"},"scope":"step"}]'),
  'style : couleur non hexadécimale refusée');
select ok(not public.html_ops_ok('[{"id":"s1","sel":"b","sels":["b"],"op":"text","value":"x","scope":"step"}]'),
  'sels réservé au style');
select ok(public.html_ops_ok('[{"id":"c1","sel":"svg.chart","op":"chart","value":{"type":"bar","rows":[{"label":"Jan","value":12},{"label":"Fév","value":18}]},"scope":"step"}]'),
  'graphique : type et valeurs');
select ok(not public.html_ops_ok('[{"id":"c1","sel":"svg","op":"chart","value":{"type":"bar","rows":[{"label":"Jan","value":"douze"}]},"scope":"step"}]'),
  'graphique : valeur non numérique refusée');

-- ===== Jeu de données =====
select pg_temp.login('00000000-0000-0000-0000-0000000027a1');
select lives_ok($$
  insert into public.demo_datasets (demo_id, workspace_id, name, columns, rows, bindings, row_mode, link_column)
  values ('00000000-0000-0000-0000-0000000027d1', (select ws from ctx), 'equipes-acme.csv',
          '["equipe","rapports","vues"]', '[["Antenne Nord","1 248","86"],["Antenne Sud","932","64"]]',
          '[{"column":"rapports","kind":"element","stepId":"00000000-0000-0000-0000-0000000027e1","sel":"b.value"},
            {"column":"equipe","kind":"variable","key":"team"}]', 'link', 'equipe') $$,
  'éditrice : jeu de données créé');
select throws_ok($$ update public.demo_datasets set rows = '[["Antenne Nord","lea.martin@acme.example","1"]]' $$,
  '23514', null, 'cellule « e-mail » refusée');
select throws_ok($$ update public.demo_datasets set rows = '[["Antenne Nord","06 12 34 56 78","1"]]' $$,
  '23514', null, 'cellule « téléphone » refusée');
select throws_ok($$ update public.demo_datasets set rows = (select jsonb_agg(jsonb_build_array('a', 'b', 'c')) from generate_series(1, 1001)) $$,
  '23514', null, 'plus de 1 000 lignes refusées');
select throws_ok($$ update public.demo_datasets set rows = '[["un","deux"]]' $$,
  '23514', null, 'ligne sans le bon nombre de colonnes refusée');
select throws_ok($$ update public.demo_datasets set link_column = 'inconnue' $$,
  '23514', null, 'colonne de liaison inconnue refusée');
select throws_ok($$ insert into public.demo_datasets (demo_id, workspace_id, name, columns)
  values ('00000000-0000-0000-0000-0000000027d1', (select ws from ctx), 'doublon.csv', '["a"]') $$,
  '23505', null, 'un seul jeu de données par démo');

-- Lecteur : lit, n'écrit pas ; autre utilisateur : ne voit rien
select pg_temp.login('00000000-0000-0000-0000-0000000027a2');
select is((select count(*)::int from public.demo_datasets), 1, 'lecteur : lit le jeu de données');
select pg_temp.login('00000000-0000-0000-0000-0000000027a3');
select is((select count(*)::int from public.demo_datasets), 0, 'hors workspace : rien');

-- Publication : manifeste.dataset
select pg_temp.login('00000000-0000-0000-0000-0000000027a1');
create temp table pub as select public.publish_demo('00000000-0000-0000-0000-0000000027d1',
  '{"reviewed": true, "fictional": true}') as r;
select is((select r -> 'manifest' -> 'dataset' ->> 'linkColumn' from pub), 'equipe', 'publication : jeu de données dans le manifeste');
select is((select r -> 'manifest' -> 'dataset' -> 'columns' from pub), '["equipe","rapports"]'::jsonb,
  'publication : colonnes liées seulement (« vues » non publiée)');
select is((select r -> 'manifest' -> 'dataset' -> 'rows' -> 0 from pub), '["Antenne Nord","1 248"]'::jsonb,
  'publication : lignes réduites aux colonnes liées');
select is((select public_ack -> 'dataset' from public.demo_versions where demo_id = '00000000-0000-0000-0000-0000000027d1'),
  '{"rows": 2, "columns": 2}'::jsonb, 'bilan RGPD : jeu de données compté');

select * from finish();
rollback;
