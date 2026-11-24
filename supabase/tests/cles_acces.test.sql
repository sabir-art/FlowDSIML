-- Tests pgTAP : clés d'accès et fonctions de l'API v1 (20261201180000_cles_acces.sql).
-- Données fictives ; aucune clé réelle.
begin;
set search_path = public, extensions;
select plan(36);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000340a1', 'olga-ck@acme.example'),
  ('00000000-0000-0000-0000-0000000340a2', 'camille-ck@acme.example'),
  ('00000000-0000-0000-0000-0000000340a3', 'vera-ck@autre.example');
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;
create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated, service_role;

-- Espace Acme (Olga propriétaire, Camille editor) et espace Autre (Vera propriétaire)
select pg_temp.login('00000000-0000-0000-0000-0000000340a1');
insert into ctx select 'ws', (public.create_workspace('Acme')).id::text;
reset role;
insert into public.members (workspace_id, user_id, role)
  values ((select v::uuid from ctx where k = 'ws'), '00000000-0000-0000-0000-0000000340a2', 'editor');
select pg_temp.login('00000000-0000-0000-0000-0000000340a3');
insert into ctx select 'ws2', (public.create_workspace('Autre')).id::text;
reset role;
insert into public.demos (id, workspace_id, title, status, created_by) values
  ('00000000-0000-0000-0000-0000000340d1', (select v::uuid from ctx where k = 'ws'), 'Créer un rendez-vous', 'published', '00000000-0000-0000-0000-0000000340a1'),
  ('00000000-0000-0000-0000-0000000340d2', (select v::uuid from ctx where k = 'ws'), 'Brouillon', 'draft', '00000000-0000-0000-0000-0000000340a1'),
  ('00000000-0000-0000-0000-0000000340d3', (select v::uuid from ctx where k = 'ws'), 'Archivée', 'archived', '00000000-0000-0000-0000-0000000340a1'),
  ('00000000-0000-0000-0000-0000000340d9', (select v::uuid from ctx where k = 'ws2'), 'Démo d''un autre espace', 'published', '00000000-0000-0000-0000-0000000340a3');
insert into public.leads (id, workspace_id, demo_id, email, created_at) values
  ('00000000-0000-0000-0000-0000000340b1', (select v::uuid from ctx where k = 'ws'), '00000000-0000-0000-0000-0000000340d1', 'visiteur-1@exemple.example', date_trunc('day', now()) - interval '3 days' + interval '9 hours'),
  ('00000000-0000-0000-0000-0000000340b2', (select v::uuid from ctx where k = 'ws'), '00000000-0000-0000-0000-0000000340d1', 'visiteur-2@exemple.example', date_trunc('day', now()) - interval '2 days' + interval '9 hours'),
  ('00000000-0000-0000-0000-0000000340b3', (select v::uuid from ctx where k = 'ws'), '00000000-0000-0000-0000-0000000340d1', 'visiteur-3@exemple.example', date_trunc('day', now()) - interval '1 day' + interval '9 hours'),
  ('00000000-0000-0000-0000-0000000340b9', (select v::uuid from ctx where k = 'ws2'), '00000000-0000-0000-0000-0000000340d9', 'visiteur-9@exemple.example', date_trunc('day', now()) - interval '1 day' + interval '9 hours');

-- ===== Création : rôles, validation, clé renvoyée une fois =====
select pg_temp.login('00000000-0000-0000-0000-0000000340a2');
select throws_ok($$ select public.create_api_key((select v::uuid from ctx where k = 'ws'), 'CRM', array['demos']) $$,
  '42501', null, 'rôle editor : création refusée');
select pg_temp.login('00000000-0000-0000-0000-0000000340a3');
select throws_ok($$ select public.create_api_key((select v::uuid from ctx where k = 'ws'), 'CRM', array['demos']) $$,
  '42501', null, 'propriétaire d''un autre espace : création refusée');
select pg_temp.login('00000000-0000-0000-0000-0000000340a1');
select throws_ok($$ select public.create_api_key((select v::uuid from ctx where k = 'ws'), 'CRM', array[]::text[]) $$,
  '22023', null, 'au moins un accès');
