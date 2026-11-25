-- Tests pgTAP : temps réel à l'échelle de l'espace (retours du 24/11, 2e série §5). Indicateurs, visiteurs
-- par démo, fil d'activité, filtre par démo, droits (viewer au moins, identité pour editor et plus),
-- accès par dossier, autre espace. Données fictives.
begin;
set search_path = public, extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000327a1', 'editrice-tr@example.com'),
  ('00000000-0000-0000-0000-0000000327a2', 'lecteur-tr@example.com'),
  ('00000000-0000-0000-0000-0000000327a3', 'autre-espace-tr@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000327a3');
create temp table other as select (public.create_workspace('Autre espace')).id as ws;
select pg_temp.login('00000000-0000-0000-0000-0000000327a1');
create temp table ctx as select (public.create_workspace('Temps réel')).id as ws;
grant all on ctx, other to authenticated;
reset role;
update public.workspaces set plan_code = 'enterprise' where id = (select ws from ctx);
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000327a2', 'viewer');
-- Un dossier restreint (l'éditrice y est, pas le lecteur) : une démo dedans, deux à la racine
insert into public.folders (id, workspace_id, name, restricted)
  values ('00000000-0000-0000-0000-0000000327f1', (select ws from ctx), 'RH', true);
insert into public.folder_members (workspace_id, folder_id, user_id)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000327f1', '00000000-0000-0000-0000-0000000327a1');
insert into public.demos (id, workspace_id, folder_id, title) values
  ('00000000-0000-0000-0000-0000000327d1', (select ws from ctx), null, 'Démo CRM'),
  ('00000000-0000-0000-0000-0000000327d2', (select ws from ctx), null, 'Onboarding'),
  ('00000000-0000-0000-0000-0000000327d3', (select ws from ctx), '00000000-0000-0000-0000-0000000327f1', 'Entretiens');
insert into public.steps (demo_id, workspace_id, position)
  select '00000000-0000-0000-0000-0000000327d1', (select ws from ctx), g from generate_series(0, 2) g;
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type, step_index, device, country, occurred_at) values
  -- Démo CRM : deux visiteurs en direct, dont un qui a laissé son adresse
  ((select ws from ctx), '00000000-0000-0000-0000-0000000327d1', 'v-1', 's-1', 'demo_view', 0, 'desktop', 'FR', now() - interval '4 minutes'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000327d1', 'v-1', 's-1', 'step_view', 1, 'desktop', 'FR', now() - interval '1 minute'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000327d1', 'v-2', 's-2', 'demo_view', 0, 'mobile', 'FR', now() - interval '2 minutes'),
  -- Onboarding : une démo terminée il y a 10 min (hors du direct, dans le fil), une vue il y a 20 min
  ((select ws from ctx), '00000000-0000-0000-0000-0000000327d2', 'v-3', 's-3', 'demo_view', 0, 'desktop', 'BE', now() - interval '20 minutes'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000327d2', 'v-3', 's-3', 'demo_complete', 0, 'desktop', 'BE', now() - interval '10 minutes'),
  -- Dossier restreint : un visiteur en direct
  ((select ws from ctx), '00000000-0000-0000-0000-0000000327d3', 'v-4', 's-4', 'demo_view', 0, 'desktop', 'FR', now() - interval '3 minutes'),
  -- Trop ancien pour le fil (plus d'une heure)
  ((select ws from ctx), '00000000-0000-0000-0000-0000000327d2', 'v-5', 's-5', 'demo_view', 0, 'desktop', 'FR', now() - interval '3 hours');
insert into public.leads (workspace_id, demo_id, visitor_id, email, created_at)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000327d1', 'v-1', 'camille@acme.example', now() - interval '90 seconds');

-- ===== Éditrice : tout l'espace =====
select pg_temp.login('00000000-0000-0000-0000-0000000327a1');
create temp table r1 as select public.live_space((select ws from ctx)) as r;
grant all on r1 to authenticated;
select is((select (r -> 'kpis' ->> 'live')::int from r1), 3, 'visiteurs en ce moment : trois, sur deux démos');
select is((select (r -> 'kpis' ->> 'views30')::int from r1), 4, 'vues des 30 dernières minutes');
select is((select (r -> 'kpis' ->> 'endsToday')::int from r1) >= 1, true, 'fins de démo du jour comptées');
select is((select (r -> 'kpis' ->> 'leadsToday')::int from r1) >= 1, true, 'leads du jour comptés');
select is((select r -> 'demos' -> 0 from r1),
  '{"demoId": "00000000-0000-0000-0000-0000000327d1", "live": 2}'::jsonb,
  'par démo : la plus fréquentée d’abord, avec son nombre de visiteurs');
select is((select jsonb_array_length(r -> 'visitors') from r1), 3, 'une ligne par visiteur et par démo');
select is((select v ->> 'identity' from r1, jsonb_array_elements(r -> 'visitors') v
            where v ->> 'demoId' = '00000000-0000-0000-0000-0000000327d1' and (v ->> 'stepIndex')::int = 1),
  'camille@acme.example', 'éditrice : le visiteur qui a laissé son adresse est nommé');
select is((select (v ->> 'stepsTotal')::int from r1, jsonb_array_elements(r -> 'visitors') v
            where v ->> 'demoId' = '00000000-0000-0000-0000-0000000327d1' limit 1), 3,
  'progression : nombre d’étapes de la démo du visiteur');
select is((select count(*)::int from r1, jsonb_array_elements(r -> 'visitors') v where v ->> 'key' ~ '^v-'), 0,
  'la clé d’un visiteur n’est jamais son identifiant');
select is((select string_agg(f ->> 'kind', ',' order by f ->> 'at' desc) from r1, jsonb_array_elements(r -> 'feed') f),
  'lead,start,start,start,end,start', 'fil d’activité : débuts, fin et lead de la dernière heure, du plus récent au plus ancien');
select is((select count(*)::int from r1, jsonb_array_elements(r -> 'feed') f where f ? 'identity' or f ? 'email'), 0,
  'fil d’activité : aucune identité');

-- Filtre par démo
create temp table r2 as select public.live_space((select ws from ctx), '00000000-0000-0000-0000-0000000327d2') as r;
grant all on r2 to authenticated;
select is((select (r -> 'kpis' ->> 'live')::int from r2), 0, 'filtre par démo : personne en direct sur Onboarding');
select is((select jsonb_array_length(r -> 'feed') from r2), 2, 'filtre par démo : son fil seulement');

-- ===== Lecteur : pas d'identité, pas de dossier restreint =====
select pg_temp.login('00000000-0000-0000-0000-0000000327a2');
create temp table r3 as select public.live_space((select ws from ctx)) as r;
grant all on r3 to authenticated;
select is((select count(*)::int from r3, jsonb_array_elements(r -> 'visitors') v where v ->> 'identity' is not null), 0,
  'lecteur : aucune identité de visiteur');
select is((select (r -> 'kpis' ->> 'live')::int from r3), 2, 'lecteur : la démo du dossier restreint n’est pas comptée');
select is((select count(*)::int from r3, jsonb_array_elements(r -> 'feed') f
            where f ->> 'demoId' = '00000000-0000-0000-0000-0000000327d3'), 0,
  'lecteur : rien du dossier restreint dans le fil');

-- ===== Autre espace, compte anonyme =====
select pg_temp.login('00000000-0000-0000-0000-0000000327a3');
select throws_ok($$ select public.live_space((select ws from ctx)) $$, '42501', null, 'autre espace : accès refusé');
reset role;
set local role anon;
select throws_ok($$ select public.live_space((select ws from ctx)) $$, '42501', null, 'sans compte : fonction hors de portée');
reset role;

select * from finish();
rollback;
