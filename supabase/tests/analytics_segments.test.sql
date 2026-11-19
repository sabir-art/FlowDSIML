-- Tests pgTAP : L19 partie 2 (segments, analytics filtrées par segment, temps réel d'une démo).
begin;
set search_path = public, extensions;
select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'editrice@example.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'lecteur@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
create temp table ctx as select (public.create_workspace('Segments')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-00000000dd01', (select ws from ctx), 'Accueil', auth.uid());
insert into public.steps (id, demo_id, workspace_id, position, kind, title) values
  ('00000000-0000-0000-0000-00000000d501', '00000000-0000-0000-0000-00000000dd01', (select ws from ctx), 0, 'text', 'Bienvenue'),
  ('00000000-0000-0000-0000-00000000d502', '00000000-0000-0000-0000-00000000dd01', (select ws from ctx), 1, 'text', 'Tableau de bord');
reset role;
insert into public.members (workspace_id, user_id, role) values ((select ws from ctx), '00000000-0000-0000-0000-0000000000d2', 'viewer');

-- 6 visiteurs mobiles (dont 1 lead, 2 ayant terminé), 3 visiteurs sur ordinateur ; v-m-1 et v-d-1 actifs maintenant
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type, step_id, step_index, device, country, occurred_at)
select (select ws from ctx), '00000000-0000-0000-0000-00000000dd01', 'v-m-' || i, 's-m-' || i, t, '00000000-0000-0000-0000-00000000d502', 1,
       'mobile', 'FR', case when i = 1 then now() - interval '1 minute' else now() - interval '2 hours' end
from generate_series(1, 6) i, unnest(array['demo_view', 'step_view']) t;
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type, device, occurred_at)
select (select ws from ctx), '00000000-0000-0000-0000-00000000dd01', 'v-m-' || i, 's-m-' || i, 'demo_complete', 'mobile', now() - interval '2 hours'
from generate_series(1, 2) i;
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type, device, country, occurred_at)
select (select ws from ctx), '00000000-0000-0000-0000-00000000dd01', 'v-d-' || i, 's-d-' || i, 'demo_view', 'desktop', 'BE',
       case when i = 1 then now() - interval '30 seconds' else now() - interval '3 hours' end
from generate_series(1, 3) i;
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type, device, occurred_at)
values ((select ws from ctx), '00000000-0000-0000-0000-00000000dd01', 'v-d-1', 's-d-1', 'cta_click', 'desktop', now() - interval '20 seconds');
insert into public.leads (workspace_id, demo_id, visitor_id, email, consent)
values ((select ws from ctx), '00000000-0000-0000-0000-00000000dd01', 'v-m-1', 'lea@acme.example', true);

-- ===== Segments =====
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select lives_ok($$ insert into public.segments (workspace_id, name, conditions) values
  ((select ws from ctx), 'Mobiles', '[{"field":"device","op":"is","value":"mobile"}]') $$, 'éditrice : segment créé');
select throws_ok($$ insert into public.segments (workspace_id, name, conditions) values
  ((select ws from ctx), 'Faux', '[{"field":"ip","op":"is","value":"x"}]') $$, '23514', null, 'champ inconnu refusé');
select throws_ok($$ insert into public.segments (workspace_id, name, conditions) values
  ((select ws from ctx), 'Trop', (select jsonb_agg('{"field":"cta","op":"is","value":true}'::jsonb) from generate_series(1, 9))) $$,
  '23514', null, '9 conditions refusées');
select throws_ok($$ insert into public.segments (workspace_id, name, conditions) values
  ((select ws from ctx), repeat('x', 61), '[{"field":"cta","op":"is","value":true}]') $$, '23514', null, 'nom de 61 caractères refusé');
select throws_ok($$ insert into public.segments (workspace_id, name, conditions) values
  ((select ws from ctx), ' mobiles ', '[{"field":"cta","op":"is","value":true}]') $$, '23505', null, 'nom en double refusé');

