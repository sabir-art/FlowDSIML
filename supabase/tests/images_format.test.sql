-- Tests pgTAP : images ajoutées (§1) et format des écrans. steps.original garde la disposition appliquée ;
-- le retour aux images d'origine ramène les images ajoutées à leur place.
begin;
set search_path = public, extensions;
select plan(8);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000097a1', 'format-calques@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000097a1');
create temp table ctx as select (public.create_workspace('Format et calques')).id as ws;
grant all on ctx to anon, authenticated;
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-0000000097d1', (select ws from ctx), 'Images et format', auth.uid());
create temp table p as select
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000097d1/origine.webp' as origin,
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000097d1/carre.webp' as square,
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000097d1/logo.webp' as logo;
grant all on p to authenticated;
insert into public.steps (id, demo_id, workspace_id, position, kind, title, image_path, image_width, image_height) values
  ('00000000-0000-0000-0000-0000000097b1', '00000000-0000-0000-0000-0000000097d1', (select ws from ctx), 0, 'image', 'Accueil', (select square from p), 1000, 1000),
  ('00000000-0000-0000-0000-0000000097b2', '00000000-0000-0000-0000-0000000097d1', (select ws from ctx), 1, 'image', 'Suite', (select square from p), 1000, 1000);

-- Disposition admise dans l'origine, contrôlée
select throws_ok($$ update public.steps set original = jsonb_build_object('image_path', (select origin from p),
    'image_width', 1000, 'image_height', 500, 'layout', '{"tw":1000,"th":1000,"ox":0,"oy":250,"dw":0,"dh":500}'::jsonb)
  where id = '00000000-0000-0000-0000-0000000097b1' $$, '23514', null, 'disposition de largeur nulle refusée');
select throws_ok($$ update public.steps set original = jsonb_build_object('image_path', (select origin from p),
    'image_width', 1000, 'image_height', 500, 'layout', '{"tw":1000,"th":1000,"ox":0,"oy":250,"dw":1000,"dh":500,"autre":1}'::jsonb)
  where id = '00000000-0000-0000-0000-0000000097b1' $$, '23514', null, 'clé inconnue dans la disposition refusée');
select lives_ok($$ update public.steps set
    original = jsonb_build_object('image_path', (select origin from p), 'image_width', 1000, 'image_height', 500,
      'layout', '{"tw":1000,"th":1000,"ox":0,"oy":250,"dw":1000,"dh":500}'::jsonb),
    options = jsonb_build_object('images', jsonb_build_array(
      jsonb_build_object('id', 'i1', 'path', (select logo from p), 'x', 0.5, 'y', 0.5, 'w', 0.2, 'h', 0.2, 'alt', 'Logo'),
      jsonb_build_object('id', 'i2', 'path', (select logo from p), 'x', 0.1, 'y', 0.1, 'w', 0.2, 'h', 0.1)))
  where id = '00000000-0000-0000-0000-0000000097b1' $$, 'origine avec sa disposition et deux images ajoutées');
-- Étape mise au format avant cette évolution : origine sans disposition
update public.steps set
    original = jsonb_build_object('image_path', (select origin from p), 'image_width', 1000, 'image_height', 500),
    options = jsonb_build_object('images', jsonb_build_array(
      jsonb_build_object('id', 'i1', 'path', (select logo from p), 'x', 0.5, 'y', 0.5, 'w', 0.2, 'h', 0.2)))
  where id = '00000000-0000-0000-0000-0000000097b2';

select is(public.restore_original_sizes('00000000-0000-0000-0000-0000000097d1'), 2, 'deux étapes restaurées');
-- Image 1 000 × 500 centrée dans un carré : y' = (y × 1000 − 250) / 500, h' = h × 2
select is((select (options #> '{images,0}') - 'path' - 'name' from public.steps where id = '00000000-0000-0000-0000-0000000097b1'),
  '{"id": "i1", "x": 0.5, "y": 0.5, "w": 0.2, "h": 0.4, "alt": "Logo"}'::jsonb,
  'image ajoutée ramenée à sa place sur l''image d''origine');
-- Image posée sur la bande du haut : ramenée dans l'image
select is((select (options #> '{images,1}') - 'path' - 'name' from public.steps where id = '00000000-0000-0000-0000-0000000097b1'),
  '{"id": "i2", "x": 0.1, "y": 0, "w": 0.2, "h": 0.2}'::jsonb,
  'image posée hors de l''image d''origine : ramenée dans le cadre');
select ok((select original is null and image_width = 1000 and image_height = 500 from public.steps
            where id = '00000000-0000-0000-0000-0000000097b1'), 'image d''origine rétablie');
select is((select (options #> '{images,0}') - 'path' - 'name' from public.steps where id = '00000000-0000-0000-0000-0000000097b2'),
  '{"id": "i1", "x": 0.5, "y": 0.5, "w": 0.2, "h": 0.2}'::jsonb,
  'origine sans disposition : l''image ajoutée garde sa place');

select * from finish();
rollback;
