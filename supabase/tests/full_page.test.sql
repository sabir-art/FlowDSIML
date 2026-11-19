-- Tests pgTAP : L25-01, options écrites par l'extension (onglet, page entière) et publication de la
-- page entière (copie sous assets/, chemin de stockage jamais publié). Données fictives.
begin;
set search_path = public, extensions;
select plan(11);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000025a1', 'editrice-l25@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000025a1');
create temp table ctx as select (public.create_workspace('Capture')).id as ws;
grant all on ctx to authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by)
  values ('00000000-0000-0000-0000-0000000025d1', (select ws from ctx), 'Rapports', auth.uid());
create temp table p as select
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000025d1/00000000-0000-0000-0000-0000000025e1.webp' as img,
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000025d1/00000000-0000-0000-0000-0000000025e1-page.webp' as page;
grant all on p to authenticated;

-- Options valides : onglet et page entière
select lives_ok($$
  insert into public.steps (id, demo_id, workspace_id, position, kind, title, image_path, image_width, image_height, options)
  values ('00000000-0000-0000-0000-0000000025e1', '00000000-0000-0000-0000-0000000025d1', (select ws from ctx), 0, 'image',
          'Nouveau rapport', (select img from p), 1280, 720,
          jsonb_build_object('tab', jsonb_build_object('n', 2, 'title', 'Aide'),
            'fullPage', jsonb_build_object('path', (select page from p), 'width', 1280, 'height', 2119,
                                           'top', 600, 'viewportHeight', 720))) $$,
  'étape avec onglet et page entière');

-- Refus
select throws_ok($$ update public.steps set options = jsonb_set(options, '{fullPage,path}',
  '"00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-0000000025d1/00000000-0000-0000-0000-0000000025e1-page.webp"') $$,
  '23514', 'STEP_CAPTURE_OPTIONS', 'page entière hors du dossier du workspace refusée');
select throws_ok($$ update public.steps set options = jsonb_set(options, '{fullPage,path}', '"../../autre.webp"') $$,
  '23514', 'STEP_CAPTURE_OPTIONS', 'chemin invalide refusé');
select throws_ok($$ update public.steps set options = jsonb_set(options, '{fullPage,url}', '"https://x.example/a.webp"') $$,
  '23514', 'STEP_CAPTURE_OPTIONS', 'page entière : clé inconnue refusée');
select throws_ok($$ update public.steps set options = jsonb_set(options, '{fullPage,height}', '50000') $$,
  '23514', 'STEP_CAPTURE_OPTIONS', 'page entière trop haute refusée');
select throws_ok($$ update public.steps set options = jsonb_set(options, '{tab,n}', '0') $$,
  '23514', 'STEP_CAPTURE_OPTIONS', 'numéro d''onglet invalide refusé');
select throws_ok($$ update public.steps set options = jsonb_set(options, '{tab,title}', to_jsonb(repeat('x', 121))) $$,
  '23514', 'STEP_CAPTURE_OPTIONS', 'titre d''onglet trop long refusé');
select lives_ok($$ update public.steps set options = options || '{"showPrev": true}' $$,
  'les autres options restent libres');

-- Publication : page entière copiée, chemin de stockage absent du manifeste
create temp table pub as select public.publish_demo('00000000-0000-0000-0000-0000000025d1',
  '{"reviewed": true, "fictional": true}') as r;
select ok((select (r -> 'manifest' -> 'steps' -> 0 -> 'options' -> 'fullPage' ->> 'url') ~ '^assets/[0-9a-f-]{36}-p-[0-9a-f]{32}\.webp$' from pub),
  'manifeste : page entière sous assets/');
select ok((select position((select page from p) in (r -> 'manifest')::text) = 0 from pub),
  'manifeste : chemin de stockage jamais publié');
select ok((select exists (select 1 from jsonb_array_elements(r -> 'copies') c
                          where c ->> 'from' = (select page from p) and c ->> 'to' like '%/assets/%-p-%.webp') from pub),
  'copie de la page entière à la publication');

select * from finish();
rollback;
