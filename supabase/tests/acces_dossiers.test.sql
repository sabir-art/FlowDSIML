-- Tests pgTAP : L27-09 (accès par dossier). Non-fuite par table et par RPC, chemin rapide, lecteurs
-- publics inchangés, réglage réservé aux administrateurs (plan Enterprise).
begin;
set search_path = public, extensions;
select plan(40);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000080a1', 'admin-dossiers@example.com'),
  ('00000000-0000-0000-0000-0000000080a2', 'editrice-autorisee@example.com'),
  ('00000000-0000-0000-0000-0000000080a3', 'editeur-exclu@example.com'),
  ('00000000-0000-0000-0000-0000000080a4', 'lecteur-exclu@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000080a1');
create temp table ctx as select (public.create_workspace('Dossiers')).id as ws;
grant all on ctx to authenticated, service_role;
reset role;
update public.workspaces set plan_code = 'enterprise', public_links_enabled = true where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000080a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000080a3', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000080a4', 'viewer');
-- Dossier « RH » et son sous-dossier ; une démo dans chacun, une démo à la racine
insert into public.folders (id, workspace_id, name) values
  ('00000000-0000-0000-0000-0000000080f1', (select ws from ctx), 'RH');
insert into public.folders (id, workspace_id, parent_id, name) values
  ('00000000-0000-0000-0000-0000000080f2', (select ws from ctx), '00000000-0000-0000-0000-0000000080f1', 'Paie');
insert into public.demos (id, workspace_id, folder_id, title, status) values
  ('00000000-0000-0000-0000-0000000080d1', (select ws from ctx), '00000000-0000-0000-0000-0000000080f1', 'Entretiens', 'published'),
  ('00000000-0000-0000-0000-0000000080d2', (select ws from ctx), '00000000-0000-0000-0000-0000000080f2', 'Bulletins', 'draft'),
  ('00000000-0000-0000-0000-0000000080d3', (select ws from ctx), null, 'Accueil', 'published');
insert into public.demo_versions (id, demo_id, workspace_id, number, manifest) values
  ('00000000-0000-0000-0000-0000000080e1', '00000000-0000-0000-0000-0000000080d1', (select ws from ctx), 1, '{}'),
  ('00000000-0000-0000-0000-0000000080e3', '00000000-0000-0000-0000-0000000080d3', (select ws from ctx), 1, '{}');
update public.demos set current_version_id = '00000000-0000-0000-0000-0000000080e1' where id = '00000000-0000-0000-0000-0000000080d1';
update public.demos set current_version_id = '00000000-0000-0000-0000-0000000080e3' where id = '00000000-0000-0000-0000-0000000080d3';
-- Données liées à chaque démo
insert into public.steps (id, demo_id, workspace_id, position, image_path) values
  ('00000000-0000-0000-0000-0000000080b1', '00000000-0000-0000-0000-0000000080d1', (select ws from ctx), 0, 'x/1.webp'),
  ('00000000-0000-0000-0000-0000000080b2', '00000000-0000-0000-0000-0000000080d2', (select ws from ctx), 0, 'x/2.webp'),
  ('00000000-0000-0000-0000-0000000080b3', '00000000-0000-0000-0000-0000000080d3', (select ws from ctx), 0, 'x/3.webp');
insert into public.hotspots (demo_id, workspace_id, step_id, x, y, w, h)
  select demo_id, workspace_id, id, 0.1, 0.1, 0.1, 0.1 from public.steps where workspace_id = (select ws from ctx);
insert into public.share_links (demo_id, workspace_id, name)
  select id, workspace_id, 'Lien ' || title from public.demos where workspace_id = (select ws from ctx);
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type)
  select workspace_id, id, 'v-' || title, 's-' || title, 'demo_view' from public.demos where workspace_id = (select ws from ctx);
insert into public.leads (workspace_id, demo_id, email)
  select workspace_id, id, lower(title) || '@acme.example' from public.demos where workspace_id = (select ws from ctx);
insert into public.step_comments (workspace_id, demo_id, step_id, author_id, body)
  select workspace_id, demo_id, id, '00000000-0000-0000-0000-0000000080a1', 'Note fictive' from public.steps
   where workspace_id = (select ws from ctx);
insert into public.quiz_questions (workspace_id, demo_id, prompt)
  select workspace_id, id, 'Question ?' from public.demos where workspace_id = (select ws from ctx);
