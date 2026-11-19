-- Tests pgTAP : A8 (L20) étape HTML, Sandbox, bucket html, publication, Demo Center.
begin;
set search_path = public, extensions;
select plan(31);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a1', 'editrice@example.com'),
  ('00000000-0000-0000-0000-0000000008a2', 'lecteur@example.com');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000008a1');
create temp table ctx as select (public.create_workspace('Pages')).id as ws;
grant all on ctx to anon, authenticated;
update public.workspaces set public_links_enabled = true;
insert into public.demos (id, workspace_id, title, created_by, kind, sandbox) values
  ('00000000-0000-0000-0000-0000000008d1', (select ws from ctx), 'Agenda', auth.uid(), 'sandbox',
   '{"start":"00000000-0000-0000-0000-0000000008e1","autoLink":true,"unlinked":"toast","guide":false,"keyPages":[]}');
create temp table p as select
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000008d1/00000000-0000-0000-0000-0000000008f1.html' as p1,
  (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000008d1/00000000-0000-0000-0000-0000000008f2.html' as p2;
grant all on p to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role) values ((select ws from ctx), '00000000-0000-0000-0000-0000000008a2', 'viewer');

-- ===== Sandbox =====
select pg_temp.login('00000000-0000-0000-0000-0000000008a1');
select is((select kind from public.demos where id = '00000000-0000-0000-0000-0000000008d1'), 'sandbox', 'démo Sandbox');
select throws_ok($$ update public.demos set kind = 'libre' $$, '23514', null, 'type de démo inconnu refusé');
select throws_ok($$ update public.demos set sandbox = '{"unlinked":"rien"}' $$, '23514', null, 'clic non relié : valeur inconnue refusée');
select throws_ok($$ update public.demos set sandbox = '{"autre":1}' $$, '23514', null, 'sandbox : clé inconnue refusée');

-- ===== Étape HTML =====
insert into public.steps (id, demo_id, workspace_id, position, kind, title) values
  ('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008d1', (select ws from ctx), 0, 'html', 'Accueil'),
  ('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008d1', (select ws from ctx), 1, 'html', 'Agenda');
select throws_ok($$ update public.steps set html_path = (select p1 from p) where id = '00000000-0000-0000-0000-0000000008e1' $$,
  'P0001', 'HTML_OBJECT_MISSING', 'page absente du stockage refusée');
select throws_ok($$ update public.steps set html_path = '00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-0000000008d1/00000000-0000-0000-0000-0000000008f1.html' $$,
  '23514', 'HTML_PATH', 'page hors du dossier du workspace refusée');
select throws_ok($$ update public.steps set html_path = (select ws from ctx)::text || '/x/page.htm' $$, null, null, 'nom de page invalide refusé');
select throws_ok($$ update public.steps set html_ops = '[{"id":"a","sel":"b","op":"exec","scope":"step"}]' $$,
  '23514', null, 'opération inconnue refusée');
select throws_ok($$ update public.steps set html_ops = '[{"id":"a","sel":"b","op":"text","scope":"step"}]' $$,
  '23514', null, 'texte sans valeur refusé');
select throws_ok($$ update public.steps set html_ops = '[{"id":"a","sel":"b","op":"link","value":"javascript:x","scope":"step"}]' $$,
  '23514', null, 'lien vers autre chose qu''une étape refusé');
select throws_ok($$ update public.steps set html_ops = '[{"id":"a","sel":"img","op":"image","value":"00000000-0000-0000-0000-000000000000/x.webp","scope":"step"}]' $$,
  '23514', 'HTML_PATH', 'image hors du workspace refusée');
select throws_ok($$ update public.steps set html_ops = jsonb_build_array(jsonb_build_object('id', 'a', 'sel', repeat('x', 501), 'op', 'hide', 'scope', 'step')) $$,
  '23514', null, 'sélecteur de plus de 500 caractères refusé');
select throws_ok($$ update public.steps set html_meta = '{"links":[{"sel":"a","href":"javascript:x"}]}' $$,
  '23514', null, 'lien repéré non http refusé');
select throws_ok($$ update public.steps set html_meta = '{"script":"x"}' $$, '23514', null, 'meta : clé inconnue refusée');

-- Bucket html : aucune écriture par un membre, même éditeur
select throws_ok($$ insert into storage.objects (bucket_id, name, metadata) values ('html', (select p1 from p), '{"size": 1000}') $$,
  '42501', null, 'éditrice : dépôt direct dans le bucket html refusé');
select throws_ok($$ select public.publish_demo('00000000-0000-0000-0000-0000000008d1', '{"reviewed": true, "fictional": true}') $$,
  'P0001', 'HTML_MISSING:1', 'publication : page manquante');

