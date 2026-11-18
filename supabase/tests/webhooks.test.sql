-- Tests pgTAP : L23 webhooks sortants (URL, droits, secrets, émission, essais, rejeu, limite du plan).
begin;
set search_path = public, extensions;
select plan(49);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005a1', 'olga-hooks@example.com'),
  ('00000000-0000-0000-0000-0000000005a2', 'eddie-hooks@example.com'),
  ('00000000-0000-0000-0000-0000000005a3', 'autre-hooks@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Olga (owner), Eddie (éditeur) ; « autre » est owner d'un autre workspace
select pg_temp.login('00000000-0000-0000-0000-0000000005a1');
create temp table ctx as select (public.create_workspace('Webhooks')).id as ws;
grant all on ctx to authenticated;
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000005a3');
create temp table ctx2 as select (public.create_workspace('Autre')).id as ws;
grant all on ctx2 to authenticated;
select pg_temp.logout();
insert into public.members (workspace_id, user_id, role) values ((select ws from ctx), '00000000-0000-0000-0000-0000000005a2', 'editor');

-- ===== URL =====
select ok(public.webhook_url_ok('https://hooks.example.com/tutoclick?x=1'), 'URL https publique acceptée');
select ok(public.webhook_url_ok('https://hooks.example.com:8443/h'), 'port 8443 accepté');
select ok(public.webhook_url_ok('https://a.05shop.example/h'), 'un libellé qui commence par un chiffre reste valide');
select ok(not public.webhook_url_ok('http://hooks.example.com/h'), 'http refusé');
select ok(not public.webhook_url_ok('https://localhost/h'), 'localhost refusé');
select ok(not public.webhook_url_ok('https://10.0.0.1/h'), 'IP privée refusée');
select ok(not public.webhook_url_ok('https://169.254.169.254/latest'), 'métadonnées cloud refusées');
select ok(not public.webhook_url_ok('https://[::1]/h'), 'IPv6 littérale refusée');
select ok(not public.webhook_url_ok('https://user:pass@hooks.example.com/h'), 'identifiants dans l''URL refusés');
select ok(not public.webhook_url_ok('https://2130706433/h'), 'IP en décimal refusée');
select ok(not public.webhook_url_ok('https://0x7f.0.0.1/h'), 'IP en hexadécimal refusée');
select ok(not public.webhook_url_ok('https://api.internal/h'), 'nom interne refusé');
select ok(not public.webhook_url_ok('https://hooks.example.com:22/h'), 'port exotique refusé');

-- ===== Limite du plan (lue dans plans) =====
select pg_temp.login('00000000-0000-0000-0000-0000000005a1');
select throws_ok($$ select public.webhook_create((select ws from ctx), 'https://hooks.example.com/a', array['lead.created']) $$,
  'P0001', 'PLAN_LIMIT', 'plan free : aucun webhook');
select pg_temp.logout();
update public.workspaces set plan_code = 'pro' where id = (select ws from ctx);
select is((select (limits ->> 'webhooks')::int from public.plans where code = 'pro'), 3, 'limite pro lue dans plans : 3');

-- ===== Création et droits =====
select pg_temp.login('00000000-0000-0000-0000-0000000005a1');
create temp table h as
  select (public.webhook_create((select ws from ctx), 'https://hooks.example.com/lead', array['lead.created', 'learner.quiz_passed'])) as r;
create temp table h2 as
  select (public.webhook_create((select ws from ctx), 'https://hooks.example.com/fin',
    array['demo.completed', 'learner.quiz_passed', 'learner.quiz_failed', 'learner.module_validated'], 'Automate')) as r;
grant all on h, h2 to authenticated;
select ok((select r ->> 'secret' from h) ~ '^tcsec_[A-Za-z0-9_-]{43}$', 'secret « tcsec_ » renvoyé une fois à la création');
select hasnt_function('public', 'webhook_reveal_secret', 'aucun moyen de relire un secret après coup');
select ok((select w.name = 'Automate' and w.secret_hint = right((select r ->> 'secret' from h2), 4)
             from public.webhooks w where w.id = ((select r from h2) ->> 'id')::uuid),
  'nom facultatif et 4 derniers caractères du secret pour l''affichage masqué');
select throws_ok($$ select public.webhook_create((select ws from ctx), 'https://10.1.2.3/x', array['lead.created']) $$,
  '22023', 'INVALID_URL', 'création : URL privée refusée');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000005a2');
select is((select count(*)::int from public.webhooks), 0, 'un éditeur ne voit pas les webhooks');
select throws_ok($$ select public.webhook_rotate_secret(((select r from h) ->> 'id')::uuid) $$, '42501', null,
  'un éditeur ne peut pas renouveler le secret');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000005a3');
select is((select count(*)::int from public.webhooks), 0, 'l''admin d''un autre workspace ne voit rien');
select throws_ok($$ select count(*) from private.webhook_secrets $$, '42501', null, 'secrets inaccessibles à authenticated');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-0000000005a1');
create temp table rot as select public.webhook_rotate_secret(((select r from h) ->> 'id')::uuid) as s;
select pg_temp.logout();
select ok((select s ~ '^tcsec_' and s <> (select r ->> 'secret' from h) from rot), 'renouvellement : nouveau secret montré une fois');
select ok((select count(*) = 1 and bool_and(target_ref = (select r ->> 'id' from h) and meta = '{}'::jsonb)
             from public.audit_log where action = 'webhook.secret_rotated'),
  'renouvellement tracé dans audit_log, sans le secret');

-- ===== Émission =====
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000005d1', (select ws from ctx), 'Démo webhooks', '00000000-0000-0000-0000-0000000005a1');
insert into public.demo_versions (id, demo_id, workspace_id, number, manifest, published_by)
  values ('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000005d1', (select ws from ctx), 1, '{}',
          '00000000-0000-0000-0000-0000000005a1');
insert into public.leads (workspace_id, demo_id, email, fields)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000005d1', 'lead@example.com', '{"structure": "Antenne Exemple"}');
select is((select count(*)::int from public.webhook_deliveries where event_type = 'lead.created'), 1,
  'lead.created : une livraison, seulement vers le webhook abonné');
select ok((select payload -> 'data' ->> 'email' = 'lead@example.com' and payload ->> 'type' = 'lead.created'
                  and payload ? 'id' and payload ? 'created_at'
             from public.webhook_deliveries where event_type = 'lead.created'),
  'format { id, type, created_at, data }, e-mail pour le seul abonné lead.created');

-- Apprenant identifié (L13) derrière « visiteur-abcdef », démo rattachée à un parcours
insert into public.learners (id, workspace_id, email, full_name, source)
  values ('00000000-0000-0000-0000-0000000005e1', (select ws from ctx), 'apprenant@example.com', 'Apprenant Exemple', 'lead');
insert into public.learner_visitors (workspace_id, visitor_id, learner_id)
  values ((select ws from ctx), 'visiteur-abcdef', '00000000-0000-0000-0000-0000000005e1');
insert into public.paths (id, workspace_id, title) values ('00000000-0000-0000-0000-0000000005b1', (select ws from ctx), 'Parcours');
insert into public.path_modules (path_id, demo_id, workspace_id)
  values ('00000000-0000-0000-0000-0000000005b1', '00000000-0000-0000-0000-0000000005d1', (select ws from ctx));

insert into public.quiz_attempts (workspace_id, demo_id, version_id, visitor_id, answers, correct, total, score, passed)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000005d1', '00000000-0000-0000-0000-0000000005f1',
          'visiteur-abcdef', '{}', 1, 4, 25, false);
