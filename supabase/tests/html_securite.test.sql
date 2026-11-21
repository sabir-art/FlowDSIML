-- Tests pgTAP : L49 P2, rapport d'analyse de sécurité (compteurs du serveur, jamais ceux du navigateur).
begin;
set search_path = public, extensions;
select plan(10);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000491a1', 'olga-sec@acme.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000491a1');
create temp table ctx as select (public.create_workspace('Sécurité')).id as ws;
grant all on ctx to authenticated;
reset role;
insert into public.demos (id, workspace_id, title, kind)
  values ('00000000-0000-0000-0000-0000000491d1', (select ws from ctx), 'Fiche', 'guided');
create temp table p as select
  (select ws from ctx) || '/00000000-0000-0000-0000-0000000491d1/00000000-0000-0000-0000-0000000491f1.html' as a,
  (select ws from ctx) || '/00000000-0000-0000-0000-0000000491d1/00000000-0000-0000-0000-0000000491f2.html' as b;
grant all on p to authenticated;
insert into storage.objects (bucket_id, name) select 'html', a from p union all select 'html', b from p;

-- Écrit par html-ingest (service_role) ; page a analysée, page b sans compteurs
insert into public.html_page_security (path, workspace_id, security)
  select a, (select ws from ctx), '{"scripts":2,"handlers":1,"frames":0,"forms":0,"externalLinks":3,"piiReplaced":1,"other":0,"analyzedAt":"2026-11-21T02:00:00Z"}' from p;
select throws_ok($$ insert into public.html_page_security (path, workspace_id, security)
  select b, (select ws from ctx), '{"scripts":-1}' from p $$, '23514', null, 'compteur négatif refusé');

-- Le navigateur envoie un faux rapport : remplacé par celui du serveur
select pg_temp.login('00000000-0000-0000-0000-0000000491a1');
insert into public.steps (id, demo_id, workspace_id, position, kind, html_path, html_meta)
  values ('00000000-0000-0000-0000-0000000491e1', '00000000-0000-0000-0000-0000000491d1', (select ws from ctx), 0,
          'html', (select a from p), '{"url":"https://app.example.com/fiche","security":{"scripts":0,"handlers":0}}');
select is((select html_meta -> 'security' ->> 'scripts' from public.steps where id = '00000000-0000-0000-0000-0000000491e1'),
  '2', 'rapport du serveur, pas celui du navigateur');
select is((select html_meta ->> 'url' from public.steps where id = '00000000-0000-0000-0000-0000000491e1'),
  'https://app.example.com/fiche', 'le reste de html_meta est gardé');

-- Modification de html_meta par l'éditeur : le rapport ne peut pas être effacé ni changé
update public.steps set html_meta = html_meta || '{"security":{"scripts":0}}'::jsonb
  where id = '00000000-0000-0000-0000-0000000491e1';
select is((select html_meta -> 'security' ->> 'scripts' from public.steps where id = '00000000-0000-0000-0000-0000000491e1'),
  '2', 'rapport inchangé après une modification');
update public.steps set html_meta = html_meta - 'security' where id = '00000000-0000-0000-0000-0000000491e1';
select is((select html_meta -> 'security' ->> 'externalLinks' from public.steps where id = '00000000-0000-0000-0000-0000000491e1'),
  '3', 'rapport rétabli s''il est retiré');

-- Page sans compteurs : pas de rapport, même si le navigateur en envoie un
insert into public.steps (id, demo_id, workspace_id, position, kind, html_path, html_meta)
  values ('00000000-0000-0000-0000-0000000491e2', '00000000-0000-0000-0000-0000000491d1', (select ws from ctx), 1,
          'html', (select b from p), '{"url":"https://app.example.com/b","security":{"scripts":0}}');
select ok((select not (html_meta ? 'security') from public.steps where id = '00000000-0000-0000-0000-0000000491e2'),
  'page sans compteurs : pas de rapport');

-- Table fermée à l'app
select throws_ok($$ select * from public.html_page_security $$, '42501', null, 'lecture directe refusée');
select throws_ok($$ insert into public.html_page_security (path, workspace_id, security)
  select b, (select ws from ctx), '{}' from p $$, '42501', null, 'écriture directe refusée');
reset role;

-- Validation de html_meta.security
select ok(public.html_meta_ok('{"security":{"scripts":1,"safeBrowsing":"ok"}}'), 'html_meta : rapport valide accepté');
select ok(not public.html_meta_ok('{"security":{"scripts":1.5}}'), 'html_meta : compteur non entier refusé');

select * from finish();
rollback;
