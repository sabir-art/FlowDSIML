-- Tests pgTAP : liaison automatique du Sandbox, routes en ancre et pages de même adresse.
begin;
set search_path = public, extensions;
select plan(15);

-- ===== Clé d'adresse =====
select is(public.html_link_key('https://app.acme.example/agenda/'), 'https://app.acme.example/agenda', 'barre finale ignorée');
select is(public.html_link_key('https://app.acme.example/agenda#jour'), 'https://app.acme.example/agenda', 'ancre de section ignorée');
select is(public.html_link_key('https://app.acme.example/#/clients'), 'https://app.acme.example#/clients', 'route en ancre gardée');
select is(public.html_link_key('https://app.acme.example/#/clients/'), 'https://app.acme.example#/clients', 'route en ancre : barre finale ignorée');
select is(public.html_link_key('https://app.acme.example/#!/clients'), 'https://app.acme.example#!/clients', 'route en « #! » gardée');
select is(public.html_link_key('https://app.acme.example/#/'), 'https://app.acme.example', 'route racine : même adresse que la page sans ancre');
select is(public.html_link_key('https://app.acme.example/#/clients?tri=nom'), 'https://app.acme.example#/clients?tri=nom', 'paramètres de la route gardés');
select is(public.html_link_key(null), '', 'adresse absente');
select ok(not has_function_privilege('anon', 'public.html_link_key(text)', 'execute'), 'anon : pas d’exécution');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000097a1', 'ancres@acme.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000097a1');
create temp table ctx as select (public.create_workspace('Ancres')).id as ws;
grant all on ctx to anon, authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by, kind, sandbox) values
  ('00000000-0000-0000-0000-0000000097d1', (select ws from ctx), 'Appli à ancres', auth.uid(), 'sandbox',
   '{"start":"00000000-0000-0000-0000-0000000097e1","autoLink":true,"unlinked":"toast","guide":false,"keyPages":[]}');
insert into public.steps (id, demo_id, workspace_id, position, kind, title) values
  ('00000000-0000-0000-0000-0000000097e1', '00000000-0000-0000-0000-0000000097d1', (select ws from ctx), 0, 'html', 'Accueil'),
  ('00000000-0000-0000-0000-0000000097e2', '00000000-0000-0000-0000-0000000097d1', (select ws from ctx), 1, 'html', 'Clients'),
  ('00000000-0000-0000-0000-0000000097e3', '00000000-0000-0000-0000-0000000097d1', (select ws from ctx), 2, 'html', 'Rapports'),
  ('00000000-0000-0000-0000-0000000097e4', '00000000-0000-0000-0000-0000000097d1', (select ws from ctx), 3, 'html', 'Rapports, réglages');
create temp table p as select n, (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000097d1/00000000-0000-0000-0000-0000000097f' || n || '.html' as path
  from generate_series(1, 4) n;
grant all on p to authenticated;
-- Pages déposées (comme par html-ingest, clé de service)
reset role;
insert into storage.objects (bucket_id, name, metadata) select 'html', path, '{"size": 1000}' from p;
select pg_temp.login('00000000-0000-0000-0000-0000000097a1');

-- Les quatre pages portent le même menu. La page 4 est un écran ouvert depuis « Rapports » sans changement
-- d'adresse ; la page 1 a aussi un lien posé à la main (opération « link ») vers la page 3.
create temp table menu as select '[
  {"sel":"#nav > a:nth-of-type(1)","href":"https://app.acme.example/#/","label":"Accueil"},
  {"sel":"#nav > a:nth-of-type(2)","href":"https://app.acme.example/#/clients","label":"Clients"},
  {"sel":"#nav > a:nth-of-type(3)","href":"https://app.acme.example/#/rapports","label":"Rapports"},
  {"sel":"#nav > a:nth-of-type(4)","href":"https://app.acme.example/#haut","label":"Haut de page"}]'::jsonb as links;
grant all on menu to authenticated;
select lives_ok($$
  update public.steps s set html_path = (select path from p where n = x.n),
    html_meta = jsonb_build_object('title', s.title, 'url', x.url, 'links', (select links from menu)),
    html_ops = case when x.n = 1 then '[{"id":"l1","sel":"#go","op":"link","value":"00000000-0000-0000-0000-0000000097e3","scope":"step"}]'::jsonb else '[]'::jsonb end
  from (values (1, '00000000-0000-0000-0000-0000000097e1'::uuid, 'https://app.acme.example/'),
               (2, '00000000-0000-0000-0000-0000000097e2'::uuid, 'https://app.acme.example/#/clients'),
               (3, '00000000-0000-0000-0000-0000000097e3'::uuid, 'https://app.acme.example/#/rapports'),
               (4, '00000000-0000-0000-0000-0000000097e4'::uuid, 'https://app.acme.example/#/rapports')) as x(n, id, url)
  where s.id = x.id $$, 'pages d’une application à routeur par ancre');

create temp table pub as select public.publish_demo('00000000-0000-0000-0000-0000000097d1', '{"reviewed": true, "fictional": true}') as r;
create temp table l as select (st.ord - 1)::int as page, st.s -> 'html' -> 'links' as links, st.s -> 'html' -> 'ops' as ops
  from pub, jsonb_array_elements(r -> 'manifest' -> 'steps') with ordinality as st(s, ord);

-- Page 1 (accueil) : chaque route mène à sa page ; l'accueil et l'ancre de section ne sont pas reliés
select is((select links from l where page = 0),
  '[{"sel":"#nav > a:nth-of-type(2)","step":"00000000-0000-0000-0000-0000000097e2"},
    {"sel":"#nav > a:nth-of-type(3)","step":"00000000-0000-0000-0000-0000000097e3"}]'::jsonb,
  'accueil : Clients et Rapports reliés à leur page, pas de lien vers soi-même');
-- Page 2 (clients) : « Accueil » (route racine) mène à la page sans ancre ; « Clients » n'est pas relié
select is((select links from l where page = 1),
  '[{"sel":"#nav > a:nth-of-type(1)","step":"00000000-0000-0000-0000-0000000097e1"},
    {"sel":"#nav > a:nth-of-type(3)","step":"00000000-0000-0000-0000-0000000097e3"},
    {"sel":"#nav > a:nth-of-type(4)","step":"00000000-0000-0000-0000-0000000097e1"}]'::jsonb,
  'clients : route racine et ancre de section vers l’accueil, Rapports vers la première page de cette adresse');
-- Pages 3 et 4 (même adresse) : « Rapports » n'est relié ni à l'une ni à l'autre
select is((select count(*)::int from l, jsonb_array_elements(links) x
           where page in (2, 3) and x ->> 'sel' = '#nav > a:nth-of-type(3)'), 0,
  'pages de même adresse : le lien vers leur propre adresse n’est pas relié à l’autre');
select is((select links from l where page = 3),
  '[{"sel":"#nav > a:nth-of-type(1)","step":"00000000-0000-0000-0000-0000000097e1"},
    {"sel":"#nav > a:nth-of-type(2)","step":"00000000-0000-0000-0000-0000000097e2"},
    {"sel":"#nav > a:nth-of-type(4)","step":"00000000-0000-0000-0000-0000000097e1"}]'::jsonb,
  'écran sans changement d’adresse : ses autres liens restent reliés');
-- Le lien posé à la main est publié tel quel
select is((select ops from l where page = 0),
  '[{"id":"l1","sel":"#go","op":"link","value":"00000000-0000-0000-0000-0000000097e3","scope":"step"}]'::jsonb,
  'lien posé à la main (opération « link ») inchangé');

select * from finish();
rollback;
