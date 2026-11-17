-- Tests pgTAP : analytics du workspace (ANA-01) — workspace_analytics, workspace_sessions.
begin;
set search_path = public, extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'autre@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
create temp table ctx as select (public.create_workspace('Analytics')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-00000000a0d1', (select ws from ctx), 'Module A', auth.uid()),
  ('00000000-0000-0000-0000-00000000a0d2', (select ws from ctx), 'Module B', auth.uid());
insert into public.steps (demo_id, workspace_id, position, kind, title) values
  ('00000000-0000-0000-0000-00000000a0d1', (select ws from ctx), 0, 'text', 'Un'),
  ('00000000-0000-0000-0000-00000000a0d1', (select ws from ctx), 1, 'text', 'Deux');

reset role;
-- s1 : vue directe + étapes + fin + CTA ; s2 : vue via intégration ; s3 : autre démo
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type, step_index, embed_origin, occurred_at) values
  ((select ws from ctx), '00000000-0000-0000-0000-00000000a0d1', 'v1', 's1', 'demo_view', null, null, now() - interval '2 days'),
  ((select ws from ctx), '00000000-0000-0000-0000-00000000a0d1', 'v1', 's1', 'step_view', 0, null, now() - interval '2 days'),
  ((select ws from ctx), '00000000-0000-0000-0000-00000000a0d1', 'v1', 's1', 'step_view', 1, null, now() - interval '2 days' + interval '90 seconds'),
  ((select ws from ctx), '00000000-0000-0000-0000-00000000a0d1', 'v1', 's1', 'demo_complete', null, null, now() - interval '2 days' + interval '2 minutes'),
  ((select ws from ctx), '00000000-0000-0000-0000-00000000a0d1', 'v1', 's1', 'cta_click', null, null, now() - interval '2 days' + interval '2 minutes'),
  ((select ws from ctx), '00000000-0000-0000-0000-00000000a0d1', 'v2', 's2', 'demo_view', null, 'site.example', now() - interval '1 day'),
  ((select ws from ctx), '00000000-0000-0000-0000-00000000a0d2', 'v3', 's3', 'demo_view', null, null, now() - interval '1 day');
insert into public.leads (workspace_id, demo_id, visitor_id, email, fields) values
  ((select ws from ctx), '00000000-0000-0000-0000-00000000a0d1', 'v1', 'lea@example.com', '{"company":"Globex"}');

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
create temp table a as select public.workspace_analytics((select ws from ctx), now() - interval '30 days') as j;
select is(((select j from a)->>'views')::int, 3, 'vues du workspace');
select is(((select j from a)->>'visitors')::int, 3, 'visiteurs uniques');
select is(((select j from a)->>'completions')::int, 1, 'démos terminées');
select is(((select j from a)->>'ctaClicks')::int, 1, 'clics sur le CTA');
select is(((select j from a)->>'leads')::int, 1, 'leads');
select is(((select j from a)->'sources'->>'embed')::int, 1, 'source intégration');
select is((public.workspace_analytics((select ws from ctx), now() - interval '30 days', now(),
  '00000000-0000-0000-0000-00000000a0d1')->>'views')::int, 2, 'filtre par démo');
select is((public.workspace_analytics((select ws from ctx), now() - interval '30 days', now(), null, 'embed')->>'views')::int,
  1, 'filtre par source');

create temp table s as select public.workspace_sessions((select ws from ctx), now() - interval '30 days') as j;
select is(((select j from s)->>'total')::int, 3, 'trois sessions');
select is((select r->>'lead_email' from jsonb_array_elements((select j from s)->'rows') r where r->>'session_id' = 's1'),
  'lea@example.com', 'session reliée au lead du visiteur');
select is((select (r->>'duration_s')::int from jsonb_array_elements((select j from s)->'rows') r where r->>'session_id' = 's1'),
  120, 'durée de session');

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select throws_ok(
  format('select public.workspace_analytics(%L::uuid, now() - interval ''30 days'')', (select ws from ctx)),
  '42501', null, 'non-membre : accès refusé');

select * from finish();
rollback;
