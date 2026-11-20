-- Tests pgTAP : L28 021 (format des écrans). Sauvegarde de l'origine contrôlée, retour aux images d'origine
-- (image, flous, zoom, recadrage, repères), droits.
begin;
set search_path = public, extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000021a1', 'editrice-format@example.com'),
  ('00000000-0000-0000-0000-0000000021a2', 'lecteur-format@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000021a1');
create temp table ctx as select (public.create_workspace('Format')).id as ws;
grant all on ctx to anon, authenticated;
insert into public.demos (id, workspace_id, title, created_by) values
  ('00000000-0000-0000-0000-0000000021d1', (select ws from ctx), 'Saisir un congé', auth.uid());
insert into public.steps (id, demo_id, workspace_id, position, image_path, image_width, image_height, blurs) values
  ('00000000-0000-0000-0000-0000000021b1', '00000000-0000-0000-0000-0000000021d1', (select ws from ctx), 0,
   (select ws from ctx)::text || '/d/new.webp', 1920, 1080, '[{"x":0.1,"y":0.2,"w":0.1,"h":0.1}]');
insert into public.hotspots (id, step_id, demo_id, workspace_id, x, y, w, h) values
  ('00000000-0000-0000-0000-0000000021c1', '00000000-0000-0000-0000-0000000021b1', '00000000-0000-0000-0000-0000000021d1',
   (select ws from ctx), 0.6, 0.6, 0.1, 0.05);
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select ws from ctx), '00000000-0000-0000-0000-0000000021a2', 'viewer');

select pg_temp.login('00000000-0000-0000-0000-0000000021a1');
select throws_ok($$ update public.steps set original = '{"image_path": "x"}' where id = '00000000-0000-0000-0000-0000000021b1' $$,
  '23514', null, 'sauvegarde incomplète refusée');
select throws_ok($$ update public.steps set original = jsonb_build_object('image_path',
  '00000000-0000-0000-0000-0000000000ff/d/o.webp', 'image_width', 1440, 'image_height', 900)
  where id = '00000000-0000-0000-0000-0000000021b1' $$,
  '23514', 'ORIGINAL_PATH', 'image d’origine d’un autre espace refusée');
select lives_ok($$ update public.steps set original = jsonb_build_object(
    'image_path', (select ws from ctx)::text || '/d/orig.webp', 'image_width', 1440, 'image_height', 900,
    'blurs', '[{"x":0.2,"y":0.3,"w":0.2,"h":0.1}]'::jsonb,
    'zoom', '{"x":0.5,"y":0.5,"scale":2}'::jsonb,
    'crop', '{"x":0.1,"y":0.1,"w":0.8,"h":0.8}'::jsonb,
    'hotspots', '[{"id":"00000000-0000-0000-0000-0000000021c1","x":0.5,"y":0.4,"w":0.12,"h":0.06}]'::jsonb)
  where id = '00000000-0000-0000-0000-0000000021b1' $$, 'sauvegarde de l’origine enregistrée');

-- Lecteur : retour refusé
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000021a2');
select throws_ok($$ select public.restore_original_sizes('00000000-0000-0000-0000-0000000021d1') $$,
  '42501', 'FORBIDDEN', 'lecteur : retour aux origines refusé');
reset role;

select pg_temp.login('00000000-0000-0000-0000-0000000021a1');
select is(public.restore_original_sizes('00000000-0000-0000-0000-0000000021d1'), 1, 'une étape restaurée');
reset role;
select is((select image_path from public.steps where id = '00000000-0000-0000-0000-0000000021b1'),
  (select ws from ctx)::text || '/d/orig.webp', 'image d’origine remise');
select is((select array[image_width, image_height] from public.steps where id = '00000000-0000-0000-0000-0000000021b1'),
  array[1440, 900], 'taille d’origine remise');
select is((select blurs from public.steps where id = '00000000-0000-0000-0000-0000000021b1'),
  '[{"x":0.2,"y":0.3,"w":0.2,"h":0.1}]'::jsonb, 'flous d’origine remis');
select is((select array[x, y, w, h] from public.hotspots where id = '00000000-0000-0000-0000-0000000021c1'),
  array[0.5, 0.4, 0.12, 0.06]::real[], 'repère d’origine remis');
select ok((select original is null and options -> 'crop' = '{"x":0.1,"y":0.1,"w":0.8,"h":0.8}'::jsonb
             and zoom ->> 'scale' = '2'
           from public.steps where id = '00000000-0000-0000-0000-0000000021b1'),
  'recadrage et zoom remis ; sauvegarde effacée');

select * from finish();
rollback;
