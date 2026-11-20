-- Tests pgTAP : L39 (086, 088), accès « Sur invitation » et « Par domaine e-mail ». Données fictives.
begin;
set search_path = public, extensions;
select plan(35);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000039a1', 'admin-acces@example.com'),
  ('00000000-0000-0000-0000-0000000039a2', 'editeur-acces@example.com'),
  ('00000000-0000-0000-0000-0000000039a3', 'lecteur-acces@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000039a1');
create temp table ctx as select (public.create_workspace('Accès e-mail')).id as ws;
grant all on ctx to authenticated, anon, service_role;
reset role;
update public.workspaces set plan_code = 'pro', public_links_enabled = true where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000039a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000039a3', 'viewer');
insert into public.demos (id, workspace_id, title, created_by, status) values
  ('00000000-0000-0000-0000-0000000039d1', (select ws from ctx), 'Créer une fiche', '00000000-0000-0000-0000-0000000039a1', 'published');
insert into public.demo_versions (id, demo_id, workspace_id, number, manifest) values
  ('00000000-0000-0000-0000-0000000039e1', '00000000-0000-0000-0000-0000000039d1', (select ws from ctx), 1, '{"steps":[{}]}');
update public.demos set current_version_id = '00000000-0000-0000-0000-0000000039e1'
 where id = '00000000-0000-0000-0000-0000000039d1';

-- ===== Réglages =====
select pg_temp.login('00000000-0000-0000-0000-0000000039a3');
select throws_ok($$ select public.add_demo_invites('00000000-0000-0000-0000-0000000039d1', array['a@nord.example']) $$,
  '42501', 'FORBIDDEN', 'lecteur : ne peut pas inviter');
select is((select count(*) from public.demo_access_invites)::int, 0, 'lecteur : ne voit aucun invité');

select pg_temp.login('00000000-0000-0000-0000-0000000039a2');
select throws_ok($$ select public.set_demo_access('00000000-0000-0000-0000-0000000039d1', 'invite', false, null) $$,
  'P0001', 'INVITES_REQUIRED', 'mode invitation : au moins un invité');
select is(public.add_demo_invites('00000000-0000-0000-0000-0000000039d1',
          array[' Camille@Nord.Example ', 'sami@nord.example', 'camille@nord.example']),
  array['camille@nord.example', 'sami@nord.example'], 'éditeur : invités ajoutés, normalisés, sans doublon');
select throws_ok($$ select public.add_demo_invites('00000000-0000-0000-0000-0000000039d1', array['pas-une-adresse']) $$,
  'P0001', 'EMAIL_INVALID:pas-une-adresse', 'adresse invalide refusée');
select lives_ok($$ select public.set_demo_access('00000000-0000-0000-0000-0000000039d1', 'invite', false, null) $$,
  'éditeur : passe la démo en mode invitation');
select is((select count(*) from public.demo_access_invites)::int, 2, 'éditeur : voit les invités');
select throws_ok($$ select public.set_demo_domains('00000000-0000-0000-0000-0000000039d1', array['gmail.com']) $$,
  'P0001', 'DOMAIN_INVALID', 'messagerie grand public refusée comme domaine');
select is(public.set_demo_domains('00000000-0000-0000-0000-0000000039d1', array['@Mission-Locale.example', 'nord.example']),
  array['mission-locale.example', 'nord.example'], 'domaines nettoyés et triés');
reset role;

-- Écritures directes interdites
set local role anon;
select throws_ok($$ select * from public.demo_access_invites $$, '42501', null, 'anon : aucune lecture des invités');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000039a2');
select throws_ok($$ insert into public.demo_access_invites (demo_id, workspace_id, email)
                    values ('00000000-0000-0000-0000-0000000039d1', (select ws from ctx), 'x@nord.example') $$,
  '42501', null, 'éditeur : pas d''insertion directe');
select throws_ok($$ select * from public.access_email_sends $$, '42501', null, 'traces d''envoi illisibles');
select throws_ok($$ select public.demo_gate('00000000-0000-0000-0000-0000000039d1', null, null, null, 'camille@nord.example') $$,
  '42501', null, 'demo_gate réservé à service_role (l''adresse n''est jamais fournie par un client)');
reset role;

-- ===== Décision d'accès (service_role, comme open-demo) =====
set local role service_role;
select is(public.demo_gate('00000000-0000-0000-0000-0000000039d1') ->> 'status', 'email_required',
  'invitation : sans adresse vérifiée, l''adresse est demandée');
select is(public.demo_gate('00000000-0000-0000-0000-0000000039d1', null, null, null, 'inconnu@nord.example') ->> 'status',
  'email_not_allowed', 'adresse non invitée : refusée');
create temp table g1 as
  select public.demo_gate('00000000-0000-0000-0000-0000000039d1', null, null, null, 'Camille@nord.example') as r;
select is((select r ->> 'status' from g1), 'ok', 'adresse invitée vérifiée : accès');
select is((select (r ->> 'grantDays')::int from g1), 7, 'accès de 7 jours');
select is(public.demo_gate('00000000-0000-0000-0000-0000000039d1', null, (select r ->> 'grant' from g1)) ->> 'status', 'ok',
  'accès réutilisé à l''ouverture suivante');
select isnt((select opened_at from public.demo_access_invites where email = 'camille@nord.example'), null,
  'invité : « A ouvert la démo »');
reset role;

