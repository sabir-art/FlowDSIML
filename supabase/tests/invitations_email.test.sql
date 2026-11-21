-- Tests pgTAP : e-mails P1, budget commun, plafond horaire, notification « invite », Accepter et Refuser.
begin;
set search_path = public, extensions;
select plan(20);

insert into auth.users (id, email, last_sign_in_at) values
  ('00000000-0000-0000-0000-0000000300a1', 'olga-inv@acme.example', now()),
  ('00000000-0000-0000-0000-0000000300a2', 'eddie-inv@acme.example', now()),
  ('00000000-0000-0000-0000-0000000300a3', 'paul-inv@acme.example', now());
-- Compte créé par une invitation jamais ouverte : l'e-mail repart
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000300a4', 'nina-inv@acme.example');
insert into public.profiles (id, full_name) values ('00000000-0000-0000-0000-0000000300a1', 'Olga Exemple')
  on conflict (id) do update set full_name = excluded.full_name;
create function pg_temp.login(uid uuid, mail text default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', mail)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000300a1');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to authenticated;
reset role;
update public.workspaces set plan_code = 'enterprise' where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000300a2', 'editor');
insert into public.invitations (id, workspace_id, email, role, invited_by) values
  ('00000000-0000-0000-0000-0000000300b1', (select ws from ctx), 'marie@acme.example', 'editor', '00000000-0000-0000-0000-0000000300a1'),
  ('00000000-0000-0000-0000-0000000300b2', (select ws from ctx), 'paul-inv@acme.example', 'viewer', '00000000-0000-0000-0000-0000000300a1'),
  ('00000000-0000-0000-0000-0000000300b3', (select ws from ctx), 'nina-inv@acme.example', 'viewer', '00000000-0000-0000-0000-0000000300a1');

-- Envoi par e-mail : budget pris, nom de l'espace et de l'invitant seulement
select is(public.invite_send_reserve('00000000-0000-0000-0000-0000000300b1', '00000000-0000-0000-0000-0000000300a1')
            - 'token',
  '{"ok": true, "mode": "email", "email": "marie@acme.example", "workspace_name": "Acme", "inviter_name": "Olga Exemple"}'::jsonb,
  'nouvelle adresse : e-mail réservé');
select is((select sent from private.email_budget where day = private.email_day()), 1, 'budget : 1 envoi compté');
select is(public.invite_send_reserve('00000000-0000-0000-0000-0000000300b1', '00000000-0000-0000-0000-0000000300a1') ->> 'reason',
  'sent', 'pas de second envoi de la même invitation');
select is(public.invite_send_reserve('00000000-0000-0000-0000-0000000300b3', '00000000-0000-0000-0000-0000000300a1') ->> 'mode',
  'email', 'compte jamais utilisé (invitation non ouverte) : e-mail');
select is(public.invite_send_reserve('00000000-0000-0000-0000-0000000300b2', '00000000-0000-0000-0000-0000000300a2') ->> 'reason',
  'forbidden', 'éditeur : refusé');

-- Échec du fournisseur : rendu au budget et au plafond
select public.invite_send_undo('00000000-0000-0000-0000-0000000300b3');
select is((select sent from private.email_budget where day = private.email_day()), 1, 'échec : envoi rendu au budget');
select is((select sent_at from public.invitations where id = '00000000-0000-0000-0000-0000000300b3'), null,
  'échec : invitation de nouveau envoyable');

-- Compte existant : notification dans l'app, aucun e-mail
select is(public.invite_send_reserve('00000000-0000-0000-0000-0000000300b2', '00000000-0000-0000-0000-0000000300a1'),
  '{"ok": true, "mode": "notify"}'::jsonb, 'compte existant : notification');
select is((select data - 'invitation' from public.notifications where kind = 'invite'),
  '{"actor": "Olga Exemple", "workspace": "Acme"}'::jsonb, 'notification : espace et invitant');
select is((select sent from private.email_budget where day = private.email_day()), 1, 'notification : pas de budget');

-- La personne invitée lit sa notification sans être membre, et elle seule
select pg_temp.login('00000000-0000-0000-0000-0000000300a3', 'paul-inv@acme.example');
select is((select count(*)::int from public.notifications where kind = 'invite'), 1, 'invitée : voit son invitation');
select throws_ok($$ select public.answer_invitation('00000000-0000-0000-0000-0000000300b1', true) $$,
  'INVITATION_EMAIL_MISMATCH', 'pas la réponse à l''invitation d''une autre adresse');
select is(public.answer_invitation('00000000-0000-0000-0000-0000000300b2', true), (select ws from ctx), 'Accepter : espace rejoint');
select is((select data ->> 'answer' from public.notifications where kind = 'invite'), 'accepted', 'notification : acceptée');
select isnt((select read_at from public.notifications where kind = 'invite'), null, 'notification : lue');
select pg_temp.login('00000000-0000-0000-0000-0000000300a2');
select is((select count(*)::int from public.notifications where kind = 'invite'), 0, 'autre personne : ne la voit pas');
select throws_ok($$ select public.invite_quota((select ws from ctx)) $$, '42501', null, 'plafond : admins seulement');
reset role;

-- Refuser : l'invitation disparaît
insert into public.invitations (id, workspace_id, email, role, invited_by) values
  ('00000000-0000-0000-0000-0000000300b4', (select ws from ctx), 'eddie-inv@acme.example', 'viewer', '00000000-0000-0000-0000-0000000300a1');
select pg_temp.login('00000000-0000-0000-0000-0000000300a2', 'eddie-inv@acme.example');
select public.answer_invitation('00000000-0000-0000-0000-0000000300b4', false);
reset role;
select is((select count(*)::int from public.invitations where id = '00000000-0000-0000-0000-0000000300b4'), 0,
  'Refuser : invitation supprimée');

-- Plafond horaire : 20 envois par heure et par espace
insert into public.invitations (workspace_id, email, role, invited_by, sent_at)
  select (select ws from ctx), 'lot' || i || '@acme.example', 'viewer', '00000000-0000-0000-0000-0000000300a1',
         now() - interval '30 minutes'
    from generate_series(1, 18) i;
select is(public.invite_send_reserve('00000000-0000-0000-0000-0000000300b3', '00000000-0000-0000-0000-0000000300a1') ->> 'reason',
  'rate_limit', '21e envoi dans l''heure : refusé');

-- Budget du jour : 150 au plus
update private.email_budget set sent = 150 where day = private.email_day();
update public.invitations set sent_at = now() - interval '2 hours' where sent_at is not null;
select is(public.invite_send_reserve('00000000-0000-0000-0000-0000000300b3', '00000000-0000-0000-0000-0000000300a1') ->> 'reason',
  'budget', '150 envois : plus d''invitation par e-mail');

select * from finish();
rollback;
