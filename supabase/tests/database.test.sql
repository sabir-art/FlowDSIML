-- Tests pgTAP : RLS, rôles, limites de plan, publication, accès public.
-- Exécution : `supabase test db` (Docker) ou supabase/tests/local/run.sh (Postgres nu).
begin;
set search_path = public, extensions;
select plan(44);

-- Utilisateurs de test
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com');

create function pg_temp.login(uid uuid, email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select is((select count(*)::int from public.profiles), 3, 'un profil est créé pour chaque utilisateur');

-- ===== Alice crée un workspace =====
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'alice@example.com');
create temp table ctx as select (public.create_workspace('Acme Démo')).id as ws;
grant all on ctx to authenticated;
select is((select slug from public.workspaces where id = (select ws from ctx)), 'acme-demo', 'slug généré');
select is(public.my_role((select ws from ctx)), 'owner'::public.workspace_role, 'alice est owner');

insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000000d1', (select ws from ctx), 'Démo CRM', auth.uid());
insert into public.steps (id, demo_id, workspace_id, position, image_path, image_width, image_height, title)
  values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', (select ws from ctx), 0, 'x/d1/1.webp', 1440, 900, 'Étape 1'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d1', (select ws from ctx), 1, 'x/d1/2.webp', 1440, 900, 'Étape 2');
insert into public.hotspots (step_id, x, y, title, action)
  values ('00000000-0000-0000-0000-0000000000a1', 0.5, 0.5, 'Cliquez ici', '{"type":"goto","stepId":"00000000-0000-0000-0000-0000000000a2"}');
select is((select workspace_id from public.hotspots limit 1), (select ws from ctx), 'workspace_id du hotspot hérité de l''étape');

select throws_ok($$ update public.workspaces set plan_code = 'enterprise' $$, '42501', null, 'le plan ne se change pas côté client');
select throws_ok($$ update public.demos set status = 'published' $$, '42501', null, 'le statut ne se change pas côté client');

-- ===== Bob n'a accès à rien =====
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'bob@example.com');
select is((select count(*)::int from public.workspaces), 0, 'bob ne voit pas le workspace d''alice');
select is((select count(*)::int from public.demos), 0, 'bob ne voit pas les démos d''alice');
select throws_ok(
  $$ insert into public.demos (workspace_id, title) values ((select ws from ctx), 'intrus') $$,
  '42501', null, 'bob ne peut pas créer de démo chez alice');
select throws_ok(
  $$ insert into public.members (workspace_id, user_id, role) values ((select ws from ctx), auth.uid(), 'owner') $$,
  '42501', null, 'bob ne peut pas s''ajouter lui-même');
select throws_ok($$ select public.publish_demo('00000000-0000-0000-0000-0000000000d1') $$, '42501', null, 'bob ne peut pas publier');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('captures', (select ws from ctx)::text || '/d1/evil.webp') $$,
  '42501', null, 'bob ne peut pas téléverser dans les captures d''alice');

-- ===== Invitations =====
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'alice@example.com');
insert into public.invitations (workspace_id, email, role, invited_by, token) values
  ((select ws from ctx), 'bob@example.com', 'editor', auth.uid(), '11111111-1111-1111-1111-111111111111'),
  ((select ws from ctx), 'carol@example.com', 'viewer', auth.uid(), '22222222-2222-2222-2222-222222222222');

select pg_temp.login('00000000-0000-0000-0000-00000000000c', 'carol@example.com');
select throws_ok($$ select public.accept_invitation('11111111-1111-1111-1111-111111111111') $$,
  'P0001', 'INVITATION_EMAIL_MISMATCH', 'une invitation ne s''accepte qu''avec le bon email');

select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'bob@example.com');
select is(public.accept_invitation('11111111-1111-1111-1111-111111111111'), (select ws from ctx), 'bob accepte son invitation');
select is((select count(*)::int from public.demos), 1, 'bob (editor) voit la démo');
select lives_ok($$ update public.demos set title = 'Démo CRM v2' where id = '00000000-0000-0000-0000-0000000000d1' $$, 'bob (editor) peut éditer');
update public.members set role = 'admin' where user_id = auth.uid();
select is(public.my_role((select ws from ctx)), 'editor'::public.workspace_role, 'un editor ne peut pas se promouvoir');
select is((select count(*)::int from public.leads), 0, 'editor : lecture des leads autorisée (vide)');

-- Carol : limite de 2 membres sur le plan Free
select pg_temp.login('00000000-0000-0000-0000-00000000000c', 'carol@example.com');
select throws_ok($$ select public.accept_invitation('22222222-2222-2222-2222-222222222222') $$,
  'P0001', 'PLAN_LIMIT:members', 'limite de membres du plan Free');

select pg_temp.logout();
update public.workspaces set plan_code = 'pro' where id = (select ws from ctx);
select pg_temp.login('00000000-0000-0000-0000-00000000000c', 'carol@example.com');
select lives_ok($$ select public.accept_invitation('22222222-2222-2222-2222-222222222222') $$, 'carol accepte après passage en Pro');
select is((select count(*)::int from public.demos), 1, 'carol (viewer) voit la démo');
update public.demos set title = 'hack' where id = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'alice@example.com');
select is((select title from public.demos where id = '00000000-0000-0000-0000-0000000000d1'), 'Démo CRM v2', 'un viewer ne modifie rien');

-- ===== Garde-fous owner =====
select throws_ok($$ delete from public.members where user_id = auth.uid() $$, 'P0001', 'Le workspace doit garder au moins un owner', 'le dernier owner ne peut pas partir');

