-- Tests pgTAP : L32 (lectures de démarrage regroupées). dashboard_home et editor_load renvoient les mêmes
-- données que les lectures directes (politiques), excluent les dossiers restreints et refusent un non-membre.
begin;
set search_path = public, extensions;
select plan(21);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000090a1', 'admin-groupe@example.com'),
  ('00000000-0000-0000-0000-0000000090a2', 'editeur-exclu-groupe@example.com'),
  ('00000000-0000-0000-0000-0000000090a3', 'externe-groupe@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000090a1');
create temp table ctx as select (public.create_workspace('Groupe')).id as ws;
grant all on ctx to authenticated, service_role;
reset role;
update public.workspaces set plan_code = 'enterprise' where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000090a2', 'editor');
insert into public.folders (id, workspace_id, name) values
  ('00000000-0000-0000-0000-0000000090f1', (select ws from ctx), 'Confidentiel');
insert into public.demos (id, workspace_id, folder_id, title, status, updated_at) values
  ('00000000-0000-0000-0000-0000000090d1', (select ws from ctx), '00000000-0000-0000-0000-0000000090f1', 'Paie', 'published', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000090d2', (select ws from ctx), null, 'Accueil', 'published', now()),
  ('00000000-0000-0000-0000-0000000090d3', (select ws from ctx), null, 'Brouillon', 'draft', now() - interval '2 hours');
insert into public.demos (id, workspace_id, title, deleted_at) values
  ('00000000-0000-0000-0000-0000000090d9', (select ws from ctx), 'Corbeille', now());
insert into public.demo_versions (id, demo_id, workspace_id, number, manifest, published_at) values
  ('00000000-0000-0000-0000-0000000090e2', '00000000-0000-0000-0000-0000000090d2', (select ws from ctx), 1, '{}', '2026-11-01T10:00:00Z');
update public.demos set current_version_id = '00000000-0000-0000-0000-0000000090e2' where id = '00000000-0000-0000-0000-0000000090d2';
insert into public.steps (id, demo_id, workspace_id, position, image_path) values
  ('00000000-0000-0000-0000-0000000090b1', '00000000-0000-0000-0000-0000000090d1', (select ws from ctx), 0, 'x/paie.webp'),
  ('00000000-0000-0000-0000-0000000090b2', '00000000-0000-0000-0000-0000000090d2', (select ws from ctx), 0, null),
  ('00000000-0000-0000-0000-0000000090b3', '00000000-0000-0000-0000-0000000090d2', (select ws from ctx), 1, 'x/accueil-2.webp'),
  ('00000000-0000-0000-0000-0000000090b4', '00000000-0000-0000-0000-0000000090d2', (select ws from ctx), 2, 'x/accueil-3.webp');
insert into public.hotspots (demo_id, workspace_id, step_id, x, y, w, h, position) values
  ('00000000-0000-0000-0000-0000000090d2', (select ws from ctx), '00000000-0000-0000-0000-0000000090b3', 0.1, 0.1, 0.1, 0.1, 1),
  ('00000000-0000-0000-0000-0000000090d2', (select ws from ctx), '00000000-0000-0000-0000-0000000090b2', 0.1, 0.1, 0.1, 0.1, 0);
insert into public.variables (workspace_id, key, label, default_value) values
  ((select ws from ctx), 'zone', 'Zone', 'Nord'), ((select ws from ctx), 'company', 'Entreprise', 'votre entreprise');
insert into public.quiz_questions (workspace_id, demo_id, prompt) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000090d2', 'Question ?');

-- ===== Administrateur, avant restriction : même contenu que les lectures directes =====
select pg_temp.login('00000000-0000-0000-0000-0000000090a1');
create temp table h1 as select public.dashboard_home((select ws from ctx)) as j;
select is(jsonb_array_length((select j -> 'demos' from h1)), 3, 'tableau de bord : 3 démos (corbeille exclue)');
select is((select j -> 'demos' -> 0 ->> 'title' from h1), 'Accueil', 'démos triées par dernière modification');
select is(jsonb_array_length((select j -> 'demos' from h1)),
          (select count(*)::int from public.demos where workspace_id = (select ws from ctx) and deleted_at is null),
          'même nombre de démos que la lecture directe');
select is((select (j -> 'stepCounts' ->> '00000000-0000-0000-0000-0000000090d2')::int from h1), 3, 'nombre d’étapes par démo');
select is((select j -> 'covers' ->> '00000000-0000-0000-0000-0000000090d2' from h1), 'x/accueil-2.webp',
          'couverture : première étape avec une image');
select ok((select j -> 'publishedAt' ? '00000000-0000-0000-0000-0000000090d2' from h1), 'date de publication de la version en ligne');
select ok((select (j ->> 'shareRulesPlan')::boolean from h1), 'plan Enterprise : règles de partage disponibles');
select is((select (j ->> 'memberCount')::int from h1), 2, 'nombre de membres');
select ok((select j -> 'kpis' -> 'cur' ? 'views' and j -> 'kpis' -> 'prev' ? 'views' from h1), 'indicateurs des deux périodes');
select ok((select j -> 'onboarding' -> 'steps' ? 'publish' from h1), 'état de la prise en main (squelettes L32)');

create temp table e1 as select public.editor_load('00000000-0000-0000-0000-0000000090d2') as j;
select is((select j -> 'demo' ->> 'title' from e1), 'Accueil', 'éditeur : la démo');
select is((select jsonb_array_length(j -> 'steps') from e1), 3, 'éditeur : étapes');
select is((select j -> 'hotspots' -> 0 ->> 'step_id' from e1), '00000000-0000-0000-0000-0000000090b2', 'éditeur : bulles triées par position');
select is((select j -> 'variables' -> 0 ->> 'key' from e1), 'company', 'éditeur : variables de l’espace, triées par clé');
select is((select jsonb_array_length(j -> 'questions') from e1), 1, 'éditeur : questions du quiz');

-- ===== Dossier restreint : l'éditeur exclu ne voit ni la démo ni ses données =====
select public.set_folder_access('00000000-0000-0000-0000-0000000090f1', true, '{}');
select pg_temp.login('00000000-0000-0000-0000-0000000090a2');
create temp table h2 as select public.dashboard_home((select ws from ctx)) as j;
select is(jsonb_array_length((select j -> 'demos' from h2)), 2, 'membre exclu : démo du dossier restreint absente');
select ok(not (select j -> 'stepCounts' ? '00000000-0000-0000-0000-0000000090d1' or j -> 'covers' ? '00000000-0000-0000-0000-0000000090d1' from h2),
          'membre exclu : ni étapes ni couverture de la démo cachée');
select is(jsonb_array_length((select j -> 'folders' from h2)), 0, 'membre exclu : dossier restreint absent');
select is(public.editor_load('00000000-0000-0000-0000-0000000090d1'), null, 'membre exclu : éditeur de la démo cachée = null');

-- ===== Non-membre : refusé =====
select pg_temp.login('00000000-0000-0000-0000-0000000090a3');
select throws_ok(format('select public.dashboard_home(%L)', (select ws from ctx)), '42501', null, 'non-membre : tableau de bord refusé');
select is(public.editor_load('00000000-0000-0000-0000-0000000090d2'), null, 'non-membre : éditeur = null');

select * from finish();
rollback;
