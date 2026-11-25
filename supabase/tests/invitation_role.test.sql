-- Tests pgTAP : rôle d'une invitation en attente, et rôle d'un membre actif.
begin;
set search_path = public, extensions;
select plan(16);

insert into auth.users (id, email, last_sign_in_at, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000320a1', 'olga-ro@acme.example', now(), now()),
  ('00000000-0000-0000-0000-0000000320a2', 'adam-ro@acme.example', now(), now()),
  ('00000000-0000-0000-0000-0000000320a3', 'eddie-ro@acme.example', now(), now()),
  ('00000000-0000-0000-0000-0000000320a4', 'autre-ro@autre.example', now(), now()),
  -- Compte confirmé par un premier lien, jamais reconnecté depuis
  ('00000000-0000-0000-0000-0000000320a5', 'paul-ro@acme.example', null, now());
-- Compte né d'une première invitation jamais ouverte, et inscription jamais confirmée (mot de passe posé)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000320a6', 'nina-ro@acme.example');
insert into auth.users (id, email, encrypted_password) values
  ('00000000-0000-0000-0000-0000000320a7', 'remi-ro@acme.example', 'empreinte-factice');
insert into public.profiles (id, full_name) values ('00000000-0000-0000-0000-0000000320a1', 'Olga Exemple')
  on conflict (id) do update set full_name = excluded.full_name;
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000320a1');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000320a4');
create temp table ctx2 as select (public.create_workspace('Autre')).id as ws;
grant all on ctx2 to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000320a2', 'admin'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000320a3', 'editor');
insert into public.invitations (id, workspace_id, email, role, invited_by) values
  ('00000000-0000-0000-0000-0000000320b1', (select ws from ctx), 'nina-ro@acme.example', 'viewer', '00000000-0000-0000-0000-0000000320a1'),
  ('00000000-0000-0000-0000-0000000320b2', (select ws from ctx), 'remi-ro@acme.example', 'viewer', '00000000-0000-0000-0000-0000000320a1'),
  ('00000000-0000-0000-0000-0000000320b3', (select ws from ctx), 'paul-ro@acme.example', 'viewer', '00000000-0000-0000-0000-0000000320a1'),
  ('00000000-0000-0000-0000-0000000320b4', (select ws from ctx), 'chef-ro@acme.example', 'owner', '00000000-0000-0000-0000-0000000320a1'),
  ('00000000-0000-0000-0000-0000000320b5', (select ws from ctx2), 'lea-ro@autre.example', 'viewer', '00000000-0000-0000-0000-0000000320a4');

-- ===== Rôle d'une invitation en attente =====
select ok(not has_function_privilege('anon', 'public.set_invitation_role(uuid, public.workspace_role)', 'execute'),
  'set_invitation_role : pas pour un visiteur');
select throws_ok($$ select public.set_invitation_role('00000000-0000-0000-0000-0000000320b1', 'editor') $$,
  '42501', null, 'sans session : refusé');
select pg_temp.login('00000000-0000-0000-0000-0000000320a3');
select throws_ok($$ select public.set_invitation_role('00000000-0000-0000-0000-0000000320b1', 'editor') $$,
  '42501', null, 'éditeur : refusé');
select pg_temp.login('00000000-0000-0000-0000-0000000320a2');
select lives_ok($$ select public.set_invitation_role('00000000-0000-0000-0000-0000000320b1', 'editor') $$,
  'admin : Lecteur vers Éditeur');
select is((select role::text from public.invitations where id = '00000000-0000-0000-0000-0000000320b1'), 'editor',
  'rôle enregistré');
select lives_ok($$ select public.set_invitation_role('00000000-0000-0000-0000-0000000320b1', 'admin') $$,
  'admin : peut donner son propre rôle');
select throws_ok($$ select public.set_invitation_role('00000000-0000-0000-0000-0000000320b1', 'owner') $$,
  'P0001', 'INVITATION_ROLE_FORBIDDEN', 'admin : Propriétaire refusé');
select throws_ok($$ select public.set_invitation_role('00000000-0000-0000-0000-0000000320b4', 'viewer') $$,
  'P0001', 'INVITATION_ROLE_FORBIDDEN', 'admin : ne modifie pas une invitation Propriétaire');
select throws_ok($$ select public.set_invitation_role('00000000-0000-0000-0000-0000000320b5', 'editor') $$,
  '42501', null, 'invitation d''un autre espace : refusé');
select throws_ok($$ select public.set_invitation_role('00000000-0000-0000-0000-00000032ffff', 'editor') $$,
  '42501', null, 'invitation inconnue : même refus');
select pg_temp.login('00000000-0000-0000-0000-0000000320a1');
select throws_ok($$ select public.set_invitation_role('00000000-0000-0000-0000-0000000320b1', 'owner') $$,
  'P0001', 'INVITATION_ROLE_FORBIDDEN', 'propriétaire : Propriétaire refusé aussi (transfert à part)');
select lives_ok($$ select public.set_invitation_role('00000000-0000-0000-0000-0000000320b4', 'admin') $$,
  'propriétaire : rétrograde une invitation Propriétaire');
reset role;
update public.invitations set accepted_at = now() where id = '00000000-0000-0000-0000-0000000320b2';
select pg_temp.login('00000000-0000-0000-0000-0000000320a2');
select throws_ok($$ select public.set_invitation_role('00000000-0000-0000-0000-0000000320b2', 'editor') $$,
  'P0001', 'INVITATION_ALREADY_USED', 'invitation déjà acceptée : refusé');

-- ===== Rôle d'un membre actif (vérification demandée avec ce retour) =====
update public.members set role = 'viewer'
 where workspace_id = (select ws from ctx) and user_id = '00000000-0000-0000-0000-0000000320a3';
select is((select role::text from public.members where workspace_id = (select ws from ctx)
            and user_id = '00000000-0000-0000-0000-0000000320a3'), 'viewer',
  'admin : change le rôle d''un membre actif (Éditeur vers Lecteur)');
select throws_ok($$ update public.members set role = 'owner'
   where user_id = '00000000-0000-0000-0000-0000000320a3' and workspace_id = (select ws from ctx) $$,
  'P0001', null, 'admin : ne donne pas Propriétaire à un membre');
select pg_temp.login('00000000-0000-0000-0000-0000000320a3');
update public.members set role = 'admin'
 where workspace_id = (select ws from ctx) and user_id = '00000000-0000-0000-0000-0000000320a3';
reset role;
select is((select role::text from public.members where workspace_id = (select ws from ctx)
            and user_id = '00000000-0000-0000-0000-0000000320a3'), 'viewer',
  'lecteur : ne change aucun rôle, pas même le sien');

select * from finish();
rollback;