select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select is((select count(*)::int from public.segments), 1, 'lecteur : segments lisibles');
select throws_ok($$ insert into public.segments (workspace_id, name, conditions) values
  ((select ws from ctx), 'Lecteur', '[{"field":"cta","op":"is","value":true}]') $$, '42501', null, 'lecteur : création refusée');
select is((public.segment_count((select ws from ctx), jsonb_build_object('id', (select id from public.segments)), now() - interval '1 day') ->> 'visitors')::int,
  6, 'segment enregistré : 6 visiteurs mobiles');
select is((public.segment_count((select ws from ctx), '{"match":"all","conditions":[{"field":"device","op":"is","value":"mobile"},{"field":"completed","op":"is","value":true}]}', now() - interval '1 day') ->> 'visitors')::int,
  2, 'toutes les conditions');
select is((public.segment_count((select ws from ctx), '{"match":"any","conditions":[{"field":"country","op":"is","value":"BE"},{"field":"lead","op":"is","value":true}]}', now() - interval '1 day') ->> 'visitors')::int,
  4, 'au moins une condition');
select is((public.segment_count((select ws from ctx), '{"conditions":[{"field":"steps","op":"gte","value":2}]}', now() - interval '1 day') ->> 'visitors')::int,
  6, 'étapes vues (au moins 2)');
select throws_ok($$ select public.segment_count((select ws from ctx), '{"conditions":[]}', now() - interval '1 day') $$,
  '22023', 'SEGMENT_INVALID', 'définition invalide refusée');

-- Analytics filtrées
select is((public.workspace_analytics((select ws from ctx), now() - interval '1 day', p_segment => '{"conditions":[{"field":"device","op":"is","value":"mobile"}]}') ->> 'views')::int,
  6, 'analytics : vues du segment');
select is((public.workspace_analytics((select ws from ctx), now() - interval '1 day', p_segment => '{"conditions":[{"field":"device","op":"is","value":"mobile"}]}') ->> 'leads')::int,
  1, 'analytics : leads du segment');
select is((public.workspace_sessions((select ws from ctx), now() - interval '1 day', p_segment => '{"conditions":[{"field":"device","op":"is","value":"mobile"}]}') ->> 'total')::int,
  6, 'sessions du segment (6 visiteurs)');
select is((public.workspace_sessions((select ws from ctx), now() - interval '1 day', p_segment => '{"conditions":[{"field":"device","op":"is","value":"desktop"}]}') ->> 'tooSmall'),
  'true', 'moins de 5 visiteurs : aucune ligne');
select is((public.workspace_sessions((select ws from ctx), now() - interval '1 day') ->> 'total')::int, 9, 'sans segment : inchangé');

-- ===== Temps réel =====
create temp table lv as select public.live_demo('00000000-0000-0000-0000-00000000dd01') as r;
select is((select (r -> 'kpis' ->> 'live')::int from lv), 2, '2 visiteurs actifs (moins de 5 min)');
select is((select (r -> 'kpis' ->> 'ctaToday')::int from lv), 1, 'clics CTA du jour');
select is((select jsonb_agg(v -> 'identity') from lv, jsonb_array_elements(r -> 'visitors') v), '[null, null]'::jsonb,
  'lecteur : aucune identité (« Visiteur »)');
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select is((select v ->> 'identity' from jsonb_array_elements(public.live_demo('00000000-0000-0000-0000-00000000dd01') -> 'visitors') v
           where v ->> 'identity' is not null), 'lea@acme.example', 'éditrice : e-mail du lead');
select is((select v ->> 'stepTitle' from jsonb_array_elements(public.live_demo('00000000-0000-0000-0000-00000000dd01') -> 'visitors') v
           where v ->> 'device' = 'mobile'), 'Tableau de bord', 'étape en cours');

select * from finish();
rollback;