-- Pages déposées (comme par html-ingest, clé de service)
reset role;
insert into storage.objects (bucket_id, name, metadata) values
  ('html', (select p1 from p), '{"size": 120000}'),
  ('html', (select p2 from p), '{"size": 98000}');
select pg_temp.login('00000000-0000-0000-0000-0000000008a1');
select lives_ok($$ update public.steps set html_path = (select p1 from p),
  html_ops = '[{"id":"l1","sel":"#menu > a:nth-of-type(2)","op":"link","value":"00000000-0000-0000-0000-0000000008e2","scope":"step"},
               {"id":"l2","sel":"a.fantome","op":"link","value":"00000000-0000-0000-0000-000000000999","scope":"step"},
               {"id":"t1","sel":"b.value","op":"text","value":"1 248","before":"312","scope":"all","group":"g1"}]',
  html_meta = '{"title":"Accueil","url":"https://app.acme.example/","bytes":120000,"viewport":{"w":1280,"h":800},
                "links":[{"sel":"#menu > a:nth-of-type(2)","href":"https://app.acme.example/agenda","label":"Agenda"}],"blurred":3,"canvases":0}'
  where id = '00000000-0000-0000-0000-0000000008e1' $$, 'éditrice : page, opérations et meta');
select lives_ok($$ update public.steps set html_path = (select p2 from p),
  html_meta = '{"title":"Agenda","url":"https://app.acme.example/agenda/#jour"}' where id = '00000000-0000-0000-0000-0000000008e2' $$,
  'éditrice : seconde page');
select pg_temp.login('00000000-0000-0000-0000-0000000008a2');
select is((select count(*)::int from storage.objects where bucket_id = 'html'), 2, 'lecteur : lit les pages du workspace');
update public.demos set kind = 'guided';
select is((select kind from public.demos where id = '00000000-0000-0000-0000-0000000008d1'), 'sandbox', 'lecteur : ne modifie pas la démo');

select pg_temp.login('00000000-0000-0000-0000-0000000008a1');
create temp table pub as select public.publish_demo('00000000-0000-0000-0000-0000000008d1', '{"reviewed": true, "fictional": true}') as r;
select is((select r -> 'manifest' ->> 'kind' from pub), 'sandbox', 'manifeste : kind');
select is((select r -> 'manifest' -> 'sandbox' ->> 'start' from pub), '00000000-0000-0000-0000-0000000008e1', 'manifeste : page de départ');
select ok((select r -> 'manifest' -> 'steps' -> 0 -> 'html' ->> 'url' like 'assets/%.html' from pub), 'manifeste : page publiée');
select is((select jsonb_array_length(r -> 'manifest' -> 'steps' -> 0 -> 'html' -> 'ops') from pub), 2,
  'lien vers une étape absente retiré');
select is((select r -> 'manifest' -> 'steps' -> 0 -> 'html' -> 'links' from pub),
  '[{"sel":"#menu > a:nth-of-type(2)","step":"00000000-0000-0000-0000-0000000008e2"}]'::jsonb,
  'liens résolus vers la page de même adresse, sans adresse publiée');
select is((select count(*)::int from pub, jsonb_array_elements(r -> 'copies') c where c ->> 'bucket' = 'html'), 2,
  'copie des pages depuis le bucket html');

-- ===== Demo Center =====
reset role;
update public.demos set status = 'published', current_version_id = (select (r ->> 'versionId')::uuid from pub);
insert into public.training_centers (workspace_id, slug, draft) values
  ((select ws from ctx), 'demos-acme', '{"kind":"demo","heroTitle":"Découvrez nos outils","cta":{"label":"Nous contacter","url":"https://www.acme.example/contact"}}');
select pg_temp.login('00000000-0000-0000-0000-0000000008a1');
select throws_ok($$ select public.save_center_draft((select ws from ctx), 'demos-acme', '{"kind":"boutique"}') $$,
  'P0001', 'CENTER_INVALID', 'type de centre inconnu refusé');
select throws_ok($$ select public.save_center_draft((select ws from ctx), 'demos-acme', '{"kind":"demo","cta":{"label":"Écrire","url":"http://acme.example"}}') $$,
  'P0001', 'CENTER_INVALID', 'bouton : lien non https refusé');
select lives_ok($$ select public.publish_center((select ws from ctx)) $$, 'Demo Center publié sans formation');
reset role;
create temp table r as select public.center_open('demos-acme') as j;
select is((select j -> 'demos' -> 0 ->> 'kind' from r), 'sandbox', 'Demo Center : démo listée avec son type');
select ok((select j -> 'paths' = '[]'::jsonb and j -> 'visitor' = 'null'::jsonb and j -> 'center' ->> 'kind' = 'demo' from r),
  'Demo Center : ni parcours ni visiteur');

select * from finish();
rollback;
