-- Tests pgTAP : L19 partie 3 (alertes : règles, droits, déclenchement, regroupement, résumés, webhook).
begin;
set search_path = public, extensions;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'editrice@example.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'lecteur@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000e1');
create temp table ctx as select (public.create_workspace('Alertes')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-00000000ee01', (select ws from ctx), 'Accueil', auth.uid());
reset role;
insert into public.members (workspace_id, user_id, role) values ((select ws from ctx), '00000000-0000-0000-0000-0000000000e2', 'viewer');
create temp table other as select gen_random_uuid() as id;
insert into public.workspaces (id, name, slug) values ((select id from other), 'Autre', 'autre-alertes');
insert into public.demos (id, workspace_id, title) values ('00000000-0000-0000-0000-00000000ee02', (select id from other), 'Ailleurs');

-- ===== Règles =====
select pg_temp.login('00000000-0000-0000-0000-0000000000e1');
select lives_ok($$ insert into public.alerts (id, workspace_id, trigger, demo_id, channels, created_by) values
  ('00000000-0000-0000-0000-00000000e901', (select ws from ctx), 'lead', '00000000-0000-0000-0000-00000000ee01',
   array['app', 'webhook'], '00000000-0000-0000-0000-0000000000e2') $$, 'éditrice : alerte « nouveau lead »');
select is((select created_by from public.alerts), '00000000-0000-0000-0000-0000000000e1'::uuid, 'destinataire : toujours la créatrice');
select throws_ok($$ insert into public.alerts (workspace_id, trigger) values ((select ws from ctx), 'completion_below') $$,
  '23514', null, 'seuil obligatoire pour la complétion');
select throws_ok($$ insert into public.alerts (workspace_id, trigger, threshold) values ((select ws from ctx), 'lead', 5) $$,
  '23514', null, 'pas de seuil pour un nouveau lead');
select throws_ok($$ insert into public.alerts (workspace_id, trigger) values ((select ws from ctx), 'structure_below_goal') $$,
  '23514', null, 'parcours obligatoire pour une structure');
select throws_ok($$ insert into public.alerts (workspace_id, trigger, channels) values ((select ws from ctx), 'cta', array['email']) $$,
  '23514', null, 'canal e-mail refusé (Bientôt)');
select throws_ok($$ insert into public.alerts (workspace_id, trigger, demo_id) values ((select ws from ctx), 'cta', '00000000-0000-0000-0000-00000000ee02') $$,
  '23514', 'ALERT_SCOPE', 'démo d''un autre workspace refusée');
select throws_ok($$ update public.alerts set pending = 99 $$, '42501', null, 'état interne non modifiable');
select pg_temp.login('00000000-0000-0000-0000-0000000000e2');
select is((select count(*)::int from public.alerts), 1, 'lecteur : alertes lisibles');
select throws_ok($$ insert into public.alerts (workspace_id, trigger) values ((select ws from ctx), 'cta') $$, '42501', null,
  'lecteur : création refusée');

-- ===== Déclenchement immédiat et regroupement =====
reset role;
insert into public.webhooks (workspace_id, url, events) values ((select ws from ctx), 'https://hooks.acme.example/tc', array['alert.triggered']);
insert into public.leads (workspace_id, demo_id, visitor_id, email, consent)
select (select ws from ctx), '00000000-0000-0000-0000-00000000ee01', 'v-lead-' || i, 'p' || i || '@acme.example', true
from generate_series(1, 3) i;
update public.alerts set checked_at = now() - interval '1 minute';
select is(public.alerts_tick(), 1, 'nouveaux leads : 1 alerte');
select is((select (data ->> 'count')::int from public.notifications where kind = 'alert'), 3, '« 3 nouveaux leads » regroupés');
select is((select count(*)::int from public.webhook_deliveries where event_type = 'alert.triggered'), 1, 'webhook alert.triggered');
select ok((select payload::text not like '%acme.example%' from public.webhook_deliveries where event_type = 'alert.triggered'),
  'webhook : aucune adresse e-mail');
insert into public.leads (workspace_id, demo_id, visitor_id, email, consent, created_at)
values ((select ws from ctx), '00000000-0000-0000-0000-00000000ee01', 'v-lead-9', 'p9@acme.example', true, clock_timestamp());
select is(public.alerts_tick(), 0, 'moins de 10 min après : rien (anti-bruit)');
update public.alerts set last_fired_at = now() - interval '11 minutes';
select is(public.alerts_tick(), 1, 'après 10 min : alerte suivante');
select is((select array_agg((data ->> 'count')::int order by (data ->> 'count')::int) from public.notifications where kind = 'alert'),
  array[1, 3], 'la suivante compte le lead en attente');

-- ===== Alerte à seuil, résumé quotidien =====
insert into public.alerts (workspace_id, trigger, threshold, frequency, created_by, created_at) values
  ((select ws from ctx), 'views_above', 2, 'daily', '00000000-0000-0000-0000-0000000000e1', now() - interval '2 days');
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type)
select (select ws from ctx), '00000000-0000-0000-0000-00000000ee01', 'v-view-' || i, 's-view-' || i, 'demo_view' from generate_series(1, 3) i;
select is(public.alerts_tick(), 1, 'résumé quotidien dû : vues au-dessus du seuil');
select is(public.alerts_tick(), 0, 'résumé déjà envoyé : rien avant le prochain 9 h');
-- Créatrice retirée du workspace : plus d'évaluation
delete from public.members where user_id = '00000000-0000-0000-0000-0000000000e1' and workspace_id = (select ws from ctx);
update public.alerts set last_fired_at = null, digest_at = null;
select is(public.alerts_tick(), 0, 'créatrice partie : alertes ignorées');

select * from finish();
rollback;
