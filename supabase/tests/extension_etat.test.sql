-- Tests pgTAP : état de l'extension (retours du 24/11, 2e série §7). Version et dernière capture
-- déclarées par l'extension, pour la personne seulement ; démo d'un autre espace ignorée. Données fictives.
begin;
set search_path = public, extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000328a1', 'alice-ext@example.com'),
  ('00000000-0000-0000-0000-0000000328a2', 'bruno-ext@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.me() returns public.profiles language sql stable as $$
  select * from public.profiles where id = '00000000-0000-0000-0000-0000000328a1';
$$;

select pg_temp.login('00000000-0000-0000-0000-0000000328a2');
create temp table other as select (public.create_workspace('Autre')).id as ws;
grant all on other to authenticated;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000328d2', (select ws from other), 'Démo d’un autre espace', auth.uid());
select pg_temp.login('00000000-0000-0000-0000-0000000328a1');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000328d1', (select ws from ctx), 'Démo CRM', auth.uid());

-- Version seule, après connexion
select lives_ok($$ select public.extension_report('0.3.0') $$, 'l’extension déclare sa version');
reset role;
select is((pg_temp.me()).extension_version, '0.3.0', 'version enregistrée');
select isnt((pg_temp.me()).extension_seen_at, null, 'la déclaration vaut aussi détection');
select is((pg_temp.me()).extension_last_capture_at, null, 'pas de capture déclarée sans démo');

-- Capture envoyée
select pg_temp.login('00000000-0000-0000-0000-0000000328a1');
select public.extension_report('0.3.1', '00000000-0000-0000-0000-0000000328d1');
reset role;
select is((pg_temp.me()).extension_last_demo, '00000000-0000-0000-0000-0000000328d1'::uuid, 'dernière capture : la démo créée');
select isnt((pg_temp.me()).extension_last_capture_at, null, 'dernière capture : datée');
select is((pg_temp.me()).extension_version, '0.3.1', 'version mise à jour');

-- Valeurs refusées : version mal formée ignorée, démo d'un autre espace ignorée
select pg_temp.login('00000000-0000-0000-0000-0000000328a1');
select public.extension_report('<script>', '00000000-0000-0000-0000-0000000328d2');
reset role;
select is((pg_temp.me()).extension_version, '0.3.1', 'version mal formée : l’ancienne est gardée');
select is((pg_temp.me()).extension_last_demo, '00000000-0000-0000-0000-0000000328d1'::uuid,
  'démo d’un autre espace : ignorée');
select is((select extension_version from public.profiles where id = '00000000-0000-0000-0000-0000000328a2'), null,
  'la ligne d’une autre personne n’est jamais touchée');

set local role anon;
select throws_ok($$ select public.extension_report('0.3.0') $$, '42501', null, 'sans compte : refusé');
reset role;

select * from finish();
rollback;
