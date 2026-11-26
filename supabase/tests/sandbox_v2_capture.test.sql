-- Tests pgTAP : Sandbox v2, étape 3 (enregistrement vivant d'une page, fiches des scripts, réglage par démo,
-- garde-fou d'espace).
begin;
set search_path = public, extensions;
select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000350a1', 'olga-live@acme.example'),
  ('00000000-0000-0000-0000-0000000350a2', 'eddie-live@acme.example'),
  ('00000000-0000-0000-0000-0000000350a3', 'vera-live@acme.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000350a1');
create temp table ctx as select (public.create_workspace('Live')).id as ws;
grant all on ctx to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000350a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000350a3', 'viewer');
insert into public.demos (id, workspace_id, title, kind)
  values ('00000000-0000-0000-0000-0000000350d1', (select ws from ctx), 'CRM', 'sandbox');
create temp table p as select
  (select ws from ctx) || '/00000000-0000-0000-0000-0000000350d1/00000000-0000-0000-0000-0000000350f1' as base;
grant all on p to authenticated;
insert into storage.objects (bucket_id, name) values
  ('html', (select base from p) || '.html'),
  ('html_live', (select base from p) || '.json');

-- Bucket : privé, JSON seulement
select is((select public from storage.buckets where id = 'html_live'), false, 'bucket html_live privé');
select is((select allowed_mime_types from storage.buckets where id = 'html_live'), array['application/json'],
  'bucket html_live : JSON seulement');

-- Réglage par démo et garde-fou : autorisé par défaut
select ok(public.sandbox_live_allowed((select ws from ctx)), 'garde-fou : autorisé par défaut');
select ok(public.sandbox_ok('{"live": true, "autoLink": true}'), 'sandbox.live accepté');
select ok(not public.sandbox_ok('{"live": "oui"}'), 'sandbox.live : booléen seulement');

-- Fiches des scripts
select ok(public.html_meta_ok('{"live": {"scripts": [{"id": "s1", "source": "page", "category": "page", "keep": true, "bytes": 120},
  {"id": "s2", "source": "chat.example", "category": "third", "keep": false}], "responses": 3, "unreplayed": 0}}'),
  'html_meta.live : fiches et compteurs acceptés');
select ok(not public.html_meta_ok('{"live": {"scripts": [{"id": "s1", "category": "page", "keep": true, "code": "x()"}]}}'),
  'html_meta.live : aucun code de script dans les métadonnées');
select ok(not public.html_meta_ok('{"live": {"scripts": [{"id": "x1", "category": "page", "keep": true}]}}'),
  'html_meta.live : identifiant de script invalide refusé');
select ok(not public.html_meta_ok('{"live": {"scripts": [{"id": "s1", "category": "autre", "keep": true}]}}'),
  'html_meta.live : catégorie inconnue refusée');
select ok(not public.html_meta_ok('{"live": {"responses": 301}}'), 'html_meta.live : 300 réponses au plus');
select ok(public.html_meta_ok('{"title": "T", "url": "https://app.example.com/"}'), 'html_meta sans live : inchangé');

-- Étape : enregistrement vivant à côté de la copie inerte
select lives_ok($$ insert into public.steps (id, demo_id, workspace_id, position, kind, html_path, html_live_path, html_meta)
  values ('00000000-0000-0000-0000-0000000350e1', '00000000-0000-0000-0000-0000000350d1', (select ws from ctx), 0, 'html',
          (select base from p) || '.html', (select base from p) || '.json',
          '{"url": "https://app.example.com/", "live": {"scripts": [{"id": "s1", "category": "page", "keep": true}]}}') $$,
  'page vivante enregistrée');
select throws_ok($$ insert into public.steps (id, demo_id, workspace_id, position, kind, html_path, html_live_path)
  values ('00000000-0000-0000-0000-0000000350e2', '00000000-0000-0000-0000-0000000350d1', (select ws from ctx), 1, 'html',
          null, (select base from p) || '.json') $$, '23514', null, 'enregistrement vivant sans copie inerte : refusé');
select throws_ok($$ update public.steps set html_live_path = (select ws from ctx) || '/00000000-0000-0000-0000-0000000350d1/00000000-0000-0000-0000-0000000350f9.json'
  where id = '00000000-0000-0000-0000-0000000350e1' $$, 'P0001', 'HTML_OBJECT_MISSING', 'enregistrement absent du bucket : refusé');
select throws_ok($$ update public.steps set html_live_path = '00000000-0000-0000-0000-0000000350ff/00000000-0000-0000-0000-0000000350d1/00000000-0000-0000-0000-0000000350f1.json'
  where id = '00000000-0000-0000-0000-0000000350e1' $$, '23514', 'HTML_PATH', 'enregistrement d''un autre espace : refusé');

-- Garder / bloquer un script : modifiable sans recapture (l'éditeur change html_meta.live)
select pg_temp.login('00000000-0000-0000-0000-0000000350a2');
select lives_ok($$ update public.steps set html_meta = jsonb_set(html_meta, '{live,scripts,0,keep}', 'false')
  where id = '00000000-0000-0000-0000-0000000350e1' $$, 'éditeur : bloque un script sans recapture');

-- Garde-fou : réservé à l'admin, écriture directe refusée, journalisé
select throws_ok($$ select public.set_sandbox_live((select ws from ctx), false) $$, '42501', 'FORBIDDEN',
  'éditeur : garde-fou refusé');
select pg_temp.login('00000000-0000-0000-0000-0000000350a1');
select throws_ok($$ update public.workspaces set settings = settings || '{"sandboxLive": false}' where id = (select ws from ctx) $$,
  '42501', 'SANDBOX_LIVE_RPC_ONLY', 'écriture directe du garde-fou refusée');
select is(public.set_sandbox_live((select ws from ctx), false), false, 'propriétaire : interdit le mode vivant');
reset role;
select is((select meta from public.audit_log where workspace_id = (select ws from ctx) and action = 'settings.sandbox_live'),
  '{"new": false, "old": true}'::jsonb, 'garde-fou journalisé (ancienne et nouvelle valeur)');

-- Interdit : aucun nouvel enregistrement vivant ; les pages existantes restent modifiables
insert into storage.objects (bucket_id, name) values ('html_live', (select base from p) || '-2.json');
select lives_ok($$ update public.steps set html_ops = '[]' where id = '00000000-0000-0000-0000-0000000350e1' $$,
  'interdit : la page existante reste modifiable');
select throws_ok($$ update public.steps set html_live_path = (select ws from ctx) || '/00000000-0000-0000-0000-0000000350d1/00000000-0000-0000-0000-0000000350f1-2.json'
  where id = '00000000-0000-0000-0000-0000000350e1' $$, '42501', 'SANDBOX_LIVE_DISABLED', 'interdit : aucun nouvel enregistrement vivant');

select * from finish();
rollback;
