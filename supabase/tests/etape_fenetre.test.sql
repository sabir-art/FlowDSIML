-- Tests pgTAP : EXT-02 §6.1, étape « Fenêtre » (texte + image), affichage « window ».
begin;
set search_path = public, extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000098a1', 'fenetre@example.com'),
  ('00000000-0000-0000-0000-0000000098a2', 'fenetre-lecteur@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000098a1');
create temp table ctx as select (public.create_workspace('Fenêtre')).id as ws;
grant all on ctx to anon, authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-0000000098d1', (select ws from ctx), 'Avec une fenêtre', auth.uid());
create temp table p as select
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000098d1/fond.webp' as shot,
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000098d1/fenetre.webp' as img;
grant all on p to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000098a2', 'viewer');
insert into storage.objects (bucket_id, name, metadata) values
  ('captures', (select shot from p), '{"size": 40000}'),
  ('captures', (select img from p), '{"size": 40000}');

select pg_temp.login('00000000-0000-0000-0000-0000000098a1');
insert into public.steps (id, demo_id, workspace_id, position, kind, title, image_path, image_width, image_height) values
  ('00000000-0000-0000-0000-0000000098b1', '00000000-0000-0000-0000-0000000098d1', (select ws from ctx), 0, 'image', 'Accueil', (select shot from p), 1280, 800);
select lives_ok($$ insert into public.steps (id, demo_id, workspace_id, position, kind, title, body, options, image_path, image_width, image_height) values
  ('00000000-0000-0000-0000-0000000098b2', '00000000-0000-0000-0000-0000000098d1', (select ws from ctx), 1, 'text',
   'Préparer les données', 'Vérifiez chaque fiche.', '{"display":"window","buttonLabel":"Continuer"}',
   (select img from p), 560, 480) $$, 'éditrice : étape Fenêtre avec image');
select lives_ok($$ update public.steps set options = '{"display":"popup"}' where id = '00000000-0000-0000-0000-0000000098b1' $$,
  'les autres affichages restent permis');
update public.steps set options = '{}' where id = '00000000-0000-0000-0000-0000000098b1';
select throws_ok($$ update public.steps set options = '{"display":"tiroir"}' where id = '00000000-0000-0000-0000-0000000098b2' $$,
  '23514', null, 'affichage inconnu refusé');
select throws_ok($$ update public.steps set options = '{"display":"window","variant":"autre"}' where id = '00000000-0000-0000-0000-0000000098b2' $$,
  '23514', null, 'le reste de la contrainte est conservé');
select throws_ok($$ update public.steps set image_path = '00000000-0000-0000-0000-000000000000/x/fenetre.webp' where id = '00000000-0000-0000-0000-0000000098b2' $$,
  '23514', null, 'image hors du dossier de l''espace refusée');

-- Lecteur de l'espace : pas d'écriture (RLS)
select pg_temp.login('00000000-0000-0000-0000-0000000098a2');
update public.steps set options = '{"display":"screen"}' where id = '00000000-0000-0000-0000-0000000098b2';
reset role;
select is((select options ->> 'display' from public.steps where id = '00000000-0000-0000-0000-0000000098b2'), 'window',
  'lecteur : l''étape n''est pas modifiable');

-- Publication : affichage et image de la fenêtre dans le manifeste
select pg_temp.login('00000000-0000-0000-0000-0000000098a1');
create temp table pub as select public.publish_demo('00000000-0000-0000-0000-0000000098d1', '{"reviewed": true, "fictional": true}') as r;
select is((select r -> 'manifest' -> 'steps' -> 1 -> 'options' ->> 'display' from pub), 'window', 'manifeste : affichage « window »');
select ok((select r -> 'manifest' -> 'steps' -> 1 -> 'image' ->> 'url' like 'assets/%.webp'
             and (r -> 'manifest' -> 'steps' -> 1 -> 'image' ->> 'width')::int = 560 from pub),
  'manifeste : image de la fenêtre publiée avec sa taille');

select * from finish();
rollback;