select throws_ok($$ select public.create_api_key((select v::uuid from ctx where k = 'ws'), 'CRM', array['demos', 'ecriture']) $$,
  '22023', null, 'accès inconnu refusé');
select throws_ok($$ select public.create_api_key((select v::uuid from ctx where k = 'ws'), '  ', array['demos']) $$,
  '22023', null, 'nom obligatoire');
select throws_ok($$ select public.create_api_key((select v::uuid from ctx where k = 'ws'), 'CRM', array['demos'], 7) $$,
  '22023', null, 'expiration hors liste refusée');
insert into ctx select 'made', public.create_api_key((select v::uuid from ctx where k = 'ws'), ' CRM ', array['stats', 'demos', 'demos'])::text;
insert into ctx select 'key', (select v::jsonb ->> 'key' from ctx where k = 'made');
insert into ctx select 'id', (select v::jsonb ->> 'id' from ctx where k = 'made');
select ok((select v ~ '^tc_[0-9a-f]{48}$' from ctx where k = 'key'), 'clé renvoyée : tc_ et 48 caractères hexadécimaux');
select is((select name from public.api_keys where id = (select v::uuid from ctx where k = 'id')), 'CRM', 'nom sans espaces autour');
select is((select scopes from public.api_keys where id = (select v::uuid from ctx where k = 'id')), array['demos', 'stats'],
  'accès dédoublonnés et triés');
select is((select last4 from public.api_keys where id = (select v::uuid from ctx where k = 'id')),
  (select right(v, 4) from ctx where k = 'key'), 'les 4 derniers caractères servent à reconnaître la clé');
select ok((select expires_at between now() + interval '89 days' and now() + interval '91 days'
             from public.api_keys where id = (select v::uuid from ctx where k = 'id')), 'expiration à 90 jours par défaut');

-- ===== Seul le condensé est stocké, et il ne se lit pas =====
select throws_ok($$ select key_hash from public.api_keys $$, '42501', null, 'le condensé ne se lit pas (droit de colonne)');
reset role;
select is((select key_hash from public.api_keys where id = (select v::uuid from ctx where k = 'id')),
  encode(digest((select v from ctx where k = 'key'), 'sha256'), 'hex'), 'condensé sha-256 de la clé');
select ok(not exists (select 1 from public.api_keys k, ctx c where c.k = 'key' and to_jsonb(k)::text like '%' || c.v || '%'),
  'la clé en clair n''est stockée nulle part dans la table');
select ok(not exists (select 1 from public.audit_log a, ctx c where c.k = 'key' and to_jsonb(a)::text like '%' || c.v || '%')
          and exists (select 1 from public.audit_log where action = 'api_key.create'),
  'création journalisée, sans la clé');

-- ===== RLS : propriétaires et administrateurs de l'espace seulement ; aucune écriture directe =====
select pg_temp.login('00000000-0000-0000-0000-0000000340a2');
select is((select count(*) from public.api_keys), 0::bigint, 'rôle editor : ne voit aucune clé');
select pg_temp.login('00000000-0000-0000-0000-0000000340a3');
select is((select count(*) from public.api_keys), 0::bigint, 'autre espace : ne voit aucune clé');
select throws_ok($$ select public.revoke_api_key((select v::uuid from ctx where k = 'id')) $$, '42501', null,
  'autre espace : révocation refusée');
select throws_ok($$ select public.rename_api_key((select v::uuid from ctx where k = 'id'), 'Pirate') $$, '42501', null,
  'autre espace : renommage refusé');
select pg_temp.login('00000000-0000-0000-0000-0000000340a1');
select is((select count(*) from public.api_keys), 1::bigint, 'propriétaire : voit la clé de son espace');
select throws_ok($$ update public.api_keys set scopes = array['leads'] $$, '42501', null, 'aucune modification directe (accès figés)');
select throws_ok($$ insert into public.api_keys (workspace_id, name, scopes, last4, key_hash)
                    values ((select v::uuid from ctx where k = 'ws'), 'x', array['demos'], 'abcd', repeat('a', 64)) $$,
  '42501', null, 'aucune insertion directe');
