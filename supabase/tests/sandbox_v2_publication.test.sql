-- Tests pgTAP : Sandbox v2, étape 3c (publication des pages vivantes : manifeste step.html.live, copies,
-- réglage de la démo et garde-fou d'espace).
begin;
set search_path = public, extensions;
select plan(9);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000036a1', 'pub-live@acme.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000036a1');
create temp table ctx as select (public.create_workspace('Pub live')).id as ws;
grant all on ctx to authenticated;
update public.workspaces set public_links_enabled = true where id = (select ws from ctx);
insert into public.demos (id, workspace_id, title, created_by, kind, sandbox) values
  ('00000000-0000-0000-0000-0000000036d1', (select ws from ctx), 'CRM', auth.uid(), 'sandbox',
   '{"start":"00000000-0000-0000-0000-0000000036e1","autoLink":true,"live":true}');
reset role;
create temp table p as select (select ws from ctx)::text || '/00000000-0000-0000-0000-0000000036d1/' as base;
grant all on p to authenticated;
insert into storage.objects (bucket_id, name) values
  ('html', (select base from p) || '00000000-0000-0000-0000-0000000036f1.html'),
  ('html', (select base from p) || '00000000-0000-0000-0000-0000000036f2.html'),
  ('html_live', (select base from p) || '00000000-0000-0000-0000-0000000036f1.json');
insert into public.steps (id, demo_id, workspace_id, position, kind, title, html_path, html_live_path, html_meta) values
  ('00000000-0000-0000-0000-0000000036e1', '00000000-0000-0000-0000-0000000036d1', (select ws from ctx), 0, 'html', 'Clients',
   (select base from p) || '00000000-0000-0000-0000-0000000036f1.html', (select base from p) || '00000000-0000-0000-0000-0000000036f1.json',
   '{"url":"https://app.acme.example/clients","live":{"scripts":[{"id":"s1","category":"page","keep":true},{"id":"s2","category":"third","keep":false},{"id":"s3","category":"page","keep":true}],"responses":2}}'),
  ('00000000-0000-0000-0000-0000000036e2', '00000000-0000-0000-0000-0000000036d1', (select ws from ctx), 1, 'html', 'Fiche',
   (select base from p) || '00000000-0000-0000-0000-0000000036f2.html', null, '{"url":"https://app.acme.example/fiche"}');

select pg_temp.login('00000000-0000-0000-0000-0000000036a1');
create temp table pub as select public.publish_demo('00000000-0000-0000-0000-0000000036d1', '{"reviewed": true, "fictional": true}') as r;
select ok((select r -> 'manifest' -> 'steps' -> 0 -> 'html' -> 'live' ->> 'url' like 'assets/%-l-%.json' from pub),
  'page vivante : enregistrement publié');
select is((select r -> 'manifest' -> 'steps' -> 0 -> 'html' -> 'live' -> 'keep' from pub), '["s1", "s3"]'::jsonb,
  'scripts gardés par l''auteur seulement');
select ok((select r -> 'manifest' -> 'steps' -> 1 -> 'html' -> 'live' = 'null'::jsonb from pub), 'page sans enregistrement : inerte');
select is((select count(*)::int from pub, jsonb_array_elements(r -> 'copies') c where c ->> 'bucket' = 'html_live'), 1,
  'copie de l''enregistrement depuis html_live');
select ok((select r::text not like '%app.acme.example%' from pub), 'aucune adresse du site d''origine dans la publication');

-- Réglage de la démo coupé : pages inertes
update public.demos set sandbox = sandbox || '{"live": false}' where id = '00000000-0000-0000-0000-0000000036d1';
create temp table pub2 as select public.publish_demo('00000000-0000-0000-0000-0000000036d1', '{"reviewed": true, "fictional": true}') as r;
select ok((select r -> 'manifest' -> 'steps' -> 0 -> 'html' -> 'live' = 'null'::jsonb from pub2), 'démo non vivante : page inerte');
select is((select count(*)::int from pub2, jsonb_array_elements(r -> 'copies') c where c ->> 'bucket' = 'html_live'), 0,
  'démo non vivante : aucun enregistrement copié');

-- Garde-fou d'espace fermé : pages inertes, même si la démo est vivante
update public.demos set sandbox = sandbox || '{"live": true}' where id = '00000000-0000-0000-0000-0000000036d1';
select public.set_sandbox_live((select ws from ctx), false);
create temp table pub3 as select public.publish_demo('00000000-0000-0000-0000-0000000036d1', '{"reviewed": true, "fictional": true}') as r;
select ok((select r -> 'manifest' -> 'steps' -> 0 -> 'html' -> 'live' = 'null'::jsonb from pub3), 'espace qui l''interdit : page inerte');
select is((select count(*)::int from pub3, jsonb_array_elements(r -> 'copies') c where c ->> 'bucket' = 'html_live'), 0,
  'espace qui l''interdit : aucun enregistrement copié');

select * from finish();
rollback;
