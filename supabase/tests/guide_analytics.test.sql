-- Tests pgTAP : A8, statistiques du guide du Sandbox dans analytics_series (par démo, par session).
begin;
set search_path = public, extensions;
select plan(6);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000099c1', 'stats@acme.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000099c1');
create temp table ctx as select (public.create_workspace('Guide stats')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by, kind) values
  ('00000000-0000-0000-0000-0000000099d5', (select ws from ctx), 'Rendez-vous', auth.uid(), 'sandbox');

reset role;
-- 4 sessions : terminé ; quitté ; quitté puis repris et terminé ; vu sans guide. Une 5e a vu le guide sans le finir.
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type, occurred_at)
select (select ws from ctx), '00000000-0000-0000-0000-0000000099d5', v, s, t, now() - interval '1 day'
from (values
  ('v1', 's1', 'demo_view'), ('v1', 's1', 'guide_step'), ('v1', 's1', 'guide_done'),
  ('v2', 's2', 'demo_view'), ('v2', 's2', 'guide_step'), ('v2', 's2', 'guide_skip'),
  ('v3', 's3', 'demo_view'), ('v3', 's3', 'guide_step'), ('v3', 's3', 'guide_skip'), ('v3', 's3', 'guide_done'),
  ('v4', 's4', 'demo_view'),
  ('v5', 's5', 'demo_view'), ('v5', 's5', 'guide_step')) x(v, s, t);

select pg_temp.login('00000000-0000-0000-0000-0000000099c1');
create temp table a as select public.analytics_series((select ws from ctx), now() - interval '30 days') as j;
create temp table d as select x as r from jsonb_array_elements((select j from a) -> 'byDemo') x
  where x ->> 'demo_id' = '00000000-0000-0000-0000-0000000099d5';
select is((select (r ->> 'guideStarted')::int from d), 4, 'sessions qui ont vu le guide');
select is((select (r ->> 'guideDone')::int from d), 2, 'sessions qui l’ont terminé');
select is((select (r ->> 'guideSkipped')::int from d), 1, 'quitté sans le terminer (repris puis terminé : terminé)');
select is((select (r ->> 'views')::int from d), 5, 'les vues ne comptent pas les événements du guide');
select is((select sum((x ->> 'views')::int) from jsonb_array_elements((select j from a) -> 'daily') x)::int, 5,
  'séries quotidiennes inchangées');
select is(jsonb_array_length((select j from a) -> 'daily'), 1, 'aucun jour ajouté par les événements du guide');

select * from finish();
rollback;
