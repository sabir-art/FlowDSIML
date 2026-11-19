-- Tests pgTAP : L19-01 (reprise UX), temps réel : « Apprenant identifié » sans identité pour un lecteur,
-- nom et structure pour une éditrice. Données fictives.
begin;
set search_path = public, extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000001e1', 'editrice-live@example.com'),
  ('00000000-0000-0000-0000-0000000001e2', 'lecteur-live@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000001e1');
create temp table ctx as select (public.create_workspace('Temps réel')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000001d1', (select ws from ctx), 'Démo CRM', auth.uid());
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000001e2', 'viewer');
insert into public.structures (id, workspace_id, name)
  values ('00000000-0000-0000-0000-0000000001f1', (select ws from ctx), 'Équipe Nord');
insert into public.learners (id, workspace_id, email, full_name, structure_id, source)
  values ('00000000-0000-0000-0000-0000000001a1', (select ws from ctx), 'lea.martin@acme.example', 'Léa Martin',
          '00000000-0000-0000-0000-0000000001f1', 'lead');
insert into public.learner_visitors (workspace_id, visitor_id, learner_id)
  values ((select ws from ctx), 'visiteur-apprenant-1', '00000000-0000-0000-0000-0000000001a1');
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type, step_index, device, country, occurred_at)
values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000001d1', 'visiteur-apprenant-1', 's-1', 'step_view', 0, 'desktop', 'FR', now() - interval '1 minute'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000001d1', 'visiteur-anonyme-2', 's-2', 'step_view', 0, 'mobile', 'FR', now() - interval '2 minutes');

-- Lecteur : apprenant signalé, sans nom ni structure
select pg_temp.login('00000000-0000-0000-0000-0000000001e2');
create temp table lv as select public.live_demo('00000000-0000-0000-0000-0000000001d1') as r;
select is((select count(*)::int from lv, jsonb_array_elements(r -> 'visitors') v where (v ->> 'learner')::boolean), 1,
  'lecteur : un visiteur signalé comme apprenant');
select is((select count(*)::int from lv, jsonb_array_elements(r -> 'visitors') v where v ->> 'identity' is not null), 0,
  'lecteur : aucune identité');
select is((select count(*)::int from lv, jsonb_array_elements(r -> 'visitors') v where v ->> 'structure' is not null), 0,
  'lecteur : aucune structure');
select is((select count(*)::int from lv, jsonb_array_elements(r -> 'visitors') v where not (v ->> 'learner')::boolean), 1,
  'visiteur anonyme : learner = false');

-- Éditrice : nom et structure
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000001e1');
select is((select v ->> 'identity' from jsonb_array_elements(public.live_demo('00000000-0000-0000-0000-0000000001d1') -> 'visitors') v
           where (v ->> 'learner')::boolean), 'Léa Martin', 'éditrice : nom de l’apprenante');
select is((select v ->> 'structure' from jsonb_array_elements(public.live_demo('00000000-0000-0000-0000-0000000001d1') -> 'visitors') v
           where (v ->> 'learner')::boolean), 'Équipe Nord', 'éditrice : structure de l’apprenante');

select * from finish();
rollback;
