-- Tests pgTAP : formation F1 (parcours guidés : options d'étape, style de hotspot, checklist, autoplay).
begin;
set search_path = public, extensions;
select plan(14);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'formateur@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000f1');
create temp table ctx as select (public.create_workspace('Formation')).id as ws;
grant all on ctx to authenticated;
insert into public.demos (id, workspace_id, title, created_by, settings)
  values ('00000000-0000-0000-0000-00000000fd01', (select ws from ctx), 'Prise en main du nouvel outil', auth.uid(),
          '{"checklist": {"enabled": true, "title": "Votre progression", "position": "gauche"}, "autoplay": {"enabled": true, "delayMs": 500}}');
insert into public.chapters (id, demo_id, workspace_id, title, position)
  values ('00000000-0000-0000-0000-00000000fc01', '00000000-0000-0000-0000-00000000fd01', (select ws from ctx), 'Gestion', 0);
insert into public.steps (id, demo_id, workspace_id, position, kind, title, options) values
  ('00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-00000000fd01', (select ws from ctx), 0, 'text', 'Vous êtes…',
   '{"display": "popup", "variant": "instruction", "choices": [
      {"label": "Conseiller", "action": {"type": "goto", "stepId": "00000000-0000-0000-0000-00000000f502"}},
      {"label": "Gestionnaire", "action": {"type": "chapter", "chapterId": "00000000-0000-0000-0000-00000000fc01"}},
      {"label": "Plus tard", "action": {"type": "end"}}]}'),
  ('00000000-0000-0000-0000-00000000f502', '00000000-0000-0000-0000-00000000fd01', (select ws from ctx), 1, 'image', 'Parcours A', '{}'),
  ('00000000-0000-0000-0000-00000000f503', '00000000-0000-0000-0000-00000000fd01', (select ws from ctx), 2, 'image', 'Parcours B', '{}');
update public.steps set chapter_id = '00000000-0000-0000-0000-00000000fc01' where id = '00000000-0000-0000-0000-00000000f503';
insert into public.hotspots (step_id, x, y, w, h, title)
  values ('00000000-0000-0000-0000-00000000f503', 0.5, 0.5, 0.1, 0.1, 'Pastille');
update public.steps set image_path = 'x/f/a.webp', image_width = 1280, image_height = 800 where kind = 'image';
insert into public.hotspots (step_id, x, y, w, h, title, style)
  values ('00000000-0000-0000-0000-00000000f502', 0.2, 0.3, 0.2, 0.1, 'Cliquez ici', 'spotlight');

select throws_ok($$ update public.steps set options = '{"display": "plein"}' where id = '00000000-0000-0000-0000-00000000f502' $$,
  '23514', null, 'affichage d''étape inconnu refusé');
select throws_ok($$ update public.steps set options = jsonb_build_object('choices', (select jsonb_agg(jsonb_build_object('label', i::text, 'stepId', 'x')) from generate_series(1, 7) i))
                    where id = '00000000-0000-0000-0000-00000000f502' $$, '23514', null, 'au plus 6 choix');
select throws_ok($$ update public.steps set options = '{"background": "video"}' where id = '00000000-0000-0000-0000-00000000f502' $$,
  '23514', null, 'fond de pop-up inconnu refusé');
select throws_ok($$ update public.hotspots set style = 'clignotant' $$, '23514', null, 'style de hotspot inconnu refusé');
select is((select style from public.hotspots where title = 'Cliquez ici'), 'spotlight', 'style Spotlight enregistré');

update public.workspaces set public_links_enabled = true; -- F1 : liens publics activés pour les tests de publication
create temp table pub as select public.publish_demo('00000000-0000-0000-0000-00000000fd01', '{"reviewed": true, "fictional": true}') as r;
select is((select r -> 'manifest' -> 'steps' -> 0 -> 'options' ->> 'display' from pub), 'popup', 'étape pop-up dans le manifeste');
select is((select jsonb_array_length(r -> 'manifest' -> 'steps' -> 0 -> 'options' -> 'choices') from pub), 3, 'menu de choix dans le manifeste');
select is((select r -> 'manifest' -> 'steps' -> 1 -> 'hotspots' -> 0 ->> 'style' from pub), 'spotlight', 'style du hotspot dans le manifeste');
select is((select r -> 'manifest' -> 'checklist' from pub), '{"title": "Votre progression", "position": "right"}'::jsonb,
  'checklist dans le manifeste (position inconnue → droite)');
select is((select (r -> 'manifest' -> 'autoplay' ->> 'delayMs')::int from pub), 1500, 'délai d''autoplay borné (1,5 s minimum)');

update public.demos set settings = settings || '{"mode": "spotlight"}' where id = '00000000-0000-0000-0000-00000000fd01';
create temp table pub2 as select public.publish_demo('00000000-0000-0000-0000-00000000fd01', '{"reviewed": true, "fictional": true}') as r;
select is((select r -> 'manifest' -> 'steps' -> 2 -> 'hotspots' -> 0 ->> 'style' from pub2), 'spotlight',
  'mode Spotlight de la démo appliqué à tous les hotspots');

-- Duplication : les choix pointent vers les nouvelles étapes
create temp table dup as select public.duplicate_demo('00000000-0000-0000-0000-00000000fd01') as id;
select ok((select (options -> 'choices' -> 0 -> 'action' ->> 'stepId')::uuid in (select id from public.steps where demo_id = (select id from dup))
           from public.steps where demo_id = (select id from dup) and position = 0), 'choix remappés vers les étapes dupliquées');
select ok((select (options -> 'choices' -> 1 -> 'action' ->> 'chapterId')::uuid in (select id from public.chapters where demo_id = (select id from dup))
           from public.steps where demo_id = (select id from dup) and position = 0), 'choix remappés vers les chapitres dupliqués');
select is((select h.style from public.hotspots h join public.steps s on s.id = h.step_id where s.demo_id = (select id from dup) and h.title = 'Cliquez ici'),
  'spotlight', 'style du hotspot dupliqué');

select * from finish();
rollback;