select ok((select count(*) filter (where event_type = 'learner.quiz_failed') = 1
              and count(*) filter (where event_type in ('learner.quiz_passed', 'learner.module_validated')) = 0
             from public.webhook_deliveries),
  'quiz échoué : learner.quiz_failed seulement, aucun module validé');
insert into public.quiz_attempts (workspace_id, demo_id, version_id, visitor_id, answers, correct, total, score, passed)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000005d1', '00000000-0000-0000-0000-0000000005f1',
          'visiteur-abcdef', '{}', 4, 4, 100, true);
select ok((select count(*) = 2 and count(distinct event_id) = 1 and bool_and(not (payload -> 'data' ? 'email'))
                  and bool_and(payload -> 'data' ->> 'learner_id' = '00000000-0000-0000-0000-0000000005e1')
             from public.webhook_deliveries where event_type = 'learner.quiz_passed'),
  'learner.quiz_passed : une livraison par abonné, même event_id, identifiants seulement');
select ok((select count(*) = 1
                  and bool_and(payload -> 'data' ->> 'path_id' = '00000000-0000-0000-0000-0000000005b1')
                  and bool_and(payload::text !~ 'apprenant@example.com|Apprenant Exemple')
             from public.webhook_deliveries where event_type = 'learner.module_validated'),
  'module validé à la réussite du quiz : learner_id, demo_id, path_id, sans nom ni e-mail');
insert into public.quiz_attempts (workspace_id, demo_id, version_id, visitor_id, answers, correct, total, score, passed)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000005d1', '00000000-0000-0000-0000-0000000005f1',
          'visiteur-anonyme', '{}', 4, 4, 100, true);
select is((select count(*)::int from public.webhook_deliveries where event_type = 'learner.module_validated'), 1,
  'visiteur anonyme ou seconde réussite : pas de nouveau module validé');

update public.webhooks set state = 'paused' where id = ((select r from h2) ->> 'id')::uuid;
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000005d1', 'visiteur-abcdef', 'session-abcdef', 'demo_complete');
select is((select count(*)::int from public.webhook_deliveries where event_type = 'demo.completed'), 0,
  'webhook en pause : aucune livraison');
update public.webhooks set state = 'active' where id = ((select r from h2) ->> 'id')::uuid;
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000005d1', 'visiteur-abcdef', 'session-abcdef', 'demo_complete');
select is((select count(*)::int from public.webhook_deliveries where event_type = 'demo.completed'), 1,
  'demo.completed émis depuis events');
select is((select count(*)::int from public.webhook_deliveries where event_type = 'learner.module_validated'), 1,
  'démo terminée sans quiz après la validation : toujours une seule validation du module');