-- Retrait de l'invité : l'accès est révoqué
select pg_temp.login('00000000-0000-0000-0000-0000000039a2');
select public.remove_demo_invite('00000000-0000-0000-0000-0000000039d1', 'camille@nord.example');
reset role;
set local role service_role;
select is(public.demo_gate('00000000-0000-0000-0000-0000000039d1', null, (select r ->> 'grant' from g1)) ->> 'status',
  'email_required', 'invité retiré : son accès ne vaut plus');
reset role;

-- Domaine : même accès par une adresse du domaine
select pg_temp.login('00000000-0000-0000-0000-0000000039a2');
select public.set_demo_access('00000000-0000-0000-0000-0000000039d1', 'domain', false, null);
reset role;
set local role service_role;
select is(public.demo_gate('00000000-0000-0000-0000-0000000039d1', null, null, null, 'lea@mission-locale.example') ->> 'status',
  'ok', 'domaine : adresse du domaine autorisée');
select is(public.demo_gate('00000000-0000-0000-0000-0000000039d1', null, null, null, 'lea@ailleurs.example') ->> 'status',
  'email_not_allowed', 'domaine : autre domaine refusé');

-- ===== Réservations d'envoi et plafonds =====
select is(public.access_email_reserve('request', '00000000-0000-0000-0000-0000000039d1', 'lea@ailleurs.example') ->> 'reason',
  'domain_refused', 'demande anonyme : domaine refusé');
select is(public.access_email_reserve('request', '00000000-0000-0000-0000-0000000039d1', 'lea@nord.example',
          null, 'client-aaaaaaaaaaaaaaaa') ->> 'ok', 'true', 'demande anonyme : domaine autorisé, envoi réservé');
select is(public.access_email_reserve('request', '00000000-0000-0000-0000-0000000039d1', 'lea@nord.example') ->> 'reason',
  'rate_limited', 'même adresse : 1 envoi par 10 minutes');
select is(public.access_email_reserve('invite', '00000000-0000-0000-0000-0000000039d1', 'sami@nord.example',
          '00000000-0000-0000-0000-0000000039a2') ->> 'reason', 'forbidden', 'invitation envoyée par un éditeur : refusée (admin)');
select is(public.access_email_reserve('invite', '00000000-0000-0000-0000-0000000039d1', 'sami@nord.example',
          '00000000-0000-0000-0000-0000000039a1') ->> 'ok', 'true', 'invitation envoyée par l''admin');
-- Plafond par client (3 par heure), indépendant des adresses
select public.access_email_reserve('request', '00000000-0000-0000-0000-0000000039d1', 'b@nord.example', null, 'client-aaaaaaaaaaaaaaaa');
select public.access_email_reserve('request', '00000000-0000-0000-0000-0000000039d1', 'c@nord.example', null, 'client-aaaaaaaaaaaaaaaa');
select is(public.access_email_reserve('request', '00000000-0000-0000-0000-0000000039d1', 'd@nord.example',
          null, 'client-aaaaaaaaaaaaaaaa') ->> 'reason', 'rate_limited', 'client : 3 demandes par heure');
-- Plafond par espace (10 par heure), même sans client connu
insert into public.access_email_sends (workspace_id, demo_id, kind, email_hash)
  select (select ws from ctx), '00000000-0000-0000-0000-0000000039d1', 'request', repeat('a', 63) || i::text
    from generate_series(1, 6) i;
select is(public.access_email_reserve('request', '00000000-0000-0000-0000-0000000039d1', 'e@nord.example') ->> 'reason',
  'rate_limited', 'espace : 10 envois par heure');
reset role;

-- ===== Règles de partage : invitation et domaine autorisables, conflit bloqué =====
select ok((public.share_rules_of((select ws from ctx))).modes @> array['invite', 'domain'],
  'règles par défaut : les quatre modes');
update public.workspaces set plan_code = 'enterprise' where id = (select ws from ctx);
select pg_temp.login('00000000-0000-0000-0000-0000000039a1');
select public.set_share_rules((select ws from ctx), array['link', 'password'], null, 'editor', true, true);
reset role;
select ok((select locked_by_rules from public.demo_access where demo_id = '00000000-0000-0000-0000-0000000039d1'),
  'domaine interdit par les règles : démo bloquée, jamais rouverte en lien public');

-- ===== Comptes visiteurs : recherche et purge à 90 jours =====
insert into auth.users (id, email, raw_app_meta_data, created_at, last_sign_in_at) values
  ('00000000-0000-0000-0000-0000000039b1', 'ancien@nord.example', '{"kind":"visitor"}', now() - interval '200 days', now() - interval '120 days'),
  ('00000000-0000-0000-0000-0000000039b2', 'recent@nord.example', '{"kind":"visitor"}', now() - interval '200 days', now() - interval '10 days'),
  ('00000000-0000-0000-0000-0000000039b3', 'membre@nord.example', '{"kind":"visitor"}', now() - interval '200 days', null);
insert into public.members (workspace_id, user_id, role) values ((select ws from ctx), '00000000-0000-0000-0000-0000000039b3', 'viewer');
set local role service_role;
select is(public.access_account_of('Ancien@nord.example') ->> 'visitor', 'true', 'compte visiteur retrouvé par adresse');
select is(public.access_account_of('admin-acces@example.com') ->> 'visitor', 'false', 'compte de l''app : pas visiteur');
select is((public.purge_access_email() ->> 'visitors')::int, 1, 'purge : visiteur inactif depuis 90 jours supprimé');
reset role;
select is((select count(*) from auth.users where id in ('00000000-0000-0000-0000-0000000039b2', '00000000-0000-0000-0000-0000000039b3'))::int,
  2, 'purge : visiteur récent et visiteur devenu membre gardés');

select * from finish();
rollback;
