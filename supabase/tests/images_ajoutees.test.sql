-- Tests pgTAP : retours client du 24/11 §1, images ajoutées par-dessus la capture (options.images).
begin;
set search_path = public, extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000099a1', 'calques@example.com'),
  ('00000000-0000-0000-0000-0000000099a2', 'calques-lecteur@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000099a1');
create temp table ctx as select (public.create_workspace('Calques')).id as ws;
grant all on ctx to anon, authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-0000000099d1', (select ws from ctx), 'Avec des images', auth.uid());
create temp table p as select
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000099d1/ecran.webp' as shot,
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000099d1/fleche.webp' as arrow,
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000099d1/logo.webp' as logo;
grant all on p to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000099a2', 'viewer');
insert into storage.objects (bucket_id, name, metadata) values
  ('captures', (select shot from p), '{"size": 40000}'),
  ('captures', (select arrow from p), '{"size": 4000}'),
  ('captures', (select logo from p), '{"size": 4000}');

select pg_temp.login('00000000-0000-0000-0000-0000000099a1');
insert into public.steps (id, demo_id, workspace_id, position, kind, title, image_path, image_width, image_height) values
  ('00000000-0000-0000-0000-0000000099b1', '00000000-0000-0000-0000-0000000099d1', (select ws from ctx), 0, 'image', 'Accueil', (select shot from p), 1280, 800);

