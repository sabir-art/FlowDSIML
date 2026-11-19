-- Tests pgTAP : L26-06 à L26-08, visiteurs récurrents (numéro de visite, écart de 30 min ou 24 h,
-- apprenant identifié, mesure désactivée, segment « returning », droits).
begin;
set search_path = public, extensions;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000029a1', 'admin-rec@example.com'),
  ('00000000-0000-0000-0000-0000000029a2', 'lecteur-rec@example.com'),
  ('00000000-0000-0000-0000-0000000029a3', 'editeur-rec@example.com'),
  ('00000000-0000-0000-0000-0000000029a4', 'externe-rec@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000029a1');
create temp table ctx as select (public.create_workspace('Récurrents')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-0000000029d1', (select ws from ctx), 'Créer un rapport', auth.uid()),
  ('00000000-0000-0000-0000-0000000029d2', (select ws from ctx), 'Importer des données', auth.uid());
reset role;
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000029a2', 'viewer'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000029a3', 'editor');

select is((select visit_measure from public.workspaces where id = (select ws from ctx)), true, 'mesure activée par défaut');
select is((select visit_gap_minutes from public.workspaces where id = (select ws from ctx)), 30, 'écart de 30 minutes par défaut');

-- v-a : 3 sessions (2 à 10 min d'écart = même visite, puis une 3e 2 h plus tard) → visites 1, 1, 2
-- v-b : 1 session → nouveau ; v-c : 2 sessions à 1 h d'écart, sur la démo 2
create function pg_temp.ev(v text, s text, d text, at timestamptz) returns void language sql as $$
  insert into public.events (workspace_id, demo_id, visitor_id, session_id, type, occurred_at)
  values ((select ws from ctx), d::uuid, v, s, 'demo_view', at),
         ((select ws from ctx), d::uuid, v, s, 'step_view', at + interval '2 minutes');
$$;
select pg_temp.ev('vis-a-0001', 'ses-a-0001', '00000000-0000-0000-0000-0000000029d1', now() - interval '5 hours');
select pg_temp.ev('vis-a-0001', 'ses-a-0002', '00000000-0000-0000-0000-0000000029d1', now() - interval '5 hours' + interval '10 minutes');
select pg_temp.ev('vis-a-0001', 'ses-a-0003', '00000000-0000-0000-0000-0000000029d1', now() - interval '2 hours');
select pg_temp.ev('vis-b-0001', 'ses-b-0001', '00000000-0000-0000-0000-0000000029d1', now() - interval '3 hours');
select pg_temp.ev('vis-c-0001', 'ses-c-0001', '00000000-0000-0000-0000-0000000029d2', now() - interval '4 hours');
select pg_temp.ev('vis-c-0001', 'ses-c-0002', '00000000-0000-0000-0000-0000000029d2', now() - interval '2 minutes');

-- ===== Numéros de visite =====
select pg_temp.login('00000000-0000-0000-0000-0000000029a2');
create temp table sv as select public.session_visits((select ws from ctx),
  array['ses-a-0001', 'ses-a-0002', 'ses-a-0003', 'ses-b-0001', 'ses-c-0002']) as r;
select is((select r from sv), '{"ses-a-0001": 1, "ses-a-0002": 1, "ses-a-0003": 2, "ses-b-0001": 1, "ses-c-0002": 2}'::jsonb,
  'lecteur : même visite sous 30 min, nouvelle visite au-delà');
create temp table wr as select public.workspace_returning((select ws from ctx), now() - interval '1 day') as r;
select is((select (r ->> 'total')::int from wr), 3, 'trois visiteurs sur la période');
select is((select (r ->> 'visitors')::int from wr), 2, 'deux récurrents');
select is((select (r ->> 'avgVisits')::numeric from wr), 2.0, 'deux visites en moyenne par récurrent');
select is((select jsonb_array_length(r -> 'topDemos') from wr), 2, 'démos les plus revues');
select ok((select r::text from wr) !~ 'vis-a', 'agrégats sans identifiant');
select is((public.live_visits('00000000-0000-0000-0000-0000000029d2') ->> left(md5('vis-c-0001'), 10))::int, 2,
  'temps réel : visite n° 2');

-- ===== Écart de 24 h =====
reset role;
update public.workspaces set visit_gap_minutes = 1440 where id = (select ws from ctx);
select pg_temp.login('00000000-0000-0000-0000-0000000029a2');
select is((public.session_visits((select ws from ctx), array['ses-a-0003']) ->> 'ses-a-0003')::int, 1,
  '24 h : la session de l’après-midi est la même visite');
reset role;
update public.workspaces set visit_gap_minutes = 30 where id = (select ws from ctx);
select throws_ok($$ update public.workspaces set visit_gap_minutes = 60 where id = (select ws from ctx) $$,
  '23514', null, 'écart : 30 min ou 24 h seulement');

-- ===== Apprenant identifié : ses visiteurs ne font qu'un =====
insert into public.learners (id, workspace_id, email, full_name, source)
  values ('00000000-0000-0000-0000-0000000029e1', (select ws from ctx), 'lea@globex.example', 'Léa Fictive', 'lead');
insert into public.learner_visitors (workspace_id, visitor_id, learner_id) values
  ((select ws from ctx), 'vis-b-0001', '00000000-0000-0000-0000-0000000029e1'),
  ((select ws from ctx), 'vis-d-0001', '00000000-0000-0000-0000-0000000029e1');
select pg_temp.ev('vis-d-0001', 'ses-d-0001', '00000000-0000-0000-0000-0000000029d1', now() - interval '1 hour');
select pg_temp.login('00000000-0000-0000-0000-0000000029a2');
select is((public.session_visits((select ws from ctx), array['ses-d-0001']) ->> 'ses-d-0001')::int, 2,
  'apprenant : autre navigateur, visite n° 2');

-- ===== Segment « returning » =====
select pg_temp.login('00000000-0000-0000-0000-0000000029a3');
select lives_ok($$ insert into public.segments (workspace_id, name, conditions) values
  ((select ws from ctx), 'Récurrents', '[{"field":"returning","op":"is","value":true}]') $$, 'segment « returning » accepté');
select throws_ok($$ insert into public.segments (workspace_id, name, conditions) values
  ((select ws from ctx), 'Faux', '[{"field":"returning","op":"is_not","value":true}]') $$, '23514', null,
  'returning : op is seulement');
select is((public.segment_count((select ws from ctx), '{"match":"all","conditions":[{"field":"returning","op":"is","value":true}]}',
  now() - interval '1 day') ->> 'visitors')::int, 4, 'segment : visiteurs récurrents (dont les deux de l’apprenante)');

-- ===== Droits =====
update public.workspaces set visit_measure = false where id = (select ws from ctx);
reset role;
select is((select visit_measure from public.workspaces where id = (select ws from ctx)), true,
  'éditeur : réglage sans effet (RLS admin)');
select pg_temp.login('00000000-0000-0000-0000-0000000029a4');
select throws_ok($$ select public.workspace_returning((select ws from ctx), now() - interval '1 day') $$,
  '42501', null, 'hors espace : refusé');

-- ===== Mesure désactivée =====
select pg_temp.login('00000000-0000-0000-0000-0000000029a1');
update public.workspaces set visit_measure = false where id = (select ws from ctx);
reset role;
select pg_temp.ev('vis-a-0001', 'ses-a-0004', '00000000-0000-0000-0000-0000000029d1', now() - interval '1 minute');
select is((select distinct visitor_id from public.events where session_id = 'ses-a-0004'), 's:ses-a-0004',
  'désactivée : identifiant reçu ignoré (identifiant de session)');
select pg_temp.login('00000000-0000-0000-0000-0000000029a2');
select is(public.workspace_returning((select ws from ctx), now() - interval '1 day') ->> 'enabled', 'false',
  'désactivée : « Mesure désactivée »');
select is(public.session_visits((select ws from ctx), array['ses-a-0003']), '{}'::jsonb,
  'désactivée : plus de numéro de visite');

select * from finish();
rollback;
