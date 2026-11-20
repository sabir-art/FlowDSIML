-- Tests pgTAP : L29 §3.5, texte alternatif de la capture (250 caractères, step.alt dans le manifeste).
begin;
set search_path = public, extensions;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000029a1', 'editrice-alt@acme.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000029a1');
create temp table ctx as select (public.create_workspace('Alt')).id as ws;
grant all on ctx to anon, authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-0000000029d1', (select ws from ctx), 'Prise en main', auth.uid());
insert into public.steps (id, demo_id, workspace_id, position, kind, title, body) values
  ('00000000-0000-0000-0000-0000000029b1', '00000000-0000-0000-0000-0000000029d1', (select ws from ctx), 0, 'text', 'Accueil', 'Bienvenue'),
  ('00000000-0000-0000-0000-0000000029b2', '00000000-0000-0000-0000-0000000029d1', (select ws from ctx), 1, 'text', 'Fin', 'Merci');
select throws_ok($$ update public.steps set alt_text = repeat('a', 251) where id = '00000000-0000-0000-0000-0000000029b1' $$,
  '23514', null, '251 caractères : refusé');
select lives_ok($$ update public.steps set alt_text = '  Tableau de bord, menu Opportunités ouvert.  '
  where id = '00000000-0000-0000-0000-0000000029b1' $$, 'texte alternatif enregistré par l’éditrice');
create temp table pub as select public.publish_demo('00000000-0000-0000-0000-0000000029d1', '{"reviewed": true, "fictional": true}') as r;
reset role;
create temp table man as select v.manifest as m from public.demo_versions v
  where v.id = ((select r from pub) ->> 'versionId')::uuid;
select is((select m -> 'steps' -> 0 ->> 'alt' from man), 'Tableau de bord, menu Opportunités ouvert.',
  'manifeste publié : step.alt nettoyé');
select is((select m -> 'steps' -> 1 -> 'alt' from man), null, 'étape sans texte : pas de step.alt');

select * from finish();
rollback;
