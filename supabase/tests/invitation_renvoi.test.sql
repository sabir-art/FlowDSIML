-- Tests pgTAP : réinvitation d'une adresse déjà invitée (compte non confirmé, compte confirmé).
begin;
set search_path = public, extensions;
select plan(8);

insert into auth.users (id, email, last_sign_in_at, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000310a1', 'olga-rr@acme.example', now(), now()),
  ('00000000-0000-0000-0000-0000000310a2', 'adam-rr@acme.example', now(), now()),
  ('00000000-0000-0000-0000-0000000310a3', 'eddie-rr@acme.example', now(), now()),
  ('00000000-0000-0000-0000-0000000310a4', 'autre-rr@autre.example', now(), now()),
  -- Compte confirmé par un premier lien, jamais reconnecté depuis
  ('00000000-0000-0000-0000-0000000310a5', 'paul-rr@acme.example', null, now());
-- Compte né d'une première invitation jamais ouverte, et inscription jamais confirmée (mot de passe posé)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000310a6', 'nina-rr@acme.example');
insert into auth.users (id, email, encrypted_password) values
  ('00000000-0000-0000-0000-0000000310a7', 'remi-rr@acme.example', 'empreinte-factice');
insert into public.profiles (id, full_name) values ('00000000-0000-0000-0000-0000000310a1', 'Olga Exemple')
  on conflict (id) do update set full_name = excluded.full_name;
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000310a1');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000310a4');
create temp table ctx2 as select (public.create_workspace('Autre')).id as ws;
grant all on ctx2 to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000310a2', 'admin'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000310a3', 'editor');
insert into public.invitations (id, workspace_id, email, role, invited_by) values
  ('00000000-0000-0000-0000-0000000310b1', (select ws from ctx), 'nina-rr@acme.example', 'viewer', '00000000-0000-0000-0000-0000000310a1'),
  ('00000000-0000-0000-0000-0000000310b2', (select ws from ctx), 'remi-rr@acme.example', 'viewer', '00000000-0000-0000-0000-0000000310a1'),
  ('00000000-0000-0000-0000-0000000310b3', (select ws from ctx), 'paul-rr@acme.example', 'viewer', '00000000-0000-0000-0000-0000000310a1'),
  ('00000000-0000-0000-0000-0000000310b4', (select ws from ctx), 'chef-rr@acme.example', 'owner', '00000000-0000-0000-0000-0000000310a1'),
  ('00000000-0000-0000-0000-0000000310b5', (select ws from ctx2), 'lea-rr@autre.example', 'viewer', '00000000-0000-0000-0000-0000000310a4');

-- ===== Réinvitation =====
select is(public.invite_send_reserve('00000000-0000-0000-0000-0000000310b1', '00000000-0000-0000-0000-0000000310a1') ->> 'mode',
  'email', 'compte né d''une invitation jamais ouverte : traité comme une nouvelle adresse');
select is(public.invite_send_reserve('00000000-0000-0000-0000-0000000310b2', '00000000-0000-0000-0000-0000000310a1') ->> 'mode',
  'email', 'inscription jamais confirmée : traitée comme une nouvelle adresse');
select is((select count(*) from public.notifications where kind = 'invite'
            and workspace_id = (select ws from ctx)), 0::bigint, 'compte non confirmé : aucune notification');
select is(public.invite_send_reserve('00000000-0000-0000-0000-0000000310b3', '00000000-0000-0000-0000-0000000310a1') - 'token',
  '{"ok": true, "mode": "notify", "email": "paul-rr@acme.example", "workspace_name": "Acme", "inviter_name": "Olga Exemple"}'::jsonb,
  'compte confirmé : notification, avec de quoi écrire l''e-mail');
select is((select user_id from public.notifications where kind = 'invite' and workspace_id = (select ws from ctx)),
  '00000000-0000-0000-0000-0000000310a5'::uuid, 'compte confirmé : notification posée pour ce compte');
select is((select sent from private.email_budget where day = private.email_day()), 3,
  'budget : pris de la même façon dans les trois cas');
-- Révocation puis nouvelle invitation de la même adresse : elle repart
delete from public.invitations where id = '00000000-0000-0000-0000-0000000310b3';
insert into public.invitations (id, workspace_id, email, role, invited_by) values
  ('00000000-0000-0000-0000-0000000310b6', (select ws from ctx), 'paul-rr@acme.example', 'editor', '00000000-0000-0000-0000-0000000310a1');
select is(public.invite_send_reserve('00000000-0000-0000-0000-0000000310b6', '00000000-0000-0000-0000-0000000310a1') ->> 'email',
  'paul-rr@acme.example', 'après une révocation : la nouvelle invitation est de nouveau envoyée');
select ok(not has_function_privilege('authenticated', 'public.invite_send_reserve(uuid, uuid)', 'execute')
      and not has_function_privilege('anon', 'public.invite_send_reserve(uuid, uuid)', 'execute'),
  'invite_send_reserve : service_role seulement');

select * from finish();
rollback;