insert into public.notifications (workspace_id, user_id, kind, demo_id, step_id, comment_id)
  select c.workspace_id, '00000000-0000-0000-0000-0000000080a3', 'comment', c.demo_id, c.step_id, c.id
    from public.step_comments c where c.workspace_id = (select ws from ctx);

-- Fonction d'aide : nombre de lignes visibles par table (démos du dossier restreint)
create function pg_temp.hidden_rows() returns table (t text, n bigint) language plpgsql as $$
declare r record;
begin
  for r in select c.table_name from information_schema.columns c join information_schema.tables tb
             on tb.table_schema = c.table_schema and tb.table_name = c.table_name
            where c.table_schema = 'public' and c.column_name = 'demo_id' and tb.table_type = 'BASE TABLE' loop
    continue when not has_table_privilege('authenticated', format('public.%I', r.table_name), 'select');
    begin
      execute format('select count(*) from public.%I where demo_id in (%L, %L)', r.table_name,
                     '00000000-0000-0000-0000-0000000080d1', '00000000-0000-0000-0000-0000000080d2') into n;
      t := r.table_name;
      return next;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
grant execute on function pg_temp.hidden_rows() to authenticated;

-- ===== Chemin rapide : aucun dossier restreint =====
select pg_temp.login('00000000-0000-0000-0000-0000000080a3');
select is((select count(*)::int from public.demos where workspace_id = (select ws from ctx)), 3, 'sans restriction : 3 démos visibles');
select ok(public.folder_visible((select ws from ctx), '00000000-0000-0000-0000-0000000080f2'), 'chemin rapide : aucun dossier restreint');

-- ===== Réglage : admin, Enterprise =====
select throws_ok($$ select public.set_folder_access('00000000-0000-0000-0000-0000000080f1', true, '{}') $$,
  '42501', null, 'éditeur : pas de réglage d’accès');
select throws_ok($$ update public.folders set restricted = true where id = '00000000-0000-0000-0000-0000000080f1' $$,
  '42501', null, 'statut restreint : jamais écrit directement');
select pg_temp.login('00000000-0000-0000-0000-0000000080a1');
reset role;
update public.workspaces set plan_code = 'pro' where id = (select ws from ctx);
select pg_temp.login('00000000-0000-0000-0000-0000000080a1');
-- L48-A : plus aucune fonction réservée à une offre
select lives_ok($$ select public.set_folder_access('00000000-0000-0000-0000-0000000080f1', true, '{}') $$,
  'accès restreint permis pour toutes les offres (L48-A)');
reset role;
update public.workspaces set plan_code = 'enterprise' where id = (select ws from ctx);
select pg_temp.login('00000000-0000-0000-0000-0000000080a1');
select public.set_folder_access('00000000-0000-0000-0000-0000000080f1', true,
  array['00000000-0000-0000-0000-0000000080a2', '00000000-0000-0000-0000-0000000080a1']::uuid[]);
select is((select count(*)::int from public.folder_members where folder_id = '00000000-0000-0000-0000-0000000080f1'), 1,
  'membres choisis (les administrateurs n’y sont pas : accès toujours ouvert)');
select is(public.folder_hidden_count('00000000-0000-0000-0000-0000000080f1'), 2, 'dossier restreint : invisible pour 2 membres');
select is((select count(*)::int from public.demos where workspace_id = (select ws from ctx)), 3, 'admin : tout reste visible');

-- ===== Membre autorisé =====
select pg_temp.login('00000000-0000-0000-0000-0000000080a2');
select is((select count(*)::int from public.demos where workspace_id = (select ws from ctx)), 3, 'membre choisi : 3 démos');
select ok((select sum(n) from pg_temp.hidden_rows()) > 0, 'membre choisi : données des démos du dossier visibles');

-- ===== Membre sans accès : rien, nulle part =====
select pg_temp.login('00000000-0000-0000-0000-0000000080a3');
select is((select count(*)::int from public.demos where workspace_id = (select ws from ctx)), 1, 'liste : seule la démo hors dossier');
select is((select count(*)::int from public.folders where workspace_id = (select ws from ctx)), 0, 'dossier et sous-dossier masqués');
select is((select coalesce(string_agg(t, ', '), '') from pg_temp.hidden_rows() where n > 0), '',
  'aucune table liée à une démo ne laisse voir les démos du dossier');
