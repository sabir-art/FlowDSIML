-- Tests pgTAP : L49 P1, réglage « Captures HTML » (droits, domaines, protection de la clé, journal, règle).
begin;
set search_path = public, extensions;
select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000490a1', 'olga-html@acme.example'),
  ('00000000-0000-0000-0000-0000000490a2', 'eddie-html@acme.example'),
  ('00000000-0000-0000-0000-0000000490a3', 'vera-html@acme.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000490a1');
create temp table ctx as select (public.create_workspace('HTML')).id as ws;
grant all on ctx to authenticated;
reset role;
insert into public.members (workspace_id, user_id, role) values
  ((select ws from ctx), '00000000-0000-0000-0000-0000000490a2', 'editor'),
  ((select ws from ctx), '00000000-0000-0000-0000-0000000490a3', 'viewer');

-- Par défaut : autorisées partout
select is(public.html_capture_allows((select ws from ctx), 'crm.partenaire.example'), 'ok', 'défaut : autorisées');

-- Écriture directe de settings.htmlCapture refusée, même par le propriétaire
select pg_temp.login('00000000-0000-0000-0000-0000000490a1');
select throws_ok($$ update public.workspaces set settings = settings || '{"htmlCapture":{"mode":"allowed"}}'
  where id = (select ws from ctx) $$, '42501', 'HTML_CAPTURE_RPC_ONLY', 'écriture directe refusée');

-- Éditeur et lecteur : réglage refusé
select pg_temp.login('00000000-0000-0000-0000-0000000490a2');
select throws_ok($$ select public.set_html_capture((select ws from ctx), 'disabled') $$, '42501', 'FORBIDDEN',
  'éditeur : refusé');
select pg_temp.login('00000000-0000-0000-0000-0000000490a3');
select throws_ok($$ select public.set_html_capture((select ws from ctx), 'disabled') $$, '42501', 'FORBIDDEN',
  'lecteur : refusé');
select throws_ok($$ select public.html_capture_allows((select ws from ctx), 'a.example.com') $$, '42501', null,
  'html_capture_allows : réservée au serveur');

-- Propriétaire : validation des domaines
select pg_temp.login('00000000-0000-0000-0000-0000000490a1');
select throws_ok($$ select public.set_html_capture((select ws from ctx), 'domains', array['https://app.example.com']) $$,
  '22023', 'HTML_CAPTURE_DOMAIN_INVALID', 'protocole refusé');
select throws_ok($$ select public.set_html_capture((select ws from ctx), 'domains', array['app.example.com/chemin']) $$,
  '22023', 'HTML_CAPTURE_DOMAIN_INVALID', 'chemin refusé');
select throws_ok($$ select public.set_html_capture((select ws from ctx), 'domains', array['localhost']) $$,
  '22023', 'HTML_CAPTURE_DOMAIN_INVALID', 'nom sans domaine refusé');
select throws_ok($$ select public.set_html_capture((select ws from ctx), 'domains',
  (select array_agg('d' || i || '.example.com') from generate_series(1, 51) i)) $$,
  '22023', 'HTML_CAPTURE_DOMAIN_MAX', '51 domaines refusés');
select throws_ok($$ select public.set_html_capture((select ws from ctx), 'domains', '{}') $$,
  '22023', 'HTML_CAPTURE_DOMAIN_REQUIRED', 'mode domaines sans domaine refusé');
select throws_ok($$ select public.set_html_capture((select ws from ctx), 'partout') $$,
  '22023', 'INVALID_MODE', 'mode inconnu refusé');
select is(public.set_html_capture((select ws from ctx), 'domains', array[' App.Example.com ', '*.outils.example', 'app.example.com']),
  '{"mode": "domains", "domains": ["app.example.com", "*.outils.example"]}'::jsonb,
  'domaines en minuscules, sans espaces ni doublons');

