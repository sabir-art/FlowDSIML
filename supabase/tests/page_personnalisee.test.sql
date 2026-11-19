-- Tests pgTAP : L25-13 à L25-15, page personnalisée par lien (code tiré par la base, signataire
-- membre, lecture anonyme sans e-mail ni id, démo protégée sans token, lien inactif, not_found).
begin;
set search_path = public, extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000028a1', 'conseillere-page@example.com'),
  ('00000000-0000-0000-0000-0000000028a2', 'externe-page@example.com');
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

update public.profiles set full_name = 'Camille Fictive' where id = '00000000-0000-0000-0000-0000000028a1';
select pg_temp.login('00000000-0000-0000-0000-0000000028a1');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to anon, authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000028d1', (select ws from ctx), 'Créer un rapport', auth.uid());
insert into public.steps (demo_id, workspace_id, position, kind, title, body)
  values ('00000000-0000-0000-0000-0000000028d1', (select ws from ctx), 0, 'text', 'Bienvenue', '');
create temp table v1 as
  select public.publish_demo('00000000-0000-0000-0000-0000000028d1', '{"reviewed": true, "fictional": true}') as r;
reset role;
update public.demos set status = 'published', current_version_id = (select (r ->> 'versionId')::uuid from v1)
  where id = '00000000-0000-0000-0000-0000000028d1';
insert into public.demo_pages (demo_id, enabled, cta_label, cta_url)
  values ('00000000-0000-0000-0000-0000000028d1', true, 'Prendre rendez-vous', 'https://www.acme.example/rdv');

-- ===== Création =====
select pg_temp.login('00000000-0000-0000-0000-0000000028a1');
insert into public.share_links (id, demo_id, workspace_id, name, variables, page_enabled, page_title, page_message,
                                signed_by, dataset_row, page_code)
values ('00000000-0000-0000-0000-0000000028f1', '00000000-0000-0000-0000-0000000028d1', (select ws from ctx),
        'Acme', '{"company": "Acme", "email": "contact@acme.example"}', true, 'Votre démo, {{company}}',
        'Bonjour, voici la démo préparée pour vous.', '00000000-0000-0000-0000-0000000028a1', 1, 'AAAAAAAAAAAA');
create temp table code as select page_code as c from public.share_links where id = '00000000-0000-0000-0000-0000000028f1';
grant all on code to anon, authenticated;
select ok((select c from code) ~ '^[0-9A-Za-z]{12}$' and (select c from code) <> 'AAAAAAAAAAAA',
  'code de 12 caractères tiré par la base (jamais celui du client)');
update public.share_links set page_code = 'BBBBBBBBBBBB', page_title = 'Votre démo'
  where id = '00000000-0000-0000-0000-0000000028f1';
select is((select page_code from public.share_links where id = '00000000-0000-0000-0000-0000000028f1'),
  (select c from code), 'code figé une fois tiré');
select throws_ok($$ update public.share_links set signed_by = '00000000-0000-0000-0000-0000000028a2'
  where id = '00000000-0000-0000-0000-0000000028f1' $$, '23514', 'SIGNER_NOT_MEMBER', 'signataire : membre du workspace');
select throws_ok($$ update public.share_links set cta_url = 'http://acme.example' where id = '00000000-0000-0000-0000-0000000028f1' $$,
  '23514', null, 'lien du bouton en https');
select throws_ok($$ update public.share_links set page_title = repeat('x', 91) where id = '00000000-0000-0000-0000-0000000028f1' $$,
  '23514', null, 'titre : 90 caractères au plus');
insert into public.share_links (demo_id, workspace_id, name, page_enabled)
  values ('00000000-0000-0000-0000-0000000028d1', (select ws from ctx), 'Sans page', false);
select is((select page_code from public.share_links where name = 'Sans page'), null, 'sans page : pas de code');

-- ===== Lecture anonyme =====
select pg_temp.anon();
create temp table pp as
  select public.personal_page('00000000-0000-0000-0000-0000000028d1', (select c from code)) as r;
select is((select r ->> 'status' from pp), 'ok', 'page lue sans compte');
select is((select r -> 'personal' -> 'signer' from pp), '{"name": "Camille Fictive", "initials": "CF"}'::jsonb,
  'signature : nom et initiales seulement');
select ok((select r::text from pp) !~ 'conseillere-page@example.com' and (select r::text from pp) !~ '0000000028a1',
  'ni l’e-mail ni l’id du signataire');
select ok(not ((select r -> 'personal' -> 'variables' from pp) ? 'email'), 'variables sans email');
select is((select r -> 'personal' ->> 'datasetRow' from pp), '1', 'ligne du jeu de données');
select ok((select r -> 'personal' ->> 'token' from pp) is not null, 'démo non protégée : token du lien');
select is(public.resolve_share_link((select r -> 'personal' ->> 'token' from pp)) ->> 'datasetRow', '1',
  'resolve_share_link : ligne du jeu de données');
select is((select r -> 'page' ->> 'indexable' from pp), 'false', 'jamais indexée');
select is(public.personal_page('00000000-0000-0000-0000-0000000028d1', 'ZZZZZZZZZZZZ'), '{"status": "not_found"}'::jsonb,
  'code inconnu : not_found');

-- ===== Démo protégée, lien inactif, démo supprimée =====
reset role;
insert into public.demo_access (demo_id, workspace_id, mode, password_hash)
  values ('00000000-0000-0000-0000-0000000028d1', (select ws from ctx), 'password', 'x');
select pg_temp.anon();
select is(public.personal_page('00000000-0000-0000-0000-0000000028d1', (select c from code)) -> 'personal' ->> 'token', null,
  'démo protégée : pas de token (écran mot de passe habituel)');
reset role;
update public.share_links set is_active = false where id = '00000000-0000-0000-0000-0000000028f1';
select pg_temp.anon();
select is(public.personal_page('00000000-0000-0000-0000-0000000028d1', (select c from code)) ->> 'status', 'inactive',
  'lien désactivé : inactive');
reset role;
update public.demos set deleted_at = now() where id = '00000000-0000-0000-0000-0000000028d1';
select pg_temp.anon();
select is(public.personal_page('00000000-0000-0000-0000-0000000028d1', (select c from code)), '{"status": "not_found"}'::jsonb,
  'démo supprimée : même réponse not_found');

select * from finish();
rollback;