-- ===== Envoi : réservation, essais, pause automatique =====
create temp table claimed as select * from public.webhook_claim_due(10);
grant all on claimed to authenticated;
select ok((select count(*) >= 3 from claimed)
          and (select bool_and(cardinality(secrets) = 2) from claimed c join public.webhook_deliveries d on d.id = c.id
                where d.webhook_id = ((select r from h) ->> 'id')::uuid)
          and (select bool_and(cardinality(secrets) = 1) from claimed c join public.webhook_deliveries d on d.id = c.id
                where d.webhook_id = ((select r from h2) ->> 'id')::uuid),
  'réservation : deux secrets pendant les 24 h qui suivent un renouvellement, un seul sinon');
select is(public.webhook_record_result((select id from claimed where event_type = 'lead.created'), 500, 'erreur', 120, null),
  'pending', 'échec : nouvel essai programmé');
select ok((select attempt = 2 and next_attempt_at between now() + interval '50 seconds' and now() + interval '70 seconds'
             from public.webhook_deliveries where id = (select id from claimed where event_type = 'lead.created')),
  'premier nouvel essai à 1 min');
update public.webhook_deliveries set attempt = 6 where id = (select id from claimed where event_type = 'lead.created');
select is(public.webhook_record_result((select id from claimed where event_type = 'lead.created'), 503, '', 10, 'timeout'),
  'dead', '6e échec : abandon');
select is((select state from public.webhooks where id = ((select r from h) ->> 'id')::uuid), 'paused_auto',
  'webhook en pause automatique');

-- ===== Test (ping) : jamais réessayé ni compté =====
select pg_temp.login('00000000-0000-0000-0000-0000000005a1');
create temp table ping as select public.webhook_send_test(((select r from h2) ->> 'id')::uuid) as id;
select pg_temp.logout();
select is(public.webhook_record_result((select id from ping), 404, '', 30, 'HTTP 404'), 'failed', 'test en échec : définitif');
select ok((select failures = 0 from public.webhooks where id = ((select r from h2) ->> 'id')::uuid)
          and (select payload -> 'data' = '{}'::jsonb from public.webhook_deliveries where id = (select id from ping)),
  'test : { data: {} }, jamais compté dans les échecs');

-- ===== Envoi immédiat (JWT d'un admin, une livraison en attente, 10 par minute) =====
select pg_temp.login('00000000-0000-0000-0000-0000000005a1');
create temp table ping2 as select public.webhook_send_test(((select r from h2) ->> 'id')::uuid) as id;
select pg_temp.logout();
select is((select count(*)::int from public.webhook_claim_one((select id from ping2), '00000000-0000-0000-0000-0000000005a2')), 0,
  'envoi immédiat refusé à un éditeur (même réponse qu''une livraison inexistante)');
select is((select count(*)::int from public.webhook_claim_one((select id from ping2), '00000000-0000-0000-0000-0000000005a1')), 1,
  'envoi immédiat d''une livraison en attente par un admin');
select is((select count(*)::int from public.webhook_claim_one((select id from ping2), '00000000-0000-0000-0000-0000000005a1')), 0,
  'une livraison déjà réservée n''est pas renvoyée');
select throws_ok($$ select public.webhook_claim_one(gen_random_uuid(), '00000000-0000-0000-0000-0000000005a1')
                      from generate_series(1, 10) $$, 'P0001', 'RATE_LIMIT', 'au-delà de 10 envois immédiats par minute : refus');
select pg_temp.login('00000000-0000-0000-0000-0000000005a1');
select throws_ok($$ select public.webhook_claim_one(gen_random_uuid(), '00000000-0000-0000-0000-0000000005a1') $$,
  '42501', null, 'webhook_claim_one réservé au rôle service');
select pg_temp.logout();

-- ===== Reprise après plantage : une livraison restée en 'sending' est reprise à l'expiration du bail =====
select ok(not exists (select 1 from public.webhook_claim_due(100) c where c.id = (select id from ping2)),
  'livraison en cours (bail de 2 min actif) : pas reprise');
update public.webhook_deliveries set next_attempt_at = now() - interval '1 second' where id = (select id from ping2);
create temp table reclaimed as select * from public.webhook_claim_due(100);
select ok(exists (select 1 from reclaimed c where c.id = (select id from ping2))
          and (select status = 'sending' and next_attempt_at > now() + interval '110 seconds'
                 from public.webhook_deliveries where id = (select id from ping2)),
  'livraison restée en sending après expiration du bail : reprise avec un nouveau bail');

-- ===== Rejeu (admin, même event_id) =====
select pg_temp.login('00000000-0000-0000-0000-0000000005a1');
create temp table rep as select public.webhook_replay((select id from claimed where event_type = 'lead.created')) as id;
select pg_temp.logout();
select ok((select r.event_id = o.event_id and r.attempt = 1 and r.status = 'pending'
             from public.webhook_deliveries r, public.webhook_deliveries o
            where r.id = (select id from rep) and o.id = (select id from claimed where event_type = 'lead.created')),
  'rejeu : nouvel envoi avec le même event_id');

select * from finish();
rollback;
