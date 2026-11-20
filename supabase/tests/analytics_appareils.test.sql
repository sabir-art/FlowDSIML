-- Tests pgTAP : L48-D workspace_analytics, vues par appareil et par navigateur.
begin;
set search_path = public, extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'admin@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
create temp table ctx as select (public.create_workspace('Appareils')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-00000000d0d1', (select ws from ctx), 'Module A', auth.uid());

reset role;
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type, device, browser, occurred_at) values
  ((select ws from ctx), '00000000-0000-0000-0000-00000000d0d1', 'v1', 's1', 'demo_view', 'desktop', 'chrome', now() - interval '1 day'),
  ((select ws from ctx), '00000000-0000-0000-0000-00000000d0d1', 'v2', 's2', 'demo_view', 'mobile', 'safari', now() - interval '1 day'),
  ((select ws from ctx), '00000000-0000-0000-0000-00000000d0d1', 'v3', 's3', 'demo_view', 'mobile', 'chrome', now() - interval '1 day'),
  ((select ws from ctx), '00000000-0000-0000-0000-00000000d0d1', 'v3', 's3', 'demo_complete', 'mobile', 'chrome', now() - interval '1 day'),
  ((select ws from ctx), '00000000-0000-0000-0000-00000000d0d1', 'v4', 's4', 'demo_view', null, null, now() - interval '1 day');

select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
create temp table a as select public.workspace_analytics((select ws from ctx), now() - interval '7 days') as j;
select is(((select j from a)->'devices'->>'mobile')::int, 2, 'vues mobiles (demo_view seulement)');
select is(((select j from a)->'devices'->>'desktop')::int, 1, 'vues ordinateur');
select is(((select j from a)->'devices'->>'unknown')::int, 1, 'appareil inconnu compté à part');
select is(((select j from a)->'browsers'->>'chrome')::int, 2, 'vues Chrome');
select is((select (j->>'views')::int from a), 4, 'nombre de vues inchangé');

select * from finish();
rollback;
