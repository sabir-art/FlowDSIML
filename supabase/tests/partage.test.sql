-- Tests pgTAP : L11 partage sécurisé (mot de passe, essais limités, jetons, expiration, bucket privé).
begin;
set search_path = public, extensions;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'auteur@example.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'lecteur@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000f1');
create temp table ctx as select (public.create_workspace('Partage')).id as ws;
grant all on ctx to authenticated, service_role;
reset role;
update public.workspaces set public_links_enabled = true, settings = '{"websiteUrl":"https://partage.example"}'
  where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000000f2', 'viewer');
insert into public.demos (id, workspace_id, title, created_by, status)
  values ('00000000-0000-0000-0000-0000000000f9', (select ws from ctx), 'Protégée',
          '00000000-0000-0000-0000-0000000000f1', 'published');
insert into public.demo_versions (id, demo_id, workspace_id, number, manifest)
  values ('00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-0000000000f9', (select ws from ctx), 1, '{}');
update public.demos set current_version_id = '00000000-0000-0000-0000-0000000000fa'
  where id = '00000000-0000-0000-0000-0000000000f9';

select is((select public from storage.buckets where id = 'published'), false, 'bucket published privé');

-- Par défaut : accès libre
set local role service_role;
select is(public.demo_gate('00000000-0000-0000-0000-0000000000f9') ->> 'status', 'ok', 'sans règle : accès libre');
select is(public.demo_gate(gen_random_uuid()) ->> 'status', 'not_found', 'démo inconnue');
reset role;

-- Réglages : lecteur refusé, mot de passe trop court refusé, modes réservés refusés
select pg_temp.login('00000000-0000-0000-0000-0000000000f2');
select throws_ok($$ select public.set_demo_password('00000000-0000-0000-0000-0000000000f9', 'motdepasse') $$,
  '42501', null, 'un lecteur ne règle pas l''accès');
select pg_temp.login('00000000-0000-0000-0000-0000000000f1');
select throws_ok($$ select public.set_demo_password('00000000-0000-0000-0000-0000000000f9', 'court') $$,
  'P0001', 'PASSWORD_LENGTH', 'mot de passe de 8 caractères minimum');
select throws_ok($$ select public.set_demo_access('00000000-0000-0000-0000-0000000000f9', 'password', false, null) $$,
  'P0001', 'PASSWORD_REQUIRED', 'mode mot de passe sans mot de passe refusé');
select throws_ok($$ select public.set_demo_access('00000000-0000-0000-0000-0000000000f9', 'invite', false, null) $$,
  'P0001', 'NOT_AVAILABLE', 'invitation : pas encore disponible');
select lives_ok($$ select public.set_demo_password('00000000-0000-0000-0000-0000000000f9', 'parcours-2026') $$,
  'mot de passe enregistré');
select is((select mode from public.demo_access where demo_id = '00000000-0000-0000-0000-0000000000f9'), 'password',
  'mode mot de passe actif');
select throws_ok($$ select password_hash from public.demo_access $$, '42501', null,
  'le hash du mot de passe n''est pas lisible');
reset role;

-- Visiteur (via open-demo)
set local role service_role;
select is(public.demo_gate('00000000-0000-0000-0000-0000000000f9') ->> 'status', 'password_required',
  'mot de passe demandé');
select is(public.demo_gate('00000000-0000-0000-0000-0000000000f9', 'mauvais', null, 'client-0000000001') ->> 'remaining',
  '4', 'mauvais mot de passe : 4 essais restants');
create temp table g as select public.demo_gate('00000000-0000-0000-0000-0000000000f9', 'parcours-2026', null, 'client-0000000001') as r;
select is((select r ->> 'status' from g), 'ok', 'bon mot de passe : accès');
select is(public.demo_gate('00000000-0000-0000-0000-0000000000f9', null, (select r ->> 'grant' from g)) ->> 'status', 'ok',
  'jeton d''accès réutilisable');
select is((select count(*)::int from public.demo_access_grants
           where token_hash = encode(extensions.digest((select r ->> 'grant' from g), 'sha256'), 'hex')), 1,
  'seul le hash du jeton est stocké');
select is((select count(*)::int from public.demo_access_grants where token_hash = (select r ->> 'grant' from g)), 0,
  'le jeton en clair n''est pas stocké');
select is((select count(*)::int from (
  select public.demo_gate('00000000-0000-0000-0000-0000000000f9', 'x' || i, null, 'client-0000000002') ->> 'status' as s
  from generate_series(1, 5) i) q where s = 'locked'), 1, '5 échecs : attente d''une minute');
select is(public.demo_gate('00000000-0000-0000-0000-0000000000f9', 'parcours-2026', null, 'client-0000000002') ->> 'status',
  'locked', 'bloqué même avec le bon mot de passe pendant l''attente');
reset role;

-- Changer le mot de passe révoque les jetons
select pg_temp.login('00000000-0000-0000-0000-0000000000f1');
select public.set_demo_password('00000000-0000-0000-0000-0000000000f9', 'nouveau-2026');
reset role;
set local role service_role;
select is(public.demo_gate('00000000-0000-0000-0000-0000000000f9', null, (select r ->> 'grant' from g)) ->> 'status',
  'password_required', 'nouveau mot de passe : anciens jetons révoqués');
reset role;

-- Expiration
select pg_temp.login('00000000-0000-0000-0000-0000000000f1');
select public.set_demo_access('00000000-0000-0000-0000-0000000000f9', 'link', false, now() - interval '1 hour');
reset role;
set local role service_role;
create temp table e as select public.demo_gate('00000000-0000-0000-0000-0000000000f9') as r;
select is((select r ->> 'status' from e), 'expired', 'lien expiré');
select is((select r ->> 'workspace' || ' ' || (r ->> 'website') from e), 'Partage https://partage.example',
  'lien expiré : nom et site du workspace fournis');
reset role;

-- Liens publics interdits : même réponse qu'une démo inexistante, sans information
update public.workspaces set public_links_enabled = false where id = (select ws from ctx);
set local role service_role;
select is(public.demo_gate('00000000-0000-0000-0000-0000000000f9'), '{"status": "not_found"}'::jsonb,
  'liens publics interdits : réponse identique à une démo inexistante');
reset role;

-- Purge des essais de plus de 24 h
update public.demo_access_attempts set updated_at = now() - interval '25 hours';
select public.purge_demo_access();
select is((select count(*)::int from public.demo_access_attempts), 0, 'essais de plus de 24 h purgés');

-- Anonyme : aucune lecture directe
set local role anon;
select throws_ok($$ select public.demo_gate('00000000-0000-0000-0000-0000000000f9') $$, '42501', null,
  'demo_gate réservé à open-demo (service_role)');
reset role;

select * from finish();
rollback;
