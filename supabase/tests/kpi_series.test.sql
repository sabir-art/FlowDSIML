-- Tests pgTAP : L47 analytics_series (séries quotidiennes, détail par démo et par source).
begin;
set search_path = public, extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'admin@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'autre@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
create temp table ctx as select (public.create_workspace('Séries')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-00000000b0d1', (select ws from ctx), 'Module A', auth.uid()),
  ('00000000-0000-0000-0000-00000000b0d2', (select ws from ctx), 'Module B', auth.uid());

reset role;
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type, embed_origin, occurred_at) values
  ((select ws from ctx), '00000000-0000-0000-0000-00000000b0d1', 'v1', 's1', 'demo_view', null, now() - interval '2 days'),
  ((select ws from ctx), '00000000-0000-0000-0000-00000000b0d1', 'v1', 's1', 'demo_complete', null, now() - interval '2 days' + interval '1 minute'),
  ((select ws from ctx), '00000000-0000-0000-0000-00000000b0d1', 'v1', 's1', 'cta_click', null, now() - interval '2 days' + interval '1 minute'),
  ((select ws from ctx), '00000000-0000-0000-0000-00000000b0d1', 'v2', 's2', 'demo_view', 'site.example', now() - interval '1 day'),
  ((select ws from ctx), '00000000-0000-0000-0000-00000000b0d2', 'v3', 's3', 'demo_view', null, now() - interval '1 day');
insert into public.leads (workspace_id, demo_id, visitor_id, email, created_at) values
  ((select ws from ctx), '00000000-0000-0000-0000-00000000b0d1', 'v2', 'lea@example.com', now() - interval '1 day' + interval '1 minute');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
create temp table a as select public.analytics_series((select ws from ctx), now() - interval '30 days') as j;
select is(jsonb_array_length((select j from a)->'daily'), 2, 'une ligne par jour actif');
select is((select sum((d->>'views')::int) from jsonb_array_elements((select j from a)->'daily') d)::int, 3, 'vues par jour');
select is((select sum((d->>'leads')::int) from jsonb_array_elements((select j from a)->'daily') d)::int, 1, 'leads par jour');
select is((select sum((d->>'cta')::int) from jsonb_array_elements((select j from a)->'daily') d)::int, 1, 'clics par jour');
select is((select (d->>'visitors')::int from jsonb_array_elements((select j from a)->'byDemo') d
  where d->>'demo_id' = '00000000-0000-0000-0000-00000000b0d1'), 2, 'visiteurs par démo');
select is((select (d->>'completions')::int from jsonb_array_elements((select j from a)->'byDemo') d
  where d->>'demo_id' = '00000000-0000-0000-0000-00000000b0d1'), 1, 'démos terminées par démo');
select is((select (d->>'leads')::int from jsonb_array_elements((select j from a)->'bySource') d
  where d->>'source' = 'embed'), 1, 'lead rattaché à la source de la dernière vue du visiteur');
select is((public.analytics_series((select ws from ctx), now() - interval '30 days', now(),
  '00000000-0000-0000-0000-00000000b0d2')->'byDemo'->0->>'views')::int, 1, 'filtre par démo');
select is((select sum((d->>'views')::int) from jsonb_array_elements(
  public.analytics_series((select ws from ctx), now() - interval '30 days', now(), null, 'embed')->'daily') d)::int,
  1, 'filtre par source');
select ok(position('lea@example.com' in (select j from a)::text) = 0 and position('"v1"' in (select j from a)::text) = 0,
  'aucune donnée personnelle (ni e-mail ni visiteur)');

select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
select throws_ok($$ select public.analytics_series((select ws from ctx), now() - interval '30 days') $$,
  '42501', null, 'hors de l''espace : accès refusé');
reset role;
set local role anon;
select throws_ok($$ select public.analytics_series('00000000-0000-0000-0000-000000000000', now()) $$,
  '42501', null, 'anonyme : pas d''exécution');

select * from finish();
rollback;
