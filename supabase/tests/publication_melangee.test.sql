-- Tests pgTAP : publication d'une démo mélangée (EXT-02 §8). Une démo de captures qui contient une étape
-- HTML (ajoutée par « Capturer de nouvelles étapes ») se publie : chaque étape garde son type et son ordre,
-- l'étape HTML porte sa page publiée et sa copie depuis le bucket html, les captures gardent leur image.
-- Données fictives.
begin;
set search_path = public, extensions;
select plan(12);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000331a1', 'alice-melange@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000331a1');
create temp table ctx as select (public.create_workspace('Acme')).id as ws;
grant all on ctx to authenticated;
reset role;
update public.workspaces set public_links_enabled = true where id = (select ws from ctx);
select pg_temp.login('00000000-0000-0000-0000-0000000331a1');

-- Démo ordinaire (type par défaut), commencée par des captures d'écran
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000331d1', (select ws from ctx), 'Démo CRM', auth.uid());
select is((select kind::text from public.demos where id = '00000000-0000-0000-0000-0000000331d1'), 'guided',
  'démo ordinaire créée par défaut (pas un Sandbox)');
reset role;
insert into storage.objects (bucket_id, name) values
  ('captures', (select ws from ctx) || '/00000000-0000-0000-0000-0000000331d1/00000000-0000-0000-0000-0000000331e1.webp'),
  ('captures', (select ws from ctx) || '/00000000-0000-0000-0000-0000000331d1/00000000-0000-0000-0000-0000000331e3.webp'),
  ('html', (select ws from ctx) || '/00000000-0000-0000-0000-0000000331d1/00000000-0000-0000-0000-0000000331e2.html');
select pg_temp.login('00000000-0000-0000-0000-0000000331a1');
insert into public.steps (id, demo_id, workspace_id, position, image_path, image_width, image_height, title) values
  ('00000000-0000-0000-0000-0000000331e1', '00000000-0000-0000-0000-0000000331d1', (select ws from ctx), 0,
   (select ws from ctx) || '/00000000-0000-0000-0000-0000000331d1/00000000-0000-0000-0000-0000000331e1.webp', 1440, 900, 'Ouvrir les clients'),
  ('00000000-0000-0000-0000-0000000331e3', '00000000-0000-0000-0000-0000000331d1', (select ws from ctx), 2,
   (select ws from ctx) || '/00000000-0000-0000-0000-0000000331d1/00000000-0000-0000-0000-0000000331e3.webp', 1440, 900, 'Créer une opportunité');
-- Étape HTML ajoutée entre les deux captures
select lives_ok($$ insert into public.steps (id, demo_id, workspace_id, position, kind, title, html_path, html_meta)
  values ('00000000-0000-0000-0000-0000000331e2', '00000000-0000-0000-0000-0000000331d1', (select ws from ctx), 1, 'html', 'Rapports',
          (select ws from ctx) || '/00000000-0000-0000-0000-0000000331d1/00000000-0000-0000-0000-0000000331e2.html',
          '{"title":"Rapports","url":"https://app.example.com/rapports","viewport":{"w":1280,"h":720}}') $$,
  'une étape HTML s''ajoute à une démo de captures');

create temp table pub as
  select public.publish_demo('00000000-0000-0000-0000-0000000331d1', '{"reviewed": true, "fictional": true}') as r;
grant all on pub to authenticated;

select is((select jsonb_array_length(r -> 'manifest' -> 'steps') from pub), 3, 'le manifeste contient les 3 étapes');
select is(
  (select string_agg(s ->> 'kind', ',' order by ord) from pub, jsonb_array_elements(r -> 'manifest' -> 'steps') with ordinality as e(s, ord)),
  'image,html,image', 'chaque étape garde son type, dans l''ordre');
select isnt((select r -> 'manifest' -> 'steps' -> 0 -> 'image' ->> 'url' from pub), null, 'la première capture garde son image');
select isnt((select r -> 'manifest' -> 'steps' -> 2 -> 'image' ->> 'url' from pub), null, 'la seconde capture garde son image');
select matches((select r -> 'manifest' -> 'steps' -> 1 -> 'html' ->> 'url' from pub), '^assets/.+\.html$',
  'l''étape HTML porte sa page publiée');
select is((select r -> 'manifest' -> 'steps' -> 1 -> 'html' ->> 'title' from pub), 'Rapports', 'titre de la page HTML dans le manifeste');
select is((select r -> 'manifest' -> 'steps' -> 1 ->> 'image' from pub), null, 'l''étape HTML n''a pas de capture');
select is(
  (select count(*)::int from pub, jsonb_array_elements(r -> 'copies') c where c ->> 'bucket' = 'html'), 1,
  'une copie depuis le bucket html : la page de l''étape HTML');
select is(
  (select count(*)::int from pub, jsonb_array_elements(r -> 'copies') c where c ->> 'bucket' is null), 2,
  'deux copies de captures');
select is(
  (select c ->> 'to' from pub, jsonb_array_elements(r -> 'copies') c where c ->> 'bucket' = 'html'),
  '00000000-0000-0000-0000-0000000331d1/' || (select r -> 'manifest' -> 'steps' -> 1 -> 'html' ->> 'url' from pub),
  'la page HTML est copiée à l''adresse annoncée par le manifeste');

select * from finish();
rollback;