-- Écriture : les images sont nettoyées (champs connus, bornes, dossier de l'espace)
update public.steps set options = jsonb_build_object('images', jsonb_build_array(
    jsonb_build_object('id', 'i1', 'path', (select arrow from p), 'name', 'fleche.svg', 'x', 0.64, 'y', 0.58, 'w', 0.26, 'h', 0.24,
                       'ratio', 1.7, 'opacity', 250, 'alt', 'Flèche vers le bouton', 'inconnu', 'x'),
    jsonb_build_object('id', 'i2', 'path', (select logo from p), 'name', 'logo.png', 'x', -3, 'y', 0.1, 'w', 0.2, 'h', 0.1,
                       'decorative', true, 'rounded', true, 'shadow', true),
    jsonb_build_object('id', 'i3', 'path', '00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-0000000099d1/x.webp',
                       'x', 0, 'y', 0, 'w', 0.2, 'h', 0.1),
    jsonb_build_object('id', 'i4', 'path', (select logo from p) || '/../autre', 'x', 0, 'y', 0, 'w', 0.2, 'h', 0.1),
    jsonb_build_object('id', 'i5', 'path', (select logo from p), 'x', 'gauche', 'y', 0, 'w', 0.2, 'h', 0.1)))
 where id = '00000000-0000-0000-0000-0000000099b1';
select is((select jsonb_array_length(options -> 'images') from public.steps where id = '00000000-0000-0000-0000-0000000099b1'), 2,
  'images d''un autre espace, au chemin ou aux nombres invalides : retirées');
select is((select options #>> '{images,0,opacity}' from public.steps where id = '00000000-0000-0000-0000-0000000099b1'), '100',
  'opacité bornée à 100');
select ok((select not (options #> '{images,0}') ? 'inconnu' from public.steps where id = '00000000-0000-0000-0000-0000000099b1'),
  'champ inconnu retiré');
select is((select options #>> '{images,1,x}' from public.steps where id = '00000000-0000-0000-0000-0000000099b1'), '0',
  'position ramenée dans le cadre');
select is((select (options #>> '{images,1,rounded}') || (options #>> '{images,1,shadow}') || (options #>> '{images,1,decorative}')
             from public.steps where id = '00000000-0000-0000-0000-0000000099b1'), 'truetruetrue', 'coins, ombre et image décorative gardés');

-- 10 images au plus
update public.steps set options = jsonb_build_object('images', (
    select jsonb_agg(jsonb_build_object('id', 'n' || g, 'path', (select logo from p), 'x', 0, 'y', 0, 'w', 0.1, 'h', 0.1))
    from generate_series(1, 14) g))
 where id = '00000000-0000-0000-0000-0000000099b1';
select is((select jsonb_array_length(options -> 'images') from public.steps where id = '00000000-0000-0000-0000-0000000099b1'), 10,
  '10 images par étape au plus');
update public.steps set options = '{"images": "non"}' where id = '00000000-0000-0000-0000-0000000099b1';
select ok((select not options ? 'images' from public.steps where id = '00000000-0000-0000-0000-0000000099b1'),
  'valeur qui n''est pas une liste : retirée');

-- Lecteur de l'espace : pas d'écriture (RLS)
select pg_temp.login('00000000-0000-0000-0000-0000000099a2');
update public.steps set options = jsonb_build_object('images', jsonb_build_array(
    jsonb_build_object('id', 'i9', 'path', (select logo from p), 'x', 0, 'y', 0, 'w', 0.2, 'h', 0.1)))
 where id = '00000000-0000-0000-0000-0000000099b1';
reset role;
select ok((select not options ? 'images' from public.steps where id = '00000000-0000-0000-0000-0000000099b1'),
  'lecteur : ne peut pas ajouter d''image');

-- Publication
select pg_temp.login('00000000-0000-0000-0000-0000000099a1');
create temp table pub0 as select public.publish_demo('00000000-0000-0000-0000-0000000099d1', '{"reviewed": true, "fictional": true}') as r;
select ok((select not (r -> 'manifest' -> 'steps' -> 0 -> 'options') ? 'images' and not (r -> 'copies' -> 0) ? 'images' from pub0),
  'sans image ajoutée : rien dans le manifeste ni dans la copie');

update public.steps set options = jsonb_build_object('images', jsonb_build_array(
    jsonb_build_object('id', 'i1', 'path', (select arrow from p), 'name', 'fleche.svg', 'x', 0.64, 'y', 0.58, 'w', 0.26, 'h', 0.24,
                       'alt', 'Flèche vers le bouton'),
    jsonb_build_object('id', 'i2', 'path', (select logo from p), 'name', 'logo.png', 'x', 0.1, 'y', 0.1, 'w', 0.2, 'h', 0.1,
                       'decorative', true),
    jsonb_build_object('id', 'i3', 'path', (select logo from p), 'name', 'cache.png', 'x', 0.5, 'y', 0.1, 'w', 0.2, 'h', 0.1,
                       'alt', 'Masquée', 'hidden', true)))
 where id = '00000000-0000-0000-0000-0000000099b1';
create temp table pub1 as select public.publish_demo('00000000-0000-0000-0000-0000000099d1', '{"reviewed": true, "fictional": true}') as r;
select is((select jsonb_array_length(r -> 'copies' -> 0 -> 'images') from pub1), 2,
  'copie : les images visibles à incruster (l''image masquée n''y est pas)');
select is((select r -> 'manifest' -> 'steps' -> 0 -> 'options' -> 'images' from pub1),
  '[{"x": 0.64, "y": 0.58, "w": 0.26, "h": 0.24, "alt": "Flèche vers le bouton"}]'::jsonb,
  'manifeste : place et texte alternatif des images informatives seulement');
select ok((select position('fleche' in (r -> 'manifest')::text) = 0 and position('logo.webp' in (r -> 'manifest')::text) = 0 from pub1),
  'manifeste : aucun chemin ni nom de fichier d''image ajoutée');
select isnt((select r -> 'manifest' -> 'steps' -> 0 -> 'image' ->> 'url' from pub1),
  (select r -> 'manifest' -> 'steps' -> 0 -> 'image' ->> 'url' from pub0),
  'la copie publiée change de nom quand une image est ajoutée');

-- Le nom de la copie suit aussi les masques et le recadrage ; il ne change pas sans modification
update public.steps set blurs = '[{"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.1}]' where id = '00000000-0000-0000-0000-0000000099b1';
create temp table pub2 as select public.publish_demo('00000000-0000-0000-0000-0000000099d1', '{"reviewed": true, "fictional": true}') as r;
select isnt((select r -> 'manifest' -> 'steps' -> 0 -> 'image' ->> 'url' from pub2),
  (select r -> 'manifest' -> 'steps' -> 0 -> 'image' ->> 'url' from pub1), 'nouveau masque : nouvelle copie publiée');
create temp table pub3 as select public.publish_demo('00000000-0000-0000-0000-0000000099d1', '{"reviewed": true, "fictional": true}') as r;
select is((select r -> 'manifest' -> 'steps' -> 0 -> 'image' ->> 'url' from pub3),
  (select r -> 'manifest' -> 'steps' -> 0 -> 'image' ->> 'url' from pub2), 'sans modification : même copie publiée');
update public.steps set options = options || '{"crop": {"x": 0.1, "y": 0.1, "w": 0.8, "h": 0.8}}'
 where id = '00000000-0000-0000-0000-0000000099b1';
create temp table pub4 as select public.publish_demo('00000000-0000-0000-0000-0000000099d1', '{"reviewed": true, "fictional": true}') as r;
select isnt((select r -> 'manifest' -> 'steps' -> 0 -> 'image' ->> 'url' from pub4),
  (select r -> 'manifest' -> 'steps' -> 0 -> 'image' ->> 'url' from pub3), 'recadrage : nouvelle copie publiée');

select * from finish();
rollback;
