-- Tests pgTAP : planche 4, fenêtre Slack. État du webhook (adresse masquée, jamais la partie secrète) et
-- interrupteur « Alertes analytics » (coupé : les alertes ne partent plus, le test si).
-- Données fictives : aucune adresse réelle ; la base ne fait aucun appel réseau.
begin;
set search_path = public, extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000052ac01', 'olga-se@acme.example'),
  ('00000000-0000-0000-0000-00000052ac02', 'camille-se@acme.example'),
  ('00000000-0000-0000-0000-00000052ac03', 'vera-se@autre.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-00000052ac01');
create temp table ctx as select (public.create_workspace('Acme Slack')).id as ws;
grant all on ctx to authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000052ac03');
create temp table other as select (public.create_workspace('Autre')).id as ws;
grant all on other to authenticated;
reset role;
update public.workspaces set plan_code = 'enterprise' where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-00000052ac02', 'editor');

select pg_temp.login('00000000-0000-0000-0000-00000052ac01');
select is(public.slack_webhook_info((select ws from ctx)), '{"connected": false}'::jsonb, 'non connecté');
select public.slack_webhook_set((select ws from ctx), 'https://hooks.slack.com/services/T000FICTIF/B000FICTIF/cle-factice');
select is(public.slack_webhook_info((select ws from ctx)),
  '{"connected": true, "alerts": true, "masked": "hooks.slack.com/services/T000…/••••"}'::jsonb,
  'connecté : adresse masquée, alertes actives par défaut');
select ok(public.slack_webhook_info((select ws from ctx))::text !~ 'FICTIF|cle-factice',
  'la partie secrète de l''adresse n''est jamais renvoyée');
select throws_ok($$ select public.slack_webhook_info((select ws from other)) $$, '42501', null,
  'autre espace : état illisible');
select pg_temp.login('00000000-0000-0000-0000-00000052ac02');
select is((public.slack_webhook_info((select ws from ctx)) ->> 'connected'), 'true', 'éditrice : état lisible');
select throws_ok($$ select public.slack_webhook_alerts((select ws from ctx), false) $$, '42501', null,
  'éditrice : ne peut pas couper les alertes');
select pg_temp.login('00000000-0000-0000-0000-00000052ac01');
select lives_ok($$ select public.slack_webhook_alerts((select ws from ctx), false) $$, 'propriétaire : alertes coupées');
select is((public.slack_webhook_info((select ws from ctx)) ->> 'alerts'), 'false', 'interrupteur relu');
reset role;
select is(private.slack_enqueue((select ws from ctx), 'alert', 'x', null), null,
  'alertes coupées : aucune alerte rangée');
select ok(private.slack_enqueue((select ws from ctx), 'test', 'x', null) is not null,
  'alertes coupées : le test part toujours');

select * from finish();
rollback;