-- ===== Publication =====
update public.demos set settings = '{"cta":{"label":"Réserver","url":"https://example.com/rdv"}}' where id = '00000000-0000-0000-0000-0000000000d1';
update public.workspaces set settings = settings || '{"privacyUrl":"https://example.com/confidentialite"}'
  where id = (select workspace_id from public.demos where id = '00000000-0000-0000-0000-0000000000d1');
update public.workspaces set public_links_enabled = true; -- F1 : liens publics activés pour les tests de publication
create temp table pub as select public.publish_demo('00000000-0000-0000-0000-0000000000d1', '{"reviewed": true, "fictional": true}') as r;
grant all on pub to authenticated, anon;
select is((select (r ->> 'number')::int from pub), 1, 'version 1 créée');
select is((select jsonb_array_length(r -> 'manifest' -> 'steps') from pub), 2, 'le manifeste contient 2 étapes');
select is((select jsonb_array_length(r -> 'copies') from pub), 2, '2 images à copier');
select is((select r -> 'manifest' -> 'steps' -> 0 -> 'hotspots' -> 0 ->> 'title' from pub), 'Cliquez ici', 'hotspot dans le manifeste');
select is((select r -> 'manifest' -> 'cta' ->> 'label' from pub), 'Réserver', 'CTA client dans le manifeste (P6)');
select is((select r -> 'manifest' ->> 'privacyUrl' from pub), 'https://example.com/confidentialite', 'lien de confidentialité du workspace dans le manifeste (P13)');
select is((select r -> 'manifest' ->> 'workspaceName' from pub), (select name from public.workspaces where id = (select workspace_id from public.demos where id = '00000000-0000-0000-0000-0000000000d1')), 'nom du workspace dans le manifeste (PLY-01)');
select is((select status from public.demos where id = '00000000-0000-0000-0000-0000000000d1'), 'draft'::public.demo_status, 'pas en ligne avant finalisation');
select lives_ok($$ select public.finalize_publication((select (r ->> 'versionId')::uuid from pub)) $$, 'finalisation');
select is((select status from public.demos where id = '00000000-0000-0000-0000-0000000000d1'), 'published'::public.demo_status, 'démo publiée');

insert into public.share_links (demo_id, token, variables) values ('00000000-0000-0000-0000-0000000000d1', 'tok123', '{"company":"Globex"}');

-- ===== Accès anonyme (player) =====
select pg_temp.logout();
set local role anon;
select throws_ok($$ select count(*) from public.demos $$, '42501', null, 'anon ne lit pas les tables');
select is((select public.resolve_share_link('tok123') -> 'variables' ->> 'company'), 'Globex', 'anon résout un lien de partage');
select is(public.track_events(jsonb_build_object(
  'demoId', '00000000-0000-0000-0000-0000000000d1', 'versionId', (select (r ->> 'versionId') from pub),
  'visitorId', 'visitor-0001', 'sessionId', 'session-0001', 'linkToken', 'tok123',
  'events', jsonb_build_array(
    jsonb_build_object('type', 'demo_view'), jsonb_build_object('type', 'step_view', 'stepIndex', 0),
    jsonb_build_object('type', 'demo_complete'), jsonb_build_object('type', 'hack')))), 3, 'track_events insère les événements valides');
select isnt(public.submit_lead('00000000-0000-0000-0000-0000000000d1', (select (r ->> 'versionId')::uuid from pub),
  'Prospect@Globex.com', '{"company":"Globex"}', true, 'visitor-0001', 'tok123'), null, 'lead enregistré (plan Pro)');
reset role;

-- Revue de sécurité R3 : plafond de 300 leads par heure et par démo, quel que soit le visiteur déclaré
insert into public.leads (workspace_id, demo_id, version_id, visitor_id, email, fields, consent)
select d.workspace_id, d.id, (select (r ->> 'versionId')::uuid from pub), 'flood-' || g, 'x' || g || '@example.com', '{}', false
  from public.demos d, generate_series(1, 300) g where d.id = '00000000-0000-0000-0000-0000000000d1';
set local role anon;
select throws_ok($$ select public.submit_lead('00000000-0000-0000-0000-0000000000d1', (select (r ->> 'versionId')::uuid from pub),
  'nouveau@example.com', '{}', true, 'visiteur-neuf-01', null) $$, 'P0001', 'RATE_LIMITED', 'plafond par démo atteint : refusé');
reset role;
delete from public.leads where visitor_id like 'flood-%';
-- Revue de sécurité R5 : aucune fonction de déclencheur exécutable par anon ou authenticated
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
              and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  0, 'fonctions de déclencheur : pas de droit d’exécution pour anon ni authenticated');

select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'alice@example.com');
select is((select (public.demo_analytics('00000000-0000-0000-0000-0000000000d1') ->> 'completions')::int), 1, 'analytics : 1 complétion');
select is((select (public.demo_analytics('00000000-0000-0000-0000-0000000000d1') -> 'sources' ->> 'link')::int), 1, 'analytics : vue attribuée au lien personnalisé (origine des vues)');
select is((select (public.workspace_kpis((select workspace_id from public.demos where id = '00000000-0000-0000-0000-0000000000d1'), now() - interval '1 day') ->> 'views')::int), 1, 'KPI du workspace : 1 vue');
select throws_ok($$ select public.workspace_kpis(gen_random_uuid(), now() - interval '1 day') $$, '42501', null, 'KPI du workspace : refusé hors membre');

-- ===== Duplication =====
create temp table dup as select public.duplicate_demo('00000000-0000-0000-0000-0000000000d1') as id;
select is((select count(*)::int from public.hotspots h join public.steps s on s.id = h.step_id
           where s.demo_id = (select id from dup)
             and h.action ->> 'stepId' <> '00000000-0000-0000-0000-0000000000a2'), 1,
  'duplication : hotspots copiés et cibles goto remappées');

select * from finish();
rollback;