-- Journal : une entrée par changement, avec l'ancienne et la nouvelle valeur
reset role;
select is((select count(*)::int from public.audit_log where workspace_id = (select ws from ctx)
  and action = 'settings.html_capture'), 1, 'journal : une entrée');
select is((select meta -> 'old' ->> 'mode' from public.audit_log where workspace_id = (select ws from ctx)
  and action = 'settings.html_capture'), 'allowed', 'journal : ancienne valeur');
select is((select actor_id from public.audit_log where workspace_id = (select ws from ctx)
  and action = 'settings.html_capture'), '00000000-0000-0000-0000-0000000490a1'::uuid, 'journal : auteur');

-- Règle appliquée par html-ingest
select is(public.html_capture_allows((select ws from ctx), 'app.example.com'), 'ok', 'domaine exact : accepté');
select is(public.html_capture_allows((select ws from ctx), 'crm.partenaire.example'), 'HTML_CAPTURE_DOMAIN',
  'domaine hors liste : refusé');
select is(public.html_capture_allows((select ws from ctx), 'a.outils.example'), 'ok', 'joker : sous-domaine accepté');
select is(public.html_capture_allows((select ws from ctx), 'outils.example'), 'HTML_CAPTURE_DOMAIN',
  'joker : le domaine nu n''est pas couvert');

-- Adresse enregistrée : même règle (déclencheur sur steps, html_path posé)
select is(public.html_url_host('https://user@App.Example.com:8443/a?b#c'), 'app.example.com', 'hôte lu dans l''adresse');
insert into public.demos (id, workspace_id, title, kind)
  values ('00000000-0000-0000-0000-0000000490d1', (select ws from ctx), 'Fiche', 'guided');
insert into storage.objects (bucket_id, name)
  select 'html', (select ws from ctx) || '/00000000-0000-0000-0000-0000000490d1/' || f from unnest(array['00000000-0000-0000-0000-0000000490f1.html', '00000000-0000-0000-0000-0000000490f2.html', '00000000-0000-0000-0000-0000000490f3.html']) f;
select lives_ok($$ insert into public.steps (id, demo_id, workspace_id, position, kind, html_path, html_meta)
  values ('00000000-0000-0000-0000-0000000490e1', '00000000-0000-0000-0000-0000000490d1', (select ws from ctx), 0,
          'html', (select ws from ctx) || '/00000000-0000-0000-0000-0000000490d1/00000000-0000-0000-0000-0000000490f1.html', '{"url":"https://app.example.com/fiche"}') $$, 'page d''un domaine autorisé : enregistrée');
select throws_ok($$ insert into public.steps (id, demo_id, workspace_id, position, kind, html_path, html_meta)
  values ('00000000-0000-0000-0000-0000000490e2', '00000000-0000-0000-0000-0000000490d1', (select ws from ctx), 1,
          'html', (select ws from ctx) || '/00000000-0000-0000-0000-0000000490d1/00000000-0000-0000-0000-0000000490f2.html', '{"url":"https://crm.partenaire.example/fiche"}') $$,
  '42501', 'HTML_CAPTURE_DOMAIN', 'page hors liste : refusée à l''enregistrement');

select pg_temp.login('00000000-0000-0000-0000-0000000490a1');
select public.set_html_capture((select ws from ctx), 'disabled');
reset role;
select is(public.html_capture_allows((select ws from ctx), 'app.example.com'), 'HTML_CAPTURE_DISABLED',
  'désactivées : toute page refusée');
select lives_ok($$ update public.steps set html_ops = '[]' where id = '00000000-0000-0000-0000-0000000490e1' $$,
  'désactivées : une page existante reste modifiable');
select throws_ok($$ update public.steps set html_path = (select ws from ctx) || '/00000000-0000-0000-0000-0000000490d1/00000000-0000-0000-0000-0000000490f3.html' where id = '00000000-0000-0000-0000-0000000490e1' $$,
  '42501', 'HTML_CAPTURE_DISABLED', 'désactivées : aucune nouvelle page');

select * from finish();
rollback;
