-- Tests pgTAP : ALERT-01 §7-8, canal « Slack » des alertes (webhook entrant par espace, droits, adresse
-- jamais relue par l'app, hôte hooks.slack.com seulement, message d'une ligne sans donnée de visiteur,
-- file d'envoi pour webhooks-dispatch, test immédiat réservé aux admins, trois essais au plus).
-- Données fictives : aucune adresse réelle ; la base ne fait aucun appel réseau.
begin;
set search_path = public, extensions;
select plan(31);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000051ac01', 'olga-sl@acme.example'),
  ('00000000-0000-0000-0000-00000051ac02', 'camille-sl@acme.example'),
  ('00000000-0000-0000-0000-00000051ac03', 'vera-sl@autre.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-00000051ac01');
create temp table ctx as select (public.create_workspace('Acme & <Slack>')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-00000051acd1', (select ws from ctx), 'Créer un <rendez-vous>', auth.uid());
select pg_temp.login('00000000-0000-0000-0000-00000051ac03');
create temp table other as select (public.create_workspace('Autre espace')).id as ws;
grant all on other to authenticated;
reset role;
update public.workspaces set plan_code = 'enterprise' where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-00000051ac02', 'editor');

-- ===== Droits et contrôle de l'adresse =====
select pg_temp.login('00000000-0000-0000-0000-00000051ac02');
select throws_ok($$ select public.slack_webhook_set((select ws from ctx), 'https://hooks.slack.com/services/T000FICTIF/B000FICTIF/cle-factice') $$,
  '42501', null, 'éditrice : ne peut pas enregistrer le webhook');
select is(public.slack_webhook_connected((select ws from ctx)), false, 'membre : état lisible, non connecté');
select throws_ok($$ select public.slack_webhook_connected((select ws from other)) $$, '42501', null,
  'autre espace : état illisible');
select throws_ok($$ select * from private.slack_webhooks $$, '42501', null, 'adresse du webhook : jamais lisible par l''app');
select throws_ok($$ select public.slack_claim_due(10) $$, '42501', null, 'file d''envoi : service_role seulement');
select throws_ok($$ select public.slack_claim_test(1, auth.uid()) $$, '42501', null, 'envoi immédiat : service_role seulement');
select pg_temp.login('00000000-0000-0000-0000-00000051ac01');
select throws_ok($$ select public.slack_webhook_set((select ws from ctx), 'http://hooks.slack.com/services/T000FICTIF/B000FICTIF/cle-factice') $$,
  '22023', 'SLACK_URL', 'http refusé');
select throws_ok($$ select public.slack_webhook_set((select ws from ctx), 'https://hooks.slack.com.evil.example/services/T000FICTIF/B000FICTIF/cle-factice') $$,
  '22023', 'SLACK_URL', 'autre hôte refusé');
select throws_ok($$ select public.slack_webhook_test((select ws from other)) $$, '42501', null, 'test : admins de l''espace seulement');
select is(public.slack_webhook_test((select ws from ctx)), null, 'test sans webhook : rien n''est rangé');
select lives_ok($$ select public.slack_webhook_set((select ws from ctx), 'https://hooks.slack.com/services/T000FICTIF/B000FICTIF/cle-factice') $$,
  'propriétaire : webhook enregistré');
select is(public.slack_webhook_connected((select ws from ctx)), true, 'état : connecté');

-- ===== Règle du canal =====
select lives_ok($$ insert into public.alerts (id, workspace_id, trigger, demo_id, channels) values
  ('00000000-0000-0000-0000-00000051aca1', (select ws from ctx), 'lead', '00000000-0000-0000-0000-00000051acd1',
   array['app', 'slack']) $$, 'alerte avec « Slack »');
select lives_ok($$ insert into public.alerts (id, workspace_id, trigger, threshold, channels) values
  ('00000000-0000-0000-0000-00000051aca2', (select ws from ctx), 'completion_below', 40, array['slack']) $$,
  '« Slack » seul accepté (pas d''obligation « Dans l''app »)');
reset role;

-- ===== Déclenchement : le message est rangé, la base n'appelle rien =====
select private.alert_fire((select a from public.alerts a where a.id = '00000000-0000-0000-0000-00000051aca1'),
                          '{"trigger": "lead", "count": 2}'::jsonb);
select private.alert_fire((select a from public.alerts a where a.id = '00000000-0000-0000-0000-00000051aca2'),
                          '{"trigger": "completion_below", "value": 32, "threshold": 40}'::jsonb);
select is((select count(*)::int from public.notifications where alert_id = '00000000-0000-0000-0000-00000051aca2'), 0,
  '« Slack » seul : pas de notification dans l''app');
create temp table q1 as select public.slack_claim_due(10) as r;
select is(jsonb_array_length((select r from q1)), 2, 'deux messages à envoyer');
select is((select r -> 0 from q1) - 'id',
  '{"url": "https://hooks.slack.com/services/T000FICTIF/B000FICTIF/cle-factice", "path": "/#/analytics", "text": "TutoClick · Nouveau lead : 2 sur « Créer un &lt;rendez-vous&gt; »"}'::jsonb,
  'message : déclencheur, nombre, démo (caractères de Slack neutralisés), chemin de la page, webhook de l''espace');
select is((select r -> 1 ->> 'text' from q1),
  'TutoClick · Taux de complétion sous 40 % : 32 % sur « toutes les démos »',
  'alerte à seuil : valeur en %, « toutes les démos »');
select ok(not exists (select 1 from private.slack_outbox where body ~* '@|visitor|https?://'),
  'aucune donnée de visiteur, adresse e-mail ni adresse web dans les textes rangés');
select is(jsonb_array_length(public.slack_claim_due(10)), 0, 'déjà en cours d''envoi : pas rendus deux fois (bail de 2 min)');

-- ===== Résultat : parti, ou nouvel essai, trois au plus =====
select public.slack_record_result((select (r -> 0 ->> 'id')::bigint from q1), true);
select public.slack_record_result((select (r -> 1 ->> 'id')::bigint from q1), false);
select is(jsonb_array_length(public.slack_claim_due(10)), 1, 'échec : le message repart à la tâche suivante, l''autre est parti');
select public.slack_record_result((select (r -> 1 ->> 'id')::bigint from q1), false);
select is(jsonb_array_length(public.slack_claim_due(10)), 1, 'troisième essai');
select public.slack_record_result((select (r -> 1 ->> 'id')::bigint from q1), false);
select is(jsonb_array_length(public.slack_claim_due(10)), 0, 'après trois essais : abandonné');

-- ===== Test de connexion : envoi immédiat, pour un admin de l'espace seulement =====
select pg_temp.login('00000000-0000-0000-0000-00000051ac01');
create temp table t1 as select public.slack_webhook_test((select ws from ctx)) as id;
grant all on t1 to authenticated;
select ok((select id is not null from t1), '« Envoyer un test » : message rangé');
reset role;
select is(public.slack_claim_test((select id from t1), '00000000-0000-0000-0000-00000051ac02'), null,
  'éditrice : le test ne lui est pas rendu');
select is(public.slack_claim_test((select id from t1), '00000000-0000-0000-0000-00000051ac03'), null,
  'admin d''un autre espace : pas rendu non plus');
select is(public.slack_claim_test((select id from t1), '00000000-0000-0000-0000-00000051ac01') - 'id',
  '{"url": "https://hooks.slack.com/services/T000FICTIF/B000FICTIF/cle-factice", "path": null, "text": "TutoClick · Test de connexion réussi pour l''espace « Acme &amp; &lt;Slack&gt; »."}'::jsonb,
  'propriétaire : message de test rendu, sans lien');
insert into private.slack_outbox (workspace_id, kind, body)
  select (select ws from ctx), 'test', 't' from generate_series(1, 4);
select pg_temp.login('00000000-0000-0000-0000-00000051ac01');
select throws_ok($$ select public.slack_webhook_test((select ws from ctx)) $$, '54000', 'SLACK_RATE', 'cinq tests par minute au plus');

-- ===== Retrait =====
select lives_ok($$ select public.slack_webhook_remove((select ws from ctx)) $$, 'propriétaire : webhook retiré');
reset role;
select is((select count(*)::int from private.slack_outbox where sent_at is null), 0, 'retrait : les messages en attente sont retirés');
select private.alert_fire((select a from public.alerts a where a.id = '00000000-0000-0000-0000-00000051aca1'),
                          '{"trigger": "lead", "count": 1}'::jsonb);
select is(jsonb_array_length(public.slack_claim_due(10)), 0, 'webhook retiré : plus rien à envoyer, l''alerte garde son réglage');

select * from finish();
rollback;