select lives_ok($$ select public.rename_api_key((select v::uuid from ctx where k = 'id'), 'CRM interne') $$, 'renommage par la propriétaire');
select throws_ok($$ select public.api_key_use('x') $$, '42501', null, 'api_key_use : réservée au service');
select throws_ok($$ select public.api_demo_leads((select v::uuid from ctx where k = 'ws'), '00000000-0000-0000-0000-0000000340d1') $$,
  '42501', null, 'lecture des leads par l''API : réservée au service');

-- ===== Utilisation : vérification, dernière utilisation, limite de débit =====
reset role;
create function pg_temp.use_key() returns jsonb language sql as $$
  select public.api_key_use(encode(digest((select v from ctx where k = 'key'), 'sha256'), 'hex'));
$$;
select ok((pg_temp.use_key() ->> 'ok')::boolean
          and pg_temp.use_key() ->> 'workspace_id' = (select v from ctx where k = 'ws')
          and pg_temp.use_key() -> 'scopes' = '["demos", "stats"]'::jsonb, 'clé valide : espace et accès de la clé');
select ok((select last_used_at is not null from public.api_keys where id = (select v::uuid from ctx where k = 'id')),
  'dernière utilisation mise à jour');
select is(public.api_key_use(repeat('0', 64)) ->> 'reason', 'invalid', 'clé inconnue : refusée');
update private.api_key_hits set hits = 60 where key_id = (select v::uuid from ctx where k = 'id');
select is(pg_temp.use_key() ->> 'reason', 'rate', 'au-delà de 60 appels dans la minute : limite de débit');
delete from private.api_key_hits;
update public.api_keys set expires_at = now() - interval '1 minute' where id = (select v::uuid from ctx where k = 'id');
select is(pg_temp.use_key() ->> 'reason', 'invalid', 'clé expirée : refusée');
update public.api_keys set expires_at = null where id = (select v::uuid from ctx where k = 'id');

-- ===== Lecture bornée à l'espace de la clé =====
select is((select jsonb_agg(x ->> 'title' order by x ->> 'title') from jsonb_array_elements(public.api_demos((select v::uuid from ctx where k = 'ws'))) x),
  '["Brouillon", "Créer un rendez-vous"]'::jsonb, 'démos : brouillons et publiées de l''espace, ni archivée, ni autre espace');
select ok(public.api_demos((select v::uuid from ctx where k = 'ws'))::text !~ 'acme\.example|created_by|olga',
  'démos : ni nom ni adresse d''un membre');
select ok(public.api_demo_stats((select v::uuid from ctx where k = 'ws'), '00000000-0000-0000-0000-0000000340d9') is null
          and public.api_demo_leads((select v::uuid from ctx where k = 'ws'), '00000000-0000-0000-0000-0000000340d9') is null,
  'démo d''un autre espace : ni statistiques, ni leads');
select is((select jsonb_agg(x ->> 'email') from jsonb_array_elements(
             public.api_demo_leads((select v::uuid from ctx where k = 'ws'), '00000000-0000-0000-0000-0000000340d1', 2)) x),
  '["visiteur-3@exemple.example", "visiteur-2@exemple.example", "visiteur-1@exemple.example"]'::jsonb,
  'leads : du plus récent au plus ancien, une ligne de plus que la page pour savoir s''il en reste');
select is((select jsonb_agg(x ->> 'email') from jsonb_array_elements(
             public.api_demo_leads((select v::uuid from ctx where k = 'ws'), '00000000-0000-0000-0000-0000000340d1', 2,
               date_trunc('day', now()) - interval '2 days' + interval '9 hours', '00000000-0000-0000-0000-0000000340b2')) x),
  '["visiteur-1@exemple.example"]'::jsonb, 'leads : page suivante après le curseur');

-- ===== Révocation : effet immédiat =====
select pg_temp.login('00000000-0000-0000-0000-0000000340a1');
select public.revoke_api_key((select v::uuid from ctx where k = 'id'));
reset role;
select ok(pg_temp.use_key() ->> 'reason' = 'invalid'
          and exists (select 1 from public.audit_log where action = 'api_key.revoke'),
  'clé révoquée : refusée dès l''appel suivant, révocation journalisée');

select * from finish();
rollback;
