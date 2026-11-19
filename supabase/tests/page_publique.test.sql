-- Tests pgTAP : L19b page publique (règles, lecture anonyme, protection, canal « page »).
begin;
set search_path = public, extensions;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'editrice@example.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'lecteur@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000f1');
create temp table ctx as select (public.create_workspace('Pages')).id as ws;
grant all on ctx to anon, authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-00000000ff01', (select ws from ctx), 'Créer un rapport', auth.uid()),
  ('00000000-0000-0000-0000-00000000ff02', (select ws from ctx), 'Exporter en PDF', auth.uid());
insert into public.steps (demo_id, workspace_id, position, kind, title, body) values
  ('00000000-0000-0000-0000-00000000ff01', (select ws from ctx), 0, 'text', 'Bienvenue', ''),
  ('00000000-0000-0000-0000-00000000ff01', (select ws from ctx), 1, 'text', 'Prêt à commencer', 'Prenez rendez-vous.'),
  ('00000000-0000-0000-0000-00000000ff02', (select ws from ctx), 0, 'text', 'Export', '');
create temp table v1 as select public.publish_demo('00000000-0000-0000-0000-00000000ff01', '{"reviewed": true, "fictional": true}') as r;
grant all on v1 to anon, authenticated;
create temp table v2 as select public.publish_demo('00000000-0000-0000-0000-00000000ff02', '{"reviewed": true, "fictional": true}') as r;
reset role;
update public.demos d set status = 'published', current_version_id = (select (r ->> 'versionId')::uuid from v1) where id = '00000000-0000-0000-0000-00000000ff01';
update public.demos d set status = 'published', current_version_id = (select (r ->> 'versionId')::uuid from v2) where id = '00000000-0000-0000-0000-00000000ff02';
insert into public.members (workspace_id, user_id, role) values ((select ws from ctx), '00000000-0000-0000-0000-0000000000f2', 'viewer');

-- ===== Règles =====
select pg_temp.login('00000000-0000-0000-0000-0000000000f1');
select lives_ok($$ insert into public.demo_pages (demo_id, enabled, description, cta_label, cta_url, related)
  values ('00000000-0000-0000-0000-00000000ff01', true, 'Un rapport en 2 minutes.', 'Prendre rendez-vous', 'https://www.acme.example/rdv', true) $$,
  'éditrice : page créée');
select is((select workspace_id from public.demo_pages limit 1), (select ws from ctx), 'workspace posé par la base');
select throws_ok($$ insert into public.demo_pages (demo_id, cta_label, cta_url) values ('00000000-0000-0000-0000-00000000ff02', 'Voir', 'http://acme.example') $$,
  '23514', null, 'lien du bouton en http refusé');
select throws_ok($$ insert into public.demo_pages (demo_id, cta_label, cta_url) values ('00000000-0000-0000-0000-00000000ff02', 'Voir', 'javascript:alert(1)') $$,
  '23514', null, 'lien javascript: refusé');
select throws_ok($$ insert into public.demo_pages (demo_id, cta_label) values ('00000000-0000-0000-0000-00000000ff02', 'Voir') $$,
  '23514', null, 'texte du bouton sans lien refusé');
select throws_ok($$ insert into public.demo_pages (demo_id, title) values ('00000000-0000-0000-0000-00000000ff02', repeat('x', 71)) $$,
  '23514', null, 'titre de 71 caractères refusé');
insert into public.demo_pages (demo_id) values ('00000000-0000-0000-0000-00000000ff02');
select is((select enabled or indexable from public.demo_pages where demo_id = '00000000-0000-0000-0000-00000000ff02'), false,
  'désactivée et non indexée par défaut');
select pg_temp.login('00000000-0000-0000-0000-0000000000f2');
update public.demo_pages set enabled = true where demo_id = '00000000-0000-0000-0000-00000000ff02';
select is((select enabled from public.demo_pages where demo_id = '00000000-0000-0000-0000-00000000ff02'), false,
  'lecteur : modification sans effet (RLS)');

-- ===== Lecture anonyme =====
select pg_temp.anon();
create temp table pp as select public.public_page('00000000-0000-0000-0000-00000000ff01') as r;
select is((select r ->> 'title' from pp), 'Créer un rapport', 'titre par défaut : celui de la démo');
select is((select r -> 'cta' ->> 'url' from pp), 'https://www.acme.example/rdv', 'bouton d''action');
select is((select r ->> 'endTitle' from pp), 'Prêt à commencer', 'textes de l''écran de fin');
select ok((select r::text not like '%' || (select ws from ctx)::text || '%' and r::text not like '%0000000000f1%' from pp),
  'aucun identifiant de workspace ni d''utilisateur');
select is((select jsonb_array_length(r -> 'related') from pp), 0, 'démos liées : seulement celles qui ont une page active');
select is(public.public_page('00000000-0000-0000-0000-00000000ff02'), null, 'page désactivée : null');
reset role;
update public.demo_pages set indexable = true where demo_id = '00000000-0000-0000-0000-00000000ff01';
insert into public.demo_access (demo_id, workspace_id, mode, password_hash)
  values ('00000000-0000-0000-0000-00000000ff01', (select ws from ctx), 'password', 'x');
select pg_temp.anon();
select is(public.public_page('00000000-0000-0000-0000-00000000ff01') ->> 'indexable', 'false', 'démo protégée : jamais indexée');
reset role;
update public.workspaces set public_links_enabled = false;
select pg_temp.anon();
select is(public.public_page('00000000-0000-0000-0000-00000000ff01'), null, 'liens publics coupés : null');

-- ===== Canal « page » =====
reset role;
update public.workspaces set public_links_enabled = true;
select pg_temp.anon();
select public.track_events(jsonb_build_object('demoId', '00000000-0000-0000-0000-00000000ff01',
  'versionId', (select r ->> 'versionId' from v1), 'visitorId', 'visiteur-p01', 'sessionId', 'session-p01',
  'channel', 'page', 'events', '[{"type":"demo_view"}]'::jsonb));
select public.track_events(jsonb_build_object('demoId', '00000000-0000-0000-0000-00000000ff01',
  'versionId', (select r ->> 'versionId' from v1), 'visitorId', 'visiteur-p02', 'sessionId', 'session-p02',
  'channel', 'autre', 'events', '[{"type":"demo_view"}]'::jsonb));
select pg_temp.login('00000000-0000-0000-0000-0000000000f2');
select is((public.workspace_analytics((select ws from ctx), now() - interval '1 day') -> 'sources' ->> 'page')::int, 1,
  'source « page » (canal hors liste ignoré)');

select * from finish();
rollback;
