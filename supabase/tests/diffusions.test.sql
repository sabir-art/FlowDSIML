-- Tests pgTAP : L16 diffusions (droits, upsert, version, vues par site intégrant).
begin;
set search_path = public, extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000006a1', 'olga-diff@example.com'),
  ('00000000-0000-0000-0000-0000000006a2', 'eddie-diff@example.com'),
  ('00000000-0000-0000-0000-0000000006a3', 'vera-diff@example.com'),
  ('00000000-0000-0000-0000-0000000006a4', 'autre-diff@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Olga (owner), Eddie (éditeur), Vera (lectrice) ; « autre » est owner d'un autre workspace
select pg_temp.login('00000000-0000-0000-0000-0000000006a1');
create temp table ctx as select (public.create_workspace('Diffusions')).id as ws;
grant all on ctx to authenticated;
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000006a4');
create temp table ctx2 as select (public.create_workspace('Autre diffusion')).id as ws;
grant all on ctx2 to authenticated;
select pg_temp.logout();
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000006a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000006a3', 'viewer');
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000006d1', (select ws from ctx), 'Démo diffusée', '00000000-0000-0000-0000-0000000006a1');
insert into public.demo_versions (id, demo_id, workspace_id, number, manifest, published_by) values
  ('00000000-0000-0000-0000-0000000006f1', '00000000-0000-0000-0000-0000000006d1', (select ws from ctx), 1, '{}',
   '00000000-0000-0000-0000-0000000006a1'),
  ('00000000-0000-0000-0000-0000000006f2', '00000000-0000-0000-0000-0000000006d1', (select ws from ctx), 2, '{}',
   '00000000-0000-0000-0000-0000000006a1');
update public.demos set current_version_id = '00000000-0000-0000-0000-0000000006f1'
  where id = '00000000-0000-0000-0000-0000000006d1';

-- ===== Enregistrement =====
select pg_temp.login('00000000-0000-0000-0000-0000000006a2');
create temp table d1 as
  select public.record_diffusion('00000000-0000-0000-0000-0000000006d1', 'scorm', 'SCORM 1.2 · complet',
    '{"version": "1.2", "stats": false}') as id;
select pg_temp.logout();
select ok((select version_id = '00000000-0000-0000-0000-0000000006f1' and uses = 1 and created_by = '00000000-0000-0000-0000-0000000006a2'
             from public.diffusions where id = (select id from d1)),
  'éditeur : diffusion enregistrée sur la version publiée courante');

update public.demos set current_version_id = '00000000-0000-0000-0000-0000000006f2'
  where id = '00000000-0000-0000-0000-0000000006d1';
select pg_temp.login('00000000-0000-0000-0000-0000000006a1');
select is(public.record_diffusion('00000000-0000-0000-0000-0000000006d1', 'scorm', 'SCORM 1.2 · complet', '{"version": "1.2"}'),
  (select id from d1), 'même diffusion : même ligne (upsert)');
select pg_temp.logout();
select ok((select uses = 2 and version_id = '00000000-0000-0000-0000-0000000006f2' and settings = '{"version": "1.2"}'::jsonb
             from public.diffusions where id = (select id from d1)),
  'upsert : compteur, version et réglages rafraîchis');

select pg_temp.login('00000000-0000-0000-0000-0000000006a3');
select throws_ok($$ select public.record_diffusion('00000000-0000-0000-0000-0000000006d1', 'email', 'E-mail') $$,
  '42501', null, 'lecteur : enregistrement refusé');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000006a4');
select throws_ok($$ select public.record_diffusion('00000000-0000-0000-0000-0000000006d1', 'email', 'E-mail') $$,
  '42501', null, 'autre workspace : enregistrement refusé');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000006a2');
select throws_ok($$ select public.record_diffusion('00000000-0000-0000-0000-0000000006d1', 'ftp', 'x') $$,
  '23514', null, 'type de diffusion inconnu refusé');
select throws_ok($$ select public.record_diffusion('00000000-0000-0000-0000-0000000006d1', 'email', repeat('x', 121)) $$,
  '23514', null, 'libellé de plus de 120 caractères refusé');
select throws_ok($$ select public.record_diffusion('00000000-0000-0000-0000-0000000006d1', 'email', 'E-mail',
  jsonb_build_object('x', repeat('y', 3000))) $$, '23514', null, 'réglages de plus de 2 Ko refusés');

-- ===== Lecture et suppression =====
select public.record_diffusion('00000000-0000-0000-0000-0000000006d1', 'intranet', 'intranet.exemple.fr');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000006a3');
select is((select count(*)::int from public.diffusions), 2, 'lecteur : voit les diffusions du workspace');
delete from public.diffusions where label = 'intranet.exemple.fr';
select is((select count(*)::int from public.diffusions), 2, 'lecteur : ne peut pas retirer une diffusion');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000006a4');
select is((select count(*)::int from public.diffusions), 0, 'autre workspace : ne voit rien');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000006a2');
delete from public.diffusions where label = 'intranet.exemple.fr';
select is((select count(*)::int from public.diffusions), 1, 'éditeur : retire une diffusion');
select pg_temp.logout();

-- ===== Vues par site intégrant =====
insert into public.events (workspace_id, demo_id, visitor_id, session_id, type, embed_origin, occurred_at)
select (select ws from ctx), '00000000-0000-0000-0000-0000000006d1', 'visiteur-' || g, 'session-' || g, 'demo_view',
       case when g <= 3 then 'https://intranet.exemple.fr' when g <= 4 then 'https://wiki.exemple.fr' end,
       case when g = 6 then now() - interval '120 days' else now() end
  from generate_series(1, 6) g;
update public.events set embed_origin = 'https://wiki.exemple.fr'
  where demo_id = '00000000-0000-0000-0000-0000000006d1' and visitor_id = 'visiteur-6';
select pg_temp.login('00000000-0000-0000-0000-0000000006a3');
select is(public.demo_embed_views('00000000-0000-0000-0000-0000000006d1') #>> '{0,origin}', 'https://intranet.exemple.fr',
  'vues : site le plus vu en tête');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000006a4');
select throws_ok($$ select public.demo_embed_views('00000000-0000-0000-0000-0000000006d1') $$,
  '42501', null, 'vues : autre workspace refusé');
select pg_temp.logout();

select * from finish();
rollback;