update public.demos set title = 'Piraté' where id = '00000000-0000-0000-0000-0000000080d1';
reset role;
select is((select title from public.demos where id = '00000000-0000-0000-0000-0000000080d1'), 'Entretiens', 'modification impossible');
select pg_temp.login('00000000-0000-0000-0000-0000000080a3');
select is(public.demo_workspace('00000000-0000-0000-0000-0000000080d1'), null, 'demo_workspace : démo masquée');
-- Analytics
select is((public.workspace_kpis((select ws from ctx), now() - interval '1 day') ->> 'views')::int, 1, 'workspace_kpis : vues de la seule démo visible');
select is((public.workspace_kpis((select ws from ctx), now() - interval '1 day') ->> 'leads')::int, 1, 'workspace_kpis : leads filtrés');
select is((public.workspace_analytics((select ws from ctx), now() - interval '1 day') ->> 'views')::int, 1, 'workspace_analytics');
select is((select count(*)::int from public.workspace_overview((select ws from ctx), 30)), 1, 'workspace_overview');
select is((public.workspace_leads((select ws from ctx), now() - interval '1 day') ->> 'total')::int, 1, 'workspace_leads');
select is((public.workspace_sessions((select ws from ctx), now() - interval '1 day') ->> 'total')::int, 1, 'workspace_sessions');
select ok(position('Entretiens' in public.workspace_returning((select ws from ctx), now() - interval '1 day')::text) = 0,
  'workspace_returning : aucune démo masquée');
select throws_ok($$ select public.demo_analytics('00000000-0000-0000-0000-0000000080d1', now() - interval '1 day') $$,
  '42501', null, 'demo_analytics : refusé');
select throws_ok($$ select public.live_demo('00000000-0000-0000-0000-0000000080d1') $$, null, null, 'temps réel (live_demo) : refusé');
select throws_ok($$ select public.live_visits('00000000-0000-0000-0000-0000000080d1') $$, null, null, 'temps réel (live_visits) : refusé');
select throws_ok($$ select public.quiz_stats('00000000-0000-0000-0000-0000000080d1') $$, null, null, 'quiz_stats : refusé');
select throws_ok($$ select public.survey_results('00000000-0000-0000-0000-0000000080d1', now() - interval '1 day') $$, null, null, 'survey_results : refusé');
select throws_ok($$ select public.choice_results('00000000-0000-0000-0000-0000000080d1', now() - interval '1 day') $$, null, null, 'choice_results : refusé');
select throws_ok($$ select public.demo_embed_views('00000000-0000-0000-0000-0000000080d1') $$, null, null, 'demo_embed_views : refusé');
-- Actions
select throws_ok($$ select public.duplicate_demo('00000000-0000-0000-0000-0000000080d1') $$, null, null, 'duplicate_demo : refusé');
select throws_ok($$ select public.publish_demo('00000000-0000-0000-0000-0000000080d2', '{"reviewed": true, "fictional": true}') $$,
  null, null, 'publish_demo : refusé');
select throws_ok($$ select public.record_diffusion('00000000-0000-0000-0000-0000000080d1', 'intranet', 'Intranet') $$, null, null, 'record_diffusion : refusé');
select throws_ok($$ select public.set_demo_access('00000000-0000-0000-0000-0000000080d1', 'link', false, null) $$,
  '42501', null, 'set_demo_access : refusé');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000080a3'), 1,
  'notifications : seulement la démo visible');
-- Lecteur sans accès
select pg_temp.login('00000000-0000-0000-0000-0000000080a4');
select is((select count(*)::int from public.demos where workspace_id = (select ws from ctx)), 1, 'lecteur : seule la démo hors dossier');
select is((select coalesce(string_agg(t, ', '), '') from pg_temp.hidden_rows() where n > 0), '', 'lecteur : aucune fuite');

-- ===== Lecteurs publics inchangés (les liens partagés restent valables) =====
reset role;
set local role service_role;
select is(public.demo_gate('00000000-0000-0000-0000-0000000080d1') ->> 'status', 'ok', 'open-demo : la démo du dossier reste accessible');
reset role;
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{}', true);
select ok(public.folder_visible((select ws from ctx), '00000000-0000-0000-0000-0000000080f1'), 'sans utilisateur : visible');

-- Ouvrir à tout l'espace
select pg_temp.login('00000000-0000-0000-0000-0000000080a1');
select public.set_folder_access('00000000-0000-0000-0000-0000000080f1', false);
select pg_temp.login('00000000-0000-0000-0000-0000000080a3');
select is((select count(*)::int from public.demos where workspace_id = (select ws from ctx)), 3, '« Tout l’espace » : tout redevient visible');
select is((select count(*)::int from public.folder_members), 0, 'membres choisis effacés');

select * from finish();
rollback;
