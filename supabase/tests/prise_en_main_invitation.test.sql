-- Tests pgTAP : prise en main, l'étape « Inviter un membre » se coche dès l'envoi d'une invitation
-- (20261201140000_prise_en_main_invitation.sql). Données fictives.
begin;
set search_path = public, extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000061a1', 'admin-inv@example.com'),
  ('00000000-0000-0000-0000-0000000061a2', 'autre-inv@example.com'),
  ('00000000-0000-0000-0000-0000000061a3', 'lecteur-inv@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000061a1');
create temp table ctx as select (public.create_workspace('Invitation')).id as ws;
grant all on ctx to authenticated;
create function pg_temp.step(k text) returns boolean language sql as $$
  select (public.workspace_onboarding((select ws from ctx)) -> 'steps' ->> k)::boolean
$$;
select ok(not pg_temp.step('invite'), 'espace neuf, seul : étape « invite » à faire');

-- Un autre espace a une invitation : l'étape de celui-ci ne bouge pas (cloisonnement par espace)
select pg_temp.login('00000000-0000-0000-0000-0000000061a2');
create temp table other as select (public.create_workspace('Autre espace')).id as ws;
grant all on other to authenticated;
reset role;
insert into public.invitations (workspace_id, email, role, invited_by)
  values ((select ws from other), 'invite-autre@example.com', 'editor', '00000000-0000-0000-0000-0000000061a2');
select pg_temp.login('00000000-0000-0000-0000-0000000061a1');
select ok(not pg_temp.step('invite'), 'invitation d''un autre espace : sans effet');

-- Invitation envoyée, pas encore acceptée : l'étape est faite
reset role;
insert into public.invitations (workspace_id, email, role, invited_by)
  values ((select ws from ctx), 'invite-1@example.com', 'editor', '00000000-0000-0000-0000-0000000061a1');
select pg_temp.login('00000000-0000-0000-0000-0000000061a1');
select ok(pg_temp.step('invite'), 'invitation envoyée, en attente : étape faite');
select is((select count(*)::int from public.members where workspace_id = (select ws from ctx)), 1,
  'toujours un seul membre : l''étape n''attend pas l''acceptation');

-- Invitation expirée : elle a bien été envoyée, l'étape reste faite
reset role;
update public.invitations set expires_at = now() - interval '1 day' where workspace_id = (select ws from ctx);
select pg_temp.login('00000000-0000-0000-0000-0000000061a1');
select ok(pg_temp.step('invite'), 'invitation expirée : étape toujours faite');

-- Invitation retirée et personne d'autre dans l'espace : l'étape redevient à faire
reset role;
delete from public.invitations where workspace_id = (select ws from ctx);
select pg_temp.login('00000000-0000-0000-0000-0000000061a1');
select ok(not pg_temp.step('invite'), 'invitation retirée, seul : étape de nouveau à faire');

-- Deux membres, sans invitation : l'ancienne règle reste vraie
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000061a3', 'viewer');
select pg_temp.login('00000000-0000-0000-0000-0000000061a1');
select ok(pg_temp.step('invite'), 'deux membres : étape faite');

-- Droits inchangés : un lecteur n'a pas la prise en main, une personne extérieure non plus
select pg_temp.login('00000000-0000-0000-0000-0000000061a3');
select throws_ok($$ select public.workspace_onboarding((select ws from ctx)) $$, '42501', null, 'lecteur : refusé');
select pg_temp.login('00000000-0000-0000-0000-0000000061a2');
select throws_ok($$ select public.workspace_onboarding((select ws from ctx)) $$, '42501', null,
  'personne d''un autre espace : refusée');

select * from finish();
rollback;
